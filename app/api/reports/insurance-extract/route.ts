export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { inflateRawSync } from 'zlib';

// Reads an uploaded insurance invoice (PDF, DOCX, or an image/screenshot) with
// Claude and extracts the fields the Insurance tab needs. Returns
// { fields: { carrier, invoiceType, amount, deadline, coveragePeriod, enrolledCount } }.

// ---- DOCX text extraction (no extra deps) ---------------------------------
// A .docx is a zip; the text lives in word/document.xml. We walk the local
// file headers, inflate that entry, and strip the XML down to plain text.
function docxToText(buf: Buffer): string {
  let i = 0;
  while (i < buf.length - 4) {
    if (buf.readUInt32LE(i) !== 0x04034b50) break; // local file header magic
    const method = buf.readUInt16LE(i + 8);
    let compSize = buf.readUInt32LE(i + 18);
    const nameLen = buf.readUInt16LE(i + 26);
    const extraLen = buf.readUInt16LE(i + 28);
    const name = buf.toString('utf8', i + 30, i + 30 + nameLen);
    let dataStart = i + 30 + nameLen + extraLen;
    if (name === 'word/document.xml') {
      // Sizes can be in the data descriptor (bit 3); fall back to scanning.
      if (compSize === 0 || compSize === 0xffffffff) {
        const next = buf.indexOf(Buffer.from([0x50, 0x4b]), dataStart + 1);
        compSize = (next > 0 ? next : buf.length) - dataStart;
      }
      const raw = buf.subarray(dataStart, dataStart + compSize);
      const xml = method === 0 ? raw.toString('utf8') : inflateRawSync(raw).toString('utf8');
      return xml
        .replace(/<w:p[ >]/g, '\n<w:p ')          // paragraph breaks
        .replace(/<w:tab[^>]*\/>/g, '\t')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#?\w+;/g, ' ')
        .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    }
    if (compSize === 0 || compSize === 0xffffffff) {
      const next = buf.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]), dataStart + 1);
      if (next < 0) break;
      i = next;
    } else {
      i = dataStart + compSize;
    }
  }
  return '';
}

const IMAGE_TYPES: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif',
};

const PROMPT = `This is an insurance invoice (or a screenshot of one). Extract these fields and respond with ONLY a JSON object, no markdown fences, no commentary:
{
  "carrier": string | null,          // insurance carrier / company name
  "invoiceType": string | null,      // e.g. Medical, Dental, Vision, Life, Premium
  "amount": number | null,           // total amount due, numeric, no $ or commas
  "deadline": string | null,         // payment due date as YYYY-MM-DD
  "coveragePeriod": string | null,   // e.g. "Aug 1 – Aug 31, 2026" or "08/2026"
  "enrolledCount": number | null     // number of enrolled employees/members if shown
}
Use null for anything not present. Dates must be YYYY-MM-DD.`;

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Automatic reading needs ANTHROPIC_API_KEY on the server — enter the fields manually for now.' }, { status: 501 });
  }
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: 'File too large (max 20 MB)' }, { status: 400 });

  const ext = (file.name.split('.').pop() ?? '').toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());

  // Build the content block for the file: PDFs as documents, images as vision
  // input, DOCX as extracted text.
  let fileBlock: any;
  if (ext === 'pdf' || file.type === 'application/pdf') {
    fileBlock = { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buf.toString('base64') } };
  } else if (IMAGE_TYPES[ext] || file.type.startsWith('image/')) {
    fileBlock = { type: 'image', source: { type: 'base64', media_type: IMAGE_TYPES[ext] ?? file.type, data: buf.toString('base64') } };
  } else if (ext === 'docx') {
    const text = docxToText(buf);
    if (!text) return NextResponse.json({ error: 'Could not read any text from this .docx' }, { status: 400 });
    fileBlock = { type: 'text', text: `Invoice document text:\n\n${text.slice(0, 40000)}` };
  } else {
    return NextResponse.json({ error: `Unsupported file type ".${ext}" — use PDF, DOCX, PNG, or JPG.` }, { status: 400 });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic.Anthropic({ apiKey });
    const model = process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-8';
    const msg = await client.messages.create({
      model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: [fileBlock, { type: 'text', text: PROMPT }] }],
    } as any);
    const text = msg.content?.[0]?.type === 'text' ? msg.content[0].text : '';
    // Parse the JSON object out of the reply (tolerates stray prose/fences).
    const m = String(text).match(/\{[\s\S]*\}/);
    if (!m) return NextResponse.json({ error: 'Could not read the invoice — fill the fields manually.' }, { status: 422 });
    const j = JSON.parse(m[0]);
    const fields = {
      carrier: j.carrier != null ? String(j.carrier) : '',
      invoiceType: j.invoiceType != null ? String(j.invoiceType) : '',
      amount: j.amount != null && !isNaN(Number(j.amount)) ? String(j.amount) : '',
      deadline: typeof j.deadline === 'string' && /^\d{4}-\d{2}-\d{2}/.test(j.deadline) ? j.deadline.slice(0, 10) : '',
      coveragePeriod: j.coveragePeriod != null ? String(j.coveragePeriod) : '',
      enrolledCount: j.enrolledCount != null && !isNaN(Number(j.enrolledCount)) ? String(j.enrolledCount) : '',
    };
    return NextResponse.json({ fields });
  } catch (e) {
    return NextResponse.json({ error: `Could not read the invoice (${String(e).slice(0, 120)}) — fill the fields manually.` }, { status: 502 });
  }
}

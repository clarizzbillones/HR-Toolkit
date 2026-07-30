export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { inflateRawSync } from 'zlib';

// Reads an uploaded document (PDF, DOCX, or image) attached to an employee file
// with Claude and returns a suggested { title, date, summary }.

function docxToText(buf: Buffer): string {
  let i = 0;
  while (i < buf.length - 4) {
    if (buf.readUInt32LE(i) !== 0x04034b50) break;
    const method = buf.readUInt16LE(i + 8);
    let compSize = buf.readUInt32LE(i + 18);
    const nameLen = buf.readUInt16LE(i + 26);
    const extraLen = buf.readUInt16LE(i + 28);
    const name = buf.toString('utf8', i + 30, i + 30 + nameLen);
    const dataStart = i + 30 + nameLen + extraLen;
    if (name === 'word/document.xml') {
      if (compSize === 0 || compSize === 0xffffffff) {
        const next = buf.indexOf(Buffer.from([0x50, 0x4b]), dataStart + 1);
        compSize = (next > 0 ? next : buf.length) - dataStart;
      }
      const raw = buf.subarray(dataStart, dataStart + compSize);
      const xml = method === 0 ? raw.toString('utf8') : inflateRawSync(raw).toString('utf8');
      return xml
        .replace(/<w:p[ >]/g, '\n<w:p ')
        .replace(/<w:tab[^>]*\/>/g, '\t')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#?\w+;/g, ' ')
        .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    }
    if (compSize === 0 || compSize === 0xffffffff) {
      const next = buf.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]), dataStart + 1);
      if (next < 0) break; i = next;
    } else { i = dataStart + compSize; }
  }
  return '';
}

const IMAGE_TYPES: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };

const PROMPT = `This is a document attached to an employee's HR file (e.g. a review, coaching note, warning, certificate, or letter). Respond with ONLY a JSON object, no markdown fences, no commentary:
{
  "title": string | null,     // a short document title/type, e.g. "Written Warning", "6-Month Review"
  "date": string | null,      // the document's date as YYYY-MM-DD if present
  "summary": string | null    // a concise 2-4 sentence plain-language summary of the key content
}
Use null for anything not present. Dates must be YYYY-MM-DD.`;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Auto-read needs ANTHROPIC_API_KEY on the server — fill the fields manually for now.' }, { status: 501 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: 'File too large (max 20 MB)' }, { status: 400 });

  const ext = (file.name.split('.').pop() ?? '').toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());
  let fileBlock: any;
  if (ext === 'pdf' || file.type === 'application/pdf') {
    fileBlock = { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buf.toString('base64') } };
  } else if (IMAGE_TYPES[ext] || file.type.startsWith('image/')) {
    fileBlock = { type: 'image', source: { type: 'base64', media_type: IMAGE_TYPES[ext] ?? file.type, data: buf.toString('base64') } };
  } else if (ext === 'docx') {
    const text = docxToText(buf);
    if (!text) return NextResponse.json({ error: 'Could not read any text from this .docx' }, { status: 400 });
    fileBlock = { type: 'text', text: `Document text:\n\n${text.slice(0, 40000)}` };
  } else {
    return NextResponse.json({ error: `Unsupported file type ".${ext}" — use PDF, DOCX, PNG, or JPG.` }, { status: 400 });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic.Anthropic({ apiKey });
    const model = process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-8';
    const msg = await client.messages.create({ model, max_tokens: 1024, messages: [{ role: 'user', content: [fileBlock, { type: 'text', text: PROMPT }] }] } as any);
    const text = msg.content?.[0]?.type === 'text' ? msg.content[0].text : '';
    const m = String(text).match(/\{[\s\S]*\}/);
    if (!m) return NextResponse.json({ error: 'Could not read the document — fill the fields manually.' }, { status: 422 });
    const j = JSON.parse(m[0]);
    return NextResponse.json({ fields: {
      title: j.title != null ? String(j.title) : '',
      date: typeof j.date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(j.date) ? j.date.slice(0, 10) : '',
      summary: j.summary != null ? String(j.summary) : '',
    } });
  } catch (e) {
    return NextResponse.json({ error: `Could not read the document (${String(e).slice(0, 120)}).` }, { status: 502 });
  }
}

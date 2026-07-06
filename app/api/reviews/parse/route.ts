export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';

// Short, fast "quick summary" — used only when an AI key is configured
const PROMPT = `Write a brief 3–4 sentence quick summary of this employee performance review: overall assessment, main strength, main area to improve. Plain text only, no markdown or bullets. Return ONLY the summary.`;
const FAST = process.env.ANTHROPIC_FAST_MODEL ?? 'claude-haiku-4-5-20251001';

// Condense extracted text: AI if a key exists, otherwise trim the raw text
async function condense(text: string): Promise<string> {
  const clean = text.replace(/\n{3,}/g, '\n\n').trim();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return clean.slice(0, 4000); // no key — return extracted text
  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic.Anthropic({ apiKey });
    const msg = await client.messages.create({ model: FAST, max_tokens: 300, messages: [{ role: 'user', content: `${PROMPT}\n\nReview content:\n${clean.slice(0, 20000)}` }] });
    return (msg.content[0]?.type === 'text' ? msg.content[0].text : '').trim() || clean.slice(0, 4000);
  } catch { return clean.slice(0, 4000); }
}

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });
  const name = file.name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());

  try {
    let text = '';
    if (name.endsWith('.pdf') || file.type === 'application/pdf') {
      const { PDFParse } = require('pdf-parse');
      const parser = new PDFParse({ data: new Uint8Array(buf) });
      text = (await parser.getText()).text ?? '';
    } else if (name.endsWith('.docx')) {
      const mammoth = require('mammoth');
      text = (await mammoth.extractRawText({ buffer: buf })).value ?? '';
    } else if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
      const { read, utils } = await import('xlsx');
      const wb = read(buf, { type: 'buffer' });
      text = wb.SheetNames.map(n => utils.sheet_to_csv(wb.Sheets[n])).join('\n\n');
    } else if (name.endsWith('.doc')) {
      return NextResponse.json({ error: 'Old .doc format isn’t supported — save as .docx or PDF.' }, { status: 415 });
    } else {
      text = buf.toString('utf-8');
      if (/�/.test(text.slice(0, 300))) return NextResponse.json({ error: 'Unsupported file. Upload a PDF, DOCX, TXT, CSV, or XLSX.' }, { status: 415 });
    }

    if (!text.trim()) return NextResponse.json({ error: 'No readable text found in the file (it may be a scanned image).' }, { status: 422 });
    return NextResponse.json({ summary: await condense(text) });
  } catch (e) {
    return NextResponse.json({ error: `Could not read the file: ${String((e as Error).message ?? e)}` }, { status: 500 });
  }
}

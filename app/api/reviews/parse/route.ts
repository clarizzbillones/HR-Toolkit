export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';

// 3-paragraph summary
const PROMPT = `Summarize this employee performance review in exactly THREE short paragraphs, separated by a blank line:
Paragraph 1 — overall assessment / rating.
Paragraph 2 — key strengths.
Paragraph 3 — areas to improve and goals / next steps.
Plain text only, no markdown, no headings, no bullets. Return ONLY the three paragraphs.`;
const FAST = process.env.ANTHROPIC_FAST_MODEL ?? 'claude-haiku-4-5-20251001';

// Without AI, return a trimmed ~3-paragraph extract instead of the whole document
function extract3(text: string): string {
  const paras = text.split(/\n\s*\n/).map(p => p.replace(/\s+/g, ' ').trim()).filter(p => p.length > 20);
  const pick = paras.length <= 3 ? paras : [paras[0], paras[Math.floor(paras.length / 2)], paras[paras.length - 1]];
  return pick.map(p => p.length > 700 ? p.slice(0, 700) + '…' : p).join('\n\n') || text.slice(0, 1500);
}

// Condense extracted text: AI 3-paragraph summary if a key exists, otherwise a trimmed extract
async function condense(text: string): Promise<string> {
  const clean = text.replace(/\n{3,}/g, '\n\n').trim();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return extract3(clean);
  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic.Anthropic({ apiKey });
    const msg = await client.messages.create({ model: FAST, max_tokens: 600, messages: [{ role: 'user', content: `${PROMPT}\n\nReview content:\n${clean.slice(0, 20000)}` }] });
    return (msg.content[0]?.type === 'text' ? msg.content[0].text : '').trim() || extract3(clean);
  } catch { return extract3(clean); }
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
      const pdf = require('pdf-parse/lib/pdf-parse.js');
      text = (await pdf(buf)).text ?? '';
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

export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

// Short, fast "quick summary" — 3–4 sentences
const PROMPT = `Write a brief 3–4 sentence quick summary of this employee performance review: overall assessment, main strength, main area to improve. Plain text only, no markdown or bullets. Return ONLY the summary.`;
// Prefer the fast model so parsing returns quickly
const FAST = process.env.ANTHROPIC_FAST_MODEL ?? 'claude-haiku-4-5-20251001';

async function summarize(text: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return text.slice(0, 2000); // no key — return extracted text as-is
  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic.Anthropic({ apiKey });
    const msg = await client.messages.create({ model: FAST, max_tokens: 300, messages: [{ role: 'user', content: `${PROMPT}\n\nReview content:\n${text.slice(0, 20000)}` }] });
    return (msg.content[0]?.type === 'text' ? msg.content[0].text : '').trim() || text.slice(0, 2000);
  } catch { return text.slice(0, 2000); }
}

async function summarizePdf(base64: string): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic.Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: FAST, max_tokens: 300,
      messages: [{ role: 'user', content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
        { type: 'text', text: PROMPT },
      ] }],
    });
    return (msg.content[0]?.type === 'text' ? msg.content[0].text : '').trim() || null;
  } catch { return null; }
}

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });
  const name = file.name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());

  try {
    if (name.endsWith('.pdf') || file.type === 'application/pdf') {
      const summary = await summarizePdf(buf.toString('base64'));
      if (!summary) return NextResponse.json({ error: 'PDF parsing needs the AI key. Paste the text, or upload a .txt / .xlsx version.' }, { status: 422 });
      return NextResponse.json({ summary });
    }
    if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
      const { read, utils } = await import('xlsx');
      const wb = read(buf, { type: 'buffer' });
      const text = wb.SheetNames.map(n => utils.sheet_to_csv(wb.Sheets[n])).join('\n\n');
      return NextResponse.json({ summary: await summarize(text) });
    }
    // txt / md / anything decodable as text
    const text = buf.toString('utf-8');
    if (/�/.test(text.slice(0, 200))) {
      return NextResponse.json({ error: 'Unsupported file. Upload a PDF, TXT, CSV, or XLSX (Word .docx isn’t supported — save as PDF).' }, { status: 415 });
    }
    return NextResponse.json({ summary: await summarize(text) });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message ?? e) }, { status: 500 });
  }
}

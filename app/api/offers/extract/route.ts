export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import mammoth from 'mammoth';

// Decode the handful of HTML entities mammoth emits.
function decodeEntities(s: string): string {
  return s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

// Reflow raw PDF text into readable paragraphs. pdf-parse emits a hard line
// break at every visual line (and doubled spaces from justified text), which
// shreds paragraphs. This rejoins wrapped lines, keeps numbered/bulleted lists,
// bolds short headings, and heals page-break splits inside a paragraph.
function reflowPdfText(raw: string): string {
  const lines = raw.split('\n').map(l => l.replace(/\s{2,}/g, ' ').trim());
  const lens = lines.filter(l => l.length > 0).map(l => l.length).sort((a, b) => a - b);
  const wide = lens.length ? lens[Math.floor(lens.length * 0.85)] : 80; // ~full line width

  const isNum = (l: string) => /^\d+\.\s/.test(l);
  const isBullet = (l: string) => /^[•·▪]\s?/.test(l) || /^-\s/.test(l);
  const isLetterHead = (l: string) => /^[A-Z]\.\s+\S/.test(l);   // "A. The Amazon Matter"
  const isHeading = (l: string) => {
    if (!l || isNum(l) || isBullet(l) || isLetterHead(l)) return false;
    return l.split(' ').length <= 8 && !/[.,;:]$/.test(l) && /^[A-Z0-9]/.test(l);
  };
  const endsSentence = (l: string) => /[.!?:”")]$/.test(l);

  const out: string[] = [];
  let para = '';
  const flush = () => { if (para.trim()) out.push(para.trim()); para = ''; };

  for (const line of lines) {
    if (!line) { if (endsSentence(para)) flush(); continue; } // blank inside a sentence = soft wrap
    if (isNum(line) || isBullet(line)) { flush(); para = line; continue; }
    if (isLetterHead(line) || isHeading(line)) { flush(); out.push('__H__' + line); continue; }
    para = para ? para + ' ' + line : line;
    if (endsSentence(line) && line.length < wide * 0.9) flush(); // short ending line = paragraph break
  }
  flush();

  const blocks: string[] = [];
  for (let b of out) {
    if (b.startsWith('__H__')) b = '**' + b.slice(5) + '**';
    if (blocks.length) blocks.push('');
    blocks.push(b);
  }
  return blocks.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// Convert mammoth's HTML into the General-letter body's mini-markdown:
// **bold**, *italic*, "• bullet" lines, blank line between paragraphs.
function htmlToBody(html: string): string {
  let s = html;
  s = s.replace(/<(strong|b)>/gi, '**').replace(/<\/(strong|b)>/gi, '**');
  s = s.replace(/<(em|i)>/gi, '*').replace(/<\/(em|i)>/gi, '*');
  s = s.replace(/<li[^>]*>/gi, '\n• ').replace(/<\/li>/gi, '');
  s = s.replace(/<\/(p|div|h[1-6])>/gi, '\n\n').replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<[^>]+>/g, '');           // strip any remaining tags
  s = decodeEntities(s);
  s = s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n'); // tidy whitespace
  return s.trim();
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

    const name = (file.name || '').toLowerCase();
    const buf = Buffer.from(await file.arrayBuffer());

    let text = '';
    if (name.endsWith('.docx') || name.endsWith('.doc')) {
      const { value } = await mammoth.convertToHtml({ buffer: buf });
      text = htmlToBody(value);
    } else if (name.endsWith('.pdf')) {
      // Import lazily and from the lib path to avoid pdf-parse's debug harness.
      const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
      const { text: t } = await pdfParse(buf);
      text = reflowPdfText(String(t || ''));
    } else {
      // txt / md / rtf / anything else — treat as UTF-8 text.
      text = buf.toString('utf8');
      if (name.endsWith('.rtf')) text = text.replace(/\\[a-z]+\d*/gi, ' ').replace(/[{}]/g, '').replace(/\s{2,}/g, ' ').trim();
    }

    if (!text.trim()) return NextResponse.json({ error: 'No readable text found in that document' }, { status: 422 });
    return NextResponse.json({ text });
  } catch (e: any) {
    return NextResponse.json({ error: 'Could not read that document. Try a .docx, .pdf, or .txt file.' }, { status: 500 });
  }
}

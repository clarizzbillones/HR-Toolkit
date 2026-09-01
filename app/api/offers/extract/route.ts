export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import mammoth from 'mammoth';

// Decode the handful of HTML entities mammoth emits.
function decodeEntities(s: string): string {
  return s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
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
      text = String(t || '').replace(/\n{3,}/g, '\n\n').trim();
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

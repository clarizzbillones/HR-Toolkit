export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import mammoth from 'mammoth';

// Decode the handful of HTML entities mammoth emits.
function decodeEntities(s: string): string {
  return s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

const isItalicFont = (n?: string) => /italic|oblique/i.test(n || '');
const isBoldFont = (n?: string) => /bold|black|heavy|semibold/i.test(n || '');

// Wrap a run of text in **/* markers for the letter body, keeping surrounding
// spaces OUTSIDE the markers so the inline formatter parses them correctly.
function wrapStyle(text: string, ital: boolean, bold: boolean): string {
  if (!ital && !bold) return text;
  const lead = (text.match(/^\s*/) || [''])[0];
  const trail = (text.match(/\s*$/) || [''])[0];
  const core = text.slice(lead.length, text.length - trail.length);
  if (!core) return text;
  const open = (bold ? '**' : '') + (ital ? '*' : '');
  const close = (ital ? '*' : '') + (bold ? '**' : '');
  return lead + open + core + close + trail;
}

// Extract a PDF's text with italic/bold preserved. pdf-parse throws styling
// away, so we drive the bundled pdf.js engine directly: for each page we read
// the text runs plus each run's font name (which reveals "...ItalicMT" /
// "...BoldMT") and wrap styled runs in *…* / **…**. A newline is inserted when
// the vertical position changes (same heuristic pdf-parse uses).
async function extractPdfStyled(buf: Buffer): Promise<string> {
  const mod: any = await import('pdf-parse/lib/pdf.js/v2.0.550/build/pdf.js');
  const PDFJS: any = mod.default ?? mod;
  PDFJS.disableWorker = true;
  const doc: any = await PDFJS.getDocument(new Uint8Array(buf));
  let all = '';
  for (let pn = 1; pn <= doc.numPages; pn++) {
    const page: any = await doc.getPage(pn);
    await page.getOperatorList(); // forces fonts to load so names resolve
    const tc: any = await page.getTextContent();
    const fontNames: Record<string, string | null> = {};
    const uniq = [...new Set(tc.items.map((i: any) => i.fontName))] as string[];
    await Promise.all(uniq.map(fn => new Promise<void>(res => {
      let done = false;
      const finish = (name: string | null) => { if (!done) { done = true; fontNames[fn] = name; res(); } };
      try { page.commonObjs.get(fn, (font: any) => finish(font && font.name)); } catch { finish(null); }
      setTimeout(() => finish(null), 4000); // never hang on an unresolved font
    })));
    let lastY: number | null = null;
    let line: { str: string; it: boolean; bd: boolean }[] = [];
    const flushLine = () => {
      let s = '', i = 0;
      while (i < line.length) {
        let j = i, txt = '';
        while (j < line.length && line[j].it === line[i].it && line[j].bd === line[i].bd) { txt += line[j].str; j++; }
        s += wrapStyle(txt, line[i].it, line[i].bd); i = j;
      }
      all += (all && !all.endsWith('\n') ? '\n' : '') + s.replace(/[ \t]{2,}/g, ' ').trim() + '\n';
      line = [];
    };
    for (const it of tc.items) {
      const y = it.transform[5];
      if (lastY !== null && y !== lastY) flushLine();
      line.push({ str: it.str, it: isItalicFont(fontNames[it.fontName] ?? ''), bd: isBoldFont(fontNames[it.fontName] ?? '') });
      lastY = y;
    }
    flushLine();
    all += '\n';
  }
  return all;
}

// Text with any *…*/**…** markers stripped — used for the layout heuristics so
// the markers don't throw off length / punctuation checks.
const plain = (l: string) => l.replace(/\*+/g, '').trim();

// Reflow line-broken text (from the styled PDF extractor) into flowing
// paragraphs: rejoin wrapped lines, keep numbered/bulleted lists, and put
// bold headings on their own line. Inline *italic* / **bold** markers are
// preserved as-is.
function reflowBody(raw: string): string {
  const lines = raw.split('\n').map(l => l.replace(/[ \t]{2,}/g, ' ').trimEnd());
  const lens = lines.map(l => plain(l).length).filter(n => n > 0).sort((a, b) => a - b);
  const wide = lens.length ? lens[Math.floor(lens.length * 0.85)] : 80;

  const isNum = (l: string) => /^\d+\.\s/.test(plain(l));
  const isBullet = (l: string) => /^[•·▪]\s?/.test(plain(l)) || /^-\s/.test(plain(l));
  const isBoldHead = (l: string) => /^\*\*.+\*\*$/.test(l.trim()) && plain(l).split(' ').length <= 10;
  const isLetterHead = (l: string) => /^[A-Z]\.\s+\S/.test(plain(l));
  const isHeading = (l: string) => {
    const p = plain(l);
    if (!p || isNum(l) || isBullet(l) || isLetterHead(l)) return false;
    return p.split(' ').length <= 8 && !/[.,;:]$/.test(p) && /^[A-Z0-9]/.test(p);
  };
  const endsSentence = (l: string) => /[.!?:”")]$/.test(plain(l));

  const out: string[] = [];
  let para = '';
  const flush = () => { if (para.trim()) out.push(para.trim()); para = ''; };
  for (const raw2 of lines) {
    const t = raw2.trim();
    if (!t) { if (endsSentence(para)) flush(); continue; }
    if (isBoldHead(raw2)) { flush(); out.push('__B__' + t); continue; }
    if (isNum(raw2) || isBullet(raw2)) { flush(); para = t; continue; }
    if (isLetterHead(raw2) || isHeading(raw2)) { flush(); out.push('__H__' + plain(raw2)); continue; }
    para = para ? para + ' ' + t : t;
    if (endsSentence(raw2) && plain(raw2).length < wide * 0.9) flush();
  }
  flush();

  const blocks: string[] = [];
  for (let b of out) {
    if (b.startsWith('__B__')) b = b.slice(5);              // already bold from the font
    else if (b.startsWith('__H__')) b = '**' + b.slice(5) + '**'; // bold a structural heading
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

// Strip a letter's own trailing sign-off / signature / acknowledgment so the
// General-letter builder's closing + acknowledgment aren't duplicated. Only
// looks in the latter half of the document to avoid cutting real content.
function trimClosing(text: string): string {
  const lines = text.split('\n');
  const closingRe = /^\s*(sincerely|very truly yours|respectfully(?: submitted)?|regards|best regards|warm regards|kind regards|cordially|yours truly|with regards)\b/i;
  const ackRe = /^\s*acknowledg(e?ment|ing|e)\b/i;
  const start = Math.floor(lines.length * 0.5);
  let cut = -1;
  for (let i = start; i < lines.length; i++) {
    const l = plain(lines[i]);
    if (!l) continue;
    if ((closingRe.test(l) && l.length < 40) || ackRe.test(l)) { cut = i; break; }
  }
  return cut >= 0 ? lines.slice(0, cut).join('\n').replace(/\n{3,}/g, '\n\n').trim() : text;
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
      try {
        text = reflowBody(await extractPdfStyled(buf)); // keeps italic/bold
      } catch {
        // Fall back to plain text extraction if the styled path fails.
        const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
        const { text: t } = await pdfParse(buf);
        text = reflowBody(String(t || ''));
      }
    } else {
      // txt / md / rtf / anything else — treat as UTF-8 text.
      text = buf.toString('utf8');
      if (name.endsWith('.rtf')) text = text.replace(/\\[a-z]+\d*/gi, ' ').replace(/[{}]/g, '').replace(/\s{2,}/g, ' ').trim();
    }

    if (!text.trim()) return NextResponse.json({ error: 'No readable text found in that document' }, { status: 422 });
    // Drop the source letter's own closing/signature/acknowledgment — the
    // builder adds those (and its acknowledgment renders below the signature).
    const trimmed = trimClosing(text);
    text = trimmed.trim() ? trimmed : text;
    return NextResponse.json({ text });
  } catch {
    return NextResponse.json({ error: 'Could not read that document. Try a .docx, .pdf, or .txt file.' }, { status: 500 });
  }
}

// Server-side branded PDF generation for Employee File attachments (Litson navy
// + gold). Uses pdf-lib so it works on Vercel without a headless browser.
// Produces a data:application/pdf URL that can be stored and streamed back.

import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib';
import { parseSignatories, fmtLong } from './coachingDoc';
import { DOC_SECTIONS, BENEFITS_REF, type OffboardingDoc, type Cell } from './offboardingDoc';
import { ONB_BENEFITS_REF, type OnboardingDoc, type Cell as OnbCell } from './onboardingDoc';

const GREEN = rgb(0.18, 0.49, 0.36);

const NAVY = rgb(0.106, 0.165, 0.239);
const GOLD = rgb(0.788, 0.635, 0.290);
const INK = rgb(0.106, 0.165, 0.239);
const MUTED = rgb(0.42, 0.4, 0.36);
const RULE = rgb(0.9, 0.86, 0.8);

const PAGE_W = 612, PAGE_H = 792, MARGIN = 54;
const CONTENT_W = PAGE_W - MARGIN * 2;

// Strip the light inline markdown we use in notes so it reads cleanly in a PDF.
function stripMd(s: string): string {
  return String(s ?? '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/(^|[^a-zA-Z0-9])_(.+?)_(?![a-zA-Z0-9])/g, '$1$2');
}
function clean(s: any): string {
  // pdf-lib's standard fonts are WinAnsi — replace the few unicode chars we use.
  return String(s ?? '')
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-').replace(/[••]/g, '-')
    .replace(/[→]/g, '->').replace(/[^\x00-\xff]/g, '');
}

// Wrap a single logical line to fit CONTENT_W (minus an optional indent).
function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const words = clean(text).split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (font.widthOfTextAtSize(test, size) > maxW && cur) { lines.push(cur); cur = w; }
    else cur = test;
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

// A tiny top-down text cursor with automatic page breaks and a repeating header band.
class Doc {
  pdf!: PDFDocument; page!: PDFPage; y = 0;
  reg!: PDFFont; bold!: PDFFont; ital!: PDFFont;
  title = ''; subtitle = '';
  static async create(title: string, subtitle: string) {
    const d = new Doc();
    d.pdf = await PDFDocument.create();
    d.reg = await d.pdf.embedFont(StandardFonts.TimesRoman);
    d.bold = await d.pdf.embedFont(StandardFonts.TimesRomanBold);
    d.ital = await d.pdf.embedFont(StandardFonts.TimesRomanItalic);
    d.title = title; d.subtitle = subtitle;
    d.newPage();
    return d;
  }
  newPage() {
    this.page = this.pdf.addPage([PAGE_W, PAGE_H]);
    // Navy header band with a gold top stripe.
    const bandH = 74;
    this.page.drawRectangle({ x: 0, y: PAGE_H - bandH, width: PAGE_W, height: bandH, color: NAVY });
    this.page.drawRectangle({ x: 0, y: PAGE_H - 3, width: PAGE_W, height: 3, color: GOLD });
    this.page.drawText('LITSON', { x: MARGIN, y: PAGE_H - 30, size: 15, font: this.bold, color: GOLD });
    this.page.drawText('PLLC  .  HUMAN RESOURCES', { x: MARGIN, y: PAGE_H - 42, size: 7, font: this.bold, color: rgb(0.62, 0.69, 0.77) });
    this.page.drawText(clean(this.title), { x: MARGIN, y: PAGE_H - 62, size: 15, font: this.bold, color: rgb(1, 1, 1) });
    this.y = PAGE_H - bandH - 26;
  }
  need(h: number) { if (this.y - h < MARGIN) this.newPage(); }
  gap(h: number) { this.y -= h; }
  rule() {
    this.need(12); this.y -= 6;
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: PAGE_W - MARGIN, y: this.y }, thickness: 1, color: RULE });
    this.y -= 10;
  }
  // A wrapped paragraph. opts: font, size, color, indent, bullet, leading.
  para(text: string, opts: { font?: PDFFont; size?: number; color?: any; indent?: number; bullet?: boolean; leading?: number } = {}) {
    const font = opts.font ?? this.reg, size = opts.size ?? 11, color = opts.color ?? INK;
    const indent = opts.indent ?? 0, leading = opts.leading ?? size * 1.4;
    const lead = opts.bullet ? '-  ' : '';
    const lines = wrap(lead + text, font, size, CONTENT_W - indent);
    for (let i = 0; i < lines.length; i++) {
      this.need(leading);
      const x = MARGIN + indent + (i > 0 && opts.bullet ? font.widthOfTextAtSize('-  ', size) : 0);
      this.page.drawText(lines[i], { x, y: this.y, size, font, color });
      this.y -= leading;
    }
  }
  label(l: string, v: string) {
    this.need(26);
    this.page.drawText(clean(l).toUpperCase(), { x: MARGIN, y: this.y, size: 7.5, font: this.bold, color: MUTED });
    this.y -= 11;
    this.para(v || '-', { size: 11.5, font: this.bold });
    this.y -= 4;
  }
  // A label at the left with a right-aligned value, plus a hairline rule.
  rowLV(label: string, value: string) {
    this.need(18);
    this.page.drawText(clean(label), { x: MARGIN, y: this.y, size: 11, font: this.reg, color: INK });
    const v = clean(value);
    const vw = this.bold.widthOfTextAtSize(v, 11);
    this.page.drawText(v, { x: PAGE_W - MARGIN - vw, y: this.y, size: 11, font: this.bold, color: INK });
    this.y -= 6;
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: PAGE_W - MARGIN, y: this.y }, thickness: 0.5, color: RULE });
    this.y -= 11;
  }
  totalBox(value: string) {
    this.need(38); this.y -= 4;
    const h = 26, top = this.y;
    this.page.drawRectangle({ x: MARGIN, y: top - h + 4, width: CONTENT_W, height: h, color: NAVY });
    this.page.drawText('TOTAL SEVERANCE', { x: MARGIN + 12, y: top - h + 13, size: 11, font: this.bold, color: rgb(1, 1, 1) });
    const v = clean(value); const vw = this.bold.widthOfTextAtSize(v, 15);
    this.page.drawText(v, { x: PAGE_W - MARGIN - 12 - vw, y: top - h + 11, size: 15, font: this.bold, color: GOLD });
    this.y = top - h - 8;
  }
  async bytes() { return this.pdf.save(); }
}

function renderNotes(d: Doc, notes: string) {
  for (const raw of String(notes ?? '').split('\n')) {
    const t = raw.trim();
    if (t === '') { d.gap(6); continue; }
    const stripped = stripMd(t);
    const isBullet = /^[•\-]\s*/.test(t);
    const isHeading = /:\s*$/.test(t) && !isBullet;
    if (isBullet) d.para(stripped.replace(/^[•\-]\s*/, ''), { indent: 14, bullet: true });
    else if (isHeading) { d.gap(3); d.para(stripped, { font: d.bold, size: 12 }); }
    else d.para(stripped);
  }
}

const dataUrl = (bytes: Uint8Array) => `data:application/pdf;base64,${Buffer.from(bytes).toString('base64')}`;

// A branded PDF of a coaching form (mirrors the on-screen document).
export async function coachingPdfDataUrl(row: any): Promise<string> {
  const d = await Doc.create(`Coaching Form - ${row.coaching_type || 'Weekly'}`, '');
  d.label('Employee', String(row.employee ?? ''));
  const two = (a: [string, string], b: [string, string]) => { d.label(a[0], a[1]); d.label(b[0], b[1]); };
  two(['Coaching date', fmtLong(row.date)], ['Submitted by', String(row.coach_name ?? '')]);
  if (row.coach_position) d.label('Position', String(row.coach_position));
  d.rule();
  if (row.topic) { d.para(String(row.topic), { font: d.bold, size: 12 }); d.gap(6); }
  renderNotes(d, row.notes ?? '');

  const actions = String(row.action_items ?? '').split('\n').map(s => s.trim()).filter(Boolean);
  if (actions.length) {
    d.gap(10); d.para('ACTION ITEMS', { font: d.bold, size: 8, color: MUTED });
    for (const a of actions) d.para(a.replace(/^[•\-]\s*/, ''), { indent: 14, bullet: true });
  }

  const signers = parseSignatories(row.signatories);
  if (signers.length) {
    d.gap(12); d.para('SIGNATURES', { font: d.bold, size: 8, color: MUTED }); d.gap(2);
    for (const s of signers) {
      const status = s.signed_at ? `Signed${s.signature_name ? ' by ' + s.signature_name : ''}` : 'Pending signature';
      const role = s.role ? ` (${s.role})` : '';
      d.para(`${s.name}${role} - ${s.position || ''}`, { font: d.bold, size: 11 });
      d.para(status, { size: 10.5, color: s.signed_at ? rgb(0.18, 0.49, 0.36) : rgb(0.69, 0.49, 0.16), indent: 6 });
      d.gap(4);
    }
  }
  d.gap(10);
  d.para('Signature confirms the conversation occurred and the employee received a copy. It does not indicate agreement.', { font: d.ital, size: 9.5, color: MUTED });
  return dataUrl(await d.bytes());
}

// A branded PDF of the severance worksheet, stamped approved. `approver` carries
// the e-approval details captured on the sign page.
export async function severancePdfDataUrl(p: any, approver?: { name?: string; signature_name?: string | null; signed_at?: string | null }): Promise<string> {
  const d = await Doc.create('Severance Calculation Worksheet (C1)', '');
  d.label('Employee', String(p.employee ?? ''));
  d.label('Position', String(p.position ?? ''));
  d.label('Hire date', String(p.hireDate ?? '')); d.label('Separation date', String(p.sepDate ?? '')); d.label('Age', String(p.age ?? ''));
  d.rule();
  d.para('Inputs', { font: (d as any).bold, size: 13 }); d.gap(2);
  d.rowLV('Annual base salary (base only)', String(p.annualSalary ?? ''));
  d.rowLV('Tier', String(p.tier ?? ''));
  d.rowLV('Length of service', String(p.serviceLabel ?? ''));
  d.gap(6);
  d.para('Calculation', { font: (d as any).bold, size: 13 }); d.gap(2);
  for (const r of (Array.isArray(p.rows) ? p.rows : [])) d.rowLV(String(r[0]), String(r[1]));
  d.totalBox(String(p.total ?? ''));
  const nonCash = Array.isArray(p.nonCash) ? p.nonCash : [];
  if (nonCash.length) { d.gap(6); d.para('Non-cash components', { font: (d as any).bold, size: 12 }); for (const n of nonCash) d.para(String(n), { indent: 14, bullet: true }); }
  if (p.notes) { d.gap(8); d.para('NOTES / JUSTIFICATION', { font: (d as any).bold, size: 8, color: rgb(0.42, 0.4, 0.36) }); d.para(String(p.notes)); }
  d.gap(12);
  d.para(`Prepared by: ${p.preparerName || '—'}${p.preparerDate ? '  ·  ' + p.preparerDate : ''}`, { font: (d as any).bold, size: 11 });
  const appName = approver?.signature_name || approver?.name || '';
  const when = approver?.signed_at ? new Date(approver.signed_at).toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' CT' : '';
  d.gap(2);
  d.para(`Approved by: ${appName || '—'}`, { font: (d as any).bold, size: 11, color: rgb(0.18, 0.49, 0.36) });
  if (when) d.para(`Electronically approved ${when}`, { size: 9.5, color: rgb(0.42, 0.4, 0.36) });
  return dataUrl(await d.bytes());
}

// A branded PDF of a completed exit interview (question / answer pairs).
export async function exitInterviewPdfDataUrl(name: string, qa: { q: string; a: string }[], dates?: { sent?: string; completed?: string }): Promise<string> {
  const d = await Doc.create('Exit Interview', '');
  d.label('Employee', name);
  if (dates?.sent) d.label('Sent', dates.sent);
  if (dates?.completed) d.label('Completed', dates.completed);
  d.rule();
  for (const item of qa) {
    d.para(item.q, { font: (d as any).bold, size: 11.5 });
    d.para(item.a || '—', { color: rgb(0.28, 0.3, 0.34) });
    d.gap(6);
  }
  return dataUrl(await d.bytes());
}

// A branded PDF of Catie's signed Offboarding Document (HR -> Ops -> IT, with
// each task's assignee/initials/date and Catie's sign-off). Filed to the
// employee's Employee File when the document is fully signed off.
export async function offboardingDocPdfDataUrl(rec: any): Promise<string> {
  const doc: OffboardingDoc = rec.doc;
  const fmtD = (s: any) => { if (!s) return ''; const dt = new Date(String(s) + 'T12:00:00'); return isNaN(+dt) ? String(s) : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); };
  const d = await Doc.create('Employee Offboarding Checklist', '');
  const bold = (d as any).bold as PDFFont;
  d.label('Employee name', String(rec.name ?? ''));
  d.label('Position / Title', String(rec.position ?? ''));
  d.label('Last day of employment', fmtD(rec.separation_date));
  d.rule();

  const cellDone = (c?: Cell) => !!(c && (c.initial ?? '').trim() && (c.date ?? '').trim());
  const taskRow = (label: string, hint: string | undefined, c?: Cell) => {
    d.para(label, { font: bold, size: 11 });
    if (hint) d.para(hint, { size: 9.5, color: MUTED, indent: 8 });
    const parts = [
      `Assigned: ${c?.assignee || '—'}`,
      `Initials: ${(c?.initial || '____').toUpperCase()}`,
      `Date: ${c?.date ? fmtD(c.date) : '________'}`,
    ];
    if (c?.notes) parts.push(`Notes: ${c.notes}`);
    d.para(parts.join('   .   '), { size: 10, indent: 8, color: cellDone(c) ? GREEN : MUTED });
    d.gap(5);
  };
  const heading = (t: string) => { d.gap(4); d.para(t, { font: bold, size: 13 }); d.gap(4); };

  const hr = DOC_SECTIONS.find(s => s.key === 'hr')!;
  const it = DOC_SECTIONS.find(s => s.key === 'it')!;

  heading('Section 1 - HR');
  for (const i of hr.items) taskRow(i.label, i.hint, doc.items[i.id]);
  d.gap(2); d.para('BENEFITS QUICK REFERENCE', { font: bold, size: 8, color: MUTED });
  for (const b of BENEFITS_REF) d.para(`${b.benefit} - ${b.ends}. ${b.notes}`, { bullet: true, indent: 14, size: 9.5 });
  d.rule();

  heading('Section 2 - Ops');
  d.para(`Access cutoff date: ${doc.ops.accessCutoff || '—'}`, { size: 10.5 });
  d.para(`Mailbox disposition: ${doc.ops.mailbox || '—'}`, { size: 10.5 });
  d.para(`Electronic file ownership transferred to: ${doc.ops.fileOwner || '—'}`, { size: 10.5 });
  d.para(`Exceptions or holds: ${doc.ops.exceptions || '—'}`, { size: 10.5 });
  d.gap(4); d.para('ACCOUNTS TO CLOSE', { font: bold, size: 8, color: MUTED }); d.gap(2);
  for (const a of doc.accounts) taskRow(a.label, a.hint, a.cell);
  d.rule();

  heading('Section 3 - IT');
  for (const i of it.items) taskRow(i.label, i.hint, doc.items[i.id]);
  d.rule();

  heading('Sign-Off - Catie');
  taskRow('HR - Section 1 complete', undefined, doc.signoff.hr);
  taskRow('Ops - Section 2 complete', undefined, doc.signoff.ops);
  taskRow('IT - Section 3 complete', undefined, doc.signoff.it);
  return dataUrl(await d.bytes());
}

export async function onboardingDocPdfDataUrl(rec: any): Promise<string> {
  const doc: OnboardingDoc = rec.doc;
  const fmtD = (s: any) => { if (!s) return ''; const dt = new Date(String(s) + 'T12:00:00'); return isNaN(+dt) ? String(s) : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); };
  const d = await Doc.create('Employee Onboarding Checklist', '');
  const bold = (d as any).bold as PDFFont;
  d.label('Employee name', String(rec.name ?? ''));
  d.label('Position / Title', String(rec.position ?? ''));
  d.label('Start date', fmtD(rec.start_date));
  d.rule();

  const cellDone = (c?: OnbCell) => !!(c && (c.initial ?? '').trim() && (c.date ?? '').trim());
  const taskRow = (label: string, hint: string | undefined, c?: OnbCell) => {
    d.para(label, { font: bold, size: 11 });
    if (hint) d.para(hint, { size: 9.5, color: MUTED, indent: 8 });
    const parts = [
      `Assigned: ${c?.assignee || '—'}`,
      `Deadline: ${c?.deadline ? fmtD(c.deadline) : '________'}`,
      `Initials: ${(c?.initial || '____').toUpperCase()}`,
      `Date done: ${c?.date ? fmtD(c.date) : '________'}`,
    ];
    if (c?.notes) parts.push(`Notes: ${c.notes}`);
    d.para(parts.join('   .   '), { size: 10, indent: 8, color: cellDone(c) ? GREEN : MUTED });
    d.gap(5);
  };
  const heading = (t: string) => { d.gap(4); d.para(t, { font: bold, size: 13 }); d.gap(4); };

  heading('Section 1 - Pre-Onboarding Tasks');
  for (const r of doc.hr) taskRow(r.label, r.hint, r.cell);
  d.gap(2); d.para('BENEFITS QUICK REFERENCE', { font: bold, size: 8, color: MUTED });
  for (const b of ONB_BENEFITS_REF) d.para(`${b.benefit} - ${b.begins}. ${b.notes}`, { bullet: true, indent: 14, size: 9.5 });
  d.rule();

  heading('Section 2 - 1st Day Tasks');
  d.para('ACCOUNTS TO OPEN', { font: bold, size: 8, color: MUTED }); d.gap(2);
  for (const a of doc.accounts) taskRow(a.label, a.hint, a.cell);
  d.rule();

  heading('Section 3 - IT');
  for (const r of doc.it) taskRow(r.label, r.hint, r.cell);
  d.rule();

  heading('Sign-Off - Catie');
  taskRow('Pre-Onboarding Tasks - Section 1 complete', undefined, doc.signoff.hr);
  taskRow('1st Day Tasks - Section 2 complete', undefined, doc.signoff.ops);
  taskRow('IT - Section 3 complete', undefined, doc.signoff.it);
  return dataUrl(await d.bytes());
}

// A branded PDF of a performance-review summary (dates + history).
export async function reviewSummaryPdfDataUrl(name: string, lines: string[]): Promise<string> {
  const d = await Doc.create('Performance Review Summary', '');
  d.label('Employee', name);
  d.rule();
  if (!lines.length) d.para('No review dates on file yet.', { color: MUTED });
  for (const l of lines) d.para(l, { bullet: true, indent: 14 });
  return dataUrl(await d.bytes());
}

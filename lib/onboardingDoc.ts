// Catie's streamlined Onboarding Document (the new-hire counterpart to the
// Offboarding Document). Structure mirrors the "Litson PLLC — Employee
// Onboarding Checklist & Guide": Section 1 (HR) → Section 2 (Ops) → Section 3
// (IT). Every row is editable — rename, add, or remove — and each carries an
// Assigned To + Deadline (set by HR up front) plus Initials, Date done, Notes.
// Catie signs off each section; nothing is complete until all three are signed.

// People a task can be assigned to (and who add their initials).
export const ONBOARDING_ASSIGNEES = ['Catie', 'Clarizz', 'Caitlin', 'Alex', 'Matthew'] as const;

export interface DocItem { id: string; label: string; hint?: string }
export interface DocSection { key: 'hr' | 'ops' | 'it'; heading: string; blurb: string; items: DocItem[] }

// Default rows for each section (headings/blurbs are reused for display). All
// three sections are now editable per hire — these are just the starting rows.
export const ONB_DOC_SECTIONS: DocSection[] = [
  {
    key: 'hr', heading: 'Section 1 — HR', blurb: 'Employment status, benefits, and onboarding logistics.',
    items: [
      { id: 'hr-assets', label: 'Physical assets issued', hint: 'Laptop, keys, access fob/badge, firm credit card, and any other firm property assigned and logged.' },
      { id: 'hr-email', label: 'Personal (non-firm) email on file', hint: 'Needed for pre-employment correspondence until firm email access is set up and confirmed.' },
      { id: 'hr-offer', label: 'Offer letter / employment agreement signed', hint: 'Reviewed by counsel before use, if applicable.' },
      { id: 'hr-benefits', label: 'Coverage & Benefits Summary letter sent', hint: 'Sent to personal email ahead of start date. Covers medical/dental/vision, malpractice, 401(k), and life insurance — see reference table below.' },
      { id: 'hr-announce', label: 'Firm-wide welcome announcement sent', hint: 'Timing coordinated with supervising attorney.' },
      { id: 'hr-nda', label: 'NDA e-signature' },
      { id: 'hr-keys', label: 'Hand-deliver necessary building keys / fobs' },
    ],
  },
  {
    key: 'it', heading: 'Section 3 — IT', blurb: 'Initial technical setup and confirmation. Complete only after Sections 1 and 2 are signed off.',
    items: [
      { id: 'it-mfa', label: 'MFA methods set up' },
      { id: 'it-macbook', label: 'MacBook set up', hint: 'Signed into tech@litson.co. Microsoft Suite, Briefcatch / Reality Check, and Dashlane installed.' },
      { id: 'it-devices', label: 'Firm devices configured', hint: 'ABM / Jamf.' },
    ],
  },
];

// Section 2 — Ops. Accounts to open (editable per hire).
export const ONB_DEFAULT_ACCOUNTS: { label: string; hint?: string }[] = [
  { label: 'Microsoft 365 mailbox created', hint: 'New account provisioned, license assigned, and added to relevant distribution lists.' },
  { label: 'Dropbox / file storage', hint: 'Access granted; added to relevant shared folders.' },
  { label: 'Dashlane', hint: 'Added to vault; shared credentials provisioned as needed.' },
  { label: 'Clio' },
  { label: 'Donna' },
  { label: 'Dialpad' },
  { label: 'Zoom' },
  { label: 'Signitic' },
  { label: 'Logikcull' },
  { label: 'PACER / ECF' },
  { label: 'Ramp card issued' },
  { label: 'Claude' },
  { label: 'Adobe' },
];

// Static benefits quick reference shown under Section 1 (onboarding wording —
// when coverage *begins*).
export const ONB_BENEFITS_REF: { benefit: string; begins: string; notes: string }[] = [
  { benefit: 'Medical / Dental / Vision', begins: 'First of month following start date', notes: 'Employee enrolls in firm plan — 30-day window from start date to elect. BCBS + Guardian' },
  { benefit: 'Malpractice', begins: 'Start date of employment', notes: 'Must email Derek Smith and add to policy' },
  { benefit: '401(k)', begins: 'After one year of employment', notes: 'Guideline' },
  { benefit: 'Life insurance', begins: 'Start date of employment', notes: 'Principal' },
];

export interface Cell { assignee?: string; deadline?: string; initial?: string; date?: string; notes?: string }
export interface DocRow { id: string; label: string; hint?: string; cell: Cell }
// Backwards-compatible alias (the accounts list is just a row list).
export type DocAccount = DocRow;
export interface OnboardingDoc {
  hr: DocRow[];        // Section 1 — HR rows
  accounts: DocRow[];  // Section 2 — Ops accounts
  it: DocRow[];        // Section 3 — IT rows
  signoff: { hr: Cell; ops: Cell; it: Cell };
}

let _n = 0;
function rid() { return `row-${Date.now().toString(36)}-${(_n++).toString(36)}`; }

const defItems = (key: 'hr' | 'it'): DocRow[] =>
  (ONB_DOC_SECTIONS.find(s => s.key === key)?.items ?? []).map(i => ({ id: i.id, label: i.label, hint: i.hint, cell: {} }));

export function emptyDoc(): OnboardingDoc {
  return {
    hr: defItems('hr'),
    accounts: ONB_DEFAULT_ACCOUNTS.map(a => ({ id: rid(), label: a.label, hint: a.hint, cell: {} })),
    it: defItems('it'),
    signoff: { hr: {}, ops: {}, it: {} },
  };
}

function normRow(a: any): DocRow {
  return { id: String(a?.id ?? rid()), label: String(a?.label ?? ''), hint: a?.hint, cell: (a?.cell && typeof a.cell === 'object') ? a.cell : {} };
}

// Coerce whatever is stored into a valid doc. Migrates the older shape (fixed
// HR/IT item ids stored in an `items` map) into the editable row arrays.
export function parseDoc(v: any): OnboardingDoc {
  let d: any = v;
  try { if (typeof v === 'string') d = JSON.parse(v); } catch { d = null; }
  if (!d || typeof d !== 'object') return emptyDoc();
  const base = emptyDoc();
  const items = d.items && typeof d.items === 'object' ? d.items : null;
  const fromArrayOr = (arr: any, defaults: DocRow[]): DocRow[] =>
    Array.isArray(arr) ? arr.map(normRow) : defaults.map(r => ({ ...r, cell: (items && items[r.id]) ? items[r.id] : {} }));
  return {
    hr: fromArrayOr(d.hr, base.hr),
    accounts: Array.isArray(d.accounts) && d.accounts.length ? d.accounts.map(normRow) : base.accounts,
    it: fromArrayOr(d.it, base.it),
    signoff: { hr: d.signoff?.hr ?? {}, ops: d.signoff?.ops ?? {}, it: d.signoff?.it ?? {} },
  };
}

export function newRow(label = ''): DocRow { return { id: rid(), label, cell: {} }; }
// Backwards-compatible alias.
export const newAccount = newRow;

// ---- Shared document template ---------------------------------------------
// The ROW STRUCTURE (labels/hints per section) is shared by every hire, so
// editing rows updates one template. Each hire keeps their own per-row cells
// (assignee/deadline/initials/date/notes), matched by row id.
// `assignees` are EXTRA names added beyond the built-in ONBOARDING_ASSIGNEES,
// shared across all hires' documents.
export interface DocTemplate { hr: DocItem[]; accounts: DocItem[]; it: DocItem[]; assignees: string[] }

export function defaultTemplate(): DocTemplate {
  const items = (key: 'hr' | 'it') => (ONB_DOC_SECTIONS.find(s => s.key === key)?.items ?? []).map(i => ({ id: i.id, label: i.label, hint: i.hint }));
  return {
    hr: items('hr'),
    accounts: ONB_DEFAULT_ACCOUNTS.map((a, idx) => ({ id: `acct-def-${idx}`, label: a.label, hint: a.hint })),
    it: items('it'),
    assignees: [],
  };
}

export function parseTemplate(v: any): DocTemplate {
  let d: any = v;
  try { if (typeof v === 'string') d = JSON.parse(v); } catch { d = null; }
  if (!d || typeof d !== 'object') return defaultTemplate();
  const base = defaultTemplate();
  const arr = (x: any, fb: DocItem[]): DocItem[] => Array.isArray(x) ? x.map((i: any) => ({ id: String(i?.id ?? rid()), label: String(i?.label ?? ''), hint: i?.hint })) : fb;
  const names = Array.isArray(d.assignees) ? Array.from(new Set(d.assignees.map((s: any) => String(s).trim()).filter(Boolean))) as string[] : [];
  return { hr: arr(d.hr, base.hr), accounts: arr(d.accounts, base.accounts), it: arr(d.it, base.it), assignees: names };
}

// All selectable assignee names for the document: the built-in set plus any the
// firm has added to the template.
export function allAssignees(tpl: DocTemplate | null | undefined): string[] {
  const extra = (tpl?.assignees ?? []).filter(n => !ONBOARDING_ASSIGNEES.includes(n as any));
  return [...ONBOARDING_ASSIGNEES, ...extra];
}

// Extract the shared template rows (structure) from a hire's document. Assignee
// names live only on the template, so callers merge those in separately.
export function templateFromDoc(doc: OnboardingDoc): Omit<DocTemplate, 'assignees'> {
  const strip = (rows: DocRow[]) => rows.map(r => ({ id: r.id, label: r.label, hint: r.hint }));
  return { hr: strip(doc.hr), accounts: strip(doc.accounts), it: strip(doc.it) };
}

// Rebuild a hire's document rows from the shared template, keeping their cells
// (matched by row id). Template is authoritative for the row set + labels/hints;
// the hire keeps their own cell data.
export function reconcile(doc: OnboardingDoc, tpl: DocTemplate): OnboardingDoc {
  const cells: Record<string, Cell> = {};
  for (const r of [...doc.hr, ...doc.accounts, ...doc.it]) cells[r.id] = r.cell;
  const build = (items: DocItem[]): DocRow[] => items.map(i => ({ id: i.id, label: i.label, hint: i.hint, cell: cells[i.id] ?? {} }));
  return { hr: build(tpl.hr), accounts: build(tpl.accounts), it: build(tpl.it), signoff: doc.signoff };
}

const cellDone = (c: Cell | undefined) => !!(c && (c.initial ?? '').trim() && (c.date ?? '').trim());

// Progress across all task rows (HR + Ops accounts + IT).
export function docProgress(doc: OnboardingDoc): { done: number; total: number } {
  let done = 0, total = 0;
  for (const r of [...doc.hr, ...doc.accounts, ...doc.it]) { total++; if (cellDone(r.cell)) done++; }
  return { done, total };
}

// Catie's sign-off: complete only when all three section sign-off rows are
// initialed & dated.
export function docSignedOff(doc: OnboardingDoc): boolean {
  return cellDone(doc.signoff.hr) && cellDone(doc.signoff.ops) && cellDone(doc.signoff.it);
}

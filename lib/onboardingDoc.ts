// Catie's streamlined Onboarding Document (the new-hire counterpart to the
// Offboarding Document). Structure mirrors the "Litson PLLC — Employee
// Onboarding Checklist & Guide": Section 1 (HR) → Section 2 (Ops) → Section 3
// (IT), each task assigned to a person who initials + dates it as it's done,
// followed by Catie's sign-off. Nothing is "complete" until all three sign-off
// rows are initialed & dated.
//
// Difference from offboarding: HR assigns each task AND a deadline up front, so
// every cell carries a `deadline` alongside the completion date.

// People a task can be assigned to (and who add their initials).
export const ONBOARDING_ASSIGNEES = ['Catie', 'Clarizz', 'Caitlin', 'Alex', 'Matt'] as const;

export interface DocItem { id: string; label: string; hint?: string }
export interface DocSection { key: 'hr' | 'ops' | 'it'; heading: string; blurb: string; items: DocItem[] }

// Section 1 — HR, and Section 3 — IT have fixed item lists. Section 2 — Ops
// uses the editable Accounts list below (accounts to open for the new hire).
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
export interface DocAccount { id: string; label: string; hint?: string; cell: Cell }
export interface OnboardingDoc {
  items: Record<string, Cell>;   // keyed by DocItem id
  accounts: DocAccount[];
  signoff: { hr: Cell; ops: Cell; it: Cell };
}

let _n = 0;
function accId() { return `acct-${Date.now().toString(36)}-${(_n++).toString(36)}`; }

export function emptyDoc(): OnboardingDoc {
  return {
    items: {},
    accounts: ONB_DEFAULT_ACCOUNTS.map(a => ({ id: accId(), label: a.label, hint: a.hint, cell: {} })),
    signoff: { hr: {}, ops: {}, it: {} },
  };
}

// Coerce whatever is stored into a valid doc (fills defaults for older records).
export function parseDoc(v: any): OnboardingDoc {
  let d: any = v;
  try { if (typeof v === 'string') d = JSON.parse(v); } catch { d = null; }
  if (!d || typeof d !== 'object') return emptyDoc();
  const base = emptyDoc();
  return {
    items: d.items && typeof d.items === 'object' ? d.items : {},
    accounts: Array.isArray(d.accounts) && d.accounts.length
      ? d.accounts.map((a: any) => ({ id: String(a.id ?? accId()), label: String(a.label ?? ''), hint: a.hint, cell: (a.cell && typeof a.cell === 'object') ? a.cell : {} }))
      : base.accounts,
    signoff: {
      hr: d.signoff?.hr ?? {}, ops: d.signoff?.ops ?? {}, it: d.signoff?.it ?? {},
    },
  };
}

export function newAccount(label = ''): DocAccount { return { id: accId(), label, cell: {} }; }

const cellDone = (c: Cell | undefined) => !!(c && (c.initial ?? '').trim() && (c.date ?? '').trim());

// Progress across all task rows (HR items + Ops accounts + IT items).
export function docProgress(doc: OnboardingDoc): { done: number; total: number } {
  let done = 0, total = 0;
  for (const s of ONB_DOC_SECTIONS) for (const it of s.items) { total++; if (cellDone(doc.items[it.id])) done++; }
  for (const a of doc.accounts) { total++; if (cellDone(a.cell)) done++; }
  return { done, total };
}

// Catie's sign-off: the document is only complete when all three section
// sign-off rows are initialed & dated.
export function docSignedOff(doc: OnboardingDoc): boolean {
  return cellDone(doc.signoff.hr) && cellDone(doc.signoff.ops) && cellDone(doc.signoff.it);
}

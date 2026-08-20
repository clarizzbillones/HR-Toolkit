// Catie's streamlined Offboarding Document (separate from the legal-compliance
// checklist). Structure mirrors the "Litson PLLC — Employee Offboarding
// Checklist": Section 1 (HR) → Section 2 (Ops) → Section 3 (IT), each item
// assigned to a person who initials + dates it, followed by Catie's sign-off.
// Nothing is "complete" until all three sign-off rows are initialed & dated.

// People a task can be assigned to (and who add their initials).
export const OFFBOARDING_ASSIGNEES = ['Catie', 'Clarizz', 'Caitlin', 'Alex', 'Matthew'] as const;

export interface DocItem { id: string; label: string; hint?: string }
export interface DocSection { key: 'hr' | 'ops' | 'it'; heading: string; blurb: string; items: DocItem[] }

// Section 1 — HR, and Section 3 — IT have fixed item lists. Section 2 — Ops
// uses the editable Accounts list below plus the Ops decision fields.
export const DOC_SECTIONS: DocSection[] = [
  {
    key: 'hr', heading: 'Section 1 — HR', blurb: 'Employment status, benefits, and departure logistics.',
    items: [
      { id: 'hr-assets', label: 'Physical assets collected', hint: 'Laptop, keys, access fob/badge, firm credit card, and any other firm property.' },
      { id: 'hr-email', label: 'Personal (non-firm) email on file', hint: 'Needed for post-employment correspondence once firm email access is cut.' },
      { id: 'hr-severance', label: 'Separation/severance agreement sent', hint: 'If applicable — reviewed by counsel before use.' },
      { id: 'hr-benefits', label: 'Coverage & Benefits Summary letter sent', hint: 'Sent to personal email. Covers medical/dental/vision, malpractice, 401(k), and life insurance — see reference table below.' },
      { id: 'hr-transition', label: 'Client/case transition plan confirmed', hint: 'If applicable — case list, client preferences, and court dates/deadlines documented and handed off.' },
      { id: 'hr-announce', label: 'Firm-wide announcement sent', hint: 'Timing coordinated with supervising attorney.' },
    ],
  },
  {
    key: 'it', heading: 'Section 3 — IT', blurb: 'Final technical shutdown and confirmation. Complete only after Sections 1 and 2 are signed off.',
    items: [
      { id: 'it-signin', label: 'Microsoft 365 sign-in disabled, active sessions revoked' },
      { id: 'it-mfa', label: 'MFA methods removed' },
      { id: 'it-license', label: 'License released or reassigned' },
      { id: 'it-devices', label: 'Firm devices collected', hint: 'Laptop, phone, or other firm-owned electronics.' },
      { id: 'it-wipe', label: 'Firm devices wiped', hint: 'Factory reset / data wipe completed.' },
    ],
  },
];

// Section 2 — Ops. Accounts to close (editable per employee).
export const DEFAULT_ACCOUNTS: { label: string; hint?: string }[] = [
  { label: 'Microsoft 365 mailbox disposition executed', hint: 'Shared mailbox, forwarding rule, or auto-reply set per above.' },
  { label: 'Dropbox / file storage', hint: 'Confirm sole-owned files transferred before removing access.' },
  { label: 'Dashlane', hint: 'Rotate any shared credentials the employee had access to.' },
  { label: 'Clio' },
  { label: 'Donna' },
  { label: 'Dialpad' },
  { label: 'Zoom' },
  { label: 'Signitic' },
  { label: 'Logikcull' },
  { label: 'PACER' },
  { label: 'Westlaw', hint: 'Legal research — contact platform admin to remove access' },
  { label: 'Tybera', hint: 'Court e-filing — remove access' },
  { label: 'Davidson County Court e-filing', hint: 'Court e-filing (Davidson County, TN) — remove access if they had one' },
];

// Static benefits quick reference shown under Section 1.
export const BENEFITS_REF: { benefit: string; ends: string; notes: string }[] = [
  { benefit: 'Medical / Dental / Vision', ends: 'Through end of month of last day', notes: 'Employee arranges own coverage — spouse/partner plan: 30-day window; Marketplace: 60-day window' },
  { benefit: 'Malpractice', ends: 'Last day of employment', notes: 'Employee arranges own coverage if continuing to practice' },
  { benefit: '401(k)', ends: 'Last day of employment', notes: 'Plan administrator emails employee directly with next steps' },
  { benefit: 'Life insurance', ends: 'Last day of employment', notes: 'N/A' },
];

export interface Cell { assignee?: string; initial?: string; date?: string; notes?: string }
export interface DocAccount { id: string; label: string; hint?: string; cell: Cell }
export interface OffboardingDoc {
  ops: { accessCutoff?: string; mailbox?: string; fileOwner?: string; exceptions?: string };
  items: Record<string, Cell>;   // keyed by DocItem id
  accounts: DocAccount[];
  signoff: { hr: Cell; ops: Cell; it: Cell };
}

let _n = 0;
function accId() { return `acct-${Date.now().toString(36)}-${(_n++).toString(36)}`; }

export function emptyDoc(): OffboardingDoc {
  return {
    ops: {},
    items: {},
    accounts: DEFAULT_ACCOUNTS.map(a => ({ id: accId(), label: a.label, hint: a.hint, cell: {} })),
    signoff: { hr: {}, ops: {}, it: {} },
  };
}

// Coerce whatever is stored into a valid doc (fills defaults for older records).
export function parseDoc(v: any): OffboardingDoc {
  let d: any = v;
  try { if (typeof v === 'string') d = JSON.parse(v); } catch { d = null; }
  if (!d || typeof d !== 'object') return emptyDoc();
  const base = emptyDoc();
  return {
    ops: { ...base.ops, ...(d.ops && typeof d.ops === 'object' ? d.ops : {}) },
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
export function docProgress(doc: OffboardingDoc): { done: number; total: number } {
  let done = 0, total = 0;
  for (const s of DOC_SECTIONS) for (const it of s.items) { total++; if (cellDone(doc.items[it.id])) done++; }
  for (const a of doc.accounts) { total++; if (cellDone(a.cell)) done++; }
  return { done, total };
}

// Catie's sign-off: the document is only complete when all three section
// sign-off rows are initialed & dated.
export function docSignedOff(doc: OffboardingDoc): boolean {
  return cellDone(doc.signoff.hr) && cellDone(doc.signoff.ops) && cellDone(doc.signoff.it);
}

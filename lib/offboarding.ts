// Canonical separation / offboarding checklist, built from the LITSON PLLC HR
// Compliance & Risk Management Manual — written in plain HR language. Shared by
// the Offboarding tracker (tiles) and the HR Forms printable template.

export interface ChecklistItem {
  id: string;
  label: string;          // plain-language action
  hint?: string;          // short reference (form #, statute, chapter) — small print
  age40?: boolean;        // only relevant when the employee is 40 or older
}
export interface ChecklistSection {
  key: string;
  heading: string;
  chapter: string;
  items: ChecklistItem[];
  severance?: boolean;    // whole section only applies when severance is offered
}

export const OFFBOARDING_CHECKLIST: ChecklistSection[] = [
  {
    key: 'before', heading: 'Before the separation', chapter: 'Chapters 9–11',
    items: [
      { id: 'before-1', label: 'Decide the type of separation (resignation, termination for performance, misconduct, layoff, or mutual).', hint: 'This sets which forms, benefits, and pay rules apply.' },
      { id: 'before-2', label: 'Fill out the Pre-Termination Risk Review (Form B1) and have at least two people review it — the manager and HR.' },
      { id: 'before-3', label: 'Write the real reason for the separation in the personnel file, dated — before you talk to the employee about it.' },
      { id: 'before-4', label: 'Use the same reason everywhere: the file, the LB-0489 form, and any unemployment claim answer.' },
      { id: 'before-5', label: "Check you've handled similar situations the same way before (and that it's written down)." },
      { id: 'before-6', label: "Have a lawyer review first if you're letting go 2 or more people at once, paying more severance than usual, or the situation feels risky." },
      { id: 'before-7', label: 'Check the timing — avoid separating right after the employee filed a complaint, asked for an accommodation, took leave, or filed a workers’ comp claim.' },
      { id: 'before-8', label: 'If the employee is resigning, get it in writing.' },
      { id: 'before-9', label: 'If the employee is 40 or older and getting severance, use the extra age-related review steps (more time to sign, right to cancel).', hint: 'OWBPA — Chapter 11.', age40: true },
    ],
  },
  {
    key: 'finalpay', heading: 'Final pay & required forms', chapter: 'Chapters 4, 13',
    items: [
      { id: 'finalpay-1', label: 'Fill out the LB-0489 Separation Notice ahead of time and give it to the employee within 24 hours of their last day.' },
      { id: 'finalpay-2', label: 'Write the separation letter — the reason must match the LB-0489 and the file.' },
      { id: 'finalpay-3', label: 'Schedule the final paycheck — by the next regular payday or 21 days after the last day, whichever is later.', hint: 'Tenn. Code Ann. § 50-2-103(g).' },
      { id: 'finalpay-4', label: 'With unlimited PTO, confirm there’s no leftover PTO to pay out.' },
      { id: 'finalpay-5', label: 'If wages were being garnished (child support, etc.), notify that agency promptly.' },
    ],
  },
  {
    key: 'severance', heading: 'Severance', chapter: 'Chapters 11–12', severance: true,
    items: [
      { id: 'severance-1', label: 'Pay severance as a single lump sum — this protects the employee’s unemployment eligibility.', hint: '§ 50-7-303(a)(12).' },
      { id: 'severance-2', label: 'Make sure the severance agreement includes all seven required parts.', hint: 'Chapter 11.' },
      { id: 'severance-3', label: 'For employees 40 or older, include the age-related disclosures and give them the full time to consider and to cancel.', hint: 'OWBPA; Group Disclosure Chart D3 for group layoffs.', age40: true },
      { id: 'severance-4', label: 'Have a lawyer approve the agreement before the employee signs.' },
    ],
  },
  {
    key: 'benefits', heading: 'Benefits', chapter: 'Chapter 14',
    items: [
      { id: 'benefits-packet', label: 'Prepare and send the benefits offboarding packet / letter to the employee, confirming each coverage below.', hint: 'HR Forms → F2 — Attorney Offboarding: Coverage & Benefits Summary.' },
      { id: 'benefits-401k', label: '401(k) — Guideline: termination date is the last day of work; Guideline emails the next steps ~2–3 business days after.' },
      { id: 'benefits-life', label: 'Life insurance — Principal: firm-paid group life ends at month-end.' },
      { id: 'benefits-medical', label: 'Medical — Blue Cross BlueShield of TN: coverage runs through month-end; include the health-coverage notice (E1/E2).' },
      { id: 'benefits-vision', label: 'Vision — Guardian (VSP): coverage runs through month-end.' },
      { id: 'benefits-dental', label: 'Dental — Guardian: coverage runs through month-end.' },
      { id: 'benefits-malpractice', label: 'Malpractice insurance — Hanover: coverage ends on the last day of work; remind the employee to arrange their own coverage (attorneys/timekeepers).' },
      { id: 'benefits-1', label: "Give the right health-coverage notice — 'No Continuation' (E1) or 'COBRA Available' (E2)." },
      { id: 'benefits-2', label: 'Give a Certificate of Prior Coverage (E3) if it applies.' },
      { id: 'benefits-3', label: 'Check retirement and benefits vesting — never separate someone just to stop their benefits from vesting.', hint: 'ERISA § 510.' },
    ],
  },
  {
    key: 'meeting', heading: 'The separation meeting', chapter: 'Chapter 15',
    items: [
      { id: 'meeting-1', label: 'Hand the LB-0489 to the employee during the meeting.' },
      { id: 'meeting-2', label: 'Give them the separation letter.' },
      { id: 'meeting-3', label: 'Collect firm property: laptop, phone, keys, access/building cards, credit cards, documents, and files.' },
      { id: 'meeting-4', label: 'Turn off all access: email, internal systems, building access, and remote login.' },
      { id: 'meeting-5', label: 'Explain their final pay and what happens to their benefits.' },
    ],
  },
  {
    key: 'property', heading: 'Firm property & equipment', chapter: 'Offboarding Guide',
    items: [
      { id: 'property-1', label: 'Arrange key and access return before the employee’s last day.' },
      { id: 'property-2', label: 'Collect laptop, monitor, and phone.' },
      { id: 'property-3', label: 'Collect office key and garage FOB.' },
      { id: 'property-4', label: 'Collect any remaining business cards.' },
      { id: 'property-5', label: 'Verizon (if applicable): verify device return (phone/hotspot) and have the Verizon business admin deactivate or transfer the number.' },
    ],
  },
  {
    key: 'systems', heading: 'System access & accounts (IT)', chapter: 'Offboarding Guide',
    items: [
      { id: 'systems-1', label: 'Microsoft 365 / Outlook: transfer file ownership, set forwarding & auto-reply, convert to a shared mailbox, then block sign-in and remove the license.' },
      { id: 'systems-2', label: 'Dropbox Business: transfer files to a team member, remove from shared folders, then delete the member.' },
      { id: 'systems-3', label: 'Dashlane: remove the user from the Admin Console.' },
      { id: 'systems-4', label: 'SimTheory: remove access and deactivate login credentials.' },
      { id: 'systems-5', label: 'Clio (if applicable): transfer ownership of matters/documents, then deactivate the account.' },
      { id: 'systems-6', label: 'Dialpad: deactivate or delete the account.' },
      { id: 'systems-7', label: 'Zoom: deactivate or delete the account.' },
      { id: 'systems-8', label: 'Logikcull: remove or deactivate user access.' },
      { id: 'systems-9', label: 'CourtDrive: have a paralegal remove access.' },
      { id: 'systems-10', label: 'Westlaw & StateNet: contact the platform admins to remove access; HR confirms corrected pricing / subscription after removal.' },
      { id: 'systems-11', label: 'Confirm the former employee can no longer sign in to any firm system (final access audit).' },
    ],
  },
  {
    key: 'payroll', heading: 'Final pay & benefits (Gusto)', chapter: 'Offboarding Guide',
    items: [
      { id: 'payroll-1', label: 'Gusto: dismiss the employee (People → Work → Dismiss); enter the last working day and mark voluntary or involuntary.' },
      { id: 'payroll-2', label: 'Process final pay (pending hours, reimbursements, bonuses) and severance if applicable, per state pay laws — before dismissal.' },
      { id: 'payroll-3', label: 'Add the employee’s personal email for W-2 access.' },
      { id: 'payroll-4', label: 'Complete the Gusto Offboarding tab: final pay, benefits updates, and account deactivation.' },
      { id: 'payroll-5', label: 'Insurance (Guardian & BCBST): coverage runs through month-end — no manual termination needed; confirm Gusto sent the State Continuation email (3–5 business days).' },
      { id: 'payroll-6', label: 'Save the Gusto State Continuation email confirmation in the employee’s offboarding folder.' },
    ],
  },
  {
    key: 'files', heading: 'Wrap-up & files', chapter: 'Chapters 16–17',
    items: [
      { id: 'files-1', label: 'Offer (or hold) an exit interview.' },
      { id: 'files-2', label: 'Assign someone to handle any unemployment claim — the reason must match every document.' },
      { id: 'files-3', label: "Put together the official personnel file — don't keep separate manager notes on the side." },
      { id: 'files-4', label: 'Keep any medical or accommodation records in the separate confidential file, not the personnel file.' },
    ],
  },
];

export const OFFBOARDING_ITEMS = OFFBOARDING_CHECKLIST.flatMap(s => s.items);

export const SEPARATION_TYPES = [
  'Voluntary resignation', 'Performance termination', 'Misconduct termination',
  'Immediate termination', 'Layoff / reduction', 'Mutual separation',
];

// ---- Applicability helpers (age + tenure) ----

function toDate(s: any): Date | null {
  if (!s) return null;
  const str = String(s).trim();
  // ISO: yyyy-mm-dd
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(str);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], 12);
  // US: mm/dd/yyyy or m/d/yy (also accepts - or . separators)
  m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/.exec(str);
  if (m) { let y = +m[3]; if (y < 100) y += y < 30 ? 2000 : 1900; return new Date(y, +m[1] - 1, +m[2], 12); }
  // Fallback: let the engine try (handles "May 15, 1990" etc.)
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}
// Age on a given date (defaults to today) — used for the age-40 rules.
export function ageAt(dob: any, onDate?: any): number | null {
  const b = toDate(dob); if (!b) return null;
  const d = toDate(onDate) ?? new Date();
  let age = d.getFullYear() - b.getFullYear();
  const m = d.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && d.getDate() < b.getDate())) age--;
  return age;
}
export function tenure(hireDate: any, sepDate?: any): { years: number; months: number } | null {
  const h = toDate(hireDate); if (!h) return null;
  const d = toDate(sepDate) ?? new Date();
  let months = (d.getFullYear() - h.getFullYear()) * 12 + (d.getMonth() - h.getMonth());
  if (d.getDate() < h.getDate()) months--;
  if (months < 0) months = 0;
  return { years: Math.floor(months / 12), months: months % 12 };
}
export function tenureLabel(hireDate: any, sepDate?: any): string {
  const t = tenure(hireDate, sepDate); if (!t) return '';
  const parts = [];
  if (t.years) parts.push(`${t.years} yr${t.years === 1 ? '' : 's'}`);
  parts.push(`${t.months} mo`);
  return parts.join(' ');
}

// Age-related steps to pre-mark N/A when the employee is under 40 at separation.
export function defaultExcluded(dob: any, separationDate?: any): Record<string, boolean> {
  const ex: Record<string, boolean> = {};
  const age = ageAt(dob, separationDate);
  if (age != null && age < 40) for (const it of OFFBOARDING_ITEMS) if (it.age40) ex[it.id] = true;
  return ex;
}

// ---- Progress / status (respecting exclusions + severance toggle) ----

export interface OffboardingLike {
  checklist?: Record<string, boolean> | null;
  excluded?: Record<string, boolean> | null;
  offer_severance?: boolean | null;
}
export function isItemExcluded(rec: OffboardingLike, section: ChecklistSection, item: ChecklistItem): boolean {
  if (rec.excluded && rec.excluded[item.id]) return true;
  if (section.severance && !rec.offer_severance) return true;
  return false;
}
export function activeProgress(rec: OffboardingLike): { done: number; total: number } {
  let done = 0, total = 0;
  for (const s of OFFBOARDING_CHECKLIST) for (const it of s.items) {
    if (isItemExcluded(rec, s, it)) continue;
    total++;
    if (rec.checklist && rec.checklist[it.id]) done++;
  }
  return { done, total };
}
export function offboardingStatus(rec: OffboardingLike): 'Complete' | 'In progress' | 'Not started' {
  const { done, total } = activeProgress(rec);
  if (total > 0 && done >= total) return 'Complete';
  return done > 0 ? 'In progress' : 'Not started';
}

// Plain-language printable body for the HR Forms template (kept in step).
export function offboardingTemplateBody(): string {
  const lines: string[] = [
    'SEPARATION / OFFBOARDING CHECKLIST',
    'Built from the LITSON PLLC HR Compliance & Risk Management Manual — in plain language.',
    '',
    'Employee:  [NAME]',
    'Position:  [TITLE]',
    'Manager:  [MANAGER]',
    'Separation date:  [DATE]',
    'Type of separation:  [Voluntary resignation / Performance termination / Misconduct termination / Immediate termination / Layoff-reduction / Mutual separation]',
    'Prepared by:  [PREPARED BY]',
    '',
  ];
  for (const s of OFFBOARDING_CHECKLIST) {
    lines.push(`${s.heading.toUpperCase()} — ${s.chapter}${s.severance ? ' (only if offering severance)' : ''}`);
    for (const it of s.items) lines.push(`☐  ${it.label}${it.hint ? `  (${it.hint})` : ''}`);
    lines.push('');
  }
  lines.push('Notes:', '[NOTES]', '', 'Completed by:  [PREPARED BY]        Date:  [COMPLETED DATE]');
  return lines.join('\n');
}

// Canonical separation / offboarding checklist, built from the LITSON PLLC HR
// Compliance & Risk Management Manual. Shared by the Offboarding tracker (tiles)
// and kept in step with the HR Forms "Separation / Offboarding Checklist" template.

export interface ChecklistItem { id: string; label: string }
export interface ChecklistSection { key: string; heading: string; chapter: string; items: ChecklistItem[] }

const S = (key: string, heading: string, chapter: string, labels: string[]): ChecklistSection => ({
  key, heading, chapter, items: labels.map((label, i) => ({ id: `${key}-${i + 1}`, label })),
});

export const OFFBOARDING_CHECKLIST: ChecklistSection[] = [
  S('before', 'Before the separation', 'Chapters 9–11', [
    'Correct separation type classified (determines documentation, benefits, severance eligibility and reporting).',
    'Pre-Termination Risk Assessment (Form B1) completed and reviewed by at least two people (manager + Human Resources).',
    'Stated reason documented contemporaneously in the personnel file, predating any termination discussion.',
    'Internal reason matches what will appear on the LB-0489 and any unemployment response.',
    'Comparable conduct handled consistently (documented and treated the same as prior cases).',
    'Counsel review completed where required: a reduction affecting two or more employees, severance above the standard formula, or heightened risk.',
    "Timing reviewed — avoid separating right after a complaint, accommodation request, leave, or workers' compensation claim.",
    'If resignation: obtained in writing.',
    'Employees age 40 and older: enhanced OWBPA review process applied (Chapter 11).',
  ]),
  S('finalpay', 'Final pay & required forms', 'Chapters 4, 13', [
    'LB-0489 Separation Notice completed in advance and provided within 24 hours of separation (reason consistent with the file).',
    'Separation letter prepared; stated reason matches the LB-0489 and personnel file.',
    'Final wages scheduled — next regular payday or 21 days after separation, whichever is later (Tenn. Code Ann. § 50-2-103(g)).',
    'Unlimited PTO: confirm no balance payout is owed at separation.',
    'Child support / garnishment issuing agency notified promptly, where applicable.',
  ]),
  S('severance', 'Severance (if applicable)', 'Chapters 11–12', [
    'Severance paid as a lump sum (preserves unemployment eligibility; § 50-7-303(a)(12)).',
    'Severance release meets the seven requirements (Chapter 11).',
    'OWBPA disclosures for employees age 40 and older (consideration and revocation periods; Group Disclosure Chart D3 for group programs).',
    'Counsel approved the release before use.',
  ]),
  S('benefits', 'Benefits upon separation', 'Chapter 14', [
    'Health-coverage notice provided — No Continuation (E1) or COBRA Available (E2).',
    'Certificate of Prior Coverage (E3) issued where applicable.',
    'Retirement / benefits vesting reviewed (ERISA § 510 — not separating to prevent vesting).',
  ]),
  S('meeting', 'The separation meeting', 'Chapter 15', [
    'LB-0489 handed to the employee at the meeting.',
    'Separation letter provided.',
    'Return of firm property collected: laptop/computer, phone, keys, access/building cards, credit cards, documents, files.',
    'Accounts and access deactivated: email, internal systems, building access, remote access.',
    'Final pay and benefits transition explained.',
  ]),
  S('files', 'Offboarding & files', 'Chapters 16–17', [
    'Exit interview offered / conducted (16.2).',
    'Unemployment-response owner assigned; stated reason matches every document.',
    'Official personnel file assembled; no separate manager notes retained outside the file.',
    'Medical / accommodation records kept in the separate confidential file (not the personnel file).',
  ]),
];

export const OFFBOARDING_ITEMS = OFFBOARDING_CHECKLIST.flatMap(s => s.items);
export const OFFBOARDING_ITEM_COUNT = OFFBOARDING_ITEMS.length;

export const SEPARATION_TYPES = [
  'Voluntary resignation', 'Performance termination', 'Misconduct termination',
  'Immediate termination', 'Layoff / reduction', 'Mutual separation',
];

export function checkedCount(checklist: Record<string, boolean> | null | undefined): number {
  if (!checklist) return 0;
  return OFFBOARDING_ITEMS.reduce((n, it) => n + (checklist[it.id] ? 1 : 0), 0);
}
export function offboardingStatus(checklist: Record<string, boolean> | null | undefined): 'Complete' | 'In progress' | 'Not started' {
  const n = checkedCount(checklist);
  if (n >= OFFBOARDING_ITEM_COUNT) return 'Complete';
  return n > 0 ? 'In progress' : 'Not started';
}

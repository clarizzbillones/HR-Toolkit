// Shared definitions for benefits enrollment — who has elected Medical, Dental,
// Vision, and Life coverage. One record per (employee, benefit); the Insurance
// tile shows the firm-wide roster and each Employee File shows that person's
// elections, both reading/writing the same `benefit_enrollments` table.

export const BENEFITS = ['Medical', 'Dental', 'Vision', 'Life'] as const;
export type Benefit = typeof BENEFITS[number];

// Carriers for the enrollable group plans (Employee Health & Welfare, managed
// via the Ease portal), drawn from the Insurance tile's policies. Shown next to
// each benefit so HR knows which provider an enrollment is with.
export const BENEFIT_PROVIDERS: Record<Benefit, string> = {
  Medical: 'Blue Cross Blue Shield of TN',
  Dental: 'Guardian',
  Vision: 'Guardian (VSP network)',
  Life: 'Principal',
};

// Election status. '' = not recorded yet.
export const BENEFIT_STATUSES = ['Enrolled', 'Declined', 'Waived', 'Pending', 'Not eligible'] as const;
export type BenefitStatus = '' | typeof BENEFIT_STATUSES[number];

export interface Enrollment {
  person_name: string;
  benefit: Benefit | string;
  status: BenefitStatus | string;
  enrolled_date: string;
  plan: string;
  notes: string;
}

// Pill colors per status, matching the portal's palette.
export function benefitStatusChip(s: string): string {
  switch ((s ?? '').trim()) {
    case 'Enrolled': return 'bg-[#eef5f1] text-[#2f7d5b]';   // green
    case 'Declined': return 'bg-[#f3e9e7] text-[#b0412f]';   // red
    case 'Waived':   return 'bg-[#f1ece3] text-[#8b8478]';   // neutral
    case 'Pending':  return 'bg-[#f7efe1] text-[#b07d2a]';   // amber
    case 'Not eligible': return 'bg-[#eceef2] text-[#5a6b82]'; // slate
    default:         return 'bg-[#f6f4f0] text-text-faint';  // unset
  }
}

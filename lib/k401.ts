// 401(k) contribution check: what each employee and Litson put in per paycheck, entered by hand
// from the payroll deductions (payroll overrides the election in Guideline).
export const K401_ELIGIBLE = ['Yes', 'Not yet', 'No'] as const;
export const K401_PLANS = ['401(k)', 'Roth 401(k)', '401(k) + Roth', 'Not enrolled'] as const;
export const K401_STATUSES = ['Not sent', 'Emailed', 'Confirmed', 'Needs fix'] as const;

export interface K401Row {
  staff_id: string; name: string; position: string | null; email: string | null;
  eligible: string | null; eligible_date: string | null; plan: string | null;
  emp_pct: number | null; emp_check: number | null; er_check: number | null; as_of: string | null;
  status: string | null; note: string | null; sent_at: string | null; verified_at: string | null; updated_by: string | null; updated_at: string | null;
  roster: string | null; // 401(k) status on the Benefits roster (Enrolled / Declined / Not eligible / …)
}

export const ENROLLED_PLANS = ['401(k)', 'Roth 401(k)', '401(k) + Roth'];
// Where the plan entered here and the Eligibility (Benefits roster 401(k) status) disagree.
export function rosterMismatch(r: Pick<K401Row, 'roster' | 'plan'>): string | null {
  const inPlan = !!r.plan && ENROLLED_PLANS.includes(r.plan);
  if (!r.roster || !r.plan) return null;
  if (r.roster === 'Enrolled' && r.plan === 'Not enrolled') return 'Eligibility says Enrolled, but plan is “Not enrolled”.';
  if (r.roster === 'Not eligible' && inPlan) return `Eligibility says Not eligible, but plan is “${r.plan}”.`;
  if ((r.roster === 'Declined' || r.roster === 'Waived') && inPlan) return `Eligibility says ${r.roster}, but plan is “${r.plan}”.`;
  return null;
}
// What to fill in from the roster for someone not entered yet.
export function fromRoster(roster: string | null): { plan?: string } | null {
  return roster === 'Declined' || roster === 'Waived' || roster === 'Not eligible' ? { plan: 'Not enrolled' } : null;
}

export const money = (n: number | null | undefined) =>
  n == null ? '' : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
export const fmtDay = (d: string | null | undefined) => {
  if (!d) return '';
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : String(d);
};

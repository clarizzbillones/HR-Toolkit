// Actual cost of an employee to Litson: pay plus everything the firm pays on top of it (employer
// payroll taxes, 401(k) match, the firm's share of insurance, other costs). Nothing is estimated —
// every amount is typed in from ADP (per paycheck, year to date, and the year total once known).
// Pure and DB-free so the server and the client add up the same way.

export interface CostSettings { year: number }
export const DEFAULT_COST_SETTINGS: CostSettings = { year: 2026 };

export type RetirementPlan = '401k' | 'roth' | 'both' | 'none';
export const RETIREMENT_PLANS: { key: RetirementPlan; label: string }[] = [
  { key: '401k', label: '401(k)' }, { key: 'roth', label: 'Roth 401(k)' }, { key: 'both', label: '401(k) + Roth 401(k)' }, { key: 'none', label: 'Not enrolled' },
];

export type LineGroup = 'pay' | 'employer' | 'employee';
export const LEDGER_LINES = [
  { key: 'pay', label: 'Regular pay', code: '', group: 'pay' },
  { key: 'bonus', label: 'Bonus', code: '', group: 'pay' },
  { key: 'socialSecurity', label: 'Social Security', code: 'FED SOCSEC-ER', group: 'employer' },
  { key: 'medicare', label: 'Medicare', code: 'FED MEDCARE-ER', group: 'employer' },
  { key: 'futa', label: 'Federal unemployment', code: 'FED FUTA', group: 'employer' },
  { key: 'suta', label: 'Tennessee unemployment', code: 'TN SUI-ER', group: 'employer' },
  { key: 'match', label: '401(k) company match', code: '401k $ plan cmp mtch', group: 'employer' },
  { key: 'catchupMatch', label: '401(k) catch-up match', code: '401k catch-up $ cmp mtch', group: 'employer' },
  { key: 'medical', label: 'Medical', code: 'firm’s share', group: 'employer' },
  { key: 'dental', label: 'Dental', code: 'firm’s share', group: 'employer' },
  { key: 'vision', label: 'Vision', code: 'firm’s share', group: 'employer' },
  { key: 'other', label: 'Other costs', code: '', group: 'employer' },
  { key: 'emp401k', label: '401(k) plan', code: '', group: 'employee' },
  { key: 'empCatchup', label: '401(k) catch-up', code: '', group: 'employee' },
  { key: 'empMedical', label: 'Employee medical', code: '', group: 'employee' },
  { key: 'empDental', label: 'Dental', code: '', group: 'employee' },
  { key: 'empVision', label: 'Vision', code: '', group: 'employee' },
] as const;
export type LineKey = typeof LEDGER_LINES[number]['key'];
export const LEDGER_COLUMNS = ['check', 'ytd', 'total'] as const;
export type LedgerColumn = typeof LEDGER_COLUMNS[number];

// What's been typed in. `checks` = paychecks included in the YTD column.
export interface Ledger { checks?: number | null; check?: Partial<Record<LineKey, number>>; ytd?: Partial<Record<LineKey, number>>; total?: Partial<Record<LineKey, number>> }

export interface CostInputs { retirementPlan?: RetirementPlan | null; ledger?: Ledger | null }
export interface CostStaff { salary?: string | null; worker_type?: string | null }

export interface CostBreakdown {
  contractor: boolean;
  staffingSalary: string | null; // as written in Staffing, for reference only
  entered: boolean;              // anything typed in yet
  retirementPlan: RetirementPlan | null;
  // Per column: sum of each group (only what was typed).
  sums: Record<LedgerColumn, Record<LineGroup, number>>;
  year: Record<LineKey, number | null>; // year total if typed, otherwise year to date
  pay: number; employerCost: number; total: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function actualCost(staff: CostStaff, inputs: CostInputs): CostBreakdown {
  const l = inputs.ledger ?? {};
  const contractor = (staff.worker_type ?? 'Employee') === 'Contractor';
  const sums = Object.fromEntries(LEDGER_COLUMNS.map(c => [c, { pay: 0, employer: 0, employee: 0 }])) as CostBreakdown['sums'];
  const year = {} as Record<LineKey, number | null>;
  let entered = false;
  for (const line of LEDGER_LINES) {
    for (const c of LEDGER_COLUMNS) {
      const n = l[c]?.[line.key];
      if (n != null) { sums[c][line.group] = round2(sums[c][line.group] + n); entered = true; }
    }
    year[line.key] = l.total?.[line.key] ?? l.ytd?.[line.key] ?? null;
  }
  const add = (g: LineGroup) => round2(LEDGER_LINES.filter(x => x.group === g).reduce((t, x) => t + (year[x.key] ?? 0), 0));
  const pay = add('pay'), employerCost = add('employer');
  return { contractor, staffingSalary: staff.salary?.toString().trim() || null, entered, retirementPlan: inputs.retirementPlan ?? null,
    sums, year, pay, employerCost, total: round2(pay + employerCost) };
}

export const usd = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

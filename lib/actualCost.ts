// Fully loaded ("actual") annual cost of an employee to Litson: pay plus everything the firm pays
// on top of it — employer payroll taxes, the firm's share of insurance, the 401(k) match, and other
// per-person costs. Pure and DB-free so the server and the client compute the same numbers.

export interface CostSettings {
  year: number;
  ssRate: number;        // Social Security, employer share (%)
  ssWageBase: number;    // Social Security wage cap ($)
  medicareRate: number;  // Medicare, employer share (%) — no cap
  futaRate: number;      // Federal unemployment (%), after the state credit
  futaWageBase: number;
  sutaRate: number;      // Tennessee unemployment (%) — the firm's assigned rate
  sutaWageBase: number;
  match401kPct: number;  // Firm-wide 401(k) employer contribution (% of pay); per-person override allowed
  otherPct: number;      // Workers' comp and other costs that scale with pay (% of pay)
  hoursPerYear: number;  // Used to annualize hourly pay
}

// 2026 figures: SSA wage base $184,500; FICA employer 6.2% + 1.45%; FUTA 0.6% on $7,000;
// Tennessee SUTA $7,000 base, 2.7% new-employer rate (replace with Litson's assigned rate).
export const DEFAULT_COST_SETTINGS: CostSettings = {
  year: 2026, ssRate: 6.2, ssWageBase: 184500, medicareRate: 1.45, futaRate: 0.6, futaWageBase: 7000,
  sutaRate: 2.7, sutaWageBase: 7000, match401kPct: 0, otherPct: 0, hoursPerYear: 2080,
};

export interface CostInputs {
  // Firm's monthly share of each plan (employer contribution, not the employee's deduction)
  medicalMonthly?: number | null;
  dentalMonthly?: number | null;
  visionMonthly?: number | null;
  match401kPct?: number | null;     // Overrides the firm-wide 401(k) %
  otherAnnual?: number | null;      // Any other yearly cost for this person (phone stipend, licenses…)
}

export interface CostStaff {
  salary?: string | null; worker_type?: string | null; start_date?: string | null;
  offboarded?: boolean | null; offboarded_date?: string | null;
}

export interface CostBreakdown {
  contractor: boolean;
  annualPay: number | null;  // full-year rate
  hourly: boolean;
  fraction: number;          // share of the year employed (0–1)
  wages: number;             // pay for the part of the year employed
  socialSecurity: number; medicare: number; futa: number; suta: number; taxes: number;
  medical: number; dental: number; vision: number; insurance: number; retirement: number; matchPct: number; other: number;
  total: number;
  notes: string[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// "$120,000", "120000/yr", "$120k", "$50/hr", "50 per hour" → annual pay.
export function parsePay(v: any, hoursPerYear: number): { annual: number | null; hourly: boolean } {
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return { annual: null, hourly: false };
  const m = s.replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*(k)?/);
  if (!m) return { annual: null, hourly: false };
  const n = Number(m[1]) * (m[2] ? 1000 : 1);
  const hourly = /(^|[^a-z])(hr|hour|hourly)([^a-z]|$)|\/\s*h\b|per\s*hour/.test(s) || n < 1000;
  return { annual: hourly ? n * hoursPerYear : n, hourly };
}

// MM/DD/YYYY, M/D/YY or YYYY-MM-DD → Date (UTC noon), or null.
export function parseDay(v: any): Date | null {
  const s = String(v ?? '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
  m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
  if (m) { let y = +m[3]; if (y < 100) y += y < 50 ? 2000 : 1900; return new Date(Date.UTC(y, +m[1] - 1, +m[2], 12)); }
  return null;
}

// Share of the calendar year the person is employed, from start date to offboarding (or year end).
export function yearFraction(staff: CostStaff, year: number): number {
  const jan1 = Date.UTC(year, 0, 1, 12), dec31 = Date.UTC(year, 11, 31, 12), day = 864e5;
  const start = Math.max(jan1, parseDay(staff.start_date)?.getTime() ?? jan1);
  const end = Math.min(dec31, staff.offboarded ? (parseDay(staff.offboarded_date)?.getTime() ?? dec31) : dec31);
  if (end < start) return 0;
  return Math.min(1, (Math.round((end - start) / day) + 1) / (Math.round((dec31 - jan1) / day) + 1));
}

export function actualCost(staff: CostStaff, inputs: CostInputs, s: CostSettings): CostBreakdown {
  const { annual, hourly } = parsePay(staff.salary, s.hoursPerYear);
  const contractor = (staff.worker_type ?? 'Employee') === 'Contractor';
  const fraction = yearFraction(staff, s.year);
  const wages = (annual ?? 0) * fraction;
  const notes: string[] = [];
  if (annual == null) notes.push('No salary on file in Staffing.');
  if (hourly) notes.push(`Hourly pay annualized at ${s.hoursPerYear.toLocaleString()} hours a year.`);
  if (fraction < 1 && fraction > 0) notes.push(`Employed for ${Math.round(fraction * 100)}% of ${s.year}, so pay and benefits are prorated.`);
  if (fraction === 0) notes.push(`Not employed during ${s.year}.`);

  if (contractor) {
    notes.push('Contractor: no employer payroll taxes or benefits.');
    const other = round2(inputs.otherAnnual ?? 0);
    return { contractor, annualPay: annual, hourly, fraction, wages: round2(wages), socialSecurity: 0, medicare: 0, futa: 0, suta: 0, taxes: 0,
      medical: 0, dental: 0, vision: 0, insurance: 0, retirement: 0, matchPct: 0, other, total: round2(wages + other), notes };
  }

  const socialSecurity = round2(Math.min(wages, s.ssWageBase) * s.ssRate / 100);
  const medicare = round2(wages * s.medicareRate / 100);
  const futa = round2(Math.min(wages, s.futaWageBase) * s.futaRate / 100);
  const suta = round2(Math.min(wages, s.sutaWageBase) * s.sutaRate / 100);
  const taxes = round2(socialSecurity + medicare + futa + suta);
  const yearly = (m?: number | null) => round2((m ?? 0) * 12 * fraction);
  const medical = yearly(inputs.medicalMonthly), dental = yearly(inputs.dentalMonthly), vision = yearly(inputs.visionMonthly);
  const insurance = round2(medical + dental + vision);
  const matchPct = inputs.match401kPct ?? s.match401kPct;
  const retirement = round2(wages * matchPct / 100);
  const other = round2(wages * s.otherPct / 100 + (inputs.otherAnnual ?? 0));
  const missing = [['medical', inputs.medicalMonthly], ['dental', inputs.dentalMonthly], ['vision', inputs.visionMonthly]].filter(([, v]) => v == null).map(([k]) => k);
  if (missing.length) notes.push(`Firm’s ${missing.join(', ')} share not entered yet (enter 0 if they’re not enrolled).`);
  return { contractor, annualPay: annual, hourly, fraction, wages: round2(wages), socialSecurity, medicare, futa, suta, taxes,
    medical, dental, vision, insurance, retirement, matchPct, other, total: round2(wages + taxes + insurance + retirement + other), notes };
}

export const usd = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

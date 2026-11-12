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
  payPeriods: number;    // Paychecks a year (Litson is semimonthly: 24)
}

// 2026 figures: SSA wage base $184,500; FICA employer 6.2% + 1.45%; FUTA 0.6% on $7,000;
// Tennessee SUTA $7,000 base at Litson's 2.7% (confirmed from the ADP register: $189 on $7,000).
export const DEFAULT_COST_SETTINGS: CostSettings = {
  year: 2026, ssRate: 6.2, ssWageBase: 184500, medicareRate: 1.45, futaRate: 0.6, futaWageBase: 7000,
  sutaRate: 2.7, sutaWageBase: 7000, match401kPct: 0, otherPct: 0, hoursPerYear: 2080, payPeriods: 24,
};

export type RetirementPlan = '401k' | 'roth' | 'both' | 'none';
export const RETIREMENT_PLANS: { key: RetirementPlan; label: string }[] = [
  { key: '401k', label: '401(k)' }, { key: 'roth', label: 'Roth 401(k)' }, { key: 'both', label: '401(k) + Roth 401(k)' }, { key: 'none', label: 'Not enrolled' },
];

// Year-to-date figures copied from the ADP payroll register (Employer and Deductions sections).
export interface YtdActuals {
  checks?: number | null;          // paychecks already paid this year
  socialSecurity?: number | null;  // FED SOCSEC-ER
  medicare?: number | null;        // FED MEDCARE-ER
  futa?: number | null;            // FED FUTA
  suta?: number | null;            // TN SUI-ER
  match?: number | null;           // 401k $ plan cmp mtch
  catchupMatch?: number | null;    // 401k catch-up $ cmp mtch
  emp401k?: number | null;         // employee 401(k) deferral
  empCatchup?: number | null;      // employee catch-up deferral
  empMedical?: number | null;      // employee medical (pre-tax)
  empDental?: number | null;
  empVision?: number | null;
}
export const YTD_FIELDS: { key: keyof YtdActuals; label: string; employee?: boolean }[] = [
  { key: 'checks', label: 'Paychecks paid so far' },
  { key: 'socialSecurity', label: 'Social Security (FED SOCSEC-ER)' }, { key: 'medicare', label: 'Medicare (FED MEDCARE-ER)' },
  { key: 'futa', label: 'FUTA (FED FUTA)' }, { key: 'suta', label: 'TN SUI-ER' },
  { key: 'match', label: '401(k) company match' }, { key: 'catchupMatch', label: 'Catch-up company match' },
  { key: 'emp401k', label: 'Employee 401(k)', employee: true }, { key: 'empCatchup', label: 'Employee catch-up', employee: true },
  { key: 'empMedical', label: 'Employee medical', employee: true }, { key: 'empDental', label: 'Employee dental', employee: true },
  { key: 'empVision', label: 'Employee vision', employee: true },
];

export interface CostInputs {
  // Firm's monthly share of each plan (employer contribution, not the employee's deduction)
  medicalMonthly?: number | null;
  dentalMonthly?: number | null;
  visionMonthly?: number | null;
  retirementPlan?: RetirementPlan | null; // Which plan they contribute to (match is an employer cost either way)
  match401kPct?: number | null;     // Company match, % of pay — overrides the firm-wide %
  catchupAnnual?: number | null;    // Company match on catch-up contributions, $ per year
  otherAnnual?: number | null;      // Any other yearly cost for this person (phone stipend, licenses…)
  bonusAnnual?: number | null;      // Bonuses this year (taxable pay; no 401(k) match)
  emp401kPct?: number | null;       // Employee's own 401(k) deferral, % of pay (shown, not a firm cost)
  // Employee's pre-tax (Section 125) deductions per paycheck. They lower Social Security, Medicare
  // and FUTA wages, not Tennessee SUI wages.
  empMedicalCheck?: number | null;
  empDentalCheck?: number | null;
  empVisionCheck?: number | null;
  ytd?: YtdActuals | null;
  // Amounts typed straight into the Employer table, replacing the calculated ones:
  // `check` = one paycheck (also drives the paychecks still to come), `total` = the year total.
  overrides?: CostOverrides | null;
}
export type TaxLine = 'socialSecurity' | 'medicare' | 'futa' | 'suta' | 'retirement' | 'catchup';
export const OVERRIDE_LINES: TaxLine[] = ['socialSecurity', 'medicare', 'futa', 'suta', 'retirement', 'catchup'];
export interface CostOverrides { check?: Partial<Record<TaxLine, number>>; total?: Partial<Record<TaxLine, number>> }

export interface CostStaff {
  salary?: string | null; worker_type?: string | null; start_date?: string | null;
  offboarded?: boolean | null; offboarded_date?: string | null;
}

// One paycheck, or one set of employer amounts.
export interface EmployerLines {
  socialSecurity: number; medicare: number; futa: number; suta: number;
  retirement: number; catchup: number; medical: number; dental: number; vision: number;
}
export interface CostBreakdown {
  contractor: boolean;
  annualPay: number | null;  // full-year rate
  hourly: boolean;
  fraction: number;          // share of the year employed (0–1)
  salaryWages: number;       // regular pay for the part of the year employed
  bonus: number;
  wages: number;             // salary + bonus
  socialSecurity: number; medicare: number; futa: number; suta: number; taxes: number;
  medical: number; dental: number; vision: number; insurance: number;
  retirementPlan: RetirementPlan | null; retirement: number; matchPct: number; catchup: number; other: number;
  employerCost: number; // everything the firm pays on top of pay (ADP's employer liability + benefits)
  total: number;
  // A regular paycheck (before the $7,000 FUTA/SUI bases are used up).
  perCheck: (EmployerLines & { gross: number; employerCost: number }) | null;
  edited: { check: TaxLine[]; total: TaxLine[] }; // which amounts were typed in
  // Employee's own deductions per paycheck (informational — not a firm cost).
  employeeCheck: { k401: number; medical: number; dental: number; vision: number; total: number } | null;
  // When ADP year-to-date figures are entered: what's been paid and what's left.
  ytd: { checks: number; remaining: number; paid: EmployerLines; rest: EmployerLines; paidTotal: number; restTotal: number } | null;
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

const sumLines = (l: EmployerLines) => round2(l.socialSecurity + l.medicare + l.futa + l.suta + l.retirement + l.catchup + l.medical + l.dental + l.vision);

export function actualCost(staff: CostStaff, inputs: CostInputs, s: CostSettings): CostBreakdown {
  const { annual, hourly } = parsePay(staff.salary, s.hoursPerYear);
  const contractor = (staff.worker_type ?? 'Employee') === 'Contractor';
  const fraction = yearFraction(staff, s.year);
  const periods = s.payPeriods > 0 ? s.payPeriods : 24;
  const salaryWages = (annual ?? 0) * fraction;
  const bonus = contractor ? 0 : round2(inputs.bonusAnnual ?? 0);
  const wages = salaryWages + bonus;
  const notes: string[] = [];
  if (annual == null) notes.push('No salary on file in Staffing.');
  if (hourly) notes.push(`Hourly pay annualized at ${s.hoursPerYear.toLocaleString()} hours a year.`);
  if (fraction < 1 && fraction > 0) notes.push(`Employed for ${Math.round(fraction * 100)}% of ${s.year}, so pay and benefits are prorated.`);
  if (fraction === 0) notes.push(`Not employed during ${s.year}.`);

  if (contractor) {
    notes.push('Contractor: no employer payroll taxes or benefits.');
    const other = round2(inputs.otherAnnual ?? 0);
    return { contractor, annualPay: annual, hourly, fraction, salaryWages: round2(salaryWages), bonus: 0, wages: round2(wages),
      socialSecurity: 0, medicare: 0, futa: 0, suta: 0, taxes: 0, medical: 0, dental: 0, vision: 0, insurance: 0,
      retirementPlan: null, retirement: 0, matchPct: 0, catchup: 0, other, employerCost: other, total: round2(wages + other),
      perCheck: null, employeeCheck: null, ytd: null, edited: { check: [], total: [] }, notes };
  }

  const plan = inputs.retirementPlan ?? null;
  const matchPct = plan === 'none' ? 0 : inputs.match401kPct ?? s.match401kPct;
  const catchupYear = plan === 'none' ? 0 : inputs.catchupAnnual ?? 0;
  const monthly = (m?: number | null) => m ?? 0;

  // One regular paycheck. Section-125 deductions come off FICA/FUTA wages only.
  const gross = (annual ?? 0) / periods;
  const preTax = (inputs.empMedicalCheck ?? 0) + (inputs.empDentalCheck ?? 0) + (inputs.empVisionCheck ?? 0);
  const ficaCheck = Math.max(0, gross - preTax);
  const check: EmployerLines = {
    socialSecurity: round2(ficaCheck * s.ssRate / 100), medicare: round2(ficaCheck * s.medicareRate / 100),
    futa: round2(Math.min(ficaCheck, s.futaWageBase) * s.futaRate / 100), suta: round2(Math.min(gross, s.sutaWageBase) * s.sutaRate / 100),
    retirement: round2(gross * matchPct / 100), catchup: round2(catchupYear / periods),
    medical: round2(monthly(inputs.medicalMonthly) * 12 / periods), dental: round2(monthly(inputs.dentalMonthly) * 12 / periods),
    vision: round2(monthly(inputs.visionMonthly) * 12 / periods),
  };
  const ovCheck = inputs.overrides?.check ?? {}, ovTotal = inputs.overrides?.total ?? {};
  const edited = { check: OVERRIDE_LINES.filter(k => ovCheck[k] != null), total: OVERRIDE_LINES.filter(k => ovTotal[k] != null) };
  for (const k of edited.check) check[k] = round2(ovCheck[k]!);
  const perCheck = { ...check, gross: round2(gross), employerCost: sumLines(check) };
  // Year cap for each tax, in dollars of tax.
  const capTax: Record<TaxLine, number> = { socialSecurity: s.ssWageBase * s.ssRate / 100, medicare: Infinity,
    futa: s.futaWageBase * s.futaRate / 100, suta: s.sutaWageBase * s.sutaRate / 100, retirement: Infinity, catchup: Infinity };
  const k401 = round2(gross * (plan === 'none' ? 0 : inputs.emp401kPct ?? 0) / 100);
  const employeeCheck = { k401, medical: round2(inputs.empMedicalCheck ?? 0), dental: round2(inputs.empDentalCheck ?? 0), vision: round2(inputs.empVisionCheck ?? 0), total: 0 };
  employeeCheck.total = round2(k401 + employeeCheck.medical + employeeCheck.dental + employeeCheck.vision);

  // Insurance is the same either way (not on the register): monthly share × months employed.
  const yearly = (m?: number | null) => round2(monthly(m) * 12 * fraction);
  const medical = yearly(inputs.medicalMonthly), dental = yearly(inputs.dentalMonthly), vision = yearly(inputs.visionMonthly);
  const insurance = round2(medical + dental + vision);
  const other = round2(wages * s.otherPct / 100 + (inputs.otherAnnual ?? 0));

  let socialSecurity: number, medicare: number, futa: number, suta: number, retirement: number, catchup: number;
  let ytd: CostBreakdown['ytd'] = null;
  const y = inputs.ytd;
  if (y && y.checks != null) {
    // Year-end = ADP year-to-date + the paychecks still to come, each estimated like a regular check,
    // stopping each tax at its wage base (YTD taxable wages are backed out of the YTD tax).
    const checks = Math.max(0, Math.round(y.checks));
    const remaining = Math.max(0, Math.round(periods * fraction) - checks);
    const v = (n?: number | null) => round2(n ?? 0);
    const wagesFrom = (tax: number, rate: number) => (rate > 0 ? tax / (rate / 100) : 0);
    const restFica = ficaCheck * remaining, restGross = gross * remaining;
    const room = (base: number, used: number, want: number) => Math.max(0, Math.min(want, base - used));
    const paid: EmployerLines = { socialSecurity: v(y.socialSecurity), medicare: v(y.medicare), futa: v(y.futa), suta: v(y.suta),
      retirement: v(y.match), catchup: v(y.catchupMatch),
      medical: round2(medical * checks / Math.max(1, checks + remaining)), dental: round2(dental * checks / Math.max(1, checks + remaining)),
      vision: round2(vision * checks / Math.max(1, checks + remaining)) };
    const rest: EmployerLines = {
      socialSecurity: round2(room(s.ssWageBase, wagesFrom(paid.socialSecurity, s.ssRate), restFica) * s.ssRate / 100),
      medicare: round2(restFica * s.medicareRate / 100),
      futa: round2(room(s.futaWageBase, wagesFrom(paid.futa, s.futaRate), restFica) * s.futaRate / 100),
      suta: round2(room(s.sutaWageBase, wagesFrom(paid.suta, s.sutaRate), restGross) * s.sutaRate / 100),
      retirement: round2(check.retirement * remaining), catchup: round2(check.catchup * remaining),
      medical: round2(medical - paid.medical), dental: round2(dental - paid.dental), vision: round2(vision - paid.vision),
    };
    // A typed per-paycheck amount: the remaining checks at that amount, up to what's left under the cap.
    for (const k of edited.check) rest[k] = round2(Math.max(0, Math.min(check[k] * remaining, capTax[k] - paid[k])));
    // A typed year total: the remaining checks are whatever's left after year to date.
    for (const k of edited.total) rest[k] = round2(ovTotal[k]! - paid[k]);
    ytd = { checks, remaining, paid, rest, paidTotal: sumLines(paid), restTotal: sumLines(rest) };
    socialSecurity = round2(paid.socialSecurity + rest.socialSecurity); medicare = round2(paid.medicare + rest.medicare);
    futa = round2(paid.futa + rest.futa); suta = round2(paid.suta + rest.suta);
    retirement = round2(paid.retirement + rest.retirement); catchup = round2(paid.catchup + rest.catchup);
    notes.push(`Year-to-date from ADP (${checks} paychecks) plus ${remaining} more estimated like a regular paycheck.`);
  } else {
    const ficaWages = Math.max(0, wages - preTax * periods * fraction);
    socialSecurity = round2(Math.min(ficaWages, s.ssWageBase) * s.ssRate / 100);
    medicare = round2(ficaWages * s.medicareRate / 100);
    futa = round2(Math.min(ficaWages, s.futaWageBase) * s.futaRate / 100);
    suta = round2(Math.min(wages, s.sutaWageBase) * s.sutaRate / 100);
    retirement = round2(salaryWages * matchPct / 100);
    catchup = round2(catchupYear * fraction);
    const n = Math.round(periods * fraction);
    const t: Record<TaxLine, number> = { socialSecurity, medicare, futa, suta, retirement, catchup };
    for (const k of edited.check) t[k] = round2(Math.min(check[k] * n, capTax[k]));
    for (const k of edited.total) t[k] = round2(ovTotal[k]!);
    ({ socialSecurity, medicare, futa, suta, retirement, catchup } = t);
  }
  if (edited.check.length || edited.total.length) notes.push('Some amounts were typed in by hand (marked ✎); ↺ puts the calculated amount back.');
  if (bonus) notes.push(`Includes ${usd(bonus)} bonus (taxed like pay; no 401(k) match on it).`);
  const taxes = round2(socialSecurity + medicare + futa + suta);
  const missing = [['medical', inputs.medicalMonthly], ['dental', inputs.dentalMonthly], ['vision', inputs.visionMonthly]].filter(([, v]) => v == null).map(([k]) => k);
  if (missing.length) notes.push(`Firm’s ${missing.join(', ')} share not entered yet (enter 0 if they’re not enrolled).`);
  const employerCost = round2(taxes + insurance + retirement + catchup + other);
  return { contractor, annualPay: annual, hourly, fraction, salaryWages: round2(salaryWages), bonus, wages: round2(wages),
    socialSecurity, medicare, futa, suta, taxes, medical, dental, vision, insurance, retirementPlan: plan, retirement, matchPct, catchup, other,
    employerCost, total: round2(wages + employerCost), perCheck, employeeCheck, ytd, edited, notes };
}

export const usd = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

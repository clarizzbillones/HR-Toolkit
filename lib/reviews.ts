// Single source of truth for performance-review scheduling.
//
// Policy: every employee is reviewed every 6 months from their hire date,
// indefinitely (6mo, 1yr, 1.5yr, 2yr, …). There is no separate "6-month" and
// "1-year" track — it's one repeating cycle anchored to the hire date. The
// milestone (cycle/tenure) is internal only; staff are only ever told they're
// due for "your next Performance Review".

// ---- Date helpers (hand-rolled, end-of-month aware) ------------------------

// Add whole months to a YYYY-MM-DD date, clamping to end-of-month
// (Jan 31 + 1 month = Feb 28/29). Returns YYYY-MM-DD.
export function addMonths(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = ((total % 12) + 12) % 12; // 0-11
  const daysInMonth = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  const nd = Math.min(d, daysInMonth);
  return `${ny}-${String(nm + 1).padStart(2, '0')}-${String(nd).padStart(2, '0')}`;
}
// Backwards-compatible alias used elsewhere.
export const addMonthsStr = addMonths;

// Whole months elapsed from `from` to `to` (like date-fns differenceInMonths).
export function monthsBetween(fromStr: string, toStr: string): number {
  const [fy, fm, fd] = fromStr.slice(0, 10).split('-').map(Number);
  const [ty, tm, td] = toStr.slice(0, 10).split('-').map(Number);
  let months = (ty - fy) * 12 + (tm - fm);
  if (td < fd) months -= 1; // not a full month yet
  return months;
}

// Whole calendar days between two YYYY-MM-DD dates (to − from).
export function daysBetween(fromStr: string, toStr: string): number {
  const [fy, fm, fd] = fromStr.slice(0, 10).split('-').map(Number);
  const [ty, tm, td] = toStr.slice(0, 10).split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000);
}

// ---- Fixed bi-annual cohort scheduling -------------------------------------
// Instead of anchoring to each hire date, an employee can be placed in a review
// COHORT: two fixed months, six months apart, so everyone in the cohort is
// reviewed together twice a year (reviews target the 1st of the month).
//   • 'apr_oct' — April & October   (Spring / Fall)
//   • 'jan_jul' — January & July    (Winter / Summer)
export type ReviewCohort = 'apr_oct' | 'jan_jul';
export interface CohortDef { key: ReviewCohort; months: number[]; label: string; seasons: string }
export const REVIEW_COHORTS: CohortDef[] = [
  { key: 'apr_oct', months: [4, 10], label: 'Apr / Oct', seasons: 'Spring / Fall' },
  { key: 'jan_jul', months: [1, 7], label: 'Jan / Jul', seasons: 'Winter / Summer' },
];
// Accept a range of spellings/synonyms so seasonal or reversed labels still map
// to the right cohort (e.g. "Winter/Summer", "oct_apr", "Fall/Spring").
export function normalizeCohort(raw: string | null | undefined): ReviewCohort | null {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return null;
  if (['apr_oct', 'oct_apr', 'april/october', 'october/april', 'spring/fall', 'fall/spring', 'spring_fall', 'fall_spring'].includes(s)) return 'apr_oct';
  if (['jan_jul', 'jul_jan', 'january/july', 'july/january', 'winter/summer', 'summer/winter', 'winter_summer', 'summer_winter'].includes(s)) return 'jan_jul';
  if (/(apr|oct|spring|fall)/.test(s)) return 'apr_oct';   // loose fallback
  if (/(jan|jul|winter|summer)/.test(s)) return 'jan_jul';
  return null;
}
export function cohortDef(key: string | null | undefined): CohortDef | null {
  const k = normalizeCohort(key);
  return k ? (REVIEW_COHORTS.find(c => c.key === k) ?? null) : null;
}
// The first cohort review date (YYYY-MM-01) after `afterYmd`. When `inclusive`
// is true a review month that IS the anchor month counts (used for someone
// never reviewed, so a review due this very month still shows).
export function nextCohortDate(months: number[], afterYmd: string, inclusive = false): string {
  const anchor = afterYmd.slice(0, 10);
  const y = Number(anchor.slice(0, 4)) || 2000;
  const asc = [...months].sort((a, b) => a - b);
  for (let yr = y; yr <= y + 3; yr++) {
    for (const mo of asc) {
      const cand = `${yr}-${String(mo).padStart(2, '0')}-01`;
      if (inclusive ? cand >= anchor : cand > anchor) return cand;
    }
  }
  return `${y + 3}-${String(asc[0]).padStart(2, '0')}-01`;
}

// ---- Core scheduling -------------------------------------------------------

// The cycle number of the NEXT due review (1 = 6mo, 2 = 1yr, 3 = 1.5yr, …).
// Anchored to hire_date. The `+ 1` grace month lets a review done slightly
// early still close its cycle (e.g. a 5.8-month review closes cycle 1).
export function reviewCycle(hireDate: string | null, lastReview: string | null): number | null {
  if (!hireDate) return null;
  if (!lastReview) return 1;
  const monthsServed = monthsBetween(hireDate, lastReview);
  const cyclesClosed = Math.floor((monthsServed + 1) / 6);
  return cyclesClosed + 1;
}

// Next review date — 6 months after the last completed review (a rolling
// cadence). For someone never reviewed, the first review is 6 months after
// their hire date.
export function nextReviewDate(hireDate: string | null, lastReview: string | null): string | null {
  if (lastReview) return addMonths(lastReview, 6);
  if (hireDate) return addMonths(hireDate, 6);
  return null;
}

// Tenure of the next review as "0.5 yr", "1.0 yr", "2.5 yr". Derived from the
// cycle so month-end clamping never skews it.
export function tenureLabel(hireDate: string | null, lastReview: string | null): string {
  const cycle = reviewCycle(hireDate, lastReview);
  if (cycle == null) return '—';
  return (cycle * 0.5).toFixed(1) + ' yr';
}

// Days until the next review is due (negative = overdue).
export function daysUntilDue(nextReview: string | null, today: string): number | null {
  if (!nextReview) return null;
  return daysBetween(today, nextReview);
}

// ---- Status derivation -----------------------------------------------------

// 'Complete' and 'Not started' are manual-only statuses (never produced by
// statusFor); they're selectable as a status override — 'Complete' to mark a
// review just done, 'Not started' for people not yet in the review cycle.
export type ReviewStatus = 'Overdue' | 'Review week' | 'Forms due' | 'Send forms' | 'Scheduled' | 'Complete' | 'Not started';
export const REVIEW_STATUSES: ReviewStatus[] = ['Overdue', 'Review week', 'Forms due', 'Send forms', 'Scheduled', 'Complete', 'Not started'];

export function statusFor(days: number | null): ReviewStatus | null {
  if (days == null) return null;
  if (days < 0) return 'Overdue';       // escalate
  if (days <= 14) return 'Review week'; // forms back, build agenda, Alex meets
  if (days <= 28) return 'Forms due';   // self + peer assessment forms out
  if (days <= 42) return 'Send forms';  // flag review, assign peer reviewers
  return 'Scheduled';                   // none
}

// ---- Everything for one employee, computed on read -------------------------

export interface ReviewCompute {
  next: string | null;      // the effective next review (override wins)
  computed: string | null;  // the formula's prediction (before override)
  overridden: boolean;
  cycle: number | null;
  tenure: string;
  days: number | null;
  status: ReviewStatus | null;
  cohort: ReviewCohort | null; // fixed bi-annual cohort, if the person is in one
}
// A missed review stays actionable (Overdue) for this catch-up window; once it
// is more than this many days past due it is considered missed and the schedule
// rolls forward to the next 6-month milestone.
export const ROLL_GRACE_DAYS = 90;

// `override` lets HR reschedule the upcoming review off the predicted date
// (real reviews don't always land on the exact computed day). If a review is
// missed past the grace window, the next date/cycle/tenure roll forward to the
// next milestone that's still within reach.
export function computeReview(hireDate: string | null, lastReview: string | null, today: string, override?: string | null, cohort?: string | null): ReviewCompute {
  // Fixed bi-annual cohort takes precedence over the hire-date cadence: the next
  // review is the cohort's next review month, not "last review + 6 months".
  const coh = normalizeCohort(cohort ?? null);
  if (coh) {
    const def = cohortDef(coh)!;
    let computed = lastReview
      ? nextCohortDate(def.months, lastReview)          // next cohort month after the last review
      : nextCohortDate(def.months, today, true);         // next cohort month on/after today
    // A cohort review more than the grace window overdue rolls to the next month.
    let guard = 0;
    while (daysBetween(computed, today) > ROLL_GRACE_DAYS && guard++ < 240) {
      computed = nextCohortDate(def.months, computed);
    }
    const ovc = override && override.trim() ? override.slice(0, 10) : null;
    const nextc = ovc ?? computed;
    const daysc = daysUntilDue(nextc, today);
    return {
      next: nextc, computed, overridden: !!ovc,
      cycle: null, tenure: '—', days: daysc,
      status: statusForCycle(statusFor(daysc), lastReview, today),
      cohort: coh,
    };
  }
  let cycle = reviewCycle(hireDate, lastReview);
  let computed = nextReviewDate(hireDate, lastReview);
  if (computed) {
    // A next review more than the grace window overdue is treated as missed;
    // roll forward another 6 months until it's back within reach.
    let guard = 0;
    while (daysBetween(computed, today) > ROLL_GRACE_DAYS && guard++ < 240) {
      computed = addMonths(computed, 6);
      if (cycle != null) cycle += 1;
    }
  }
  const ov = override && override.trim() ? override.slice(0, 10) : null;
  const next = ov ?? computed;
  const days = daysUntilDue(next, today);
  return {
    next,
    computed,
    overridden: !!ov,
    cycle,
    tenure: cycle != null ? (cycle * 0.5).toFixed(1) + ' yr' : '—',
    days,
    status: statusForCycle(statusFor(days), lastReview, today),
    cohort: null,
  };
}

// When nothing is due yet (statusFor === 'Scheduled'), decide between:
//  • 'Complete'   — a review was just logged (last review within the last 30
//                   days, in the past) → shows as done for that cycle, then
//  • 'Not started'— the upcoming review (a future/next date) hasn't begun.
// Any actionable status (Send forms/Forms due/Review week/Overdue) passes through.
function statusForCycle(base: ReviewStatus | null, lastReview: string | null, today: string): ReviewStatus | null {
  if (base !== 'Scheduled') return base;
  const since = lastReview ? daysBetween(lastReview, today) : null; // today − lastReview
  return (since != null && since >= 0 && since <= 30) ? 'Complete' : 'Not started';
}

// review_history entry: one completed review.
export interface ReviewHistoryEntry { date: string; peer_reviewers: string[]; notes: string }
export function parseHistory(raw: any): ReviewHistoryEntry[] {
  try {
    const h = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(h) ? h.filter(x => x && x.date).map(x => ({ date: String(x.date).slice(0, 10), peer_reviewers: Array.isArray(x.peer_reviewers) ? x.peer_reviewers : [], notes: String(x.notes ?? '') })) : [];
  } catch { return []; }
}

// ---- Legacy exports (kept so the Reports tab keeps compiling) --------------

export interface ReviewEmployee {
  id: string; name: string; role: string; dept: string; hire_date: string | null;
  last_review_date?: string | null; review_history?: any;
  next_review_override?: string | null; review_status_override?: string | null;
  review_cohort?: string | null;
  review_6mo_date?: string | null; review_6mo_status?: string | null;
  review_1yr_date?: string | null; review_1yr_status?: string | null;
}
export interface ReviewRow {
  id: string; name: string; role: string; dept: string;
  type: string; date: string | null; status: string;
}

// Effective last review — the logged date, or the latest review-history entry.
// Mirrors the Performance Reviews dashboard's lastOf().
export function lastReviewOf(e: ReviewEmployee): string | null {
  if (e.last_review_date && String(e.last_review_date).trim()) return String(e.last_review_date).slice(0, 10);
  const h = parseHistory(e.review_history);
  return h.length ? h.map(x => x.date).sort().slice(-1)[0] : null;
}

// Effective review date (legacy shape) — now derives the single next review.
export function reviewDateStr(e: ReviewEmployee, _kind?: '6mo' | '1yr'): string | null {
  return nextReviewDate(e.hire_date ?? null, lastReviewOf(e));
}

// One row per employee: their next Performance Review. Uses the SAME inputs as
// the Performance Reviews dashboard — last review from history, the manual
// next-date override, and the manual status override — so the two always agree.
export function reviewRows(employees: ReviewEmployee[], today?: string): ReviewRow[] {
  const t = today ?? new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
  const rows: ReviewRow[] = [];
  for (const e of employees ?? []) {
    const c = computeReview(e.hire_date ?? null, lastReviewOf(e), t, e.next_review_override ?? null, e.review_cohort ?? null);
    if (!c.next) continue;
    const ov = e.review_status_override;
    const status = ov && (REVIEW_STATUSES as string[]).includes(ov) ? ov : (c.status ?? 'Scheduled');
    rows.push({ id: e.id, name: e.name, role: e.role, dept: e.dept, type: 'Performance Review', date: c.next, status });
  }
  return rows;
}

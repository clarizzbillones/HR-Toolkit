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

// 'Not started' is a manual-only status (never produced by statusFor); it's
// selectable as a status override for people not yet in the review cycle.
export type ReviewStatus = 'Overdue' | 'Review week' | 'Forms due' | 'Send forms' | 'Scheduled' | 'Not started';
export const REVIEW_STATUSES: ReviewStatus[] = ['Overdue', 'Review week', 'Forms due', 'Send forms', 'Scheduled', 'Not started'];

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
}
// A missed review stays actionable (Overdue) for this catch-up window; once it
// is more than this many days past due it is considered missed and the schedule
// rolls forward to the next 6-month milestone.
export const ROLL_GRACE_DAYS = 90;

// `override` lets HR reschedule the upcoming review off the predicted date
// (real reviews don't always land on the exact computed day). If a review is
// missed past the grace window, the next date/cycle/tenure roll forward to the
// next milestone that's still within reach.
export function computeReview(hireDate: string | null, lastReview: string | null, today: string, override?: string | null): ReviewCompute {
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
    status: statusFor(days),
  };
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
  review_6mo_date?: string | null; review_6mo_status?: string | null;
  review_1yr_date?: string | null; review_1yr_status?: string | null;
}
export interface ReviewRow {
  id: string; name: string; role: string; dept: string;
  type: string; date: string | null; status: string;
}

// Effective review date (legacy shape) — now derives the single next review.
export function reviewDateStr(e: ReviewEmployee, _kind?: '6mo' | '1yr'): string | null {
  return nextReviewDate(e.hire_date ?? null, e.last_review_date ?? null);
}

// One row per employee: their next Performance Review.
export function reviewRows(employees: ReviewEmployee[], today?: string): ReviewRow[] {
  const t = today ?? new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
  const rows: ReviewRow[] = [];
  for (const e of employees ?? []) {
    const c = computeReview(e.hire_date ?? null, e.last_review_date ?? null, t);
    if (!c.next) continue;
    rows.push({ id: e.id, name: e.name, role: e.role, dept: e.dept, type: 'Performance Review', date: c.next, status: c.status ?? 'Scheduled' });
  }
  return rows;
}

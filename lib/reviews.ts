// Single source of truth for performance-review dates, shared by the Reviews
// dashboard and the Reports tab so both derive the same dates/rows.

export interface ReviewEmployee {
  id: string; name: string; role: string; dept: string; hire_date: string | null;
  review_6mo_date: string | null; review_6mo_status: string | null;
  review_1yr_date: string | null; review_1yr_status: string | null;
}

export interface ReviewRow {
  id: string; name: string; role: string; dept: string;
  type: '6-month' | '1-year'; date: string | null; status: string;
}

// Add whole months to a YYYY-MM-DD date, returning YYYY-MM-DD
export function addMonthsStr(dateStr: string, months: number): string {
  const d = new Date(dateStr.slice(0, 10) + 'T12:00:00');
  d.setMonth(d.getMonth() + months);
  return d.toLocaleDateString('en-CA');
}

// Effective review date: manual override wins, else hire_date + 6/12 months
export function reviewDateStr(e: ReviewEmployee, kind: '6mo' | '1yr'): string | null {
  if (kind === '6mo') {
    if (e.review_6mo_date) return e.review_6mo_date.slice(0, 10);
    if (e.hire_date) return addMonthsStr(e.hire_date, 6);
  } else {
    if (e.review_1yr_date) return e.review_1yr_date.slice(0, 10);
    if (e.hire_date) return addMonthsStr(e.hire_date, 12);
  }
  return null;
}

// Flatten employees into individual review rows (6-month + 1-year)
export function reviewRows(employees: ReviewEmployee[]): ReviewRow[] {
  const rows: ReviewRow[] = [];
  for (const e of employees ?? []) {
    const d6 = reviewDateStr(e, '6mo');
    if (d6 || e.review_6mo_status) rows.push({ id: e.id + '-6', name: e.name, role: e.role, dept: e.dept, type: '6-month', date: d6, status: e.review_6mo_status ?? 'Not Started' });
    const d12 = reviewDateStr(e, '1yr');
    if (d12 || e.review_1yr_status) rows.push({ id: e.id + '-12', name: e.name, role: e.role, dept: e.dept, type: '1-year', date: d12, status: e.review_1yr_status ?? 'Not Started' });
  }
  return rows;
}

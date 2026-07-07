import { sql } from '@/lib/db';
import ModuleLayout from '@/components/ModuleLayout';
import DashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';

async function getStats() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
  const [{ n: pendingCount }] = await sql`SELECT COUNT(*)::int as n FROM tasks WHERE status NOT IN ('done', 'archived')`;
  const [{ n: doneCount }] = await sql`SELECT COUNT(*)::int as n FROM tasks WHERE status = 'done'`;
  const [{ n: dueToday }] = await sql`SELECT COUNT(*)::int as n FROM tasks WHERE due_tag = 'Today' AND status NOT IN ('done', 'archived')`;
  // ptoToday is fetched client-side from /api/pto/today (full merge logic)
  const ptoToday = 0;
  const [nextPayroll] = await sql`SELECT run_date, cutoff FROM payroll_periods WHERE run_date >= ${today} ORDER BY run_date ASC LIMIT 1`;
  const [{ n: empCount }] = await sql`SELECT COUNT(*)::int as n FROM employees`;
  const [{ n: reviewsDone }] = await sql`SELECT COUNT(*)::int as n FROM employees WHERE review_6mo_status = 'Complete'`;
  let onboarding = 0;
  try { const [{ n }] = await sql`SELECT COUNT(*)::int as n FROM onboardees WHERE status <> 'Complete'`; onboarding = n ?? 0; } catch { /* table not created yet */ }

  // This-month birthdays & work anniversaries from the Staffing directory
  let birthdays: { name: string; dob: string }[] = [];
  let anniversaries: { name: string; years: number; date: string }[] = [];
  try {
    const staff = await sql`SELECT name, dob, start_date FROM staff_directory` as any[];
    const now = new Date(); const cm = now.getMonth() + 1; const cy = now.getFullYear();
    const monthOf = (s: string) => { if (!s) return 0; const t = String(s).trim(); if (/^\d{4}-\d{2}/.test(t)) return parseInt(t.slice(5, 7)); const p = t.split('/'); return p.length ? parseInt(p[0]) : 0; };
    const startMY = (s: string) => { const t = String(s ?? '').trim(); if (/^\d{4}-\d{2}/.test(t)) return { m: parseInt(t.slice(5, 7)), y: parseInt(t.slice(0, 4)) }; const p = t.split('/'); return p.length >= 3 ? { m: parseInt(p[0]), y: parseInt(p[2]) } : { m: 0, y: 0 }; };
    const dayOf = (s: string) => { const t = String(s ?? '').trim(); if (/^\d{4}-\d{2}-\d{2}/.test(t)) return parseInt(t.slice(8, 10)); const p = t.split('/'); return p.length >= 2 ? parseInt(p[1]) : 0; };
    birthdays = staff.filter(e => monthOf(e.dob) === cm).map(e => ({ name: e.name, dob: e.dob })).sort((a, b) => dayOf(a.dob) - dayOf(b.dob));
    anniversaries = staff.map(e => ({ ...startMY(e.start_date), name: e.name, date: e.start_date }))
      .filter(e => e.m === cm && e.y && e.y < cy).map(e => ({ name: e.name, years: cy - e.y, date: e.date }))
      .sort((a, b) => dayOf(a.date) - dayOf(b.date));
  } catch { /* staffing table not created yet */ }
  const payrollDaysLeft = nextPayroll
    ? Math.ceil((new Date(nextPayroll.run_date).getTime() - Date.now()) / 86400000)
    : null;

  // Upcoming deadlines (next 30 days) — payroll + performance reviews, flagged by urgency
  const daysUntil = (s: string) => {
    const t = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
    t.setHours(0, 0, 0, 0);
    const d = new Date(String(s).slice(0, 10) + 'T00:00:00');
    return Math.round((d.getTime() - t.getTime()) / 86400000);
  };
  const deadlines: { label: string; date: string; days: number; kind: string }[] = [];
  try {
    const [np] = await sql`SELECT cutoff FROM payroll_periods WHERE cutoff >= ${today} AND status NOT IN ('Processed') ORDER BY cutoff ASC LIMIT 1` as any[];
    if (np?.cutoff) deadlines.push({ label: 'Payroll — deadline to run', date: np.cutoff.slice(0, 10), days: daysUntil(np.cutoff), kind: 'payroll' });
  } catch { /* ignore */ }
  try {
    const revs = await sql`SELECT name, review_6mo_date, review_6mo_status, review_1yr_date, review_1yr_status FROM employees` as any[];
    for (const e of revs) {
      for (const [date, status, type] of [[e.review_6mo_date, e.review_6mo_status, '6-month review'], [e.review_1yr_date, e.review_1yr_status, '1-year review']] as [string, string, string][]) {
        if (!date || status === 'Complete') continue;
        const days = daysUntil(date);
        if (days >= -7 && days <= 30) deadlines.push({ label: `${e.name} — ${type}`, date: String(date).slice(0, 10), days, kind: 'review' });
      }
    }
  } catch { /* ignore */ }
  deadlines.sort((a, b) => a.days - b.days);
  return {
    pendingCount: pendingCount ?? 0,
    doneCount: doneCount ?? 0,
    dueToday: dueToday ?? 0,
    ptoToday: ptoToday ?? 0,
    payrollDaysLeft,
    cutoffToday: nextPayroll?.cutoff === today,
    nextPayrollDate: nextPayroll?.run_date ?? null,
    empCount: empCount ?? 0,
    reviewsDone: reviewsDone ?? 0,
    onboarding,
    birthdays,
    anniversaries,
    deadlines: deadlines.slice(0, 8),
  };
}

export default async function DashboardPage() {
  const stats = await getStats();
  return (
    <ModuleLayout pendingTaskCount={stats.pendingCount}>
      <DashboardClient {...stats} />
    </ModuleLayout>
  );
}

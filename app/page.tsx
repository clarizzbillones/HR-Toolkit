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
  const payrollDaysLeft = nextPayroll
    ? Math.ceil((new Date(nextPayroll.run_date).getTime() - Date.now()) / 86400000)
    : null;
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

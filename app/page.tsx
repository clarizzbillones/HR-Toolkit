import { sql } from '@/lib/db';
import ModuleLayout from '@/components/ModuleLayout';
import DashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';

async function getStats() {
  const today = new Date().toISOString().slice(0, 10);
  const [{ n: pendingCount }] = await sql`SELECT COUNT(*)::int as n FROM tasks WHERE status != 'done'`;
  const [{ n: doneCount }] = await sql`SELECT COUNT(*)::int as n FROM tasks WHERE status = 'done'`;
  const [{ n: dueToday }] = await sql`SELECT COUNT(*)::int as n FROM tasks WHERE due_tag = 'Today' AND status != 'done'`;
  // ptoToday is fetched client-side from /api/pto/today (full merge logic)
  const ptoToday = 0;
  const [nextPayroll] = await sql`SELECT run_date, cutoff FROM payroll_periods WHERE run_date >= ${today} ORDER BY run_date ASC LIMIT 1`;
  const [{ n: empCount }] = await sql`SELECT COUNT(*)::int as n FROM employees`;
  const [{ n: reviewsDone }] = await sql`SELECT COUNT(*)::int as n FROM employees WHERE review_6mo_status = 'Complete'`;
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

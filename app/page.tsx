import { getDb } from '@/lib/db';
import ModuleLayout from '@/components/ModuleLayout';
import DashboardClient from './DashboardClient';

function getStats() {
  const db = getDb();

  const tasks = db.prepare('SELECT * FROM tasks').all() as any[];
  const pending = tasks.filter((t) => t.status !== 'done');
  const done = tasks.filter((t) => t.status === 'done');
  const todayStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const dueToday = pending.filter((t) => t.due_tag === 'Today').length;

  const today = new Date().toISOString().slice(0, 10);
  const ptoToday = (db.prepare(
    "SELECT COUNT(*) as n FROM pto_entries WHERE start_date <= ? AND end_date >= ? AND status = 'Approved'"
  ).get(today, today) as any).n;

  const nextPayroll = db
    .prepare("SELECT run_date, cutoff FROM payroll_periods WHERE run_date >= ? ORDER BY run_date ASC LIMIT 1")
    .get(today) as any;

  const empCount = (db.prepare('SELECT COUNT(*) as n FROM employees').get() as any).n;

  const reviewsDone = (db.prepare(
    "SELECT COUNT(*) as n FROM employees WHERE review_6mo_status = 'Complete'"
  ).get() as any).n;

  const payrollDaysLeft = nextPayroll
    ? Math.ceil((new Date(nextPayroll.run_date).getTime() - Date.now()) / 86400000)
    : null;

  const cutoffToday = nextPayroll?.cutoff === today;

  return {
    pendingCount: pending.length,
    doneCount: done.length,
    dueToday,
    ptoToday,
    payrollDaysLeft,
    cutoffToday,
    nextPayrollDate: nextPayroll?.run_date ?? null,
    empCount,
    reviewsDone,
  };
}

export default function DashboardPage() {
  const stats = getStats();

  return (
    <ModuleLayout pendingTaskCount={stats.pendingCount}>
      <DashboardClient {...stats} />
    </ModuleLayout>
  );
}

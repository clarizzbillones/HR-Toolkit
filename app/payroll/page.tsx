import { getDb } from '@/lib/db';
import ModuleLayout from '@/components/ModuleLayout';
import PayrollClient from './PayrollClient';

export const dynamic = 'force-dynamic';

export default function PayrollPage() {
  const db = getDb();
  const tasks = db.prepare("SELECT COUNT(*) as n FROM tasks WHERE status != 'done'").get() as any;
  const periods = db.prepare('SELECT * FROM payroll_periods ORDER BY run_date ASC').all();
  const settings = db.prepare("SELECT * FROM payroll_settings WHERE id='singleton'").get() ?? {
    id: 'singleton', cadence: 'Semi-monthly', reminder_toggles: '{"cutoff":true,"payrun":true,"timesheet":false}',
  };
  return (
    <ModuleLayout pendingTaskCount={tasks.n}>
      <PayrollClient initialPeriods={periods as any[]} initialSettings={settings as any} />
    </ModuleLayout>
  );
}

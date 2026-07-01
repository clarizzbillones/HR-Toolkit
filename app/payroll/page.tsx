import { sql } from '@/lib/db';
import ModuleLayout from '@/components/ModuleLayout';
import PayrollClient from './PayrollClient';

export const dynamic = 'force-dynamic';

export default async function PayrollPage() {
  const [{ n }] = await sql`SELECT COUNT(*)::int as n FROM tasks WHERE status NOT IN ('done', 'archived')`;
  const periods = await sql`SELECT * FROM payroll_periods ORDER BY run_date ASC`;
  const [settings] = await sql`SELECT * FROM payroll_settings WHERE id = 'singleton'`;
  const defaultSettings = { id: 'singleton', cadence: 'Semi-monthly', reminder_toggles: '{"cutoff":true,"payrun":true,"timesheet":false}' };
  return (
    <ModuleLayout pendingTaskCount={n ?? 0}>
      <PayrollClient initialPeriods={periods as any[]} initialSettings={(settings ?? defaultSettings) as any} />
    </ModuleLayout>
  );
}

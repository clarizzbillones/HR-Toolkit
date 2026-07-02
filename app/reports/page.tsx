import { sql } from '@/lib/db';
import ModuleLayout from '@/components/ModuleLayout';
import ReportsClient from './ReportsClient';

export const dynamic = 'force-dynamic';

// [date, payee, category, amount, note]
const CASHOUT_SEED: [string, string, string, number, string][] = [
  ['2026-06-01', 'ADP', 'Distribution', 30000.00, 'Zack distribution'],
  ['2026-06-03', 'ADP', 'Payroll', 31108.93, 'Weekly and Contractor payroll'],
  ['2026-06-03', 'Guideline', 'Guideline', 69.24, 'Weekly guideline contribution'],
  ['2026-06-09', 'ADP', 'Payroll', 4991.90, 'Weekly payroll'],
  ['2026-06-09', 'Guideline', 'Guideline', 69.24, 'Weekly guideline contribution'],
  ['2026-06-09', 'ADP', 'Payroll', 127007.44, "Litson semi-monthly payroll with Brent's bonus"],
  ['2026-06-09', 'ADP', 'Payroll', 1432.03, "Off-cycle payroll for Ke'Lynn"],
  ['2026-06-09', 'ADP', 'Payroll', 4806.37, 'HLG payroll'],
  ['2026-06-09', 'Guideline', 'Guideline', 5462.07, 'Guideline contribution'],
  ['2026-06-15', 'ADP', 'Payroll', 5535.84, 'Weekly payroll'],
  ['2026-06-16', 'Guideline', 'Guideline', 69.24, 'Weekly guideline contribution'],
  ['2026-06-23', 'ADP', 'Payroll', 5553.38, 'Weekly payroll'],
  ['2026-06-24', 'ADP', 'Payroll', 5221.09, 'HLG payroll'],
  ['2026-06-24', 'ADP', 'Payroll', 104433.81, 'Litson semi-monthly payroll with reimbursement'],
  ['2026-06-24', 'ADP', 'Distribution', 52356.36, "Monthly owner's draw"],
  ['2026-06-24', 'Guideline', 'Guideline', 5531.31, 'Guideline contribution'],
  ['2026-06-30', 'ADP', 'Payroll', 5469.84, 'Weekly payroll'],
  ['2026-06-30', 'ADP', 'Payroll', 2490.16, 'Contractor Payroll and Reimbursement'],
  ['2026-07-02', 'Guideline', 'Guideline', 69.24, 'Guideline contribution'],
];

export default async function ReportsPage() {
  const [{ n }] = await sql`SELECT COUNT(*)::int as n FROM tasks WHERE status NOT IN ('done', 'archived')`;

  // Ensure cash-out ledger has note/method columns, then seed the June/July run once
  await sql`CREATE TABLE IF NOT EXISTS cashout_ledger (
    id TEXT PRIMARY KEY, date TEXT NOT NULL, payee TEXT NOT NULL, category TEXT NOT NULL,
    amount REAL NOT NULL, status TEXT NOT NULL DEFAULT 'Paid', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`ALTER TABLE cashout_ledger ADD COLUMN IF NOT EXISTS note TEXT`;
  await sql`ALTER TABLE cashout_ledger ADD COLUMN IF NOT EXISTS method TEXT`;
  const [{ c }] = await sql`SELECT COUNT(*)::int AS c FROM cashout_ledger WHERE date = '2026-06-01' AND note = 'Zack distribution'`;
  if (!c) {
    for (const [date, payee, category, amount, note] of CASHOUT_SEED) {
      const id = `co${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
      await sql`INSERT INTO cashout_ledger (id, date, payee, category, amount, status, note, method)
        VALUES (${id}, ${date}, ${payee}, ${category}, ${amount}, 'Paid', ${note}, 'ACH')`;
    }
  }

  return (
    <ModuleLayout pendingTaskCount={n ?? 0}>
      <ReportsClient />
    </ModuleLayout>
  );
}

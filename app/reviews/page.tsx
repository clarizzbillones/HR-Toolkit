import { sql } from '@/lib/db';
import ModuleLayout from '@/components/ModuleLayout';
import ReviewsClient from './ReviewsClient';

export const dynamic = 'force-dynamic';

export default async function ReviewsPage() {
  const [{ n }] = await sql`SELECT COUNT(*)::int as n FROM tasks WHERE status != 'done'`;
  // Ensure review_6mo_date / review_1yr_date columns exist (idempotent)
  await sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS review_6mo_date TEXT`;
  await sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS review_1yr_date TEXT`;
  // Seed Caitlin if not present
  await sql`
    INSERT INTO employees (id, name, role, dept, hire_date, review_6mo_date, review_6mo_status)
    VALUES ('caitlin_toole_2026', 'Caitlin Toole', 'Director of Operations', 'Operations', '2026-01-02', '2026-07-02', 'Scheduled')
    ON CONFLICT (id) DO NOTHING
  `;
  const employees = await sql`SELECT * FROM employees ORDER BY name`;
  return (
    <ModuleLayout pendingTaskCount={n ?? 0}>
      <ReviewsClient initialEmployees={employees as any[]} />
    </ModuleLayout>
  );
}

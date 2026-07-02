import { sql } from '@/lib/db';
import ModuleLayout from '@/components/ModuleLayout';
import StaffingClient from './StaffingClient';

export const dynamic = 'force-dynamic';

export default async function StaffingPage() {
  const [{ n }] = await sql`SELECT COUNT(*)::int as n FROM tasks WHERE status NOT IN ('done', 'archived')`;
  await sql`CREATE TABLE IF NOT EXISTS staff_directory (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, position TEXT, dialpad TEXT, personal_phone TEXT, email TEXT,
    start_date TEXT, dob TEXT, favorite_color TEXT, favorite_treat TEXT, note TEXT, ktn TEXT, marriott TEXT,
    delta TEXT, weight TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  const rows = await sql`SELECT * FROM staff_directory ORDER BY name ASC`;
  return (
    <ModuleLayout pendingTaskCount={n ?? 0}>
      <StaffingClient initialRows={rows as any[]} />
    </ModuleLayout>
  );
}

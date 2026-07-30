import { sql } from '@/lib/db';
import ModuleLayout from '@/components/ModuleLayout';
import EmployeeFilesClient from './EmployeeFilesClient';

export const dynamic = 'force-dynamic';

export default async function EmployeeFilesPage() {
  const [{ n }] = await sql`SELECT COUNT(*)::int as n FROM tasks WHERE status NOT IN ('done', 'archived')`;
  await sql`CREATE TABLE IF NOT EXISTS employee_profiles (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, photo TEXT, position TEXT, department TEXT,
    email TEXT, phone TEXT, start_date TEXT, details TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS employee_files (
    id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, category TEXT, title TEXT, doc_date TEXT,
    summary TEXT, what_we_did TEXT, next_steps TEXT, author TEXT,
    attachment_name TEXT, attachment_data TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  const profiles = await sql`
    SELECT p.*, (SELECT COUNT(*)::int FROM employee_files f WHERE f.profile_id = p.id) AS doc_count
    FROM employee_profiles p ORDER BY p.name ASC`;
  return (
    <ModuleLayout pendingTaskCount={n ?? 0}>
      <EmployeeFilesClient initialProfiles={profiles as any[]} />
    </ModuleLayout>
  );
}

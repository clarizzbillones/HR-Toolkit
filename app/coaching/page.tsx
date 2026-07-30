import { sql } from '@/lib/db';
import ModuleLayout from '@/components/ModuleLayout';
import CoachingClient from './CoachingClient';

export const dynamic = 'force-dynamic';

export default async function CoachingPage() {
  const [{ n }] = await sql`SELECT COUNT(*)::int as n FROM tasks WHERE status NOT IN ('done', 'archived')`;
  await sql`CREATE TABLE IF NOT EXISTS coaching_notes (
    id TEXT PRIMARY KEY, employee TEXT, date TEXT, topic TEXT, notes TEXT,
    action_items TEXT, follow_up_date TEXT, status TEXT DEFAULT 'Open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  const rows = await sql`SELECT * FROM coaching_notes ORDER BY date DESC NULLS LAST, created_at DESC`;
  let names: string[] = [];
  try {
    const staff = await sql`SELECT name FROM staff_directory ORDER BY name ASC`;
    names = (staff as any[]).map(s => s.name).filter(Boolean);
  } catch { /* table may not exist yet */ }
  return (
    <ModuleLayout pendingTaskCount={n ?? 0}>
      <CoachingClient initialRows={rows as any[]} names={names} />
    </ModuleLayout>
  );
}

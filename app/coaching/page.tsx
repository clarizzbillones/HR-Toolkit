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
  let staff: { name: string; position: string; email: string }[] = [];
  try {
    const s = await sql`SELECT name, position, email FROM staff_directory ORDER BY name ASC`;
    staff = (s as any[]).map(r => ({ name: r.name ?? '', position: r.position ?? '', email: r.email ?? '' })).filter(r => r.name);
  } catch { /* table may not exist yet */ }
  return (
    <ModuleLayout pendingTaskCount={n ?? 0}>
      <CoachingClient initialRows={(rows as any[]).map(r => ({ ...r, sign_token: r.sign_token ? true : null }))} staff={staff} />
    </ModuleLayout>
  );
}

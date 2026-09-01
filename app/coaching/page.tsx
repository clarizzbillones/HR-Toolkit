import { sql } from '@/lib/db';
import ModuleLayout from '@/components/ModuleLayout';
import CoachingModule from './CoachingModule';
import { parseGoals, parseItems, parseCheckins } from '@/lib/smartGoals';

export const dynamic = 'force-dynamic';

export default async function CoachingPage() {
  const [{ n }] = await sql`SELECT COUNT(*)::int as n FROM tasks WHERE status NOT IN ('done', 'archived')`;
  await sql`CREATE TABLE IF NOT EXISTS coaching_notes (
    id TEXT PRIMARY KEY, employee TEXT, date TEXT, topic TEXT, notes TEXT,
    action_items TEXT, follow_up_date TEXT, status TEXT DEFAULT 'Open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS smart_goals (
    id TEXT PRIMARY KEY, employee TEXT, employee_email TEXT, reviewer TEXT, reviewer_position TEXT,
    review_date TEXT, goals_prepared TEXT, milestones TEXT, goals TEXT, open_items TEXT,
    status TEXT DEFAULT 'Draft', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`ALTER TABLE smart_goals ADD COLUMN IF NOT EXISTS checkins TEXT`;
  const rows = await sql`SELECT * FROM coaching_notes ORDER BY date DESC NULLS LAST, created_at DESC`;
  const smart = await sql`SELECT * FROM smart_goals ORDER BY review_date DESC NULLS LAST, created_at DESC` as any[];
  let staff: { name: string; position: string; email: string }[] = [];
  try {
    const s = await sql`SELECT name, position, email FROM staff_directory ORDER BY name ASC`;
    staff = (s as any[]).map(r => ({ name: r.name ?? '', position: r.position ?? '', email: r.email ?? '' })).filter(r => r.name);
  } catch { /* table may not exist yet */ }
  return (
    <ModuleLayout pendingTaskCount={n ?? 0}>
      <CoachingModule
        coachingRows={(rows as any[]).map(r => ({ ...r, sign_token: r.sign_token ? true : null }))}
        smartRows={smart.map(r => ({ ...r, goals: parseGoals(r.goals), open_items: parseItems(r.open_items), checkins: parseCheckins(r.checkins) }))}
        staff={staff}
      />
    </ModuleLayout>
  );
}

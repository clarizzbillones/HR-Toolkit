import { sql } from '@/lib/db';
import ModuleLayout from '@/components/ModuleLayout';
import SmartGoalsClient from './SmartGoalsClient';
import { parseGoals, parseItems } from '@/lib/smartGoals';

export const dynamic = 'force-dynamic';

export default async function SmartGoalsPage() {
  const [{ n }] = await sql`SELECT COUNT(*)::int as n FROM tasks WHERE status NOT IN ('done', 'archived')`;
  await sql`CREATE TABLE IF NOT EXISTS smart_goals (
    id TEXT PRIMARY KEY, employee TEXT, employee_email TEXT, reviewer TEXT, reviewer_position TEXT,
    review_date TEXT, goals_prepared TEXT, milestones TEXT, goals TEXT, open_items TEXT,
    status TEXT DEFAULT 'Draft', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  const rows = await sql`SELECT * FROM smart_goals ORDER BY review_date DESC NULLS LAST, created_at DESC` as any[];
  let staff: { name: string; position: string; email: string }[] = [];
  try {
    const s = await sql`SELECT name, position, email FROM staff_directory ORDER BY name ASC` as any[];
    staff = s.map(r => ({ name: r.name ?? '', position: r.position ?? '', email: r.email ?? '' })).filter(r => r.name);
  } catch { /* table may not exist yet */ }
  return (
    <ModuleLayout pendingTaskCount={n ?? 0}>
      <SmartGoalsClient initialRows={rows.map(r => ({ ...r, goals: parseGoals(r.goals), open_items: parseItems(r.open_items) }))} staff={staff} />
    </ModuleLayout>
  );
}

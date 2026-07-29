export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { sql, cuid } from '@/lib/db';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const statusFilter = url.searchParams.get('status');
  const eodDate = url.searchParams.get('eodDate');
  const todayCST = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });

  // Ensure columns exist (idempotent)
  await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_date TEXT`;
  await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS urgent BOOLEAN DEFAULT false`;

  // Backfill: existing done tasks with no completed_date get today's date
  await sql`UPDATE tasks SET completed_date = ${todayCST} WHERE status = 'done' AND completed_date IS NULL`;

  // Auto-archive done tasks completed on a previous day
  await sql`UPDATE tasks SET status = 'archived' WHERE status = 'done' AND completed_date < ${todayCST}`;

  if (eodDate) {
    // EOD report: tasks completed on that date + currently pending (non-archived)
    const tasks = await sql`
      SELECT * FROM tasks
      WHERE (completed_date = ${eodDate} AND status IN ('done', 'archived'))
         OR status NOT IN ('done', 'archived')
      ORDER BY created_at DESC
    `;
    return NextResponse.json({ tasks });
  }

  if (statusFilter === 'archived') {
    const tasks = await sql`SELECT * FROM tasks WHERE status = 'archived' ORDER BY completed_date DESC, created_at DESC`;
    return NextResponse.json({ tasks });
  }

  const tasks = await sql`SELECT * FROM tasks WHERE status != 'archived' ORDER BY created_at DESC`;
  return NextResponse.json({ tasks });
}

export async function POST(req: Request) {
  const { title, sub, dueTag, urgent } = await req.json();
  if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 });
  await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS urgent BOOLEAN DEFAULT false`;
  const id = cuid();
  const now = new Date().toISOString();
  await sql`INSERT INTO tasks (id,title,sub,due_tag,urgent,status,status_history,notes) VALUES (${id},${title.trim()},${sub ?? null},${dueTag ?? null},${!!urgent},'todo',${JSON.stringify([{ status: 'todo', timestamp: now }])},'[]')`;
  const [task] = await sql`SELECT * FROM tasks WHERE id = ${id}`;
  return NextResponse.json({ task }, { status: 201 });
}

export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql, cuid } from '@/lib/db';
import { parseGoals, parseItems, parseCheckins } from '@/lib/smartGoals';
import { syncSmartGoalsToEmployeeFile } from '@/lib/employeeFiles';

async function ensure() {
  await sql`CREATE TABLE IF NOT EXISTS smart_goals (
    id TEXT PRIMARY KEY, employee TEXT, employee_email TEXT, reviewer TEXT, reviewer_position TEXT,
    review_date TEXT, goals_prepared TEXT, milestones TEXT, goals TEXT, open_items TEXT,
    status TEXT DEFAULT 'Draft', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`ALTER TABLE smart_goals ADD COLUMN IF NOT EXISTS checkins TEXT`;
}
const auth = async () => !!(await getServerSession(authOptions))?.user;

function parse(r: any) { return { ...r, goals: parseGoals(r.goals), open_items: parseItems(r.open_items), checkins: parseCheckins(r.checkins) }; }

export async function GET() {
  if (!(await auth())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const rows = await sql`SELECT * FROM smart_goals ORDER BY review_date DESC NULLS LAST, created_at DESC` as any[];
  return NextResponse.json({ rows: rows.map(parse) });
}

const cols = ['employee', 'employee_email', 'reviewer', 'reviewer_position', 'review_date', 'goals_prepared', 'milestones'] as const;

export async function POST(req: Request) {
  if (!(await auth())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const b = await req.json();
  const id = cuid();
  await sql`INSERT INTO smart_goals (id, employee, employee_email, reviewer, reviewer_position, review_date, goals_prepared, milestones, goals, open_items, checkins, status)
    VALUES (${id}, ${b.employee ?? ''}, ${b.employee_email ?? ''}, ${b.reviewer ?? ''}, ${b.reviewer_position ?? ''}, ${b.review_date ?? null}, ${b.goals_prepared ?? null}, ${b.milestones ?? ''}, ${JSON.stringify(b.goals ?? [])}, ${JSON.stringify(b.open_items ?? [])}, ${JSON.stringify(b.checkins ?? [])}, ${b.status ?? 'Draft'})`;
  const [row] = await sql`SELECT * FROM smart_goals WHERE id = ${id}` as any[];
  const parsed = parse(row);
  await syncSmartGoalsToEmployeeFile(parsed); // file to the employee's Employee File
  return NextResponse.json({ row: parsed }, { status: 201 });
}

export async function PATCH(req: Request) {
  if (!(await auth())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const b = await req.json();
  if (!b.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  for (const c of cols) if (c in b) await sql`UPDATE smart_goals SET ${sql(c)} = ${b[c] ?? null} WHERE id = ${b.id}`;
  if ('goals' in b) await sql`UPDATE smart_goals SET goals = ${JSON.stringify(b.goals ?? [])} WHERE id = ${b.id}`;
  if ('open_items' in b) await sql`UPDATE smart_goals SET open_items = ${JSON.stringify(b.open_items ?? [])} WHERE id = ${b.id}`;
  if ('checkins' in b) await sql`UPDATE smart_goals SET checkins = ${JSON.stringify(b.checkins ?? [])} WHERE id = ${b.id}`;
  if ('status' in b) await sql`UPDATE smart_goals SET status = ${b.status ?? 'Draft'} WHERE id = ${b.id}`;
  const [row] = await sql`SELECT * FROM smart_goals WHERE id = ${b.id}` as any[];
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const parsed = parse(row);
  await syncSmartGoalsToEmployeeFile(parsed); // keep the Employee File copy current
  return NextResponse.json({ row: parsed });
}

export async function DELETE(req: Request) {
  if (!(await auth())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  await sql`DELETE FROM smart_goals WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}

export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql, cuid } from '@/lib/db';

// Offboarding tracker: one record per departing employee with a checklist state
// (item id -> boolean) drawn from lib/offboarding.ts.
async function ensure() {
  await sql`CREATE TABLE IF NOT EXISTS offboarding (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, position TEXT, manager TEXT,
    separation_date TEXT, separation_type TEXT, prepared_by TEXT,
    checklist TEXT, notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
}
function parse(row: any) {
  let checklist: Record<string, boolean> = {};
  try { const c = typeof row.checklist === 'string' ? JSON.parse(row.checklist) : row.checklist; if (c && typeof c === 'object') checklist = c; } catch { /* ignore */ }
  return { ...row, checklist };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const rows = await sql`SELECT * FROM offboarding ORDER BY separation_date DESC NULLS LAST, created_at DESC` as any[];
  let employees: any[] = [];
  try { employees = await sql`SELECT name, position FROM staff_directory ORDER BY name ASC` as any[]; } catch { /* no table */ }
  return NextResponse.json({ rows: rows.map(parse), employees });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const b = await req.json();
  if (!b.name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });
  const id = cuid();
  await sql`INSERT INTO offboarding (id, name, position, manager, separation_date, separation_type, prepared_by, checklist, notes)
    VALUES (${id}, ${b.name.trim()}, ${b.position ?? null}, ${b.manager ?? null}, ${b.separation_date ?? null}, ${b.separation_type ?? null}, ${b.prepared_by ?? null}, ${'{}'}, ${b.notes ?? null})`;
  const [row] = await sql`SELECT * FROM offboarding WHERE id = ${id}`;
  return NextResponse.json({ row: parse(row) }, { status: 201 });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const b = await req.json();
  if (!b.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const updates: Record<string, any> = {};
  for (const k of ['name', 'position', 'manager', 'separation_date', 'separation_type', 'prepared_by', 'notes'] as const) {
    if (k in b) updates[k] = b[k] ?? null;
  }
  if (b.checklist && typeof b.checklist === 'object') updates.checklist = JSON.stringify(b.checklist);
  if (!Object.keys(updates).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  await sql`UPDATE offboarding SET ${sql(updates)} WHERE id = ${b.id}`;
  const [row] = await sql`SELECT * FROM offboarding WHERE id = ${b.id}` as any[];
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ row: parse(row) });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  await sql`DELETE FROM offboarding WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}

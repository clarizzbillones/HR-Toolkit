export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql, cuid } from '@/lib/db';
import { defaultExcluded } from '@/lib/offboarding';

// Offboarding tracker: one record per departing employee with a checklist state
// (item id -> boolean) drawn from lib/offboarding.ts.
async function ensure() {
  await sql`CREATE TABLE IF NOT EXISTS offboarding (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, position TEXT, manager TEXT,
    separation_date TEXT, separation_type TEXT, prepared_by TEXT,
    checklist TEXT, notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`ALTER TABLE offboarding ADD COLUMN IF NOT EXISTS dob TEXT`;
  await sql`ALTER TABLE offboarding ADD COLUMN IF NOT EXISTS hire_date TEXT`;
  await sql`ALTER TABLE offboarding ADD COLUMN IF NOT EXISTS offer_severance BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`ALTER TABLE offboarding ADD COLUMN IF NOT EXISTS excluded TEXT`;
}
function parseMap(v: any): Record<string, boolean> {
  try { const c = typeof v === 'string' ? JSON.parse(v) : v; if (c && typeof c === 'object') return c; } catch { /* ignore */ }
  return {};
}
function parse(row: any) {
  return { ...row, checklist: parseMap(row.checklist), excluded: parseMap(row.excluded), offer_severance: !!row.offer_severance };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const rows = await sql`SELECT * FROM offboarding ORDER BY separation_date DESC NULLS LAST, created_at DESC` as any[];
  let employees: any[] = [];
  try { employees = await sql`SELECT name, position, dob, start_date FROM staff_directory ORDER BY name ASC` as any[]; } catch { /* no table */ }
  return NextResponse.json({ rows: rows.map(parse), employees });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const b = await req.json();
  if (!b.name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });
  const id = cuid();
  // Pre-mark the age-40 steps N/A when the employee is under 40 at separation.
  const excluded = defaultExcluded(b.dob, b.separation_date);
  await sql`INSERT INTO offboarding (id, name, position, manager, separation_date, separation_type, prepared_by, checklist, notes, dob, hire_date, offer_severance, excluded)
    VALUES (${id}, ${b.name.trim()}, ${b.position ?? null}, ${b.manager ?? null}, ${b.separation_date ?? null}, ${b.separation_type ?? null}, ${b.prepared_by ?? null}, ${'{}'}, ${b.notes ?? null}, ${b.dob ?? null}, ${b.hire_date ?? null}, ${!!b.offer_severance}, ${JSON.stringify(excluded)})`;
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
  for (const k of ['name', 'position', 'manager', 'separation_date', 'separation_type', 'prepared_by', 'notes', 'dob', 'hire_date'] as const) {
    if (k in b) updates[k] = b[k] ?? null;
  }
  if (typeof b.offer_severance === 'boolean') updates.offer_severance = b.offer_severance;
  if (b.checklist && typeof b.checklist === 'object') updates.checklist = JSON.stringify(b.checklist);
  if (b.excluded && typeof b.excluded === 'object') updates.excluded = JSON.stringify(b.excluded);
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

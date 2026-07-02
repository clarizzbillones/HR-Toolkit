export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

const FIELDS = ['name','worker_type','position','dialpad','personal_phone','email','start_date','dob','favorite_color','favorite_treat','note','ktn','marriott','delta','southwest','weight'] as const;

async function ensureTable() {
  await sql`CREATE TABLE IF NOT EXISTS staff_directory (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    position TEXT,
    dialpad TEXT,
    personal_phone TEXT,
    email TEXT,
    start_date TEXT,
    dob TEXT,
    favorite_color TEXT,
    favorite_treat TEXT,
    note TEXT,
    ktn TEXT,
    marriott TEXT,
    delta TEXT,
    weight TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`ALTER TABLE staff_directory ADD COLUMN IF NOT EXISTS southwest TEXT`;
  await sql`ALTER TABLE staff_directory ADD COLUMN IF NOT EXISTS worker_type TEXT`;
}

function rid() { return `st${Date.now()}${Math.random().toString(36).slice(2, 7)}`; }

export async function GET() {
  await ensureTable();
  const rows = await sql`SELECT * FROM staff_directory ORDER BY name ASC`;
  return NextResponse.json({ rows });
}

export async function POST(req: Request) {
  await ensureTable();
  const body = await req.json();
  const incoming: any[] = Array.isArray(body.rows) ? body.rows : [body];
  const clean = incoming.filter(r => (r.name ?? '').toString().trim());
  if (!clean.length) return NextResponse.json({ error: 'No rows with a name' }, { status: 400 });
  if (body.replace) await sql`DELETE FROM staff_directory`;
  for (const r of clean) {
    const v = Object.fromEntries(FIELDS.map(f => [f, r[f] != null && r[f] !== '' ? String(r[f]) : null]));
    await sql`INSERT INTO staff_directory (id,name,worker_type,position,dialpad,personal_phone,email,start_date,dob,favorite_color,favorite_treat,note,ktn,marriott,delta,southwest,weight)
      VALUES (${rid()},${v.name},${v.worker_type ?? 'Employee'},${v.position},${v.dialpad},${v.personal_phone},${v.email},${v.start_date},${v.dob},${v.favorite_color},${v.favorite_treat},${v.note},${v.ktn},${v.marriott},${v.delta},${v.southwest},${v.weight})`;
  }
  const rows = await sql`SELECT * FROM staff_directory ORDER BY name ASC`;
  return NextResponse.json({ rows, inserted: clean.length });
}

export async function PATCH(req: Request) {
  await ensureTable();
  const body = await req.json();
  const { id } = body;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const sets = FIELDS.filter(f => f in body);
  if (!sets.length) return NextResponse.json({ error: 'No fields' }, { status: 400 });
  const updates = Object.fromEntries(sets.map(f => [f, body[f] === '' ? null : body[f]]));
  await sql`UPDATE staff_directory SET ${sql(updates)} WHERE id = ${id}`;
  const [row] = await sql`SELECT * FROM staff_directory WHERE id = ${id}`;
  return NextResponse.json({ row });
}

export async function DELETE(req: Request) {
  await ensureTable();
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  await sql`DELETE FROM staff_directory WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}

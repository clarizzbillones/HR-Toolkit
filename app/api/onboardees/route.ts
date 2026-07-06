export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { sql, cuid } from '@/lib/db';

async function ensureTable() {
  await sql`CREATE TABLE IF NOT EXISTS onboardees (
    id text PRIMARY KEY,
    name text NOT NULL,
    email text, position text, worker_type text DEFAULT 'Employee',
    guide text DEFAULT 'General', start_date text, dob text, phone text,
    status text DEFAULT 'In Progress', progress text DEFAULT '{}',
    created_at timestamptz DEFAULT now()
  )`;
}

// Make sure the Staffing directory can receive a completed onboardee
async function ensureStaff() {
  await sql`CREATE TABLE IF NOT EXISTS staff_directory (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, position TEXT, dialpad TEXT, personal_phone TEXT, email TEXT,
    start_date TEXT, dob TEXT, favorite_color TEXT, favorite_treat TEXT, note TEXT, ktn TEXT, marriott TEXT,
    delta TEXT, weight TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  for (const c of ['southwest', 'american', 'worker_type'])
    await sql`ALTER TABLE staff_directory ADD COLUMN IF NOT EXISTS ${sql(c)} TEXT`;
}

export async function GET() {
  await ensureTable();
  const rows = await sql`SELECT * FROM onboardees ORDER BY created_at DESC`;
  return NextResponse.json({ rows });
}

export async function POST(req: Request) {
  await ensureTable();
  const b = await req.json();
  if (!b.name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });
  const id = cuid();
  await sql`INSERT INTO onboardees (id, name, email, position, worker_type, guide, start_date, dob, phone, status, progress)
    VALUES (${id}, ${b.name}, ${b.email ?? null}, ${b.position ?? null}, ${b.worker_type ?? 'Employee'}, ${b.guide ?? 'General'}, ${b.start_date ?? null}, ${b.dob ?? null}, ${b.phone ?? null}, 'In Progress', '{}')`;
  const [row] = await sql`SELECT * FROM onboardees WHERE id = ${id}`;
  return NextResponse.json({ row }, { status: 201 });
}

export async function PATCH(req: Request) {
  await ensureTable();
  const { id, complete, progress, ...f } = await req.json();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  if (progress !== undefined) await sql`UPDATE onboardees SET progress = ${JSON.stringify(progress)} WHERE id = ${id}`;
  for (const k of ['name', 'email', 'position', 'worker_type', 'guide', 'start_date', 'dob', 'phone', 'status'] as const) {
    if (f[k] !== undefined) await sql`UPDATE onboardees SET ${sql(k)} = ${f[k]} WHERE id = ${id}`;
  }
  // On completion, push the person into the Staffing directory
  if (complete) {
    const [p] = await sql`SELECT * FROM onboardees WHERE id = ${id}`;
    await sql`UPDATE onboardees SET status = 'Complete' WHERE id = ${id}`;
    if (p) {
      await ensureStaff();
      const exists = await sql`SELECT id FROM staff_directory WHERE lower(name) = lower(${p.name}) LIMIT 1`;
      if (!exists.length) {
        await sql`INSERT INTO staff_directory (id, name, position, email, personal_phone, start_date, dob, worker_type)
          VALUES (${cuid()}, ${p.name}, ${p.position ?? null}, ${p.email ?? null}, ${p.phone ?? null}, ${p.start_date ?? null}, ${p.dob ?? null}, ${p.worker_type ?? 'Employee'})`;
      }
    }
    const [row] = await sql`SELECT * FROM onboardees WHERE id = ${id}`;
    return NextResponse.json({ row, staffed: true });
  }
  const [row] = await sql`SELECT * FROM onboardees WHERE id = ${id}`;
  return NextResponse.json({ row });
}

export async function DELETE(req: Request) {
  await ensureTable();
  const { id } = await req.json();
  await sql`DELETE FROM onboardees WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}

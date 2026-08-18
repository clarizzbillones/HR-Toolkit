export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { staffToProfile } from '@/lib/employeeProfile';

// Mirror a Staffing row's shared fields (email, phone, position, start date,
// DOB, travel/personal columns, name) into the matching Employee File profile,
// so an edit in Staffing shows up in Employee Files. Matched by name (the same
// key Employee Files uses); updates an existing profile only — never creates
// one. Best-effort: a sync failure never blocks the Staffing save.
async function syncProfileFromStaff(oldName: string | null, staffRow: any) {
  try {
    const matchName = String(oldName || staffRow?.name || '').trim();
    if (!matchName) return;
    const [prof] = await sql`SELECT id FROM employee_profiles WHERE lower(name) = ${matchName.toLowerCase()} LIMIT 1` as any[];
    if (!prof) return; // no Employee File yet — nothing to mirror into
    const updates: Record<string, any> = { ...staffToProfile(staffRow), name: staffRow.name };
    await sql`UPDATE employee_profiles SET ${sql(updates)} WHERE id = ${prof.id}`;
  } catch { /* best-effort */ }
}

const FIELDS = ['name','worker_type','position','dialpad','personal_phone','email','address','start_date','dob','favorite_color','favorite_treat','note','ktn','marriott','delta','southwest','american','weight','extra'] as const;

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
  await sql`ALTER TABLE staff_directory ADD COLUMN IF NOT EXISTS american TEXT`;
  await sql`ALTER TABLE staff_directory ADD COLUMN IF NOT EXISTS extra TEXT`;
  await sql`ALTER TABLE staff_directory ADD COLUMN IF NOT EXISTS offboarded BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`ALTER TABLE staff_directory ADD COLUMN IF NOT EXISTS offboarded_date TEXT`;
  await sql`ALTER TABLE staff_directory ADD COLUMN IF NOT EXISTS address TEXT`;
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
    await sql`INSERT INTO staff_directory (id,name,worker_type,position,dialpad,personal_phone,email,address,start_date,dob,favorite_color,favorite_treat,note,ktn,marriott,delta,southwest,american,weight,extra)
      VALUES (${rid()},${v.name},${v.worker_type ?? 'Employee'},${v.position},${v.dialpad},${v.personal_phone},${v.email},${v.address},${v.start_date},${v.dob},${v.favorite_color},${v.favorite_treat},${v.note},${v.ktn},${v.marriott},${v.delta},${v.southwest},${v.american},${v.weight},${v.extra})`;
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
  // Capture the current name first so a name change still matches the profile.
  const [prev] = await sql`SELECT name FROM staff_directory WHERE id = ${id}` as any[];
  const updates = Object.fromEntries(sets.map(f => [f, body[f] === '' ? null : body[f]]));
  await sql`UPDATE staff_directory SET ${sql(updates)} WHERE id = ${id}`;
  const [row] = await sql`SELECT * FROM staff_directory WHERE id = ${id}`;
  await syncProfileFromStaff(prev?.name ?? null, row);
  return NextResponse.json({ row });
}

export async function DELETE(req: Request) {
  await ensureTable();
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  await sql`DELETE FROM staff_directory WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}

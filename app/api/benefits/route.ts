export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql, cuid } from '@/lib/db';
import { BENEFITS } from '@/lib/benefits';

// Benefits enrollment: one row per (employee, benefit). Matched to Staffing /
// Employee Files by normalized name so the Insurance roster and each Employee
// File show the same elections.
async function ensure() {
  await sql`CREATE TABLE IF NOT EXISTS benefit_enrollments (
    id TEXT PRIMARY KEY,
    person_name TEXT NOT NULL,
    benefit TEXT NOT NULL,
    status TEXT,
    enrolled_date TEXT,
    plan TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  // One election per person+benefit (case/space-insensitive on the name).
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS benefit_enr_person_benefit
    ON benefit_enrollments (lower(btrim(person_name)), benefit)`;
}

const key = (s: any) => String(s ?? '').trim().toLowerCase();

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const name = new URL(req.url).searchParams.get('name');

  if (name) {
    // One person's elections (for their Employee File).
    const rows = await sql`SELECT * FROM benefit_enrollments WHERE lower(btrim(person_name)) = ${key(name)} ORDER BY benefit` as any[];
    return NextResponse.json({ enrollments: rows });
  }

  // Firm-wide roster: every enrollment + the active-employee list to seed rows.
  const enrollments = await sql`SELECT * FROM benefit_enrollments ORDER BY lower(person_name), benefit` as any[];
  let employees: { name: string; position: string | null }[] = [];
  try { employees = await sql`SELECT name, position FROM staff_directory ORDER BY name ASC` as any[]; } catch { /* no table */ }
  return NextResponse.json({ enrollments, employees, benefits: BENEFITS });
}

// Upsert one election (person + benefit). Also used to clear a cell.
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const b = await req.json();
  const personName = String(b.person_name ?? b.name ?? '').trim();
  const benefit = String(b.benefit ?? '').trim();
  if (!personName || !benefit) return NextResponse.json({ error: 'Missing person or benefit' }, { status: 400 });

  const status = String(b.status ?? '').trim();
  const enrolled_date = String(b.enrolled_date ?? '').trim();
  const plan = String(b.plan ?? '').trim();
  const notes = String(b.notes ?? '').trim();

  const [existing] = await sql`SELECT id FROM benefit_enrollments
    WHERE lower(btrim(person_name)) = ${key(personName)} AND benefit = ${benefit}` as any[];

  if (existing) {
    await sql`UPDATE benefit_enrollments
      SET person_name = ${personName}, status = ${status}, enrolled_date = ${enrolled_date}, plan = ${plan}, notes = ${notes}
      WHERE id = ${existing.id}`;
    const [row] = await sql`SELECT * FROM benefit_enrollments WHERE id = ${existing.id}` as any[];
    return NextResponse.json({ row });
  }
  const id = cuid();
  await sql`INSERT INTO benefit_enrollments (id, person_name, benefit, status, enrolled_date, plan, notes)
    VALUES (${id}, ${personName}, ${benefit}, ${status}, ${enrolled_date}, ${plan}, ${notes})`;
  const [row] = await sql`SELECT * FROM benefit_enrollments WHERE id = ${id}` as any[];
  return NextResponse.json({ row }, { status: 201 });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const b = await req.json().catch(() => ({}));
  const personName = String(b.person_name ?? b.name ?? '').trim();
  const benefit = String(b.benefit ?? '').trim();
  if (!personName || !benefit) return NextResponse.json({ error: 'Missing person or benefit' }, { status: 400 });
  await sql`DELETE FROM benefit_enrollments WHERE lower(btrim(person_name)) = ${key(personName)} AND benefit = ${benefit}`;
  return NextResponse.json({ ok: true });
}

export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

const FIELDS = ['entity', 'name', 'phone', 'email', 'website', 'notes'] as const;

async function ensureTable() {
  await sql`CREATE TABLE IF NOT EXISTS vendor_contacts (
    id TEXT PRIMARY KEY,
    entity TEXT,
    name TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
}

function rid() { return `vn${Date.now()}${Math.random().toString(36).slice(2, 7)}`; }

export async function GET() {
  await ensureTable();
  const rows = await sql`SELECT * FROM vendor_contacts ORDER BY entity ASC, name ASC`;
  return NextResponse.json({ rows });
}

export async function POST(req: Request) {
  await ensureTable();
  const body = await req.json();
  const incoming: any[] = Array.isArray(body.rows) ? body.rows : [body];
  const clean = incoming.filter(r => (r.entity ?? '').toString().trim() || (r.name ?? '').toString().trim());
  if (!clean.length) return NextResponse.json({ error: 'No rows' }, { status: 400 });
  if (body.replace) await sql`DELETE FROM vendor_contacts`;
  for (const r of clean) {
    const v = Object.fromEntries(FIELDS.map(f => [f, r[f] != null && r[f] !== '' ? String(r[f]).trim() : null]));
    await sql`INSERT INTO vendor_contacts (id,entity,name,phone,email,website,notes)
      VALUES (${rid()},${v.entity},${v.name},${v.phone},${v.email},${v.website},${v.notes})`;
  }
  const rows = await sql`SELECT * FROM vendor_contacts ORDER BY entity ASC, name ASC`;
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
  await sql`UPDATE vendor_contacts SET ${sql(updates)} WHERE id = ${id}`;
  const [row] = await sql`SELECT * FROM vendor_contacts WHERE id = ${id}`;
  return NextResponse.json({ row });
}

export async function DELETE(req: Request) {
  await ensureTable();
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  await sql`DELETE FROM vendor_contacts WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}

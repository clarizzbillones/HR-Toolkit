export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { sql, cuid } from '@/lib/db';

// Coaching / 1-on-1 notes per employee: a session date, topic, notes, action
// items, an optional follow-up date, and an open/done status.
async function ensure() {
  await sql`CREATE TABLE IF NOT EXISTS coaching_notes (
    id TEXT PRIMARY KEY,
    employee TEXT,
    date TEXT,
    topic TEXT,
    notes TEXT,
    action_items TEXT,
    follow_up_date TEXT,
    status TEXT DEFAULT 'Open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
}

export async function GET() {
  await ensure();
  const rows = await sql`SELECT * FROM coaching_notes ORDER BY date DESC NULLS LAST, created_at DESC`;
  return NextResponse.json({ rows });
}

export async function POST(req: Request) {
  await ensure();
  const b = await req.json();
  const id = cuid();
  await sql`INSERT INTO coaching_notes (id, employee, date, topic, notes, action_items, follow_up_date, status)
    VALUES (${id}, ${b.employee ?? ''}, ${b.date ?? null}, ${b.topic ?? ''}, ${b.notes ?? ''}, ${b.action_items ?? ''}, ${b.follow_up_date ?? null}, ${b.status ?? 'Open'})`;
  const [row] = await sql`SELECT * FROM coaching_notes WHERE id = ${id}`;
  return NextResponse.json({ row }, { status: 201 });
}

export async function PATCH(req: Request) {
  await ensure();
  const b = await req.json();
  if (!b.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  await sql`
    UPDATE coaching_notes SET
      employee = ${b.employee ?? ''},
      date = ${b.date ?? null},
      topic = ${b.topic ?? ''},
      notes = ${b.notes ?? ''},
      action_items = ${b.action_items ?? ''},
      follow_up_date = ${b.follow_up_date ?? null},
      status = ${b.status ?? 'Open'}
    WHERE id = ${b.id}`;
  const [row] = await sql`SELECT * FROM coaching_notes WHERE id = ${b.id}`;
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ row });
}

export async function DELETE(req: Request) {
  await ensure();
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  await sql`DELETE FROM coaching_notes WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql, cuid } from '@/lib/db';

// Water-delivery tracker: schedule deliveries per supplier and mark each as
// Scheduled / Pending / Delivered / Missed, with free-form notes.
async function ensure() {
  await sql`CREATE TABLE IF NOT EXISTS water_deliveries (
    id TEXT PRIMARY KEY, supplier TEXT, scheduled_date TEXT, delivered_date TEXT,
    status TEXT DEFAULT 'Scheduled', quantity TEXT, notes TEXT,
    sort_order INT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
}
const FIELDS = ['supplier', 'scheduled_date', 'delivered_date', 'status', 'quantity', 'notes', 'sort_order'] as const;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const rows = await sql`SELECT * FROM water_deliveries ORDER BY scheduled_date ASC NULLS LAST, sort_order ASC, created_at ASC`;
  return NextResponse.json({ rows });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const b = await req.json();
  const id = cuid();
  await sql`INSERT INTO water_deliveries (id, supplier, scheduled_date, delivered_date, status, quantity, notes, sort_order)
    VALUES (${id}, ${b.supplier ?? ''}, ${b.scheduled_date ?? null}, ${b.delivered_date ?? null}, ${b.status ?? 'Scheduled'}, ${b.quantity ?? ''}, ${b.notes ?? ''}, ${b.sort_order ?? Date.now()})`;
  const [row] = await sql`SELECT * FROM water_deliveries WHERE id = ${id}` as any[];
  return NextResponse.json({ row }, { status: 201 });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const { id, ...f } = await req.json();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  for (const k of FIELDS) {
    if (f[k] !== undefined) await sql`UPDATE water_deliveries SET ${sql(k)} = ${f[k] === '' ? null : f[k]} WHERE id = ${id}`;
  }
  const [row] = await sql`SELECT * FROM water_deliveries WHERE id = ${id}` as any[];
  return NextResponse.json({ row });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  await sql`DELETE FROM water_deliveries WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}

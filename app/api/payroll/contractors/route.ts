export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { sql, cuid } from '@/lib/db';

async function ensureTable() {
  await sql`CREATE TABLE IF NOT EXISTS contractor_payments (
    id text PRIMARY KEY,
    contractor text NOT NULL,
    amount text NOT NULL,
    pay_date text NOT NULL,
    method text NOT NULL DEFAULT 'ACH',
    status text NOT NULL DEFAULT 'Pending',
    notes text,
    created_at timestamptz DEFAULT now()
  )`;
}

export async function GET() {
  await ensureTable();
  const rows = await sql`SELECT * FROM contractor_payments ORDER BY pay_date DESC`;
  return NextResponse.json({ rows });
}

export async function POST(req: Request) {
  await ensureTable();
  const { contractor, amount, pay_date, method, notes } = await req.json();
  if (!contractor || !amount || !pay_date) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  const id = cuid();
  await sql`INSERT INTO contractor_payments (id, contractor, amount, pay_date, method, notes)
    VALUES (${id}, ${contractor}, ${amount}, ${pay_date}, ${method ?? 'ACH'}, ${notes ?? null})`;
  const [row] = await sql`SELECT * FROM contractor_payments WHERE id = ${id}`;
  return NextResponse.json({ row }, { status: 201 });
}

export async function PATCH(req: Request) {
  await ensureTable();
  const { id, status, contractor, amount, pay_date, method, notes } = await req.json();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  if (status) await sql`UPDATE contractor_payments SET status = ${status} WHERE id = ${id}`;
  if (contractor) await sql`UPDATE contractor_payments SET contractor = ${contractor} WHERE id = ${id}`;
  if (amount) await sql`UPDATE contractor_payments SET amount = ${amount} WHERE id = ${id}`;
  if (pay_date) await sql`UPDATE contractor_payments SET pay_date = ${pay_date} WHERE id = ${id}`;
  if (method) await sql`UPDATE contractor_payments SET method = ${method} WHERE id = ${id}`;
  if (notes !== undefined) await sql`UPDATE contractor_payments SET notes = ${notes} WHERE id = ${id}`;
  const [row] = await sql`SELECT * FROM contractor_payments WHERE id = ${id}`;
  return NextResponse.json({ row });
}

export async function DELETE(req: Request) {
  await ensureTable();
  const { id } = await req.json();
  await sql`DELETE FROM contractor_payments WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}

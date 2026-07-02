export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  const allowed = ['employee', 'type', 'start_date', 'end_date', 'days', 'status', 'notes'];
  const sets = Object.keys(body).filter(k => allowed.includes(k));
  if (!sets.length) return NextResponse.json({ error: 'No valid fields' }, { status: 400 });
  const updates = Object.fromEntries(sets.map(k => [k, body[k]]));
  await sql`UPDATE pto_entries SET ${sql(updates)} WHERE id = ${params.id}`;
  const [entry] = await sql`SELECT * FROM pto_entries WHERE id = ${params.id}`;
  return NextResponse.json({ entry });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  await sql`DELETE FROM pto_entries WHERE id = ${params.id}`;
  return NextResponse.json({ ok: true });
}

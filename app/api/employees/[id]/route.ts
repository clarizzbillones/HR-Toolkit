export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  const allowed = ['review_6mo_status', 'review_6mo_date', 'review_6mo_reviewer', 'review_1yr_status', 'review_1yr_date', 'review_1yr_reviewer', 'review_notes', 'hire_date'];
  const sets = Object.keys(body).filter(k => allowed.includes(k));
  if (!sets.length) return NextResponse.json({ error: 'No valid fields' }, { status: 400 });
  const updates = Object.fromEntries(sets.map(k => [k, body[k]]));
  await sql`UPDATE employees SET ${sql(updates)} WHERE id = ${params.id}`;
  const [employee] = await sql`SELECT * FROM employees WHERE id = ${params.id}`;
  return NextResponse.json({ employee });
}

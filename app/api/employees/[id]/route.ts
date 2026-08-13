export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { syncReviewsToEmployeeFile } from '@/lib/employeeFiles';

// Review-related fields — touching any of these refreshes the employee's
// Performance Review entry in their Employee File automatically.
const REVIEW_FIELDS = new Set(['hire_date', 'last_review_date', 'review_history', 'review_6mo_status', 'review_6mo_date', 'review_6mo_reviewer', 'review_6mo_summary', 'review_1yr_status', 'review_1yr_date', 'review_1yr_reviewer', 'review_1yr_summary', 'review_notes']);

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  const allowed = ['name', 'role', 'dept', 'birthday', 'hire_date', 'last_review_date', 'review_history', 'next_review_override', 'review_status_override', 'review_6mo_status', 'review_6mo_date', 'review_6mo_reviewer', 'review_6mo_summary', 'review_1yr_status', 'review_1yr_date', 'review_1yr_reviewer', 'review_1yr_summary', 'review_notes'];
  const sets = Object.keys(body).filter(k => allowed.includes(k));
  if (!sets.length) return NextResponse.json({ error: 'No valid fields' }, { status: 400 });
  const updates = Object.fromEntries(sets.map(k => [k, body[k]]));
  await sql`UPDATE employees SET ${sql(updates)} WHERE id = ${params.id}`;
  const [employee] = await sql`SELECT * FROM employees WHERE id = ${params.id}`;
  // Keep the Employee File's review entry current whenever a review changes.
  if (sets.some(k => REVIEW_FIELDS.has(k))) { try { await syncReviewsToEmployeeFile(params.id); } catch { /* best-effort */ } }
  return NextResponse.json({ employee });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  await sql`DELETE FROM employees WHERE id = ${params.id}`;
  return NextResponse.json({ ok: true });
}

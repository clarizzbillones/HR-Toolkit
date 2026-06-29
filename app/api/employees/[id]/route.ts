import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const db = getDb();
  const body = await req.json();
  const allowed = ['review_6mo_status', 'review_1yr_status', 'review_notes'];
  const sets = Object.keys(body).filter(k => allowed.includes(k));
  if (!sets.length) return NextResponse.json({ error: 'No valid fields' }, { status: 400 });
  const sql = `UPDATE employees SET ${sets.map(k => `${k}=?`).join(', ')} WHERE id=?`;
  db.prepare(sql).run(...sets.map(k => body[k]), params.id);
  const employee = db.prepare('SELECT * FROM employees WHERE id=?').get(params.id);
  return NextResponse.json({ employee });
}

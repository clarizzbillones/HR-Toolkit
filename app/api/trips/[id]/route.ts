import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const db = getDb();
  const { status } = await req.json();
  db.prepare('UPDATE trips SET status=? WHERE id=?').run(status, params.id);
  return NextResponse.json({ trip: db.prepare('SELECT * FROM trips WHERE id=?').get(params.id) });
}

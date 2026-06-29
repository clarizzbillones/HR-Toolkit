import { NextResponse } from 'next/server';
import { getDb, cuid } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const trips = db.prepare('SELECT * FROM trips ORDER BY created_at DESC').all();
  return NextResponse.json({ trips });
}

export async function POST(req: Request) {
  const db = getDb();
  const { who, detail, cost, matter } = await req.json();
  const id = cuid();
  db.prepare('INSERT INTO trips (id,who,detail,cost,matter,status) VALUES (?,?,?,?,?,?)').run(
    id, who, detail, cost ?? null, matter ?? null, 'Pending'
  );
  return NextResponse.json({ trip: db.prepare('SELECT * FROM trips WHERE id=?').get(id) }, { status: 201 });
}

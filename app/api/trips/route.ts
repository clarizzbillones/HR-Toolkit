export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { sql, cuid } from '@/lib/db';

export async function GET() {
  const trips = await sql`SELECT * FROM trips ORDER BY created_at DESC`;
  return NextResponse.json({ trips });
}

export async function POST(req: Request) {
  const { who, detail, cost, matter } = await req.json();
  const id = cuid();
  await sql`INSERT INTO trips (id,who,detail,cost,matter,status) VALUES (${id},${who},${detail},${cost ?? null},${matter ?? null},'Pending')`;
  const [trip] = await sql`SELECT * FROM trips WHERE id = ${id}`;
  return NextResponse.json({ trip }, { status: 201 });
}

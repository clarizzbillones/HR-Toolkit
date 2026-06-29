import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { status } = await req.json();
  await sql`UPDATE trips SET status = ${status} WHERE id = ${params.id}`;
  const [trip] = await sql`SELECT * FROM trips WHERE id = ${params.id}`;
  return NextResponse.json({ trip });
}

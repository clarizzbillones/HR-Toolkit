export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET() {
  const employees = await sql`SELECT * FROM employees ORDER BY dept, name`;
  return NextResponse.json({ employees });
}

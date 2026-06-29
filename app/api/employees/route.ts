import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const employees = db.prepare('SELECT * FROM employees ORDER BY dept, name').all();
  return NextResponse.json({ employees });
}

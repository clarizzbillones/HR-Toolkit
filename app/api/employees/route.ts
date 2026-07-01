export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET() {
  const employees = await sql`SELECT * FROM employees ORDER BY dept, name`;
  return NextResponse.json({ employees });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { name, role, dept, hire_date, review_6mo_date, review_1yr_date } = body;
  if (!name || !role) return NextResponse.json({ error: 'name and role required' }, { status: 400 });
  const id = `e${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
  const [employee] = await sql`
    INSERT INTO employees (id, name, role, dept, hire_date, review_6mo_date, review_1yr_date)
    VALUES (${id}, ${name}, ${role}, ${dept ?? 'Operations'}, ${hire_date ?? null}, ${review_6mo_date ?? null}, ${review_1yr_date ?? null})
    RETURNING *
  `;
  return NextResponse.json({ employee });
}

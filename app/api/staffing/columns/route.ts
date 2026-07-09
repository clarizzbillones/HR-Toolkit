export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

// Custom (user-added) column names for the Staffing tables, stored on the
// app_settings singleton row as a JSON array.
async function ensure() {
  await sql`CREATE TABLE IF NOT EXISTS app_settings (id TEXT PRIMARY KEY)`;
  await sql`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS staff_columns TEXT`;
  await sql`INSERT INTO app_settings (id) VALUES ('singleton') ON CONFLICT (id) DO NOTHING`;
}

export async function GET() {
  try {
    await ensure();
    const [row] = await sql`SELECT staff_columns FROM app_settings WHERE id = 'singleton'` as any[];
    let columns: string[] = [];
    try { const p = JSON.parse(row?.staff_columns ?? '[]'); if (Array.isArray(p)) columns = p.map(String); } catch { /* ignore */ }
    return NextResponse.json({ columns });
  } catch {
    return NextResponse.json({ columns: [] });
  }
}

export async function PUT(req: Request) {
  await ensure();
  const { columns } = await req.json();
  if (!Array.isArray(columns)) return NextResponse.json({ error: 'columns array required' }, { status: 400 });
  // De-duplicate, trim, and drop blanks.
  const clean = Array.from(new Set(columns.map((c: any) => String(c).trim()).filter(Boolean)));
  await sql`UPDATE app_settings SET staff_columns = ${JSON.stringify(clean)} WHERE id = 'singleton'`;
  return NextResponse.json({ columns: clean });
}

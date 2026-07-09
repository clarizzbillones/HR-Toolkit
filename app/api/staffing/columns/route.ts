export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

// Custom (user-added) column names for the Staffing tables, stored on the
// app_settings singleton row as a JSON array.
async function ensure() {
  await sql`CREATE TABLE IF NOT EXISTS app_settings (id TEXT PRIMARY KEY)`;
  await sql`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS staff_columns TEXT`;
  await sql`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS staff_col_order TEXT`;
  await sql`INSERT INTO app_settings (id) VALUES ('singleton') ON CONFLICT (id) DO NOTHING`;
}

export async function GET() {
  try {
    await ensure();
    const [row] = await sql`SELECT staff_columns, staff_col_order FROM app_settings WHERE id = 'singleton'` as any[];
    let columns: string[] = [], order: string[] = [];
    try { const p = JSON.parse(row?.staff_columns ?? '[]'); if (Array.isArray(p)) columns = p.map(String); } catch { /* ignore */ }
    try { const p = JSON.parse(row?.staff_col_order ?? '[]'); if (Array.isArray(p)) order = p.map(String); } catch { /* ignore */ }
    return NextResponse.json({ columns, order });
  } catch {
    return NextResponse.json({ columns: [], order: [] });
  }
}

export async function PUT(req: Request) {
  await ensure();
  const { columns, order } = await req.json();
  if (columns !== undefined) {
    if (!Array.isArray(columns)) return NextResponse.json({ error: 'columns array required' }, { status: 400 });
    const clean = Array.from(new Set(columns.map((c: any) => String(c).trim()).filter(Boolean)));
    await sql`UPDATE app_settings SET staff_columns = ${JSON.stringify(clean)} WHERE id = 'singleton'`;
  }
  if (order !== undefined) {
    if (!Array.isArray(order)) return NextResponse.json({ error: 'order array required' }, { status: 400 });
    await sql`UPDATE app_settings SET staff_col_order = ${JSON.stringify(order.map(String))} WHERE id = 'singleton'`;
  }
  const [row] = await sql`SELECT staff_columns, staff_col_order FROM app_settings WHERE id = 'singleton'` as any[];
  let cols: string[] = [], ord: string[] = [];
  try { cols = JSON.parse(row?.staff_columns ?? '[]'); } catch { /* */ }
  try { ord = JSON.parse(row?.staff_col_order ?? '[]'); } catch { /* */ }
  return NextResponse.json({ columns: cols, order: ord });
}

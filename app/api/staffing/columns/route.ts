export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

// Custom (user-added) column names for the Staffing tables, stored on the
// app_settings singleton row as a JSON array.
async function ensure() {
  await sql`CREATE TABLE IF NOT EXISTS app_settings (id TEXT PRIMARY KEY)`;
  await sql`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS staff_columns TEXT`;
  await sql`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS staff_col_order TEXT`;
  await sql`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS off_col_order TEXT`;
  await sql`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS vendor_col_order TEXT`;
  // Display-label overrides for column headers (built-in or custom), keyed by
  // column id. A blank/removed entry falls back to the default label.
  await sql`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS staff_col_labels TEXT`;
  await sql`INSERT INTO app_settings (id) VALUES ('singleton') ON CONFLICT (id) DO NOTHING`;
}

const parseArr = (s: any): string[] => { try { const p = JSON.parse(s ?? '[]'); return Array.isArray(p) ? p.map(String) : []; } catch { return []; } };
const parseMap = (s: any): Record<string, string> => { try { const p = JSON.parse(s ?? '{}'); return p && typeof p === 'object' && !Array.isArray(p) ? p : {}; } catch { return {}; } };

export async function GET() {
  try {
    await ensure();
    const [row] = await sql`SELECT staff_columns, staff_col_order, off_col_order, vendor_col_order, staff_col_labels FROM app_settings WHERE id = 'singleton'` as any[];
    return NextResponse.json({
      columns: parseArr(row?.staff_columns),
      order: parseArr(row?.staff_col_order),
      offOrder: parseArr(row?.off_col_order),
      vendorOrder: parseArr(row?.vendor_col_order),
      labels: parseMap(row?.staff_col_labels),
    });
  } catch {
    return NextResponse.json({ columns: [], order: [], offOrder: [], vendorOrder: [], labels: {} });
  }
}

export async function PUT(req: Request) {
  await ensure();
  const { columns, order, offOrder, vendorOrder, labels } = await req.json();
  if (columns !== undefined) {
    if (!Array.isArray(columns)) return NextResponse.json({ error: 'columns array required' }, { status: 400 });
    const clean = Array.from(new Set(columns.map((c: any) => String(c).trim()).filter(Boolean)));
    await sql`UPDATE app_settings SET staff_columns = ${JSON.stringify(clean)} WHERE id = 'singleton'`;
  }
  if (order !== undefined) await sql`UPDATE app_settings SET staff_col_order = ${JSON.stringify((order ?? []).map(String))} WHERE id = 'singleton'`;
  if (offOrder !== undefined) await sql`UPDATE app_settings SET off_col_order = ${JSON.stringify((offOrder ?? []).map(String))} WHERE id = 'singleton'`;
  if (vendorOrder !== undefined) await sql`UPDATE app_settings SET vendor_col_order = ${JSON.stringify((vendorOrder ?? []).map(String))} WHERE id = 'singleton'`;
  if (labels !== undefined && labels && typeof labels === 'object') {
    // Keep only non-empty string overrides.
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(labels)) { const s = String(v ?? '').trim(); if (s) clean[String(k)] = s; }
    await sql`UPDATE app_settings SET staff_col_labels = ${JSON.stringify(clean)} WHERE id = 'singleton'`;
  }
  const [row] = await sql`SELECT staff_columns, staff_col_order, off_col_order, vendor_col_order, staff_col_labels FROM app_settings WHERE id = 'singleton'` as any[];
  return NextResponse.json({
    columns: parseArr(row?.staff_columns), order: parseArr(row?.staff_col_order),
    offOrder: parseArr(row?.off_col_order), vendorOrder: parseArr(row?.vendor_col_order),
    labels: parseMap(row?.staff_col_labels),
  });
}

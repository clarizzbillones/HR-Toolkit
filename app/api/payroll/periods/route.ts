export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

// Ensure extra columns exist
async function ensureColumns() {
  try {
    await sql`ALTER TABLE payroll_periods ADD COLUMN IF NOT EXISTS check_date text`;
    await sql`ALTER TABLE payroll_periods ADD COLUMN IF NOT EXISTS report_name text`;
    await sql`ALTER TABLE payroll_periods ADD COLUMN IF NOT EXISTS report_data text`;
  } catch { /* ignore */ }
}

export async function PATCH(req: Request) {
  await ensureColumns();
  const { id, run_date, check_date, status } = await req.json();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  if (run_date) await sql`UPDATE payroll_periods SET run_date = ${run_date} WHERE id = ${id}`;
  if (check_date !== undefined) await sql`UPDATE payroll_periods SET check_date = ${check_date || null} WHERE id = ${id}`;
  if (status) await sql`UPDATE payroll_periods SET status = ${status} WHERE id = ${id}`;
  const [period] = await sql`SELECT * FROM payroll_periods WHERE id = ${id}`;
  return NextResponse.json({ period });
}

export async function PUT(req: Request) {
  await ensureColumns();
  const formData = await req.formData();
  const id = formData.get('id') as string;
  const file = formData.get('file') as File | null;
  if (!id || !file) return NextResponse.json({ error: 'Missing id or file' }, { status: 400 });
  const buf = await file.arrayBuffer();
  const b64 = Buffer.from(buf).toString('base64');
  const dataUrl = `data:${file.type};base64,${b64}`;
  await sql`UPDATE payroll_periods SET report_name = ${file.name}, report_data = ${dataUrl} WHERE id = ${id}`;
  const [period] = await sql`SELECT id, report_name FROM payroll_periods WHERE id = ${id}`;
  return NextResponse.json({ period });
}

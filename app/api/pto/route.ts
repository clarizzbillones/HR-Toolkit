export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { sql, cuid } from '@/lib/db';

interface PtoRow { employee: string; type: string; start_date: string; end_date: string; days: number; notes: string; }

export async function GET() {
  const entries = await sql`SELECT * FROM pto_entries ORDER BY start_date ASC`;
  return NextResponse.json({ entries });
}

export async function POST(req: Request) {
  const body = await req.json();
  const rows: PtoRow[] = body.entries ?? body;
  await sql.begin(async s => {
    for (const r of rows) {
      await s`INSERT INTO pto_entries (id,employee,type,start_date,end_date,days,status,notes) VALUES (${cuid()},${r.employee},${r.type ?? 'Vacation'},${r.start_date ?? null},${r.end_date ?? null},${r.days ?? null},'Approved',${r.notes ?? ''})`;
    }
  });
  const entries = await sql`SELECT * FROM pto_entries ORDER BY start_date ASC`;
  return NextResponse.json({ entries, inserted: rows.length });
}

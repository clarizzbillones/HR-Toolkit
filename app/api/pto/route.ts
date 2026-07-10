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
  // When replaceFrom is set (bulk uploads), first delete existing entries from
  // the earliest uploaded month onward, so re-uploads don't duplicate while
  // earlier months are left completely untouched. Plain adds (undo, single
  // entry) skip this and just insert.
  let cutoff: string | null = null;
  if (body.replaceFrom) {
    const months = rows.map(r => String(r.start_date ?? '').slice(0, 7)).filter(m => /^\d{4}-\d{2}$/.test(m)).sort();
    if (months.length) cutoff = months[0] + '-01';
  }
  await sql.begin(async s => {
    if (cutoff) await s`DELETE FROM pto_entries WHERE start_date >= ${cutoff}`;
    for (const r of rows) {
      await s`INSERT INTO pto_entries (id,employee,type,start_date,end_date,days,status,notes) VALUES (${cuid()},${r.employee},${r.type ?? 'Vacation'},${r.start_date ?? null},${r.end_date ?? null},${r.days ?? null},'Approved',${r.notes ?? ''})`;
    }
  });
  const entries = await sql`SELECT * FROM pto_entries ORDER BY start_date ASC`;
  return NextResponse.json({ entries, inserted: rows.length, replacedFrom: cutoff });
}

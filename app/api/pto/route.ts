import { NextResponse } from 'next/server';
import { getDb, cuid } from '@/lib/db';

interface PtoRow { employee: string; type: string; start_date: string; end_date: string; days: number; notes: string; }

export async function GET() {
  const db = getDb();
  const entries = db.prepare('SELECT * FROM pto_entries ORDER BY start_date ASC').all();
  return NextResponse.json({ entries });
}

export async function POST(req: Request) {
  const db = getDb();
  const body = await req.json();
  const rows: PtoRow[] = body.entries ?? body;

  const insert = db.prepare(
    'INSERT INTO pto_entries (id,employee,type,start_date,end_date,days,status,notes) VALUES (?,?,?,?,?,?,?,?)'
  );
  const insertMany = db.transaction((items: PtoRow[]) => {
    for (const r of items) {
      insert.run(cuid(), r.employee, r.type ?? 'Vacation', r.start_date ?? null, r.end_date ?? null, r.days ?? null, 'Approved', r.notes ?? '');
    }
  });
  insertMany(rows);

  const entries = db.prepare('SELECT * FROM pto_entries ORDER BY start_date ASC').all();
  return NextResponse.json({ entries, inserted: rows.length });
}

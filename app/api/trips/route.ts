export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { sql, cuid } from '@/lib/db';

export async function GET() {
  const trips = await sql`SELECT * FROM trips ORDER BY created_at DESC`;
  return NextResponse.json({ trips });
}

export async function POST(req: Request) {
  const body = await req.json();

  // Bulk import (CSV/XLSX): { rows: [{ who, detail, cost, matter, status }] }
  if (Array.isArray(body.rows)) {
    const clean = body.rows.filter((r: any) => (r.who ?? '').toString().trim() || (r.detail ?? '').toString().trim());
    let inserted = 0;
    for (const r of clean) {
      const cost = r.cost != null && r.cost !== '' ? Number(String(r.cost).replace(/[^0-9.]/g, '')) || null : null;
      await sql`INSERT INTO trips (id,who,detail,cost,matter,status)
        VALUES (${cuid()},${r.who ?? '—'},${r.detail ?? ''},${cost},${r.matter ?? null},${r.status ?? 'Pending'})`;
      inserted++;
    }
    const trips = await sql`SELECT * FROM trips ORDER BY created_at DESC`;
    return NextResponse.json({ trips, inserted }, { status: 201 });
  }

  const { who, detail, cost, matter } = body;
  const id = cuid();
  await sql`INSERT INTO trips (id,who,detail,cost,matter,status) VALUES (${id},${who},${detail},${cost ?? null},${matter ?? null},'Pending')`;
  const [trip] = await sql`SELECT * FROM trips WHERE id = ${id}`;
  return NextResponse.json({ trip }, { status: 201 });
}

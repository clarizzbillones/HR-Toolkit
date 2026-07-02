export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { sql, cuid } from '@/lib/db';

async function ensureColumns() {
  await sql`ALTER TABLE trips ADD COLUMN IF NOT EXISTS travel_start text`;
  await sql`ALTER TABLE trips ADD COLUMN IF NOT EXISTS travel_end text`;
}

export async function GET() {
  await ensureColumns();
  const trips = await sql`SELECT * FROM trips ORDER BY COALESCE(travel_start, created_at::text) DESC`;
  return NextResponse.json({ trips });
}

export async function POST(req: Request) {
  await ensureColumns();
  const body = await req.json();

  // Bulk import (CSV/XLSX): { rows: [{ who, detail, cost, matter, status, travel_start, travel_end }], replace? }
  if (Array.isArray(body.rows)) {
    if (body.replace) await sql`DELETE FROM trips`;
    const clean = body.rows.filter((r: any) => (r.who ?? '').toString().trim() || (r.detail ?? '').toString().trim());
    let inserted = 0;
    for (const r of clean) {
      const cost = r.cost != null && r.cost !== '' ? Number(String(r.cost).replace(/[^0-9.]/g, '')) || null : null;
      await sql`INSERT INTO trips (id,who,detail,cost,matter,status,travel_start,travel_end)
        VALUES (${cuid()},${r.who ?? '—'},${r.detail ?? ''},${cost},${r.matter ?? null},${r.status ?? 'Pending'},${r.travel_start ?? null},${r.travel_end ?? null})`;
      inserted++;
    }
    const trips = await sql`SELECT * FROM trips ORDER BY COALESCE(travel_start, created_at::text) DESC`;
    return NextResponse.json({ trips, inserted }, { status: 201 });
  }

  const { who, detail, cost, matter, travel_start, travel_end } = body;
  const id = cuid();
  await sql`INSERT INTO trips (id,who,detail,cost,matter,status,travel_start,travel_end) VALUES (${id},${who},${detail},${cost ?? null},${matter ?? null},'Pending',${travel_start ?? null},${travel_end ?? null})`;
  const [trip] = await sql`SELECT * FROM trips WHERE id = ${id}`;
  return NextResponse.json({ trip }, { status: 201 });
}

export async function DELETE(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (body.all) { await sql`DELETE FROM trips`; return NextResponse.json({ ok: true, cleared: true }); }
  if (body.id) { await sql`DELETE FROM trips WHERE id = ${body.id}`; return NextResponse.json({ ok: true }); }
  return NextResponse.json({ error: 'Missing id or all' }, { status: 400 });
}

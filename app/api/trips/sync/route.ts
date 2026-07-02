export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { sql, cuid } from '@/lib/db';

// Trip Desk (Lovable) Supabase project — URL is public; the anon key in the
// client bundle is blocked by RLS, so a read-capable key (service_role, or a
// key on a role with SELECT granted) must be supplied via env.
const TRIPDESK_URL = process.env.TRIPDESK_SUPABASE_URL || 'https://xhmjiolfscwisvjewudy.supabase.co';
const TRIPDESK_KEY = process.env.TRIPDESK_SUPABASE_KEY || '';

const pick = (o: any, keys: string[]) => { for (const k of keys) if (o?.[k] != null && o[k] !== '') return o[k]; return null; };

async function ensureColumns() {
  await sql`ALTER TABLE trips ADD COLUMN IF NOT EXISTS source_id text`;
  await sql`ALTER TABLE trips ADD COLUMN IF NOT EXISTS travel_date text`;
}

export async function POST() {
  if (!TRIPDESK_KEY) {
    return NextResponse.json({ error: 'Trip Desk sync not configured. Set TRIPDESK_SUPABASE_KEY to a read-capable Supabase key (service_role, from the Trip Desk project → Settings → API).' }, { status: 400 });
  }
  await ensureColumns();

  const res = await fetch(`${TRIPDESK_URL}/rest/v1/trips?select=*`, {
    headers: { apikey: TRIPDESK_KEY, Authorization: `Bearer ${TRIPDESK_KEY}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.text();
    return NextResponse.json({ error: `Trip Desk read failed (${res.status})`, detail: body.slice(0, 400) }, { status: 502 });
  }
  const rows: any[] = await res.json();

  const existing = await sql`SELECT source_id FROM trips WHERE source_id IS NOT NULL`;
  const seen = new Set((existing as any[]).map(r => r.source_id));

  let inserted = 0;
  for (const r of rows) {
    const srcId = String(pick(r, ['id', 'trip_id', 'uuid']) ?? '');
    if (!srcId || seen.has(srcId)) continue;
    const who = pick(r, ['traveler', 'traveler_name', 'employee', 'name', 'who']) ?? '—';
    const dest = pick(r, ['destination', 'trip_name', 'title', 'location']);
    const start = pick(r, ['start_date', 'depart_date', 'travel_date', 'date']);
    const end = pick(r, ['end_date', 'return_date']);
    const detailParts = [dest, start && end ? `${start} → ${end}` : start].filter(Boolean);
    const detail = detailParts.join(' · ') || '(trip)';
    const cost = pick(r, ['total_cost', 'cost', 'amount', 'total', 'estimated_cost']);
    const matter = pick(r, ['client', 'matter', 'purpose', 'reason']);
    const status = pick(r, ['status', 'state']) ?? 'Pending';
    await sql`INSERT INTO trips (id, who, detail, cost, matter, status, source_id, travel_date)
      VALUES (${cuid()}, ${who}, ${detail}, ${cost != null ? Number(String(cost).replace(/[^0-9.]/g, '')) || null : null}, ${matter}, ${status}, ${srcId}, ${start ?? null})`;
    inserted++;
  }

  const trips = await sql`SELECT * FROM trips ORDER BY created_at DESC`;
  return NextResponse.json({ inserted, fetched: rows.length, trips });
}

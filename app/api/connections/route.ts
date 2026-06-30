export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

// Ensure columns exist (idempotent)
async function ensureColumns() {
  await sql`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS calendar_url TEXT`;
  await sql`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS trips_url TEXT`;
  await sql`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS reviews_url TEXT`;
}

export async function GET() {
  await ensureColumns();
  const rows = await sql`SELECT calendar_url, trips_url, reviews_url FROM app_settings WHERE id = 'singleton'`;
  const row = (rows as any[])[0] ?? {};
  return NextResponse.json({
    calendar_url: row.calendar_url ?? null,
    trips_url: row.trips_url ?? null,
    reviews_url: row.reviews_url ?? null,
  });
}

export async function PATCH(req: Request) {
  await ensureColumns();
  const body = await req.json();
  const allowed = ['calendar_url', 'trips_url', 'reviews_url'] as const;
  for (const key of allowed) {
    if (key in body) {
      const val = body[key] === null ? null : String(body[key]);
      if (key === 'calendar_url') await sql`UPDATE app_settings SET calendar_url = ${val} WHERE id = 'singleton'`;
      if (key === 'trips_url')    await sql`UPDATE app_settings SET trips_url = ${val} WHERE id = 'singleton'`;
      if (key === 'reviews_url')  await sql`UPDATE app_settings SET reviews_url = ${val} WHERE id = 'singleton'`;
    }
  }
  return NextResponse.json({ ok: true });
}

export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

// Run once per cold start, not on every request
let columnsReady = false;
async function ensureColumns() {
  if (columnsReady) return;
  await sql`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS calendar_url TEXT`;
  await sql`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS calendar_events TEXT`;
  await sql`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS trips_url TEXT`;
  await sql`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS reviews_url TEXT`;
  columnsReady = true;
}

const DEFAULT_CALENDAR_URL = 'https://outlook.office365.com/owa/calendar/b98af16d6adf4dcbab00e6267e7b56ef@litson.co/3595b6d02e0248e49850dbf12bf9e4be2311203059642998248/calendar.ics';
const DEFAULT_REVIEWS_URL = 'https://firm-evaluator.lovable.app/admin/reports';
const DEFAULT_TRIPS_URL = 'https://trip-desk.lovable.app/';

export async function GET() {
  await ensureColumns();
  const rows = await sql`SELECT calendar_url, calendar_events, trips_url, reviews_url FROM app_settings WHERE id = 'singleton'`;
  const row = (rows as any[])[0] ?? {};
  let calEvents = null;
  if (row.calendar_events) {
    try { calEvents = JSON.parse(row.calendar_events); } catch { calEvents = null; }
  }
  return NextResponse.json({
    calendar_url: row.calendar_url ?? DEFAULT_CALENDAR_URL,
    calendar_events: calEvents,
    trips_url: row.trips_url ?? DEFAULT_TRIPS_URL,
    reviews_url: row.reviews_url ?? DEFAULT_REVIEWS_URL,
  });
}

export async function PATCH(req: Request) {
  await ensureColumns();
  const body = await req.json();

  if ('calendar_url' in body || 'calendar_events' in body) {
    const url = body.calendar_url === undefined ? undefined : (body.calendar_url === null ? null : String(body.calendar_url));
    const events = body.calendar_events === undefined ? undefined
      : (body.calendar_events === null ? null : JSON.stringify(body.calendar_events));
    if (url !== undefined && events !== undefined) {
      await sql`UPDATE app_settings SET calendar_url = ${url}, calendar_events = ${events} WHERE id = 'singleton'`;
    } else if (url !== undefined) {
      await sql`UPDATE app_settings SET calendar_url = ${url} WHERE id = 'singleton'`;
    } else if (events !== undefined) {
      await sql`UPDATE app_settings SET calendar_events = ${events} WHERE id = 'singleton'`;
    }
  }
  if ('trips_url' in body) {
    const val = body.trips_url === null ? null : String(body.trips_url);
    await sql`UPDATE app_settings SET trips_url = ${val} WHERE id = 'singleton'`;
  }
  if ('reviews_url' in body) {
    const val = body.reviews_url === null ? null : String(body.reviews_url);
    await sql`UPDATE app_settings SET reviews_url = ${val} WHERE id = 'singleton'`;
  }
  return NextResponse.json({ ok: true });
}

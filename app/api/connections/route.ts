export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { calendarWithArchive } from '@/lib/calendarArchive';

// Run once per cold start, not on every request
let columnsReady = false;
async function ensureColumns() {
  if (columnsReady) return;
  await sql`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS calendar_url TEXT`;
  await sql`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS calendar_events TEXT`;
  await sql`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS trips_url TEXT`;
  await sql`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS reviews_url TEXT`;
  await sql`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS hidden_cal_ids TEXT`;
  // Entries kept from the previous calendar, and the date the new calendar took over (see lib/calendarArchive).
  await sql`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS calendar_archive TEXT`;
  await sql`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS calendar_cutover TEXT`;
  columnsReady = true;
}

// No built-in link: the calendar is availability@litson.co's, connected on the PTO page.
const DEFAULT_CALENDAR_URL = '';
const DEFAULT_REVIEWS_URL = 'https://firm-evaluator.lovable.app/admin/reports';
const DEFAULT_TRIPS_URL = 'https://trip-desk.lovable.app/';

export async function GET() {
  await ensureColumns();
  const rows = await sql`SELECT calendar_url, calendar_events, calendar_archive, calendar_cutover, trips_url, reviews_url, hidden_cal_ids FROM app_settings WHERE id = 'singleton'`;
  const row = (rows as any[])[0] ?? {};
  // Kept entries from the old calendar + the current calendar's entries from the switch date on.
  const calEvents = calendarWithArchive(row.calendar_events, row.calendar_archive, row.calendar_cutover);
  let archiveCount = 0;
  try { archiveCount = row.calendar_archive ? JSON.parse(row.calendar_archive).length : 0; } catch { /* ignore */ }
  let hiddenCalIds: string[] = [];
  if (row.hidden_cal_ids) {
    try { hiddenCalIds = JSON.parse(row.hidden_cal_ids); } catch { hiddenCalIds = []; }
  }
  return NextResponse.json({
    calendar_url: row.calendar_url ?? DEFAULT_CALENDAR_URL,
    calendar_events: calEvents,
    calendar_connected: !!row.calendar_events,
    calendar_archive: row.calendar_cutover ? { count: archiveCount, cutover: row.calendar_cutover } : null,
    trips_url: row.trips_url ?? DEFAULT_TRIPS_URL,
    reviews_url: row.reviews_url ?? DEFAULT_REVIEWS_URL,
    hidden_cal_ids: hiddenCalIds,
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
  if ('hidden_cal_ids' in body) {
    const val = body.hidden_cal_ids === null ? null : JSON.stringify(body.hidden_cal_ids);
    await sql`UPDATE app_settings SET hidden_cal_ids = ${val} WHERE id = 'singleton'`;
  }
  // Hand back what the PTO page should now show (kept entries + the current calendar).
  const [after] = await sql`SELECT calendar_events, calendar_archive, calendar_cutover FROM app_settings WHERE id = 'singleton'` as any[];
  return NextResponse.json({ ok: true, calendar_events: calendarWithArchive(after?.calendar_events, after?.calendar_archive, after?.calendar_cutover) });
}

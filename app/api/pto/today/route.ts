import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
// Single source of truth for the PTO merge (name aliasing, overlap dedup,
// exclusions) shared with the PTO dashboard and report — so "out today" always
// matches the rows people actually see on the PTO page.
import { mergePto, type PtoEntry, type CalEvent } from '@/lib/pto';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const today = url.searchParams.get('date') || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
  const debug = url.searchParams.get('debug') === '1';

  const ptoRows = await sql`SELECT id, employee, type, days, start_date, end_date, status FROM pto_entries` as any[];
  const entries: PtoEntry[] = ptoRows.map(r => ({
    id: String(r.id),
    employee: r.employee ?? '',
    type: r.type ?? '',
    status: r.status ?? '',
    start_date: String(r.start_date ?? '').slice(0, 10),
    end_date: String(r.end_date ?? '').slice(0, 10),
    days: Number(r.days) || 0,
  }));

  const settingsRows = await sql`SELECT calendar_events, hidden_cal_ids FROM app_settings WHERE id = 'singleton'` as any[];
  let calEvents: CalEvent[] = [];
  try { calEvents = settingsRows[0]?.calendar_events ? JSON.parse(settingsRows[0].calendar_events) : []; } catch { calEvents = []; }
  let hiddenIds: string[] = [];
  try { hiddenIds = settingsRows[0]?.hidden_cal_ids ? JSON.parse(settingsRows[0].hidden_cal_ids) : []; } catch { hiddenIds = []; }

  // Merge exactly like the PTO page, then keep the people whose merged leave
  // actually covers today. This fixes over-counting when a person has two
  // overlapping calendar events (the page merges them into one visible row, so a
  // longer duplicate no longer keeps them "out" after the visible range ends).
  const merged = mergePto(entries, calEvents, hiddenIds);
  const active = merged.filter(m => m.start <= today && m.end >= today);
  const byName = new Map<string, string>();
  for (const m of active) byName.set(m.employee.trim().toLowerCase(), m.employee);
  const names = [...byName.values()];

  const resp: Record<string, unknown> = { count: names.length, names };
  if (debug) {
    resp.active = active.map(m => ({ employee: m.employee, start: m.start, end: m.end, source: m.source, type: m.type }));
  }
  return NextResponse.json(resp);
}

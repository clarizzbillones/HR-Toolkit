import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
// Single source of truth for name aliasing + PTO filters, shared with the PTO
// dashboard, report, and EOD modal so a name merge is fixed in exactly one place.
import { resolveAlias, EXCLUDED_TYPES, EXCLUDED_TITLE, workingDays } from '@/lib/pto';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const today = url.searchParams.get('date') || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
  const debug = url.searchParams.get('debug') === '1';

  const ptoRows = await sql`
    SELECT employee, type, days FROM pto_entries
    WHERE start_date <= ${today} AND end_date >= ${today}
      AND status = 'Approved'
  `;

  const settingsRows = await sql`SELECT calendar_events, hidden_cal_ids FROM app_settings WHERE id = 'singleton'`;
  let calEvents: { id?: string; name: string; tag: string; start: string; end: string; title: string }[] = [];
  try { calEvents = settingsRows[0]?.calendar_events ? JSON.parse(settingsRows[0].calendar_events) : []; } catch { calEvents = []; }
  let hiddenIds: string[] = [];
  try { hiddenIds = settingsRows[0]?.hidden_cal_ids ? JSON.parse(settingsRows[0].hidden_cal_ids) : []; } catch { hiddenIds = []; }
  const hidden = new Set(hiddenIds);

  // Single-pass dedup: key = canonical lowercase, value = canonical display name
  const canonical = new Map<string, string>();
  const debugIncluded: { source: string; employee: string; type: string }[] = [];
  const debugExcluded: { source: string; employee: string; type: string; reason: string }[] = [];

  function addName(raw: string, source: string, type: string) {
    const display = resolveAlias(raw);
    canonical.set(display.trim().toLowerCase(), display);
    debugIncluded.push({ source, employee: raw, type });
  }

  for (const r of ptoRows) {
    if (EXCLUDED_TYPES.test(r.type)) {
      debugExcluded.push({ source: 'db', employee: r.employee, type: r.type, reason: 'excluded type' });
      continue;
    }
    const days = Number(r.days) || 0;
    if (days < 1) {
      debugExcluded.push({ source: 'db', employee: r.employee, type: r.type, reason: `days=${days} < 1` });
      continue;
    }
    addName(r.employee, 'db', r.type);
  }

  for (const c of calEvents) {
    if (c.id && hidden.has(c.id)) continue; // removed from the report — stays removed everywhere
    if (c.start > today || c.end < today) continue;
    if (EXCLUDED_TYPES.test(c.tag)) {
      debugExcluded.push({ source: 'cal', employee: c.name, type: c.tag, reason: 'excluded tag' });
      continue;
    }
    // Only count calendar events explicitly tagged as OOO or PTO — skip ambiguous "Other" entries
    if (c.tag === 'Other') {
      debugExcluded.push({ source: 'cal', employee: c.name, type: c.tag, reason: 'tag=Other (ambiguous)', });
      continue;
    }
    if (EXCLUDED_TITLE.test(c.title)) {
      debugExcluded.push({ source: 'cal', employee: c.name, type: c.tag, reason: `excluded title: ${c.title}` });
      continue;
    }
    const days = workingDays(c.start, c.end);
    if (days < 1) {
      debugExcluded.push({ source: 'cal', employee: c.name, type: c.tag, reason: `days=${days} < 1` });
      continue;
    }
    addName(c.name, 'cal', c.tag);
  }

  const nameList = [...canonical.values()];
  const resp: Record<string, unknown> = { count: nameList.length, names: nameList };
  if (debug) { resp.included = debugIncluded; resp.excluded = debugExcluded; }
  return NextResponse.json(resp);
}

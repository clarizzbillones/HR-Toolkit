import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

const NAME_ALIASES: [RegExp, string][] = [
  [/^(vms|victoria|victoria\s+seeley)$/i, 'Victoria Seeley'],
  [/^(mrg|matt|mg|matt\s+gibbs)$/i, 'Matt Gibbs'],
  [/^(syerra|syerra\s+ryan)$/i, 'Syerra Ryan'],
  [/^(sl|clarizz|cb|clarizz\s+ann\s+billones|clarizz\s+ann\s+alon|clarizz\s+alon)$/i, 'Clarizz Billones'],
  [/^(jr'?|jrg|john\s+glover)$/i, 'John Glover'],
  [/^(clint|clint\s+palmer)$/i, 'Clint Palmer'],
  [/^(caitlin|caitlin\s+giuliano)$/i, 'Caitlin Giuliano'],
  [/^(shannen|shannen\s+sharpe)$/i, 'Shannen Sharpe'],
  [/^(simran|simran\s+mohini)$/i, 'Simran Mohini'],
  [/^(kelynn|kl|ke'?lynn|ke'?lynn\s+enalls)$/i, "Ke'Lynn Enalls"],
  [/^(ct|catie|catie\s+toole|catherine\s+tool(e)?)$/i, 'Catie Toole'],
  [/^(carly|carly\s+crotty)$/i, 'Carly Crotty'],
  [/^(brent|bh|brent\s+hannafan)$/i, 'Brent Hannafan'],
  [/^(brittany|bb|brittany\s+brewer)$/i, 'Brittany Brewer'],
  [/^(ally|ally\s+foresman)$/i, 'Ally Foresman'],
  [/^(amy|amy\s+green)$/i, 'Amy Green'],
  [/^(alicia|avh|alicia\s+van[-\s]?huizen)$/i, 'Alicia Van Huizen'],
  [/^(paula|paula\s+valle)$/i, 'Paula Valle'],
];

function resolveAlias(n: string): string {
  const t = n.trim();
  for (const [re, canonical] of NAME_ALIASES) {
    if (re.test(t)) return canonical;
  }
  return t;
}
function normName(n: string) { return resolveAlias(n).trim().toLowerCase().replace(/\s+/g, ' '); }

const EXCLUDED_TYPES = /wfh|work\s+from\s+home|personal\s+leave|personal/i;
const EXCLUDED_TITLE = /interview|in\s+office|\bwfh\b|work\s+from\s+home|meeting|call|doctor|dr\.|appointment|lunch|training|onboard|orientation|review|check[\s-]?in|1[\s-]?on[\s-]?1|one[\s-]?on[\s-]?one|\bin\s+\w+\s+for\b|[\w']+\s+in\s+\w+|fundraiser|conference|summit|trip\s+to|travel\s+to|visiting|event|gala|retreat/i;

function workingDays(start: string, end: string) {
  let count = 0;
  const cur = new Date(start + 'T12:00:00');
  const last = new Date(end + 'T12:00:00');
  while (cur <= last) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const today = url.searchParams.get('date') || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
  const debug = url.searchParams.get('debug') === '1';

  const ptoRows = await sql`
    SELECT employee, type, days FROM pto_entries
    WHERE start_date <= ${today} AND end_date >= ${today}
      AND status = 'Approved'
  `;

  const settingsRows = await sql`SELECT calendar_events FROM app_settings WHERE id = 'singleton'`;
  let calEvents: { name: string; tag: string; start: string; end: string; title: string }[] = [];
  try { calEvents = settingsRows[0]?.calendar_events ? JSON.parse(settingsRows[0].calendar_events) : []; } catch { calEvents = []; }

  const names = new Set<string>();
  const debugIncluded: { source: string; employee: string; type: string; reason?: string }[] = [];
  const debugExcluded: { source: string; employee: string; type: string; reason: string }[] = [];

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
    names.add(normName(r.employee));
    debugIncluded.push({ source: 'db', employee: r.employee, type: r.type });
  }

  for (const c of calEvents) {
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
    names.add(normName(c.name));
    debugIncluded.push({ source: 'cal', employee: c.name, type: c.tag });
  }

  const nameList = [...names].map(n => resolveAlias(n));
  const resp: Record<string, unknown> = { count: names.size, names: nameList };
  if (debug) { resp.included = debugIncluded; resp.excluded = debugExcluded; }
  return NextResponse.json(resp);
}

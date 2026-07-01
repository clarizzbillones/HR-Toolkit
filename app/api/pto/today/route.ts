import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

const NAME_ALIASES: [RegExp, string][] = [
  [/^(vms|victoria|victoria\s+seeley)$/i, 'Victoria Seeley'],
  [/^(mrg|matt|mg|matt\s+gibbs)$/i, 'Matt Gibbs'],
  [/^(matthew\s+nunez|matt\s+nunez|nunez)$/i, 'Matthew Nunez'],
  [/^(syerra|syerra\s+ryan)$/i, 'Syerra Ryan'],
  [/^(ryan|ryan\s+leite)$/i, 'Ryan Leite'],
  [/^(sl|clarizz|cb|clarizz\s+ann\s+billones|clarizz\s+ann\s+alon|clarizz\s+alon)$/i, 'Clarizz Ann Billones'],
  [/^(jr'?|jrg|john|john\s+ross\s+glover|john\s+glover)$/i, 'John Ross Glover'],
  [/^(clint|clint\s+palmer)$/i, 'Clint Palmer'],
  [/^(caitlin|caitlin\s+giuliano)$/i, 'Caitlin Giuliano'],
  [/^(shannen|shannen\s+sharpe)$/i, 'Shannen Sharpe'],
  [/^(simran|simran\s+mohini|simran\s+mohini\s+jain)$/i, 'Simran Mohini Jain'],
  [/^(kelynn|kl|ke'?lynn|ke'?lynn\s+enalls)$/i, "Ke'Lynn Enalls"],
  [/^(ct|catie|catie\s+toole|catherine\s+tool(e)?)$/i, 'Catie Toole'],
  [/^(carly|carly\s+croll?y)$/i, 'Carly Crolly'],
  [/^(brent|bh|brent\s+hannafan)$/i, 'Brent Hannafan'],
  [/^(brittany|bb|brittany\s+brewer)$/i, 'Brittany Brewer'],
  [/^(ally|ally\s+foresman)$/i, 'Ally Foresman'],
  [/^(amy\s+green)$/i, 'Amy Green'],
  [/^(amy\s+nelson)$/i, 'Amy Nelson'],
  [/^(alicia|avh|alicia\s+van[-\s]?huizen)$/i, 'Alicia Van Huizen'],
  [/^(paula|paula\s+valle|paula\s+laborne\s+valle|paula\s+laborne)$/i, 'Paula Laborne Valle'],
  [/^(ridwan|ridwan\s+ahmed)$/i, 'Ridwan Ahmed'],
  [/^(alex|alex\s+little)$/i, 'Alex Little'],
  [/^(ashley|ashley\s+abraham)$/i, 'Ashley Abraham'],
  [/^(fernanda|fernanda\s+guillen)$/i, 'Fernanda Guillen'],
  [/^(joey|joey\s+mundy)$/i, 'Joey Mundy'],
  [/^(kelley|kelley\s+hess)$/i, 'Kelley Hess'],
  [/^(sloan|sloan\s+nickel)$/i, 'Sloan Nickel'],
  [/^(ted|ted\s+canter)$/i, 'Ted Canter'],
  [/^(zach|zachary|zachary\s+lawson|zach\s+lawson)$/i, 'Zachary Lawson'],
  [/^(isabella|isabella\s+maria\s+ardila|isabella\s+ardila)$/i, 'Isabella Maria Ardila'],
  [/^(naomi|naomi\s+alinajad)$/i, 'Naomi Alinajad'],
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

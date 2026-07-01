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
  [/^(alicia|avh|alicia\s+van\s+huizen)$/i, 'Alicia Van Huizen'],
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

export async function GET() {
  const today = new Date().toISOString().slice(0, 10);

  const ptoRows = await sql`
    SELECT employee, type, days FROM pto_entries
    WHERE start_date <= ${today} AND end_date >= ${today}
      AND status = 'Approved'
  `;

  const settingsRows = await sql`SELECT calendar_events FROM app_settings WHERE id = 'singleton'`;
  let calEvents: { name: string; tag: string; start: string; end: string; title: string }[] = [];
  try { calEvents = settingsRows[0]?.calendar_events ? JSON.parse(settingsRows[0].calendar_events) : []; } catch { calEvents = []; }

  const names = new Set<string>();

  for (const r of ptoRows) {
    if (EXCLUDED_TYPES.test(r.type)) continue;
    const days = Number(r.days) || 0;
    if (days < 1) continue;
    names.add(normName(r.employee));
  }

  for (const c of calEvents) {
    if (c.start > today || c.end < today) continue;
    if (EXCLUDED_TYPES.test(c.tag)) continue;
    if (EXCLUDED_TITLE.test(c.title)) continue;
    names.add(normName(c.name));
  }

  const nameList = [...names].map(n => resolveAlias(n));
  return NextResponse.json({ count: names.size, names: nameList });
}

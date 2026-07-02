// Single source of truth for PTO: merges uploaded/DB entries with calendar
// events exactly like the PTO dashboard, so Reports shows the same numbers.

export interface PtoEntry {
  id: string; employee: string; start_date: string; end_date: string;
  days: number; type: string; status: string; notes?: string;
}
export interface CalEvent { id: string; name: string; tag: string; start: string; end: string; title: string; }
export type PtoSource = 'report' | 'calendar' | 'both';
export interface MergedPto {
  key: string; employee: string; start: string; end: string;
  days: number; type: string; status: string; source: PtoSource; calTitle?: string;
}

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
  [/^(carly|carly\s+cro(?:l{1,2}|tt)y)$/i, 'Carly Crotty'],
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

export function resolveAlias(n: string): string {
  const t = (n ?? '').trim();
  for (const [re, canonical] of NAME_ALIASES) if (re.test(t)) return canonical;
  return t;
}
export function normName(n: string) { return resolveAlias(n).trim().toLowerCase().replace(/\s+/g, ' '); }

export const EXCLUDED_TYPES = /wfh|work\s+from\s+home|personal\s+leave|personal/i;
export const EXCLUDED_TITLE = /interview|in\s+office|\bwfh\b|work\s+from\s+home|meeting|call|doctor|dr\.|appointment|lunch|training|onboard|orientation|review|check[\s-]?in|1[\s-]?on[\s-]?1|one[\s-]?on[\s-]?one|\bin\s+\w+\s+for\b|[\w']+\s+in\s+\w+|fundraiser|conference|summit|trip\s+to|travel\s+to|visiting|event|gala|retreat/i;

export function workingDays(start: string, end: string) {
  let count = 0;
  const cur = new Date(start + 'T12:00:00');
  const last = new Date(end + 'T12:00:00');
  while (cur <= last) { const dow = cur.getDay(); if (dow !== 0 && dow !== 6) count++; cur.setDate(cur.getDate() + 1); }
  return count;
}
export function datesOverlap(as: string, ae: string, bs: string, be: string) { return as <= be && ae >= bs; }

// Mirrors PtoClient's merge: DB entries + calendar events, dedup by name+overlap.
export function mergePto(entries: PtoEntry[], calEvents: CalEvent[], hiddenIds: string[] = []): MergedPto[] {
  const hidden = new Set(hiddenIds);
  const rows: MergedPto[] = [];
  const usedCalIds = new Set<string>();

  (entries ?? []).forEach(e => {
    const calMatch = (calEvents ?? []).find(c => normName(c.name) === normName(e.employee) && datesOverlap(e.start_date, e.end_date, c.start, c.end));
    if (calMatch) usedCalIds.add(calMatch.id);
    const days = e.days || workingDays(e.start_date, e.end_date);
    if (days < 1) return;
    rows.push({ key: e.id, employee: resolveAlias(e.employee), start: e.start_date, end: e.end_date, days, type: e.type, status: e.status, source: calMatch ? 'both' : 'report', calTitle: calMatch?.title });
  });

  (calEvents ?? []).forEach(c => {
    if (usedCalIds.has(c.id) || hidden.has(c.id)) return;
    if (c.end < '2026-06-01') return;
    if (EXCLUDED_TYPES.test(c.tag) || c.tag === 'Other') return;
    if (EXCLUDED_TITLE.test(c.title)) return;
    const days = workingDays(c.start, c.end);
    if (days < 1) return;
    rows.push({ key: c.id, employee: resolveAlias(c.name), start: c.start, end: c.end, days, type: c.tag, status: 'Calendar', source: 'calendar', calTitle: c.title });
  });

  const RANK: Record<PtoSource, number> = { both: 0, report: 1, calendar: 2 };
  const sorted = rows.sort((a, b) => RANK[a.source] - RANK[b.source]);
  const kept: MergedPto[] = [];
  for (const row of sorted) {
    const canon = normName(row.employee);
    const dup = kept.find(k => normName(k.employee) === canon && datesOverlap(row.start, row.end, k.start, k.end));
    if (dup) { if (!dup.calTitle && row.calTitle) dup.calTitle = row.calTitle; if (dup.source !== row.source) dup.source = 'both'; }
    else kept.push({ ...row });
  }
  return kept.sort((a, b) => a.start.localeCompare(b.start));
}

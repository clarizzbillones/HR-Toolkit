// Roll a staff roster up by role so we can show "how many attorneys, law clerks,
// etc." Legal roles are bucketed by keyword; every other title keeps its own
// bucket. Returns counts ordered with the key legal roles first, then the rest
// by size, with Unspecified last.
export interface PositionCount { label: string; count: number }

export function positionBreakdown(rows: { position?: string | null }[]): PositionCount[] {
  const counts = new Map<string, number>();
  const bump = (k: string) => counts.set(k, (counts.get(k) ?? 0) + 1);
  for (const r of rows) {
    const p = String(r.position ?? '').trim();
    if (!p) { bump('Unspecified'); continue; }
    if (/clerk/i.test(p)) bump('Law Clerk');
    else if (/paralegal/i.test(p)) bump('Paralegal');
    else if (/attorney|lawyer|counsel|\bpartner\b|\bassociate\b/i.test(p)) bump('Attorney');
    else if (/legal\s*(assistant|asst)/i.test(p)) bump('Legal Assistant');
    else bump(p);
  }
  const PRIORITY = ['Attorney', 'Law Clerk', 'Paralegal', 'Legal Assistant'];
  return [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => {
    const pa = PRIORITY.indexOf(a.label), pb = PRIORITY.indexOf(b.label);
    if (pa !== -1 || pb !== -1) { if (pa === -1) return 1; if (pb === -1) return -1; return pa - pb; }
    if (a.label === 'Unspecified') return 1;
    if (b.label === 'Unspecified') return -1;
    return b.count - a.count || a.label.localeCompare(b.label);
  });
}

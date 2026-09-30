// Roll a staff roster up by role, reading the role straight from each person's
// Position value (no keyword bucketing). Identical titles are merged case- and
// space-insensitively so "Office Manager" and "office manager" count together;
// blanks fall under "Unspecified". Ordered by count (largest first), then name,
// with Unspecified last.
export interface PositionCount { label: string; count: number }

export function positionBreakdown(rows: { position?: string | null }[]): PositionCount[] {
  const counts = new Map<string, number>();   // key -> count
  const display = new Map<string, string>();  // key -> display label (as typed)
  for (const r of rows) {
    const raw = String(r.position ?? '').trim();
    const label = raw || 'Unspecified';
    const key = label.toLowerCase().replace(/\s+/g, ' ');
    if (!display.has(key)) display.set(key, label);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].map(([key, count]) => ({ key, label: display.get(key)!, count })).sort((a, b) => {
    if (a.key === 'unspecified') return 1;
    if (b.key === 'unspecified') return -1;
    return b.count - a.count || a.label.localeCompare(b.label);
  }).map(({ label, count }) => ({ label, count }));
}

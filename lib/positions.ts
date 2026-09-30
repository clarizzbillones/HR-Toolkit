// Roll a staff roster up by role so we can show "how many attorneys, law clerks,
// etc." Legal roles are bucketed by keyword (covering common title variants);
// every other title keeps its own bucket, merged case-insensitively so
// "Office Manager" and "office manager" count together. Ordered with the key
// legal roles first, then the rest by size, with Unspecified last.
export interface PositionCount { label: string; count: number }

// Map a raw position string to a role bucket. Returns null for "no position".
export function roleForPosition(position: string | null | undefined): string | null {
  const p = String(position ?? '').trim();
  if (!p) return null;
  // Order matters: check the most specific legal roles before Attorney, whose
  // keywords (associate/partner/counsel) are broad.
  if (/paralegal/i.test(p)) return 'Paralegal';
  if (/\bclerk\b|law\s*clerk|clerkship/i.test(p)) return 'Law Clerk';
  if (/legal\s*(assistant|asst)/i.test(p)) return 'Legal Assistant';
  if (/attorney|lawyer|\bcounsel\b|of\s*counsel|\bpartner\b|\bassociate\b|\besq\.?\b/i.test(p)) return 'Attorney';
  return p; // keep the title itself as its own bucket
}

export function positionBreakdown(rows: { position?: string | null }[]): PositionCount[] {
  const counts = new Map<string, number>();     // display key -> count
  const display = new Map<string, string>();    // lowercase key -> display label
  for (const r of rows) {
    const role = roleForPosition(r.position);
    const label = role ?? 'Unspecified';
    const key = label.toLowerCase().replace(/\s+/g, ' ');
    if (!display.has(key)) display.set(key, label);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const PRIORITY = ['attorney', 'law clerk', 'paralegal', 'legal assistant'];
  return [...counts.entries()].map(([key, count]) => ({ key, label: display.get(key)!, count })).sort((a, b) => {
    const pa = PRIORITY.indexOf(a.key), pb = PRIORITY.indexOf(b.key);
    if (pa !== -1 || pb !== -1) { if (pa === -1) return 1; if (pb === -1) return -1; return pa - pb; }
    if (a.key === 'unspecified') return 1;
    if (b.key === 'unspecified') return -1;
    return b.count - a.count || a.label.localeCompare(b.label);
  }).map(({ label, count }) => ({ label, count }));
}

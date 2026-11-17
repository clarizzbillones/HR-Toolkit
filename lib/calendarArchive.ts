// Calendar source switch without losing history. When the PTO calendar moved to availability@litson.co,
// everything already pulled from the old calendar was frozen as an archive. What HR Toolkit shows is:
// every archived entry (kept as-is, for accurate reports) + entries from the current calendar that end on
// or after the switch date. Entries are identified by content, so the same leave in both counts once.
import type { CalEvent } from '@/lib/pto';

const parse = (json: string | null | undefined): CalEvent[] => {
  if (!json) return [];
  try { const v = JSON.parse(json); return Array.isArray(v) ? v : []; } catch { return []; }
};

export function calendarWithArchive(liveJson: string | null | undefined, archiveJson: string | null | undefined, cutover: string | null | undefined): CalEvent[] {
  const live = parse(liveJson);
  if (!cutover) return live;
  const out = new Map<string, CalEvent>();
  for (const e of parse(archiveJson)) out.set(e.id, e);
  for (const e of live) if (String(e.end) >= cutover && !out.has(e.id)) out.set(e.id, e);
  return [...out.values()];
}

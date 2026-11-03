// Single source of truth for how dates read across the Litson HR portal.
//
// House format: short month WITH a period, day, full year — e.g. "Oct. 28, 2026".
// May is left un-abbreviated (no period) since it is already short. The parser is
// timezone-safe (it never shifts a calendar date across a day boundary) and
// accepts the shapes dates actually arrive in here: ISO "YYYY-MM-DD"
// (optionally with a time), US "M/D/YYYY", a Date, or an epoch number. Anything
// it cannot understand is returned unchanged, so odd values are never blanked
// out or silently mis-dated.

const MONTHS = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'Jun.', 'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'];

// Pull a {y, m, d} (1-based month) out of whatever we were given, or null.
function parts(value: unknown): { y: number; m: number; d: number } | null {
  if (value == null || value === '') return null;

  if (value instanceof Date) {
    if (isNaN(+value)) return null;
    return { y: value.getFullYear(), m: value.getMonth() + 1, d: value.getDate() };
  }
  if (typeof value === 'number') {
    const dt = new Date(value);
    if (isNaN(+dt)) return null;
    return { y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate() };
  }

  const s = String(value).trim();
  if (!s) return null;

  // ISO: YYYY-MM-DD (with optional time/zone) — read the calendar parts directly.
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const y = +iso[1], m = +iso[2], d = +iso[3];
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) return { y, m, d };
  }

  // US slash: M/D/YYYY or M/D/YY.
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (us) {
    let y = +us[3]; const m = +us[1], d = +us[2];
    if (y < 100) y += 2000;
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) return { y, m, d };
  }

  // Last resort: let the engine try (handles e.g. "Oct 28 2026"). Use a noon
  // anchor when it looks date-only so parsing never rolls back a day in UTC.
  const dt = new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? s + 'T12:00:00' : s);
  if (!isNaN(+dt)) return { y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate() };

  return null;
}

// "Oct. 28, 2026". Empty input → ''. Unparseable input → returned unchanged.
export function formatDate(value: unknown): string {
  const p = parts(value);
  if (!p) return value == null ? '' : String(value);
  return `${MONTHS[p.m - 1]} ${p.d}, ${p.y}`;
}

// Same house format, but a null/blank/unparseable value shows as an em dash —
// handy for table cells that should never render an empty gap.
export function formatDateDash(value: unknown): string {
  const p = parts(value);
  return p ? `${MONTHS[p.m - 1]} ${p.d}, ${p.y}` : '—';
}

// Pure renewal-date helpers (no DB import) so both server and client can use
// them. Parses the free-text "Renews" field into a next-renewal date.
export function renewalDate(renews: string, today = new Date()): Date | null {
  const s = String(renews ?? '');
  const t0 = new Date(today); t0.setHours(0, 0, 0, 0);
  let m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    let yr = parseInt(m[3], 10); if (yr < 100) yr += 2000;
    let dt = new Date(yr, +m[1] - 1, +m[2]); let g = 0;
    while (dt < t0 && /annual|yr|year/i.test(s) && g++ < 10) dt = new Date(dt.getFullYear() + 1, dt.getMonth(), dt.getDate());
    return isNaN(+dt) ? null : dt;
  }
  m = s.match(/\b(\d{1,2})\/(\d{1,2})\b/);
  if (m) {
    let dt = new Date(t0.getFullYear(), +m[1] - 1, +m[2]);
    if (dt < t0) dt = new Date(t0.getFullYear() + 1, +m[1] - 1, +m[2]);
    return isNaN(+dt) ? null : dt;
  }
  return null;
}
export function daysUntilRenewal(renews: string, today = new Date()): number | null {
  const dt = renewalDate(renews, today);
  if (!dt) return null;
  const t0 = new Date(today); t0.setHours(0, 0, 0, 0);
  return Math.round((dt.getTime() - t0.getTime()) / 86400000);
}

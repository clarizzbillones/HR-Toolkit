// Shared parsing for imported trip reports (CSV/XLSX). Column headers are
// matched flexibly so most Trip Desk / spreadsheet exports work unchanged.

export interface TripImportRow {
  who: string; detail: string; cost: string | number;
  matter: string | null; status: string;
  travel_start: string | null; travel_end: string | null;
}

// Normalize a cell (Date object, Excel serial number, or string) to YYYY-MM-DD.
// Returns '' when it can't be parsed as a date.
export function toISODate(v: any): string {
  if (v == null || v === '') return '';
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === 'number' && isFinite(v)) {
    // Excel serial date (days since 1899-12-30)
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    const yy = m[3].length === 2 ? '20' + m[3] : m[3];
    return `${yy}-${String(+m[1]).padStart(2, '0')}-${String(+m[2]).padStart(2, '0')}`;
  }
  const parsed = Date.parse(s);   // handles "July 15, 2026", "15 Jul 2026", etc.
  return isNaN(parsed) ? '' : new Date(parsed).toISOString().slice(0, 10);
}

function makeGetter(row: Record<string, any>) {
  const norm = (h: string) => h.toLowerCase().replace(/[^a-z]/g, '');
  const entries = Object.keys(row).map(k => [norm(k), row[k]] as const);
  // keys are tried in order; first header that *contains* the token wins
  return (tokens: string[]) => {
    for (const t of tokens) {
      for (const [h, val] of entries) {
        if (h.includes(t) && val != null && val !== '') return val;
      }
    }
    return '';
  };
}

export function mapTripRows(json: Record<string, any>[]): TripImportRow[] {
  return json.map(row => {
    const get = makeGetter(row);
    const who = String(get(['traveler', 'employee', 'passenger', 'name', 'who']) || '—').trim();
    const dest = String(get(['destination', 'location', 'city']) || '').trim();
    const text = String(get(['details', 'description', 'tripname', 'notes', 'purpose', 'title']) || '').trim();
    const startRaw = get(['startdate', 'departuredate', 'departdate', 'traveldate', 'tripdate', 'begindate', 'travelstart', 'depart', 'start', 'date']);
    const endRaw = get(['enddate', 'returndate', 'travelend', 'return', 'end']);
    const start = toISODate(startRaw);
    const end = toISODate(endRaw);
    const dateLabel = start && end && start !== end ? `${start} → ${end}` : (start || '');
    // Prefer the report's own descriptive text; fall back to destination; append date if not already present
    const base = text || dest || dateLabel || '(trip)';
    const detail = dateLabel && !base.includes(dateLabel) && !text ? `${base} · ${dateLabel}` : base;
    return {
      who,
      detail,
      cost: get(['totalcost', 'cost', 'amount', 'total', 'spend', 'price']),
      matter: (String(get(['client', 'matter', 'firm', 'case']) || '').trim() || null),
      status: String(get(['status', 'state']) || 'Pending').trim(),
      travel_start: start || null,
      travel_end: end || null,
    };
  }).filter(r => (r.who && r.who !== '—') || r.detail !== '(trip)');
}

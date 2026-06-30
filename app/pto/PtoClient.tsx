'use client';
import { useState, useRef, useMemo, useEffect } from 'react';
import clsx from 'clsx';
import { useToast } from '@/components/Toast';
import EditGate from '@/components/EditGate';

interface PtoEntry {
  id: string; employee: string; start_date: string; end_date: string;
  days: number; type: string; status: string; notes: string;
}

interface CalEvent {
  id: string; name: string; tag: string; start: string; end: string; title: string;
}

type Source = 'report' | 'calendar' | 'both';

interface MergedRow {
  key: string;
  employee: string;
  start: string;
  end: string;
  days: number;
  type: string;
  status: string;
  source: Source;
  calTitle?: string;
}

const TYPE_COLORS: Record<string, string> = {
  'Vacation': 'bg-[#e9f0f5] text-[#3f6b8a]',
  'Sick': 'bg-[#fdeaea] text-[#b0412f]',
  'Personal': 'bg-[#f7efe1] text-[#b07d2a]',
  'Bereavement': 'bg-[#ede9f5] text-[#6b5b8a]',
  'Maternity': 'bg-[#eef5f1] text-[#2f7d5b]',
  'Paternity': 'bg-[#eef5f1] text-[#2f7d5b]',
  'FMLA': 'bg-[#f1ece3] text-[#8b8478]',
  'OOO': 'bg-[#fdeaea] text-[#b0412f]',
  'PTO': 'bg-[#eef5f1] text-[#2f7d5b]',
  'WFH': 'bg-[#e9f0f5] text-[#3f6b8a]',
};
function typeChip(type: string) { return TYPE_COLORS[type] ?? 'bg-[#f1ece3] text-[#8b8478]'; }

const SOURCE_STYLE: Record<Source, string> = {
  both: 'bg-[#eef5f1] text-[#2f7d5b]',
  report: 'bg-[#e9f0f5] text-[#3f6b8a]',
  calendar: 'bg-[#f7efe1] text-[#b07d2a]',
};
const SOURCE_LABEL: Record<Source, string> = {
  both: '✓ Both',
  report: 'Report only',
  calendar: 'Calendar only',
};

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
];

// Types to exclude — partial match (covers "Personal Leave (Commonly used for Half day OOO)" etc.)
const EXCLUDED_TYPES = /wfh|work\s+from\s+home|personal\s+leave|personal/i;

// Calendar event title patterns that indicate it's NOT a time-off entry
const EXCLUDED_TITLE = /interview|in\s+office|\bwfh\b|work\s+from\s+home|meeting|call|doctor|dr\.|appointment|lunch|training|onboard|orientation|review|check[\s-]?in|1[\s-]?on[\s-]?1|one[\s-]?on[\s-]?one|\bin\s+\w+\s+for\b|[\w']+\s+in\s+\w+|fundraiser|conference|summit|trip\s+to|travel\s+to|visiting|event|gala|retreat/i;

function resolveAlias(n: string): string {
  const t = n.trim();
  for (const [re, canonical] of NAME_ALIASES) {
    if (re.test(t)) return canonical;
  }
  return t;
}

function normName(n: string) { return resolveAlias(n).trim().toLowerCase().replace(/\s+/g, ' '); }

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

function fmtShort(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function datesOverlap(as: string, ae: string, bs: string, be: string) {
  return as <= be && ae >= bs;
}

function mapPtoRows(rows: Record<string, string>[]): Omit<PtoEntry, 'id' | 'status'>[] {
  if (!rows.length) return [];
  const headers = Object.keys(rows[0]);
  const find = (re: RegExp) => headers.find(h => re.test(h)) ?? '';
  const nameCol = find(/employee|name|staff|person/i);
  const startCol = find(/start|from|begin|first/i) || find(/date/i);
  const endCol = find(/end|to|thru|through|last|return/i);
  const typeCol = find(/type|reason|category|leave|kind/i);
  const daysCol = find(/days|amount|qty|total|hours/i);
  return rows.map(r => {
    const startStr = r[startCol] ?? '';
    const endStr = r[endCol] ?? '';
    const startDate = startStr ? new Date(startStr) : null;
    const endDate = endStr ? new Date(endStr) : null;
    let days = daysCol ? Number(r[daysCol]) || 0 : 0;
    if (!days && startDate && endDate) days = workingDays(startDate.toISOString().slice(0,10), endDate.toISOString().slice(0,10));
    return {
      employee: r[nameCol] ?? '',
      start_date: startDate ? startDate.toISOString().slice(0, 10) : '',
      end_date: endDate ? endDate.toISOString().slice(0, 10) : startDate ? startDate.toISOString().slice(0, 10) : '',
      days, type: r[typeCol] ?? 'Vacation', notes: '',
    };
  }).filter(r => r.employee && r.start_date);
}

function detectTag(title: string): string {
  const t = title.toUpperCase();
  if (t.includes('OOO') || t.includes('OUT OF OFFICE')) return 'OOO';
  if (t.includes('PTO') || t.includes('VACATION') || t.includes('LEAVE')) return 'PTO';
  if (t.includes('WFH') || t.includes('WORK FROM HOME') || t.includes('REMOTE')) return 'WFH';
  return 'Other';
}


export default function PtoClient({ initialEntries }: { initialEntries: PtoEntry[] }) {
  const { showToast } = useToast();
  const [entries, setEntries] = useState<PtoEntry[]>(initialEntries);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<Omit<PtoEntry, 'id' | 'status'>[] | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadIcsRef = useRef<HTMLInputElement>(null);

  // Calendar connection state
  const [calUrl, setCalUrl] = useState('');
  const [calConnected, setCalConnected] = useState(false);
  const [calEvents, setCalEvents] = useState<CalEvent[]>([]);
  const [calLoading, setCalLoading] = useState(false);
  const [calStatus, setCalStatus] = useState('');

  // Load saved calendar URL + cached events from DB (no live fetch on refresh)
  useEffect(() => {
    fetch('/api/connections').then(r => r.json()).then(data => {
      if (data.calendar_url) setCalUrl(data.calendar_url);
      if (data.calendar_events?.length) {
        setCalEvents(data.calendar_events);
        setCalConnected(true);
      }
    }).catch(() => {});
  }, []);

  // Filters — empty Set = show all; non-empty = include only those checked
  const [filterNames, setFilterNames] = useState<Set<string>>(new Set());
  const [filterTypes, setFilterTypes] = useState<Set<string>>(new Set());
  const [filterStatuses, setFilterStatuses] = useState<Set<string>>(new Set());
  const [filterSources, setFilterSources] = useState<Set<Source>>(new Set());
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterCalEvent, setFilterCalEvent] = useState('');

  function toggleSet<T>(set: Set<T>, val: T): Set<T> {
    const next = new Set(set);
    next.has(val) ? next.delete(val) : next.add(val);
    return next;
  }

  const today = new Date().toISOString().slice(0, 10);

  // --- CSV upload ---
  async function handleFile(file: File) {
    setUploading(true);
    try {
      const { read, utils } = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = read(buf, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });
      const mapped = mapPtoRows(json);
      if (!mapped.length) { showToast('No valid rows found — check column headers'); setUploading(false); return; }
      setPreview(mapped);
    } catch { showToast('Failed to parse file'); }
    setUploading(false);
  }

  async function confirmImport() {
    if (!preview) return;
    setImporting(true);
    const res = await fetch('/api/pto', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entries: preview }) });
    const data = await res.json();
    setEntries(data.entries);
    setPreview(null);
    showToast(`Imported ${preview.length} entries`);
    setImporting(false);
  }

  async function fetchAndSaveIcs(icsUrl: string): Promise<boolean> {
    setCalStatus('Syncing calendar… (up to 30s)');
    try {
      const r = await fetch(`/api/ics-refresh?url=${encodeURIComponent(icsUrl)}`, {
        signal: AbortSignal.timeout(28000),
      });
      if (r.ok) {
        const d = await r.json();
        if (d.events?.length) {
          await fetch('/api/connections', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ calendar_url: icsUrl, calendar_events: d.events }) });
          setCalEvents(d.events);
          setCalConnected(true);
          return true;
        }
      }
    } catch { /* fall through */ }
    return false;
  }

  async function connectCalendar() {
    if (!calUrl.trim()) return;
    setCalLoading(true);
    const icsUrl = calUrl.trim().replace(/^webcal:/, 'https:');
    await fetch('/api/connections', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ calendar_url: calUrl.trim() }) });
    const ok = await fetchAndSaveIcs(icsUrl);
    setCalStatus('');
    if (ok) showToast(`Connected — ${calEvents.length || '?'} events loaded`);
    else showToast('Sync is running in background — refresh the page in a minute');
    setCalLoading(false);
  }

  async function refreshCalendar() {
    setCalLoading(true);
    const icsUrl = calUrl.trim().replace(/^webcal:/, 'https:');
    const ok = await fetchAndSaveIcs(icsUrl);
    setCalStatus('');
    if (ok) showToast(`Refreshed — ${calEvents.length} events`);
    else showToast('Sync running in background — refresh the page in a minute');
    setCalLoading(false);
  }

  async function disconnectCalendar() {
    setCalConnected(false);
    setCalEvents([]);
    await fetch('/api/connections', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ calendar_events: null }) });
    showToast('Calendar disconnected');
  }

  async function handleIcsFile(file: File) {
    setCalLoading(true);
    try {
      const icsText = await file.text();
      const res = await fetch('/api/ics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ icsText }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? 'Invalid ICS file'); setCalLoading(false); return; }
      const events = data.events ?? [];
      setCalEvents(events);
      setCalConnected(true);
      await fetch('/api/connections', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ calendar_events: events }) });
      showToast(`Loaded — ${events.length} events from ICS file`);
    } catch { showToast('Failed to read ICS file'); }
    setCalLoading(false);
  }

  // --- Merge & dedup ---
  const merged = useMemo<MergedRow[]>(() => {
    const rows: MergedRow[] = [];
    const usedCalIds = new Set<string>();

    // Start with report entries — skip WFH, half-day / partial entries (< 1 day)
    entries.forEach(e => {
      if (EXCLUDED_TYPES.test(e.type)) return; // skip WFH
      const days = e.days || workingDays(e.start_date, e.end_date);
      if (days < 1) return; // skip partial / half-day leave

      const canonicalEmployee = resolveAlias(e.employee);
      // Find matching calendar event (same person, overlapping dates) — mark as duplicate
      const calMatch = calEvents.find(c =>
        normName(c.name) === normName(e.employee) && datesOverlap(e.start_date, e.end_date, c.start, c.end)
      );
      if (calMatch) usedCalIds.add(calMatch.id);
      rows.push({
        key: e.id,
        employee: canonicalEmployee,
        start: e.start_date,
        end: e.end_date,
        days,
        type: e.type,
        status: e.status,
        source: calMatch ? 'both' : 'report',
        calTitle: calMatch?.title,
      });
    });

    // Add calendar-only events — skip WFH, non-PTO titles, < 1 day, old events
    calEvents.forEach(c => {
      if (usedCalIds.has(c.id)) return;
      if (c.end < '2026-06-01') return;
      if (EXCLUDED_TYPES.test(c.tag)) return; // skip WFH
      if (EXCLUDED_TITLE.test(c.title)) return; // skip meetings/notes/interviews
      const days = workingDays(c.start, c.end);
      if (days < 1) return; // skip partial / half-day calendar events
      rows.push({
        key: c.id,
        employee: resolveAlias(c.name),
        start: c.start,
        end: c.end,
        days,
        type: c.tag,
        status: 'Calendar',
        source: 'calendar',
        calTitle: c.title,
      });
    });

    // Full dedup: sort by source priority (report/both beat calendar), then eliminate
    // any row whose canonical name + date range overlaps a higher-priority row.
    const SOURCE_RANK: Record<Source, number> = { both: 0, report: 1, calendar: 2 };
    const sorted = rows.sort((a, b) => SOURCE_RANK[a.source] - SOURCE_RANK[b.source]);

    const kept: MergedRow[] = [];
    for (const row of sorted) {
      const canon = normName(row.employee);
      const duplicate = kept.find(k =>
        normName(k.employee) === canon &&
        datesOverlap(row.start, row.end, k.start, k.end)
      );
      if (duplicate) {
        // Absorb calendar title if the kept row doesn't have one
        if (!duplicate.calTitle && row.calTitle) duplicate.calTitle = row.calTitle;
        // Upgrade source to 'both' if the incoming row adds a different source
        if (duplicate.source !== row.source) duplicate.source = 'both';
      } else {
        kept.push({ ...row });
      }
    }

    return kept.sort((a, b) => a.start.localeCompare(b.start));
  }, [entries, calEvents]);

  // Apply filters
  const filtered = useMemo(() => merged.filter(r => {
    if (filterNames.size && !filterNames.has(r.employee)) return false;
    if (filterTypes.size && !filterTypes.has(r.type)) return false;
    if (filterStatuses.size && !filterStatuses.has(r.status)) return false;
    if (filterSources.size && !filterSources.has(r.source)) return false;
    if (filterFrom || filterTo) {
      const ms = filterFrom || '0000-01-01';
      const me = filterTo || '9999-12-31';
      if (r.start < ms || r.start > me) return false;
    }
    if (filterCalEvent && !r.calTitle?.toLowerCase().includes(filterCalEvent.toLowerCase())) return false;
    return true;
  }), [merged, filterNames, filterTypes, filterStatuses, filterSources, filterFrom, filterTo, filterCalEvent]);

  // "Out today" always uses ALL merged data (not filtered) — who is actually out right now
  const outToday = merged.filter(r => r.start <= today && r.end >= today);
  const calOnlyCount = filtered.filter(r => r.source === 'calendar').length;
  const reportOnlyCount = filtered.filter(r => r.source === 'report').length;
  const bothCount = filtered.filter(r => r.source === 'both').length;

  const activePeriodLabel = filterFrom && filterTo
    ? `${fmtShort(filterFrom)} – ${fmtShort(filterTo)}`
    : filterFrom ? `From ${fmtShort(filterFrom)}`
    : filterTo ? `Up to ${fmtShort(filterTo)}`
    : 'All dates';
  const names = [...new Set(merged.map(r => r.employee))].sort();
  const types = [...new Set(merged.map(r => r.type))].sort();
  const statuses = [...new Set(merged.map(r => r.status))].sort();

  // Chart data: days per employee from filtered rows
  const chartData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(r => { map[r.employee] = (map[r.employee] ?? 0) + r.days; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 15);
  }, [filtered]);

  function exportCsv() {
    const exportRows = filtered.filter(r => r.days >= 1);
    const headers = ['Employee','Start','End','Days','Type','Status','Source','Calendar Event'];
    const rows = exportRows.map(r => [
      r.employee, r.start, r.end, r.days, r.type, r.status,
      SOURCE_LABEL[r.source], r.calTitle ?? ''
    ].join(','));
    const blob = new Blob([headers.join(',') + '\n' + rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `pto-report.csv`; a.click();
    showToast(`Exported ${exportRows.length} entries`);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <header className="flex items-center gap-4 px-8 py-5 bg-white border-b border-border flex-shrink-0 flex-wrap">
        <div>
          <h1 className="font-spectral text-[23px] font-semibold text-text-primary">PTO Reports</h1>
          <p className="text-sm text-text-muted mt-0.5">{merged.length} total entries · {outToday.length} out today</p>
        </div>
        <div className="ml-auto flex items-center gap-2.5">
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          <input ref={uploadIcsRef} type="file" accept=".ics" className="hidden"
            onChange={e => { if (e.target.files?.[0]) { handleIcsFile(e.target.files[0]); e.target.value = ''; } }} />
          <EditGate>
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="bg-white border border-border-light text-ink text-sm font-semibold px-4 py-2.5 rounded-ctrl hover:bg-canvas transition-colors disabled:opacity-50">
              {uploading ? 'Reading…' : '↑ Upload CSV / XLSX'}
            </button>
          </EditGate>
          {merged.length > 0 && (
            <button onClick={exportCsv}
              className="bg-ink text-white text-sm font-semibold px-4 py-2.5 rounded-ctrl hover:bg-ink-dark transition-colors">
              ↓ Export Combined Report
            </button>
          )}
        </div>
      </header>

      {/* Import preview */}
      {preview && (
        <div className="px-8 py-4 bg-[#f7efe1] border-b border-border flex-shrink-0">
          <div className="flex items-center gap-4 mb-3">
            <span className="text-sm font-semibold text-text-primary">{preview.length} rows parsed — review before importing</span>
            <button onClick={confirmImport} disabled={importing}
              className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark disabled:opacity-50">
              {importing ? 'Importing…' : 'Confirm Import'}
            </button>
            <button onClick={() => setPreview(null)} className="text-sm text-text-muted hover:text-text-primary">Cancel</button>
          </div>
          <div className="overflow-x-auto max-h-40 border border-border rounded-card bg-white">
            <table className="text-xs w-full">
              <thead className="bg-[#f1ece3] sticky top-0">
                <tr>{['Employee','Start','End','Days','Type'].map(h => <th key={h} className="text-left px-3 py-2 font-semibold text-text-secondary">{h}</th>)}</tr>
              </thead>
              <tbody>
                {preview.slice(0, 15).map((r, i) => (
                  <tr key={i} className="border-t border-[#f1ece3]">
                    <td className="px-3 py-1.5">{r.employee}</td>
                    <td className="px-3 py-1.5">{r.start_date}</td>
                    <td className="px-3 py-1.5">{r.end_date}</td>
                    <td className="px-3 py-1.5">{r.days}</td>
                    <td className="px-3 py-1.5"><span className={clsx('px-2 py-0.5 rounded-full text-xs font-semibold', typeChip(r.type))}>{r.type}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {/* Two source panels */}
        <div className="grid grid-cols-2 gap-4 px-8 pt-5 pb-4">
          {/* Report source */}
          <div className="bg-white border border-border rounded-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-[#3f6b8a]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#3f6b8a]">Uploaded Report</span>
              {entries.length > 0 && <span className="ml-auto text-xs font-semibold text-text-muted">{entries.length} entries</span>}
            </div>
            {entries.length > 0
              ? <p className="text-sm text-text-secondary">CSV/XLSX imported — {entries.length} PTO records loaded.</p>
              : <p className="text-sm text-text-muted">No report uploaded yet. Use ↑ Upload CSV / XLSX above.</p>}
          </div>

          {/* Calendar source */}
          <div className="bg-white border border-border rounded-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-2 h-2 rounded-full ${calConnected ? 'bg-[#2f7d5b]' : 'bg-[#d8d1c4]'}`} />
              <span className={`text-xs font-bold uppercase tracking-wider ${calConnected ? 'text-[#2f7d5b]' : 'text-text-muted'}`}>
                Outlook Calendar {calConnected ? '· Connected' : ''}
              </span>
              {calConnected && <span className="ml-auto text-xs font-semibold text-text-muted">{calEvents.length} events</span>}
            </div>
            {calConnected ? (
              <div className="flex items-center gap-2">
                <p className="text-sm text-[#2f7d5b] font-medium flex-1">Litson Availability synced</p>
                <button onClick={refreshCalendar} disabled={calLoading}
                  className="text-xs text-[#3f6b8a] hover:text-ink font-semibold disabled:opacity-50">{calLoading ? 'Refreshing…' : 'Refresh'}</button>
                <button onClick={disconnectCalendar}
                  className="text-xs text-text-muted hover:text-litred-alt font-semibold">Disconnect</button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 mt-1">
                <div className="flex gap-2">
                  <input value={calUrl} onChange={e => setCalUrl(e.target.value)}
                    placeholder="Paste published Outlook ICS link…"
                    className="flex-1 border border-border-light rounded-ctrl px-2.5 py-1.5 text-xs focus:outline-none focus:border-ink" />
                  <button onClick={connectCalendar} disabled={calLoading || !calUrl.trim()}
                    className="bg-[#0F6CBD] text-white text-xs font-semibold px-3 py-1.5 rounded-ctrl hover:opacity-90 disabled:opacity-40 whitespace-nowrap min-w-[80px] text-center">
                    {calLoading ? 'Connecting…' : 'Connect'}
                  </button>
                </div>
                {calStatus && <p className="text-[11px] text-[#3f6b8a]">{calStatus}</p>}
                <div className="flex items-center gap-2"><div className="flex-1 h-px bg-border" /><span className="text-xs text-text-faint">or</span><div className="flex-1 h-px bg-border" /></div>
                <button onClick={() => uploadIcsRef.current?.click()} disabled={calLoading}
                  className="w-full border border-dashed border-border text-text-muted text-xs font-semibold py-2 rounded-ctrl hover:border-ink hover:text-ink disabled:opacity-40">
                  ↑ Upload .ics file (if link doesn't work)
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        {merged.length > 0 && (
          <div className="grid grid-cols-4 gap-3 px-8 pb-4">
            <Stat label="Out Today" value={outToday.length} color="#b0412f" sub={`as of ${fmtShort(today)} · all time`} />
            <Stat label="Matched in Both" value={bothCount} color="#2f7d5b" sub={`same entry found in HR report AND calendar · ${activePeriodLabel}`} />
            <Stat label="Report Only" value={reportOnlyCount} color="#3f6b8a" sub={`in HR report, no calendar match · ${activePeriodLabel}`} />
            <Stat label="Calendar Only" value={calOnlyCount} color="#b07d2a" sub={`in calendar only, no HR report entry · ${activePeriodLabel}`} />
          </div>
        )}

        {/* Chart + summary table */}
        {filtered.length > 0 && chartData.length > 0 && (
          <div className="grid grid-cols-2 gap-4 px-8 pb-4">
            {/* Bar chart */}
            <div className="bg-white border border-border rounded-card p-5">
              <div className="text-xs font-bold uppercase tracking-wider text-text-muted mb-1">Working Days Off by Employee</div>
              <div className="text-[11px] text-text-faint mb-4">Weekends excluded · {activePeriodLabel}</div>
              <div className="space-y-2">
                {chartData.map(([name, days]) => {
                  const max = chartData[0][1];
                  const pct = Math.round((days / max) * 100);
                  return (
                    <div key={name} className="flex items-center gap-2">
                      <div className="w-28 text-xs text-text-secondary truncate text-right flex-shrink-0" title={name}>{name}</div>
                      <div className="flex-1 bg-[#f1ece3] rounded-full h-5 overflow-hidden">
                        <div className="h-full bg-[#b0412f] rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="w-8 text-xs font-semibold text-text-primary text-right flex-shrink-0">{days}d</div>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Summary table */}
            <div className="bg-white border border-border rounded-card overflow-hidden">
              <div className="p-4 pb-2">
                <div className="text-xs font-bold uppercase tracking-wider text-text-muted">Summary</div>
                <div className="text-[11px] text-text-faint mt-0.5">{activePeriodLabel} · working days only</div>
              </div>
              <table className="w-full text-xs">
                <thead className="bg-[#f1ece3]">
                  <tr>
                    <th className="text-left px-4 py-2 font-bold text-text-secondary">Employee</th>
                    <th className="text-right px-4 py-2 font-bold text-text-secondary">Entries</th>
                    <th className="text-right px-4 py-2 font-bold text-text-secondary">Days</th>
                  </tr>
                </thead>
                <tbody>
                  {chartData.map(([name, days]) => {
                    const count = filtered.filter(r => r.employee === name).length;
                    return (
                      <tr key={name} className="border-t border-[#f1ece3]">
                        <td className="px-4 py-2 text-text-primary font-medium">{name}</td>
                        <td className="px-4 py-2 text-text-secondary text-right">{count}</td>
                        <td className="px-4 py-2 font-semibold text-text-primary text-right">{days}</td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-border bg-[#f1ece3]">
                    <td className="px-4 py-2 font-bold text-text-primary">Total</td>
                    <td className="px-4 py-2 font-bold text-text-primary text-right">{filtered.length}</td>
                    <td className="px-4 py-2 font-bold text-text-primary text-right">{filtered.reduce((s, r) => s + r.days, 0)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Filters */}
        {merged.length > 0 && (
          <div className="flex flex-col gap-2 px-8 pb-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-text-muted">Filter:</span>
              <CheckFilter label="Employee" options={names} selected={filterNames} onChange={setFilterNames} />
              <CheckFilter label="PTO Type" options={types} selected={filterTypes} onChange={setFilterTypes} />
              <CheckFilter label="Status" options={statuses} selected={filterStatuses} onChange={setFilterStatuses} />
              <CheckFilter<Source> label="Source" options={['both','report','calendar']} selected={filterSources}
                onChange={setFilterSources}
                renderOption={v => v === 'both' ? '✓ Both' : v === 'report' ? 'Report only' : 'Calendar only'} />
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-text-muted font-semibold">From</span>
                <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
                  className="border border-border-light rounded-ctrl px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:border-ink" />
                <span className="text-text-muted text-xs">to</span>
                <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
                  className="border border-border-light rounded-ctrl px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:border-ink" />
              </div>
              <div className="flex items-center gap-1">
                {['Jun','Jul','Aug','Sep'].map((label, i) => {
                  const y = 2026; const m = i + 6;
                  const from = `${y}-${String(m).padStart(2,'0')}-01`;
                  const to = new Date(y, m, 0).toISOString().slice(0,10);
                  const active = filterFrom === from && filterTo === to;
                  return (
                    <button key={label} onClick={() => { setFilterFrom(from); setFilterTo(to); }}
                      className={`text-xs font-semibold px-2 py-1 rounded-ctrl transition-colors ${active ? 'bg-ink text-white' : 'bg-[#f1ece3] text-text-secondary hover:bg-[#e8e3da]'}`}>
                      {label}
                    </button>
                  );
                })}
              </div>
              <input type="text" value={filterCalEvent} onChange={e => setFilterCalEvent(e.target.value)}
                placeholder="Search calendar event…"
                className="border border-border-light rounded-ctrl px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:border-ink w-48" />
              {(filterNames.size || filterTypes.size || filterStatuses.size || filterSources.size || filterFrom || filterTo || filterCalEvent) ? (
                <button onClick={() => { setFilterNames(new Set()); setFilterTypes(new Set()); setFilterStatuses(new Set()); setFilterSources(new Set()); setFilterFrom(''); setFilterTo(''); setFilterCalEvent(''); }}
                  className="text-xs font-semibold text-text-muted hover:text-text-primary underline">Clear all</button>
              ) : null}
              <span className="ml-auto text-xs text-text-muted font-semibold">{filtered.length} of {merged.length} entries</span>
            </div>
          </div>
        )}

        {/* Combined table */}
        <div className="px-8 pb-8">
          <div className="bg-white border border-border rounded-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#f1ece3] border-b border-border">
                <tr>
                  {['Employee','PTO Type','From','To','Days','Status','Source','Calendar Event'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-text-secondary">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.key} className={clsx('border-t border-[#f1ece3] hover:bg-canvas transition-colors', r.source === 'calendar' && 'bg-[#fffbf5]')}>
                    <td className="px-4 py-3 font-medium text-text-primary">{r.employee}</td>
                    <td className="px-4 py-3"><span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full', typeChip(r.type))}>{r.type}</span></td>
                    <td className="px-4 py-3 text-text-secondary">{fmtShort(r.start)}</td>
                    <td className="px-4 py-3 text-text-secondary">{fmtShort(r.end)}</td>
                    <td className="px-4 py-3 text-text-secondary">{r.days}</td>
                    <td className="px-4 py-3">
                      <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full',
                        r.status === 'Approved' ? 'bg-[#eef5f1] text-[#2f7d5b]' :
                        r.status === 'Calendar' ? 'bg-[#f7efe1] text-[#b07d2a]' :
                        r.status === 'Pending' ? 'bg-[#f7efe1] text-[#b07d2a]' :
                        'bg-[#fdeaea] text-[#b0412f]'
                      )}>{r.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full', SOURCE_STYLE[r.source])}>{SOURCE_LABEL[r.source]}</span>
                    </td>
                    <td className="px-4 py-3 text-text-muted text-xs max-w-[180px] truncate">{r.calTitle ?? '—'}</td>
                  </tr>
                ))}
                {filtered.length === 0 && merged.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-text-muted">
                    Upload a CSV/XLSX report and/or connect the Outlook calendar to get started
                  </td></tr>
                )}
                {filtered.length === 0 && merged.length > 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-text-muted">No entries match the current filters</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function CheckFilter<T extends string>({
  label, options, selected, onChange, renderOption,
}: {
  label: string;
  options: T[];
  selected: Set<T>;
  onChange: (next: Set<T>) => void;
  renderOption?: (v: T) => string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function close(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  function toggle(v: T) {
    const next = new Set(selected);
    next.has(v) ? next.delete(v) : next.add(v);
    onChange(next);
  }

  const count = selected.size;
  const label_ = count === 0 ? `All ${label}s` : count === 1 ? [...selected][0] : `${label} (${count})`;

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        className={clsx(
          'flex items-center gap-1.5 border rounded-ctrl px-3 py-1.5 text-sm bg-white focus:outline-none transition-colors',
          count > 0 ? 'border-ink font-semibold text-ink' : 'border-border-light text-text-secondary hover:border-ink'
        )}>
        {label_}
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 4l4 4 4-4"/></svg>
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 bg-white border border-border rounded-card shadow-lg min-w-[160px] py-1 max-h-60 overflow-y-auto">
          <div className="flex border-b border-border mb-1">
            <button onClick={() => onChange(new Set(options))}
              className="flex-1 px-3 py-1.5 text-xs font-semibold text-text-secondary hover:bg-canvas text-left">
              Select all
            </button>
            <button onClick={() => onChange(new Set())}
              className="flex-1 px-3 py-1.5 text-xs font-semibold text-text-muted hover:bg-canvas text-left border-l border-border">
              Clear
            </button>
          </div>
          {options.map(v => (
            <label key={v} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-canvas cursor-pointer">
              <input type="checkbox" checked={selected.has(v)} onChange={() => toggle(v)}
                className="accent-ink w-3.5 h-3.5 rounded" />
              <span className="text-sm text-text-primary">{renderOption ? renderOption(v) : v}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color, sub }: { label: string; value: number; color: string; sub?: string }) {
  return (
    <div className="bg-white border border-border rounded-card px-4 py-3">
      <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{label}</div>
      <div className="font-spectral text-2xl font-semibold mt-1" style={{ color }}>{value}</div>
      {sub && <div className="text-xs text-text-muted mt-0.5">{sub}</div>}
    </div>
  );
}

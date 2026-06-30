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

function normName(n: string) { return n.trim().toLowerCase().replace(/\s+/g, ' '); }

function workingDays(start: string, end: string) {
  let count = 0;
  const cur = new Date(start + 'T12:00:00');
  const last = new Date(end + 'T12:00:00');
  while (cur <= last) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count || 1;
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

  // Filters
  const [filterName, setFilterName] = useState('');
  const [filterSource, setFilterSource] = useState<'' | Source>('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

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

  async function connectCalendar() {
    if (!calUrl.trim()) return;
    setCalLoading(true);
    const icsUrl = calUrl.trim().replace(/^webcal:/, 'https:');

    let icsText: string | null = null;

    // Fetch via our server proxy (handles CORS + redirects + browser-like headers)
    setCalStatus('Fetching calendar — this may take up to 30 seconds…');
    try {
      const proxyRes = await fetch(`/api/ics-proxy?url=${encodeURIComponent(icsUrl)}`, {
        signal: AbortSignal.timeout(58000),
      });
      if (proxyRes.ok) {
        const text = await proxyRes.text();
        if (text.includes('BEGIN:VCALENDAR')) icsText = text;
      }
    } catch { /* fall through */ }

    if (!icsText) {
      // Last resort: trigger server-side refresh (saves directly to DB)
      setCalStatus('Trying alternate fetch…');
      try {
        const res = await fetch(`/api/ics-refresh?url=${encodeURIComponent(icsUrl)}`, { signal: AbortSignal.timeout(32000) });
        const data = await res.json();
        if (res.ok && data.ok) {
          const conn = await fetch('/api/connections').then(r => r.json());
          if (conn.calendar_events?.length) {
            setCalEvents(conn.calendar_events);
            setCalConnected(true);
            setCalStatus('');
            showToast(`Connected — ${data.events} events loaded`);
            setCalLoading(false);
            return;
          }
        }
      } catch { /* fall through */ }
      setCalStatus('');
      showToast('Could not reach the calendar — try uploading the .ics file instead');
      setCalLoading(false);
      return;
    }

    // Parse the ICS text
    try {
      const res = await fetch('/api/ics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ icsText }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? 'Invalid calendar data'); setCalLoading(false); return; }
      const events = data.events ?? [];
      setCalEvents(events);
      setCalConnected(true);
      setCalStatus('');
      await fetch('/api/connections', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ calendar_url: calUrl.trim(), calendar_events: events }) });
      showToast(`Connected — ${events.length} events loaded`);
    } catch {
      showToast('Failed to parse calendar');
    }
    setCalLoading(false);
  }

  async function refreshCalendar() {
    setCalLoading(true);
    setCalStatus('Refreshing from Office 365…');
    try {
      const icsUrl = calUrl.trim().replace(/^webcal:/, 'https:');
      const res = await fetch(`/api/ics-refresh?url=${encodeURIComponent(icsUrl)}`, { signal: AbortSignal.timeout(32000) });
      const data = await res.json();
      if (!res.ok) {
        setCalStatus('');
        showToast(data.error ?? 'Refresh failed — try uploading the .ics file');
        setCalLoading(false);
        return;
      }
      // Reload the updated events from DB
      const conn = await fetch('/api/connections').then(r => r.json());
      if (conn.calendar_events?.length) setCalEvents(conn.calendar_events);
      setCalStatus('');
      showToast(`Refreshed — ${data.events} events`);
    } catch {
      setCalStatus('');
      showToast('Refresh timed out — try uploading the .ics file');
    }
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

    // Start with report entries
    entries.forEach(e => {
      // Find matching calendar event (same person, overlapping dates)
      const calMatch = calEvents.find(c =>
        normName(c.name) === normName(e.employee) && datesOverlap(e.start_date, e.end_date, c.start, c.end)
      );
      if (calMatch) usedCalIds.add(calMatch.id);
      rows.push({
        key: e.id,
        employee: e.employee,
        start: e.start_date,
        end: e.end_date,
        days: e.days || workingDays(e.start_date, e.end_date),
        type: e.type,
        status: e.status,
        source: calMatch ? 'both' : 'report',
        calTitle: calMatch?.title,
      });
    });

    // Add calendar-only events (no match in report)
    calEvents.forEach(c => {
      if (usedCalIds.has(c.id)) return;
      rows.push({
        key: c.id,
        employee: c.name,
        start: c.start,
        end: c.end,
        days: workingDays(c.start, c.end),
        type: c.tag,
        status: 'Calendar',
        source: 'calendar',
        calTitle: c.title,
      });
    });

    return rows.sort((a, b) => a.start.localeCompare(b.start));
  }, [entries, calEvents]);

  // Apply filters
  const filtered = useMemo(() => merged.filter(r => {
    if (filterName && normName(r.employee) !== normName(filterName)) return false;
    if (filterSource && r.source !== filterSource) return false;
    if (filterFrom || filterTo) {
      const ms = filterFrom || '0000-01-01';
      const me = filterTo || '9999-12-31';
      if (r.start < ms || r.start > me) return false;
    }
    return true;
  }), [merged, filterName, filterSource, filterFrom, filterTo]);

  const outToday = merged.filter(r => r.start <= today && r.end >= today);
  const calOnlyCount = merged.filter(r => r.source === 'calendar').length;
  const reportOnlyCount = merged.filter(r => r.source === 'report').length;
  const bothCount = merged.filter(r => r.source === 'both').length;
  const names = [...new Set(merged.map(r => r.employee))].sort();

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
            <Stat label="Out Today" value={outToday.length} color="#b0412f" />
            <Stat label="In Both Sources" value={bothCount} color="#2f7d5b" />
            <Stat label="Report Only" value={reportOnlyCount} color="#3f6b8a" sub="not in calendar" />
            <Stat label="Calendar Only" value={calOnlyCount} color="#b07d2a" sub="not in report" />
          </div>
        )}

        {/* Filters */}
        {merged.length > 0 && (
          <div className="flex items-center gap-3 px-8 pb-3 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wider text-text-muted">Filter:</span>
            <select value={filterName} onChange={e => setFilterName(e.target.value)}
              className="border border-border-light rounded-ctrl px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-ink">
              <option value="">All people</option>
              {names.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <select value={filterSource} onChange={e => setFilterSource(e.target.value as '' | Source)}
              className="border border-border-light rounded-ctrl px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-ink">
              <option value="">All sources</option>
              <option value="both">✓ In both</option>
              <option value="report">Report only</option>
              <option value="calendar">Calendar only</option>
            </select>
            <div className="flex items-center gap-1.5">
              <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
                className="border border-border-light rounded-ctrl px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:border-ink" />
              <span className="text-text-muted text-xs">to</span>
              <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
                className="border border-border-light rounded-ctrl px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:border-ink" />
            </div>
            {/* Quick month shortcuts */}
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
            {(filterName || filterSource || filterFrom || filterTo) && (
              <button onClick={() => { setFilterName(''); setFilterSource(''); setFilterFrom(''); setFilterTo(''); }}
                className="text-xs font-semibold text-text-muted hover:text-text-primary underline">Clear</button>
            )}
            <span className="ml-auto text-xs text-text-muted font-semibold">{filtered.length} of {merged.length} entries</span>
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

function Stat({ label, value, color, sub }: { label: string; value: number; color: string; sub?: string }) {
  return (
    <div className="bg-white border border-border rounded-card px-4 py-3">
      <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{label}</div>
      <div className="font-spectral text-2xl font-semibold mt-1" style={{ color }}>{value}</div>
      {sub && <div className="text-xs text-text-muted mt-0.5">{sub}</div>}
    </div>
  );
}

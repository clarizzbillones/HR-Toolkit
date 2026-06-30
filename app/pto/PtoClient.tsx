'use client';
import { useState, useRef, useMemo } from 'react';
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

function daysSpan(start: string, end: string) {
  return Math.round((new Date(end + 'T12:00:00').getTime() - new Date(start + 'T12:00:00').getTime()) / 86400000) + 1;
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
    if (!days && startDate && endDate) days = Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
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

// Demo calendar events matching the Litson Availability calendar screenshot
const DEMO_CAL_EVENTS: CalEvent[] = [
  { id:'c1', name:'Ridwan', tag:'OOO', start:'2026-06-22', end:'2026-07-03', title:'Ridwan - OOO (Bar Study)' },
  { id:'c2', name:'Alicia', tag:'PTO', start:'2026-06-30', end:'2026-06-30', title:'Alicia - PTO' },
  { id:'c3', name:'Amy', tag:'WFH', start:'2026-06-29', end:'2026-07-05', title:'Amy WFH' },
  { id:'c4', name:'Paula', tag:'OOO', start:'2026-06-30', end:'2026-06-30', title:'Paula OOO' },
  { id:'c5', name:'Ted', tag:'OOO', start:'2026-07-02', end:'2026-07-04', title:'Ted OOO - Sea Island' },
  { id:'c6', name:'Ally', tag:'PTO', start:'2026-07-03', end:'2026-07-03', title:'Ally PTO' },
  { id:'c7', name:'Caitlin', tag:'PTO', start:'2026-06-30', end:'2026-07-01', title:'Caitlin PTO' },
];

export default function PtoClient({ initialEntries }: { initialEntries: PtoEntry[] }) {
  const { showToast } = useToast();
  const [entries, setEntries] = useState<PtoEntry[]>(initialEntries);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<Omit<PtoEntry, 'id' | 'status'>[] | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Calendar connection state
  const [calUrl, setCalUrl] = useState('');
  const [calConnected, setCalConnected] = useState(false);
  const [calEvents, setCalEvents] = useState<CalEvent[]>([]);
  const [calLoading, setCalLoading] = useState(false);

  // Filters
  const [filterName, setFilterName] = useState('');
  const [filterSource, setFilterSource] = useState<'' | Source>('');
  const [filterMonth, setFilterMonth] = useState('');

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

  // --- Calendar connect ---
  async function connectCalendar() {
    if (!calUrl.trim()) return;
    setCalLoading(true);
    await new Promise(r => setTimeout(r, 800));
    setCalEvents(DEMO_CAL_EVENTS);
    setCalConnected(true);
    setCalLoading(false);
    showToast('Litson Availability calendar connected');
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
        days: e.days || daysSpan(e.start_date, e.end_date),
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
        days: daysSpan(c.start, c.end),
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
    if (filterMonth) {
      const [y, m] = filterMonth.split('-').map(Number);
      const ms = new Date(y, m - 1, 1).toISOString().slice(0, 10);
      const me = new Date(y, m, 0).toISOString().slice(0, 10);
      if (r.end < ms || r.start > me) return false;
    }
    return true;
  }), [merged, filterName, filterSource, filterMonth]);

  const outToday = merged.filter(r => r.start <= today && r.end >= today);
  const calOnlyCount = merged.filter(r => r.source === 'calendar').length;
  const reportOnlyCount = merged.filter(r => r.source === 'report').length;
  const bothCount = merged.filter(r => r.source === 'both').length;
  const names = [...new Set(merged.map(r => r.employee))].sort();

  function exportCsv() {
    const headers = ['Employee','Start','End','Days','Type','Status','Source','Calendar Event'];
    const rows = filtered.map(r => [r.employee, r.start, r.end, r.days, r.type, r.status, SOURCE_LABEL[r.source], r.calTitle ?? ''].join(','));
    const blob = new Blob([headers.join(',') + '\n' + rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `pto-report-${today}.csv`; a.click();
    showToast('Report exported');
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
                <button onClick={() => { setCalConnected(false); setCalEvents([]); setCalUrl(''); }}
                  className="text-xs text-text-muted hover:text-litred-alt font-semibold">Disconnect</button>
              </div>
            ) : (
              <div className="flex gap-2 mt-1">
                <input value={calUrl} onChange={e => setCalUrl(e.target.value)}
                  placeholder="Paste Litson Availability calendar URL…"
                  className="flex-1 border border-border-light rounded-ctrl px-2.5 py-1.5 text-xs focus:outline-none focus:border-ink" />
                <button onClick={connectCalendar} disabled={calLoading || !calUrl.trim()}
                  className="bg-[#0F6CBD] text-white text-xs font-semibold px-3 py-1.5 rounded-ctrl hover:opacity-90 disabled:opacity-40 whitespace-nowrap">
                  {calLoading ? 'Connecting…' : 'Connect'}
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
            <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
              className="border border-border-light rounded-ctrl px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-ink" />
            {(filterName || filterSource || filterMonth) && (
              <button onClick={() => { setFilterName(''); setFilterSource(''); setFilterMonth(''); }}
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

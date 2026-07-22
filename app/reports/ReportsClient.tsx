'use client';
import { useState, useEffect, useRef } from 'react';
import clsx from 'clsx';
import { useToast } from '@/components/Toast';
import { mergePto } from '@/lib/pto';
import { reviewRows } from '@/lib/reviews';
import { mapTripRows } from '@/lib/trips';

// Travel date (from the imported report) shown after the traveler name
function tripDate(t: any): string {
  const s = (t.travel_start ?? '').slice(0, 10);
  const e = (t.travel_end ?? '').slice(0, 10);
  if (s && e && s !== e) return `${s} → ${e}`;
  if (s) return s;
  return (t.created_at ?? '').slice(0, 10) || '—';
}
// Case-insensitive status chip (covers imported completed/confirmed/pending/etc.)
function tripStatusChip(status: string): string {
  const s = (status ?? '').toLowerCase();
  if (/appro|complete|confirm|book|paid|done/.test(s)) return 'bg-[#eef5f1] text-[#2f7d5b]';
  if (/hold|process|review/.test(s)) return 'bg-[#e9f0f5] text-[#3f6b8a]';
  if (/deny|denied|reject|cancel/.test(s)) return 'bg-[#fdeaea] text-[#b0412f]';
  if (/pend|await|request/.test(s)) return 'bg-[#f7efe1] text-[#b07d2a]';
  return 'bg-[#f1ece3] text-text-secondary';
}

// Fetch DB PTO + calendar events + hidden ids, return the SAME merged rows the
// PTO dashboard shows, mapped to the report row shape (single source of truth).
async function fetchMergedPto(): Promise<any[]> {
  const [monthly, conn] = await Promise.all([
    fetch('/api/reports?tab=monthly').then(r => r.json()).catch(() => ({})),
    fetch('/api/connections').then(r => r.json()).catch(() => ({})),
  ]);
  const merged = mergePto(monthly.pto ?? [], conn.calendar_events ?? [], conn.hidden_cal_ids ?? []);
  return merged.map(m => ({ id: m.key, employee: m.employee, type: m.type, start_date: m.start, end_date: m.end, days: m.days, status: m.status, source: m.source }));
}

type Tab = 'monthly' | 'trips' | 'pto' | 'reviews' | 'insurance' | 'reimbursements' | 'cashout';

function fmt$(n: number) { return `$${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

// ---- File attachments (invoices, receipts, supporting docs) ----
const MAX_ATTACH = 4 * 1024 * 1024; // ~4MB — stays under the serverless request-body limit
const ATTACH_ACCEPT = '.pdf,.docx,.png,.jpg,.jpeg,.webp,.gif,application/pdf,image/*';
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('read failed'));
    r.readAsDataURL(file);
  });
}
// A small "view attached file" link for a table row.
function AttachLink({ tab, id, name }: { tab: string; id: string; name?: string | null }) {
  const short = name ? (name.length > 20 ? name.slice(0, 20) + '…' : name) : 'View';
  return (
    <a href={`/api/reports/attachment?tab=${tab}&id=${id}`} target="_blank" rel="noopener noreferrer"
      className="text-[#3f6b8a] hover:underline text-xs font-medium inline-flex items-center gap-1" title={name || 'View attachment'}>
      📎 <span className="truncate max-w-[130px]">{short}</span>
    </a>
  );
}
// Row-level attach control: view the attached file, and attach or replace it on
// an already-saved record (uploads the raw file via multipart).
function RowAttach({ tab, id, hasAttachment, name, onChange }: { tab: string; id: string; hasAttachment: boolean; name?: string | null; onChange: (name: string) => void }) {
  const { showToast } = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function upload(file: File) {
    if (file.size > MAX_ATTACH) { showToast('File too large (max 4 MB)'); return; }
    setBusy(true);
    try {
      const fd = new FormData(); fd.append('tab', tab); fd.append('id', id); fd.append('file', file);
      const res = await fetch('/api/reports/attachment', { method: 'POST', body: fd });
      const d = await res.json();
      if (!res.ok) { showToast(d.error ?? 'Upload failed'); return; }
      onChange(d.name); showToast('Attachment saved');
    } catch { showToast('Upload failed'); }
    finally { setBusy(false); if (ref.current) ref.current.value = ''; }
  }
  return (
    <span className="inline-flex items-center gap-2">
      <input ref={ref} type="file" accept={ATTACH_ACCEPT} className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); }} />
      {hasAttachment && <AttachLink tab={tab} id={id} name={name} />}
      <button type="button" onClick={() => ref.current?.click()} disabled={busy}
        className="text-xs font-medium text-[#3f6b8a] hover:underline disabled:opacity-50">
        {busy ? 'Uploading…' : hasAttachment ? 'Replace' : '⇪ Attach'}
      </button>
    </span>
  );
}
// Reusable "attach a file" row for the add forms: shows the picked file name,
// enforces the size cap, and hands the picked File back to the parent.
function AttachField({ file, onPick, label = 'Attachment (optional)' }: { file: File | null; onPick: (f: File | null) => void; label?: string }) {
  const { showToast } = useToast();
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <label className="block text-xs font-semibold text-text-secondary mb-1">{label}</label>
      <input ref={ref} type="file" accept={ATTACH_ACCEPT} className="hidden"
        onChange={e => { const f = e.target.files?.[0] ?? null; if (f && f.size > MAX_ATTACH) { showToast('File too large (max 4 MB)'); if (ref.current) ref.current.value = ''; return; } onPick(f); }} />
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => ref.current?.click()} className="border border-border-light rounded-ctrl px-3 py-2 text-sm text-ink hover:bg-canvas whitespace-nowrap">⇪ Choose file</button>
        {file ? (
          <span className="text-xs text-text-secondary inline-flex items-center gap-1 min-w-0">
            <span className="truncate max-w-[180px]">📎 {file.name}</span>
            <button type="button" onClick={() => { onPick(null); if (ref.current) ref.current.value = ''; }} className="text-text-muted hover:text-litred-alt">✕</button>
          </span>
        ) : <span className="text-xs text-text-muted">PDF, image, or DOCX</span>}
      </div>
    </div>
  );
}

function downloadCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const esc = (c: string | number) => `"${String(c ?? '').replace(/"/g, '""')}"`;
  const csv = [header, ...rows].map(r => r.map(esc).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ---- Trips report tab (date-range filtered) ----
function TripsReportTab() {
  const { showToast } = useToast();
  const [trips, setTrips] = useState<any[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [q, setQ] = useState('');
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetch('/api/reports?tab=monthly').then(r => r.json()).then(d => setTrips(d.trips ?? [])); }, []);

  // Import trips from a CSV/XLSX export (e.g. the Trip Desk monthly report).
  async function importFile(file: File) {
    setImporting(true);
    try {
      const { read, utils } = await import('xlsx');
      const wb = read(await file.arrayBuffer(), { type: 'array', cellDates: true });
      const sheet = wb.SheetNames.find(n => /trip|travel|report/i.test(n)) ?? wb.SheetNames[0];
      const json = utils.sheet_to_json<Record<string, any>>(wb.Sheets[sheet], { defval: '' });
      const rows = mapTripRows(json);
      if (!rows.length) { showToast('No trip rows found in file'); setImporting(false); return; }
      const replace = trips.length > 0 && confirm(`Replace all ${trips.length} existing trips with the ${rows.length} rows from this file?\n\nOK = replace · Cancel = add to existing`);
      const res = await fetch('/api/trips', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows, replace }) });
      const d = await res.json();
      setTrips(d.trips ?? []);
      showToast(`Imported ${d.inserted ?? rows.length} trips`);
    } catch { showToast('Failed to read file'); }
    setImporting(false);
  }

  async function clearAll() {
    if (!confirm(`Delete ALL ${trips.length} trips? This cannot be undone.`)) return;
    await fetch('/api/trips', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ all: true }) });
    setTrips([]);
    showToast('All trips cleared');
  }

  async function deleteTrip(id: string) {
    await fetch('/api/trips', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    setTrips(prev => prev.filter((t: any) => t.id !== id));
    showToast('Trip deleted');
  }

  const filtered = trips.filter((t: any) => {
    // Filter on the travel date (falls back to created date if not set)
    const d = (t.travel_start ?? t.created_at ?? '').slice(0, 10);
    const dEnd = (t.travel_end ?? t.travel_start ?? t.created_at ?? '').slice(0, 10);
    if (from && dEnd < from) return false;
    if (to && d > to) return false;
    if (q) {
      const s = q.toLowerCase();
      if (!(`${t.who ?? ''} ${t.detail ?? ''} ${t.matter ?? ''} ${t.status ?? ''}`.toLowerCase().includes(s))) return false;
    }
    return true;
  });
  const totalSpend = filtered.reduce((s: number, t: any) => s + (Number(t.cost) || 0), 0);
  const approved = filtered.filter((t: any) => /appro|complete|confirm/i.test(t.status ?? '')).length;
  const pending = filtered.filter((t: any) => /pend|await|request/i.test(t.status ?? '')).length;

  function exportCsv() {
    const rows = filtered.map((t: any) => [
      t.who, t.detail, t.matter ?? '', t.cost != null ? Number(t.cost) : '',
      t.status, (t.created_at ?? '').slice(0, 10),
    ]);
    downloadCsv(`trip-report${from ? '-' + from : ''}${to ? '-to-' + to : ''}.csv`,
      ['Traveler', 'Details', 'Matter/Client', 'Cost', 'Status', 'Date'], rows);
    showToast(`Exported ${rows.length} trips`);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <span className="text-xs font-bold uppercase tracking-wider text-text-muted">Trip range</span>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)}
          className="border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
        <span className="text-text-muted text-xs">to</span>
        <input type="date" value={to} onChange={e => setTo(e.target.value)}
          className="border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
        {(from || to) && <button onClick={() => { setFrom(''); setTo(''); }} className="text-xs font-semibold text-text-muted hover:text-text-primary underline">Clear</button>}
        <div className="relative ml-auto">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">🔍</span>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search traveler, client, status…"
            className="border border-border-light rounded-ctrl pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-ink w-64" />
        </div>
        <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
          onChange={e => { if (e.target.files?.[0]) { importFile(e.target.files[0]); e.target.value = ''; } }} />
        <button onClick={() => fileRef.current?.click()} disabled={importing}
          className="bg-white border border-border-light text-ink text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-canvas disabled:opacity-50">
          {importing ? 'Importing…' : '↑ Import trips (CSV/XLSX)'}
        </button>
        {trips.length > 0 && (
          <button onClick={clearAll} className="bg-white border border-border-light text-[#b0412f] text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-[#fdeaea]">🗑 Clear all</button>
        )}
        <button onClick={exportCsv} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark">↓ Download trip pack (CSV)</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatTile label="Trips" value={String(filtered.length)} color="#1b2a3d" />
        <StatTile label="Approved" value={String(approved)} color="#2f7d5b" />
        <StatTile label="Pending" value={String(pending)} color="#b07d2a" />
        <StatTile label="Total Spend" value={fmt$(totalSpend)} color="#1b2a3d" />
      </div>

      <div className="bg-white border border-border rounded-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#f1ece3]"><tr>
            {['Traveler','Travel Date','Details','Matter / Client','Cost','Status',''].map(h => <th key={h} className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-text-secondary">{h}</th>)}
          </tr></thead>
          <tbody>
            {filtered.map((t: any) => (
              <tr key={t.id} className="border-t border-[#f1ece3] group">
                <td className="px-4 py-3 font-medium">{t.who}</td>
                <td className="px-4 py-3 text-text-muted whitespace-nowrap">{tripDate(t)}</td>
                <td className="px-4 py-3 text-text-secondary">{t.detail}</td>
                <td className="px-4 py-3 text-text-muted">{t.matter ?? '—'}</td>
                <td className="px-4 py-3 text-text-muted">{t.cost != null ? fmt$(Number(t.cost)) : '—'}</td>
                <td className="px-4 py-3"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${tripStatusChip(t.status)}`}>{t.status}</span></td>
                <td className="px-4 py-3 text-right"><button onClick={() => deleteTrip(t.id)} className="text-xs text-text-muted hover:text-[#b0412f] opacity-0 group-hover:opacity-100">🗑</button></td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={7} className="px-4 py-6 text-center text-text-muted">No trips in this range</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- PTO report tab (date-range filtered) ----
function PtoReportTab() {
  const { showToast } = useToast();
  const [pto, setPto] = useState<any[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => { fetchMergedPto().then(setPto); }, []);

  const filtered = pto.filter((e: any) => {
    // Overlap logic so multi-month leaves show for a range inside them
    const s = (e.start_date ?? '').slice(0, 10);
    const en = (e.end_date ?? e.start_date ?? '').slice(0, 10);
    if (from && en < from) return false;
    if (to && s > to) return false;
    return true;
  });
  const totalDays = filtered.reduce((s: number, e: any) => s + (Number(e.days) || 0), 0);
  const people = new Set(filtered.map((e: any) => e.employee)).size;

  function exportCsv() {
    const rows = filtered.map((e: any) => [
      e.employee, e.type, (e.start_date ?? '').slice(0, 10), (e.end_date ?? '').slice(0, 10),
      Number(e.days) || 0,
    ]);
    downloadCsv(`pto-report${from ? '-' + from : ''}${to ? '-to-' + to : ''}.csv`,
      ['Employee', 'Type', 'Start', 'End', 'Days'], rows);
    showToast(`Exported ${rows.length} PTO entries`);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <span className="text-xs font-bold uppercase tracking-wider text-text-muted">PTO range</span>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)}
          className="border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
        <span className="text-text-muted text-xs">to</span>
        <input type="date" value={to} onChange={e => setTo(e.target.value)}
          className="border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
        {(from || to) && <button onClick={() => { setFrom(''); setTo(''); }} className="text-xs font-semibold text-text-muted hover:text-text-primary underline">Clear</button>}
        <button onClick={exportCsv} className="ml-auto bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark">↓ Download PTO pack (CSV)</button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <StatTile label="Entries" value={String(filtered.length)} color="#1b2a3d" />
        <StatTile label="Employees" value={String(people)} color="#3f6b8a" />
        <StatTile label="Total Days" value={String(totalDays)} color="#b0412f" />
      </div>

      <div className="bg-white border border-border rounded-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#f1ece3]"><tr>
            {['Employee','Type','Start','End','Days'].map(h => <th key={h} className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-text-secondary">{h}</th>)}
          </tr></thead>
          <tbody>
            {filtered.map((e: any) => (
              <tr key={e.id} className="border-t border-[#f1ece3]">
                <td className="px-4 py-3 font-medium">{e.employee}</td>
                <td className="px-4 py-3 text-text-muted">{e.type}</td>
                <td className="px-4 py-3 text-text-muted">{(e.start_date ?? '').slice(0, 10)}</td>
                <td className="px-4 py-3 text-text-muted">{(e.end_date ?? '').slice(0, 10)}</td>
                <td className="px-4 py-3 text-text-muted">{e.days}</td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={5} className="px-4 py-6 text-center text-text-muted">No PTO entries in this range</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Review row derivation is shared with the Reviews dashboard (lib/reviews)
function reviewStatusChip(s: string) {
  if (s === 'Complete') return 'bg-[#eef5f1] text-[#2f7d5b]';
  if (s === 'In Progress') return 'bg-[#f7efe1] text-[#b07d2a]';
  if (s === 'Scheduled') return 'bg-[#e9f0f5] text-[#3f6b8a]';
  return 'bg-[#f1ece3] text-text-muted';
}

// ---- Performance Review report tab (date-range filtered) ----
function ReviewsReportTab() {
  const { showToast } = useToast();
  const [reviews, setReviews] = useState<any[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => { fetch('/api/reports?tab=monthly').then(r => r.json()).then(d => setReviews(d.reviews ?? [])); }, []);

  const all = reviewRows(reviews);
  const filtered = all.filter(r => {
    if (!r.date) return !from && !to; // undated only show when no range set
    if (from && r.date < from) return false;
    if (to && r.date > to) return false;
    return true;
  }).sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'));

  const complete = filtered.filter(r => r.status === 'Complete').length;
  const scheduled = filtered.filter(r => r.status === 'Scheduled').length;
  const notStarted = filtered.filter(r => r.status === 'Not Started').length;

  function exportCsv() {
    const rows = filtered.map(r => [r.name, r.role, r.dept, r.type, r.date ?? '', r.status]);
    downloadCsv(`review-report${from ? '-' + from : ''}${to ? '-to-' + to : ''}.csv`,
      ['Employee', 'Role', 'Department', 'Review', 'Date', 'Status'], rows);
    showToast(`Exported ${rows.length} reviews`);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <span className="text-xs font-bold uppercase tracking-wider text-text-muted">Review range</span>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)}
          className="border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
        <span className="text-text-muted text-xs">to</span>
        <input type="date" value={to} onChange={e => setTo(e.target.value)}
          className="border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
        {(from || to) && <button onClick={() => { setFrom(''); setTo(''); }} className="text-xs font-semibold text-text-muted hover:text-text-primary underline">Clear</button>}
        <button onClick={exportCsv} className="ml-auto bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark">↓ Download review pack (CSV)</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatTile label="Reviews" value={String(filtered.length)} color="#1b2a3d" />
        <StatTile label="Complete" value={String(complete)} color="#2f7d5b" />
        <StatTile label="Scheduled" value={String(scheduled)} color="#3f6b8a" />
        <StatTile label="Not Started" value={String(notStarted)} color="#b07d2a" />
      </div>

      <div className="bg-white border border-border rounded-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#f1ece3]"><tr>
            {['Employee','Role','Department','Review','Date','Status'].map(h => <th key={h} className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-text-secondary">{h}</th>)}
          </tr></thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} className="border-t border-[#f1ece3]">
                <td className="px-4 py-3 font-medium">{r.name}</td>
                <td className="px-4 py-3 text-text-muted">{r.role}</td>
                <td className="px-4 py-3 text-text-muted">{r.dept}</td>
                <td className="px-4 py-3 text-text-secondary">{r.type}</td>
                <td className="px-4 py-3 text-text-muted">{r.date ?? '—'}</td>
                <td className="px-4 py-3"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${reviewStatusChip(r.status)}`}>{r.status}</span></td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={6} className="px-4 py-6 text-center text-text-muted">No reviews in this range</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white border border-border rounded-card px-4 py-3">
      <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{label}</div>
      <div className="font-spectral text-2xl font-semibold mt-1" style={{ color }}>{value}</div>
    </div>
  );
}

// ---- Monthly tab (this month vs last month comparison pack) ----
function ymOf(s: string) { return (s ?? '').slice(0, 7); }
function monthLabel(y: number, m: number) { return new Date(y, m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); }
function num(v: any) { const n = Number(String(v ?? '').replace(/[$,]/g, '')); return isFinite(n) ? n : 0; }

// A trip's month comes from its travel dates in the free-text detail
// (e.g. "Jul 7 – Jul 9", "8/3/2026"), falling back to when it was logged.
const MON3 = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
function tripMonthKey(t: any): string {
  // Prefer the explicit travel date captured on import
  const ts = (t.travel_start ?? '').slice(0, 7);
  if (/^\d{4}-\d{2}$/.test(ts)) return ts;
  const detail = String(t.detail ?? '');
  const created = ymOf(t.created_at);
  const cy = created ? created.slice(0, 4) : String(new Date().getFullYear());
  const mName = detail.toLowerCase().match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}/);
  if (mName) { const mi = MON3.indexOf(mName[1]); if (mi >= 0) return `${cy}-${String(mi + 1).padStart(2, '0')}`; }
  const mNum = detail.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (mNum) {
    const mm = String(Math.min(12, Math.max(1, parseInt(mNum[1])))).padStart(2, '0');
    const yy = mNum[3] ? (mNum[3].length === 2 ? '20' + mNum[3] : mNum[3]) : cy;
    return `${yy}-${mm}`;
  }
  return created;
}

function MonthlyTab({ data }: { data: any }) {
  const { showToast } = useToast();
  if (!data) return <div className="py-8 text-center text-text-muted text-sm">Loading…</div>;
  const { pto, trips, contractors, reviews, cashout, staff, attachments, reimbursements, insurance } = data;

  // Two comparison months, user-selectable. Default: current month vs previous.
  const now = new Date();
  const defA = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const defB = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
  const [thisKey, setThisKey] = useState(defA);
  const [lastKey, setLastKey] = useState(defB);
  const thisY = parseInt(thisKey.slice(0, 4)), thisM = parseInt(thisKey.slice(5, 7)) - 1;
  const lastY = parseInt(lastKey.slice(0, 4)), lastM = parseInt(lastKey.slice(5, 7)) - 1;
  const thisLabel = monthLabel(thisY, thisM);
  const lastLabel = monthLabel(lastY, lastM);

  const cName = (c: any) => c.contractor ?? c.name ?? '—';
  const cDate = (c: any) => (c.pay_date ?? c.due_date ?? '');
  const cNote = (c: any) => c.notes ?? c.note ?? '';
  const tripInMonth = (t: any, k: string) => tripMonthKey(t) === k || ymOf(t.created_at) === k;

  // Month-parameterized row generators (single source per category)
  const ptoOf = (k: string) => (pto ?? []).filter((e: any) => ymOf(e.start_date) === k);
  const tripOf = (k: string) => (trips ?? []).filter((t: any) => tripInMonth(t, k));
  const contractorOf = (k: string) => (contractors ?? []).filter((c: any) => ymOf(cDate(c)) === k);
  const reviewOf = (k: string) => reviewRows(reviews ?? []).filter(r => r.date && ymOf(r.date) === k).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  const cashoutOf = (k: string) => (cashout ?? []).filter((c: any) => ymOf(c.date) === k).sort((a: any, b: any) => (a.date ?? '').localeCompare(b.date ?? ''));
  const cashTotalOf = (k: string) => cashoutOf(k).reduce((s: number, c: any) => s + num(c.amount), 0);
  const reimbOf = (k: string) => (reimbursements ?? []).filter((r: any) => ymOf(r.payout_date) === k).sort((a: any, b: any) => (a.payout_date ?? '').localeCompare(b.payout_date ?? ''));
  const reimbTotalOf = (k: string) => reimbOf(k).reduce((s: number, r: any) => s + num(r.amount), 0);
  const insuranceOf = (k: string) => (insurance ?? []).filter((r: any) => ymOf(r.deadline) === k).sort((a: any, b: any) => (a.deadline ?? '').localeCompare(b.deadline ?? ''));
  const insuranceTotalOf = (k: string) => insuranceOf(k).reduce((s: number, r: any) => s + num(r.amount), 0);
  const ptoDaysOf = (k: string) => ptoOf(k).reduce((s: number, e: any) => s + num(e.days), 0);
  // Birthday month from staffing dob (MM/DD/YYYY, or YYYY-MM-DD fallback)
  const dobMonth = (dob: string) => {
    if (!dob) return 0;
    const s = String(dob).trim();
    if (/^\d{4}-\d{2}/.test(s)) return parseInt(s.slice(5, 7));
    const parts = s.split('/');
    return parts.length >= 1 ? parseInt(parts[0]) : 0;
  };
  const birthdaysOf = (mi: number) => (staff ?? []).filter((e: any) => dobMonth(e.dob) === mi + 1)
    .sort((a: any, b: any) => (parseInt(String(a.dob).split('/')[1]) || 0) - (parseInt(String(b.dob).split('/')[1]) || 0));
  // Parse a date (MM/DD/YYYY or YYYY-MM-DD) into { m, y }
  const parseMY = (v: string) => {
    const s = String(v ?? '').trim();
    if (/^\d{4}-\d{2}/.test(s)) return { m: parseInt(s.slice(5, 7)), y: parseInt(s.slice(0, 4)) };
    const p = s.split('/');
    return p.length >= 3 ? { m: parseInt(p[0]), y: parseInt(p[2]) } : { m: 0, y: 0 };
  };
  // Work anniversaries in month `mi` of year `yr`, with years-of-service
  const anniversariesOf = (mi: number, yr: number) => (staff ?? [])
    .map((e: any) => ({ ...e, ...parseMY(e.start_date) }))
    .filter((e: any) => e.m === mi + 1 && e.y && e.y < yr)
    .map((e: any) => ({ ...e, years: yr - e.y }))
    .sort((a: any, b: any) => (parseInt(String(a.start_date).split('/')[1]) || 0) - (parseInt(String(b.start_date).split('/')[1]) || 0));

  const metrics = [
    { label: 'Cash Out', color: '#b0412f', money: true, thisV: cashTotalOf(thisKey), lastV: cashTotalOf(lastKey) },
    { label: 'Number of PTOs', color: '#2f7d5b', money: false, thisV: ptoOf(thisKey).length, lastV: ptoOf(lastKey).length },
    { label: 'Trips', color: '#3f6b8a', money: false, thisV: tripOf(thisKey).length, lastV: tripOf(lastKey).length },
    { label: 'Travel Spend (approx.)', color: '#3f6b8a', money: true, approx: true, thisV: tripOf(thisKey).reduce((s: number, t: any) => s + num(t.cost), 0), lastV: tripOf(lastKey).reduce((s: number, t: any) => s + num(t.cost), 0) },
    { label: 'Contractor $', color: '#6b4f8a', money: true, thisV: contractorOf(thisKey).reduce((s: number, c: any) => s + num(c.amount), 0), lastV: contractorOf(lastKey).reduce((s: number, c: any) => s + num(c.amount), 0) },
    { label: 'Reimbursements $', color: '#2f7d5b', money: true, thisV: reimbTotalOf(thisKey), lastV: reimbTotalOf(lastKey) },
    { label: 'Insurance Premiums', color: '#6b4f8a', money: true, thisV: insuranceTotalOf(thisKey), lastV: insuranceTotalOf(lastKey) },
    { label: 'Reviews Due', color: '#b07d2a', money: false, thisV: reviewOf(thisKey).filter(r => r.status !== 'Complete').length, lastV: reviewOf(lastKey).filter(r => r.status !== 'Complete').length },
    { label: 'Birthdays', color: '#c9a24a', money: false, thisV: birthdaysOf(thisM).length, lastV: birthdaysOf(lastM).length },
    { label: 'Anniversaries', color: '#8a6d3b', money: false, thisV: anniversariesOf(thisM, thisY).length, lastV: anniversariesOf(lastM, lastY).length },
  ];

  function csvSection(lines: string[], title: string, headers: string[], rowsThis: any[][], rowsLast: any[][]) {
    lines.push('', `${title} — ${thisLabel}`, headers.join(','));
    rowsThis.forEach(r => lines.push(r.map(x => `"${x ?? ''}"`).join(',')));
    lines.push('', `${title} — ${lastLabel}`, headers.join(','));
    rowsLast.forEach(r => lines.push(r.map(x => `"${x ?? ''}"`).join(',')));
  }
  function downloadCsvPack() {
    const lines: string[] = [`LITSON HR — Monthly Pack — ${thisLabel} vs ${lastLabel}`, '', `COMPARISON,${thisLabel},${lastLabel}`];
    metrics.forEach(m => { const t = (m as any).approx ? '~' : ''; lines.push(`${m.label},${m.money ? t + fmt$(m.thisV) : m.thisV},${m.money ? t + fmt$(m.lastV) : m.lastV}`); });
    csvSection(lines, 'CASH OUT', ['Date', 'Payee', 'Category', 'Amount', 'Note'], cashoutOf(thisKey).map((c: any) => [c.date, c.payee, c.category, num(c.amount), c.note]), cashoutOf(lastKey).map((c: any) => [c.date, c.payee, c.category, num(c.amount), c.note]));
    csvSection(lines, 'PTO', ['Employee', 'Type', 'Start', 'End', 'Days'], ptoOf(thisKey).map((e: any) => [e.employee, e.type, e.start_date, e.end_date, e.days]), ptoOf(lastKey).map((e: any) => [e.employee, e.type, e.start_date, e.end_date, e.days]));
    csvSection(lines, 'TRIPS', ['Traveler', 'Travel Date', 'Details', 'Client', 'Cost', 'Status'], tripOf(thisKey).map((t: any) => [t.who, tripDate(t), t.detail, t.matter, num(t.cost), t.status]), tripOf(lastKey).map((t: any) => [t.who, tripDate(t), t.detail, t.matter, num(t.cost), t.status]));
    csvSection(lines, 'CONTRACTOR PAYMENTS', ['Name', 'Date', 'Amount', 'Note'], contractorOf(thisKey).map((c: any) => [cName(c), cDate(c), num(c.amount), cNote(c)]), contractorOf(lastKey).map((c: any) => [cName(c), cDate(c), num(c.amount), cNote(c)]));
    csvSection(lines, 'REIMBURSEMENTS', ['Employee', 'Purpose', 'Amount', 'Payout Date', 'Receipt'], reimbOf(thisKey).map((r: any) => [r.employee, r.purpose, num(r.amount), r.payout_date, r.has_attachment ? 'Attached' : '']), reimbOf(lastKey).map((r: any) => [r.employee, r.purpose, num(r.amount), r.payout_date, r.has_attachment ? 'Attached' : '']));
    csvSection(lines, 'INSURANCE INVOICES', ['Carrier', 'Type', 'Amount', 'Deadline', 'Enrolled', 'Invoice'], insuranceOf(thisKey).map((r: any) => [r.carrier, r.invoice_type, num(r.amount), r.deadline, r.enrolled_count, r.has_attachment ? 'Attached' : '']), insuranceOf(lastKey).map((r: any) => [r.carrier, r.invoice_type, num(r.amount), r.deadline, r.enrolled_count, r.has_attachment ? 'Attached' : '']));
    csvSection(lines, 'PERFORMANCE REVIEWS', ['Employee', 'Role', 'Review', 'Date', 'Status'], reviewOf(thisKey).map(r => [r.name, r.role, r.type, r.date, r.status]), reviewOf(lastKey).map(r => [r.name, r.role, r.type, r.date, r.status]));
    csvSection(lines, 'BIRTHDAYS', ['Name', 'DOB'], birthdaysOf(thisM).map((e: any) => [e.name, e.dob]), birthdaysOf(lastM).map((e: any) => [e.name, e.dob]));
    csvSection(lines, 'WORK ANNIVERSARIES', ['Name', 'Years', 'Since'], anniversariesOf(thisM, thisY).map((e: any) => [e.name, e.years, e.start_date]), anniversariesOf(lastM, lastY).map((e: any) => [e.name, e.years, e.start_date]));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `Monthly Pack — ${thisLabel} vs ${lastLabel}.csv`; a.click();
    showToast('CSV downloaded');
  }

  // Styled Excel export — Excel opens HTML tables with inline styles, so this
  // renders the same colored, side-by-side layout as the PDF.
  function downloadXls() {
    const esc = (v: any) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const statusText = (s: string) => esc(s);
    const th = (color: string, h: string) => `<td style="background:${color};color:#fff;font-weight:bold;font-size:9pt;border:1px solid #fff">${esc(h)}</td>`;
    const monthTable = (color: string, badge: string, monthLbl: string, headers: string[], rows: string[][], total?: [string, string]) => `
      <table border="0" cellspacing="0" cellpadding="5" style="border-collapse:collapse;width:100%">
        <tr><td colspan="${headers.length}" style="background:${color};color:#fff;font-weight:bold;font-size:10pt">${badge} · ${esc(monthLbl)} (${rows.length})</td></tr>
        <tr>${headers.map(h => th(color, h)).join('')}</tr>
        ${rows.length ? rows.map((r, i) => `<tr>${r.map(c => `<td style="border:1px solid #ddd;background:${i % 2 ? '#f7f7f7' : '#fff'};font-size:9pt">${c ?? '—'}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${headers.length}" style="border:1px solid #ddd;color:#999;text-align:center">None</td></tr>`}
        ${total && rows.length ? `<tr><td style="background:${color}22;font-weight:bold;font-size:9pt">${esc(total[0])}</td><td colspan="${headers.length - 1}" style="background:${color}22;font-weight:bold;font-size:9pt">${esc(total[1])}</td></tr>` : ''}
      </table>`;
    const spacer = '<td style="width:28px">&nbsp;</td>';
    // Blank rows between stacked sections (Excel needs real rows, not padding)
    const gap = '<tr><td colspan="3" style="height:10px;line-height:10px">&nbsp;</td></tr><tr><td colspan="3" style="height:10px;line-height:10px">&nbsp;</td></tr>';
    const section = (title: string, color: string, headers: string[], mapper: (k: string) => string[][], totalFn?: (k: string) => [string, string]) => `
      <tr><td colspan="3" style="font-size:13pt;font-weight:bold;color:${color};padding-top:14px">${esc(title)}</td></tr>
      <tr>
        <td valign="top" style="width:48%">${monthTable(color, 'CURRENT', thisLabel, headers, mapper(thisKey), totalFn?.(thisKey))}</td>
        ${spacer}
        <td valign="top" style="width:48%">${monthTable(color, 'PREVIOUS', lastLabel, headers, mapper(lastKey), totalFn?.(lastKey))}</td>
      </tr>`;
    const cmpRows = metrics.map(m => { const t = (m as any).approx ? '~' : ''; const tv = m.money ? t + fmt$(m.thisV) : String(m.thisV); const lv = m.money ? t + fmt$(m.lastV) : String(m.lastV); return `<tr><td style="border:1px solid #ddd;font-weight:bold">${esc(m.label)}</td><td style="border:1px solid #ddd;color:${m.color};font-weight:bold">${tv}</td><td style="border:1px solid #ddd;color:#777">${lv}</td></tr>`; }).join('');
    const peopleRow = (title: string, color: string, thisArr: any[], lastArr: any[], fmt: (e: any) => string) => `
      <tr><td colspan="3" style="font-size:13pt;font-weight:bold;color:${color};padding-top:14px">${esc(title)}</td></tr>
      <tr>
        <td valign="top" style="width:48%"><table border="0" cellspacing="0" cellpadding="5" style="border-collapse:collapse;width:100%"><tr><td style="background:${color};color:#fff;font-weight:bold">CURRENT · ${esc(thisLabel)} (${thisArr.length})</td></tr>${thisArr.length ? thisArr.map((e: any) => `<tr><td style="border:1px solid #ddd;font-size:9pt">${fmt(e)}</td></tr>`).join('') : '<tr><td style="border:1px solid #ddd;color:#999">None</td></tr>'}</table></td>
        ${spacer}
        <td valign="top" style="width:48%"><table border="0" cellspacing="0" cellpadding="5" style="border-collapse:collapse;width:100%"><tr><td style="background:${color};color:#fff;font-weight:bold">PREVIOUS · ${esc(lastLabel)} (${lastArr.length})</td></tr>${lastArr.length ? lastArr.map((e: any) => `<tr><td style="border:1px solid #ddd;font-size:9pt">${fmt(e)}</td></tr>`).join('') : '<tr><td style="border:1px solid #ddd;color:#999">None</td></tr>'}</table></td>
      </tr>`;
    const body = `
      <table border="0" cellspacing="0" cellpadding="0" style="width:100%;font-family:Calibri,Arial,sans-serif">
        <tr><td colspan="3" style="background:#1b2a3d;color:#fff;font-size:18pt;font-weight:bold;padding:12px">LITSON — HR Monthly Pack</td></tr>
        <tr><td colspan="3" style="color:#8a6d3b;font-weight:bold;padding:4px 0 12px">${esc(thisLabel)} (current) vs ${esc(lastLabel)} (previous)</td></tr>
        <tr><td colspan="3" style="font-size:13pt;font-weight:bold;color:#1b2a3d">Comparison</td></tr>
        <tr><td colspan="3"><table border="0" cellspacing="0" cellpadding="5" style="border-collapse:collapse"><tr><td style="background:#1b2a3d;color:#fff;font-weight:bold">Category</td><td style="background:#1b2a3d;color:#fff;font-weight:bold">${esc(thisLabel)}</td><td style="background:#1b2a3d;color:#fff;font-weight:bold">${esc(lastLabel)}</td></tr>${cmpRows}</table></td></tr>
        ${gap}${section('Cash Out', '#b0412f', ['Date', 'Payee', 'Category', 'Amount', 'Note'], k => cashoutOf(k).map((c: any) => [esc(c.date), esc(c.payee), esc(c.category), fmt$(num(c.amount)), esc(c.note)]), k => ['Total Cash Out', fmt$(cashTotalOf(k))])}
        ${gap}${section('Paid Time Off', '#2f7d5b', ['Employee', 'Type', 'Start', 'End', 'Days'], k => ptoOf(k).map((e: any) => [esc(e.employee), esc(e.type), esc(e.start_date), esc(e.end_date), String(e.days ?? '')]), k => ['Total PTO Days', `${ptoDaysOf(k)} days · ${ptoOf(k).length} PTOs`])}
        ${gap}${section('Trips & Travel', '#3f6b8a', ['Traveler', 'Travel Date', 'Details', 'Client', 'Cost', 'Status'], k => tripOf(k).map((t: any) => [esc(t.who), esc(tripDate(t)), esc(t.detail), esc(t.matter), t.cost != null ? fmt$(num(t.cost)) : '—', statusText(t.status)]))}
        ${gap}${section('Contractor Payments', '#6b4f8a', ['Name', 'Date', 'Amount', 'Note'], k => contractorOf(k).map((c: any) => [esc(cName(c)), esc(cDate(c)), fmt$(num(c.amount)), esc(cNote(c))]), k => ['Total Contractor $', fmt$(contractorOf(k).reduce((s: number, c: any) => s + num(c.amount), 0))])}
        ${gap}${section('Reimbursements', '#2f7d5b', ['Employee', 'Purpose', 'Amount', 'Payout Date', 'Receipt'], k => reimbOf(k).map((r: any) => [esc(r.employee), esc(r.purpose), fmt$(num(r.amount)), esc(r.payout_date ?? ''), r.has_attachment ? 'Attached' : '—']), k => ['Total Reimbursements', fmt$(reimbTotalOf(k))])}
        ${gap}${section('Insurance Invoices', '#6b4f8a', ['Carrier', 'Type', 'Amount', 'Deadline', 'Enrolled', 'Invoice'], k => insuranceOf(k).map((r: any) => [esc(r.carrier), esc(r.invoice_type), fmt$(num(r.amount)), esc(r.deadline ?? ''), String(r.enrolled_count ?? ''), r.has_attachment ? 'Attached' : '—']), k => ['Total Premiums', fmt$(insuranceTotalOf(k))])}
        ${gap}${section('Performance Reviews', '#b07d2a', ['Employee', 'Role', 'Review', 'Date', 'Status'], k => reviewOf(k).map(r => [esc(r.name), esc(r.role), esc(r.type), esc(r.date ?? ''), statusText(r.status)]))}
        ${gap}${peopleRow('Birthdays', '#c9a24a', birthdaysOf(thisM), birthdaysOf(lastM), (e: any) => `🎂 ${esc(e.name)} — ${esc(e.dob)}`)}
        ${gap}${peopleRow('Work Anniversaries', '#8a6d3b', anniversariesOf(thisM, thisY), anniversariesOf(lastM, lastY), (e: any) => `🎉 ${esc(e.name)} — ${e.years} ${e.years === 1 ? 'year' : 'years'} (since ${esc(e.start_date)})`)}
      </table>`;
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Monthly Pack</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body>${body}</body></html>`;
    const blob = new Blob(['﻿' + html], { type: 'application/vnd.ms-excel' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `Monthly Pack — ${thisLabel} vs ${lastLabel}.xls`; a.click();
    showToast('Excel downloaded');
  }

  function printPack() {
    const esc = (v: any) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // Inline status pill matching the on-screen chip colors
    const STATUS = (s: string) => {
      const x = (s ?? '').toLowerCase();
      let bg = '#f1ece3', fg = '#6b5f4d';
      if (/appro|complete|confirm|book|paid|done/.test(x)) { bg = '#eef5f1'; fg = '#2f7d5b'; }
      else if (/hold|process|review/.test(x)) { bg = '#e9f0f5'; fg = '#3f6b8a'; }
      else if (/deny|denied|reject|cancel/.test(x)) { bg = '#fdeaea'; fg = '#b0412f'; }
      else if (/pend|await|request/.test(x)) { bg = '#f7efe1'; fg = '#b07d2a'; }
      return `<span style="display:inline-block;padding:2px 8px;border-radius:999px;background:${bg};color:${fg};font-size:9px;font-weight:700;text-transform:capitalize">${esc(s)}</span>`;
    };
    const catPill = (t: string, color: string) => `<span style="display:inline-block;padding:2px 8px;border-radius:999px;background:${color}1a;color:${color};font-size:9px;font-weight:700">${esc(t)}</span>`;

    // Comparison band — Current vs Previous split cards, mirrors the UI
    const cmpCards = metrics.map(m => {
      const t = (m as any).approx ? '~' : '';
      const tv = m.money ? t + fmt$(m.thisV) : String(m.thisV);
      const lv = m.money ? t + fmt$(m.lastV) : String(m.lastV);
      return `<div style="border:1px solid #e6ddcd;border-top:3px solid ${m.color};border-radius:8px;overflow:hidden">
        <div style="padding:6px 10px 4px;font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#4a4235">${esc(m.label)}</div>
        <div style="display:flex;border-top:1px solid #eee">
          <div style="flex:1;min-width:0;padding:6px 8px;background:${m.color}12">
            <div style="font-size:7.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${m.color}">${esc(thisLabel.split(' ')[0])} · Current</div>
            <div style="font-size:14px;font-weight:700;color:${m.color};word-break:break-all;line-height:1.2">${tv}</div>
          </div>
          <div style="flex:1;min-width:0;padding:6px 8px;border-left:1px solid #eee">
            <div style="font-size:7.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#6b6355">${esc(lastLabel.split(' ')[0])} · Previous</div>
            <div style="font-size:14px;font-weight:700;color:#6b6355;word-break:break-all;line-height:1.2">${lv}</div>
          </div>
        </div></div>`;
    }).join('');

    // One category column (Current or Previous) with badge, header, rows, optional total footer
    const col = (color: string, badge: string, current: boolean, monthLbl: string, headers: string[], rows: string[][], total?: [string, string]) => `
      <div style="flex:1;min-width:0;border:2px solid ${color}${current ? '' : '55'};border-top:4px solid ${color};border-radius:8px;overflow:hidden">
        <div style="padding:5px 10px;background:${color}${current ? '18' : '0c'};color:${color};font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;display:flex;justify-content:space-between">
          <span><span style="padding:1px 6px;border-radius:4px;font-size:8px;background:${current ? color : color + '33'};color:${current ? '#fff' : color}">${badge}</span> ${esc(monthLbl)}</span><span style="opacity:.7">${rows.length}</span>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:10px">
          <thead><tr style="background:${color}0a">${headers.map(h => `<th style="text-align:left;padding:4px 8px;color:${color};font-size:8px;text-transform:uppercase;letter-spacing:.05em">${esc(h)}</th>`).join('')}</tr></thead>
          <tbody>${rows.length ? rows.map(r => `<tr style="border-top:1px solid #f1ece3">${r.map(c => `<td style="padding:4px 8px;color:#333">${c ?? '—'}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${headers.length}" style="padding:12px;text-align:center;color:#999">None</td></tr>`}</tbody>
          ${total && rows.length ? `<tfoot><tr style="background:${color}10;border-top:2px solid ${color}55"><td style="padding:5px 8px;font-size:9px;font-weight:700;text-transform:uppercase;color:${color}">${esc(total[0])}</td><td style="padding:5px 8px;font-weight:700;color:${color}" colspan="${headers.length - 1}">${esc(total[1])}</td></tr></tfoot>` : ''}
        </table>
      </div>`;
    const pair = (title: string, color: string, headers: string[], mapper: (k: string) => string[][], totalFn?: (k: string) => [string, string]) => `
      <div class="sec">
      <div style="display:flex;align-items:center;gap:8px;margin:0 0 8px"><span style="width:10px;height:22px;border-radius:99px;background:${color}"></span><h2 style="font-size:14px;font-weight:700;color:${color};margin:0;text-transform:uppercase;letter-spacing:.05em">${title}</h2></div>
      <div style="display:flex;gap:18px;align-items:flex-start">
        ${col(color, 'Current', true, thisLabel, headers, mapper(thisKey), totalFn?.(thisKey))}
        ${col(color, 'Previous', false, lastLabel, headers, mapper(lastKey), totalFn?.(lastKey))}
      </div></div>`;

    // Birthdays / Anniversaries as chip grids (mirrors UI cards)
    const peopleBlock = (title: string, color: string, fg: string, cards: (mi: number, yr: number) => string) => `
      <div class="sec">
      <div style="display:flex;align-items:center;gap:8px;margin:0 0 8px"><span style="width:10px;height:22px;border-radius:99px;background:${color}"></span><h2 style="font-size:14px;font-weight:700;color:${fg};margin:0;text-transform:uppercase;letter-spacing:.05em">${title}</h2></div>
      <div style="display:flex;gap:18px">
        <div style="flex:1;border:2px solid ${color};border-radius:8px;padding:10px;background:${color}10"><div style="font-size:10px;font-weight:700;color:${fg};margin-bottom:6px"><span style="padding:1px 6px;border-radius:4px;font-size:8px;background:${color};color:#fff">Current</span> ${esc(thisLabel)}</div><div style="display:flex;flex-wrap:wrap;gap:6px">${cards(thisM, thisY) || '<span style="color:#999;font-size:11px">None</span>'}</div></div>
        <div style="flex:1;border:2px solid ${color}55;border-radius:8px;padding:10px"><div style="font-size:10px;font-weight:700;color:${fg};margin-bottom:6px"><span style="padding:1px 6px;border-radius:4px;font-size:8px;background:${color}33;color:${fg}">Previous</span> ${esc(lastLabel)}</div><div style="display:flex;flex-wrap:wrap;gap:6px">${cards(lastM, lastY) || '<span style="color:#999;font-size:11px">None</span>'}</div></div>
      </div></div>`;
    const bdayCards = (mi: number) => birthdaysOf(mi).map((e: any) => `<div style="border:1px solid #e6ddcd;border-radius:6px;padding:5px 9px;font-size:11px"><div style="font-weight:600">🎂 ${esc(e.name)}</div><div style="color:#999;font-size:9px">${esc(e.dob)}</div></div>`).join('');
    const annCards = (mi: number, yr: number) => anniversariesOf(mi, yr).map((e: any) => `<div style="border:1px solid #e6ddcd;border-radius:6px;padding:5px 9px;font-size:11px"><div style="font-weight:600">🎉 ${esc(e.name)}</div><div style="color:#999;font-size:9px">${e.years} ${e.years === 1 ? 'year' : 'years'} · since ${esc(e.start_date)}</div></div>`).join('');

    const SANS = "'Helvetica Neue',Helvetica,Arial,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Monthly Pack — ${esc(thisLabel)} vs ${esc(lastLabel)}</title>
      <style>
        @page{size:A4 landscape;margin:12mm}
        *{box-sizing:border-box}
        h2{font-family:${SANS};break-after:avoid;page-break-after:avoid}
        tr,td,th{break-inside:avoid;page-break-inside:avoid}
        thead{display:table-header-group}
        .sec{break-inside:avoid;page-break-inside:avoid;margin-top:22px}
      </style></head>
      <body style="font-family:${SANS};margin:0;background:#fff;color:#2a2a2a;-webkit-print-color-adjust:exact;print-color-adjust:exact">
        <div style="background:linear-gradient(120deg,#1b2a3d,#26405c);padding:20px 32px;border-bottom:4px solid #c9a24a;color:#fff">
          <div style="font-size:22px;font-weight:800;letter-spacing:.18em">LITSON</div>
          <div style="font-size:10px;color:#c9a24a;letter-spacing:.12em;font-weight:600">HR MONTHLY PACK · ${esc(thisLabel.toUpperCase())} vs ${esc(lastLabel.toUpperCase())}</div>
        </div>
        <div style="padding:22px 32px">
          <div style="display:flex;align-items:center;gap:8px;margin:0 0 10px"><h2 style="font-size:14px;font-weight:700;color:#1b2a3d;margin:0">Comparison</h2><span style="font-size:10px;color:#999">${esc(thisLabel)} (current) vs ${esc(lastLabel)} (previous)</span></div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">${cmpCards}</div>
          ${pair('Cash Out', '#b0412f', ['Date', 'Payee', 'Category', 'Amount', 'Note'], k => cashoutOf(k).map((c: any) => [esc(c.date), esc(c.payee), catPill(c.category, '#b0412f'), fmt$(num(c.amount)), esc(c.note)]), k => ['Total Cash Out', fmt$(cashTotalOf(k))])}
          ${pair('Paid Time Off', '#2f7d5b', ['Employee', 'Type', 'Start', 'End', 'Days'], k => ptoOf(k).map((e: any) => [esc(e.employee), esc(e.type), esc(e.start_date), esc(e.end_date), String(e.days ?? '')]), k => ['Total PTO Days', `${ptoDaysOf(k)} days · ${ptoOf(k).length} PTOs`])}
          ${pair('Trips & Travel', '#3f6b8a', ['Traveler', 'Travel Date', 'Details', 'Client', 'Cost', 'Status'], k => tripOf(k).map((t: any) => [esc(t.who), esc(tripDate(t)), esc(t.detail), esc(t.matter), t.cost != null ? fmt$(num(t.cost)) : '—', STATUS(t.status)]))}
          ${pair('Contractor Payments', '#6b4f8a', ['Name', 'Date', 'Amount', 'Note'], k => contractorOf(k).map((c: any) => [esc(cName(c)), esc(cDate(c)), fmt$(num(c.amount)), esc(cNote(c))]), k => ['Total Contractor $', fmt$(contractorOf(k).reduce((s: number, c: any) => s + num(c.amount), 0))])}
          ${pair('Reimbursements', '#2f7d5b', ['Employee', 'Purpose', 'Amount', 'Payout Date', 'Receipt'], k => reimbOf(k).map((r: any) => [esc(r.employee), esc(r.purpose), fmt$(num(r.amount)), esc(r.payout_date ?? ''), r.has_attachment ? '📎 Attached' : '—']), k => ['Total Reimbursements', fmt$(reimbTotalOf(k))])}
          ${pair('Insurance Invoices', '#6b4f8a', ['Carrier', 'Type', 'Amount', 'Deadline', 'Enrolled', 'Invoice'], k => insuranceOf(k).map((r: any) => [esc(r.carrier), esc(r.invoice_type), fmt$(num(r.amount)), esc(r.deadline ?? ''), String(r.enrolled_count ?? ''), r.has_attachment ? '📎 Attached' : '—']), k => ['Total Premiums', fmt$(insuranceTotalOf(k))])}
          ${pair('Performance Reviews', '#b07d2a', ['Employee', 'Role', 'Review', 'Date', 'Status'], k => reviewOf(k).map(r => [esc(r.name), esc(r.role), esc(r.type), esc(r.date ?? ''), STATUS(r.status)]))}
          ${peopleBlock('Birthdays', '#c9a24a', '#8a6d3b', bdayCards)}
          ${peopleBlock('Work Anniversaries', '#8a6d3b', '#6b5427', annCards)}
        </div>
        <script>window.onload=function(){window.print()}</script>
      </body></html>`;
    const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); }
  }

  // Renders one category as two side-by-side month tables
  // total?: (rows) => { label, value } renders a bold footer row summing the column
  const Compare = ({ title, color, headers, renderRow, rowsThis, rowsLast, subtitle, total }: any) => {
    const Col = ({ label, badge, rows, current }: { label: string; badge: string; rows: any[]; current: boolean }) => {
      const t = total ? total(rows) : null;
      return (
        <div className="bg-white rounded-card overflow-hidden flex-1 min-w-0"
          style={{ border: `2px solid ${color}${current ? '' : '55'}`, borderTop: `4px solid ${color}`, boxShadow: current ? `0 1px 3px ${color}22` : 'none' }}>
          <div className="px-4 py-2 text-xs font-bold uppercase tracking-wider flex items-center justify-between" style={{ color, background: `${color}${current ? '18' : '0c'}` }}>
            <span className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded text-[9px] tracking-widest" style={{ background: current ? color : `${color}33`, color: current ? '#fff' : color }}>{badge}</span>
              {label}
            </span>
            <span className="opacity-70">{rows.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead style={{ background: `${color}0a` }}><tr>
                {headers.map((h: string) => <th key={h} className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider" style={{ color }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {rows.length ? rows.map(renderRow) : <tr><td colSpan={headers.length} className="px-3 py-6 text-center text-text-muted">None</td></tr>}
              </tbody>
              {t && rows.length ? (
                <tfoot>
                  <tr style={{ background: `${color}10`, borderTop: `2px solid ${color}55` }}>
                    <td className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider" style={{ color }}>{t.label}</td>
                    <td className="px-3 py-2 font-bold" style={{ color }} colSpan={headers.length - 1}>{t.value}</td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        </div>
      );
    };
    return (
      <section>
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2.5 h-6 rounded-full" style={{ background: color }} />
          <div className="text-sm font-bold uppercase tracking-wider" style={{ color }}>{title}</div>
          {subtitle && <span className="text-xs text-text-muted">{subtitle}</span>}
        </div>
        <div className="flex flex-col lg:flex-row gap-5">
          <Col label={thisLabel} badge="Current" rows={rowsThis} current />
          <Col label={lastLabel} badge="Previous" rows={rowsLast} current={false} />
        </div>
      </section>
    );
  };

  const cellRow = {
    cash: (c: any) => (
      <tr key={c.id} className="border-t border-[#f1ece3]">
        <td className="px-3 py-2 text-text-muted whitespace-nowrap">{c.date}</td>
        <td className="px-3 py-2 font-medium">{c.payee}</td>
        <td className="px-3 py-2"><span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#fdeaea] text-[#b0412f]">{c.category}</span></td>
        <td className="px-3 py-2 font-semibold">{fmt$(num(c.amount))}</td>
        <td className="px-3 py-2 text-text-muted">{c.note ?? '—'}</td>
      </tr>
    ),
    pto: (e: any) => (
      <tr key={e.id} className="border-t border-[#f1ece3]">
        <td className="px-3 py-2 font-medium">{e.employee}</td><td className="px-3 py-2 text-text-muted">{e.type}</td>
        <td className="px-3 py-2 text-text-muted">{e.start_date}</td><td className="px-3 py-2 text-text-muted">{e.end_date}</td>
        <td className="px-3 py-2 text-text-muted">{e.days}</td>
      </tr>
    ),
    trip: (t: any) => (
      <tr key={t.id} className="border-t border-[#f1ece3]">
        <td className="px-3 py-2 font-medium">{t.who}</td>
        <td className="px-3 py-2 text-text-muted whitespace-nowrap">{tripDate(t)}</td>
        <td className="px-3 py-2 text-text-secondary">{t.detail}</td>
        <td className="px-3 py-2 text-text-muted">{t.matter ?? '—'}</td><td className="px-3 py-2 text-text-muted">{t.cost != null ? fmt$(num(t.cost)) : '—'}</td>
        <td className="px-3 py-2"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${tripStatusChip(t.status)}`}>{t.status}</span></td>
      </tr>
    ),
    contractor: (c: any) => (
      <tr key={c.id} className="border-t border-[#f1ece3]">
        <td className="px-3 py-2 font-medium">{cName(c)}</td><td className="px-3 py-2 text-text-muted">{cDate(c)}</td>
        <td className="px-3 py-2 text-text-muted">{fmt$(num(c.amount))}</td><td className="px-3 py-2 text-text-muted">{cNote(c)}</td>
      </tr>
    ),
    review: (r: any) => (
      <tr key={r.id} className="border-t border-[#f1ece3]">
        <td className="px-3 py-2 font-medium">{r.name}</td><td className="px-3 py-2 text-text-muted">{r.role}</td>
        <td className="px-3 py-2 text-text-secondary">{r.type}</td><td className="px-3 py-2 text-text-muted">{r.date}</td>
        <td className="px-3 py-2"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${reviewStatusChip(r.status)}`}>{r.status}</span></td>
      </tr>
    ),
    reimb: (r: any) => (
      <tr key={r.id} className="border-t border-[#f1ece3]">
        <td className="px-3 py-2 font-medium">{r.employee}</td><td className="px-3 py-2 text-text-muted">{r.purpose}</td>
        <td className="px-3 py-2 font-semibold">{fmt$(num(r.amount))}</td><td className="px-3 py-2 text-text-muted">{r.payout_date ?? '—'}</td>
        <td className="px-3 py-2">{r.has_attachment ? <AttachLink tab="reimbursements" id={r.id} name={r.attachment_name} /> : <span className="text-text-faint text-xs">—</span>}</td>
      </tr>
    ),
    insurance: (r: any) => (
      <tr key={r.id} className="border-t border-[#f1ece3]">
        <td className="px-3 py-2 font-medium">{r.carrier}</td><td className="px-3 py-2 text-text-muted">{r.invoice_type}</td>
        <td className="px-3 py-2 font-semibold">{fmt$(num(r.amount))}</td><td className="px-3 py-2 text-text-muted">{r.deadline}</td>
        <td className="px-3 py-2 text-text-muted">{r.enrolled_count ?? '—'}</td>
        <td className="px-3 py-2">{r.has_attachment ? <AttachLink tab="insurance" id={r.id} name={r.attachment_name} /> : <span className="text-text-faint text-xs">—</span>}</td>
      </tr>
    ),
  };

  return (
    <div className="space-y-6">
      {/* Header + downloads */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-text-muted">Comparing</span>
        <input type="month" value={thisKey} onChange={e => e.target.value && setThisKey(e.target.value)}
          className="border border-border-light rounded-ctrl px-2 py-1.5 text-sm focus:outline-none focus:border-ink" title="First month (left / current column)" />
        <span className="text-sm text-text-muted">vs</span>
        <input type="month" value={lastKey} onChange={e => e.target.value && setLastKey(e.target.value)}
          className="border border-border-light rounded-ctrl px-2 py-1.5 text-sm focus:outline-none focus:border-ink" title="Second month (right / comparison column)" />
        <span className="text-sm text-text-muted">— side by side</span>
        <div className="ml-auto flex gap-2">
          <button onClick={printPack} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark">🖨 Print / Save PDF</button>
          <button onClick={downloadXls} className="bg-white border border-border-light text-ink text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-canvas">↓ Download Excel</button>
          <button onClick={downloadCsvPack} className="bg-white border border-border-light text-text-muted text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-canvas">↓ Raw CSV</button>
        </div>
      </div>

      {/* Comparison band — Current vs Previous split per metric */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {metrics.map(m => {
          const delta = m.thisV - m.lastV;
          const tilde = (m as any).approx ? '~' : '';
          const fmtV = (v: number) => m.money ? tilde + fmt$(v) : String(v);
          return (
            <div key={m.label} className="bg-white border rounded-card overflow-hidden" style={{ borderTop: `3px solid ${m.color}` }}>
              <div className="px-4 pt-2.5 pb-2 text-[11px] font-bold uppercase tracking-widest text-text-primary flex items-center justify-between">
                <span>{m.label}</span>
                {delta !== 0 && <span className={`px-1.5 py-0.5 rounded ${delta > 0 ? 'text-[#b0412f] bg-[#fdeaea]' : 'text-[#2f7d5b] bg-[#eef5f1]'}`}>{delta > 0 ? '▲' : '▼'} {m.money ? fmt$(Math.abs(delta)) : Math.abs(delta)}</span>}
              </div>
              <div className="grid grid-cols-2 divide-x divide-border-light border-t border-border-light">
                <div className="px-3 py-2 min-w-0" style={{ background: `${m.color}14` }}>
                  <div className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: m.color }}>{thisLabel.split(' ')[0]} · Current</div>
                  <div className="font-spectral text-lg font-bold mt-0.5 leading-tight tabular-nums break-words" style={{ color: m.color, overflowWrap: 'anywhere' }}>{fmtV(m.thisV)}</div>
                </div>
                <div className="px-3 py-2 min-w-0">
                  <div className="text-[10px] font-extrabold uppercase tracking-widest text-text-secondary">{lastLabel.split(' ')[0]} · Previous</div>
                  <div className="font-spectral text-lg font-bold mt-0.5 leading-tight tabular-nums break-words text-text-secondary" style={{ overflowWrap: 'anywhere' }}>{fmtV(m.lastV)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Compare title="Cash Out" color="#b0412f" subtitle={`${thisLabel}: ${fmt$(cashTotalOf(thisKey))} · ${lastLabel}: ${fmt$(cashTotalOf(lastKey))}`}
        headers={['Date', 'Payee', 'Category', 'Amount', 'Note']} renderRow={cellRow.cash} rowsThis={cashoutOf(thisKey)} rowsLast={cashoutOf(lastKey)}
        total={(rows: any[]) => ({ label: 'Total Cash Out', value: fmt$(rows.reduce((s, c) => s + num(c.amount), 0)) })} />
      <Compare title="Paid Time Off" color="#2f7d5b" headers={['Employee', 'Type', 'Start', 'End', 'Days']} renderRow={cellRow.pto} rowsThis={ptoOf(thisKey)} rowsLast={ptoOf(lastKey)}
        total={(rows: any[]) => ({ label: 'Total PTO Days', value: `${rows.reduce((s, e) => s + num(e.days), 0)} days · ${rows.length} PTOs` })} />
      <Compare title="Contractor Payments" color="#6b4f8a" headers={['Name', 'Date', 'Amount', 'Note']} renderRow={cellRow.contractor} rowsThis={contractorOf(thisKey)} rowsLast={contractorOf(lastKey)}
        total={(rows: any[]) => ({ label: 'Total Contractor $', value: fmt$(rows.reduce((s, c) => s + num(c.amount), 0)) })} />
      <Compare title="Trips & Travel" color="#3f6b8a" headers={['Traveler', 'Travel Date', 'Details', 'Client', 'Cost', 'Status']} renderRow={cellRow.trip} rowsThis={tripOf(thisKey)} rowsLast={tripOf(lastKey)} />
      <Compare title="Reimbursements" color="#2f7d5b" subtitle={`${thisLabel}: ${fmt$(reimbTotalOf(thisKey))} · ${lastLabel}: ${fmt$(reimbTotalOf(lastKey))}`}
        headers={['Employee', 'Purpose', 'Amount', 'Payout Date', 'Receipt']} renderRow={cellRow.reimb} rowsThis={reimbOf(thisKey)} rowsLast={reimbOf(lastKey)}
        total={(rows: any[]) => ({ label: 'Total Reimbursements', value: fmt$(rows.reduce((s, r) => s + num(r.amount), 0)) })} />
      <Compare title="Insurance Invoices" color="#6b4f8a" subtitle={`${thisLabel}: ${fmt$(insuranceTotalOf(thisKey))} · ${lastLabel}: ${fmt$(insuranceTotalOf(lastKey))}`}
        headers={['Carrier', 'Type', 'Amount', 'Deadline', 'Enrolled', 'Invoice']} renderRow={cellRow.insurance} rowsThis={insuranceOf(thisKey)} rowsLast={insuranceOf(lastKey)}
        total={(rows: any[]) => ({ label: 'Total Premiums', value: fmt$(rows.reduce((s, r) => s + num(r.amount), 0)) })} />
      <Compare title="Performance Reviews" color="#b07d2a" headers={['Employee', 'Role', 'Review', 'Date', 'Status']} renderRow={cellRow.review} rowsThis={reviewOf(thisKey)} rowsLast={reviewOf(lastKey)} />

      {(() => {
        // Supporting documents (invoices, receipts, cash-out docs) for the two
        // months being compared, plus any that have no date on record.
        const inMonth = (k: string) => (attachments ?? []).filter((a: any) => a.date && ymOf(a.date) === k);
        const undated = (attachments ?? []).filter((a: any) => !a.date);
        if (!(attachments ?? []).length) return null;
        return (
          <section>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2.5 h-6 rounded-full bg-[#3f6b8a]" />
              <div className="text-sm font-bold uppercase tracking-wider text-[#3f6b8a]">Supporting Documents</div>
              <span className="text-xs text-text-muted">{thisLabel}: {inMonth(thisKey).length} · {lastLabel}: {inMonth(lastKey).length}</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {[{ lbl: thisLabel, k: thisKey, cur: true }, { lbl: lastLabel, k: lastKey, cur: false }].map(({ lbl, k, cur }) => (
                <div key={lbl} className="rounded-card p-3" style={{ border: `2px solid #3f6b8a${cur ? '' : '55'}`, background: cur ? '#3f6b8a10' : '#fff' }}>
                  <div className="text-xs font-bold text-[#3f6b8a] mb-1.5 flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded text-[9px] tracking-widest" style={{ background: cur ? '#3f6b8a' : '#3f6b8a33', color: cur ? '#fff' : '#3f6b8a' }}>{cur ? 'Current' : 'Previous'}</span>
                    {lbl}
                  </div>
                  <div className="space-y-1.5">
                    {inMonth(k).length ? inMonth(k).map((a: any) => (
                      <div key={a.id} className="bg-white border border-border rounded-ctrl px-3 py-2 text-sm flex items-center justify-between gap-2">
                        <span className="text-text-secondary truncate">{a.label}</span>
                        <AttachLink tab={a.tab} id={a.id} name={a.name} />
                      </div>
                    )) : <p className="text-sm text-text-muted">None</p>}
                  </div>
                </div>
              ))}
            </div>
            {undated.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="text-xs text-text-muted self-center">No date on record:</span>
                {undated.map((a: any) => (
                  <span key={a.id} className="bg-white border border-border rounded-ctrl px-3 py-1.5 text-sm inline-flex items-center gap-2">
                    <span className="text-text-secondary">{a.label}</span> <AttachLink tab={a.tab} id={a.id} name={a.name} />
                  </span>
                ))}
              </div>
            )}
          </section>
        );
      })()}

      <section>
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2.5 h-6 rounded-full bg-[#c9a24a]" />
          <div className="text-sm font-bold uppercase tracking-wider text-[#8a6d3b]">Birthdays</div>
          <span className="text-xs text-text-muted">{thisLabel}: {birthdaysOf(thisM).length} · {lastLabel}: {birthdaysOf(lastM).length}</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[{ lbl: thisLabel, mi: thisM, cur: true }, { lbl: lastLabel, mi: lastM, cur: false }].map(({ lbl, mi, cur }) => (
            <div key={lbl} className="rounded-card p-3" style={{ border: `2px solid #c9a24a${cur ? '' : '55'}`, background: cur ? '#c9a24a10' : '#fff' }}>
              <div className="text-xs font-bold text-[#8a6d3b] mb-1.5 flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded text-[9px] tracking-widest" style={{ background: cur ? '#c9a24a' : '#c9a24a33', color: cur ? '#fff' : '#8a6d3b' }}>{cur ? 'Current' : 'Previous'}</span>
                {lbl}
              </div>
              <div className="flex flex-wrap gap-2">
                {birthdaysOf(mi).length ? birthdaysOf(mi).map((e: any) => (
                  <div key={e.id} className="bg-white border border-border rounded-card px-3 py-2 text-sm">
                    <div className="font-semibold text-text-primary">🎂 {e.name}</div>
                    <div className="text-text-muted text-xs">{e.dob}</div>
                  </div>
                )) : <p className="text-sm text-text-muted">None</p>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2.5 h-6 rounded-full bg-[#8a6d3b]" />
          <div className="text-sm font-bold uppercase tracking-wider text-[#6b5427]">Work Anniversaries</div>
          <span className="text-xs text-text-muted">{thisLabel}: {anniversariesOf(thisM, thisY).length} · {lastLabel}: {anniversariesOf(lastM, lastY).length}</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[{ lbl: thisLabel, mi: thisM, yr: thisY, cur: true }, { lbl: lastLabel, mi: lastM, yr: lastY, cur: false }].map(({ lbl, mi, yr, cur }) => (
            <div key={lbl} className="rounded-card p-3" style={{ border: `2px solid #8a6d3b${cur ? '' : '55'}`, background: cur ? '#8a6d3b10' : '#fff' }}>
              <div className="text-xs font-bold text-[#6b5427] mb-1.5 flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded text-[9px] tracking-widest" style={{ background: cur ? '#8a6d3b' : '#8a6d3b33', color: cur ? '#fff' : '#6b5427' }}>{cur ? 'Current' : 'Previous'}</span>
                {lbl}
              </div>
              <div className="flex flex-wrap gap-2">
                {anniversariesOf(mi, yr).length ? anniversariesOf(mi, yr).map((e: any) => (
                  <div key={e.id} className="bg-white border border-border rounded-card px-3 py-2 text-sm">
                    <div className="font-semibold text-text-primary">🎉 {e.name}</div>
                    <div className="text-text-muted text-xs">{e.years} {e.years === 1 ? 'year' : 'years'} · since {e.start_date}</div>
                  </div>
                )) : <p className="text-sm text-text-muted">None</p>}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ---- Insurance tab ----
function InsuranceTab() {
  const { showToast } = useToast();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ carrier: '', invoiceType: '', amount: '', deadline: '', coveragePeriod: '', enrolledCount: '' });
  const [reading, setReading] = useState(false);
  const [attach, setAttach] = useState<File | null>(null); // the invoice file to keep on file
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetch('/api/reports?tab=insurance').then(r => r.json()).then(d => setInvoices(d.invoices ?? [])); }, []);

  // Upload an invoice (PDF, DOCX, or a screenshot) — the server reads it and
  // fills in the form fields automatically; HR reviews and clicks Add.
  async function readInvoiceFile(file: File) {
    setReading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await fetch('/api/reports/insurance-extract', { method: 'POST', body: fd });
      const d = await res.json();
      if (!res.ok) { showToast(d.error ?? 'Could not read the file'); setShowAdd(true); return; }
      const f = d.fields ?? {};
      setForm({
        carrier: f.carrier ?? '', invoiceType: f.invoiceType ?? '', amount: f.amount ?? '',
        deadline: f.deadline ?? '', coveragePeriod: f.coveragePeriod ?? '', enrolledCount: f.enrolledCount ?? '',
      });
      // Keep the exact file the reader used, so it stays attached to the record
      // (unless it's too big to store — then just the extracted fields are kept).
      setAttach(file.size <= MAX_ATTACH ? file : null);
      setShowAdd(true);
      const got = ['carrier', 'invoiceType', 'amount', 'deadline', 'coveragePeriod', 'enrolledCount'].filter(k => f[k]).length;
      showToast(got ? `Read ${got} field${got > 1 ? 's' : ''} from ${file.name} — review and click Add` : 'Could not find invoice fields — fill them in manually');
    } catch {
      showToast('Could not read the file'); setShowAdd(true);
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function add() {
    const attachment = attach ? { attachmentName: attach.name, attachmentData: await fileToDataUrl(attach) } : {};
    const res = await fetch('/api/reports?tab=insurance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, amount: Number(form.amount), enrolledCount: form.enrolledCount ? Number(form.enrolledCount) : null, ...attachment }) });
    const { invoice } = await res.json();
    setInvoices(p => [...p, invoice]);
    setForm({ carrier: '', invoiceType: '', amount: '', deadline: '', coveragePeriod: '', enrolledCount: '' });
    setAttach(null);
    setShowAdd(false);
    showToast('Invoice added');
  }

  return (
    <div>
      <div className="flex justify-end items-center gap-2 mb-4">
        <input ref={fileRef} type="file" accept=".pdf,.docx,.png,.jpg,.jpeg,.webp,.gif,application/pdf,image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) readInvoiceFile(f); }} />
        <button onClick={() => fileRef.current?.click()} disabled={reading}
          className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark disabled:opacity-50"
          title="Upload the invoice (PDF, DOCX, or a screenshot) — the fields fill in automatically">
          {reading ? '⏳ Reading invoice…' : '⇪ Upload invoice (auto-read)'}
        </button>
        <button onClick={() => setShowAdd(v => !v)} className="bg-white border border-border-light text-ink text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-canvas">＋ Add Invoice</button>
      </div>
      {showAdd && (
        <div className="bg-[#fbf7ee] border border-border rounded-card p-5 mb-5 grid grid-cols-3 gap-4">
          {([['Carrier','carrier'],['Invoice Type','invoiceType'],['Amount ($)','amount'],['Deadline','deadline'],['Coverage Period','coveragePeriod'],['Enrolled Count','enrolledCount']] as [string, keyof typeof form][]).map(([l, k]) => (
            <div key={k}>
              <label className="block text-xs font-semibold text-text-secondary mb-1">{l}</label>
              <input type={k === 'deadline' ? 'date' : k === 'amount' || k === 'enrolledCount' ? 'number' : 'text'} value={form[k]}
                onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))}
                className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
            </div>
          ))}
          <div className="col-span-3"><AttachField file={attach} onPick={setAttach} label="Invoice file (kept on record)" /></div>
          <div className="col-span-3 flex gap-2">
            <button onClick={add} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark">Add</button>
            <button onClick={() => { setShowAdd(false); setAttach(null); }} className="text-sm text-text-muted px-3">Cancel</button>
          </div>
        </div>
      )}
      <div className="bg-white border border-border rounded-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#f1ece3]"><tr>
            {['Carrier','Type','Amount','Deadline','Coverage Period','Enrolled','Invoice'].map(h => <th key={h} className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-text-secondary">{h}</th>)}
          </tr></thead>
          <tbody>
            {invoices.map((inv: any) => (
              <tr key={inv.id} className="border-t border-[#f1ece3]">
                <td className="px-4 py-3 font-medium">{inv.carrier}</td>
                <td className="px-4 py-3 text-text-muted">{inv.invoice_type}</td>
                <td className="px-4 py-3">${Number(inv.amount).toLocaleString()}</td>
                <td className="px-4 py-3 text-text-muted">{inv.deadline}</td>
                <td className="px-4 py-3 text-text-muted">{inv.coverage_period}</td>
                <td className="px-4 py-3 text-text-muted">{inv.enrolled_count}</td>
                <td className="px-4 py-3"><RowAttach tab="insurance" id={inv.id} hasAttachment={!!inv.has_attachment} name={inv.attachment_name}
                  onChange={name => setInvoices(p => p.map(x => x.id === inv.id ? { ...x, has_attachment: true, attachment_name: name } : x))} /></td>
              </tr>
            ))}
            {!invoices.length && <tr><td colSpan={7} className="px-4 py-6 text-center text-text-muted">No invoices</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- Reimbursements tab ----
function ReimbursementsTab() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ employee: '', purpose: '', amount: '', payoutDate: '' });
  const [attach, setAttach] = useState<File | null>(null);

  useEffect(() => { fetch('/api/reports?tab=reimbursements').then(r => r.json()).then(d => setRows(d.rows ?? [])); }, []);

  async function add() {
    const attachment = attach ? { attachmentName: attach.name, attachmentData: await fileToDataUrl(attach) } : {};
    const res = await fetch('/api/reports?tab=reimbursements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, amount: Number(form.amount), ...attachment }) });
    const { row } = await res.json();
    setRows(p => [row, ...p]);
    setForm({ employee: '', purpose: '', amount: '', payoutDate: '' });
    setAttach(null);
    setShowAdd(false);
    showToast('Reimbursement added');
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => setShowAdd(v => !v)} className="bg-white border border-border-light text-ink text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-canvas">＋ Add</button>
      </div>
      {showAdd && (
        <div className="bg-[#fbf7ee] border border-border rounded-card p-5 mb-5 grid grid-cols-2 gap-4">
          {([['Employee','employee'],['Purpose','purpose'],['Amount ($)','amount'],['Payout Date','payoutDate']] as [string, keyof typeof form][]).map(([l, k]) => (
            <div key={k}>
              <label className="block text-xs font-semibold text-text-secondary mb-1">{l}</label>
              <input type={k === 'payoutDate' ? 'date' : k === 'amount' ? 'number' : 'text'} value={form[k]}
                onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))}
                className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
            </div>
          ))}
          <div className="col-span-2"><AttachField file={attach} onPick={setAttach} label="Receipt / invoice (optional)" /></div>
          <div className="col-span-2 flex gap-2">
            <button onClick={add} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark">Add</button>
            <button onClick={() => { setShowAdd(false); setAttach(null); }} className="text-sm text-text-muted px-3">Cancel</button>
          </div>
        </div>
      )}
      <div className="bg-white border border-border rounded-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#f1ece3]"><tr>
            {['Employee','Purpose','Amount','Payout Date','Receipt'].map(h => <th key={h} className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-text-secondary">{h}</th>)}
          </tr></thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.id} className="border-t border-[#f1ece3]">
                <td className="px-4 py-3 font-medium">{r.employee}</td>
                <td className="px-4 py-3 text-text-muted">{r.purpose}</td>
                <td className="px-4 py-3">${Number(r.amount).toLocaleString()}</td>
                <td className="px-4 py-3 text-text-muted">{r.payout_date}</td>
                <td className="px-4 py-3"><RowAttach tab="reimbursements" id={r.id} hasAttachment={!!r.has_attachment} name={r.attachment_name}
                  onChange={name => setRows(p => p.map(x => x.id === r.id ? { ...x, has_attachment: true, attachment_name: name } : x))} /></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5} className="px-4 py-6 text-center text-text-muted">No reimbursements</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- Cash Out tab ----
function CashOutTab() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [filterMonth, setFilterMonth] = useState('');
  const [filterCat, setFilterCat] = useState('All');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ date: '', payee: '', category: 'Payroll', amount: '', status: 'Paid', note: '' });
  const [attach, setAttach] = useState<File | null>(null);
  const CATEGORIES = ['Payroll','Guideline','Distribution','Reimbursement','Travel','Office Supplies','Legal Fees','Software','Marketing','Other'];

  function load() {
    const params = new URLSearchParams({ tab: 'cashout' });
    if (filterMonth) params.set('month', filterMonth);
    if (filterCat !== 'All') params.set('category', filterCat);
    fetch(`/api/reports?${params}`).then(r => r.json()).then(d => setRows(d.rows ?? []));
  }

  useEffect(load, [filterMonth, filterCat]);

  async function add() {
    const attachment = attach ? { attachmentName: attach.name, attachmentData: await fileToDataUrl(attach) } : {};
    const res = await fetch('/api/reports?tab=cashout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, amount: Number(form.amount), ...attachment }) });
    const { row } = await res.json();
    setRows(p => [row, ...p]);
    setForm({ date: '', payee: '', category: 'Payroll', amount: '', status: 'Paid', note: '' });
    setAttach(null);
    setShowAdd(false);
    showToast('Entry added');
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
          className="border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          className="border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink bg-white">
          <option>All</option>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <button onClick={() => setShowAdd(v => !v)} className="ml-auto bg-white border border-border-light text-ink text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-canvas">＋ Add Entry</button>
      </div>
      {showAdd && (
        <div className="bg-[#fbf7ee] border border-border rounded-card p-5 mb-5 grid grid-cols-3 gap-4">
          {([['Date','date'],['Payee','payee'],['Category','category'],['Amount ($)','amount'],['Status','status'],['Note','note']] as [string, keyof typeof form][]).map(([l, k]) => (
            <div key={k}>
              <label className="block text-xs font-semibold text-text-secondary mb-1">{l}</label>
              {k === 'category' ? (
                <select value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm bg-white focus:outline-none focus:border-ink">
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              ) : k === 'status' ? (
                <select value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm bg-white focus:outline-none focus:border-ink">
                  {['Pending','Paid'].map(s => <option key={s}>{s}</option>)}
                </select>
              ) : (
                <input type={k === 'date' ? 'date' : k === 'amount' ? 'number' : 'text'} value={form[k]}
                  onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))}
                  className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
              )}
            </div>
          ))}
          <div className="col-span-3"><AttachField file={attach} onPick={setAttach} label="Supporting document (optional)" /></div>
          <div className="col-span-3 flex gap-2">
            <button onClick={add} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark">Add</button>
            <button onClick={() => { setShowAdd(false); setAttach(null); }} className="text-sm text-text-muted px-3">Cancel</button>
          </div>
        </div>
      )}
      <div className="bg-white border border-border rounded-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#f1ece3]"><tr>
            {['Date','Payee','Category','Amount','Status','Note','Doc'].map(h => <th key={h} className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-text-secondary">{h}</th>)}
          </tr></thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.id} className="border-t border-[#f1ece3]">
                <td className="px-4 py-3 text-text-muted whitespace-nowrap">{r.date}</td>
                <td className="px-4 py-3 font-medium">{r.payee}</td>
                <td className="px-4 py-3"><span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#f1ece3] text-text-secondary">{r.category}</span></td>
                <td className="px-4 py-3 font-semibold">${Number(r.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.status === 'Paid' ? 'bg-[#eef5f1] text-[#2f7d5b]' : 'bg-[#f7efe1] text-[#b07d2a]'}`}>{r.status}</span>
                </td>
                <td className="px-4 py-3 text-text-muted">{r.note ?? '—'}</td>
                <td className="px-4 py-3"><RowAttach tab="cashout" id={r.id} hasAttachment={!!r.has_attachment} name={r.attachment_name}
                  onChange={name => setRows(p => p.map(x => x.id === r.id ? { ...x, has_attachment: true, attachment_name: name } : x))} /></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} className="px-4 py-6 text-center text-text-muted">No entries</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- Main ----
const TABS: { key: Tab; label: string }[] = [
  { key: 'monthly', label: 'Monthly Pack' },
  { key: 'trips', label: 'Trips' },
  { key: 'pto', label: 'PTO' },
  { key: 'reviews', label: 'Performance Reviews' },
  { key: 'insurance', label: 'Insurance' },
  { key: 'reimbursements', label: 'Reimbursements' },
  { key: 'cashout', label: 'Cash Out' },
];

export default function ReportsClient() {
  const [tab, setTab] = useState<Tab>('monthly');
  const [monthlyData, setMonthlyData] = useState<any>(null);

  useEffect(() => {
    if (tab === 'monthly') {
      Promise.all([
        fetch('/api/reports?tab=monthly').then(r => r.json()),
        fetchMergedPto(),
      ]).then(([d, mergedPto]) => setMonthlyData({ ...d, pto: mergedPto }));
    }
  }, [tab]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="px-8 py-5 bg-white border-b border-border flex-shrink-0">
        <h1 className="font-spectral text-[23px] font-semibold text-text-primary">Reports</h1>
      </header>
      <div className="flex gap-1 px-8 py-3 border-b border-border bg-white flex-shrink-0">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={clsx('text-sm font-semibold px-4 py-2 rounded-ctrl transition-colors', tab === t.key ? 'bg-ink text-white' : 'text-text-secondary hover:bg-canvas')}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto px-8 py-6">
        {tab === 'monthly' && <MonthlyTab data={monthlyData} />}
        {tab === 'trips' && <TripsReportTab />}
        {tab === 'pto' && <PtoReportTab />}
        {tab === 'reviews' && <ReviewsReportTab />}
        {tab === 'insurance' && <InsuranceTab />}
        {tab === 'reimbursements' && <ReimbursementsTab />}
        {tab === 'cashout' && <CashOutTab />}
      </div>
    </div>
  );
}

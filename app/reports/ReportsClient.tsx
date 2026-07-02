'use client';
import { useState, useEffect, useRef } from 'react';
import clsx from 'clsx';
import { useToast } from '@/components/Toast';
import { mergePto } from '@/lib/pto';
import { reviewRows } from '@/lib/reviews';

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

  useEffect(() => { fetch('/api/reports?tab=monthly').then(r => r.json()).then(d => setTrips(d.trips ?? [])); }, []);

  const filtered = trips.filter((t: any) => {
    const d = (t.created_at ?? '').slice(0, 10);
    if (from && d < from) return false;
    if (to && d > to) return false;
    if (q) {
      const s = q.toLowerCase();
      if (!(`${t.who ?? ''} ${t.detail ?? ''} ${t.matter ?? ''} ${t.status ?? ''}`.toLowerCase().includes(s))) return false;
    }
    return true;
  });
  const totalSpend = filtered.reduce((s: number, t: any) => s + (Number(t.cost) || 0), 0);
  const approved = filtered.filter((t: any) => t.status === 'Approved').length;
  const pending = filtered.filter((t: any) => t.status === 'Pending').length;

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
            {['Traveler','Details','Matter / Client','Cost','Status','Date'].map(h => <th key={h} className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-text-secondary">{h}</th>)}
          </tr></thead>
          <tbody>
            {filtered.map((t: any) => (
              <tr key={t.id} className="border-t border-[#f1ece3]">
                <td className="px-4 py-3 font-medium">{t.who}</td>
                <td className="px-4 py-3 text-text-secondary">{t.detail}</td>
                <td className="px-4 py-3 text-text-muted">{t.matter ?? '—'}</td>
                <td className="px-4 py-3 text-text-muted">{t.cost != null ? fmt$(Number(t.cost)) : '—'}</td>
                <td className="px-4 py-3"><span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#f1ece3] text-text-secondary">{t.status}</span></td>
                <td className="px-4 py-3 text-text-muted">{(t.created_at ?? '').slice(0, 10)}</td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={6} className="px-4 py-6 text-center text-text-muted">No trips in this range</td></tr>}
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
    const d = (e.start_date ?? '').slice(0, 10);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });
  const totalDays = filtered.reduce((s: number, e: any) => s + (Number(e.days) || 0), 0);
  const people = new Set(filtered.map((e: any) => e.employee)).size;

  function exportCsv() {
    const rows = filtered.map((e: any) => [
      e.employee, e.type, (e.start_date ?? '').slice(0, 10), (e.end_date ?? '').slice(0, 10),
      Number(e.days) || 0, e.status,
    ]);
    downloadCsv(`pto-report${from ? '-' + from : ''}${to ? '-to-' + to : ''}.csv`,
      ['Employee', 'Type', 'Start', 'End', 'Days', 'Status'], rows);
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
            {['Employee','Type','Start','End','Days','Status'].map(h => <th key={h} className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-text-secondary">{h}</th>)}
          </tr></thead>
          <tbody>
            {filtered.map((e: any) => (
              <tr key={e.id} className="border-t border-[#f1ece3]">
                <td className="px-4 py-3 font-medium">{e.employee}</td>
                <td className="px-4 py-3 text-text-muted">{e.type}</td>
                <td className="px-4 py-3 text-text-muted">{(e.start_date ?? '').slice(0, 10)}</td>
                <td className="px-4 py-3 text-text-muted">{(e.end_date ?? '').slice(0, 10)}</td>
                <td className="px-4 py-3 text-text-muted">{e.days}</td>
                <td className="px-4 py-3"><span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#eef5f1] text-[#2f7d5b]">{e.status}</span></td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={6} className="px-4 py-6 text-center text-text-muted">No PTO entries in this range</td></tr>}
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
  const { pto, trips, contractors, reviews, cashout, staff } = data;

  const now = new Date();
  const thisY = now.getFullYear(), thisM = now.getMonth();
  const last = new Date(thisY, thisM - 1, 1);
  const thisKey = `${thisY}-${String(thisM + 1).padStart(2, '0')}`;
  const lastKey = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}`;
  const thisLabel = monthLabel(thisY, thisM);
  const lastLabel = monthLabel(last.getFullYear(), last.getMonth());

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
    { label: 'Reviews Due', color: '#b07d2a', money: false, thisV: reviewOf(thisKey).filter(r => r.status !== 'Complete').length, lastV: reviewOf(lastKey).filter(r => r.status !== 'Complete').length },
    { label: 'Birthdays', color: '#c9a24a', money: false, thisV: birthdaysOf(thisM).length, lastV: birthdaysOf(last.getMonth()).length },
    { label: 'Anniversaries', color: '#8a6d3b', money: false, thisV: anniversariesOf(thisM, thisY).length, lastV: anniversariesOf(last.getMonth(), last.getFullYear()).length },
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
    csvSection(lines, 'PTO', ['Employee', 'Type', 'Start', 'End', 'Days', 'Status'], ptoOf(thisKey).map((e: any) => [e.employee, e.type, e.start_date, e.end_date, e.days, e.status]), ptoOf(lastKey).map((e: any) => [e.employee, e.type, e.start_date, e.end_date, e.days, e.status]));
    csvSection(lines, 'TRIPS', ['Traveler', 'Details', 'Client', 'Cost', 'Status', 'Month'], tripOf(thisKey).map((t: any) => [t.who, t.detail, t.matter, num(t.cost), t.status, tripMonthKey(t)]), tripOf(lastKey).map((t: any) => [t.who, t.detail, t.matter, num(t.cost), t.status, tripMonthKey(t)]));
    csvSection(lines, 'CONTRACTOR PAYMENTS', ['Name', 'Date', 'Amount', 'Note'], contractorOf(thisKey).map((c: any) => [cName(c), cDate(c), num(c.amount), cNote(c)]), contractorOf(lastKey).map((c: any) => [cName(c), cDate(c), num(c.amount), cNote(c)]));
    csvSection(lines, 'PERFORMANCE REVIEWS', ['Employee', 'Role', 'Review', 'Date', 'Status'], reviewOf(thisKey).map(r => [r.name, r.role, r.type, r.date, r.status]), reviewOf(lastKey).map(r => [r.name, r.role, r.type, r.date, r.status]));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `monthly-pack-${thisKey}-vs-${lastKey}.csv`; a.click();
    showToast('CSV downloaded');
  }

  function printPack() {
    const cmp = metrics.map(m => { const t = (m as any).approx ? '~' : ''; return `<tr><td style="padding:8px 12px;font-weight:600">${m.label}</td><td style="padding:8px 12px;color:${m.color};font-weight:700">${m.money ? t + fmt$(m.thisV) : m.thisV}</td><td style="padding:8px 12px;color:#888">${m.money ? t + fmt$(m.lastV) : m.lastV}</td></tr>`; }).join('');
    const tbl = (color: string, monthLbl: string, headers: string[], rows: string[][]) => `
      <div style="flex:1;min-width:0">
        <div style="font-size:11px;font-weight:700;color:${color};margin:0 0 4px">${monthLbl} · ${rows.length}</div>
        <table style="width:100%;border-collapse:collapse;font-size:11px">
          <thead><tr style="background:${color}18">${headers.map(h => `<th style="text-align:left;padding:5px 8px;color:${color};font-size:9px;text-transform:uppercase">${h}</th>`).join('')}</tr></thead>
          <tbody>${rows.length ? rows.map(r => `<tr style="border-bottom:1px solid #eee">${r.map(c => `<td style="padding:5px 8px;color:#333">${c ?? '—'}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${headers.length}" style="padding:10px;text-align:center;color:#999">None</td></tr>`}</tbody>
        </table>
      </div>`;
    const pair = (title: string, color: string, headers: string[], mapper: (k: string) => string[][]) => `
      <h2 style="font-family:Georgia,serif;font-size:15px;color:${color};border-left:4px solid ${color};padding-left:8px;margin:22px 0 8px">${title}</h2>
      <div style="display:flex;gap:16px;align-items:flex-start">${tbl(color, thisLabel, headers, mapper(thisKey))}${tbl(color, lastLabel, headers, mapper(lastKey))}</div>`;
    const html = `<!DOCTYPE html><html><head><title>Monthly Pack — ${thisLabel} vs ${lastLabel}</title></head>
      <body style="font-family:Georgia,serif;margin:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact">
        <div style="background:linear-gradient(120deg,#1b2a3d,#26405c);padding:22px 32px;border-bottom:4px solid #c9a24a;color:#fff">
          <div style="font-size:22px;font-weight:700;letter-spacing:.15em">LITSON</div>
          <div style="font-size:11px;color:#c9a24a;letter-spacing:.1em">HR MONTHLY PACK · ${thisLabel.toUpperCase()} vs ${lastLabel.toUpperCase()}</div>
        </div>
        <div style="padding:24px 32px">
          <h2 style="font-family:Georgia,serif;font-size:15px;color:#1b2a3d;margin:0 0 8px">Comparison</h2>
          <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:8px">
            <thead><tr style="background:#f1ece3"><th style="text-align:left;padding:6px 12px;font-size:10px;text-transform:uppercase">Category</th><th style="text-align:left;padding:6px 12px;font-size:10px;text-transform:uppercase">${thisLabel}</th><th style="text-align:left;padding:6px 12px;font-size:10px;text-transform:uppercase">${lastLabel}</th></tr></thead>
            <tbody>${cmp}</tbody>
          </table>
          ${pair('Cash Out', '#b0412f', ['Date', 'Payee', 'Category', 'Amount', 'Note'], k => cashoutOf(k).map((c: any) => [c.date, c.payee, c.category, fmt$(num(c.amount)), c.note]))}
          ${pair('PTO', '#2f7d5b', ['Employee', 'Type', 'Start', 'End', 'Days', 'Status'], k => ptoOf(k).map((e: any) => [e.employee, e.type, e.start_date, e.end_date, String(e.days ?? ''), e.status]))}
          ${pair('Trips', '#3f6b8a', ['Traveler', 'Details', 'Client', 'Cost', 'Status'], k => tripOf(k).map((t: any) => [t.who, t.detail, t.matter, fmt$(num(t.cost)), t.status]))}
          ${pair('Contractor Payments', '#6b4f8a', ['Name', 'Date', 'Amount', 'Note'], k => contractorOf(k).map((c: any) => [cName(c), cDate(c), fmt$(num(c.amount)), cNote(c)]))}
          ${pair('Performance Reviews', '#b07d2a', ['Employee', 'Role', 'Review', 'Date', 'Status'], k => reviewOf(k).map(r => [r.name, r.role, r.type, r.date ?? '', r.status]))}
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
        <td className="px-3 py-2"><span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#eef5f1] text-[#2f7d5b]">{e.status}</span></td>
      </tr>
    ),
    trip: (t: any) => (
      <tr key={t.id} className="border-t border-[#f1ece3]">
        <td className="px-3 py-2 font-medium">{t.who}</td><td className="px-3 py-2 text-text-secondary">{t.detail}</td>
        <td className="px-3 py-2 text-text-muted">{t.matter ?? '—'}</td><td className="px-3 py-2 text-text-muted">{t.cost != null ? fmt$(num(t.cost)) : '—'}</td>
        <td className="px-3 py-2"><span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#e9f0f5] text-[#3f6b8a]">{t.status}</span></td>
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
  };

  return (
    <div className="space-y-6">
      {/* Header + downloads */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-text-muted">Comparing <span className="font-semibold text-text-primary">{thisLabel}</span> vs <span className="font-semibold text-text-primary">{lastLabel}</span> — side by side</span>
        <div className="ml-auto flex gap-2">
          <button onClick={printPack} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark">🖨 Print / Save PDF</button>
          <button onClick={downloadCsvPack} className="bg-white border border-border-light text-ink text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-canvas">↓ Download XLS/CSV</button>
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
              <div className="px-4 pt-2.5 pb-2 text-[10px] font-bold uppercase tracking-widest text-text-muted flex items-center justify-between">
                <span>{m.label}</span>
                {delta !== 0 && <span className={delta > 0 ? 'text-[#b0412f]' : 'text-[#2f7d5b]'}>{delta > 0 ? '▲' : '▼'} {m.money ? fmt$(Math.abs(delta)) : Math.abs(delta)}</span>}
              </div>
              <div className="grid grid-cols-2 divide-x divide-border-light border-t border-border-light">
                <div className="px-4 py-2" style={{ background: `${m.color}0c` }}>
                  <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: m.color }}>{thisLabel.split(' ')[0]} · Current</div>
                  <div className="font-spectral text-xl font-semibold mt-0.5" style={{ color: m.color }}>{fmtV(m.thisV)}</div>
                </div>
                <div className="px-4 py-2">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-text-muted">{lastLabel.split(' ')[0]} · Previous</div>
                  <div className="font-spectral text-xl font-semibold mt-0.5 text-text-muted">{fmtV(m.lastV)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Compare title="Cash Out" color="#b0412f" subtitle={`${thisLabel}: ${fmt$(cashTotalOf(thisKey))} · ${lastLabel}: ${fmt$(cashTotalOf(lastKey))}`}
        headers={['Date', 'Payee', 'Category', 'Amount', 'Note']} renderRow={cellRow.cash} rowsThis={cashoutOf(thisKey)} rowsLast={cashoutOf(lastKey)}
        total={(rows: any[]) => ({ label: 'Total Cash Out', value: fmt$(rows.reduce((s, c) => s + num(c.amount), 0)) })} />
      <Compare title="Paid Time Off" color="#2f7d5b" headers={['Employee', 'Type', 'Start', 'End', 'Days', 'Status']} renderRow={cellRow.pto} rowsThis={ptoOf(thisKey)} rowsLast={ptoOf(lastKey)}
        total={(rows: any[]) => ({ label: 'Total PTO Days', value: `${rows.reduce((s, e) => s + num(e.days), 0)} days · ${rows.length} PTOs` })} />
      <Compare title="Contractor Payments" color="#6b4f8a" headers={['Name', 'Date', 'Amount', 'Note']} renderRow={cellRow.contractor} rowsThis={contractorOf(thisKey)} rowsLast={contractorOf(lastKey)}
        total={(rows: any[]) => ({ label: 'Total Contractor $', value: fmt$(rows.reduce((s, c) => s + num(c.amount), 0)) })} />
      <Compare title="Trips & Travel" color="#3f6b8a" headers={['Traveler', 'Details', 'Client', 'Cost', 'Status']} renderRow={cellRow.trip} rowsThis={tripOf(thisKey)} rowsLast={tripOf(lastKey)} />
      <Compare title="Performance Reviews" color="#b07d2a" headers={['Employee', 'Role', 'Review', 'Date', 'Status']} renderRow={cellRow.review} rowsThis={reviewOf(thisKey)} rowsLast={reviewOf(lastKey)} />

      <section>
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2.5 h-6 rounded-full bg-[#c9a24a]" />
          <div className="text-sm font-bold uppercase tracking-wider text-[#8a6d3b]">Birthdays</div>
          <span className="text-xs text-text-muted">{thisLabel}: {birthdaysOf(thisM).length} · {lastLabel}: {birthdaysOf(last.getMonth()).length}</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[{ lbl: thisLabel, mi: thisM, cur: true }, { lbl: lastLabel, mi: last.getMonth(), cur: false }].map(({ lbl, mi, cur }) => (
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
          <span className="text-xs text-text-muted">{thisLabel}: {anniversariesOf(thisM, thisY).length} · {lastLabel}: {anniversariesOf(last.getMonth(), last.getFullYear()).length}</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[{ lbl: thisLabel, mi: thisM, yr: thisY, cur: true }, { lbl: lastLabel, mi: last.getMonth(), yr: last.getFullYear(), cur: false }].map(({ lbl, mi, yr, cur }) => (
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

  useEffect(() => { fetch('/api/reports?tab=insurance').then(r => r.json()).then(d => setInvoices(d.invoices ?? [])); }, []);

  async function add() {
    const res = await fetch('/api/reports?tab=insurance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, amount: Number(form.amount), enrolledCount: form.enrolledCount ? Number(form.enrolledCount) : null }) });
    const { invoice } = await res.json();
    setInvoices(p => [...p, invoice]);
    setForm({ carrier: '', invoiceType: '', amount: '', deadline: '', coveragePeriod: '', enrolledCount: '' });
    setShowAdd(false);
    showToast('Invoice added');
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
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
          <div className="col-span-3 flex gap-2">
            <button onClick={add} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark">Add</button>
            <button onClick={() => setShowAdd(false)} className="text-sm text-text-muted px-3">Cancel</button>
          </div>
        </div>
      )}
      <div className="bg-white border border-border rounded-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#f1ece3]"><tr>
            {['Carrier','Type','Amount','Deadline','Coverage Period','Enrolled'].map(h => <th key={h} className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-text-secondary">{h}</th>)}
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
              </tr>
            ))}
            {!invoices.length && <tr><td colSpan={6} className="px-4 py-6 text-center text-text-muted">No invoices</td></tr>}
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

  useEffect(() => { fetch('/api/reports?tab=reimbursements').then(r => r.json()).then(d => setRows(d.rows ?? [])); }, []);

  async function add() {
    const res = await fetch('/api/reports?tab=reimbursements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, amount: Number(form.amount) }) });
    const { row } = await res.json();
    setRows(p => [row, ...p]);
    setForm({ employee: '', purpose: '', amount: '', payoutDate: '' });
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
          <div className="col-span-2 flex gap-2">
            <button onClick={add} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark">Add</button>
            <button onClick={() => setShowAdd(false)} className="text-sm text-text-muted px-3">Cancel</button>
          </div>
        </div>
      )}
      <div className="bg-white border border-border rounded-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#f1ece3]"><tr>
            {['Employee','Purpose','Amount','Payout Date'].map(h => <th key={h} className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-text-secondary">{h}</th>)}
          </tr></thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.id} className="border-t border-[#f1ece3]">
                <td className="px-4 py-3 font-medium">{r.employee}</td>
                <td className="px-4 py-3 text-text-muted">{r.purpose}</td>
                <td className="px-4 py-3">${Number(r.amount).toLocaleString()}</td>
                <td className="px-4 py-3 text-text-muted">{r.payout_date}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={4} className="px-4 py-6 text-center text-text-muted">No reimbursements</td></tr>}
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
  const CATEGORIES = ['Payroll','Guideline','Distribution','Reimbursement','Travel','Office Supplies','Legal Fees','Software','Marketing','Other'];

  function load() {
    const params = new URLSearchParams({ tab: 'cashout' });
    if (filterMonth) params.set('month', filterMonth);
    if (filterCat !== 'All') params.set('category', filterCat);
    fetch(`/api/reports?${params}`).then(r => r.json()).then(d => setRows(d.rows ?? []));
  }

  useEffect(load, [filterMonth, filterCat]);

  async function add() {
    const res = await fetch('/api/reports?tab=cashout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, amount: Number(form.amount) }) });
    const { row } = await res.json();
    setRows(p => [row, ...p]);
    setForm({ date: '', payee: '', category: 'Payroll', amount: '', status: 'Paid', note: '' });
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
          <div className="col-span-3 flex gap-2">
            <button onClick={add} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark">Add</button>
            <button onClick={() => setShowAdd(false)} className="text-sm text-text-muted px-3">Cancel</button>
          </div>
        </div>
      )}
      <div className="bg-white border border-border rounded-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#f1ece3]"><tr>
            {['Date','Payee','Category','Amount','Status','Note'].map(h => <th key={h} className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-text-secondary">{h}</th>)}
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
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6} className="px-4 py-6 text-center text-text-muted">No entries</td></tr>}
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

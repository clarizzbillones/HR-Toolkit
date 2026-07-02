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
  const [mode, setMode] = useState<'this' | 'last'>('this');
  if (!data) return <div className="py-8 text-center text-text-muted text-sm">Loading…</div>;
  const { pto, trips, contractors, employees, reviews, cashout } = data;

  const now = new Date();
  const thisY = now.getFullYear(), thisM = now.getMonth();
  const last = new Date(thisY, thisM - 1, 1);
  const thisKey = `${thisY}-${String(thisM + 1).padStart(2, '0')}`;
  const lastKey = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}`;
  const selKey = mode === 'this' ? thisKey : lastKey;
  const selLabel = mode === 'this' ? monthLabel(thisY, thisM) : monthLabel(last.getFullYear(), last.getMonth());

  // Contractor field helpers (schema varies)
  const cName = (c: any) => c.contractor ?? c.name ?? '—';
  const cDate = (c: any) => (c.pay_date ?? c.due_date ?? '');
  const cNote = (c: any) => c.notes ?? c.note ?? '';

  // A trip counts for a month if its travel month OR logged month matches
  const tripInMonth = (t: any, k: string) => tripMonthKey(t) === k || ymOf(t.created_at) === k;
  // Per-month metric calculators (PTO excludes < 1 day)
  const ptoDays = (k: string) => (pto ?? []).filter((e: any) => ymOf(e.start_date) === k && num(e.days) >= 1).reduce((s: number, e: any) => s + num(e.days), 0);
  const tripCount = (k: string) => (trips ?? []).filter((t: any) => tripInMonth(t, k)).length;
  const tripSpend = (k: string) => (trips ?? []).filter((t: any) => tripInMonth(t, k)).reduce((s: number, t: any) => s + num(t.cost), 0);
  const contractorSpend = (k: string) => (contractors ?? []).filter((c: any) => ymOf(cDate(c)) === k).reduce((s: number, c: any) => s + num(c.amount), 0);
  const reviewsDue = (k: string) => reviewRows(reviews ?? []).filter(r => r.date && ymOf(r.date) === k && r.status !== 'Complete').length;
  const cashOut = (k: string) => (cashout ?? []).filter((c: any) => ymOf(c.date) === k).reduce((s: number, c: any) => s + num(c.amount), 0);

  const metrics = [
    { label: 'Cash Out', color: '#b0412f', money: true, thisV: cashOut(thisKey), lastV: cashOut(lastKey) },
    { label: 'PTO Days', color: '#2f7d5b', money: false, thisV: ptoDays(thisKey), lastV: ptoDays(lastKey) },
    { label: 'Trips', color: '#3f6b8a', money: false, thisV: tripCount(thisKey), lastV: tripCount(lastKey) },
    { label: 'Travel Spend (approx.)', color: '#3f6b8a', money: true, approx: true, thisV: tripSpend(thisKey), lastV: tripSpend(lastKey) },
    { label: 'Contractor $', color: '#6b4f8a', money: true, thisV: contractorSpend(thisKey), lastV: contractorSpend(lastKey) },
    { label: 'Reviews Due', color: '#b07d2a', money: false, thisV: reviewsDue(thisKey), lastV: reviewsDue(lastKey) },
  ];

  // Selected-month rows
  const ptoRows = (pto ?? []).filter((e: any) => ymOf(e.start_date) === selKey && num(e.days) >= 1);
  const tripRows = (trips ?? []).filter((t: any) => tripInMonth(t, selKey));
  const contractorRows = (contractors ?? []).filter((c: any) => ymOf(cDate(c)) === selKey);
  const reviewRowsSel = reviewRows(reviews ?? []).filter(r => r.date && ymOf(r.date) === selKey).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  const cashoutRows = (cashout ?? []).filter((c: any) => ymOf(c.date) === selKey).sort((a: any, b: any) => (a.date ?? '').localeCompare(b.date ?? ''));
  const cashoutTotal = cashoutRows.reduce((s: number, c: any) => s + num(c.amount), 0);
  const birthdays = (employees ?? []).filter((e: any) => e.birthday && parseInt(e.birthday.split('-')[1]) === (mode === 'this' ? thisM : last.getMonth()) + 1);

  function downloadCsvPack() {
    const lines: string[] = [];
    lines.push(`LITSON HR — Monthly Pack — ${selLabel}`);
    lines.push('');
    lines.push('COMPARISON,This Month,Last Month');
    metrics.forEach(m => { const t = (m as any).approx ? '~' : ''; lines.push(`${m.label},${m.money ? t + fmt$(m.thisV) : m.thisV},${m.money ? t + fmt$(m.lastV) : m.lastV}`); });
    lines.push('');
    lines.push(`CASH OUT — Total ${fmt$(cashoutTotal)}`); lines.push('Date,Payee,Category,Amount,Note');
    cashoutRows.forEach((c: any) => lines.push([c.date, c.payee, c.category, num(c.amount), c.note].map(x => `"${x ?? ''}"`).join(',')));
    lines.push('');
    lines.push('PTO'); lines.push('Employee,Type,Start,End,Days,Status');
    ptoRows.forEach((e: any) => lines.push([e.employee, e.type, e.start_date, e.end_date, e.days, e.status].map(x => `"${x ?? ''}"`).join(',')));
    lines.push(''); lines.push('TRIPS'); lines.push('Traveler,Details,Client,Cost,Status,Date');
    tripRows.forEach((t: any) => lines.push([t.who, t.detail, t.matter, num(t.cost), t.status, tripMonthKey(t)].map(x => `"${x ?? ''}"`).join(',')));
    lines.push(''); lines.push('CONTRACTOR PAYMENTS'); lines.push('Name,Date,Amount,Note');
    contractorRows.forEach((c: any) => lines.push([cName(c), cDate(c), num(c.amount), cNote(c)].map(x => `"${x ?? ''}"`).join(',')));
    lines.push(''); lines.push('PERFORMANCE REVIEWS'); lines.push('Employee,Role,Review,Date,Status');
    reviewRowsSel.forEach(r => lines.push([r.name, r.role, r.type, r.date, r.status].map(x => `"${x ?? ''}"`).join(',')));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `monthly-pack-${selKey}.csv`; a.click();
    showToast('CSV downloaded');
  }

  function printPack() {
    const cmp = metrics.map(m => `<tr><td style="padding:8px 12px;font-weight:600">${m.label}</td><td style="padding:8px 12px;color:${m.color};font-weight:700">${m.money ? fmt$(m.thisV) : m.thisV}</td><td style="padding:8px 12px;color:#888">${m.money ? fmt$(m.lastV) : m.lastV}</td></tr>`).join('');
    const tbl = (title: string, color: string, headers: string[], rows: string[][]) => `
      <h2 style="font-family:Georgia,serif;font-size:15px;color:${color};border-left:4px solid ${color};padding-left:8px;margin:22px 0 8px">${title}</h2>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:${color}18">${headers.map(h => `<th style="text-align:left;padding:6px 10px;color:${color};font-size:10px;text-transform:uppercase;letter-spacing:.05em">${h}</th>`).join('')}</tr></thead>
        <tbody>${rows.length ? rows.map(r => `<tr style="border-bottom:1px solid #eee">${r.map(c => `<td style="padding:6px 10px;color:#333">${c ?? '—'}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${headers.length}" style="padding:12px;text-align:center;color:#999">None</td></tr>`}</tbody>
      </table>`;
    const html = `<!DOCTYPE html><html><head><title>Monthly Pack — ${selLabel}</title></head>
      <body style="font-family:Georgia,serif;margin:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact">
        <div style="background:linear-gradient(120deg,#1b2a3d,#26405c);padding:22px 32px;border-bottom:4px solid #c9a24a;color:#fff">
          <div style="font-size:22px;font-weight:700;letter-spacing:.15em">LITSON</div>
          <div style="font-size:11px;color:#c9a24a;letter-spacing:.1em">HR MONTHLY PACK · ${selLabel.toUpperCase()}</div>
        </div>
        <div style="padding:24px 32px">
          <h2 style="font-family:Georgia,serif;font-size:15px;color:#1b2a3d;margin:0 0 8px">Comparison — This Month vs Last Month</h2>
          <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:8px">
            <thead><tr style="background:#f1ece3"><th style="text-align:left;padding:6px 12px;font-size:10px;text-transform:uppercase">Category</th><th style="text-align:left;padding:6px 12px;font-size:10px;text-transform:uppercase">${monthLabel(thisY, thisM)}</th><th style="text-align:left;padding:6px 12px;font-size:10px;text-transform:uppercase">${monthLabel(last.getFullYear(), last.getMonth())}</th></tr></thead>
            <tbody>${cmp}</tbody>
          </table>
          ${tbl(`Cash Out — Total ${fmt$(cashoutTotal)}`, '#b0412f', ['Date', 'Payee', 'Category', 'Amount', 'Note'], cashoutRows.map((c: any) => [c.date, c.payee, c.category, fmt$(num(c.amount)), c.note]))}
          ${tbl('PTO', '#2f7d5b', ['Employee', 'Type', 'Start', 'End', 'Days', 'Status'], ptoRows.map((e: any) => [e.employee, e.type, e.start_date, e.end_date, String(e.days ?? ''), e.status]))}
          ${tbl('Trips', '#3f6b8a', ['Traveler', 'Details', 'Client', 'Cost', 'Status'], tripRows.map((t: any) => [t.who, t.detail, t.matter, fmt$(num(t.cost)), t.status]))}
          ${tbl('Contractor Payments', '#6b4f8a', ['Name', 'Date', 'Amount', 'Note'], contractorRows.map((c: any) => [cName(c), cDate(c), fmt$(num(c.amount)), cNote(c)]))}
          ${tbl('Performance Reviews', '#b07d2a', ['Employee', 'Role', 'Review', 'Date', 'Status'], reviewRowsSel.map(r => [r.name, r.role, r.type, r.date ?? '', r.status]))}
        </div>
        <script>window.onload=function(){window.print()}</script>
      </body></html>`;
    const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); }
  }

  const SectionTable = ({ title, color, headers, children, empty }: any) => (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2.5 h-6 rounded-full" style={{ background: color }} />
        <div className="text-sm font-bold uppercase tracking-wider" style={{ color }}>{title}</div>
      </div>
      <div className="bg-white border rounded-card overflow-hidden" style={{ borderColor: `${color}33`, borderTop: `3px solid ${color}` }}>
        <table className="w-full text-sm">
          <thead style={{ background: `${color}14` }}><tr>
            {headers.map((h: string) => <th key={h} className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider" style={{ color }}>{h}</th>)}
          </tr></thead>
          <tbody>{children}{empty}</tbody>
        </table>
      </div>
    </section>
  );

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex bg-[#f1ece3] rounded-ctrl p-0.5">
          {(['this', 'last'] as const).map(mo => (
            <button key={mo} onClick={() => setMode(mo)}
              className={clsx('text-sm font-semibold px-4 py-1.5 rounded-ctrl transition-colors', mode === mo ? 'bg-white text-ink shadow-sm' : 'text-text-muted hover:text-text-primary')}>
              {mo === 'this' ? monthLabel(thisY, thisM) : monthLabel(last.getFullYear(), last.getMonth())}
            </button>
          ))}
        </div>
        <span className="text-sm text-text-muted">Showing <span className="font-semibold text-text-primary">{selLabel}</span></span>
        <div className="ml-auto flex gap-2">
          <button onClick={printPack} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark">🖨 Print / Save PDF</button>
          <button onClick={downloadCsvPack} className="bg-white border border-border-light text-ink text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-canvas">↓ Download XLS/CSV</button>
        </div>
      </div>

      {/* Comparison band */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {metrics.map(m => {
          const delta = m.thisV - m.lastV;
          const cur = mode === 'this' ? m.thisV : m.lastV;
          const other = mode === 'this' ? m.lastV : m.thisV;
          const tilde = (m as any).approx ? '~' : '';
          return (
            <div key={m.label} className="bg-white border rounded-card px-4 py-3" style={{ borderTop: `3px solid ${m.color}` }}>
              <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{m.label}</div>
              <div className="font-spectral text-2xl font-semibold mt-1" style={{ color: m.color }}>{m.money ? tilde + fmt$(cur) : cur}</div>
              <div className="text-[11px] text-text-muted mt-0.5">
                {mode === 'this' ? 'Last mo' : 'This mo'}: {m.money ? tilde + fmt$(other) : other}
                {delta !== 0 && <span className={mode === 'this' ? (delta > 0 ? 'text-[#b0412f] ml-1' : 'text-[#2f7d5b] ml-1') : 'ml-1'}>
                  {mode === 'this' ? ` (${delta > 0 ? '+' : ''}${m.money ? fmt$(delta) : delta})` : ''}
                </span>}
              </div>
            </div>
          );
        })}
      </div>

      <SectionTable title={`Cash Out — Total ${fmt$(cashoutTotal)}`} color="#b0412f" headers={['Date', 'Payee', 'Category', 'Amount', 'Note']}
        empty={!cashoutRows.length && <tr><td colSpan={5} className="px-4 py-6 text-center text-text-muted">No cash-out entries in {selLabel}</td></tr>}>
        {cashoutRows.map((c: any) => (
          <tr key={c.id} className="border-t border-[#f1ece3]">
            <td className="px-4 py-3 text-text-muted whitespace-nowrap">{c.date}</td>
            <td className="px-4 py-3 font-medium">{c.payee}</td>
            <td className="px-4 py-3"><span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#fdeaea] text-[#b0412f]">{c.category}</span></td>
            <td className="px-4 py-3 font-semibold">{fmt$(num(c.amount))}</td>
            <td className="px-4 py-3 text-text-muted">{c.note ?? '—'}</td>
          </tr>
        ))}
      </SectionTable>

      <SectionTable title="Paid Time Off" color="#2f7d5b" headers={['Employee', 'Type', 'Start', 'End', 'Days', 'Status']}
        empty={!ptoRows.length && <tr><td colSpan={6} className="px-4 py-6 text-center text-text-muted">No PTO in {selLabel}</td></tr>}>
        {ptoRows.map((e: any) => (
          <tr key={e.id} className="border-t border-[#f1ece3]">
            <td className="px-4 py-3 font-medium">{e.employee}</td><td className="px-4 py-3 text-text-muted">{e.type}</td>
            <td className="px-4 py-3 text-text-muted">{e.start_date}</td><td className="px-4 py-3 text-text-muted">{e.end_date}</td>
            <td className="px-4 py-3 text-text-muted">{e.days}</td>
            <td className="px-4 py-3"><span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#eef5f1] text-[#2f7d5b]">{e.status}</span></td>
          </tr>
        ))}
      </SectionTable>

      <SectionTable title="Trips & Travel" color="#3f6b8a" headers={['Traveler', 'Details', 'Client', 'Cost', 'Status', 'Date']}
        empty={!tripRows.length && <tr><td colSpan={6} className="px-4 py-6 text-center text-text-muted">No trips in {selLabel}</td></tr>}>
        {tripRows.map((t: any) => (
          <tr key={t.id} className="border-t border-[#f1ece3]">
            <td className="px-4 py-3 font-medium">{t.who}</td><td className="px-4 py-3 text-text-secondary">{t.detail}</td>
            <td className="px-4 py-3 text-text-muted">{t.matter ?? '—'}</td><td className="px-4 py-3 text-text-muted">{t.cost != null ? fmt$(num(t.cost)) : '—'}</td>
            <td className="px-4 py-3"><span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#e9f0f5] text-[#3f6b8a]">{t.status}</span></td>
            <td className="px-4 py-3 text-text-muted">{tripMonthKey(t)}</td>
          </tr>
        ))}
      </SectionTable>

      <SectionTable title="Contractor Payments" color="#6b4f8a" headers={['Name', 'Date', 'Amount', 'Note']}
        empty={!contractorRows.length && <tr><td colSpan={4} className="px-4 py-6 text-center text-text-muted">No contractor payments in {selLabel}</td></tr>}>
        {contractorRows.map((c: any) => (
          <tr key={c.id} className="border-t border-[#f1ece3]">
            <td className="px-4 py-3 font-medium">{cName(c)}</td><td className="px-4 py-3 text-text-muted">{cDate(c)}</td>
            <td className="px-4 py-3 text-text-muted">{fmt$(num(c.amount))}</td><td className="px-4 py-3 text-text-muted">{cNote(c)}</td>
          </tr>
        ))}
      </SectionTable>

      <SectionTable title="Performance Reviews" color="#b07d2a" headers={['Employee', 'Role', 'Review', 'Date', 'Status']}
        empty={!reviewRowsSel.length && <tr><td colSpan={5} className="px-4 py-6 text-center text-text-muted">No reviews in {selLabel}</td></tr>}>
        {reviewRowsSel.map(r => (
          <tr key={r.id} className="border-t border-[#f1ece3]">
            <td className="px-4 py-3 font-medium">{r.name}</td><td className="px-4 py-3 text-text-muted">{r.role}</td>
            <td className="px-4 py-3 text-text-secondary">{r.type}</td><td className="px-4 py-3 text-text-muted">{r.date}</td>
            <td className="px-4 py-3"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${reviewStatusChip(r.status)}`}>{r.status}</span></td>
          </tr>
        ))}
      </SectionTable>

      <section>
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2.5 h-6 rounded-full bg-[#c9a24a]" />
          <div className="text-sm font-bold uppercase tracking-wider text-[#8a6d3b]">Birthdays</div>
        </div>
        <div className="flex flex-wrap gap-3">
          {birthdays.length ? birthdays.map((e: any) => (
            <div key={e.id} className="bg-white border border-border rounded-card px-4 py-3 text-sm">
              <div className="font-semibold text-text-primary">{e.name}</div>
              <div className="text-text-muted">{e.birthday}</div>
            </div>
          )) : <p className="text-sm text-text-muted">No birthdays in {selLabel}</p>}
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

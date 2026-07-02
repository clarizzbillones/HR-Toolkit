'use client';
import { useState, useEffect, useRef } from 'react';
import clsx from 'clsx';
import { useToast } from '@/components/Toast';

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

  useEffect(() => { fetch('/api/reports?tab=monthly').then(r => r.json()).then(d => setTrips(d.trips ?? [])); }, []);

  const filtered = trips.filter((t: any) => {
    const d = (t.created_at ?? '').slice(0, 10);
    if (from && d < from) return false;
    if (to && d > to) return false;
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
        <button onClick={exportCsv} className="ml-auto bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark">↓ Download trip pack (CSV)</button>
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

  useEffect(() => { fetch('/api/reports?tab=monthly').then(r => r.json()).then(d => setPto(d.pto ?? [])); }, []);

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

// ---- Review date helpers ----
function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr.slice(0, 10) + 'T12:00:00');
  d.setMonth(d.getMonth() + months);
  return d.toLocaleDateString('en-CA');
}
function reviewDate(e: any, kind: '6mo' | '1yr'): string | null {
  if (kind === '6mo') return e.review_6mo_date?.slice(0, 10) ?? (e.hire_date ? addMonths(e.hire_date, 6) : null);
  return e.review_1yr_date?.slice(0, 10) ?? (e.hire_date ? addMonths(e.hire_date, 12) : null);
}

// Flatten employees into individual review rows
function reviewRows(reviews: any[]) {
  const rows: { id: string; name: string; role: string; dept: string; type: string; date: string | null; status: string }[] = [];
  for (const e of reviews ?? []) {
    const d6 = reviewDate(e, '6mo');
    if (d6 || e.review_6mo_status) rows.push({ id: e.id + '-6', name: e.name, role: e.role, dept: e.dept, type: '6-month', date: d6, status: e.review_6mo_status ?? 'Not Started' });
    const d12 = reviewDate(e, '1yr');
    if (d12 || e.review_1yr_status) rows.push({ id: e.id + '-12', name: e.name, role: e.role, dept: e.dept, type: '1-year', date: d12, status: e.review_1yr_status ?? 'Not Started' });
  }
  return rows;
}

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

// ---- Monthly tab ----
function MonthlyTab({ data }: { data: any }) {
  if (!data) return <div className="py-8 text-center text-text-muted text-sm">Loading…</div>;
  const { pto, trips, contractors, overtime, employees, reviews } = data;

  const today = new Date();
  const birthdays = (employees ?? []).filter((e: any) => {
    if (!e.birthday) return false;
    const [, m, d] = e.birthday.split('-');
    const now = new Date();
    return parseInt(m) === now.getMonth() + 1;
  });

  // Reviews due this month
  const nowY = today.getFullYear(), nowM = today.getMonth();
  const reviewsThisMonth = reviewRows(reviews ?? []).filter(r => {
    if (!r.date || r.status === 'Complete') return false;
    const d = new Date(r.date + 'T12:00:00');
    return d.getFullYear() === nowY && d.getMonth() === nowM;
  }).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));

  return (
    <div className="space-y-6">
      <section>
        <div className="text-xs font-bold uppercase tracking-wider text-gold-muted mb-3">PTO This Month</div>
        <div className="bg-white border border-border rounded-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#f1ece3]"><tr>
              {['Employee','Type','Start','End','Days','Status'].map(h => <th key={h} className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-text-secondary">{h}</th>)}
            </tr></thead>
            <tbody>
              {(pto ?? []).slice(0, 20).map((e: any) => (
                <tr key={e.id} className="border-t border-[#f1ece3]">
                  <td className="px-4 py-3 font-medium">{e.employee}</td>
                  <td className="px-4 py-3 text-text-muted">{e.type}</td>
                  <td className="px-4 py-3 text-text-muted">{e.start_date}</td>
                  <td className="px-4 py-3 text-text-muted">{e.end_date}</td>
                  <td className="px-4 py-3 text-text-muted">{e.days}</td>
                  <td className="px-4 py-3"><span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#eef5f1] text-[#2f7d5b]">{e.status}</span></td>
                </tr>
              ))}
              {!(pto ?? []).length && <tr><td colSpan={6} className="px-4 py-6 text-center text-text-muted">No PTO entries</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="text-xs font-bold uppercase tracking-wider text-gold-muted mb-3">Performance Reviews This Month</div>
        <div className="bg-white border border-border rounded-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#f1ece3]"><tr>
              {['Employee','Role','Review','Date','Status'].map(h => <th key={h} className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-text-secondary">{h}</th>)}
            </tr></thead>
            <tbody>
              {reviewsThisMonth.map(r => (
                <tr key={r.id} className="border-t border-[#f1ece3]">
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3 text-text-muted">{r.role}</td>
                  <td className="px-4 py-3 text-text-secondary">{r.type}</td>
                  <td className="px-4 py-3 text-text-muted">{r.date}</td>
                  <td className="px-4 py-3"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${reviewStatusChip(r.status)}`}>{r.status}</span></td>
                </tr>
              ))}
              {!reviewsThisMonth.length && <tr><td colSpan={5} className="px-4 py-6 text-center text-text-muted">No reviews due this month</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="text-xs font-bold uppercase tracking-wider text-gold-muted mb-3">Birthdays This Month</div>
        <div className="flex flex-wrap gap-3">
          {birthdays.length ? birthdays.map((e: any) => (
            <div key={e.id} className="bg-white border border-border rounded-card px-4 py-3 text-sm">
              <div className="font-semibold text-text-primary">{e.name}</div>
              <div className="text-text-muted">{e.birthday}</div>
            </div>
          )) : <p className="text-sm text-text-muted">No birthdays this month</p>}
        </div>
      </section>

      <section>
        <div className="text-xs font-bold uppercase tracking-wider text-gold-muted mb-3">Contractor Payments Due</div>
        <div className="bg-white border border-border rounded-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#f1ece3]"><tr>
              {['Name','Due Date','Amount','Note'].map(h => <th key={h} className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-text-secondary">{h}</th>)}
            </tr></thead>
            <tbody>
              {(contractors ?? []).map((c: any) => (
                <tr key={c.id} className="border-t border-[#f1ece3]">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-text-muted">{c.due_date}</td>
                  <td className="px-4 py-3 text-text-muted">${Number(c.amount).toLocaleString()}</td>
                  <td className="px-4 py-3 text-text-muted">{c.note}</td>
                </tr>
              ))}
              {!(contractors ?? []).length && <tr><td colSpan={4} className="px-4 py-6 text-center text-text-muted">No contractor payments</td></tr>}
            </tbody>
          </table>
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
  const [form, setForm] = useState({ date: '', payee: '', category: 'Travel', amount: '', status: 'Pending' });
  const CATEGORIES = ['Travel','Office Supplies','Legal Fees','Software','Marketing','Other'];

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
    setForm({ date: '', payee: '', category: 'Travel', amount: '', status: 'Pending' });
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
          {([['Date','date'],['Payee','payee'],['Category','category'],['Amount ($)','amount'],['Status','status']] as [string, keyof typeof form][]).map(([l, k]) => (
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
            {['Date','Payee','Category','Amount','Status'].map(h => <th key={h} className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-text-secondary">{h}</th>)}
          </tr></thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.id} className="border-t border-[#f1ece3]">
                <td className="px-4 py-3 text-text-muted">{r.date}</td>
                <td className="px-4 py-3 font-medium">{r.payee}</td>
                <td className="px-4 py-3 text-text-muted">{r.category}</td>
                <td className="px-4 py-3">${Number(r.amount).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.status === 'Paid' ? 'bg-[#eef5f1] text-[#2f7d5b]' : 'bg-[#f7efe1] text-[#b07d2a]'}`}>{r.status}</span>
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5} className="px-4 py-6 text-center text-text-muted">No entries</td></tr>}
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
    if (tab === 'monthly') fetch('/api/reports?tab=monthly').then(r => r.json()).then(setMonthlyData);
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

'use client';
import { useState, useEffect, useRef } from 'react';
import clsx from 'clsx';
import { useToast } from '@/components/Toast';

type Tab = 'monthly' | 'insurance' | 'reimbursements' | 'cashout';

// ---- Monthly tab ----
function MonthlyTab({ data }: { data: any }) {
  if (!data) return <div className="py-8 text-center text-text-muted text-sm">Loading…</div>;
  const { pto, trips, contractors, overtime, employees } = data;

  const today = new Date();
  const birthdays = (employees ?? []).filter((e: any) => {
    if (!e.birthday) return false;
    const [, m, d] = e.birthday.split('-');
    const now = new Date();
    return parseInt(m) === now.getMonth() + 1;
  });

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
        {tab === 'insurance' && <InsuranceTab />}
        {tab === 'reimbursements' && <ReimbursementsTab />}
        {tab === 'cashout' && <CashOutTab />}
      </div>
    </div>
  );
}

'use client';
import { useState, useRef } from 'react';
import clsx from 'clsx';
import { useToast } from '@/components/Toast';

const CADENCES = ['Weekly', 'Bi-weekly', 'Semi-monthly', 'Monthly', 'Contractor'];

function money(n: number) { return `$${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

interface PayrollSummary {
  rows: { name: string; gross: number; taxes: number; benefits: number; guideline: number; reimbursements: number; net: number }[];
  totals: { gross: number; taxes: number; benefits: number; guideline: number; reimbursements: number; net: number };
}

// Parse an uploaded payroll register into per-employee + total figures.
async function parsePayroll(file: File): Promise<PayrollSummary | null> {
  const { read, utils } = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb = read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const json = utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
  if (!json.length) return null;
  const headers = Object.keys(json[0]);
  const num = (v: any) => { const n = Number(String(v).replace(/[$,\s]/g, '')); return isFinite(n) ? n : 0; };
  const cols = (re: RegExp) => headers.filter(h => re.test(h));
  const nameCol = headers.find(h => /name|employee/i.test(h)) ?? headers[0];
  const netCols = cols(/net\s*pay|net\b|take.?home/i);
  const grossCols = cols(/gross|total\s*(pay|earn)|earnings/i);
  const taxCols = cols(/tax|withhold|fica|medicare|social|fed\b|federal|state\b|suta|futa/i);
  const benefitCols = cols(/benefit|health|dental|vision|insurance|hsa|fsa/i);
  const guidelineCols = cols(/guideline|401|retire|roth|pension/i);
  const reimbCols = cols(/reimburse|expense/i);
  const sumCols = (r: Record<string, any>, cs: string[]) => cs.reduce((s, c) => s + num(r[c]), 0);

  const rows = json
    .filter(r => String(r[nameCol]).trim() && !/total/i.test(String(r[nameCol])))
    .map(r => ({
      name: String(r[nameCol]).trim(),
      gross: sumCols(r, grossCols),
      taxes: sumCols(r, taxCols),
      benefits: sumCols(r, benefitCols),
      guideline: sumCols(r, guidelineCols),
      reimbursements: sumCols(r, reimbCols),
      net: sumCols(r, netCols),
    }));
  const totals = rows.reduce((t, r) => ({
    gross: t.gross + r.gross, taxes: t.taxes + r.taxes, benefits: t.benefits + r.benefits,
    guideline: t.guideline + r.guideline, reimbursements: t.reimbursements + r.reimbursements, net: t.net + r.net,
  }), { gross: 0, taxes: 0, benefits: 0, guideline: 0, reimbursements: 0, net: 0 });
  return { rows, totals };
}

interface Period {
  id: string; period: string; run_date: string; cutoff: string;
  check_date?: string; status: string; report_name?: string; report_summary?: string;
}
interface Settings { id: string; cadence: string; reminder_toggles: string; }
interface Contractor {
  id: string; contractor: string; amount: string; pay_date: string;
  method: string; status: string; notes?: string;
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} className={`relative w-11 h-6 rounded-full transition-colors ${on ? 'bg-[#2f7d5b]' : 'bg-[#d8d1c4]'}`}>
      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${on ? 'left-6' : 'left-1'}`} />
    </button>
  );
}

function statusChip(s: string) {
  if (s === 'Processed' || s === 'Paid') return 'bg-[#eef5f1] text-[#2f7d5b]';
  if (s === 'Upcoming' || s === 'Pending') return 'bg-[#f7efe1] text-[#b07d2a]';
  return 'bg-[#f1ece3] text-[#8b8478]';
}

export default function PayrollClient({ initialPeriods, initialSettings }: { initialPeriods: Period[]; initialSettings: Settings }) {
  const { showToast } = useToast();
  const [tab, setTab] = useState<'schedule' | 'contractors'>('schedule');
  const [periods, setPeriods] = useState<Period[]>(initialPeriods);
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDates, setEditDates] = useState<{ run_date: string; check_date: string }>({ run_date: '', check_date: '' });
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [contractorsLoaded, setContractorsLoaded] = useState(false);
  const [showAddContractor, setShowAddContractor] = useState(false);
  const [newC, setNewC] = useState({ contractor: '', amount: '', pay_date: '', method: 'ACH', notes: '' });
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [summary, setSummary] = useState<PayrollSummary | null>(null);
  const [summaryPeriod, setSummaryPeriod] = useState('');

  async function changeCadence(cadence: string) {
    const res = await fetch('/api/payroll', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cadence }) });
    const data = await res.json();
    setSettings(data.settings);
    showToast(`Pay schedule set to ${cadence}`);
  }

  async function generateSchedule() {
    const cadence = settings?.cadence ?? 'Semi-monthly';
    if (!confirm(`Generate upcoming ${cadence} payroll periods? This replaces existing upcoming (unprocessed) periods.`)) return;
    const res = await fetch('/api/payroll/periods', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'generate', cadence }) });
    const { periods: p } = await res.json();
    setPeriods(p);
    showToast(`Generated ${p.length} upcoming periods`);
  }

  async function generateContractorSchedule() {
    if (!confirm('Generate the monthly contractor schedule? Amy Nelson & Kelley Hess on the 6th, general contractors at end of month, for the next 6 months.')) return;
    const res = await fetch('/api/payroll/contractors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'generate' }) });
    const { rows, created } = await res.json();
    setContractors(rows);
    setContractorsLoaded(true);
    showToast(`Added ${created} scheduled payments`);
  }

  const today = new Date();
  const nextPeriod = periods.find(p => p.status === 'Upcoming') ?? periods[0];
  const nextDate = nextPeriod?.run_date ? new Date(nextPeriod.run_date + 'T12:00:00') : null;
  const cutoffDate = nextPeriod?.cutoff ? new Date(nextPeriod.cutoff + 'T12:00:00') : null;
  const daysLeft = nextDate ? Math.ceil((nextDate.getTime() - today.getTime()) / 86400000) : null;
  const cutoffToday = cutoffDate ? cutoffDate.toDateString() === today.toDateString() : false;
  const toggles = JSON.parse(settings?.reminder_toggles ?? '{"cutoff":true,"payrun":true,"timesheet":false}');

  async function loadContractors() {
    if (contractorsLoaded) return;
    const res = await fetch('/api/payroll/contractors');
    const { rows } = await res.json();
    setContractors(rows);
    setContractorsLoaded(true);
  }

  function openTab(t: 'schedule' | 'contractors') {
    setTab(t);
    if (t === 'contractors') loadContractors();
  }

  async function saveToggles(patch: object) {
    setSaving(true);
    const res = await fetch('/api/payroll', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reminderToggles: patch }) });
    const data = await res.json();
    setSettings(data.settings);
    setSaving(false);
  }

  function startEdit(p: Period) {
    setEditingId(p.id);
    setEditDates({ run_date: p.run_date?.slice(0, 10) ?? '', check_date: p.check_date?.slice(0, 10) ?? '' });
  }

  async function saveDates(id: string) {
    const res = await fetch('/api/payroll/periods', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, run_date: editDates.run_date, check_date: editDates.check_date }),
    });
    const { period } = await res.json();
    setPeriods(prev => prev.map(p => p.id === id ? { ...p, ...period } : p));
    setEditingId(null);
    showToast('Dates updated');
  }

  async function uploadReport(id: string, file: File) {
    // Parse the register client-side for totals when it's a spreadsheet
    let parsed: PayrollSummary | null = null;
    if (/\.(xlsx|xls|csv)$/i.test(file.name)) {
      try { parsed = await parsePayroll(file); } catch { parsed = null; }
    }
    const fd = new FormData();
    fd.append('id', id);
    fd.append('file', file);
    if (parsed) fd.append('summary', JSON.stringify(parsed));
    const res = await fetch('/api/payroll/periods', { method: 'PUT', body: fd });
    const { period } = await res.json();
    setPeriods(prev => prev.map(p => p.id === id ? { ...p, report_name: period.report_name, report_summary: parsed ? JSON.stringify(parsed) : p.report_summary } : p));
    showToast(`Uploaded: ${file.name}`);
    if (parsed) { setSummary(parsed); setSummaryPeriod(periods.find(p => p.id === id)?.period ?? ''); }
    else if (!parsed && /\.(xlsx|xls|csv)$/i.test(file.name)) showToast('Uploaded, but could not read payroll totals from this file');
  }

  function viewSummary(p: Period) {
    if (!p.report_summary) return;
    try { setSummary(JSON.parse(p.report_summary)); setSummaryPeriod(p.period); } catch { showToast('Could not read stored totals'); }
  }

  async function addContractor() {
    if (!newC.contractor || !newC.amount || !newC.pay_date) return showToast('Fill in contractor, amount, and date');
    const res = await fetch('/api/payroll/contractors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newC) });
    const { row } = await res.json();
    setContractors(prev => [row, ...prev]);
    setNewC({ contractor: '', amount: '', pay_date: '', method: 'ACH', notes: '' });
    setShowAddContractor(false);
    showToast('Contractor payment added');
  }

  async function markContractorPaid(id: string) {
    const res = await fetch('/api/payroll/contractors', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: 'Paid' }) });
    const { row } = await res.json();
    setContractors(prev => prev.map(c => c.id === id ? row : c));
  }

  async function deleteContractor(id: string) {
    await fetch('/api/payroll/contractors', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    setContractors(prev => prev.filter(c => c.id !== id));
    showToast('Deleted');
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="flex items-center px-8 py-5 bg-white border-b border-border flex-shrink-0 gap-4 flex-wrap">
        <div>
          <h1 className="font-spectral text-[23px] font-semibold text-text-primary">Payroll</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-text-muted">Pay schedule:</span>
            <select value={settings?.cadence ?? 'Semi-monthly'} onChange={e => changeCadence(e.target.value)}
              className="text-sm font-semibold text-ink border border-border-light rounded-ctrl px-2 py-1 bg-white focus:outline-none focus:border-ink">
              {CADENCES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <span className="text-sm text-text-muted">· administered via ADP</span>
          </div>
        </div>
        <div className="flex gap-1 bg-[#f1ece3] p-1 rounded-ctrl ml-6">
          {(['schedule', 'contractors'] as const).map(t => (
            <button key={t} onClick={() => openTab(t)}
              className={clsx('px-4 py-1.5 rounded text-sm font-medium capitalize transition-colors', tab === t ? 'bg-white text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary')}>
              {t === 'schedule' ? 'Pay Schedule' : 'Contractor Payments'}
            </button>
          ))}
        </div>
        <button onClick={() => showToast('Reminder sent (connect Microsoft 365 to deliver)')}
          className="ml-auto bg-ink text-white text-sm font-semibold px-5 py-2.5 rounded-ctrl hover:bg-ink-dark transition-colors">
          Send reminder now
        </button>
      </header>

      {tab === 'schedule' && (
        <div className="flex-1 overflow-auto px-8 py-6">
          <div className="grid grid-cols-[320px_1fr] gap-6 mb-6">
            {/* Next payroll hero */}
            <div className="bg-ink rounded-card p-6 text-white">
              <div className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-3">NEXT PAYROLL RUN</div>
              {nextDate ? (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-spectral leading-tight">
                      <div className="text-2xl text-white/80">{nextDate.toLocaleDateString('en-US', { month: 'long' })}</div>
                      <div className="text-6xl font-semibold">{nextDate.getDate()},</div>
                      <div className="text-4xl font-semibold text-white/70">{nextDate.getFullYear()}</div>
                    </div>
                    <span className="text-xs font-semibold bg-white/15 px-2.5 py-1 rounded-full shrink-0">
                      {daysLeft === 0 ? 'Today' : daysLeft === 1 ? 'in 1 day' : daysLeft && daysLeft > 0 ? `in ${daysLeft} days` : 'Past'}
                    </span>
                  </div>
                  {cutoffDate && (
                    <div className={`mt-4 rounded-ctrl p-3 text-sm font-semibold ${cutoffToday ? 'bg-[#c9a24a]/20 border border-[#c9a24a]/30' : 'bg-white/10'}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-[#c9a24a]">⚑</span>
                        <div>
                          <div className={cutoffToday ? 'text-[#c9a24a]' : 'text-white/80'}>
                            Submission cutoff{cutoffToday ? ' today' : ''}, 5:00 PM
                          </div>
                          {!cutoffToday && <div className="text-xs text-white/40 font-normal">{cutoffDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : <div className="text-white/50">No upcoming periods</div>}
            </div>

            {/* Reminders */}
            <div className="bg-white border border-border rounded-card p-6">
              <div className="text-[10px] font-bold uppercase tracking-widest text-gold-muted mb-5">REMINDERS</div>
              <div className="space-y-5">
                {[
                  { key: 'cutoff', label: 'Payroll cutoff reminder', sub: '9:00 AM on cutoff day' },
                  { key: 'payrun', label: 'Pay run confirmation', sub: 'Morning of each run' },
                  { key: 'timesheet', label: 'Timesheet nudge', sub: '2 days before cutoff' },
                ].map(({ key, label, sub }) => (
                  <div key={key} className="flex items-center justify-between gap-4 py-3 border-b border-[#f1ece3] last:border-0 last:pb-0">
                    <div>
                      <div className="text-sm font-semibold text-text-primary">{label}</div>
                      <div className="text-xs text-text-muted mt-0.5">{sub}</div>
                    </div>
                    <Toggle on={Boolean(toggles[key])} onChange={v => saveToggles({ ...toggles, [key]: v })} />
                  </div>
                ))}
              </div>
              {saving && <p className="text-xs text-text-muted mt-3">Saving…</p>}
            </div>
          </div>

          {/* Pay periods table */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-gold-muted">PAY PERIODS</div>
              <button onClick={generateSchedule}
                className="text-xs font-semibold text-ink border border-border-light bg-white px-3 py-1.5 rounded-ctrl hover:bg-canvas">
                ↻ Generate {settings?.cadence ?? 'Semi-monthly'} schedule
              </button>
            </div>
            <div className="bg-white border border-border rounded-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#f1ece3] text-xs font-bold uppercase tracking-wider text-text-muted">
                    <th className="text-left px-5 py-3">Period</th>
                    <th className="text-left px-5 py-3">Cutoff</th>
                    <th className="text-left px-5 py-3">Run Date</th>
                    <th className="text-left px-5 py-3">Check Date</th>
                    <th className="text-left px-5 py-3">Status</th>
                    <th className="text-left px-5 py-3">Report</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {periods.map(p => {
                    const isEditing = editingId === p.id;
                    const runDate = new Date(p.run_date + 'T12:00:00');
                    const checkDate = p.check_date ? new Date(p.check_date + 'T12:00:00') : null;
                    return (
                      <tr key={p.id} className="border-b border-[#f1ece3] last:border-0 hover:bg-canvas">
                        <td className="px-5 py-3.5 font-medium text-text-primary">{p.period}</td>
                        <td className="px-5 py-3.5 text-text-muted">{new Date(p.cutoff + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                        <td className="px-5 py-3.5">
                          {isEditing ? (
                            <input type="date" value={editDates.run_date} onChange={e => setEditDates(d => ({ ...d, run_date: e.target.value }))}
                              className="border border-border-light rounded px-2 py-1 text-sm focus:outline-none focus:border-ink" />
                          ) : (
                            <span className="text-text-primary">{runDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          {isEditing ? (
                            <input type="date" value={editDates.check_date} onChange={e => setEditDates(d => ({ ...d, check_date: e.target.value }))}
                              className="border border-border-light rounded px-2 py-1 text-sm focus:outline-none focus:border-ink" />
                          ) : (
                            <span className="text-text-muted">{checkDate ? checkDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusChip(p.status)}`}>{p.status}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          {p.report_name ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-[#2f7d5b] font-medium">📄 {p.report_name}</span>
                              {p.report_summary && (
                                <button onClick={() => viewSummary(p)} className="text-xs font-semibold text-ink underline hover:text-ink-dark">View totals</button>
                              )}
                            </div>
                          ) : (
                            <>
                              <input type="file" accept=".pdf,.csv,.xlsx" className="hidden"
                                ref={el => { fileRefs.current[p.id] = el; }}
                                onChange={e => { const f = e.target.files?.[0]; if (f) uploadReport(p.id, f); }} />
                              <button onClick={() => fileRefs.current[p.id]?.click()}
                                className="text-xs text-text-muted hover:text-ink font-medium underline">Upload</button>
                            </>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {isEditing ? (
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => saveDates(p.id)} className="text-xs font-semibold text-[#2f7d5b] hover:underline">Save</button>
                              <button onClick={() => setEditingId(null)} className="text-xs text-text-muted hover:underline">Cancel</button>
                            </div>
                          ) : (
                            <button onClick={() => startEdit(p)} className="text-xs text-text-muted hover:text-ink font-medium">Edit dates</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'contractors' && (
        <div className="flex-1 overflow-auto px-8 py-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-gold-muted">CONTRACTOR PAYMENTS <span className="normal-case font-normal text-text-muted">· generally end of month · Amy Nelson &amp; Kelley Hess on the 6th</span></div>
            <div className="flex gap-2">
              <button onClick={generateContractorSchedule}
                className="bg-white border border-border-light text-ink text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-canvas transition-colors">
                ↻ Generate monthly schedule
              </button>
              <button onClick={() => setShowAddContractor(v => !v)}
                className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark transition-colors">
                + Add Payment
              </button>
            </div>
          </div>

          {showAddContractor && (
            <div className="bg-white border border-border rounded-card p-5 mb-5">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-xs font-bold text-text-muted uppercase tracking-wide block mb-1">Contractor Name</label>
                  <input value={newC.contractor} onChange={e => setNewC(c => ({ ...c, contractor: e.target.value }))}
                    placeholder="e.g. John Smith"
                    className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
                </div>
                <div>
                  <label className="text-xs font-bold text-text-muted uppercase tracking-wide block mb-1">Amount</label>
                  <input value={newC.amount} onChange={e => setNewC(c => ({ ...c, amount: e.target.value }))}
                    placeholder="e.g. $1,500.00"
                    className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
                </div>
                <div>
                  <label className="text-xs font-bold text-text-muted uppercase tracking-wide block mb-1">Payment Date</label>
                  <input type="date" value={newC.pay_date} onChange={e => setNewC(c => ({ ...c, pay_date: e.target.value }))}
                    className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink bg-white" />
                </div>
                <div>
                  <label className="text-xs font-bold text-text-muted uppercase tracking-wide block mb-1">Method</label>
                  <select value={newC.method} onChange={e => setNewC(c => ({ ...c, method: e.target.value }))}
                    className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink bg-white">
                    {['ACH', 'Check', 'Wire', 'Zelle', 'Other'].map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div className="mb-4">
                <label className="text-xs font-bold text-text-muted uppercase tracking-wide block mb-1">Notes (optional)</label>
                <input value={newC.notes} onChange={e => setNewC(c => ({ ...c, notes: e.target.value }))}
                  placeholder="e.g. Invoice #1042"
                  className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
              </div>
              <div className="flex gap-2">
                <button onClick={addContractor} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl">Add</button>
                <button onClick={() => setShowAddContractor(false)} className="text-sm text-text-muted px-4 py-2">Cancel</button>
              </div>
            </div>
          )}

          <div className="bg-white border border-border rounded-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#f1ece3] text-xs font-bold uppercase tracking-wider text-text-muted">
                  <th className="text-left px-5 py-3">Contractor</th>
                  <th className="text-left px-5 py-3">Amount</th>
                  <th className="text-left px-5 py-3">Payment Date</th>
                  <th className="text-left px-5 py-3">Method</th>
                  <th className="text-left px-5 py-3">Status</th>
                  <th className="text-left px-5 py-3">Notes</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {contractors.length === 0 && (
                  <tr><td colSpan={7} className="px-5 py-8 text-center text-text-muted text-sm">No contractor payments yet</td></tr>
                )}
                {contractors.map(c => (
                  <tr key={c.id} className="border-b border-[#f1ece3] last:border-0 hover:bg-canvas">
                    <td className="px-5 py-3.5 font-semibold text-text-primary">{c.contractor}</td>
                    <td className="px-5 py-3.5 text-text-primary">{c.amount}</td>
                    <td className="px-5 py-3.5 text-text-muted">{new Date(c.pay_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                    <td className="px-5 py-3.5 text-text-muted">{c.method}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusChip(c.status)}`}>{c.status}</span>
                    </td>
                    <td className="px-5 py-3.5 text-text-muted text-xs">{c.notes ?? '—'}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex gap-3 justify-end">
                        {c.status !== 'Paid' && (
                          <button onClick={() => markContractorPaid(c.id)} className="text-xs text-[#2f7d5b] font-semibold hover:underline">Mark paid</button>
                        )}
                        <button onClick={() => deleteContractor(c.id)} className="text-xs text-[#b0412f] hover:underline">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payroll totals modal */}
      {summary && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6" onClick={() => setSummary(null)}>
          <div className="bg-white rounded-card w-full max-w-3xl max-h-[88vh] flex flex-col shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="font-spectral text-[18px] font-semibold text-text-primary">Payroll Totals{summaryPeriod ? ` · ${summaryPeriod}` : ''}</h2>
                <p className="text-xs text-text-muted">{summary.rows.length} employees parsed from the uploaded register</p>
              </div>
              <button onClick={() => setSummary(null)} className="text-text-muted hover:text-text-primary text-xl leading-none">×</button>
            </div>

            <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-6 gap-2 border-b border-border">
              {([['Gross','gross'],['Taxes','taxes'],['Benefits','benefits'],['Guideline/401k','guideline'],['Reimb.','reimbursements'],['Net Pay','net']] as const).map(([label, key]) => (
                <div key={key} className="bg-canvas border border-border rounded-ctrl px-3 py-2">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-text-muted">{label}</div>
                  <div className={`text-sm font-semibold mt-0.5 ${key === 'net' ? 'text-[#2f7d5b]' : 'text-text-primary'}`}>{money(summary.totals[key])}</div>
                </div>
              ))}
            </div>

            <div className="overflow-auto flex-1">
              <table className="w-full text-sm">
                <thead className="bg-[#f1ece3] sticky top-0"><tr>
                  {['Employee','Gross','Taxes','Benefits','Guideline/401k','Reimb.','Net Pay'].map(h => <th key={h} className="text-left px-4 py-2 text-xs font-bold uppercase tracking-wider text-text-secondary">{h}</th>)}
                </tr></thead>
                <tbody>
                  {summary.rows.map((r, i) => (
                    <tr key={i} className="border-t border-[#f1ece3]">
                      <td className="px-4 py-2 font-medium text-text-primary">{r.name}</td>
                      <td className="px-4 py-2 text-text-muted">{money(r.gross)}</td>
                      <td className="px-4 py-2 text-text-muted">{money(r.taxes)}</td>
                      <td className="px-4 py-2 text-text-muted">{money(r.benefits)}</td>
                      <td className="px-4 py-2 text-text-muted">{money(r.guideline)}</td>
                      <td className="px-4 py-2 text-text-muted">{money(r.reimbursements)}</td>
                      <td className="px-4 py-2 font-semibold text-[#2f7d5b]">{money(r.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

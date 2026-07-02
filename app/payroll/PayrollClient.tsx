'use client';
import { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';
import { useToast } from '@/components/Toast';
import { useUndo } from '@/components/UndoProvider';

function money(n: number) { return `$${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
// Format a stored amount (text like "1,706.66" or "$200") as USD
function usd(v: any) {
  if (v == null || v === '' || v === 'TBD') return v || '—';
  const n = Number(String(v).replace(/[$,\s]/g, ''));
  return isFinite(n) ? money(n) : String(v);
}

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
  check_date?: string; status: string; report_name?: string; report_summary?: string; schedule?: string;
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

// Payroll type badge colors for the unified deadline view
const TYPE_STYLE: Record<string, string> = {
  'Weekly': 'bg-[#e9f0f5] text-[#3f6b8a]',
  'Semimonthly': 'bg-[#eef5f1] text-[#2f7d5b]',
  'Monthly (Owners)': 'bg-[#f0ece4] text-[#8a6d3b]',
  'Monthly': 'bg-[#f0ece4] text-[#8a6d3b]',
  '6th of Month': 'bg-[#eaf3ee] text-[#2f7d5b]',
  '6th Contractor': 'bg-[#f3ecf7] text-[#6b4f8a]',
  'Monthly Contractor': 'bg-[#fdeaea] text-[#b0412f]',
};
const TYPE_ORDER = ['Weekly', 'Semimonthly', 'Monthly (Owners)', 'Monthly', '6th of Month', '6th Contractor', 'Monthly Contractor'];

interface DeadlineRow {
  key: string; kind: 'period' | 'contractor'; type: string;
  coverage: string; deadline: string; payDate: string; status: string;
  period?: Period; contractor?: Contractor;
}

function iso(d: Date) { return d.toLocaleDateString('en-CA'); }

export default function PayrollClient({ initialPeriods, initialSettings }: { initialPeriods: Period[]; initialSettings: Settings }) {
  const { showToast } = useToast();
  const { pushUndo } = useUndo();
  const [tab, setTab] = useState<'schedule' | 'contractors'>('schedule');
  const [periods, setPeriods] = useState<Period[]>(initialPeriods);
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDates, setEditDates] = useState<{ cutoff: string; check_date: string }>({ cutoff: '', check_date: '' });
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [contractorsLoaded, setContractorsLoaded] = useState(false);
  const [showAddContractor, setShowAddContractor] = useState(false);
  const [newC, setNewC] = useState({ contractor: '', amount: '', pay_date: '', method: 'ACH', notes: '' });
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [summary, setSummary] = useState<PayrollSummary | null>(null);
  const [summaryPeriod, setSummaryPeriod] = useState('');
  const [filterType, setFilterType] = useState('All');

  // Load contractors upfront so the unified deadline view includes them
  useEffect(() => {
    fetch('/api/payroll/contractors').then(r => r.json()).then(d => { setContractors(d.rows ?? []); setContractorsLoaded(true); }).catch(() => {});
  }, []);

  async function generateAll() {
    if (!confirm('Generate all upcoming payroll deadlines (weekly, semi-monthly, monthly) and the contractor schedule? Replaces existing upcoming periods.')) return;
    const res = await fetch('/api/payroll/periods', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'generate' }) });
    const { periods: p } = await res.json();
    setPeriods(p);
    // Contractor schedule too
    const cr = await fetch('/api/payroll/contractors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'generate' }) });
    const cd = await cr.json();
    if (cd.rows) setContractors(cd.rows);
    showToast(`Generated ${p.length} payroll periods + contractor schedule`);
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
    setEditDates({ cutoff: p.cutoff?.slice(0, 10) ?? '', check_date: p.check_date?.slice(0, 10) ?? '' });
  }

  async function saveDates(id: string) {
    const res = await fetch('/api/payroll/periods', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, cutoff: editDates.cutoff, check_date: editDates.check_date }),
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

  async function deletePeriod(p: Period) {
    await fetch('/api/payroll/periods', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id }) });
    setPeriods(prev => prev.filter(x => x.id !== p.id));
    pushUndo({ label: `Delete payroll ${p.period}`, req: { url: '/api/payroll/periods', method: 'POST', body: { action: 'restore', period: p } } });
    showToast('Deadline deleted — Ctrl+Z to undo');
  }

  async function addContractor() {
    if (!newC.contractor || !newC.amount || !newC.pay_date) return showToast('Fill in contractor, amount, and date');
    const res = await fetch('/api/payroll/contractors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newC) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.row) { showToast(data.error ? `Could not add: ${data.error}` : 'Could not add payment'); return; }
    setContractors(prev => [data.row, ...prev]);
    pushUndo({ label: `Add contractor ${data.row.contractor}`, req: { url: '/api/payroll/contractors', method: 'DELETE', body: { id: data.row.id } } });
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

  // ---- Unified payroll deadlines (regular periods + contractor runs) ----
  const deadlineRows: DeadlineRow[] = [
    ...periods.map(p => ({
      key: p.id, kind: 'period' as const,
      type: p.schedule || (settings?.cadence === 'Semi-monthly' ? 'Semimonthly' : settings?.cadence) || 'Semimonthly',
      coverage: p.period, deadline: (p.cutoff ?? '').slice(0, 10),
      payDate: (p.check_date ?? p.run_date ?? '').slice(0, 10), status: p.status, period: p,
    })),
    ...contractors.map(c => {
      const pay = new Date((c.pay_date ?? '').slice(0, 10) + 'T12:00:00');
      const isSixth = pay.getDate() === 6;
      const deadline = iso(new Date(pay.getFullYear(), pay.getMonth(), isSixth ? 2 : 1));
      const coverage = c.notes?.replace(/ · run by.*/, '') || `${c.contractor}`;
      return {
        key: c.id, kind: 'contractor' as const,
        type: isSixth ? '6th Contractor' : 'Monthly Contractor',
        coverage, deadline, payDate: (c.pay_date ?? '').slice(0, 10), status: c.status, contractor: c,
      };
    }),
  ];
  const typeCounts = TYPE_ORDER.map(t => [t, deadlineRows.filter(r => r.type === t).length] as const).filter(([, n]) => n > 0);
  const visibleRows = deadlineRows
    .filter(r => filterType === 'All' || r.type === filterType)
    .sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'));
  const todayIso = iso(new Date());

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="flex items-center px-8 py-5 bg-white border-b border-border flex-shrink-0 gap-4 flex-wrap">
        <div>
          <h1 className="font-spectral text-[23px] font-semibold text-text-primary">Payroll</h1>
          <p className="text-sm text-text-muted mt-0.5">Upcoming deadlines across all pay types · administered via ADP</p>
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
          {/* Compact next-run banner + reminders */}
          <div className="flex flex-wrap items-center gap-4 mb-5">
            {nextDate && (
              <div className="flex items-center gap-3 bg-ink text-white rounded-card px-4 py-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Next run</span>
                <span className="font-spectral text-lg font-semibold">{nextDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                <span className="text-xs font-semibold bg-white/15 px-2 py-0.5 rounded-full">
                  {daysLeft === 0 ? 'Today' : daysLeft === 1 ? 'in 1 day' : daysLeft && daysLeft > 0 ? `in ${daysLeft} days` : 'Past'}
                </span>
                {cutoffDate && <span className="text-xs text-white/50">· cutoff {cutoffDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, 5:00 PM</span>}
              </div>
            )}
            <div className="flex items-center gap-4 ml-auto">
              {[
                { key: 'cutoff', label: 'Cutoff reminder' },
                { key: 'payrun', label: 'Pay run confirmation' },
                { key: 'timesheet', label: 'Timesheet nudge' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center gap-2">
                  <Toggle on={Boolean(toggles[key])} onChange={v => saveToggles({ ...toggles, [key]: v })} />
                  <span className="text-xs text-text-secondary">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Type filter */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gold-muted mr-1">Payroll Deadlines</span>
            <button onClick={() => setFilterType('All')}
              className={clsx('text-xs font-semibold px-3 py-1.5 rounded-ctrl border transition-colors', filterType === 'All' ? 'bg-ink text-white border-ink' : 'bg-white text-text-secondary border-border-light hover:bg-canvas')}>
              All <span className="opacity-60">{deadlineRows.length}</span>
            </button>
            {typeCounts.map(([t, n]) => (
              <button key={t} onClick={() => setFilterType(t)}
                className={clsx('text-xs font-semibold px-3 py-1.5 rounded-ctrl border transition-colors', filterType === t ? 'border-transparent ' + TYPE_STYLE[t] : 'bg-white text-text-secondary border-border-light hover:bg-canvas')}>
                {t} <span className="opacity-60">{n}</span>
              </button>
            ))}
            <button onClick={generateAll}
              className="ml-auto text-xs font-semibold text-ink border border-border-light bg-white px-3 py-1.5 rounded-ctrl hover:bg-canvas">
              ↻ Generate all deadlines
            </button>
          </div>

          <div className="bg-white border border-border rounded-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#f1ece3] text-xs font-bold uppercase tracking-wider text-text-muted">
                  <th className="text-left px-5 py-3">Payroll Type</th>
                  <th className="text-left px-5 py-3">Coverage / Period</th>
                  <th className="text-left px-5 py-3">Deadline to Run</th>
                  <th className="text-left px-5 py-3">Pay / Check Date</th>
                  <th className="text-left px-5 py-3">Status</th>
                  <th className="text-left px-5 py-3">Report</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {visibleRows.map(r => {
                  const p = r.period;
                  const isEditing = p && editingId === p.id;
                  const overdue = r.status !== 'Processed' && r.status !== 'Paid' && r.deadline && r.deadline < todayIso;
                  const fmt = (d: string) => d ? new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
                  return (
                    <tr key={r.key} className="border-b border-[#f1ece3] last:border-0 hover:bg-canvas">
                      <td className="px-5 py-3.5">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${TYPE_STYLE[r.type] ?? 'bg-[#f1ece3] text-text-muted'}`}>{r.type}</span>
                      </td>
                      <td className="px-5 py-3.5 font-medium text-text-primary">
                        {r.coverage}
                        {r.kind === 'contractor' && <span className="text-text-muted font-normal"> · {r.contractor?.contractor}</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        {isEditing ? (
                          <input type="date" value={editDates.cutoff} onChange={e => setEditDates(d => ({ ...d, cutoff: e.target.value }))}
                            className="border border-border-light rounded px-2 py-1 text-sm focus:outline-none focus:border-ink" />
                        ) : (
                          <span className={overdue ? 'text-[#b0412f] font-bold' : 'text-[#b0412f] font-medium'}>{fmt(r.deadline)}{overdue ? ' ⚠' : ''}</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {isEditing ? (
                          <input type="date" value={editDates.check_date} onChange={e => setEditDates(d => ({ ...d, check_date: e.target.value }))}
                            className="border border-border-light rounded px-2 py-1 text-sm focus:outline-none focus:border-ink" />
                        ) : (
                          <span className="text-text-primary">{fmt(r.payDate)}</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusChip(r.status)}`}>{r.status}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        {r.kind !== 'period' ? <span className="text-text-faint text-xs">—</span> : p!.report_name ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-[#2f7d5b] font-medium">📄 {p!.report_name}</span>
                            {p!.report_summary && <button onClick={() => viewSummary(p!)} className="text-xs font-semibold text-ink underline hover:text-ink-dark">View totals</button>}
                          </div>
                        ) : (
                          <>
                            <input type="file" accept=".pdf,.csv,.xlsx" className="hidden"
                              ref={el => { fileRefs.current[p!.id] = el; }}
                              onChange={e => { const f = e.target.files?.[0]; if (f) uploadReport(p!.id, f); }} />
                            <button onClick={() => fileRefs.current[p!.id]?.click()} className="text-xs text-text-muted hover:text-ink font-medium underline">Upload</button>
                          </>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        {r.kind === 'period' ? (
                          isEditing ? (
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => saveDates(p!.id)} className="text-xs font-semibold text-[#2f7d5b] hover:underline">Save</button>
                              <button onClick={() => setEditingId(null)} className="text-xs text-text-muted hover:underline">Cancel</button>
                            </div>
                          ) : (
                            <div className="flex gap-3 justify-end">
                              <button onClick={() => startEdit(p!)} className="text-xs text-text-muted hover:text-ink font-medium">Edit dates</button>
                              <button onClick={() => deletePeriod(p!)} className="text-xs text-[#b0412f] hover:underline font-medium">Delete</button>
                            </div>
                          )
                        ) : (
                          <div className="flex gap-2 justify-end">
                            {r.status !== 'Paid' && <button onClick={() => markContractorPaid(r.contractor!.id)} className="text-xs font-semibold text-[#2f7d5b] hover:underline">Mark paid</button>}
                            <button onClick={() => deleteContractor(r.contractor!.id)} className="text-xs text-[#b0412f] hover:underline">Delete</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!visibleRows.length && (
                  <tr><td colSpan={7} className="px-5 py-10 text-center text-text-muted">
                    No deadlines yet — click “Generate all deadlines”.
                  </td></tr>
                )}
              </tbody>
            </table>
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
                    <td className="px-5 py-3.5 text-text-primary font-medium">{usd(c.amount)}</td>
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

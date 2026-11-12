'use client';
import { useCallback, useEffect, useState } from 'react';
import { usd, RETIREMENT_PLANS, US_STATES, DEFAULT_STATE, stateName, LEDGER_LINES, type CostBreakdown, type CostInputs, type CostSettings, type Ledger, type LedgerColumn, type LineKey } from '@/lib/actualCost';

// Actual (fully loaded) cost UI. Data comes from /api/staffing/cost, which only answers for the
// cost viewers (Clarizz and Catie); for anyone else `allowed` stays false and nothing renders.
// Nothing is estimated: every amount is typed in from ADP.

export type CostInputValues = { retirement_plan: string; work_state: string; ledger: Ledger };
const valuesFrom = (i: CostInputs): CostInputValues => ({ retirement_plan: i.retirementPlan ?? '', work_state: i.workState ?? '', ledger: JSON.parse(JSON.stringify(i.ledger ?? {})) });

export interface CostRow { id: string; name: string; worker_type: string | null; position: string | null; offboarded: boolean; inputs: CostInputs; cost: CostBreakdown }

export function useActualCost(name?: string) {
  const [allowed, setAllowed] = useState(false);
  const [settings, setSettings] = useState<CostSettings | null>(null);
  const [rows, setRows] = useState<CostRow[]>([]);
  const load = useCallback(async () => {
    const res = await fetch('/api/staffing/cost' + (name ? `?name=${encodeURIComponent(name)}` : '')).catch(() => null);
    if (!res || !res.ok) { setAllowed(false); return; }
    const d = await res.json();
    setAllowed(true); setSettings(d.settings); setRows(d.rows);
  }, [name]);
  useEffect(() => { load(); }, [load]);

  async function saveInputs(staffId: string, v: CostInputValues) {
    const res = await fetch('/api/staffing/cost', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ staff_id: staffId, ...v }) });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || 'Could not save');
    setRows(rs => rs.map(r => (r.id === staffId ? d.row : r)));
    return d.row as CostRow;
  }
  async function saveSettings(v: { year: string }) {
    const res = await fetch('/api/staffing/cost', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(v) });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || 'Could not save');
    setSettings(d.settings);
    setRows(rs => d.rows.filter((r: CostRow) => rs.some(x => x.id === r.id)));
  }
  return { allowed, settings, rows, reload: load, saveInputs, saveSettings };
}

const field = 'w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink tabular-nums';
const money2 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const th = 'text-right font-semibold px-3 py-2 whitespace-nowrap';
const td = 'px-3 py-1 text-right tabular-nums text-text-primary whitespace-nowrap';

// A table amount: click and type. Enter or clicking away saves, Esc cancels, blank clears it.
// `fallback` is shown greyed when nothing is typed (the year total falls back to year to date).
function EditCell({ value, fallback, onCommit }: { value: number | null | undefined; fallback?: number | null; onCommit: (n: number | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const done = (save: boolean) => {
    setEditing(false);
    if (!save) return;
    const t = text.replace(/[$,\s]/g, '');
    const n = t === '' ? null : Number(t);
    if (n != null && (!Number.isFinite(n) || n < 0)) return;
    if ((n ?? null) !== (value ?? null)) onCommit(n == null ? null : Math.round(n * 100) / 100);
  };
  return (
    <td className={td}>
      {editing
        ? <input autoFocus inputMode="decimal" value={text} onChange={e => setText(e.target.value)} onFocus={e => e.target.select()}
            onBlur={() => done(true)} onKeyDown={e => { if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); }}
            className="w-24 text-right tabular-nums border border-ink rounded-ctrl px-1.5 py-1 text-sm focus:outline-none" />
        : <button title={value == null && fallback != null ? 'Showing year to date. Click to enter the year total.' : 'Click to edit'}
            onClick={() => { setText(value != null ? value.toFixed(2) : ''); setEditing(true); }}
            className={`tabular-nums rounded px-1.5 py-1 -mr-1.5 border border-transparent hover:border-border-light hover:bg-canvas min-w-[4rem] ${value == null ? 'text-text-muted' : ''}`}>
            {value != null ? money2(value) : fallback != null ? money2(fallback) : '—'}</button>}
    </td>
  );
}

const COLS: { key: LedgerColumn; label: (y: number, checks?: number | null) => string }[] = [
  { key: 'check', label: () => 'Per paycheck' },
  { key: 'ytd', label: (_, n) => (n ? `YTD · ${n} checks` : 'YTD') },
  { key: 'total', label: y => `${y} total` },
];

export function ActualCostDetail({ row, settings, onSave }: { row: CostRow; settings: CostSettings; onSave: (v: CostInputValues) => Promise<unknown> }) {
  const c = row.cost;
  const [v, setV] = useState<CostInputValues>(valuesFrom(row.inputs));
  const [msg, setMsg] = useState('');
  useEffect(() => { setV(valuesFrom(row.inputs)); }, [row.id, JSON.stringify(row.inputs)]);
  async function commit(next: CostInputValues) {
    setV(next); setMsg('Saving…');
    try { await onSave(next); setMsg('Saved'); } catch (e: any) { setMsg(e.message); setV(valuesFrom(row.inputs)); }
  }
  const setAmount = (col: LedgerColumn, k: LineKey) => (n: number | null) => {
    const l: Ledger = JSON.parse(JSON.stringify(v.ledger));
    const part = { ...(l[col] ?? {}) };
    if (n == null) delete part[k]; else part[k] = n;
    l[col] = part;
    commit({ ...v, ledger: l });
  };
  const L = v.ledger;
  const matchLabel = v.retirement_plan === 'roth' ? 'Roth 401(k) company match' : v.retirement_plan === 'both' ? '401(k) + Roth company match' : '401(k) company match';
  const employerLines = LEDGER_LINES.filter(x => x.group === 'employer' && (!c.contractor || x.key === 'other'));
  const sum = (col: LedgerColumn, keys: readonly { key: LineKey }[]) => keys.reduce((t, x) => t + (L[col]?.[x.key] ?? 0), 0);
  const yearSum = (keys: readonly { key: LineKey }[]) => keys.reduce((t, x) => t + (L.total?.[x.key] ?? L.ytd?.[x.key] ?? 0), 0);
  const section = (title: string, keys: readonly (typeof LEDGER_LINES[number])[], subtotal: string) => (
    <>
      <tr><td colSpan={4} className="bg-canvas px-3 py-1.5 text-center text-xs font-bold uppercase tracking-wider text-text-secondary border-y border-border-light">{title}</td></tr>
      {keys.map(x => (
        <tr key={x.key} className="border-b border-[#f1ece3]">
          <td className="px-3 py-2"><span className="text-text-primary">{x.key === 'match' ? matchLabel : x.key === 'suta' ? `${stateName(v.work_state)} unemployment` : x.label}</span>{x.code && <span className="ml-2 text-[11px] text-text-muted uppercase tracking-wide">{x.key === 'suta' ? `${v.work_state || DEFAULT_STATE} SUI-ER` : x.code}</span>}</td>
          {COLS.map(col => <EditCell key={col.key} value={L[col.key]?.[x.key]} fallback={col.key === 'total' ? L.ytd?.[x.key] : undefined} onCommit={setAmount(col.key, x.key)} />)}
        </tr>
      ))}
      <tr><td className="px-3 py-2.5 font-bold text-text-primary">{subtotal}</td>
        {COLS.map(col => <td key={col.key} className={`${td} !py-2.5 font-bold ${col.key === 'total' ? 'border-t-2 border-text-primary' : ''}`}>{money2(col.key === 'total' ? yearSum(keys) : sum(col.key, keys))}</td>)}</tr>
    </>
  );
  return (
    <div className="grid gap-5 md:grid-cols-[1fr_230px]">
      <div className="text-sm min-w-0">
        <div className="border border-border-light rounded-card overflow-x-auto">
          <table className="w-full">
            <thead><tr className="text-xs text-text-muted"><th className="text-left font-semibold px-3 py-2">Liability</th>
              {COLS.map(col => <th key={col.key} className={th}>{col.label(settings.year, L.checks)}</th>)}</tr></thead>
            <tbody>
              {section('Employer', employerLines, 'Employer cost')}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-text-muted mt-1.5">Click any amount to type it in. Until a {settings.year} total is entered, the total column uses year to date (greyed).</p>
        <div className="mt-4 space-y-0.5">
          <div className="flex justify-between py-1.5"><span className="text-text-secondary">Employer cost</span><span className="tabular-nums">{usd(yearSum(employerLines))}</span></div>
          <div className="flex justify-between border-t border-border-light mt-1 pt-2.5"><span className="font-bold text-text-primary">Actual cost for {settings.year}</span>
            <span className="tabular-nums font-bold text-base">{usd(yearSum(employerLines))}</span></div>
        </div>
      </div>
      <div className="bg-canvas rounded-card p-4 space-y-3 text-sm self-start">
        <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Details</p>
        {c.staffingSalary && <p className="text-xs text-text-muted">Salary in Staffing: <span className="text-text-primary font-semibold">{c.staffingSalary}</span></p>}
        {!c.contractor && <label className="block"><span className="text-xs font-semibold text-text-secondary">Unemployment state</span>
          <select className={field} value={v.work_state || DEFAULT_STATE} onChange={e => commit({ ...v, work_state: e.target.value === DEFAULT_STATE ? '' : e.target.value })}>
            {US_STATES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select></label>}
        {!c.contractor && <label className="block"><span className="text-xs font-semibold text-text-secondary">Retirement plan</span>
          <select className={field} value={v.retirement_plan} onChange={e => commit({ ...v, retirement_plan: e.target.value })}>
            <option value="">Not set</option>{RETIREMENT_PLANS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select></label>}
        <label className="block"><span className="text-xs font-semibold text-text-secondary">Paychecks in YTD</span>
          <input className={field} inputMode="numeric" defaultValue={L.checks ?? ''} key={String(L.checks ?? '')}
            onBlur={e => { const t = e.target.value.trim(); const n = t === '' ? null : Math.round(Number(t)); if (n !== (L.checks ?? null) && (n == null || n >= 0)) commit({ ...v, ledger: { ...L, checks: n } }); }} placeholder="e.g. 20" /></label>
        {msg && <p className="text-xs text-text-muted">{msg}</p>}
      </div>
    </div>
  );
}

// The year shown on the actual cost column.
export function CostSettingsForm({ settings, onSave, onDone }: { settings: CostSettings; onSave: (v: { year: string }) => Promise<void>; onDone: () => void }) {
  const [year, setYear] = useState(String(settings.year));
  const [busy, setBusy] = useState(false), [err, setErr] = useState('');
  return (
    <div className="space-y-4">
      <label className="block max-w-[200px]"><span className="text-xs font-semibold text-text-secondary">Year</span>
        <input className={field} inputMode="numeric" value={year} onChange={e => setYear(e.target.value)} /></label>
      {err && <p className="text-sm text-litred-alt">{err}</p>}
      <div className="flex gap-2 justify-end">
        <button onClick={onDone} className="text-sm font-semibold px-4 py-2 rounded-ctrl border border-border-light">Cancel</button>
        <button disabled={busy} onClick={async () => { setBusy(true); setErr(''); try { await onSave({ year }); onDone(); } catch (e: any) { setErr(e.message); } finally { setBusy(false); } }}
          className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button>
      </div>
    </div>
  );
}

export function CostModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-card shadow-xl w-full max-w-5xl mt-10 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <h2 className="font-spectral text-xl font-semibold text-text-primary">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-text-muted hover:text-ink text-xl leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Employee File card: one person's actual cost.
export function ActualCostCard({ name }: { name: string }) {
  const { allowed, settings, rows, saveInputs } = useActualCost(name);
  if (!allowed || !settings) return null;
  const row = rows.find(r => !r.offboarded) ?? rows[0];
  return (
    <div>
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h2 className="text-xs font-bold uppercase tracking-widest text-gold-muted">Actual cost · {settings.year}</h2>
        <span className="text-[11px] text-text-muted">Employer taxes, 401(k) match and benefits. Visible only to Clarizz and Catie.</span>
      </div>
      {row
        ? <div className="bg-white border border-border-light rounded-card p-5"><ActualCostDetail row={row} settings={settings} onSave={v => saveInputs(row.id, v)} /></div>
        : <p className="text-sm text-text-muted">No matching Staffing record. Check the name matches Staffing exactly.</p>}
    </div>
  );
}

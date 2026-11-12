'use client';
import { useCallback, useEffect, useState } from 'react';
import { usd, type CostBreakdown, type CostInputs, type CostSettings } from '@/lib/actualCost';

// Actual (fully loaded) cost UI. Data comes from /api/staffing/cost, which only answers for the
// cost viewers (Clarizz and Catie); for anyone else `allowed` stays false and nothing renders.

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

  async function saveInputs(staffId: string, v: { medical_monthly: string; dental_monthly: string; vision_monthly: string; match_401k_pct: string; other_annual: string }) {
    const res = await fetch('/api/staffing/cost', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ staff_id: staffId, ...v }) });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || 'Could not save');
    setRows(rs => rs.map(r => (r.id === staffId ? d.row : r)));
    return d.row as CostRow;
  }
  async function saveSettings(v: Partial<Record<keyof CostSettings, string>>) {
    const res = await fetch('/api/staffing/cost', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(v) });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || 'Could not save');
    setSettings(d.settings);
    // Only keep the people this view was loaded for.
    setRows(rs => d.rows.filter((r: CostRow) => rs.some(x => x.id === r.id)));
  }
  return { allowed, settings, rows, reload: load, saveInputs, saveSettings };
}

const field = 'w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink tabular-nums';

function Line({ label, value, sub, strong }: { label: string; value: string; sub?: string; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-1.5 ${strong ? 'border-t border-border-light mt-1 pt-2.5' : ''}`}>
      <span className={strong ? 'font-bold text-text-primary' : 'text-text-secondary'}>{label}{sub && <span className="text-text-muted text-xs ml-1.5">{sub}</span>}</span>
      <span className={`tabular-nums ${strong ? 'font-bold text-text-primary text-base' : 'text-text-primary'}`}>{value}</span>
    </div>
  );
}

// Breakdown + this person's inputs. Used in the Staffing pop-up and the Employee File card.
export function ActualCostDetail({ row, settings, onSave }: { row: CostRow; settings: CostSettings; onSave: (v: { medical_monthly: string; dental_monthly: string; vision_monthly: string; match_401k_pct: string; other_annual: string }) => Promise<unknown> }) {
  const c = row.cost;
  const [v, setV] = useState({ medical_monthly: row.inputs.medicalMonthly?.toString() ?? '', dental_monthly: row.inputs.dentalMonthly?.toString() ?? '', vision_monthly: row.inputs.visionMonthly?.toString() ?? '', match_401k_pct: row.inputs.match401kPct?.toString() ?? '', other_annual: row.inputs.otherAnnual?.toString() ?? '' });
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState('');
  useEffect(() => {
    setV({ medical_monthly: row.inputs.medicalMonthly?.toString() ?? '', dental_monthly: row.inputs.dentalMonthly?.toString() ?? '', vision_monthly: row.inputs.visionMonthly?.toString() ?? '', match_401k_pct: row.inputs.match401kPct?.toString() ?? '', other_annual: row.inputs.otherAnnual?.toString() ?? '' });
  }, [row.id, row.inputs.medicalMonthly, row.inputs.dentalMonthly, row.inputs.visionMonthly, row.inputs.match401kPct, row.inputs.otherAnnual]);
  async function save() {
    setBusy(true); setMsg('');
    try { await onSave(v); setMsg('Saved'); } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  }
  return (
    <div className="grid gap-5 md:grid-cols-[1fr_260px]">
      <div className="text-sm">
        <Line label={c.hourly ? 'Pay (hourly, annualized)' : 'Salary'} value={usd(c.wages)} sub={c.fraction < 1 && c.fraction > 0 ? `${Math.round(c.fraction * 100)}% of ${usd(c.annualPay)}` : undefined} />
        {!c.contractor && <>
          <Line label="Social Security" sub={`${settings.ssRate}% up to ${usd(settings.ssWageBase)}`} value={usd(c.socialSecurity)} />
          <Line label="Medicare" sub={`${settings.medicareRate}%`} value={usd(c.medicare)} />
          <Line label="Federal unemployment (FUTA)" sub={`${settings.futaRate}% of first ${usd(settings.futaWageBase)}`} value={usd(c.futa)} />
          <Line label="Tennessee unemployment (SUTA)" sub={`${settings.sutaRate}% of first ${usd(settings.sutaWageBase)}`} value={usd(c.suta)} />
          {([['Medical', 'medicalMonthly', c.medical], ['Dental', 'dentalMonthly', c.dental], ['Vision', 'visionMonthly', c.vision]] as const).map(([label, k, amt]) => (
            <Line key={k} label={`${label} (firm’s share)`} sub={row.inputs[k] != null ? `${usd(row.inputs[k])}/mo` : 'not entered'} value={usd(amt)} />
          ))}
          <Line label="401(k) contribution" sub={`${c.matchPct}% of pay`} value={usd(c.retirement)} />
        </>}
        <Line label="Other costs" sub={!c.contractor && settings.otherPct ? `${settings.otherPct}% of pay + per-person` : undefined} value={usd(c.other)} />
        <Line label={`Actual cost for ${settings.year}`} value={usd(c.total)} strong />
        {c.annualPay && !c.contractor && c.wages > 0 && <p className="text-xs text-text-muted mt-1">That’s {Math.round((c.total / c.wages - 1) * 100)}% on top of pay.</p>}
        {c.notes.length > 0 && <ul className="mt-3 space-y-1">{c.notes.map(n => <li key={n} className="text-xs text-text-muted">• {n}</li>)}</ul>}
      </div>
      <div className="bg-canvas rounded-card p-4 space-y-3 text-sm self-start">
        <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">This person’s costs</p>
        {!row.cost.contractor && <>
          <p className="text-[11px] text-text-muted -mb-1">Firm’s monthly share. Enter 0 if they’re not enrolled.</p>
          {([['medical_monthly', 'Medical ($/month)', 'e.g. 520'], ['dental_monthly', 'Dental ($/month)', 'e.g. 35'], ['vision_monthly', 'Vision ($/month)', 'e.g. 8']] as const).map(([k, label, ph]) => (
            <label key={k} className="block"><span className="text-xs font-semibold text-text-secondary">{label}</span>
              <input className={field} inputMode="decimal" value={v[k]} onChange={e => setV({ ...v, [k]: e.target.value })} placeholder={ph} /></label>
          ))}
          <label className="block"><span className="text-xs font-semibold text-text-secondary">401(k) contribution (%)</span>
            <input className={field} inputMode="decimal" value={v.match_401k_pct} onChange={e => setV({ ...v, match_401k_pct: e.target.value })} placeholder={`Firm default: ${settings.match401kPct}%`} /></label>
        </>}
        <label className="block"><span className="text-xs font-semibold text-text-secondary">Other yearly costs ($)</span>
          <input className={field} inputMode="decimal" value={v.other_annual} onChange={e => setV({ ...v, other_annual: e.target.value })} placeholder="Licenses, stipends…" /></label>
        <div className="flex items-center gap-3">
          <button onClick={save} disabled={busy} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button>
          {msg && <span className="text-xs text-text-muted">{msg}</span>}
        </div>
      </div>
    </div>
  );
}

// Firm-wide rates: tax rates and wage bases, default 401(k) %, other % of pay, hours per year.
export function CostSettingsForm({ settings, onSave, onDone }: { settings: CostSettings; onSave: (v: any) => Promise<void>; onDone: () => void }) {
  const F: [keyof CostSettings, string, string][] = [
    ['year', 'Year', ''], ['ssRate', 'Social Security rate', '%'], ['ssWageBase', 'Social Security wage cap', '$'],
    ['medicareRate', 'Medicare rate', '%'], ['futaRate', 'Federal unemployment (FUTA) rate', '%'], ['futaWageBase', 'FUTA wage base', '$'],
    ['sutaRate', 'Tennessee unemployment (SUTA) rate', '%'], ['sutaWageBase', 'SUTA wage base', '$'],
    ['match401kPct', 'Default 401(k) contribution', '%'], ['otherPct', 'Workers’ comp & other (% of pay)', '%'], ['hoursPerYear', 'Hours per year (hourly staff)', ''],
  ];
  const [v, setV] = useState<Record<string, string>>(Object.fromEntries(F.map(([k]) => [k, String(settings[k])])));
  const [busy, setBusy] = useState(false), [err, setErr] = useState('');
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {F.map(([k, label, unit]) => (
          <label key={k} className="block"><span className="text-xs font-semibold text-text-secondary">{label}{unit && ` (${unit})`}</span>
            <input className={field} inputMode="decimal" value={v[k]} onChange={e => setV({ ...v, [k]: e.target.value })} /></label>
        ))}
      </div>
      <p className="text-xs text-text-muted">2026 defaults: Social Security 6.2% up to $184,500, Medicare 1.45%, FUTA 0.6% of the first $7,000, Tennessee SUTA on the first $7,000. The SUTA rate is specific to Litson — use the rate on the Tennessee Department of Labor notice (2.7% is the new-employer rate).</p>
      {err && <p className="text-sm text-litred-alt">{err}</p>}
      <div className="flex gap-2 justify-end">
        <button onClick={onDone} className="text-sm font-semibold px-4 py-2 rounded-ctrl border border-border-light">Cancel</button>
        <button disabled={busy} onClick={async () => { setBusy(true); setErr(''); try { await onSave(v); onDone(); } catch (e: any) { setErr(e.message); } finally { setBusy(false); } }}
          className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl disabled:opacity-50">{busy ? 'Saving…' : 'Save rates'}</button>
      </div>
    </div>
  );
}

export function CostModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-card shadow-xl w-full max-w-3xl mt-10 p-6" onClick={e => e.stopPropagation()}>
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
        <span className="text-[11px] text-text-muted">Pay + employer taxes + benefits + 401(k). Visible only to Clarizz and Catie.</span>
      </div>
      {row
        ? <div className="bg-white border border-border-light rounded-card p-5"><ActualCostDetail row={row} settings={settings} onSave={v => saveInputs(row.id, v)} /></div>
        : <p className="text-sm text-text-muted">No matching Staffing record, so there’s no salary to work from. Check the name matches Staffing exactly.</p>}
    </div>
  );
}

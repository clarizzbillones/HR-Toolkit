'use client';
import { useCallback, useEffect, useState } from 'react';
import { usd, RETIREMENT_PLANS, type CostBreakdown, type CostInputs, type CostSettings } from '@/lib/actualCost';

// Actual (fully loaded) cost UI. Data comes from /api/staffing/cost, which only answers for the
// cost viewers (Clarizz and Catie); for anyone else `allowed` stays false and nothing renders.

// Form values for one person's inputs (strings, as typed).
export type CostInputValues = { medical_monthly: string; dental_monthly: string; vision_monthly: string; retirement_plan: string;
  match_401k_pct: string; catchup_annual: string; other_annual: string };
const valuesFrom = (i: CostInputs): CostInputValues => ({
  medical_monthly: i.medicalMonthly?.toString() ?? '', dental_monthly: i.dentalMonthly?.toString() ?? '', vision_monthly: i.visionMonthly?.toString() ?? '',
  retirement_plan: i.retirementPlan ?? '', match_401k_pct: i.match401kPct?.toString() ?? '', catchup_annual: i.catchupAnnual?.toString() ?? '', other_annual: i.otherAnnual?.toString() ?? '',
});

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
// Breakdown laid out like the Employer section of an ADP payroll register, plus this person's inputs.
// Used in the Staffing pop-up and the Employee File card.
export function ActualCostDetail({ row, settings, onSave }: { row: CostRow; settings: CostSettings; onSave: (v: CostInputValues) => Promise<unknown> }) {
  const c = row.cost;
  const [v, setV] = useState<CostInputValues>(valuesFrom(row.inputs));
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState('');
  useEffect(() => { setV(valuesFrom(row.inputs)); }, [row.id, JSON.stringify(row.inputs)]);
  async function save() {
    setBusy(true); setMsg('');
    try { await onSave(v); setMsg('Saved'); } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  }
  const planLabel = RETIREMENT_PLANS.find(p => p.key === c.retirementPlan)?.label;
  const matchLabel = c.retirementPlan === 'roth' ? 'Roth 401(k) company match' : c.retirementPlan === 'both' ? '401(k) + Roth company match' : '401(k) company match';
  // [what it is, ADP code, basis, amount]
  const lines: [string, string, string, number][] = c.contractor ? [] : [
    ['Social Security', 'FED SOCSEC-ER', `${settings.ssRate}% up to ${usd(settings.ssWageBase)}`, c.socialSecurity],
    ['Medicare', 'FED MEDCARE-ER', `${settings.medicareRate}%`, c.medicare],
    ['Federal unemployment', 'FED FUTA', `${settings.futaRate}% of first ${usd(settings.futaWageBase)}`, c.futa],
    ['Tennessee unemployment', 'TN SUI-ER', `${settings.sutaRate}% of first ${usd(settings.sutaWageBase)}`, c.suta],
    [matchLabel, '401k $ plan cmp mtch', c.retirementPlan === 'none' ? 'not enrolled' : `${c.matchPct}% of pay`, c.retirement],
    ['401(k) catch-up match', '401k catch-up $ cmp mtch', 'per year', c.catchup],
    ['Medical', 'firm’s share', row.inputs.medicalMonthly != null ? `${usd(row.inputs.medicalMonthly)}/mo` : 'not entered', c.medical],
    ['Dental', 'firm’s share', row.inputs.dentalMonthly != null ? `${usd(row.inputs.dentalMonthly)}/mo` : 'not entered', c.dental],
    ['Vision', 'firm’s share', row.inputs.visionMonthly != null ? `${usd(row.inputs.visionMonthly)}/mo` : 'not entered', c.vision],
  ];
  if (c.other || c.contractor) lines.push(['Other costs', '', !c.contractor && settings.otherPct ? `${settings.otherPct}% of pay + per-person` : 'per-person', c.other]);
  const money2 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <div className="grid gap-5 md:grid-cols-[1fr_270px]">
      <div className="text-sm">
        <div className="border border-border-light rounded-card overflow-hidden">
          <div className="bg-canvas px-4 py-2 text-center text-xs font-bold uppercase tracking-wider text-text-secondary border-b border-border-light">Employer</div>
          <table className="w-full">
            <thead><tr className="border-b border-border-light text-xs text-text-muted"><th className="text-left font-semibold px-4 py-2">Liability</th><th className="text-right font-semibold px-4 py-2">Amount</th></tr></thead>
            <tbody>
              {lines.map(([what, code, basis, amt]) => (
                <tr key={what} className="border-b border-[#f1ece3]">
                  <td className="px-4 py-2"><span className="text-text-primary">{what}</span>{code && <span className="ml-2 text-[11px] text-text-muted uppercase tracking-wide">{code}</span>}
                    <div className="text-[11px] text-text-muted">{basis}</div></td>
                  <td className="px-4 py-2 text-right tabular-nums text-text-primary">{money2(amt)}</td>
                </tr>
              ))}
              <tr><td className="px-4 py-2.5 font-bold text-text-primary">Employer cost <span className="font-normal text-xs text-text-muted">taxes + benefits</span></td>
                <td className="px-4 py-2.5 text-right tabular-nums font-bold text-text-primary border-t-2 border-text-primary">{money2(c.employerCost)}</td></tr>
            </tbody>
          </table>
        </div>
        <div className="mt-4">
          <Line label={c.hourly ? 'Pay (hourly, annualized)' : 'Salary'} value={usd(c.wages)} sub={c.fraction < 1 && c.fraction > 0 ? `${Math.round(c.fraction * 100)}% of ${usd(c.annualPay)}` : undefined} />
          <Line label="Employer cost" value={usd(c.employerCost)} />
          <Line label={`Actual cost for ${settings.year}`} value={usd(c.total)} strong />
          {!c.contractor && c.wages > 0 && <p className="text-xs text-text-muted mt-1">Employer cost adds {Math.round((c.employerCost / c.wages) * 100)}% on top of pay.{planLabel ? ` Retirement plan: ${planLabel}.` : ''}</p>}
        </div>
        {c.notes.length > 0 && <ul className="mt-3 space-y-1">{c.notes.map(n => <li key={n} className="text-xs text-text-muted">• {n}</li>)}</ul>}
      </div>
      <div className="bg-canvas rounded-card p-4 space-y-3 text-sm self-start">
        <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">This person’s costs</p>
        {!c.contractor && <>
          <p className="text-[11px] text-text-muted -mb-1">Firm’s monthly share. Enter 0 if they’re not enrolled.</p>
          {([['medical_monthly', 'Medical ($/month)', 'e.g. 520'], ['dental_monthly', 'Dental ($/month)', 'e.g. 35'], ['vision_monthly', 'Vision ($/month)', 'e.g. 8']] as const).map(([k, label, ph]) => (
            <label key={k} className="block"><span className="text-xs font-semibold text-text-secondary">{label}</span>
              <input className={field} inputMode="decimal" value={v[k]} onChange={e => setV({ ...v, [k]: e.target.value })} placeholder={ph} /></label>
          ))}
          <label className="block"><span className="text-xs font-semibold text-text-secondary">Retirement plan</span>
            <select className={field} value={v.retirement_plan} onChange={e => setV({ ...v, retirement_plan: e.target.value })}>
              <option value="">Not set</option>{RETIREMENT_PLANS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select></label>
          {v.retirement_plan !== 'none' && <>
            <label className="block"><span className="text-xs font-semibold text-text-secondary">Company match (% of pay)</span>
              <input className={field} inputMode="decimal" value={v.match_401k_pct} onChange={e => setV({ ...v, match_401k_pct: e.target.value })} placeholder={`Firm default: ${settings.match401kPct}%`} /></label>
            <label className="block"><span className="text-xs font-semibold text-text-secondary">Catch-up match ($/year)</span>
              <input className={field} inputMode="decimal" value={v.catchup_annual} onChange={e => setV({ ...v, catchup_annual: e.target.value })} placeholder="0" /></label>
          </>}
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

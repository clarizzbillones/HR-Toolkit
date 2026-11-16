'use client';
import { useEffect, useMemo, useState } from 'react';
import { K401_ELIGIBLE, K401_PLANS, K401_STATUSES, money, fmtDay, rosterMismatch, fromRoster, type K401Row } from '@/lib/k401';
import { styledSheet, downloadWorkbook } from '@/lib/xlsxStyle';

// 401(k) contributions, entered by hand from payroll: eligibility, plan, employee % and $ per paycheck,
// Litson's $ per paycheck, and whether the employee has confirmed it. Only Clarizz and Catie get data
// from the API; for anyone else this renders nothing.

const cell = 'w-full bg-transparent border border-transparent hover:border-border-light focus:border-ink focus:bg-white rounded-ctrl px-2 py-1.5 text-sm focus:outline-none';
const th = 'text-left text-[11px] font-bold uppercase tracking-wider text-text-muted px-2 py-2 whitespace-nowrap';
const STATUS_TONE: Record<string, string> = {
  'Not sent': 'bg-[#f1ece3] text-[#8b8478]', Emailed: 'bg-[#e8f0fe] text-[#2563eb]',
  Confirmed: 'bg-[#eef5f1] text-[#2f7d5b]', 'Needs fix': 'bg-[#f3e9e7] text-[#b0412f]',
};

export function use401kAllowed() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  useEffect(() => { fetch('/api/benefits/401k').then(r => setAllowed(r.ok)).catch(() => setAllowed(false)); }, []);
  return allowed;
}

export default function Retirement401k() {
  const [rows, setRows] = useState<K401Row[] | null>(null);
  const [err, setErr] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [onlyDiff, setOnlyDiff] = useState(false);
  const [msg, setMsg] = useState('');
  const [preview, setPreview] = useState<{ subject: string; previews: { staff_id: string; name: string; email: string | null; html: string }[] } | null>(null);
  const [pi, setPi] = useState(0);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetch('/api/benefits/401k').then(async r => { if (!r.ok) throw new Error('forbidden'); setRows((await r.json()).rows); }).catch(() => setErr('forbidden'));
  }, []);

  async function save(id: string, patch: Partial<K401Row>) {
    setRows(rs => rs!.map(r => (r.staff_id === id ? { ...r, ...patch } : r)));
    const res = await fetch('/api/benefits/401k', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ staff_id: id, ...patch }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg(d.error || 'Could not save'); return; }
    setRows(rs => rs!.map(r => (r.staff_id === id ? d.row : r))); setMsg('Saved');
  }

  const list = useMemo(() => (rows ?? []).filter(r => (!q || r.name.toLowerCase().includes(q.toLowerCase())) && (!onlyDiff || !!rosterMismatch(r))), [rows, q, onlyDiff]);
  if (err) return null;
  if (!rows) return <p className="text-sm text-text-muted">Loading…</p>;

  const enrolled = rows.filter(r => r.plan && r.plan !== 'Not enrolled');
  const totals = { emp: enrolled.reduce((t, r) => t + (r.emp_check ?? 0), 0), er: enrolled.reduce((t, r) => t + (r.er_check ?? 0), 0) };
  const counts = Object.fromEntries(K401_STATUSES.map(s => [s, rows.filter(r => (r.status || 'Not sent') === s).length]));
  const allSel = list.length > 0 && list.every(r => sel.has(r.staff_id));
  const diffs = rows.filter(r => rosterMismatch(r)).length;
  // People with nothing entered yet whose roster status tells us their eligibility.
  const fillable = rows.filter(r => !r.eligible && !r.plan && fromRoster(r.roster));
  async function fillFromRoster() {
    for (const r of fillable) await save(r.staff_id, fromRoster(r.roster)! as any);
    setMsg(`Filled ${fillable.length} from the Benefits roster.`);
  }

  async function openPreview() {
    const res = await fetch('/api/benefits/401k', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'preview', staff_ids: [...sel] }) });
    const d = await res.json(); if (!res.ok) { setMsg(d.error || 'Could not build the emails'); return; }
    setPreview(d); setPi(0);
  }
  async function send() {
    setSending(true);
    try {
      const res = await fetch('/api/benefits/401k', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send', staff_ids: [...sel] }) });
      const d = await res.json(); if (!res.ok) throw new Error(d.error || 'Send failed');
      setRows(d.rows);
      const bad = d.results.filter((x: any) => !x.ok);
      setMsg(bad.length ? `Sent ${d.results.length - bad.length}. Not sent: ${bad.map((x: any) => `${x.name} (${x.error})`).join('; ')}` : `Sent ${d.results.length} email${d.results.length === 1 ? '' : 's'}.`);
      setPreview(null); setSel(new Set());
    } catch (e: any) { setMsg(e.message); } finally { setSending(false); }
  }
  async function exportExcel() {
    const X: any = await import('xlsx-js-style');
    const headers = ['Employee', 'Position', 'Benefits roster', 'Differs from roster', 'Eligible', 'Eligible date', 'Plan', 'Employee %', 'Employee / paycheck', 'Employer / paycheck', 'As of paycheck', 'Employee check', 'Emailed', 'Note'];
    const data = rows!.map(r => [r.name, r.position ?? '', r.roster || 'Not on roster', rosterMismatch(r) ?? '', r.eligible ?? '', fmtDay(r.eligible_date), r.plan ?? '', r.emp_pct != null ? `${r.emp_pct}%` : '',
      r.emp_check ?? '', r.er_check ?? '', fmtDay(r.as_of), r.status || 'Not sent', r.sent_at ? fmtDay(r.sent_at.slice(0, 10)) : '', r.note ?? '']);
    downloadWorkbook(X, [['401(k) contributions', styledSheet(X, { headers, rows: data, totals: true, money: i => i === 8 || i === 9,
      widths: [24, 26, 15, 40, 10, 14, 16, 11, 18, 18, 15, 14, 12, 30] })]], `Litson-401k-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  const p = preview?.previews[pi];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {([['Enrolled', `${enrolled.length} of ${rows.length}`], ['Employees / paycheck', money(totals.emp) || '$0.00'], ['Litson / paycheck', money(totals.er) || '$0.00'],
          ['Differs from roster', String(diffs)]] as [string, string][]).map(([l, v]) => (
          <div key={l} className="bg-white border border-border-light rounded-card px-4 py-3" style={{ borderTop: '3px solid #2a5d7a' }}>
            <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">{l}</div>
            <div className="text-[18px] font-semibold text-text-primary tabular-nums">{v}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name…" className="border border-border-light rounded-ctrl px-3 py-2 text-sm w-56 focus:outline-none focus:border-ink" />
        <span className="text-xs text-text-muted flex-1">Type straight into the table; each change saves. Payroll deductions override the election in Guideline.</span>
        {msg && <span className="text-xs text-text-muted">{msg}</span>}
        <label className="text-sm flex items-center gap-1.5 text-text-secondary"><input type="checkbox" checked={onlyDiff} onChange={e => setOnlyDiff(e.target.checked)} />Only differences ({diffs})</label>
        {fillable.length > 0 && <button onClick={fillFromRoster} title="For people not entered yet: Enrolled → eligible Yes; Declined → eligible Yes, Not enrolled; Not eligible → Not yet, Not enrolled" className="bg-white border border-border-light text-ink text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-canvas">Fill {fillable.length} from roster</button>}
        <button onClick={exportExcel} className="bg-white border border-border-light text-ink text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-canvas">⬇ Excel</button>
        <button onClick={openPreview} disabled={!sel.size} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl disabled:opacity-40">✉ Email {sel.size || ''} to confirm</button>
      </div>

      <div className="bg-white border border-border-light rounded-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-canvas border-b border-border-light"><tr>
            <th className="px-2 py-2 w-8"><input type="checkbox" checked={allSel} onChange={e => setSel(e.target.checked ? new Set(list.map(r => r.staff_id)) : new Set())} aria-label="Select all" /></th>
            <th className={th}>Employee</th><th className={th}>Benefits roster</th><th className={th}>Eligible</th><th className={th}>Eligible date</th><th className={th}>Plan</th>
            <th className={`${th} text-right`}>Employee %</th><th className={`${th} text-right`}>Employee / paycheck</th><th className={`${th} text-right`}>Employer / paycheck</th>
            <th className={th}>As of paycheck</th><th className={th}>Employee check</th><th className={th}>Note</th>
          </tr></thead>
          <tbody>
            {list.map(r => {
              const off = r.plan === 'Not enrolled' || r.eligible === 'No' || r.eligible === 'Not yet';
              const st = r.status || 'Not sent';
              return (
                <tr key={r.staff_id} className={`border-t border-[#f1ece3] ${sel.has(r.staff_id) ? 'bg-[#f6f9ff]' : ''}`}>
                  <td className="px-2"><input type="checkbox" checked={sel.has(r.staff_id)} onChange={e => setSel(s => { const n = new Set(s); e.target.checked ? n.add(r.staff_id) : n.delete(r.staff_id); return n; })} aria-label={`Select ${r.name}`} /></td>
                  <td className="px-2 py-1.5 whitespace-nowrap"><div className="font-semibold text-text-primary">{r.name}</div>
                    <div className={`text-[11px] ${r.email ? 'text-text-muted' : 'text-[#b07d2a]'}`}>{r.email || 'No email in Staffing'}</div></td>
                  <td className="px-2 whitespace-nowrap">{(() => { const d = rosterMismatch(r); const t = r.roster;
                    const tone = !t ? 'bg-[#f7efe1] text-[#b07d2a]' : t === 'Enrolled' ? 'bg-[#eef5f1] text-[#2f7d5b]' : t === 'Declined' ? 'bg-[#f3e9e7] text-[#b0412f]' : 'bg-[#eceef2] text-[#5a6b82]';
                    return <span title={d || (t ? 'Matches what’s entered here' : 'No 401(k) status on the Benefits roster')} className="inline-flex items-center gap-1">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${tone}`}>{t || 'Not on roster'}</span>
                      {d && <span className="text-[#b0412f] font-bold" aria-label={d}>⚠</span>}</span>; })()}</td>
                  <td className="px-1 min-w-[96px]"><select className={cell} value={r.eligible ?? ''} onChange={e => save(r.staff_id, { eligible: e.target.value || null })}>
                    <option value="">—</option>{K401_ELIGIBLE.map(x => <option key={x}>{x}</option>)}</select></td>
                  <td className="px-1 min-w-[140px]"><input type="date" className={cell} defaultValue={r.eligible_date ?? ''} key={`ed${r.eligible_date}`} onBlur={e => e.target.value !== (r.eligible_date ?? '') && save(r.staff_id, { eligible_date: e.target.value || null })} /></td>
                  <td className="px-1 min-w-[140px]"><select className={cell} value={r.plan ?? ''} onChange={e => save(r.staff_id, { plan: e.target.value || null })}>
                    <option value="">—</option>{K401_PLANS.map(x => <option key={x}>{x}</option>)}</select></td>
                  {(['emp_pct', 'emp_check', 'er_check'] as const).map(k => (
                    <td key={k} className="px-1 min-w-[110px]"><input inputMode="decimal"
                      className={`${cell} text-right tabular-nums ${off ? 'text-text-muted' : ''}`} key={`${k}${r[k]}`}
                      defaultValue={r[k] == null ? '' : k === 'emp_pct' ? String(r[k]) : Number(r[k]).toFixed(2)} placeholder={k === 'emp_pct' ? '%' : '$0.00'}
                      onBlur={e => { const v = e.target.value.replace(/[$,%\s]/g, ''); if (v !== (r[k] == null ? '' : String(r[k]))) save(r.staff_id, { [k]: v === '' ? null : Number(v) } as any); }} /></td>
                  ))}
                  <td className="px-1 min-w-[140px]"><input type="date" className={cell} defaultValue={r.as_of ?? ''} key={`ao${r.as_of}`} onBlur={e => e.target.value !== (r.as_of ?? '') && save(r.staff_id, { as_of: e.target.value || null })} /></td>
                  <td className="px-1 min-w-[130px]"><select className={`${cell} font-semibold ${STATUS_TONE[st]}`} value={st} onChange={e => save(r.staff_id, { status: e.target.value })}>
                    {K401_STATUSES.map(x => <option key={x}>{x}</option>)}</select>
                    {r.sent_at && <div className="text-[10px] text-text-muted px-2">emailed {fmtDay(r.sent_at.slice(0, 10))}</div>}</td>
                  <td className="px-1 min-w-[180px]"><input className={cell} defaultValue={r.note ?? ''} key={`n${r.note}`} placeholder="e.g. says 5%, payroll shows 6%"
                    onBlur={e => e.target.value !== (r.note ?? '') && save(r.staff_id, { note: e.target.value })} /></td>
                </tr>
              );
            })}
            <tr className="border-t-2 border-text-primary bg-canvas font-bold">
              <td /><td className="px-2 py-2">Total per paycheck</td><td colSpan={5} />
              <td className="px-3 py-2 text-right tabular-nums">{money(totals.emp)}</td><td className="px-3 py-2 text-right tabular-nums">{money(totals.er)}</td><td colSpan={3} />
            </tr>
          </tbody>
        </table>
      </div>

      {preview && p && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setPreview(null)}>
          <div className="bg-white rounded-card shadow-xl w-full max-w-2xl mt-10 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="font-spectral text-xl font-semibold">Email {preview.previews.length} employee{preview.previews.length === 1 ? '' : 's'} to confirm</h2>
            <p className="text-sm text-text-muted mt-1">Each person gets only their own details, from your mailbox, so replies come to you.</p>
            <div className="flex items-center gap-2 mt-4 text-sm">
              <button onClick={() => setPi(i => Math.max(0, i - 1))} disabled={pi === 0} className="border border-border-light rounded-ctrl px-2 py-1 disabled:opacity-40">‹</button>
              <span className="font-semibold">{p.name}</span><span className={p.email ? 'text-text-muted' : 'text-litred-alt'}>{p.email || 'no email — will be skipped'}</span>
              <span className="text-text-muted ml-auto">{pi + 1} of {preview.previews.length}</span>
              <button onClick={() => setPi(i => Math.min(preview.previews.length - 1, i + 1))} disabled={pi === preview.previews.length - 1} className="border border-border-light rounded-ctrl px-2 py-1 disabled:opacity-40">›</button>
            </div>
            <div className="border border-border-light rounded-card p-4 mt-3 bg-canvas">
              <div className="text-xs text-text-muted mb-2">Subject: <b className="text-text-primary">{preview.subject}</b></div>
              <div className="bg-white rounded-ctrl p-4" dangerouslySetInnerHTML={{ __html: p.html }} />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setPreview(null)} className="text-sm font-semibold px-4 py-2 rounded-ctrl border border-border-light">Cancel</button>
              <button onClick={send} disabled={sending} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl disabled:opacity-50">{sending ? 'Sending…' : `Send ${preview.previews.filter(x => x.email).length} email${preview.previews.filter(x => x.email).length === 1 ? '' : 's'}`}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

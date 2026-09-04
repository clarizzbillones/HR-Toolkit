'use client';
import { useState } from 'react';
import { useToast } from '@/components/Toast';
import { useAccess } from '@/components/AccessProvider';

interface Policy {
  id: string; category: string; ins_type: string; carrier: string; policy_number: string;
  broker: string; broker_contact: string; contact_info: string; effective_date: string;
  renews: string; annual_premium: string; notes: string; sort_order?: number;
}
interface FollowUp { id: string; kind: string; item: string; detail: string; sort_order?: number }

const POLICY_FIELDS: [keyof Policy, string][] = [
  ['ins_type', 'Insurance type'], ['carrier', 'Carrier'], ['policy_number', 'Policy number'],
  ['broker', 'Broker / agency'], ['broker_contact', 'Broker contact'], ['contact_info', 'Contact info'],
  ['effective_date', 'Effective date'], ['renews', 'Renews'], ['annual_premium', 'Annual premium'],
];

// Sum the numeric annual premiums (ignores TBD / N/A / "Varies"). Handles $, commas, ~, /yr.
function parseMoney(s: string): number {
  const m = String(s ?? '').replace(/,/g, '').match(/\$?\s*([\d]+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}
const fmtUSD = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Best-effort next renewal date from the free-text "Renews" field. Handles
// M/D/YYYY, M/D/YY and M/D (no year); rolls annual dates forward to the next
// occurrence. Returns null for "Active until cancelled" / "N/A" etc.
function nextRenewal(renews: string): Date | null {
  const s = String(renews ?? '');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    let yr = parseInt(m[3], 10); if (yr < 100) yr += 2000;
    let dt = new Date(yr, +m[1] - 1, +m[2]);
    let guard = 0;
    while (dt < today && /annual|yr|year/i.test(s) && guard++ < 10) dt = new Date(dt.getFullYear() + 1, dt.getMonth(), dt.getDate());
    return isNaN(+dt) ? null : dt;
  }
  m = s.match(/\b(\d{1,2})\/(\d{1,2})\b/);
  if (m) {
    let dt = new Date(today.getFullYear(), +m[1] - 1, +m[2]);
    if (dt < today) dt = new Date(today.getFullYear() + 1, +m[1] - 1, +m[2]);
    return isNaN(+dt) ? null : dt;
  }
  return null;
}
function daysUntil(dt: Date | null): number | null {
  if (!dt) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((dt.getTime() - today.getTime()) / 86400000);
}
const fmtDate = (dt: Date) => dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export default function InsuranceClient({ initialPolicies, initialFollowups, categories }: { initialPolicies: Policy[]; initialFollowups: FollowUp[]; categories: string[] }) {
  const { showToast } = useToast();
  const { me } = useAccess();
  const readOnly = !!me?.restricted && !(me?.editSections ?? []).includes('/insurance');
  const [policies, setPolicies] = useState<Policy[]>(initialPolicies);
  const [followups, setFollowups] = useState<FollowUp[]>(initialFollowups);
  const [editing, setEditing] = useState<Policy | null>(null);
  const [isNew, setIsNew] = useState(false);

  const input = 'w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink';
  const catsPresent = categories.filter(c => policies.some(p => p.category === c)).concat(
    [...new Set(policies.map(p => p.category))].filter(c => !categories.includes(c)));
  const openItems = followups.filter(f => f.kind !== 'excluded');
  const excluded = followups.filter(f => f.kind === 'excluded');
  const totalPremium = policies.reduce((s, p) => s + parseMoney(p.annual_premium), 0);
  // Upcoming renewals (≤60 days), soonest first — powers the banner + row badges.
  const upcoming = policies
    .map(p => ({ p, days: daysUntil(nextRenewal(p.renews)), date: nextRenewal(p.renews) }))
    .filter(x => x.days != null && x.days <= 60)
    .sort((a, b) => (a.days! - b.days!));

  async function exportExcel() {
    const XLSX: any = await import('xlsx');
    const header = ['Insurance Type', 'Carrier', 'Policy Number', 'Broker / Agency', 'Broker Contact', 'Contact Info', 'Effective Date', 'Renews', 'Annual Premium', 'Notes'];
    const aoa: any[][] = [['Litson PLLC — Insurance Master List'], [`Exported ${new Date().toLocaleDateString()}`], [], header];
    for (const cat of catsPresent) {
      aoa.push([cat]);
      for (const p of policies.filter(x => x.category === cat)) aoa.push([p.ins_type, p.carrier, p.policy_number, p.broker, p.broker_contact, p.contact_info, p.effective_date, p.renews, p.annual_premium, p.notes]);
    }
    const ws1 = XLSX.utils.aoa_to_sheet(aoa);
    const f2: any[][] = [['Open Items & Things Left Off the Master List'], [], ['Item', 'Detail'], ...openItems.map(f => [f.item, f.detail]), [], ['Excluded from the master list (not Litson business insurance):'], ...excluded.map(f => [f.item, ''])];
    const ws2 = XLSX.utils.aoa_to_sheet(f2);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, 'Insurance Master List');
    XLSX.utils.book_append_sheet(wb, ws2, 'Follow-ups & Exclusions');
    const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'Litson_Insurance_Master_List.xlsx'; a.click(); URL.revokeObjectURL(a.href);
  }

  function startNew() { setEditing({ id: '', category: categories[0], ins_type: '', carrier: '', policy_number: '', broker: '', broker_contact: '', contact_info: '', effective_date: '', renews: '', annual_premium: '', notes: '' }); setIsNew(true); }
  function startEdit(p: Policy) { setEditing({ ...p }); setIsNew(false); }

  async function savePolicy() {
    if (!editing) return;
    if (isNew) {
      const res = await fetch('/api/insurance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) });
      const { row } = await res.json(); if (row) setPolicies(p => [...p, row]);
    } else {
      const res = await fetch('/api/insurance', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) });
      const { row } = await res.json(); if (row) setPolicies(p => p.map(x => x.id === row.id ? row : x));
    }
    setEditing(null); showToast('Saved');
  }
  async function deletePolicy(p: Policy) {
    if (!confirm(`Delete "${p.ins_type}"?`)) return;
    await fetch(`/api/insurance?id=${p.id}`, { method: 'DELETE' });
    setPolicies(prev => prev.filter(x => x.id !== p.id)); showToast('Deleted');
  }

  async function addFollowup(kind: string) {
    const res = await fetch('/api/insurance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'followup', kind, item: '', detail: '' }) });
    const { row } = await res.json(); if (row) setFollowups(f => [...f, row]);
  }
  function editFollowupLocal(id: string, patch: Partial<FollowUp>) { setFollowups(f => f.map(x => x.id === id ? { ...x, ...patch } : x)); }
  async function saveFollowup(f: FollowUp) {
    await fetch('/api/insurance', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'followup', id: f.id, item: f.item, detail: f.detail }) });
  }
  async function deleteFollowup(id: string) {
    await fetch(`/api/insurance?type=followup&id=${id}`, { method: 'DELETE' });
    setFollowups(prev => prev.filter(x => x.id !== id));
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="px-8 py-5 bg-white border-b border-border flex items-center justify-between gap-4 flex-shrink-0">
        <div>
          <h1 className="font-spectral text-[23px] font-semibold text-text-primary">Insurance</h1>
          <p className="text-sm text-text-muted mt-0.5">Litson PLLC insurance master list — policies, carriers, renewals &amp; open items.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportExcel} className="text-sm font-semibold text-ink border border-border-light px-4 py-2 rounded-ctrl hover:bg-canvas">⤓ Excel</button>
          <button onClick={() => window.print()} className="text-sm font-semibold text-ink border border-border-light px-4 py-2 rounded-ctrl hover:bg-canvas">⤓ Print / PDF</button>
          {!readOnly && (
            <button onClick={async () => { showToast('Sending test…'); try { const r = await fetch('/api/insurance/remind?test=1', { method: 'POST' }); const d = await r.json(); showToast(r.ok ? `✓ Test renewal email sent to ${d.to}` : (d.error || 'Could not send')); } catch { showToast('Could not send'); } }}
              title="Email a renewal-reminder preview to clarizz@litson.co now"
              className="text-sm font-semibold text-ink border border-border-light px-4 py-2 rounded-ctrl hover:bg-canvas">🔔 Test email</button>
          )}
          {!readOnly && <button onClick={startNew} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark">+ Add policy</button>}
        </div>
      </header>

      <div className="flex-1 overflow-auto px-8 py-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-2xl">
          {([['Policies on file', String(policies.length)], ['Known annual premium', fmtUSD(totalPremium)], ['Renewing ≤60 days', String(upcoming.length)], ['Open items', String(openItems.length)]] as [string, string][]).map(([l, v]) => (
            <div key={l} className="bg-white border border-border-light rounded-card px-4 py-3" style={{ borderTop: '3px solid #c9a24a' }}>
              <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">{l}</div>
              <div className="text-[20px] font-semibold text-text-primary">{v}</div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-text-faint -mt-3">Known annual premium sums only the policies with a numeric premium (TBD / N/A / roster-rated are excluded).</p>

        {/* Upcoming renewals banner */}
        {upcoming.length > 0 && (
          <div className="bg-[#fdf6e9] border border-[#e0c48a] rounded-card px-5 py-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#b07d2a] mb-2">⏰ Renewals coming up (next 60 days)</div>
            <div className="space-y-1">
              {upcoming.map(({ p, days, date }) => (
                <div key={p.id} className="flex items-center gap-2 text-sm flex-wrap">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${days! < 0 ? 'bg-[#fdeaea] text-[#b0412f]' : days! <= 30 ? 'bg-[#fdeaea] text-[#b0412f]' : 'bg-[#f7efe1] text-[#b07d2a]'}`}>
                    {days! < 0 ? `${Math.abs(days!)}d overdue` : days === 0 ? 'due today' : `in ${days}d`}
                  </span>
                  <span className="font-medium text-text-primary">{p.ins_type}</span>
                  <span className="text-text-muted">· {p.carrier}{date ? ` · renews ${fmtDate(date)}` : ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Policies grouped by category */}
        {catsPresent.map(cat => (
          <div key={cat} className="bg-white border border-border rounded-card overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-[#f1ece3]">
              <div className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">{cat}</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1000px]">
                <thead className="bg-[#faf8f4]">
                  <tr>{['Insurance type', 'Carrier', 'Policy #', 'Broker', 'Contact', 'Effective', 'Renews', 'Annual premium', 'Notes', ''].map(h => (
                    <th key={h} className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-text-muted whitespace-nowrap">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {policies.filter(p => p.category === cat).map(p => (
                    <tr key={p.id} className="border-t border-[#f1ece3] align-top">
                      <td className="px-3 py-2.5 font-medium text-text-primary min-w-[180px]">{p.ins_type}</td>
                      <td className="px-3 py-2.5 text-text-secondary whitespace-nowrap">{p.carrier}</td>
                      <td className="px-3 py-2.5 text-text-secondary whitespace-nowrap">{p.policy_number}</td>
                      <td className="px-3 py-2.5 text-text-secondary min-w-[140px]">{p.broker}<div className="text-xs text-text-muted">{p.broker_contact}</div></td>
                      <td className="px-3 py-2.5 text-text-muted text-xs min-w-[160px]">{p.contact_info}</td>
                      <td className="px-3 py-2.5 text-text-secondary whitespace-nowrap">{p.effective_date}</td>
                      <td className="px-3 py-2.5 text-text-secondary whitespace-nowrap">
                        {p.renews}
                        {(() => { const d = daysUntil(nextRenewal(p.renews)); return d != null && d <= 60 ? (
                          <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${d <= 30 ? 'bg-[#fdeaea] text-[#b0412f]' : 'bg-[#f7efe1] text-[#b07d2a]'}`}>{d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? 'today' : `${d}d`}</span>
                        ) : null; })()}
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-text-primary whitespace-nowrap">{p.annual_premium}</td>
                      <td className="px-3 py-2.5 text-text-muted text-xs min-w-[240px] max-w-[320px]">{p.notes}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-right">
                        {!readOnly && (
                          <>
                            <button onClick={() => startEdit(p)} className="text-xs font-semibold text-ink border border-border-light px-2 py-1 rounded-ctrl hover:bg-canvas">Edit</button>
                            <button onClick={() => deletePolicy(p)} className="ml-1.5 text-xs font-semibold text-litred-alt border border-border-light px-2 py-1 rounded-ctrl hover:bg-[#fdeaea]">✕</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {/* Open items */}
        <div className="bg-white border border-border rounded-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between gap-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">Open items &amp; things left off the master list</div>
            {!readOnly && <button onClick={() => addFollowup('open')} className="text-xs font-semibold text-[#3f6b8a] hover:underline">+ Add item</button>}
          </div>
          <div className="divide-y divide-[#f1ece3]">
            {openItems.map(f => (
              <div key={f.id} className="px-5 py-3">
                {readOnly ? (
                  <><div className="font-semibold text-text-primary text-sm">{f.item}</div><div className="text-sm text-text-muted mt-0.5">{f.detail}</div></>
                ) : (
                  <div className="flex gap-2 items-start">
                    <div className="flex-1 space-y-1.5">
                      <input value={f.item} onChange={e => editFollowupLocal(f.id, { item: e.target.value })} onBlur={() => saveFollowup(f)} placeholder="Item" className={input + ' font-semibold'} />
                      <textarea value={f.detail} onChange={e => editFollowupLocal(f.id, { detail: e.target.value })} onBlur={() => saveFollowup(f)} rows={2} placeholder="Detail" className={input + ' resize-y'} />
                    </div>
                    <button onClick={() => deleteFollowup(f.id)} className="text-xs font-semibold text-litred-alt border border-border-light px-2 py-1 rounded-ctrl hover:bg-[#fdeaea] shrink-0">✕</button>
                  </div>
                )}
              </div>
            ))}
            {openItems.length === 0 && <div className="px-5 py-4 text-sm text-text-muted">No open items.</div>}
          </div>
        </div>

        {/* Excluded */}
        <div className="bg-white border border-border rounded-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between gap-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">Excluded from the master list <span className="font-normal normal-case text-text-faint">(not Litson business insurance)</span></div>
            {!readOnly && <button onClick={() => addFollowup('excluded')} className="text-xs font-semibold text-[#3f6b8a] hover:underline">+ Add</button>}
          </div>
          <div className="divide-y divide-[#f1ece3]">
            {excluded.map(f => (
              <div key={f.id} className="px-5 py-2.5 flex gap-2 items-center">
                {readOnly ? <span className="text-sm text-text-muted">• {f.item}</span> : (
                  <>
                    <span className="text-text-faint">•</span>
                    <input value={f.item} onChange={e => editFollowupLocal(f.id, { item: e.target.value })} onBlur={() => saveFollowup(f)} className={input} />
                    <button onClick={() => deleteFollowup(f.id)} className="text-xs font-semibold text-litred-alt border border-border-light px-2 py-1 rounded-ctrl hover:bg-[#fdeaea] shrink-0">✕</button>
                  </>
                )}
              </div>
            ))}
            {excluded.length === 0 && <div className="px-5 py-4 text-sm text-text-muted">Nothing excluded.</div>}
          </div>
        </div>
      </div>

      {/* Edit / add policy modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-6 overflow-auto" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-card w-full max-w-2xl my-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="font-spectral text-[18px] font-semibold text-text-primary">{isNew ? 'Add policy' : 'Edit policy'}</h2>
              <button onClick={() => setEditing(null)} className="text-text-muted hover:text-text-primary text-xl leading-none">×</button>
            </div>
            <div className="px-6 py-5 grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-text-secondary mb-1">Category</label>
                <input list="ins-cats" value={editing.category} onChange={e => setEditing({ ...editing, category: e.target.value })} className={input} />
                <datalist id="ins-cats">{categories.map(c => <option key={c} value={c} />)}</datalist>
              </div>
              {POLICY_FIELDS.map(([k, label]) => (
                <div key={k} className={k === 'ins_type' ? 'col-span-2' : ''}>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">{label}</label>
                  <input value={(editing as any)[k] ?? ''} onChange={e => setEditing({ ...editing, [k]: e.target.value })} className={input} />
                </div>
              ))}
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-text-secondary mb-1">Notes</label>
                <textarea value={editing.notes} onChange={e => setEditing({ ...editing, notes: e.target.value })} rows={3} className={input + ' resize-y'} />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="text-sm font-semibold text-text-muted px-4 py-2">Cancel</button>
              <button onClick={savePolicy} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark">{isNew ? 'Add policy' : 'Save changes'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

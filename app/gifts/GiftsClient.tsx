'use client';
import { useState } from 'react';
import { useToast } from '@/components/Toast';

interface Gift {
  id: string; name: string; relationship: string; address: string; phone: string;
  tier: string; ordered: boolean; ordered_note: string; mailed: boolean; sort_order?: number;
}
const TIERS = ['', '$', '$$', '$$$'];
const TIER_STYLE: Record<string, string> = {
  '$': 'bg-[#eef5f1] text-[#2f7d5b] border-[#cfe4d8]',
  '$$': 'bg-[#f7efe1] text-[#b07d2a] border-[#e0c48a]',
  '$$$': 'bg-[#f6ecef] text-[#6e2b3e] border-[#e0b9c6]',
};

export default function GiftsClient({ initialRows }: { initialRows: Gift[] }) {
  const { showToast } = useToast();
  const [rows, setRows] = useState<Gift[]>(initialRows);
  const input = 'w-full bg-transparent text-sm focus:outline-none focus:bg-white focus:border focus:border-ink rounded px-1.5 py-1 border border-transparent hover:border-border-light';

  const setLocal = (id: string, patch: Partial<Gift>) => setRows(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r));
  async function save(id: string, patch: Partial<Gift>) {
    await fetch('/api/gifts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...patch }) });
  }
  function edit(id: string, patch: Partial<Gift>) { setLocal(id, patch); save(id, patch); } // immediate (checkbox/select)
  async function addRow() {
    const res = await fetch('/api/gifts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: '' }) });
    const { row } = await res.json(); if (row) setRows(rs => [...rs, row]);
  }
  async function remove(g: Gift) {
    if (!confirm(`Remove ${g.name || 'this recipient'} from the gift list?`)) return;
    await fetch(`/api/gifts?id=${g.id}`, { method: 'DELETE' });
    setRows(rs => rs.filter(r => r.id !== g.id));
  }

  const orderedN = rows.filter(r => r.ordered).length;
  const mailedN = rows.filter(r => r.mailed).length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="px-8 py-5 bg-white border-b border-border flex items-center justify-between gap-4 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="font-spectral text-[23px] font-semibold text-text-primary">🎁 Gift Tracker</h1>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#f6ecef] text-[#6e2b3e] border border-[#e0b9c6]">Private · not shared yet</span>
          </div>
          <p className="text-sm text-text-muted mt-0.5">Clients &amp; vendors for holiday gifts — {rows.length} recipient{rows.length === 1 ? '' : 's'} · {orderedN} ordered · {mailedN} mailed</p>
        </div>
        <button onClick={addRow} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark">+ Add recipient</button>
      </header>

      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="bg-white border border-border rounded-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1080px]">
              <thead className="bg-[#f1ece3]">
                <tr>{['Name', 'Relationship / Company', 'Address', 'Phone', 'Tier', 'Ordered', 'What was purchased', 'Mailed', ''].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-text-secondary whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {rows.map((g, i) => (
                  <tr key={g.id} className="border-t border-[#f1ece3] align-top" style={{ background: i % 2 ? '#faf8f4' : '#fff' }}>
                    <td className="px-3 py-2 min-w-[150px]"><input value={g.name} onChange={e => setLocal(g.id, { name: e.target.value })} onBlur={e => save(g.id, { name: e.target.value })} placeholder="Name" className={input + ' font-semibold text-text-primary'} /></td>
                    <td className="px-3 py-2 min-w-[150px]"><input value={g.relationship} onChange={e => setLocal(g.id, { relationship: e.target.value })} onBlur={e => save(g.id, { relationship: e.target.value })} placeholder="Relationship / Company" className={input} /></td>
                    <td className="px-3 py-2 min-w-[220px]"><textarea value={g.address} onChange={e => setLocal(g.id, { address: e.target.value })} onBlur={e => save(g.id, { address: e.target.value })} rows={2} placeholder="Address" className={input + ' resize-y leading-snug'} /></td>
                    <td className="px-3 py-2 min-w-[120px]"><input value={g.phone} onChange={e => setLocal(g.id, { phone: e.target.value })} onBlur={e => save(g.id, { phone: e.target.value })} placeholder="—" className={input} /></td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <select value={g.tier} onChange={e => edit(g.id, { tier: e.target.value })}
                        className={`text-xs font-bold px-2 py-1 rounded-full border cursor-pointer focus:outline-none ${TIER_STYLE[g.tier] || 'bg-white text-text-muted border-border-light'}`}>
                        {TIERS.map(t => <option key={t} value={t}>{t || '—'}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-center"><input type="checkbox" checked={g.ordered} onChange={e => edit(g.id, { ordered: e.target.checked })} className="w-4 h-4 accent-[#2f7d5b]" /></td>
                    <td className="px-3 py-2 min-w-[200px]"><input value={g.ordered_note} onChange={e => setLocal(g.id, { ordered_note: e.target.value })} onBlur={e => save(g.id, { ordered_note: e.target.value })} placeholder="e.g. wine basket, gift card…" className={input} /></td>
                    <td className="px-3 py-2 text-center"><input type="checkbox" checked={g.mailed} onChange={e => edit(g.id, { mailed: e.target.checked })} className="w-4 h-4 accent-[#2f7d5b]" /></td>
                    <td className="px-3 py-2 text-right whitespace-nowrap"><button onClick={() => remove(g)} className="text-xs font-semibold text-litred-alt border border-border-light px-2 py-1 rounded-ctrl hover:bg-[#fdeaea]">Delete</button></td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={9} className="px-3 py-8 text-center text-text-muted">No recipients yet — click “+ Add recipient”.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="mt-3">
          <button onClick={addRow} className="text-sm font-semibold text-ink border border-dashed border-border-light px-4 py-2 rounded-ctrl hover:bg-canvas w-full">+ Add recipient</button>
        </div>
      </div>
    </div>
  );
}

'use client';
import { useState } from 'react';
import clsx from 'clsx';
import { useToast } from '@/components/Toast';

interface Delivery {
  id: string; supplier: string; scheduled_date: string | null; delivered_date: string | null;
  status: string; quantity: string; notes: string; sort_order?: number;
}

const SUPPLIERS = ['Primo', 'Culligan'];
const STATUSES = ['Scheduled', 'Pending', 'Delivered', 'Missed'];
const STATUS_STYLE: Record<string, string> = {
  Scheduled: 'bg-[#e9f0f5] text-[#3f6b8a] border-[#c5d8e6]',
  Pending: 'bg-[#f7efe1] text-[#b07d2a] border-[#e0c48a]',
  Delivered: 'bg-[#eef5f1] text-[#2f7d5b] border-[#bfe0cc]',
  Missed: 'bg-[#f6ecef] text-[#6e2b3e] border-[#e0b9c6]',
};

function fmtDate(s: string | null) {
  if (!s) return '';
  try { return new Date(s + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return s; }
}

export default function WaterClient({ initialRows }: { initialRows: Delivery[] }) {
  const { showToast } = useToast();
  const [rows, setRows] = useState<Delivery[]>(initialRows);
  const input = 'w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted/60 rounded-md px-2 py-1.5 border border-transparent transition-colors hover:border-border-light focus:outline-none focus:bg-white focus:border-ink/40 focus:ring-1 focus:ring-ink/20';

  const setLocal = (id: string, patch: Partial<Delivery>) => setRows(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r));
  async function save(id: string, patch: Partial<Delivery>) {
    await fetch('/api/water', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...patch }) });
  }
  function edit(id: string, patch: Partial<Delivery>) { setLocal(id, patch); save(id, patch); }

  async function addRow(supplier = '') {
    const res = await fetch('/api/water', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ supplier, status: 'Scheduled', sort_order: Date.now() }) });
    const { row } = await res.json(); if (row) setRows(rs => [...rs, row]);
  }
  async function remove(d: Delivery) {
    if (!confirm(`Remove this ${d.supplier || 'water'} delivery entry?`)) return;
    await fetch(`/api/water?id=${d.id}`, { method: 'DELETE' });
    setRows(rs => rs.filter(r => r.id !== d.id));
    showToast('Delivery removed');
  }

  const byStatus = (s: string) => rows.filter(r => (r.status || 'Scheduled') === s).length;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-canvas">
      <header className="px-8 py-5 bg-white border-b border-border flex items-center justify-between gap-4 flex-shrink-0">
        <div>
          <h1 className="font-spectral text-[23px] font-semibold text-text-primary">💧 Water Delivery</h1>
          <p className="text-sm text-text-muted mt-0.5">Track supplier delivery schedules &amp; status</p>
        </div>
        <button onClick={() => addRow()} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark shadow-sm">+ Add delivery</button>
      </header>

      <div className="flex-1 overflow-auto px-8 py-6">
        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-4 mb-6 max-w-3xl">
          {(['Scheduled', 'Pending', 'Delivered', 'Missed'] as const).map(s => (
            <div key={s} className="bg-white border border-border rounded-card px-4 py-3 shadow-sm">
              <div className="text-[10px] font-bold uppercase tracking-wide text-text-muted">{s}</div>
              <div className="text-2xl font-bold text-text-primary mt-0.5">{byStatus(s)}</div>
            </div>
          ))}
        </div>

        {/* Quick add per supplier */}
        <div className="flex items-center gap-2 mb-4 flex-wrap text-xs">
          <span className="text-text-muted font-semibold">Quick add for:</span>
          {SUPPLIERS.map(s => (
            <button key={s} onClick={() => addRow(s)} className="border border-border-light rounded-full px-3 py-1 font-semibold text-text-secondary hover:border-ink/40 hover:bg-white">+ {s}</button>
          ))}
        </div>

        <div className="bg-white border border-border rounded-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-separate border-spacing-0" style={{ minWidth: 1040 }}>
              <colgroup>
                <col style={{ width: 240 }} />
                <col style={{ width: 170 }} />
                <col style={{ width: 150 }} />
                <col style={{ width: 170 }} />
                <col style={{ width: 130 }} />
                <col style={{ width: 'auto' }} />
                <col style={{ width: 56 }} />
              </colgroup>
              <thead>
                <tr style={{ background: 'linear-gradient(180deg,#243449 0%,#1b2a3d 100%)' }}>
                  {['Supplier', 'Scheduled date', 'Status', 'Delivered date', 'Quantity', 'Notes', ''].map((h, i) => (
                    <th key={h + i} className="text-left px-3.5 py-3 text-[10.5px] font-bold uppercase tracking-wider text-[#c9d3e0] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-text-muted">No deliveries yet — click “+ Add delivery”.</td></tr>
                ) : rows.map((d, i) => {
                  const status = d.status || 'Scheduled';
                  return (
                    <tr key={d.id} className={clsx('border-b border-border-light', i % 2 ? 'bg-canvas/40' : 'bg-white')}>
                      <td className="px-2.5 py-2 align-top">
                        <select value={d.supplier ?? ''} onChange={e => edit(d.id, { supplier: e.target.value })} className={clsx(input, 'cursor-pointer')}>
                          <option value="">Select supplier…</option>
                          {SUPPLIERS.map(s => <option key={s} value={s}>{s}</option>)}
                          {d.supplier && !SUPPLIERS.includes(d.supplier) && <option value={d.supplier}>{d.supplier}</option>}
                        </select>
                      </td>
                      <td className="px-2.5 py-2 align-top">
                        <input type="date" value={(d.scheduled_date ?? '').slice(0, 10)} onChange={e => edit(d.id, { scheduled_date: e.target.value })} className={input} />
                      </td>
                      <td className="px-2.5 py-2 align-top">
                        <select value={status} onChange={e => {
                          const patch: Partial<Delivery> = { status: e.target.value };
                          if (e.target.value === 'Delivered' && !d.delivered_date) patch.delivered_date = new Date().toISOString().slice(0, 10);
                          edit(d.id, patch);
                        }}
                          className={clsx('text-xs font-semibold px-2.5 py-1 rounded-full border cursor-pointer focus:outline-none', STATUS_STYLE[status] ?? STATUS_STYLE.Scheduled)}>
                          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="px-2.5 py-2 align-top">
                        <input type="date" value={(d.delivered_date ?? '').slice(0, 10)} onChange={e => edit(d.id, { delivered_date: e.target.value })} className={input} />
                      </td>
                      <td className="px-2.5 py-2 align-top">
                        <input value={d.quantity ?? ''} placeholder="e.g. 5 gal ×3" onChange={e => setLocal(d.id, { quantity: e.target.value })} onBlur={e => save(d.id, { quantity: e.target.value })} className={input} />
                      </td>
                      <td className="px-2.5 py-2 align-top">
                        <textarea value={d.notes ?? ''} placeholder="Notes…" rows={1} onChange={e => setLocal(d.id, { notes: e.target.value })} onBlur={e => save(d.id, { notes: e.target.value })}
                          className={clsx(input, 'resize-y min-h-[34px]')} style={{ fieldSizing: 'content' } as any} />
                      </td>
                      <td className="px-2 py-2 align-top text-center">
                        <button onClick={() => remove(d)} title="Remove" className="text-text-muted hover:text-litred-alt text-sm">✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

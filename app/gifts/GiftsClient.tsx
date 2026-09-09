'use client';
import { useState } from 'react';
import clsx from 'clsx';
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
const TIER_LABEL: Record<string, string> = { '$': 'Modest', '$$': 'Mid', '$$$': 'Premium' };

function initial(name: string) {
  return (name.trim()[0] || '?').toUpperCase();
}

export default function GiftsClient({ initialRows }: { initialRows: Gift[] }) {
  const { showToast } = useToast();
  const [rows, setRows] = useState<Gift[]>(initialRows);
  const input =
    'w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted/60 rounded-md px-2 py-1.5 border border-transparent transition-colors hover:border-border-light focus:outline-none focus:bg-white focus:border-ink/40 focus:ring-1 focus:ring-ink/20';

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
    showToast('Recipient removed');
  }

  const orderedN = rows.filter(r => r.ordered).length;
  const mailedN = rows.filter(r => r.mailed).length;
  const total = rows.length;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  // Small pill toggle used for the Ordered / Mailed columns.
  function StatusToggle({ on, onClick, doneLabel, todoLabel, tone }: {
    on: boolean; onClick: () => void; doneLabel: string; todoLabel: string; tone: 'green' | 'gold';
  }) {
    const onStyle = tone === 'green'
      ? 'bg-[#eaf4ee] text-[#2f7d5b] border-[#bfe0cc]'
      : 'bg-[#f6efe0] text-[#a97d24] border-[#e3cd97]';
    return (
      <button
        onClick={onClick}
        className={clsx(
          'inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors whitespace-nowrap',
          on ? onStyle : 'bg-white text-text-muted border-border-light hover:border-ink/30 hover:text-text-secondary'
        )}
      >
        <span className="text-[13px] leading-none">{on ? '✓' : '○'}</span>
        {on ? doneLabel : todoLabel}
      </button>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-canvas">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="px-8 py-5 bg-white border-b border-border flex items-center justify-between gap-4 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="font-spectral text-[23px] font-semibold text-text-primary">🎁 Gift Tracker</h1>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#f6ecef] text-[#6e2b3e] border border-[#e0b9c6]">Private · not shared yet</span>
          </div>
          <p className="text-sm text-text-muted mt-0.5">Clients &amp; vendors for holiday gifts</p>
        </div>
        <button onClick={addRow} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark shadow-sm">+ Add recipient</button>
      </header>

      <div className="flex-1 overflow-auto px-8 py-6">
        {/* ── Stat cards ───────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4 mb-6 max-w-2xl">
          <StatCard label="Recipients" value={total} accent="#c9a24a" />
          <StatCard label="Gifts ordered" value={orderedN} sub={`${pct(orderedN)}%`} accent="#2f7d5b" progress={pct(orderedN)} />
          <StatCard label="Gifts mailed" value={mailedN} sub={`${pct(mailedN)}%`} accent="#1b2a3d" progress={pct(mailedN)} />
        </div>

        {/* ── Table ────────────────────────────────────────────── */}
        <div className="bg-white border border-border rounded-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-separate border-spacing-0" style={{ minWidth: 1180 }}>
              <colgroup>
                <col style={{ width: 210 }} />
                <col style={{ width: 160 }} />
                <col style={{ width: 250 }} />
                <col style={{ width: 140 }} />
                <col style={{ width: 108 }} />
                <col style={{ width: 128 }} />
                <col style={{ width: 220 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 56 }} />
              </colgroup>
              <thead>
                <tr style={{ background: 'linear-gradient(180deg,#243449 0%,#1b2a3d 100%)' }}>
                  {['Recipient', 'Relationship / Company', 'Address', 'Phone', 'Tier', 'Ordered', 'What was purchased', 'Mailed', ''].map((h, idx) => (
                    <th
                      key={h + idx}
                      className={clsx(
                        'text-left px-3.5 py-3 text-[10.5px] font-bold uppercase tracking-wider text-[#c9d3e0] whitespace-nowrap',
                        idx === 0 && 'sticky left-0 z-10',
                        (idx === 5 || idx === 7) && 'text-center'
                      )}
                      style={idx === 0 ? { background: '#1e2d40' } : undefined}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((g, i) => {
                  const zebra = i % 2 ? '#faf9f6' : '#ffffff';
                  const addrLines = Math.max(2, (g.address || '').split('\n').length);
                  return (
                    <tr key={g.id} className="group align-middle">
                      {/* Name — sticky, with initial chip */}
                      <td className="px-3.5 py-2.5 border-b border-[#f0ece4] sticky left-0 z-10" style={{ background: zebra }}>
                        <div className="flex items-center gap-2.5">
                          <span
                            className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold text-white"
                            style={{ background: 'linear-gradient(135deg,#c9a24a,#b6892f)' }}
                          >
                            {initial(g.name)}
                          </span>
                          <input value={g.name} onChange={e => setLocal(g.id, { name: e.target.value })} onBlur={e => save(g.id, { name: e.target.value })} placeholder="Name" className={input + ' font-semibold'} />
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5 border-b border-[#f0ece4]" style={{ background: zebra }}>
                        <input value={g.relationship} onChange={e => setLocal(g.id, { relationship: e.target.value })} onBlur={e => save(g.id, { relationship: e.target.value })} placeholder="—" className={input} />
                      </td>
                      <td className="px-3.5 py-2.5 border-b border-[#f0ece4]" style={{ background: zebra }}>
                        <textarea
                          value={g.address}
                          onChange={e => setLocal(g.id, { address: e.target.value })}
                          onBlur={e => save(g.id, { address: e.target.value })}
                          rows={addrLines}
                          placeholder="Street&#10;City, ST ZIP"
                          className={input + ' resize-none leading-snug overflow-hidden'}
                        />
                      </td>
                      <td className="px-3.5 py-2.5 border-b border-[#f0ece4]" style={{ background: zebra }}>
                        <input value={g.phone} onChange={e => setLocal(g.id, { phone: e.target.value })} onBlur={e => save(g.id, { phone: e.target.value })} placeholder="—" className={input + ' tabular-nums'} />
                      </td>
                      {/* Tier */}
                      <td className="px-3.5 py-2.5 border-b border-[#f0ece4] whitespace-nowrap" style={{ background: zebra }}>
                        <select
                          value={g.tier}
                          onChange={e => edit(g.id, { tier: e.target.value })}
                          title={TIER_LABEL[g.tier] || 'No tier set'}
                          className={clsx(
                            'text-xs font-bold px-2.5 py-1 rounded-full border cursor-pointer focus:outline-none focus:ring-1 focus:ring-ink/20',
                            TIER_STYLE[g.tier] || 'bg-white text-text-muted border-border-light'
                          )}
                        >
                          {TIERS.map(t => <option key={t} value={t}>{t || '—'}</option>)}
                        </select>
                      </td>
                      {/* Ordered */}
                      <td className="px-3.5 py-2.5 border-b border-[#f0ece4] text-center" style={{ background: zebra }}>
                        <StatusToggle on={g.ordered} onClick={() => edit(g.id, { ordered: !g.ordered })} doneLabel="Ordered" todoLabel="Mark" tone="green" />
                      </td>
                      {/* What purchased */}
                      <td className="px-3.5 py-2.5 border-b border-[#f0ece4]" style={{ background: zebra }}>
                        <input value={g.ordered_note} onChange={e => setLocal(g.id, { ordered_note: e.target.value })} onBlur={e => save(g.id, { ordered_note: e.target.value })} placeholder="e.g. wine basket, gift card…" className={input} />
                      </td>
                      {/* Mailed */}
                      <td className="px-3.5 py-2.5 border-b border-[#f0ece4] text-center" style={{ background: zebra }}>
                        <StatusToggle on={g.mailed} onClick={() => edit(g.id, { mailed: !g.mailed })} doneLabel="Mailed" todoLabel="Mark" tone="gold" />
                      </td>
                      {/* Delete */}
                      <td className="px-2 py-2.5 border-b border-[#f0ece4] text-center" style={{ background: zebra }}>
                        <button
                          onClick={() => remove(g)}
                          title="Remove recipient"
                          className="w-7 h-7 inline-flex items-center justify-center rounded-md text-text-muted opacity-0 group-hover:opacity-100 hover:bg-[#fdeaea] hover:text-litred-alt transition"
                        >
                          🗑
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr><td colSpan={9} className="px-3 py-12 text-center text-text-muted border-b border-[#f0ece4]">No recipients yet — click “+ Add recipient”.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <button onClick={addRow} className="w-full text-sm font-semibold text-ink py-3 hover:bg-canvas border-t border-border transition-colors">
            + Add recipient
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, accent, progress }: {
  label: string; value: number; sub?: string; accent: string; progress?: number;
}) {
  return (
    <div className="bg-white border border-border rounded-card px-4 py-3 shadow-sm">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{label}</span>
        {sub && <span className="text-xs font-semibold" style={{ color: accent }}>{sub}</span>}
      </div>
      <div className="text-2xl font-bold text-text-primary mt-0.5" style={{ fontFeatureSettings: '"tnum"' }}>{value}</div>
      {typeof progress === 'number' && (
        <div className="mt-2 h-1.5 rounded-full bg-[#eee8dd] overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: accent }} />
        </div>
      )}
    </div>
  );
}

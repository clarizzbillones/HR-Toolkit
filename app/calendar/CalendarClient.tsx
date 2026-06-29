'use client';
import { useState, useEffect } from 'react';
import { useToast } from '@/components/Toast';

interface CalRow { id: string; name: string; role: string; dept: string; updated: boolean; window: string | null; }
interface CalData {
  connected: boolean; updatedCount: number; totalCount: number; outTodayCount: number; missingCount: number; rows: CalRow[];
}

export default function CalendarClient() {
  const { showToast } = useToast();
  const [data, setData] = useState<CalData | null>(null);
  const [nudging, setNudging] = useState(false);
  const [filter, setFilter] = useState<'all' | 'missing' | 'logged'>('all');

  useEffect(() => {
    fetch('/api/calendar').then(r => r.json()).then(setData);
  }, []);

  async function nudge() {
    setNudging(true);
    const res = await fetch('/api/calendar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'nudge' }) });
    const { message } = await res.json();
    showToast(message);
    setNudging(false);
  }

  const rows = data?.rows.filter(r =>
    filter === 'all' ? true : filter === 'missing' ? !r.updated : r.updated
  ) ?? [];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="flex items-center gap-4 px-8 py-5 bg-white border-b border-border flex-shrink-0 flex-wrap">
        <div>
          <h1 className="font-spectral text-[23px] font-semibold text-text-primary">Outlook Calendar Sync</h1>
          <p className="text-sm text-text-muted mt-0.5">Cross-reference employee PTO with Outlook calendar</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {data?.connected ? (
            <span className="flex items-center gap-1.5 text-sm font-semibold text-[#2f7d5b] bg-[#eef5f1] px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-[#2f7d5b]" /> Microsoft 365 Connected
            </span>
          ) : (
            <a href="/api/auth/signin" className="bg-[#0F6CBD] text-white text-sm font-semibold px-4 py-2.5 rounded-ctrl hover:opacity-90 transition-opacity flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 21 21" fill="none"><rect x="1" y="1" width="9" height="9" fill="#F25022"/><rect x="11" y="1" width="9" height="9" fill="#7FBA00"/><rect x="1" y="11" width="9" height="9" fill="#00A4EF"/><rect x="11" y="11" width="9" height="9" fill="#FFB900"/></svg>
              Connect Microsoft 365
            </a>
          )}
          <button onClick={nudge} disabled={nudging} className="bg-white border border-border-light text-ink text-sm font-semibold px-4 py-2.5 rounded-ctrl hover:bg-canvas transition-colors disabled:opacity-50">
            {nudging ? 'Sending…' : 'Nudge Missing'}
          </button>
        </div>
      </header>

      {data && (
        <>
          <div className="grid grid-cols-4 gap-4 px-8 py-5 flex-shrink-0">
            {[
              { label: 'Total Staff', value: data.totalCount },
              { label: 'PTO Logged', value: data.updatedCount, color: '#2f7d5b' },
              { label: 'Out Today', value: data.outTodayCount, color: '#3f6b8a' },
              { label: 'Missing', value: data.missingCount, color: '#b0412f' },
            ].map(s => (
              <div key={s.label} className="bg-white border border-border rounded-card px-5 py-4">
                <div className="text-xs font-bold uppercase tracking-wider text-text-muted mb-1">{s.label}</div>
                <div className="text-3xl font-spectral font-semibold" style={{ color: s.color ?? '#1b2230' }}>{s.value}</div>
              </div>
            ))}
          </div>

          <div className="flex gap-1 px-8 pb-4 flex-shrink-0">
            {(['all','logged','missing'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${filter === f ? 'bg-ink text-white' : 'bg-[#f1ece3] text-text-secondary hover:bg-[#e8e3da]'}`}>
                {f === 'all' ? 'All' : f === 'logged' ? 'PTO Logged' : 'Missing'}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-auto px-8 pb-6">
            <div className="bg-white border border-border rounded-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[#f1ece3] border-b border-border">
                  <tr>{['Name','Role','Department','PTO Status','Calendar Window'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-text-secondary">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id} className="border-t border-[#f1ece3] hover:bg-canvas transition-colors">
                      <td className="px-4 py-3 font-medium text-text-primary">{r.name}</td>
                      <td className="px-4 py-3 text-text-secondary">{r.role}</td>
                      <td className="px-4 py-3 text-text-secondary">{r.dept}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.updated ? 'bg-[#eef5f1] text-[#2f7d5b]' : 'bg-[#f7efe1] text-[#b07d2a]'}`}>
                          {r.updated ? 'Logged' : 'Missing'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-muted text-xs">{r.window ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!data && (
        <div className="flex-1 flex items-center justify-center text-text-muted text-sm">Loading…</div>
      )}
    </div>
  );
}

'use client';
import { useState, useEffect } from 'react';
import { useToast } from '@/components/Toast';
import EditGate from '@/components/EditGate';

interface Trip {
  id: string; who: string; detail: string; cost: number | null;
  matter: string | null; status: string; created_at: string;
}

const STATUS_STYLE: Record<string, string> = {
  'Pending': 'bg-[#f7efe1] text-[#b07d2a]',
  'Approved': 'bg-[#eef5f1] text-[#2f7d5b]',
  'On Hold': 'bg-[#e9f0f5] text-[#3f6b8a]',
  'Denied': 'bg-[#fdeaea] text-[#b0412f]',
};

export default function TripsClient({ initialTrips }: { initialTrips: Trip[] }) {
  const { showToast } = useToast();
  const [trips, setTrips] = useState<Trip[]>(initialTrips);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ who: '', detail: '', cost: '', matter: '' });
  const [saving, setSaving] = useState(false);
  const [dashUrl, setDashUrl] = useState('');
  const [linkedUrl, setLinkedUrl] = useState('');
  const [activeTab, setActiveTab] = useState<'local' | 'report' | 'live'>('local');
  const [repYear, setRepYear] = useState<string>('All');
  const [repMonth, setRepMonth] = useState<string>('All');

  useEffect(() => {
    fetch('/api/connections').then(r => r.json()).then(data => {
      if (data.trips_url) { setLinkedUrl(data.trips_url); setDashUrl(data.trips_url); }
    }).catch(() => {});
  }, []);

  async function connectDash() {
    if (!dashUrl) return;
    setLinkedUrl(dashUrl);
    await fetch('/api/connections', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trips_url: dashUrl }) });
    showToast('Dashboard linked');
  }

  async function disconnectDash() {
    setLinkedUrl(''); setDashUrl('');
    setActiveTab('local');
    await fetch('/api/connections', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trips_url: null }) });
    showToast('Disconnected');
  }

  async function submit() {
    if (!form.who || !form.detail) return;
    setSaving(true);
    const res = await fetch('/api/trips', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, cost: form.cost ? Number(form.cost) : null }) });
    const { trip } = await res.json();
    setTrips(prev => [trip, ...prev]);
    setForm({ who: '', detail: '', cost: '', matter: '' });
    setShowAdd(false);
    showToast('Travel request submitted');
    setSaving(false);
  }

  async function updateStatus(id: string, status: string) {
    const res = await fetch(`/api/trips/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    const { trip } = await res.json();
    setTrips(prev => prev.map(t => t.id === id ? trip : t));
    showToast(`Marked ${status}`);
  }

  // ---- Monthly report computations (local data) ----
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const years = Array.from(new Set(trips.map(t => new Date(t.created_at).getFullYear()))).sort((a, b) => b - a);

  const reportTrips = trips.filter(t => {
    const d = new Date(t.created_at);
    if (repYear !== 'All' && d.getFullYear() !== Number(repYear)) return false;
    if (repMonth !== 'All' && d.getMonth() !== Number(repMonth)) return false;
    return true;
  });

  const totalSpend = reportTrips.reduce((s, t) => s + (t.cost ?? 0), 0);
  const approvedCount = reportTrips.filter(t => t.status === 'Approved').length;
  const pendingCount = reportTrips.filter(t => t.status === 'Pending').length;

  const byMonth = (() => {
    const m = new Map<string, { count: number; spend: number }>();
    for (const t of reportTrips) {
      const d = new Date(t.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const cur = m.get(key) ?? { count: 0, spend: 0 };
      cur.count += 1; cur.spend += t.cost ?? 0;
      m.set(key, cur);
    }
    return [...m.entries()].sort(([a], [b]) => b.localeCompare(a));
  })();

  const byClient = (() => {
    const m = new Map<string, { count: number; spend: number }>();
    for (const t of reportTrips) {
      const key = t.matter?.trim() || 'Unassigned';
      const cur = m.get(key) ?? { count: 0, spend: 0 };
      cur.count += 1; cur.spend += t.cost ?? 0;
      m.set(key, cur);
    }
    return [...m.entries()].sort((a, b) => b[1].spend - a[1].spend);
  })();

  function fmt$(n: number) { return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

  function exportReportCSV() {
    const rows = [['Employee', 'Travel Details', 'Matter/Client', 'Est. Cost', 'Status', 'Date']];
    for (const t of reportTrips) {
      rows.push([
        t.who, t.detail, t.matter ?? '', t.cost != null ? String(t.cost) : '',
        t.status, new Date(t.created_at).toLocaleDateString('en-US'),
      ]);
    }
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const scope = `${repYear === 'All' ? 'all' : repYear}${repMonth === 'All' ? '' : '-' + MONTHS[Number(repMonth)]}`;
    a.download = `trip-report-${scope}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('Report exported');
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="flex items-center gap-4 px-8 py-5 bg-white border-b border-border flex-shrink-0">
        <div>
          <h1 className="font-spectral text-[23px] font-semibold text-text-primary">Trip Help Desk</h1>
          <p className="text-sm text-text-muted mt-0.5">Travel requests from attorneys and staff</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center bg-[#f1ece3] rounded-ctrl p-0.5">
            <button
              onClick={() => setActiveTab('local')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-ctrl transition-colors ${activeTab === 'local' ? 'bg-white text-ink shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
            >Local view</button>
            <button
              onClick={() => setActiveTab('report')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-ctrl transition-colors flex items-center gap-1.5 ${activeTab === 'report' ? 'bg-white text-ink shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
            >📊 Monthly report</button>
            {linkedUrl && (
              <button
                onClick={() => setActiveTab('live')}
                className={`text-xs font-semibold px-3 py-1.5 rounded-ctrl transition-colors flex items-center gap-1.5 ${activeTab === 'live' ? 'bg-white text-ink shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#2f7d5b]" />
                TripDesk Live
              </button>
            )}
          </div>
          <EditGate>
            <button onClick={() => setShowAdd(v => !v)} className="bg-white border border-border-light text-ink text-sm font-semibold px-4 py-2.5 rounded-ctrl hover:bg-canvas transition-colors">
              ＋ New Request
            </button>
          </EditGate>
        </div>
      </header>

      {/* Live TripDesk iframe view */}
      {activeTab === 'live' && linkedUrl ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-2 bg-[#f1ece3] border-b border-border flex-shrink-0">
            <span className="w-2 h-2 rounded-full bg-[#2f7d5b] shrink-0" />
            <span className="text-xs text-text-muted truncate flex-1">{linkedUrl}</span>
            <a href={linkedUrl} target="_blank" rel="noopener noreferrer"
              className="shrink-0 text-xs font-semibold text-text-secondary hover:text-ink border border-border-light bg-white px-3 py-1 rounded-ctrl">
              ↗ Open in new tab
            </a>
            <button onClick={disconnectDash}
              className="shrink-0 text-xs font-semibold text-text-muted border border-border-light bg-white px-3 py-1 rounded-ctrl hover:text-litred-alt">
              Disconnect
            </button>
          </div>
          <div className="flex-1 relative">
            <iframe
              src={linkedUrl}
              className="w-full h-full border-0"
              title="TripDesk Live Dashboard"
              allow="clipboard-read; clipboard-write"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            />
          </div>
        </div>
      ) : activeTab === 'report' ? (
        <div className="flex-1 overflow-auto px-8 py-6">
          {/* Filters */}
          <div className="flex items-center gap-3 mb-5 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-widest text-text-muted">Travel report</span>
            <div className="flex items-center gap-2 ml-2">
              <label className="text-xs text-text-muted">Year</label>
              <select value={repYear} onChange={e => setRepYear(e.target.value)}
                className="border border-border-light rounded-ctrl px-2 py-1.5 text-sm bg-white focus:outline-none focus:border-ink">
                <option value="All">All</option>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <label className="text-xs text-text-muted ml-1">Month</label>
              <select value={repMonth} onChange={e => setRepMonth(e.target.value)}
                className="border border-border-light rounded-ctrl px-2 py-1.5 text-sm bg-white focus:outline-none focus:border-ink">
                <option value="All">All</option>
                {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
              {(repYear !== 'All' || repMonth !== 'All') && (
                <button onClick={() => { setRepYear('All'); setRepMonth('All'); }}
                  className="text-xs font-semibold text-text-muted hover:text-text-primary">Reset</button>
              )}
            </div>
            <div className="ml-auto flex items-center gap-3">
              <span className="text-xs text-text-muted">{reportTrips.length} trips</span>
              <button onClick={exportReportCSV}
                className="text-xs font-semibold text-ink border border-border-light bg-white px-3 py-1.5 rounded-ctrl hover:bg-canvas">⬇ Export CSV</button>
            </div>
          </div>

          {/* KPI tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white border border-border rounded-card p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Trips</div>
              <div className="text-3xl font-spectral font-semibold text-text-primary mt-1">{reportTrips.length}</div>
              <div className="text-xs text-text-muted mt-0.5">In range</div>
            </div>
            <div className="bg-white border border-border rounded-card p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Approved</div>
              <div className="text-3xl font-spectral font-semibold text-[#2f7d5b] mt-1">{approvedCount}</div>
              <div className="text-xs text-text-muted mt-0.5">Confirmed</div>
            </div>
            <div className="bg-white border border-border rounded-card p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Pending</div>
              <div className="text-3xl font-spectral font-semibold text-[#b07d2a] mt-1">{pendingCount}</div>
              <div className="text-xs text-text-muted mt-0.5">Awaiting action</div>
            </div>
            <div className="bg-white border border-border rounded-card p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Total spend</div>
              <div className="text-3xl font-spectral font-semibold text-ink mt-1">{fmt$(totalSpend)}</div>
              <div className="text-xs text-text-muted mt-0.5">{reportTrips.length} requests</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Spend by month */}
            <div className="bg-white border border-border rounded-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border text-[10px] font-bold uppercase tracking-widest text-text-muted">Spend by month</div>
              <table className="w-full text-sm">
                <thead className="bg-[#f1ece3]"><tr>
                  {['Month', 'Trips', 'Total'].map(h => <th key={h} className="text-left px-4 py-2 text-xs font-bold uppercase tracking-wider text-text-secondary">{h}</th>)}
                </tr></thead>
                <tbody>
                  {byMonth.map(([key, v]) => {
                    const [y, m] = key.split('-');
                    return (
                      <tr key={key} className="border-t border-[#f1ece3]">
                        <td className="px-4 py-2.5 font-medium text-text-primary">{MONTHS[Number(m) - 1]} {y}</td>
                        <td className="px-4 py-2.5 text-text-muted">{v.count}</td>
                        <td className="px-4 py-2.5 text-text-secondary">{fmt$(v.spend)}</td>
                      </tr>
                    );
                  })}
                  {byMonth.length === 0 && <tr><td colSpan={3} className="px-4 py-6 text-center text-text-muted">No data</td></tr>}
                </tbody>
              </table>
            </div>

            {/* Spend by client */}
            <div className="bg-white border border-border rounded-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border text-[10px] font-bold uppercase tracking-widest text-text-muted">Spend by client / matter</div>
              <table className="w-full text-sm">
                <thead className="bg-[#f1ece3]"><tr>
                  {['Client / Matter', 'Trips', 'Total'].map(h => <th key={h} className="text-left px-4 py-2 text-xs font-bold uppercase tracking-wider text-text-secondary">{h}</th>)}
                </tr></thead>
                <tbody>
                  {byClient.map(([key, v]) => (
                    <tr key={key} className="border-t border-[#f1ece3]">
                      <td className="px-4 py-2.5 font-medium text-text-primary">{key}</td>
                      <td className="px-4 py-2.5 text-text-muted">{v.count}</td>
                      <td className="px-4 py-2.5 text-text-secondary">{fmt$(v.spend)}</td>
                    </tr>
                  ))}
                  {byClient.length === 0 && <tr><td colSpan={3} className="px-4 py-6 text-center text-text-muted">No data</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Connect bar */}
          {linkedUrl ? (
            <div className="flex items-center gap-3 mx-8 mt-4 px-4 py-3 bg-[#eef5f1] border border-[#c3dfd3] rounded-card text-sm flex-shrink-0">
              <span className="w-2 h-2 rounded-full bg-[#2f7d5b] shrink-0" />
              <span className="text-[#2f7d5b] font-semibold">TripDesk connected</span>
              <span className="text-text-muted truncate">{linkedUrl}</span>
              <button
                onClick={() => setActiveTab('live')}
                className="ml-auto shrink-0 bg-[#2f7d5b] text-white text-xs font-semibold px-3 py-1 rounded-ctrl hover:bg-[#236045]">
                Browse inside ↗
              </button>
              <a href={linkedUrl} target="_blank" rel="noopener noreferrer"
                className="shrink-0 text-xs font-semibold text-text-muted border border-border-light px-3 py-1 rounded-ctrl">Open tab</a>
              <button onClick={disconnectDash}
                className="shrink-0 text-xs font-semibold text-text-muted border border-border-light px-3 py-1 rounded-ctrl hover:text-litred-alt">Disconnect</button>
            </div>
          ) : (
            <div className="flex items-center gap-3 mx-8 mt-4 px-4 py-3 bg-white border border-border rounded-card text-sm flex-shrink-0">
              <span className="text-text-secondary shrink-0">🔗 Link your TripDesk dashboard to browse it here</span>
              <input value={dashUrl} onChange={e => setDashUrl(e.target.value)}
                placeholder="https://trip-desk.lovable.app"
                className="flex-1 max-w-xs border border-border-light rounded-ctrl px-3 py-1.5 text-sm focus:outline-none focus:border-ink" />
              <button onClick={connectDash}
                className="bg-ink text-white text-xs font-semibold px-3 py-1.5 rounded-ctrl hover:bg-ink-dark">Connect</button>
            </div>
          )}

          {showAdd && (
            <div className="px-8 py-5 border-b border-border bg-[#fbf7ee] flex-shrink-0">
              <div className="grid grid-cols-2 gap-4 max-w-2xl mb-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Employee / Traveler</label>
                  <input value={form.who} onChange={e => setForm(p => ({ ...p, who: e.target.value }))}
                    className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Travel Details / Destination</label>
                  <input value={form.detail} onChange={e => setForm(p => ({ ...p, detail: e.target.value }))}
                    className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Estimated Cost ($)</label>
                  <input type="number" value={form.cost} onChange={e => setForm(p => ({ ...p, cost: e.target.value }))}
                    className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Matter / Client</label>
                  <input value={form.matter} onChange={e => setForm(p => ({ ...p, matter: e.target.value }))}
                    className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={submit} disabled={saving} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark disabled:opacity-50">
                  {saving ? 'Submitting…' : 'Submit Request'}
                </button>
                <button onClick={() => setShowAdd(false)} className="text-sm text-text-muted hover:text-text-primary px-3">Cancel</button>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-auto px-8 py-6">
            <div className="bg-white border border-border rounded-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[#f1ece3] border-b border-border">
                  <tr>{['Employee','Travel Details','Matter','Est. Cost','Status','Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-text-secondary">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {trips.map(t => (
                    <tr key={t.id} className="border-t border-[#f1ece3] hover:bg-canvas transition-colors">
                      <td className="px-4 py-3 font-medium text-text-primary">{t.who}</td>
                      <td className="px-4 py-3 text-text-secondary">{t.detail}</td>
                      <td className="px-4 py-3 text-text-muted">{t.matter ?? '—'}</td>
                      <td className="px-4 py-3 text-text-muted">{t.cost != null ? `$${t.cost.toLocaleString()}` : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[t.status] ?? 'bg-[#f1ece3] text-text-muted'}`}>{t.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        {t.status === 'Pending' && (
                          <div className="flex gap-2">
                            <button onClick={() => updateStatus(t.id, 'Approved')} className="text-xs font-semibold text-[#2f7d5b] hover:underline">Approve</button>
                            <button onClick={() => updateStatus(t.id, 'On Hold')} className="text-xs font-semibold text-[#3f6b8a] hover:underline">Hold</button>
                            <button onClick={() => updateStatus(t.id, 'Denied')} className="text-xs font-semibold text-[#b0412f] hover:underline">Deny</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {trips.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-text-muted">No travel requests</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

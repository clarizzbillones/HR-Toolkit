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
  const [activeTab, setActiveTab] = useState<'local' | 'live'>('local');

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

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="flex items-center gap-4 px-8 py-5 bg-white border-b border-border flex-shrink-0">
        <div>
          <h1 className="font-spectral text-[23px] font-semibold text-text-primary">Trip Help Desk</h1>
          <p className="text-sm text-text-muted mt-0.5">Travel requests from attorneys and staff</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {linkedUrl && (
            <div className="flex items-center bg-[#f1ece3] rounded-ctrl p-0.5">
              <button
                onClick={() => setActiveTab('local')}
                className={`text-xs font-semibold px-3 py-1.5 rounded-ctrl transition-colors ${activeTab === 'local' ? 'bg-white text-ink shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
              >Local view</button>
              <button
                onClick={() => setActiveTab('live')}
                className={`text-xs font-semibold px-3 py-1.5 rounded-ctrl transition-colors flex items-center gap-1.5 ${activeTab === 'live' ? 'bg-white text-ink shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#2f7d5b]" />
                TripDesk Live
              </button>
            </div>
          )}
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

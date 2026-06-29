'use client';
import { useState } from 'react';
import { useToast } from '@/components/Toast';

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
          <p className="text-sm text-text-muted mt-0.5">{trips.filter(t => t.status === 'Pending').length} pending travel requests</p>
        </div>
        <button onClick={() => setShowAdd(v => !v)} className="ml-auto bg-white border border-border-light text-ink text-sm font-semibold px-4 py-2.5 rounded-ctrl hover:bg-canvas transition-colors">
          ＋ New Request
        </button>
      </header>

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
    </div>
  );
}

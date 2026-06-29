'use client';
import { useState, useEffect } from 'react';
import { useToast } from '@/components/Toast';

interface CalRow { id: string; name: string; role: string; dept: string; updated: boolean; window: string | null; }
interface CalData {
  connected: boolean; updatedCount: number; totalCount: number; outTodayCount: number; missingCount: number; rows: CalRow[];
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = ['#213044','#2f7d5b','#3f6b8a','#b07d2a','#c8102e','#26405c'];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}

export default function CalendarClient() {
  const { showToast } = useToast();
  const [data, setData] = useState<CalData | null>(null);
  const [nudging, setNudging] = useState(false);
  const [syncTime] = useState(() => new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }));
  const [disconnected, setDisconnected] = useState(false);

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

  const connected = data?.connected && !disconnected;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="flex items-center gap-4 px-8 py-5 bg-white border-b border-border flex-shrink-0">
        <div>
          <h1 className="font-spectral text-[23px] font-semibold text-text-primary">Outlook Calendar — PTO Sync</h1>
          <p className="text-sm text-text-muted mt-0.5">Who has logged their PTO on the shared firm calendar</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {connected ? (
            <>
              <div className="flex items-center gap-2 border border-[#c3dfd3] bg-[#eef5f1] text-[#2f7d5b] text-sm font-semibold px-3 py-2 rounded-ctrl">
                <span className="w-2 h-2 rounded-full bg-[#2f7d5b]" />
                Connected · synced {syncTime}
              </div>
              <button onClick={() => setDisconnected(true)}
                className="border border-border-light text-sm font-semibold text-text-secondary px-4 py-2 rounded-ctrl hover:bg-canvas transition-colors">
                Disconnect
              </button>
            </>
          ) : (
            <a href="/api/auth/signin"
              className="bg-[#0F6CBD] text-white text-sm font-semibold px-4 py-2.5 rounded-ctrl hover:opacity-90 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 21 21" fill="none"><rect x="1" y="1" width="9" height="9" fill="#F25022"/><rect x="11" y="1" width="9" height="9" fill="#7FBA00"/><rect x="1" y="11" width="9" height="9" fill="#00A4EF"/><rect x="11" y="11" width="9" height="9" fill="#FFB900"/></svg>
              Connect Microsoft 365
            </a>
          )}
        </div>
      </header>

      {!data && <div className="flex-1 flex items-center justify-center text-text-muted text-sm">Loading…</div>}

      {data && (
        <>
          <div className="grid grid-cols-3 gap-4 px-8 py-5 flex-shrink-0">
            <div className="bg-white border border-border rounded-card px-5 py-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2">UPDATED</div>
              <div className="font-spectral text-3xl font-semibold text-[#2f7d5b]">
                {data.updatedCount}<span className="text-xl text-text-muted">/{data.totalCount}</span>
              </div>
            </div>
            <div className="bg-white border border-border rounded-card px-5 py-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2">OUT TODAY</div>
              <div className="font-spectral text-3xl font-semibold text-text-primary">{data.outTodayCount}</div>
            </div>
            <div className="bg-white border border-border rounded-card px-5 py-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2">MISSING</div>
              <div className="font-spectral text-3xl font-semibold text-[#b0412f]">{data.missingCount}</div>
            </div>
          </div>

          <div className="flex-1 overflow-auto px-8 pb-6">
            <div className="bg-white border border-border rounded-card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gold-muted">CALENDAR STATUS BY EMPLOYEE</span>
                <button onClick={nudge} disabled={nudging || data.missingCount === 0}
                  className="bg-ink text-white text-xs font-semibold px-3 py-1.5 rounded-ctrl hover:bg-ink-dark disabled:opacity-40 transition-colors">
                  {nudging ? 'Sending…' : `Nudge ${data.missingCount} missing`}
                </button>
              </div>
              <div className="divide-y divide-[#f1ece3]">
                {data.rows.map(r => (
                  <div key={r.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-canvas transition-colors">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ background: avatarColor(r.name) }}>
                      {initials(r.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-text-primary leading-tight">{r.name}</div>
                      <div className="text-xs text-text-muted">{r.role}</div>
                    </div>
                    <div className="ml-auto flex items-center gap-6">
                      <span className="text-sm text-text-muted">{r.window ?? 'No PTO'}</span>
                      <span className={`text-xs font-semibold px-3 py-1 rounded-full ${r.updated ? 'bg-[#eef5f1] text-[#2f7d5b]' : 'bg-[#fdeaea] text-[#b0412f]'}`}>
                        {r.updated ? 'Updated' : 'Missing'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

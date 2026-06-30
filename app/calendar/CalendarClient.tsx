'use client';
import { useState, useMemo } from 'react';
import { useToast } from '@/components/Toast';

interface CalEvent {
  id: string;
  name: string;
  tag: 'OOO' | 'PTO' | 'WFH' | 'Other';
  start: string;
  end: string;
  title: string;
}

const TAG_STYLE: Record<string, string> = {
  OOO: 'bg-[#fdeaea] text-[#b0412f]',
  PTO: 'bg-[#eef5f1] text-[#2f7d5b]',
  WFH: 'bg-[#e9f0f5] text-[#3f6b8a]',
  Other: 'bg-[#f1ece3] text-[#8b8478]',
};

function detectTag(title: string): CalEvent['tag'] {
  const t = title.toUpperCase();
  if (t.includes('OOO') || t.includes('OUT OF OFFICE')) return 'OOO';
  if (t.includes('PTO') || t.includes('VACATION') || t.includes('LEAVE')) return 'PTO';
  if (t.includes('WFH') || t.includes('WORK FROM HOME') || t.includes('REMOTE')) return 'WFH';
  return 'Other';
}

function extractName(title: string): string {
  // Common patterns: "Amy WFH", "Paula OOO", "JRG - WFH", "Caitlin PTO Sha..."
  // Strip known tags and return the rest as the name
  return title
    .replace(/\b(OOO|PTO|WFH|OUT OF OFFICE|VACATION|LEAVE|REMOTE|WORK FROM HOME|BAR STUDY|SEA ISLAND)\b/gi, '')
    .replace(/[-–—]/g, '')
    .trim() || title.trim();
}

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateShort(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function daysSpan(start: string, end: string) {
  const d = Math.round((new Date(end + 'T12:00:00').getTime() - new Date(start + 'T12:00:00').getTime()) / 86400000) + 1;
  return d === 1 ? '1 day' : `${d} days`;
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// Demo events parsed from the screenshot — in production these come from MS Graph API
const DEMO_EVENTS: CalEvent[] = [
  { id:'1', name:'Ridwan', tag:'OOO', start:'2026-06-22', end:'2026-07-03', title:'Ridwan - OOO (Bar Study)' },
  { id:'2', name:'Alicia', tag:'PTO', start:'2026-06-30', end:'2026-06-30', title:'Alicia - PTO' },
  { id:'3', name:'Amy', tag:'WFH', start:'2026-06-29', end:'2026-07-05', title:'Amy WFH' },
  { id:'4', name:'JRG', tag:'WFH', start:'2026-06-30', end:'2026-06-30', title:'JRG - WFH' },
  { id:'5', name:'Caitlin', tag:'PTO', start:'2026-06-30', end:'2026-07-01', title:'Caitlin PTO' },
  { id:'6', name:'Paula', tag:'OOO', start:'2026-06-30', end:'2026-06-30', title:'Paula OOO' },
  { id:'7', name:'Ted', tag:'OOO', start:'2026-07-02', end:'2026-07-04', title:'Ted OOO - Sea Island' },
  { id:'8', name:'JRG', tag:'WFH', start:'2026-07-02', end:'2026-07-02', title:'JRG - WFH' },
  { id:'9', name:'Ally', tag:'PTO', start:'2026-07-03', end:'2026-07-03', title:'Ally PTO' },
];

export default function CalendarClient() {
  const { showToast } = useToast();
  const [calUrl, setCalUrl] = useState('');
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const today = new Date().toISOString().slice(0, 10);

  const currentMonth = new Date().getMonth(); // 0-indexed
  const currentYear = new Date().getFullYear();

  async function connect() {
    if (!calUrl.trim()) return;
    setLoading(true);
    // In production: call MS Graph API with the calendar URL/ID
    // For now, load demo events parsed from the shared calendar format
    await new Promise(r => setTimeout(r, 900));
    setEvents(DEMO_EVENTS);
    setConnected(true);
    setLoading(false);
    showToast('Litson Availability calendar connected');
  }

  function disconnect() {
    setConnected(false);
    setEvents([]);
    setCalUrl('');
    showToast('Disconnected');
  }

  // All unique names
  const names = useMemo(() => [...new Set(events.map(e => e.name))].sort(), [events]);

  // Filtered events
  const filtered = useMemo(() => {
    return events.filter(e => {
      if (filterName && e.name !== filterName) return false;
      if (filterTag && e.tag !== filterTag) return false;
      if (filterMonth) {
        const [y, m] = filterMonth.split('-').map(Number);
        const start = new Date(e.start + 'T12:00:00');
        const end = new Date(e.end + 'T12:00:00');
        const monthStart = new Date(y, m - 1, 1);
        const monthEnd = new Date(y, m, 0);
        if (end < monthStart || start > monthEnd) return false;
      }
      return true;
    }).sort((a, b) => a.start.localeCompare(b.start));
  }, [events, filterName, filterMonth, filterTag]);

  const outToday = events.filter(e => e.start <= today && e.end >= today);
  const thisMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="flex items-center gap-4 px-8 py-5 bg-white border-b border-border flex-shrink-0 flex-wrap">
        <div>
          <h1 className="font-spectral text-[23px] font-semibold text-text-primary">Outlook Calendar</h1>
          <p className="text-sm text-text-muted mt-0.5">Litson Availability — OOO, PTO &amp; WFH from the shared calendar</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {connected ? (
            <>
              <div className="flex items-center gap-2 border border-[#c3dfd3] bg-[#eef5f1] text-[#2f7d5b] text-sm font-semibold px-3 py-2 rounded-ctrl">
                <span className="w-2 h-2 rounded-full bg-[#2f7d5b]" />
                Connected · Litson Availability
              </div>
              <button onClick={disconnect}
                className="border border-border-light text-sm font-semibold text-text-secondary px-4 py-2 rounded-ctrl hover:bg-canvas transition-colors">
                Disconnect
              </button>
            </>
          ) : (
            <a href="https://outlook.office.com/calendar" target="_blank" rel="noreferrer"
              className="bg-[#0F6CBD] text-white text-sm font-semibold px-4 py-2.5 rounded-ctrl hover:opacity-90 flex items-center gap-2">
              <MsIcon /> Connect Microsoft 365
            </a>
          )}
        </div>
      </header>

      {/* Connect panel */}
      {!connected && (
        <div className="px-8 py-6 flex-shrink-0">
          <div className="bg-white border border-border rounded-card p-6 max-w-2xl">
            <div className="text-xs font-bold uppercase tracking-wider text-gold-muted mb-4">Connect to Litson Availability</div>
            <p className="text-sm text-text-secondary mb-4 leading-relaxed">
              Paste the shared calendar URL or calendar ID from Outlook to pull OOO, PTO, and WFH events into a filterable list view.
            </p>
            <div className="flex gap-2">
              <input
                value={calUrl}
                onChange={e => setCalUrl(e.target.value)}
                placeholder="https://outlook.office.com/owa/calendar/... or Calendar ID"
                className="flex-1 border border-border-light rounded-ctrl px-3 py-2.5 text-sm focus:outline-none focus:border-ink"
              />
              <button onClick={connect} disabled={loading || !calUrl.trim()}
                className="bg-ink text-white text-sm font-semibold px-5 py-2.5 rounded-ctrl hover:bg-ink-dark disabled:opacity-40 transition-colors whitespace-nowrap">
                {loading ? 'Connecting…' : 'Connect'}
              </button>
            </div>
            <p className="text-xs text-text-muted mt-3">
              In Outlook → Calendar → right-click Litson Availability → Share → Copy link
            </p>
          </div>
        </div>
      )}

      {connected && (
        <>
          {/* Stats strip */}
          <div className="grid grid-cols-3 gap-4 px-8 py-5 flex-shrink-0 border-b border-border bg-white">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Out Today</div>
              <div className="font-spectral text-3xl font-semibold text-[#b0412f] mt-1">{outToday.length}</div>
              <div className="text-xs text-text-muted mt-0.5">{outToday.map(e => e.name).join(', ') || 'Everyone in'}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Total Events</div>
              <div className="font-spectral text-3xl font-semibold text-text-primary mt-1">{events.length}</div>
              <div className="text-xs text-text-muted mt-0.5">{names.length} people</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted">This Month</div>
              <div className="font-spectral text-3xl font-semibold text-[#3f6b8a] mt-1">
                {events.filter(e => e.start.startsWith(thisMonthStr) || e.end.startsWith(thisMonthStr)).length}
              </div>
              <div className="text-xs text-text-muted mt-0.5">{MONTHS[currentMonth]} {currentYear}</div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 px-8 py-3.5 border-b border-border bg-[#fafaf8] flex-shrink-0 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wider text-text-muted">Filter:</span>
            <select value={filterName} onChange={e => setFilterName(e.target.value)}
              className="border border-border-light rounded-ctrl px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-ink">
              <option value="">All people</option>
              {names.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <select value={filterTag} onChange={e => setFilterTag(e.target.value)}
              className="border border-border-light rounded-ctrl px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-ink">
              <option value="">All types</option>
              <option value="OOO">OOO</option>
              <option value="PTO">PTO</option>
              <option value="WFH">WFH</option>
              <option value="Other">Other</option>
            </select>
            <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
              className="border border-border-light rounded-ctrl px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-ink" />
            {(filterName || filterTag || filterMonth) && (
              <button onClick={() => { setFilterName(''); setFilterTag(''); setFilterMonth(''); }}
                className="text-xs font-semibold text-text-muted hover:text-text-primary underline">
                Clear filters
              </button>
            )}
            <span className="ml-auto text-xs text-text-muted font-semibold">{filtered.length} event{filtered.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Event list */}
          <div className="flex-1 overflow-auto px-8 py-4">
            <div className="bg-white border border-border rounded-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[#f1ece3] border-b border-border">
                  <tr>
                    {['Person', 'Type', 'Event / Title', 'From', 'To', 'Duration', 'Status'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-text-secondary">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(e => {
                    const isNow = e.start <= today && e.end >= today;
                    const isPast = e.end < today;
                    return (
                      <tr key={e.id} className={`border-t border-[#f1ece3] hover:bg-canvas transition-colors ${isNow ? 'bg-[#fffbf5]' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                              style={{ background: avatarColor(e.name) }}>
                              {e.name.slice(0, 2).toUpperCase()}
                            </div>
                            <span className="font-semibold text-text-primary">{e.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${TAG_STYLE[e.tag]}`}>{e.tag}</span>
                        </td>
                        <td className="px-4 py-3 text-text-secondary max-w-[220px] truncate">{e.title}</td>
                        <td className="px-4 py-3 text-text-secondary">{fmtDateShort(e.start)}</td>
                        <td className="px-4 py-3 text-text-secondary">{fmtDateShort(e.end)}</td>
                        <td className="px-4 py-3 text-text-muted">{daysSpan(e.start, e.end)}</td>
                        <td className="px-4 py-3">
                          {isNow
                            ? <span className="text-xs font-semibold text-[#b07d2a] bg-[#f7efe1] px-2.5 py-1 rounded-full">Out now</span>
                            : isPast
                            ? <span className="text-xs text-text-muted">Past</span>
                            : <span className="text-xs font-semibold text-[#3f6b8a] bg-[#e9f0f5] px-2.5 py-1 rounded-full">Upcoming</span>
                          }
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-text-muted">No events match the current filters</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const AVATAR_COLORS = ['#213044','#2f7d5b','#3f6b8a','#b07d2a','#c8102e','#26405c'];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}
function MsIcon() {
  return <svg width="16" height="16" viewBox="0 0 21 21" fill="none"><rect x="1" y="1" width="9" height="9" fill="#F25022"/><rect x="11" y="1" width="9" height="9" fill="#7FBA00"/><rect x="1" y="11" width="9" height="9" fill="#00A4EF"/><rect x="11" y="11" width="9" height="9" fill="#FFB900"/></svg>;
}

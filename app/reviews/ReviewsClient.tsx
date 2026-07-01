'use client';
import { useState, useEffect } from 'react';
import { useToast } from '@/components/Toast';

interface Employee {
  id: string; name: string; role: string; dept: string; hire_date: string | null;
  review_6mo_status: string | null; review_6mo_date: string | null;
  review_1yr_status: string | null; review_1yr_date: string | null;
  review_notes: string | null;
}

interface ReviewItem {
  employee: Employee;
  type: '6-month review' | '1-year review';
  date: Date;
  days: number;
}

function reviewDate(hireDate: string, months: number): Date {
  const d = new Date(hireDate + 'T12:00:00');
  d.setMonth(d.getMonth() + months);
  return d;
}

function parseDate(s: string): Date {
  return new Date(s + (s.includes('T') ? '' : 'T12:00:00'));
}

function daysUntil(date: Date): number {
  return Math.floor((date.getTime() - Date.now()) / 86400000);
}

function formatDate(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ReviewsClient({ initialEmployees }: { initialEmployees: Employee[] }) {
  const { showToast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [dashUrl, setDashUrl] = useState('');
  const [linkedUrl, setLinkedUrl] = useState('');
  const [showSchedule, setShowSchedule] = useState(false);
  const [form, setForm] = useState({ name: '', role: '', dept: 'Operations', date: '', type: '6mo' as '6mo' | '1yr' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/connections').then(r => r.json()).then(data => {
      if (data.reviews_url) { setLinkedUrl(data.reviews_url); setDashUrl(data.reviews_url); }
    }).catch(() => {});
  }, []);

  async function connectDash() {
    if (!dashUrl) return;
    setLinkedUrl(dashUrl);
    await fetch('/api/connections', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reviews_url: dashUrl }) });
    showToast('Dashboard linked');
  }

  async function disconnectDash() {
    setLinkedUrl(''); setDashUrl('');
    await fetch('/api/connections', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reviews_url: null }) });
    showToast('Disconnected');
  }

  async function scheduleReview() {
    if (!form.name || !form.date) return;
    setSaving(true);
    try {
      const payload: Record<string, string> = { name: form.name, role: form.role || 'Employee', dept: form.dept };
      if (form.type === '6mo') payload.review_6mo_date = form.date;
      else payload.review_1yr_date = form.date;
      const res = await fetch('/api/employees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (data.employee) {
        setEmployees(prev => [...prev, data.employee]);
        setShowSchedule(false);
        setForm({ name: '', role: '', dept: 'Operations', date: '', type: '6mo' });
        showToast(`${form.name}'s review scheduled for ${form.date}`);
      }
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(emp: Employee, field: 'review_6mo_status' | 'review_1yr_status', value: string) {
    await fetch(`/api/employees/${emp.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });
    setEmployees(prev => prev.map(e => e.id === emp.id ? { ...e, [field]: value } : e));
    showToast('Status updated');
  }

  const upcoming: ReviewItem[] = employees
    .flatMap(e => {
      const out: ReviewItem[] = [];
      if (e.review_6mo_status !== 'Complete') {
        const d = e.review_6mo_date
          ? parseDate(e.review_6mo_date)
          : e.hire_date ? reviewDate(e.hire_date, 6) : null;
        if (d) out.push({ employee: e, type: '6-month review', date: d, days: daysUntil(d) });
      }
      if (e.review_1yr_status !== 'Complete') {
        const d = e.review_1yr_date
          ? parseDate(e.review_1yr_date)
          : e.hire_date ? reviewDate(e.hire_date, 12) : null;
        if (d) out.push({ employee: e, type: '1-year review', date: d, days: daysUntil(d) });
      }
      return out;
    })
    .sort((a, b) => a.days - b.days);

  const upNext = upcoming[0];
  const thenDue = upcoming.slice(1, 4);

  const allStatuses = employees.flatMap(e => [e.review_6mo_status ?? 'Not Started', e.review_1yr_status ?? 'Not Started']);
  const total = allStatuses.length;
  const counts = {
    Complete: allStatuses.filter(s => s === 'Complete').length,
    'In progress': allStatuses.filter(s => s === 'In Progress').length,
    Scheduled: allStatuses.filter(s => s === 'Scheduled').length,
    'Not started': allStatuses.filter(s => s === 'Not Started').length,
  };

  const depts = [...new Set(employees.map(e => e.dept))].filter(Boolean);
  const byDept = depts.map(dept => {
    const group = employees.filter(e => e.dept === dept);
    const done = group.flatMap(e => [e.review_6mo_status, e.review_1yr_status]).filter(s => s === 'Complete').length;
    return { dept, pct: Math.round((done / (group.length * 2)) * 100) };
  }).sort((a, b) => b.pct - a.pct);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="px-8 py-5 bg-white border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-spectral text-[23px] font-semibold text-text-primary">Performance Reviews</h1>
            <p className="text-sm text-text-muted mt-0.5">6-month &amp; 1-year reviews · tracking {employees.length} employees</p>
          </div>
          <button
            onClick={() => setShowSchedule(true)}
            className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark transition-colors"
          >+ Schedule Review</button>
        </div>
      </header>

      <div className="px-8 py-3 bg-white border-b border-border flex-shrink-0 flex items-center gap-3 text-sm">
        {linkedUrl ? (
          <>
            <span className="w-2 h-2 rounded-full bg-[#2f7d5b] shrink-0" />
            <span className="text-[#2f7d5b] font-semibold shrink-0">Dashboard connected</span>
            <span className="text-text-muted truncate">{linkedUrl}</span>
            <a href={linkedUrl} target="_blank" rel="noopener noreferrer"
              className="ml-auto shrink-0 bg-[#2f7d5b] text-white text-xs font-semibold px-3 py-1 rounded-ctrl hover:bg-[#236045]">Open</a>
            <button onClick={disconnectDash} className="shrink-0 text-xs font-semibold text-text-muted border border-border-light px-3 py-1 rounded-ctrl hover:text-litred-alt">Disconnect</button>
          </>
        ) : (
          <>
            <span className="text-text-secondary shrink-0">🔗 Link your live Performance Review dashboard to open each review form &amp; meeting docs directly.</span>
            <input
              value={dashUrl}
              onChange={e => setDashUrl(e.target.value)}
              placeholder="https://your-live-dashboard..."
              className="flex-1 max-w-xs border border-border-light rounded-ctrl px-3 py-1.5 text-sm focus:outline-none focus:border-ink"
            />
            <button onClick={connectDash} className="bg-ink text-white text-sm font-semibold px-4 py-1.5 rounded-ctrl hover:bg-ink-dark transition-colors">Link</button>
          </>
        )}
      </div>

      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="grid grid-cols-[1fr_288px] gap-6 items-start">
          <div className="flex flex-col gap-4">
            {upNext ? (
              <div className="bg-ink rounded-card p-6 text-white">
                <div className="flex items-start justify-between gap-6">
                  <div className="flex gap-6 items-start">
                    <div className="text-center min-w-[52px]">
                      <div className="text-5xl font-spectral font-semibold text-gold leading-none">
                        {upNext.days < 0 ? 'OD' : upNext.days === 0 ? 'TD' : upNext.days}
                      </div>
                      <div className="text-[10px] uppercase tracking-widest text-white/40 mt-1">
                        {upNext.days < 0 ? 'OVERDUE' : upNext.days === 0 ? 'TODAY' : 'DAYS'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1">UP NEXT</div>
                      <div className="font-spectral text-[19px] font-semibold leading-tight">
                        {upNext.employee.name} — {upNext.type}
                      </div>
                      <div className="text-sm text-white/50 mt-1">
                        {formatDate(upNext.date)} · {upNext.employee.role}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      onClick={() => showToast('Reminder sent!')}
                      className="bg-gold text-ink-darkest text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-gold-light transition-colors"
                    >Send reminder</button>
                    {linkedUrl && (
                      <a href={linkedUrl} target="_blank" rel="noopener noreferrer"
                        className="text-center bg-white/10 text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-white/20 transition-colors">
                        Open form
                      </a>
                    )}
                    <select
                      value={upNext.employee.review_6mo_status ?? 'Not Started'}
                      onChange={e => updateStatus(upNext.employee, 'review_6mo_status', e.target.value)}
                      className="text-xs bg-white/10 text-white border border-white/20 rounded-ctrl px-2 py-1.5"
                    >
                      {['Not Started', 'Scheduled', 'In Progress', 'Complete'].map(s => (
                        <option key={s} value={s} className="text-ink">{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-ink rounded-card p-6 text-white/50 text-sm">All reviews are up to date.</div>
            )}

            {thenDue.length > 0 && (
              <div className="bg-white border border-border rounded-card p-5">
                <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-3">THEN DUE</div>
                <div className="flex flex-col gap-2.5">
                  {thenDue.map((r, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div>
                        <span className="font-medium text-text-primary">{r.employee.name}</span>
                        <span className="text-text-muted ml-2 text-xs">{r.type}</span>
                      </div>
                      <span className="text-text-muted">
                        {r.days < 0 ? `${Math.abs(r.days)}d overdue` : r.days === 0 ? 'Today' : `in ${r.days}d`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {linkedUrl && (
              <div className="flex items-center gap-3 px-4 py-3 bg-[#eef5f1] border border-[#c3dfd3] rounded-card text-sm">
                <span className="w-2 h-2 rounded-full bg-[#2f7d5b] shrink-0" />
                <span className="text-[#2f7d5b] font-semibold">Live dashboard connected</span>
                <span className="text-text-muted truncate">{linkedUrl}</span>
                <a href={linkedUrl} target="_blank" rel="noopener noreferrer"
                  className="ml-auto shrink-0 bg-[#2f7d5b] text-white text-xs font-semibold px-3 py-1 rounded-ctrl hover:bg-[#236045]">Open</a>
                <button onClick={disconnectDash}
                  className="shrink-0 text-xs font-semibold text-text-muted hover:text-litred-alt border border-border-light px-3 py-1 rounded-ctrl">Disconnect</button>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <div className="bg-white border border-border rounded-card p-5">
              <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-4">
                Status breakdown · {total} reviews
              </div>
              {(Object.entries(counts) as [string, number][]).map(([label, count]) => (
                <div key={label} className="mb-3 last:mb-0">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-text-secondary">{label}</span>
                    <span className="font-semibold text-text-primary">{count}</span>
                  </div>
                  <div className="h-1.5 bg-[#f1ece3] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{
                      width: `${total ? (count / total) * 100 : 0}%`,
                      background: label === 'Complete' ? '#2f7d5b' : label === 'In progress' ? '#c9a24a' : label === 'Scheduled' ? '#3f6b8a' : '#ddd5c6',
                    }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white border border-border rounded-card p-5">
              <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-4">Completion by group</div>
              {byDept.map(({ dept, pct }) => (
                <div key={dept} className="mb-3 last:mb-0">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-text-secondary">{dept}</span>
                    <span className="font-semibold text-text-primary">{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-[#f1ece3] rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-[#2f7d5b] transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showSchedule && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowSchedule(false)}>
          <div className="bg-white rounded-card p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="font-spectral text-[18px] font-semibold text-text-primary mb-4">Schedule a Review</h2>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1">Employee Name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Full name" className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
              </div>
              <div>
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1">Role</label>
                <input value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  placeholder="e.g. Associate" className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
              </div>
              <div>
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1">Department</label>
                <select value={form.dept} onChange={e => setForm(f => ({ ...f, dept: e.target.value }))}
                  className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink">
                  <option>Operations</option>
                  <option>Attorneys</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1">Review Type</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as '6mo' | '1yr' }))}
                  className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink">
                  <option value="6mo">6-Month Review</option>
                  <option value="1yr">1-Year Review</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1">Review Date</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowSchedule(false)}
                className="flex-1 border border-border-light text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-surface-hover transition-colors">
                Cancel
              </button>
              <button onClick={scheduleReview} disabled={saving || !form.name || !form.date}
                className="flex-1 bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark transition-colors disabled:opacity-40">
                {saving ? 'Saving…' : 'Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';
import { useState, useEffect } from 'react';
import { useToast } from '@/components/Toast';

interface Employee {
  id: string; name: string; role: string; dept: string; hire_date: string | null;
  review_6mo_status: string | null; review_6mo_date: string | null; review_6mo_summary: string | null;
  review_1yr_status: string | null; review_1yr_date: string | null; review_1yr_summary: string | null;
  review_notes: string | null;
}

type ReviewType = '6-month review' | '1-year review';

interface ReviewItem {
  employee: Employee;
  type: ReviewType;
  date: Date;
  days: number;
}

// ---- Date helpers (CST / America/Chicago) ----
function addMonths(dateStr: string, months: number): Date {
  const d = new Date(dateStr.slice(0, 10) + 'T12:00:00');
  d.setMonth(d.getMonth() + months);
  return d;
}

function toYmd(d: Date): string {
  return d.toLocaleDateString('en-CA'); // YYYY-MM-DD
}

// Calendar-day difference from "today in CST" to the given date, ignoring clock time.
function daysUntilCST(dateStr: string): number {
  const todayCst = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
  const a = Date.parse(todayCst + 'T00:00:00Z');
  const b = Date.parse(dateStr.slice(0, 10) + 'T00:00:00Z');
  return Math.round((b - a) / 86400000);
}

function relLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `in ${days}d`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Resolve the effective date string for a review (manual override wins, else hire_date + months)
function reviewDateStr(e: Employee, kind: '6mo' | '1yr'): string | null {
  if (kind === '6mo') {
    if (e.review_6mo_date) return e.review_6mo_date.slice(0, 10);
    if (e.hire_date) return toYmd(addMonths(e.hire_date, 6));
  } else {
    if (e.review_1yr_date) return e.review_1yr_date.slice(0, 10);
    if (e.hire_date) return toYmd(addMonths(e.hire_date, 12));
  }
  return null;
}

// Open the connected dashboard link directly. We don't append a path because
// the external dashboard's routing is unknown (guessing a path caused 404s).
// If you want a deep link to a specific reports page, paste that exact URL when
// connecting the dashboard.
function reportsUrl(base: string): string {
  return base || '';
}

export default function ReviewsClient({ initialEmployees }: { initialEmployees: Employee[] }) {
  const { showToast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [dashUrl, setDashUrl] = useState('');
  const [linkedUrl, setLinkedUrl] = useState('');
  const [showSchedule, setShowSchedule] = useState(false);
  const [form, setForm] = useState({ name: '', role: '', dept: 'Operations', date: '', type: '6mo' as '6mo' | '1yr' });
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<Employee | null>(null);

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

  async function patchEmployee(id: string, fields: Record<string, string | null>) {
    const res = await fetch(`/api/employees/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
    const { employee } = await res.json();
    if (employee) setEmployees(prev => prev.map(e => e.id === id ? employee : e));
    return employee as Employee | undefined;
  }

  async function deleteEmployee(emp: Employee) {
    if (!confirm(`Remove ${emp.name} from the review roster? This can't be undone.`)) return;
    const res = await fetch(`/api/employees/${emp.id}`, { method: 'DELETE' });
    if (res.ok) {
      setEmployees(prev => prev.filter(e => e.id !== emp.id));
      if (detail?.id === emp.id) setDetail(null);
      showToast(`${emp.name} removed`);
    } else {
      showToast('Could not remove employee');
    }
  }

  // ---- Upcoming reviews across all employees ----
  const upcoming: ReviewItem[] = employees
    .flatMap(e => {
      const out: ReviewItem[] = [];
      const d6 = reviewDateStr(e, '6mo');
      if (d6 && e.review_6mo_status !== 'Complete') out.push({ employee: e, type: '6-month review', date: new Date(d6 + 'T12:00:00'), days: daysUntilCST(d6) });
      const d12 = reviewDateStr(e, '1yr');
      if (d12 && e.review_1yr_status !== 'Complete') out.push({ employee: e, type: '1-year review', date: new Date(d12 + 'T12:00:00'), days: daysUntilCST(d12) });
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

  // ---- Per-employee "last" and "next" review computation for the roster table ----
  function lastReview(e: Employee): { type: ReviewType; date: string } | null {
    const done: { type: ReviewType; date: string }[] = [];
    const d6 = reviewDateStr(e, '6mo');
    if (d6 && e.review_6mo_status === 'Complete') done.push({ type: '6-month review', date: d6 });
    const d12 = reviewDateStr(e, '1yr');
    if (d12 && e.review_1yr_status === 'Complete') done.push({ type: '1-year review', date: d12 });
    if (!done.length) return null;
    return done.sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  }
  function nextReview(e: Employee): { type: ReviewType; date: string; days: number } | null {
    const pend: { type: ReviewType; date: string; days: number }[] = [];
    const d6 = reviewDateStr(e, '6mo');
    if (d6 && e.review_6mo_status !== 'Complete') pend.push({ type: '6-month review', date: d6, days: daysUntilCST(d6) });
    const d12 = reviewDateStr(e, '1yr');
    if (d12 && e.review_1yr_status !== 'Complete') pend.push({ type: '1-year review', date: d12, days: daysUntilCST(d12) });
    if (!pend.length) return null;
    return pend.sort((a, b) => a.days - b.days)[0];
  }

  const roster = [...employees].sort((a, b) => {
    const na = nextReview(a), nb = nextReview(b);
    if (na && nb) return na.days - nb.days;
    if (na) return -1;
    if (nb) return 1;
    return a.name.localeCompare(b.name);
  });

  const upNextStatusField = upNext ? (upNext.type === '6-month review' ? 'review_6mo_status' : 'review_1yr_status') : 'review_6mo_status';
  const upNextStatusValue = upNext ? (upNext.type === '6-month review' ? upNext.employee.review_6mo_status : upNext.employee.review_1yr_status) : 'Not Started';

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="px-8 py-5 bg-white border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-spectral text-[23px] font-semibold text-text-primary">Performance Reviews</h1>
            <p className="text-sm text-text-muted mt-0.5">6-month &amp; 1-year reviews · tracking {employees.length} employees · times in CST</p>
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
            <a href={reportsUrl(linkedUrl)} target="_blank" rel="noopener noreferrer"
              className="ml-auto shrink-0 bg-[#2f7d5b] text-white text-xs font-semibold px-3 py-1 rounded-ctrl hover:bg-[#236045]">Open dashboard</a>
            <button onClick={disconnectDash} className="shrink-0 text-xs font-semibold text-text-muted border border-border-light px-3 py-1 rounded-ctrl hover:text-litred-alt">Disconnect</button>
          </>
        ) : (
          <>
            <span className="text-text-secondary shrink-0">🔗 Link your live Performance Review dashboard to open each review form &amp; report directly.</span>
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
                    <div className="text-center min-w-[64px]">
                      <div className="text-4xl font-spectral font-semibold text-gold leading-none">
                        {upNext.days < 0 ? Math.abs(upNext.days) : upNext.days}
                      </div>
                      <div className="text-[10px] uppercase tracking-widest text-white/40 mt-1">
                        {upNext.days < 0 ? 'DAYS OVERDUE' : upNext.days === 0 ? 'TODAY' : upNext.days === 1 ? 'DAY (TMRW)' : 'DAYS'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1">UP NEXT</div>
                      <button onClick={() => setDetail(upNext.employee)} className="font-spectral text-[19px] font-semibold leading-tight text-left hover:text-gold transition-colors">
                        {upNext.employee.name} — {upNext.type}
                      </button>
                      <div className="text-sm text-white/50 mt-1">
                        {formatDate(toYmd(upNext.date))} · {upNext.employee.role}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0 w-[130px]">
                    {linkedUrl && (
                      <a href={reportsUrl(linkedUrl)} target="_blank" rel="noopener noreferrer"
                        className="text-center bg-gold text-ink-darkest text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-gold-light transition-colors">
                        Open form
                      </a>
                    )}
                    <button
                      onClick={() => showToast('Reminder sent!')}
                      className="bg-white/10 text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-white/20 transition-colors"
                    >Send reminder</button>
                    <select
                      value={upNextStatusValue ?? 'Not Started'}
                      onChange={e => patchEmployee(upNext.employee.id, { [upNextStatusField]: e.target.value })}
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
                        <button onClick={() => setDetail(r.employee)} className="font-medium text-text-primary hover:text-ink hover:underline">{r.employee.name}</button>
                        <span className="text-text-muted ml-2 text-xs">{r.type}</span>
                      </div>
                      <span className="text-text-muted">{relLabel(r.days)}</span>
                    </div>
                  ))}
                </div>
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

        {/* ---- All employees roster ---- */}
        <div className="mt-6 bg-white border border-border rounded-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted">All employees · reviews</div>
            <span className="text-xs text-text-muted">Click a name to view summary &amp; edit dates</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-[#f1ece3]">
              <tr>{['Employee', 'Department', 'Last review', 'Next review', 'Status', ''].map(h => (
                <th key={h} className="text-left px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-text-secondary">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {roster.map(e => {
                const last = lastReview(e);
                const next = nextReview(e);
                return (
                  <tr key={e.id} className="border-t border-[#f1ece3] hover:bg-canvas transition-colors">
                    <td className="px-5 py-3">
                      <button onClick={() => setDetail(e)} className="font-medium text-text-primary hover:text-ink hover:underline text-left">{e.name}</button>
                      <div className="text-xs text-text-muted">{e.role}</div>
                    </td>
                    <td className="px-5 py-3 text-text-secondary">{e.dept}</td>
                    <td className="px-5 py-3 text-text-muted">
                      {last ? <><span className="text-text-secondary">{formatDate(last.date)}</span><span className="text-xs block text-text-muted">{last.type}</span></> : '—'}
                    </td>
                    <td className="px-5 py-3">
                      {next ? (
                        <>
                          <span className="text-text-primary font-medium">{formatDate(next.date)}</span>
                          <span className={`text-xs block ${next.days < 0 ? 'text-litred-alt' : next.days <= 1 ? 'text-[#b07d2a]' : 'text-text-muted'}`}>
                            {next.type} · {relLabel(next.days)}
                          </span>
                        </>
                      ) : <span className="text-text-muted">—</span>}
                    </td>
                    <td className="px-5 py-3">
                      {next ? (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          (next.type === '6-month review' ? e.review_6mo_status : e.review_1yr_status) === 'In Progress' ? 'bg-[#f7efe1] text-[#b07d2a]' :
                          (next.type === '6-month review' ? e.review_6mo_status : e.review_1yr_status) === 'Scheduled' ? 'bg-[#e9f0f5] text-[#3f6b8a]' :
                          'bg-[#f1ece3] text-text-muted'
                        }`}>
                          {(next.type === '6-month review' ? e.review_6mo_status : e.review_1yr_status) ?? 'Not Started'}
                        </span>
                      ) : <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#eef5f1] text-[#2f7d5b]">All complete</span>}
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <button onClick={() => setDetail(e)} className="text-xs font-semibold text-ink border border-border-light px-3 py-1 rounded-ctrl hover:bg-canvas">Edit</button>
                      <button onClick={() => deleteEmployee(e)} className="ml-2 text-xs font-semibold text-litred-alt border border-border-light px-3 py-1 rounded-ctrl hover:bg-[#fdeaea]">Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---- Schedule new review modal ---- */}
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

      {/* ---- Employee detail / summary drawer ---- */}
      {detail && (
        <EmployeeDetail
          key={detail.id}
          employee={detail}
          linkedUrl={linkedUrl}
          onClose={() => setDetail(null)}
          onDelete={() => deleteEmployee(detail)}
          onSave={async (fields) => {
            const updated = await patchEmployee(detail.id, fields);
            if (updated) setDetail(updated);
            showToast('Saved');
          }}
        />
      )}
    </div>
  );
}

// ---- Detail drawer component ----
function EmployeeDetail({ employee, linkedUrl, onClose, onSave, onDelete }: {
  employee: Employee;
  linkedUrl: string;
  onClose: () => void;
  onSave: (fields: Record<string, string | null>) => Promise<void>;
  onDelete: () => void;
}) {
  const [name, setName] = useState(employee.name);
  const [role, setRole] = useState(employee.role);
  const [dept, setDept] = useState(employee.dept);
  const [hire, setHire] = useState(employee.hire_date?.slice(0, 10) ?? '');
  const [d6, setD6] = useState(employee.review_6mo_date?.slice(0, 10) ?? '');
  const [s6, setS6] = useState(employee.review_6mo_status ?? 'Not Started');
  const [d12, setD12] = useState(employee.review_1yr_date?.slice(0, 10) ?? '');
  const [s12, setS12] = useState(employee.review_1yr_status ?? 'Not Started');
  const [summary, setSummary] = useState(employee.review_notes ?? '');
  const [busy, setBusy] = useState(false);

  const hasExternalSync = Boolean(employee.review_6mo_summary || employee.review_1yr_summary);

  async function save() {
    setBusy(true);
    try {
      await onSave({
        name: name.trim() || employee.name,
        role: role.trim() || employee.role,
        dept: dept.trim() || employee.dept,
        hire_date: hire || null,
        review_6mo_date: d6 || null,
        review_6mo_status: s6,
        review_1yr_date: d12 || null,
        review_1yr_status: s12,
        review_notes: summary || null,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex justify-end z-50" onClick={onClose}>
      <div className="bg-white w-full max-w-md h-full overflow-auto shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-border flex items-start justify-between">
          <div>
            <h2 className="font-spectral text-[20px] font-semibold text-text-primary">{employee.name}</h2>
            <p className="text-sm text-text-muted">{employee.role} · {employee.dept}</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary text-xl leading-none">×</button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-5">
          {/* Identity */}
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1">Name</label>
              <input value={name} onChange={e => setName(e.target.value)}
                className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1">Role</label>
                <input value={role} onChange={e => setRole(e.target.value)}
                  className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
              </div>
              <div>
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1">Department</label>
                <input value={dept} onChange={e => setDept(e.target.value)}
                  className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
              </div>
            </div>
          </div>

          {/* Quick summary */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wide">Quick summary</label>
              {linkedUrl && (
                <a href={reportsUrl(linkedUrl)} target="_blank" rel="noopener noreferrer"
                  className="text-xs font-semibold text-[#2f7d5b] hover:underline">Open dashboard ↗</a>
              )}
            </div>
            {!hasExternalSync && (
              <div className="mb-2 text-xs text-[#b07d2a] bg-[#f7efe1] border border-[#e8d5b0] rounded-ctrl px-3 py-2">
                Not yet synced from the review dashboard — the link may have been created recently. Add a quick summary below in the meantime.
              </div>
            )}
            <textarea
              value={summary}
              onChange={e => setSummary(e.target.value)}
              rows={5}
              placeholder="Add a short summary of this employee's performance / review notes…"
              className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink resize-none"
            />
            {(employee.review_6mo_summary || employee.review_1yr_summary) && (
              <div className="mt-2 text-xs text-text-secondary space-y-1">
                {employee.review_6mo_summary && <p><span className="font-semibold">6-mo:</span> {employee.review_6mo_summary}</p>}
                {employee.review_1yr_summary && <p><span className="font-semibold">1-yr:</span> {employee.review_1yr_summary}</p>}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1">Hire date</label>
            <input type="date" value={hire} onChange={e => setHire(e.target.value)}
              className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
            <p className="text-[11px] text-text-muted mt-1">If no manual dates are set, reviews auto-calculate from hire date (+6 / +12 months).</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1">6-month date</label>
              <input type="date" value={d6} onChange={e => setD6(e.target.value)}
                className="w-full border border-border-light rounded-ctrl px-2 py-2 text-sm focus:outline-none focus:border-ink" />
              <select value={s6} onChange={e => setS6(e.target.value)}
                className="w-full mt-2 border border-border-light rounded-ctrl px-2 py-2 text-sm focus:outline-none focus:border-ink">
                {['Not Started', 'Scheduled', 'In Progress', 'Complete'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1">1-year date</label>
              <input type="date" value={d12} onChange={e => setD12(e.target.value)}
                className="w-full border border-border-light rounded-ctrl px-2 py-2 text-sm focus:outline-none focus:border-ink" />
              <select value={s12} onChange={e => setS12(e.target.value)}
                className="w-full mt-2 border border-border-light rounded-ctrl px-2 py-2 text-sm focus:outline-none focus:border-ink">
                {['Not Started', 'Scheduled', 'In Progress', 'Complete'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border flex gap-2 sticky bottom-0 bg-white">
          <button onClick={onDelete} className="text-sm font-semibold text-litred-alt border border-border-light px-4 py-2 rounded-ctrl hover:bg-[#fdeaea]">Delete</button>
          <button onClick={onClose} className="flex-1 border border-border-light text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-surface-hover">Close</button>
          <button onClick={save} disabled={busy} className="flex-1 bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark disabled:opacity-40">
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

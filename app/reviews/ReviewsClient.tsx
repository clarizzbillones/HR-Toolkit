'use client';
import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/components/Toast';
import { useUndo } from '@/components/UndoProvider';
import { computeReview, parseHistory, REVIEW_STATUSES, type ReviewStatus, type ReviewHistoryEntry } from '@/lib/reviews';

interface Employee {
  id: string; name: string; role: string; dept: string; hire_date: string | null;
  last_review_date: string | null; review_history: string | null;
  review_6mo_status: string | null; review_6mo_date: string | null; review_6mo_summary: string | null;
  review_1yr_status: string | null; review_1yr_date: string | null; review_1yr_summary: string | null;
  review_notes: string | null;
}

// Principals are intentionally excluded from the performance-review cycle.
const REVIEW_EXCLUDED = new Set(['alex little', 'zachary lawson']);

// Staff-facing wording — never a milestone name.
const REVIEW_LABEL = 'Performance Review';

type ReviewType = '6-month review' | '1-year review';

interface ReviewItem {
  employee: Employee;
  type: ReviewType;
  date: Date;
  days: number;
}

// ---- Date helpers (CST / America/Chicago) ----
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
  if (days === 0) return 'due today';
  if (days === 1) return 'in 1d';
  return `in ${days}d`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Pill colors for each review status (spec §6).
const STATUS_PILL: Record<ReviewStatus, string> = {
  'Overdue': 'bg-[#fdeaea] text-[#b0412f]',
  'Review week': 'bg-[#f7efe1] text-[#b07d2a]',
  'Forms due': 'bg-[#faf3e6] text-[#c19653]',
  'Send forms': 'bg-[#e9f0f5] text-[#3f6b8a]',
  'Scheduled': 'bg-[#eef5f1] text-[#2f7d5b]',
};

// Open the connected dashboard link directly. We don't append a path because
// the external dashboard's routing is unknown (guessing a path caused 404s).
// If you want a deep link to a specific reports page, paste that exact URL when
// connecting the dashboard.
function reportsUrl(base: string): string {
  return base || '';
}

export default function ReviewsClient({ initialEmployees }: { initialEmployees: Employee[] }) {
  const { showToast } = useToast();
  const { pushUndo } = useUndo();
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [staff, setStaff] = useState<{ id: string; name: string; position: string | null; email: string | null; start_date: string | null }[]>([]);
  const [dashUrl, setDashUrl] = useState('');
  const [linkedUrl, setLinkedUrl] = useState('');
  const [showSchedule, setShowSchedule] = useState(false);
  const [form, setForm] = useState({ name: '', role: '', dept: 'Operations', date: '', peers: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<Employee | null>(null);
  const [showEmbed, setShowEmbed] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  const blankParticipant = { name: '', email: '', type: 'Peer reviewer', completed: false };
  const [invite, setInvite] = useState<{ employee: string; reviewType: string; link: string; deadline: string; participants: { name: string; email: string; type: string; completed: boolean }[] }>(
    { employee: '', reviewType: '', link: '', deadline: '', participants: [{ ...blankParticipant }] });
  const [showReminders, setShowReminders] = useState(false);
  const [invites, setInvites] = useState<{ id: string; employee: string; participant_name: string | null; participant_email: string; participant_type: string | null; review_type: string | null; deadline: string | null; completed: boolean; last_reminded_on: string | null }[]>([]);

  async function openReminders() {
    setShowReminders(true);
    try {
      const d = await (await fetch('/api/reviews/invites')).json();
      setInvites(d.rows ?? []);
    } catch { showToast('Could not load reminders'); }
  }
  async function toggleInviteDone(id: string, completed: boolean) {
    setInvites(prev => prev.map(x => x.id === id ? { ...x, completed } : x));
    await fetch('/api/reviews/invites', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, completed }) });
    showToast(completed ? 'Marked complete — reminders stopped' : 'Marked pending — reminders resume');
  }
  async function removeInvite(id: string) {
    setInvites(prev => prev.filter(x => x.id !== id));
    await fetch('/api/reviews/invites', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
  }

  async function previewInvites() {
    const w = window.open('', '_blank');
    try {
      const res = await fetch('/api/reviews/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...invite, preview: true }) });
      const d = await res.json();
      if (!res.ok) { showToast(d.error ?? 'Nothing to preview'); w?.close(); return; }
      const blocks = (d.messages ?? []).map((m: any) =>
        `<div style="max-width:640px;margin:0 auto 24px"><div style="font-size:12px;color:#8a7f6d;font-family:sans-serif;padding:8px 4px">To: ${m.to} · CC: ${d.cc} · <b>${m.subject}</b></div>${m.html}</div>`).join('');
      w?.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invite preview</title></head><body style="margin:0;background:#f1ece3;padding:20px 0">${blocks || '<p style="text-align:center">Add participants to preview.</p>'}</body></html>`);
      w?.document.close();
    } catch { showToast('Could not preview'); w?.close(); }
  }
  // Record participants for reminders WITHOUT sending an email now — for when
  // the initial invite was already sent manually.
  async function saveForReminders() {
    if (!invite.employee.trim()) { showToast('Enter who is being reviewed'); return; }
    if (!invite.deadline) { showToast('Set a deadline so reminders can be scheduled'); return; }
    const parts = invite.participants.filter(p => p.email.trim());
    if (!parts.length) { showToast('Add at least one participant email'); return; }
    setInviteBusy(true);
    try {
      const res = await fetch('/api/reviews/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...invite, participants: parts, scheduleOnly: true }) });
      const d = await res.json();
      if (res.ok) { showToast(`✓ ${d.scheduled} set for reminders — no email sent`); setShowInvite(false); }
      else showToast(d.error ?? 'Could not save for reminders');
    } catch { showToast('Could not save for reminders'); }
    setInviteBusy(false);
  }
  // On-demand: remind this reviewee's pending (not-completed) participants now.
  async function sendReminderNow(name: string) {
    showToast('Sending reminder…');
    try {
      const res = await fetch('/api/reviews/invite-remind', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employee: name }) });
      const d = await res.json();
      if (!res.ok) { showToast(d.error ?? 'Could not send reminder'); return; }
      if (d.sent) showToast(`✓ Reminder sent to ${d.sent} pending participant${d.sent > 1 ? 's' : ''}`);
      else if (d.total) showToast('All participants are marked complete — nobody to remind');
      else showToast('No tracked participants yet — add them via Send review invites');
    } catch { showToast('Could not send reminder'); }
  }
  async function sendInvites() {
    if (!invite.employee.trim()) { showToast('Enter who is being reviewed'); return; }
    const parts = invite.participants.filter(p => p.email.trim());
    if (!parts.length) { showToast('Add at least one participant email'); return; }
    setInviteBusy(true);
    try {
      const res = await fetch('/api/reviews/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...invite, participants: parts }) });
      const d = await res.json();
      if (res.ok) { showToast(`✓ Sent ${d.sent} invite${d.sent > 1 ? 's' : ''}${d.failed ? ` · ${d.failed} failed` : ''}`); setShowInvite(false); }
      else showToast(d.error ?? 'Could not send invites');
    } catch { showToast('Could not send invites'); }
    setInviteBusy(false);
  }

  useEffect(() => {
    fetch('/api/connections').then(r => r.json()).then(data => {
      if (data.reviews_url) { setLinkedUrl(data.reviews_url); setDashUrl(data.reviews_url); }
    }).catch(() => {});
    fetch('/api/staffing').then(r => r.json()).then(data => setStaff(data.rows ?? [])).catch(() => {});
  }, []);

  // Compare two people's names loosely so minor differences (a middle name,
  // extra spaces, casing) still count as the same person: exact match, or the
  // same first + last name.
  function sameName(a: string, b: string): boolean {
    const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
    const na = norm(a), nb = norm(b);
    if (!na || !nb) return false;
    if (na === nb) return true;
    const pa = na.split(' '), pb = nb.split(' ');
    return pa[0] === pb[0] && pa[pa.length - 1] === pb[pb.length - 1];
  }

  // Look up a person's role/position by name. Prefer the staff directory
  // (position) since it's the more accurate source of truth, then fall back
  // to the employee record's role.
  function roleForName(name: string): string | null {
    if (!name.trim()) return null;
    const st = staff.find(s => sameName(s.name, name));
    if (st?.position) return st.position;
    const emp = employees.find(e => sameName(e.name, name));
    return emp?.role || null;
  }

  // Look up a person's email by name from the staff directory
  function emailForName(name: string): string {
    if (!name.trim()) return '';
    const st = staff.find(s => sameName(s.name, name));
    return st?.email || '';
  }

  // Role to display for an employee, preferring the (more accurate) staff
  // directory position and falling back to the stored employee role.
  function displayRole(e: Employee): string {
    return roleForName(e.name) || e.role;
  }

  // Hire date for an employee — prefer the Staffing directory start date,
  // fall back to the stored hire_date. Returns a display string.
  function hireDateDisplay(e: Employee): string {
    const st = staff.find(s => sameName(s.name, e.name));
    const raw = (st?.start_date && st.start_date.trim()) ? st.start_date : (e.hire_date || '');
    if (!raw) return '—';
    const d = new Date(raw.slice(0, 10) + 'T12:00:00');
    return isNaN(d.getTime()) ? raw : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

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

  async function sendTestReminder() {
    showToast('Sending test email…');
    try {
      const res = await fetch('/api/reviews/remind?test=1', { method: 'POST' });
      const d = await res.json();
      if (res.ok) showToast(`✓ Test email sent to ${d.to}`);
      else showToast(d.error ?? 'Could not send email');
    } catch { showToast('Could not send email'); }
  }
  async function runReminderNow() {
    showToast('Running reminder check…');
    try {
      const res = await fetch('/api/reviews/remind', { method: 'POST' });
      const d = await res.json();
      if (res.ok && d.sent) showToast(`✓ Reminder emailed to ${d.to} (${d.sent} review${d.sent > 1 ? 's' : ''})`);
      else if (res.ok) showToast(d.message ?? 'No reviews are 30/15/10 days out right now');
      else showToast(d.error ?? 'Could not send email');
    } catch { showToast('Could not send email'); }
  }

  // Log a COMPLETED review: set last_review_date + append to review_history.
  // The next review, cycle, tenure and status all recompute automatically.
  async function logReview() {
    if (!form.name || !form.date) return;
    setSaving(true);
    try {
      const peers = form.peers.split(',').map(s => s.trim()).filter(Boolean);
      let existing = employees.find(e => e.name.trim().toLowerCase() === form.name.trim().toLowerCase());
      if (!existing) {
        const res = await fetch('/api/employees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: form.name, role: form.role || 'Employee', dept: form.dept }) });
        const data = await res.json();
        if (data.employee) { existing = data.employee; setEmployees(prev => [...prev, data.employee]); }
      }
      if (existing) {
        const history = [...parseHistory(existing.review_history), { date: form.date, peer_reviewers: peers, notes: form.notes }];
        await patchEmployee(existing.id, { last_review_date: form.date, review_history: JSON.stringify(history) });
        setShowSchedule(false);
        showToast(`Logged ${form.name}'s review — next review rescheduled automatically`);
        setForm({ name: '', role: '', dept: 'Operations', date: '', peers: '', notes: '' });
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
    const res = await fetch(`/api/employees/${emp.id}`, { method: 'DELETE' });
    if (res.ok) {
      setEmployees(prev => prev.filter(e => e.id !== emp.id));
      if (detail?.id === emp.id) setDetail(null);
      pushUndo({ label: `Delete ${emp.name}`, req: { url: '/api/employees', method: 'POST', body: { name: emp.name, role: emp.role, dept: emp.dept, hire_date: emp.hire_date, review_6mo_date: emp.review_6mo_date, review_1yr_date: emp.review_1yr_date } } });
      showToast(`${emp.name} removed — Ctrl+Z to undo`);
    } else {
      showToast('Could not remove employee');
    }
  }

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | 'All'>('All');
  const [search, setSearch] = useState('');

  // Raw hire date used as the review anchor — Staffing start date preferred,
  // else the stored hire_date. Same source the Hire date column displays.
  function hireOf(e: Employee): string | null {
    const st = staff.find(s => sameName(s.name, e.name));
    const raw = (st?.start_date && st.start_date.trim()) ? st.start_date : (e.hire_date || '');
    return raw ? raw.slice(0, 10) : null;
  }
  function lastOf(e: Employee): string | null {
    if (e.last_review_date && e.last_review_date.trim()) return e.last_review_date.slice(0, 10);
    const h = parseHistory(e.review_history);
    return h.length ? h.map(x => x.date).sort().slice(-1)[0] : null;
  }
  function computeFor(e: Employee) { return computeReview(hireOf(e), lastOf(e), today); }

  // Everyone in the review cycle (principals excluded), each with derived fields.
  const tracked = employees.filter(e => !REVIEW_EXCLUDED.has(e.name.trim().toLowerCase()));
  const rosterAll = tracked.map(e => ({ e, c: computeFor(e), last: lastOf(e) }))
    .sort((a, b) => {
      if (!a.c.next && !b.c.next) return a.e.name.localeCompare(b.e.name);
      if (!a.c.next) return 1;
      if (!b.c.next) return -1;
      return a.c.next.localeCompare(b.c.next); // next review ascending → overdue first
    });
  const q = search.trim().toLowerCase();
  // While searching, ignore the status filter so a name always turns up.
  const roster = rosterAll.filter(r => q
    ? (r.e.name.toLowerCase().includes(q) || (displayRole(r.e) || '').toLowerCase().includes(q))
    : (statusFilter === 'All' || r.c.status === statusFilter)
  );

  const overdueCount = rosterAll.filter(r => r.c.status === 'Overdue').length;
  const reviewWeekCount = rosterAll.filter(r => r.c.status === 'Review week').length;

  // The single most-imminent review to act on next (soonest date, overdue first)
  // plus the few after it — for the "up next" banner.
  const withNext = rosterAll.filter(r => r.c.next && r.c.days != null);
  const upNext = withNext[0] ?? null;
  const thenDue = withNext.slice(1, 4);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="px-8 py-5 bg-white border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="font-spectral text-[23px] font-semibold text-text-primary">Performance Reviews</h1>
              {overdueCount > 0 && <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#fdeaea] text-[#b0412f]">{overdueCount} overdue</span>}
              {reviewWeekCount > 0 && <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#f7efe1] text-[#b07d2a]">{reviewWeekCount} review week</span>}
            </div>
            <p className="text-sm text-text-muted mt-0.5">Reviews every 6 months · tracking {tracked.length} employees · times in CST</p>
          </div>
          <div className="flex items-center gap-2.5">
            <button onClick={() => window.open('/api/reviews/remind?preview=1', '_blank')}
              className="bg-white border border-border-light text-ink text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-canvas transition-colors"
            >👁 Preview email</button>
            <button onClick={openReminders}
              className="bg-white border border-border-light text-ink text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-canvas transition-colors"
            >🔔 Reminders</button>
            <button onClick={() => setShowInvite(true)}
              className="bg-white border border-border-light text-ink text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-canvas transition-colors"
            >✉ Send review invites</button>
            <button
              onClick={() => setShowSchedule(true)}
              className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark transition-colors"
            >+ Log a review</button>
          </div>
        </div>
      </header>

      <div className="px-8 py-3 bg-white border-b border-border flex-shrink-0 flex items-center gap-3 text-sm">
        {linkedUrl ? (
          <>
            <span className="w-2 h-2 rounded-full bg-[#2f7d5b] shrink-0" />
            <span className="text-[#2f7d5b] font-semibold shrink-0">Dashboard connected</span>
            <span className="text-text-muted truncate">{linkedUrl}</span>
            <button onClick={() => setShowEmbed(true)}
              className="ml-auto shrink-0 bg-[#2f7d5b] text-white text-xs font-semibold px-3 py-1 rounded-ctrl hover:bg-[#236045]">Open Reports</button>
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
        {/* ---- Up next: the most imminent review to act on ---- */}
        {upNext && (
          <div className="bg-ink rounded-card p-6 text-white mb-6">
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div className="flex gap-6 items-start">
                <div className="text-center min-w-[64px]">
                  <div className="text-4xl font-spectral font-semibold text-gold leading-none">
                    {upNext.c.days != null ? Math.abs(upNext.c.days) : ''}
                  </div>
                  <div className="text-[10px] uppercase tracking-widest text-white/40 mt-1">
                    {upNext.c.days != null && upNext.c.days < 0 ? 'DAYS OVERDUE' : upNext.c.days === 0 ? 'TODAY' : 'DAYS'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Up next · next scheduled review</div>
                  <button onClick={() => setDetail(upNext.e)} className="font-spectral text-[19px] font-semibold leading-tight text-left hover:text-gold transition-colors">
                    {upNext.e.name} — Performance Review
                  </button>
                  <div className="text-sm text-white/50 mt-1 flex items-center gap-2 flex-wrap">
                    <span>{upNext.c.next ? formatDate(upNext.c.next) : ''} · {displayRole(upNext.e)}</span>
                    {upNext.c.status && <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_PILL[upNext.c.status]}`}>{upNext.c.status}</span>}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2 shrink-0 w-[150px]">
                {linkedUrl && (
                  <button onClick={() => setShowEmbed(true)}
                    className="text-center bg-gold text-ink-darkest text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-gold-light transition-colors">
                    Open form
                  </button>
                )}
                <button onClick={() => sendReminderNow(upNext.e.name)}
                  className="bg-white/10 text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-white/20 transition-colors">
                  Send reminder
                </button>
                <button onClick={() => { setForm({ name: upNext.e.name, role: displayRole(upNext.e), dept: upNext.e.dept, date: '', peers: '', notes: '' }); setShowSchedule(true); }}
                  className="bg-white/10 text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-white/20 transition-colors">
                  Log completed
                </button>
              </div>
            </div>
            {thenDue.length > 0 && (
              <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap gap-x-6 gap-y-1 text-sm text-white/60">
                <span className="text-[10px] uppercase tracking-widest text-white/40 self-center">Then due</span>
                {thenDue.map((r, i) => (
                  <button key={i} onClick={() => setDetail(r.e)} className="hover:text-gold transition-colors">
                    {r.e.name} <span className="text-white/40">· {r.c.days != null ? relLabel(r.c.days) : ''}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ---- All employees · reviews (sorted by next review, overdue first) ---- */}
        <div className="bg-white border border-border rounded-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border gap-3 flex-wrap">
            <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted">All employees · reviews</div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-xs pointer-events-none">🔍</span>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employee…"
                  className="w-48 border border-border-light rounded-ctrl pl-7 pr-6 py-1.5 text-sm focus:outline-none focus:border-ink" />
                {search && (
                  <button onClick={() => setSearch('')} title="Clear"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-ink text-xs">✕</button>
                )}
              </div>
              <span className="text-[11px] text-text-muted">Filter:</span>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as ReviewStatus | 'All')}
                className="text-xs border border-border-light rounded-ctrl px-2 py-1 bg-white focus:outline-none focus:border-ink">
                {(['All', ...REVIEW_STATUSES] as const).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead className="bg-[#f1ece3]">
              <tr>{['Employee', 'Hire date', 'Last review', 'Next review', 'Tenure', 'Cycle', 'Status', ''].map(h => (
                <th key={h} className="text-left px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-text-secondary">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {roster.map(({ e, c, last }) => (
                <tr key={e.id} className="border-t border-[#f1ece3] hover:bg-canvas transition-colors">
                  <td className="px-5 py-3">
                    <button onClick={() => setDetail(e)} className="font-medium text-text-primary hover:text-ink hover:underline text-left">{e.name}</button>
                    <div className="text-xs text-text-muted">{displayRole(e)}</div>
                  </td>
                  <td className="px-5 py-3 text-text-secondary whitespace-nowrap">{hireDateDisplay(e)}</td>
                  <td className="px-5 py-3 text-text-muted whitespace-nowrap">{last ? formatDate(last) : '—'}</td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    {c.next ? (
                      <>
                        <span className="text-text-primary font-medium">{formatDate(c.next)}</span>
                        <span className={`text-xs block ${c.days != null && c.days < 0 ? 'text-litred-alt font-semibold' : c.days != null && c.days <= 14 ? 'text-[#b07d2a]' : 'text-text-muted'}`}>
                          {c.days != null ? relLabel(c.days) : ''}
                        </span>
                      </>
                    ) : <span className="text-text-muted">— <span className="text-[11px]">set hire date</span></span>}
                  </td>
                  <td className="px-5 py-3 text-text-secondary whitespace-nowrap">{c.tenure}</td>
                  <td className="px-5 py-3 text-text-secondary">{c.cycle ?? '—'}</td>
                  <td className="px-5 py-3">
                    {c.status
                      ? <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${STATUS_PILL[c.status]}`}>{c.status}</span>
                      : <span className="text-text-muted text-xs">—</span>}
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <button onClick={() => setDetail(e)} className="text-xs font-semibold text-ink border border-border-light px-3 py-1 rounded-ctrl hover:bg-canvas">Log / edit</button>
                    <button onClick={() => deleteEmployee(e)} className="ml-2 text-xs font-semibold text-litred-alt border border-border-light px-3 py-1 rounded-ctrl hover:bg-[#fdeaea]">Delete</button>
                  </td>
                </tr>
              ))}
              {roster.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-8 text-center text-text-muted text-sm">No employees match this filter.</td></tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      {/* ---- Schedule new review modal ---- */}
      {showSchedule && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowSchedule(false)}>
          <div className="bg-white rounded-card p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="font-spectral text-[18px] font-semibold text-text-primary mb-1">Log a completed review</h2>
            <p className="text-xs text-text-muted mb-4">Enter the date the review actually happened. The next review reschedules automatically off the hire date.</p>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1">Employee</label>
                <input value={form.name} onChange={e => { const name = e.target.value; const role = roleForName(name); setForm(f => ({ ...f, name, role: role ?? f.role })); }} list="schedule-emp-names"
                  placeholder="Pick existing or type a new name" className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
                <datalist id="schedule-emp-names">
                  {employees.map(e => <option key={e.id} value={e.name} />)}
                  {staff.filter(s => !employees.some(e => e.name.trim().toLowerCase() === s.name.trim().toLowerCase())).map(s => <option key={s.id} value={s.name} />)}
                </datalist>
              </div>
              <div>
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1">Review date (actual)</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
              </div>
              <div>
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1">Peer reviewers <span className="font-normal normal-case">(comma-separated, optional)</span></label>
                <input value={form.peers} onChange={e => setForm(f => ({ ...f, peers: e.target.value }))}
                  placeholder="e.g. Ally, Paula, JR" className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
              </div>
              <div>
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1">Notes <span className="font-normal normal-case">(optional)</span></label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                  className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink resize-none" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowSchedule(false)}
                className="flex-1 border border-border-light text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-surface-hover transition-colors">
                Cancel
              </button>
              <button onClick={logReview} disabled={saving || !form.name || !form.date}
                className="flex-1 bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark transition-colors disabled:opacity-40">
                {saving ? 'Saving…' : 'Log review'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Send review invites ---- */}
      {showInvite && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6" onClick={e => e.target === e.currentTarget && setShowInvite(false)}>
          <div className="bg-white rounded-card w-full max-w-xl max-h-[90vh] flex flex-col shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="font-spectral text-[18px] font-semibold text-text-primary">Send review invitations</h2>
                <p className="text-xs text-text-muted">Emails each person their form link, who to review, and the deadline.</p>
              </div>
              <button onClick={() => setShowInvite(false)} className="text-text-muted hover:text-text-primary text-xl leading-none">×</button>
            </div>
            <div className="overflow-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1">Employee being reviewed</label>
                  <input value={invite.employee} onChange={e => setInvite(v => ({ ...v, employee: e.target.value }))} list="emp-names"
                    placeholder="e.g. Caitlin Giuliano" className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
                  <datalist id="emp-names">{employees.map(e => <option key={e.id} value={e.name} />)}</datalist>
                </div>
                <div>
                  <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1">Review type</label>
                  <select value={invite.reviewType} onChange={e => setInvite(v => ({ ...v, reviewType: e.target.value }))}
                    className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm bg-white focus:outline-none focus:border-ink">
                    {['', '6-month', '1-year', 'Annual', '90-day'].map(t => <option key={t} value={t}>{t || '—'}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1">Deadline</label>
                  <input type="date" value={invite.deadline} onChange={e => setInvite(v => ({ ...v, deadline: e.target.value }))}
                    className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1">Review form link</label>
                  <input value={invite.link} onChange={e => setInvite(v => ({ ...v, link: e.target.value }))}
                    placeholder="https://firm-evaluator.lovable.app/..." className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-2">Participants</label>
                <div className="space-y-2">
                  {invite.participants.map((p, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <select value={p.name} onChange={e => { const name = e.target.value; const email = emailForName(name); setInvite(v => ({ ...v, participants: v.participants.map((x, j) => j === i ? { ...x, name, email: email || x.email } : x) })); }}
                        className="w-40 border border-border-light rounded-ctrl px-2 py-2 text-sm bg-white focus:outline-none focus:border-ink">
                        <option value="">Select staff…</option>
                        {staff.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                        {p.name && !staff.some(s => s.name === p.name) && <option value={p.name}>{p.name}</option>}
                      </select>
                      <input value={p.email} onChange={e => setInvite(v => ({ ...v, participants: v.participants.map((x, j) => j === i ? { ...x, email: e.target.value } : x) }))}
                        placeholder="email@litson.co" className="flex-1 border border-border-light rounded-ctrl px-2.5 py-2 text-sm focus:outline-none focus:border-ink" />
                      <select value={p.type} onChange={e => { const type = e.target.value; setInvite(v => ({ ...v, participants: v.participants.map((x, j) => j === i ? (type === 'Self-assessment' ? { ...x, type, name: v.employee, email: emailForName(v.employee) || x.email } : { ...x, type }) : x) })); }}
                        className="border border-border-light rounded-ctrl px-2 py-2 text-sm bg-white focus:outline-none focus:border-ink">
                        {['Peer reviewer', 'Self-assessment', 'Manager'].map(t => <option key={t}>{t}</option>)}
                      </select>
                      <button type="button" onClick={() => setInvite(v => ({ ...v, participants: v.participants.map((x, j) => j === i ? { ...x, completed: !x.completed } : x) }))}
                        title={p.completed ? 'Completed — will not be emailed or reminded. Click to set pending.' : 'Mark as completed to skip the invite & reminders'}
                        className={`text-xs font-semibold px-2 py-2 rounded-ctrl border shrink-0 whitespace-nowrap ${p.completed ? 'border-[#2f7d5b] text-[#2f7d5b] bg-[#eef5f1]' : 'border-border-light text-text-muted'}`}>
                        {p.completed ? '✓ Done' : 'Pending'}
                      </button>
                      <button onClick={() => setInvite(v => ({ ...v, participants: v.participants.filter((_, j) => j !== i) }))}
                        className="text-text-muted hover:text-litred-alt text-sm px-1">✕</button>
                    </div>
                  ))}
                </div>
                <button onClick={() => setInvite(v => ({ ...v, participants: [...v.participants, { ...blankParticipant }] }))}
                  className="mt-2 text-sm font-semibold text-text-muted hover:text-ink">+ Add participant</button>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex gap-2 justify-end items-center">
              <span className="text-xs text-text-muted mr-auto">A copy is CC'd to you.</span>
              <button onClick={() => setShowInvite(false)} className="border border-border-light text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-canvas">Cancel</button>
              <button onClick={previewInvites} className="border border-border-light text-ink text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-canvas">👁 Preview</button>
              <button onClick={saveForReminders} disabled={inviteBusy} title="Records these participants so reminders go out, without sending an email now"
                className="border border-border-light text-ink text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-canvas disabled:opacity-40">🔔 Save for reminders (no email)</button>
              <button onClick={sendInvites} disabled={inviteBusy} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark disabled:opacity-40">{inviteBusy ? 'Sending…' : 'Send invitations'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Review reminders manager ---- */}
      {showReminders && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6" onClick={e => e.target === e.currentTarget && setShowReminders(false)}>
          <div className="bg-white rounded-card w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="font-spectral text-[18px] font-semibold text-text-primary">Review reminders</h2>
                <p className="text-xs text-text-muted">Mark a participant <b>Complete</b> to stop their reminders. Pending ones still get the 3-day &amp; 1-day nudges.</p>
              </div>
              <button onClick={() => setShowReminders(false)} className="text-text-muted hover:text-text-primary text-xl leading-none">×</button>
            </div>
            <div className="overflow-auto p-6 space-y-5">
              {invites.length === 0 ? (
                <p className="text-sm text-text-muted text-center py-6">No tracked invites yet. Send invites (or use “Save for reminders”) to add participants here.</p>
              ) : (
                Object.entries(invites.reduce((acc, inv) => { (acc[inv.employee] ??= []).push(inv); return acc; }, {} as Record<string, typeof invites>)).map(([emp, list]) => (
                  <div key={emp}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[13px] font-semibold text-text-primary">{emp}</div>
                      <div className="text-xs text-text-muted">{list[0].review_type ? `${list[0].review_type} · ` : ''}{list[0].deadline ? `due ${formatDate(list[0].deadline)}` : ''}</div>
                    </div>
                    <div className="border border-border-light rounded-ctrl divide-y divide-[#f1ece3]">
                      {list.map(inv => (
                        <div key={inv.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-text-primary truncate">{inv.participant_name || inv.participant_email}</div>
                            <div className="text-xs text-text-muted truncate">{inv.participant_type ?? 'Participant'} · {inv.participant_email}</div>
                          </div>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${inv.completed ? 'bg-[#eef5f1] text-[#2f7d5b]' : 'bg-[#f7efe1] text-[#b07d2a]'}`}>
                            {inv.completed ? 'Complete' : 'Pending'}
                          </span>
                          <button onClick={() => toggleInviteDone(inv.id, !inv.completed)}
                            className={`text-xs font-semibold px-3 py-1 rounded-ctrl border shrink-0 ${inv.completed ? 'border-border-light text-ink hover:bg-canvas' : 'border-[#2f7d5b] text-[#2f7d5b] hover:bg-[#eef5f1]'}`}>
                            {inv.completed ? '↺ Mark pending' : '✓ Mark complete'}
                          </button>
                          <button onClick={() => removeInvite(inv.id)} title="Remove — no more reminders"
                            className="text-text-muted hover:text-litred-alt text-sm px-1 shrink-0">✕</button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end">
              <button onClick={() => setShowReminders(false)} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark">Done</button>
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

      {/* ---- Embedded Reports (Lovable link) ---- */}
      {showEmbed && linkedUrl && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
          <div className="flex items-center gap-3 px-4 py-2.5 bg-[#f1ece3] border-b border-border flex-shrink-0">
            <span className="w-2 h-2 rounded-full bg-[#2f7d5b] shrink-0" />
            <span className="text-sm font-semibold text-text-primary shrink-0">Performance Review Reports</span>
            <span className="text-xs text-text-muted truncate flex-1">{reportsUrl(linkedUrl)}</span>
            <a href={reportsUrl(linkedUrl)} target="_blank" rel="noopener noreferrer"
              className="shrink-0 text-xs font-semibold text-text-secondary hover:text-ink border border-border-light bg-white px-3 py-1 rounded-ctrl">↗ Open in new tab</a>
            <button onClick={() => setShowEmbed(false)}
              className="shrink-0 text-xs font-semibold text-white bg-ink px-3 py-1 rounded-ctrl hover:bg-ink-dark">✕ Close</button>
          </div>
          <iframe
            src={reportsUrl(linkedUrl)}
            className="flex-1 w-full border-0"
            title="Performance Review Reports"
            allow="clipboard-read; clipboard-write"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
          />
        </div>
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
  const history = parseHistory(employee.review_history);
  const latest = history.length ? history.slice().sort((a, b) => a.date.localeCompare(b.date))[history.length - 1] : null;
  const [lastRev, setLastRev] = useState(employee.last_review_date?.slice(0, 10) ?? latest?.date ?? '');
  const [peers, setPeers] = useState((latest?.peer_reviewers ?? []).join(', '));
  const [summary, setSummary] = useState(latest?.notes ?? employee.review_notes ?? '');
  const [busy, setBusy] = useState(false);
  const [docs, setDocs] = useState<{ '6mo': string | null; '1yr': string | null }>({ '6mo': null, '1yr': null });
  const [uploading, setUploading] = useState<'6mo' | '1yr' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const targetRef = useRef<'6mo' | '1yr'>('6mo');

  useEffect(() => {
    fetch(`/api/reviews/docs?id=${employee.id}&meta=1`).then(r => r.json())
      .then(d => setDocs(d.meta ?? { '6mo': null, '1yr': null })).catch(() => {});
  }, [employee.id]);

  function pickFile(target: '6mo' | '1yr') { targetRef.current = target; fileRef.current?.click(); }
  async function uploadDoc(file: File) {
    const target = targetRef.current;
    setUploading(target);
    try {
      const fd = new FormData(); fd.append('id', employee.id); fd.append('which', target); fd.append('file', file);
      const res = await fetch('/api/reviews/docs', { method: 'POST', body: fd });
      const d = await res.json();
      if (!res.ok) { alert(d.error ?? 'Upload failed'); return; }
      setDocs(prev => ({ ...prev, [target]: d.name }));
    } catch { alert('Upload failed'); }
    setUploading(null);
  }
  async function removeDoc(target: '6mo' | '1yr') {
    if (!confirm('Remove this document?')) return;
    setDocs(prev => ({ ...prev, [target]: null }));
    await fetch('/api/reviews/docs', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: employee.id, which: target }) });
  }

  async function save() {
    setBusy(true);
    try {
      // Rebuild history: the latest entry carries the current last review date,
      // peer reviewers and notes. Older entries are preserved.
      const older = history.slice().sort((a, b) => a.date.localeCompare(b.date)).slice(0, -1);
      const peerList = peers.split(',').map(s => s.trim()).filter(Boolean);
      const rebuilt = lastRev
        ? [...older, { date: lastRev, peer_reviewers: peerList, notes: summary }]
        : older;
      await onSave({
        name: name.trim() || employee.name,
        role: role.trim() || employee.role,
        dept: dept.trim() || employee.dept,
        hire_date: hire || null,
        last_review_date: lastRev || null,
        review_history: JSON.stringify(rebuilt),
        review_notes: summary || null,
      });
    } finally {
      setBusy(false);
    }
  }
  // Computed next review for read-only display in the drawer.
  const drawerNext = computeReview(hire || null, lastRev || null, new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' }));

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

          {/* Shared hidden picker for document uploads */}
          <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.txt,.csv,.xlsx,.xls,.png,.jpg,.jpeg" className="hidden"
            onChange={e => { if (e.target.files?.[0]) { uploadDoc(e.target.files[0]); e.target.value = ''; } }} />

          {/* Review documents */}
          {([['6-Month Review Document', '6mo', '#2f7d5b'], ['1-Year Review Document', '1yr', '#3f6b8a']] as [string, '6mo' | '1yr', string][]).map(([label, which, color]) => (
            <div key={which}>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold uppercase tracking-wide" style={{ color }}>{label}</label>
                <button onClick={() => pickFile(which)} disabled={uploading !== null}
                  className="text-xs font-semibold text-ink hover:underline disabled:opacity-50">{uploading === which ? 'Uploading…' : (docs[which] ? '↑ Replace' : '↑ Upload document')}</button>
              </div>
              {docs[which] ? (
                <div className="flex items-center gap-2 border border-border-light rounded-ctrl px-3 py-2 text-sm bg-canvas">
                  <span className="flex-1 truncate">📄 {docs[which]}</span>
                  <a href={`/api/reviews/docs?id=${employee.id}&which=${which}`} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-[#3f6b8a] hover:underline">View</a>
                  <button onClick={() => removeDoc(which)} className="text-xs font-semibold text-litred-alt hover:underline">Remove</button>
                </div>
              ) : (
                <div className="border border-dashed border-border-light rounded-ctrl px-3 py-2 text-xs text-text-muted">No document uploaded yet.</div>
              )}
            </div>
          ))}

          {/* Optional notes */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wide">Notes (optional)</label>
              {linkedUrl && (
                <a href={reportsUrl(linkedUrl)} target="_blank" rel="noopener noreferrer"
                  className="text-xs font-semibold text-[#2f7d5b] hover:underline">Open Reports ↗</a>
              )}
            </div>
            <textarea value={summary} onChange={e => setSummary(e.target.value)} rows={2}
              placeholder="Any short note about this employee (optional)…"
              className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink resize-none" />
          </div>

          <div>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1">Hire date <span className="font-normal normal-case">(review anchor)</span></label>
            <input type="date" value={hire} onChange={e => setHire(e.target.value)}
              className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1">Last review date</label>
              <input type="date" value={lastRev} onChange={e => setLastRev(e.target.value)}
                className="w-full border border-border-light rounded-ctrl px-2 py-2 text-sm focus:outline-none focus:border-ink" />
              <p className="text-[11px] text-text-muted mt-1">The only writable date — everything else derives from it.</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1">Next review <span className="font-normal normal-case">(auto)</span></label>
              <div className="border border-border-light rounded-ctrl px-3 py-2 text-sm bg-canvas">
                {drawerNext.next ? (
                  <>
                    <div className="font-medium text-text-primary">{formatDate(drawerNext.next)}</div>
                    <div className="text-[11px] text-text-muted">{drawerNext.tenure} · cycle {drawerNext.cycle}{drawerNext.status ? ` · ${drawerNext.status}` : ''}</div>
                  </>
                ) : <span className="text-text-muted">Set a hire date</span>}
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1">Peer reviewers <span className="font-normal normal-case">(comma-separated)</span></label>
            <input value={peers} onChange={e => setPeers(e.target.value)} placeholder="e.g. Ally, Paula, JR"
              className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
          </div>

          {history.length > 1 && (
            <div>
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1">Review history</label>
              <div className="border border-border-light rounded-ctrl divide-y divide-[#f1ece3]">
                {history.slice().sort((a, b) => b.date.localeCompare(a.date)).map((h, i) => (
                  <div key={i} className="px-3 py-2 text-sm">
                    <span className="font-medium text-text-primary">{formatDate(h.date)}</span>
                    {h.peer_reviewers.length > 0 && <span className="text-text-muted"> · peers: {h.peer_reviewers.join(', ')}</span>}
                    {h.notes && <div className="text-[12px] text-text-muted mt-0.5">{h.notes}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
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

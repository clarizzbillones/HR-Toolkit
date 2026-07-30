'use client';
import { useState } from 'react';
import { useToast } from '@/components/Toast';
import { useAccess } from '@/components/AccessProvider';

interface Note {
  id: string; employee: string; date: string | null; topic: string; notes: string;
  action_items: string; follow_up_date: string | null; status: string;
}
const EMPTY = { employee: '', date: '', topic: '', notes: '', action_items: '', follow_up_date: '', status: 'Open' };

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(String(iso).slice(0, 10) + 'T12:00:00');
  return isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function CoachingClient({ initialRows, names }: { initialRows: Note[]; names: string[] }) {
  const { showToast } = useToast();
  const { me } = useAccess(); const readOnly = !!me?.restricted;
  const [rows, setRows] = useState<Note[]>(initialRows);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [editId, setEditId] = useState<string | null>(null);
  const [filter, setFilter] = useState('All');

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
  const employees = Array.from(new Set(rows.map(r => r.employee).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const visible = filter === 'All' ? rows : rows.filter(r => r.employee === filter);
  const openFollowUps = rows.filter(r => r.status !== 'Done' && r.follow_up_date).length;

  function set(k: string, v: string) { setForm(p => ({ ...p, [k]: v })); }
  function resetForm() { setForm({ ...EMPTY }); setEditId(null); setShowAdd(false); }
  function startEdit(r: Note) {
    setForm({
      employee: r.employee ?? '', date: r.date ? String(r.date).slice(0, 10) : '', topic: r.topic ?? '',
      notes: r.notes ?? '', action_items: r.action_items ?? '',
      follow_up_date: r.follow_up_date ? String(r.follow_up_date).slice(0, 10) : '', status: r.status ?? 'Open',
    });
    setEditId(r.id); setShowAdd(true);
  }

  async function save() {
    if (!form.employee.trim()) { showToast('Pick an employee'); return; }
    if (editId) {
      const res = await fetch('/api/coaching', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editId, ...form }) });
      const { row } = await res.json();
      if (row) setRows(p => p.map(x => x.id === editId ? row : x));
      resetForm(); showToast('Session updated');
      return;
    }
    const res = await fetch('/api/coaching', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const { row } = await res.json();
    setRows(p => [row, ...p]);
    resetForm(); showToast('Session logged');
  }

  async function remove(r: Note) {
    if (!confirm(`Delete this coaching note for ${r.employee || 'this employee'}?`)) return;
    await fetch(`/api/coaching?id=${encodeURIComponent(r.id)}`, { method: 'DELETE' });
    setRows(p => p.filter(x => x.id !== r.id));
    if (editId === r.id) resetForm();
    showToast('Deleted');
  }

  async function toggleDone(r: Note) {
    const status = r.status === 'Done' ? 'Open' : 'Done';
    const res = await fetch('/api/coaching', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...r, status }) });
    const { row } = await res.json();
    if (row) setRows(p => p.map(x => x.id === r.id ? row : x));
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="px-8 py-5 bg-white border-b border-border flex-shrink-0 flex items-center gap-4 flex-wrap">
        <div>
          <h1 className="font-spectral text-[23px] font-semibold text-text-primary">Coaching</h1>
          <p className="text-sm text-text-muted mt-0.5">{rows.length} session{rows.length === 1 ? '' : 's'} · {openFollowUps} open follow-up{openFollowUps === 1 ? '' : 's'}</p>
        </div>
        <div className="ml-auto flex items-center gap-2.5 flex-wrap">
          <select value={filter} onChange={e => setFilter(e.target.value)}
            className="border border-border-light rounded-ctrl px-3 py-2 text-sm bg-white focus:outline-none focus:border-ink">
            <option value="All">All employees</option>
            {employees.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          {!readOnly && (
            <button onClick={() => { if (showAdd) resetForm(); else { resetForm(); setShowAdd(true); } }}
              className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark">+ Log session</button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-3xl">
          {showAdd && !readOnly && (
            <div className="bg-[#fbf7ee] border border-border rounded-card p-5 mb-5 grid grid-cols-2 gap-4">
              <div className="col-span-2 text-sm font-semibold text-text-primary -mb-1">{editId ? 'Edit coaching session' : 'New coaching session'}</div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Employee *</label>
                <input list="coaching-names" value={form.employee} onChange={e => set('employee', e.target.value)}
                  placeholder="Select or type a name"
                  className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm bg-white focus:outline-none focus:border-ink" />
                <datalist id="coaching-names">{names.map(n => <option key={n} value={n} />)}</datalist>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Date</label>
                <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
                  className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-text-secondary mb-1">Topic</label>
                <input type="text" value={form.topic} onChange={e => set('topic', e.target.value)}
                  placeholder="e.g. Quarterly check-in, performance, career growth"
                  className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-text-secondary mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={4}
                  placeholder="What was discussed…"
                  className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink resize-y" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-text-secondary mb-1">Action items <span className="text-text-muted font-normal">(one per line)</span></label>
                <textarea value={form.action_items} onChange={e => set('action_items', e.target.value)} rows={3}
                  placeholder={"Follow up on training plan\nShare feedback with manager"}
                  className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink resize-y" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Follow-up date</label>
                <input type="date" value={form.follow_up_date} onChange={e => set('follow_up_date', e.target.value)}
                  className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Status</label>
                <select value={form.status} onChange={e => set('status', e.target.value)}
                  className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm bg-white focus:outline-none focus:border-ink">
                  {['Open', 'Done'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="col-span-2 flex gap-2">
                <button onClick={save} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark">{editId ? 'Save changes' : 'Log session'}</button>
                <button onClick={resetForm} className="text-sm text-text-muted px-3">Cancel</button>
              </div>
            </div>
          )}

          {visible.length === 0 ? (
            <div className="text-sm text-text-muted border border-dashed border-border-light rounded-card p-8 text-center">
              No coaching sessions{filter !== 'All' ? ` for ${filter}` : ''} yet.{!readOnly && ' Click “Log session” to add one.'}
            </div>
          ) : (
            <div className="space-y-3">
              {visible.map(r => {
                const overdue = r.status !== 'Done' && r.follow_up_date && String(r.follow_up_date).slice(0, 10) < today;
                const actions = (r.action_items || '').split('\n').map(l => l.trim()).filter(Boolean);
                return (
                  <div key={r.id} className="bg-white border border-border rounded-card p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-text-primary">{r.employee}</div>
                        <div className="text-xs text-text-muted mt-0.5">{r.date ? fmtDate(r.date) : 'No date'}{r.topic ? ` · ${r.topic}` : ''}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => toggleDone(r)} disabled={readOnly}
                          className={`text-xs font-semibold px-2.5 py-0.5 rounded-full disabled:opacity-60 ${r.status === 'Done' ? 'bg-[#eef5f1] text-[#2f7d5b]' : 'bg-[#f7efe1] text-[#b07d2a]'}`}>
                          {r.status === 'Done' ? '✓ Done' : 'Open'}
                        </button>
                      </div>
                    </div>
                    {r.notes && <p className="text-sm text-text-secondary mt-3 whitespace-pre-wrap">{r.notes}</p>}
                    {actions.length > 0 && (
                      <div className="mt-3">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">Action items</div>
                        <ul className="text-sm text-text-secondary space-y-0.5">
                          {actions.map((a, i) => <li key={i} className="flex gap-2"><span className="text-gold-muted">•</span><span>{a}</span></li>)}
                        </ul>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      {r.follow_up_date && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${overdue ? 'bg-[#fdeaea] text-[#b0412f]' : 'bg-[#eef2f7] text-[#3f5a76]'}`}>
                          {overdue ? 'Follow-up overdue' : 'Follow-up'} · {fmtDate(r.follow_up_date)}
                        </span>
                      )}
                      {!readOnly && (
                        <div className="ml-auto flex items-center gap-2">
                          <button onClick={() => startEdit(r)} className="text-xs font-semibold text-ink border border-border-light px-3 py-1 rounded-ctrl hover:bg-canvas">Edit</button>
                          <button onClick={() => remove(r)} className="text-xs font-semibold text-litred-alt border border-border-light px-3 py-1 rounded-ctrl hover:bg-[#fdeaea]">Delete</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

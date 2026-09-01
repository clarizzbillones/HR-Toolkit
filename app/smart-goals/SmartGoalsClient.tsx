'use client';
import { useState } from 'react';
import { useToast } from '@/components/Toast';
import { useAccess } from '@/components/AccessProvider';
import { emptyForm, emptyGoal, emptyFollowUp, defaultCheckins, FOLLOWUP_STATUSES, smartGoalsDocHtml, fmtLong, type SmartGoal, type SmartGoalsRow, type FollowUp } from '@/lib/smartGoals';

type Staff = { name: string; position: string; email: string };
const SMART = [
  { key: 'specific', letter: 'S', label: 'Specific', hint: 'What exactly will be done, and how.' },
  { key: 'measurable', letter: 'M', label: 'Measurable', hint: 'The numbers/metrics that show progress.' },
  { key: 'achievable', letter: 'A', label: 'Achievable', hint: 'Why it is realistic — resources, support, who owns what.' },
  { key: 'relevant', letter: 'R', label: 'Relevant', hint: 'Why this goal matters and what it enables.' },
  { key: 'timeBound', letter: 'T', label: 'Time-bound', hint: '3 / 6 / 12-month milestones.' },
] as const;

export default function SmartGoalsClient({ initialRows, staff }: { initialRows: SmartGoalsRow[]; staff: Staff[] }) {
  const { showToast } = useToast();
  const { me } = useAccess();
  const readOnly = !!me?.restricted && !(me?.editSections ?? []).includes('/coaching');
  const [rows, setRows] = useState<SmartGoalsRow[]>(initialRows);
  const [form, setForm] = useState<Partial<SmartGoalsRow>>(emptyForm());
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [viewRow, setViewRow] = useState<SmartGoalsRow | null>(null);

  const input = 'w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink';
  const set = (patch: Partial<SmartGoalsRow>) => setForm(f => ({ ...f, ...patch }));

  function resetForm() { setForm(emptyForm()); setEditId(null); setShowForm(false); }
  function startNew() { setForm(emptyForm()); setEditId(null); setShowForm(true); }
  function startEdit(r: SmartGoalsRow) {
    setForm({ ...r, review_date: r.review_date ? String(r.review_date).slice(0, 10) : '', goals_prepared: r.goals_prepared ? String(r.goals_prepared).slice(0, 10) : '', goals: r.goals.length ? r.goals : [emptyGoal()], open_items: r.open_items.length ? r.open_items : [''], checkins: (r.checkins && r.checkins.length) ? r.checkins : defaultCheckins() });
    setEditId(r.id); setShowForm(true);
  }

  // Goals
  const goals = form.goals ?? [];
  const setGoal = (i: number, patch: Partial<SmartGoal>) => set({ goals: goals.map((g, j) => j === i ? { ...g, ...patch } : g) });
  const addGoal = () => set({ goals: [...goals, emptyGoal()] });
  const removeGoal = (i: number) => set({ goals: goals.filter((_, j) => j !== i) });
  // Open items
  const items = form.open_items ?? [];
  const setItem = (i: number, v: string) => set({ open_items: items.map((x, j) => j === i ? v : x) });
  const addItem = () => set({ open_items: [...items, ''] });
  const removeItem = (i: number) => set({ open_items: items.filter((_, j) => j !== i) });
  // Follow-up / progress check-ins
  const checkins = form.checkins ?? [];
  const setCheckin = (i: number, patch: Partial<FollowUp>) => set({ checkins: checkins.map((c, j) => j === i ? { ...c, ...patch } : c) });
  const addCheckin = () => set({ checkins: [...checkins, emptyFollowUp()] });
  const removeCheckin = (i: number) => set({ checkins: checkins.filter((_, j) => j !== i) });

  function pickEmployee(name: string) {
    const s = staff.find(x => x.name === name);
    set({ employee: name, employee_email: s?.email ?? form.employee_email });
  }
  function pickReviewer(name: string) {
    const s = staff.find(x => x.name === name);
    set({ reviewer: name, reviewer_position: s?.position ?? form.reviewer_position });
  }

  async function save() {
    if (!String(form.employee ?? '').trim()) { showToast('Pick an employee'); return; }
    const payload = { ...form, goals, open_items: items.filter(x => x.trim() !== ''), checkins };
    if (editId) {
      const res = await fetch('/api/smart-goals', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editId, ...payload }) });
      const { row } = await res.json();
      if (row) setRows(p => p.map(x => x.id === editId ? row : x));
    } else {
      const res = await fetch('/api/smart-goals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const { row } = await res.json();
      if (row) setRows(p => [row, ...p]);
    }
    resetForm();
    showToast('Saved');
  }
  async function remove(r: SmartGoalsRow) {
    if (!confirm(`Delete the SMART goals form for ${r.employee || 'this employee'}?`)) return;
    await fetch(`/api/smart-goals?id=${encodeURIComponent(r.id)}`, { method: 'DELETE' });
    setRows(p => p.filter(x => x.id !== r.id));
  }

  function docShell(r: SmartGoalsRow) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>SMART Goals — ${r.employee}</title>
<style>@page{size:letter;margin:0.5in}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0;background:#faf8f4;padding:22px}</style></head>
<body><div style="max-width:720px;margin:0 auto">${smartGoalsDocHtml(r)}</div></body></html>`;
  }
  function printDoc(r: SmartGoalsRow) { const w = window.open('', '_blank'); if (!w) return; w.document.write(docShell(r) + '<script>window.onload=function(){window.print()}<\/script>'); w.document.close(); }
  function downloadWord(r: SmartGoalsRow) {
    const blob = new Blob([docShell(r)], { type: 'application/msword' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `SMART-Goals-${String(r.employee).replace(/[^\w]+/g, '-')}.doc`; a.click(); URL.revokeObjectURL(a.href);
  }

  const currentForm: SmartGoalsRow = { id: editId ?? 'preview', employee: form.employee ?? '', reviewer: form.reviewer ?? '', reviewer_position: form.reviewer_position ?? '', review_date: form.review_date, goals_prepared: form.goals_prepared, milestones: form.milestones ?? '', goals, open_items: items, checkins };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="flex items-center px-8 py-5 bg-white border-b border-border flex-shrink-0">
        <div>
          <h1 className="font-spectral text-[24px] font-semibold text-text-primary">SMART Goals</h1>
          <p className="text-sm text-text-muted mt-0.5">SMART Performance Development Goals — structured, per employee.</p>
        </div>
        {!readOnly && (
          <button onClick={showForm ? resetForm : startNew} className="ml-auto bg-ink text-white text-sm font-semibold px-4 py-2.5 rounded-ctrl hover:bg-ink-dark">
            {showForm ? 'Close' : '+ New SMART goals form'}
          </button>
        )}
      </header>

      <div className="flex-1 overflow-auto p-8">
        {showForm && !readOnly && (
          <div className="bg-white border border-border rounded-card p-6 mb-6 max-w-4xl">
            <div className="text-sm font-semibold text-text-primary mb-4">{editId ? 'Edit SMART goals form' : 'New SMART goals form'}</div>
            {/* Header fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Employee</label>
                <input list="sg-staff" value={form.employee ?? ''} onChange={e => pickEmployee(e.target.value)} placeholder="Name" className={input} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Reviewer</label>
                <input list="sg-staff" value={form.reviewer ?? ''} onChange={e => pickReviewer(e.target.value)} placeholder="Reviewer name" className={input} />
              </div>
              <datalist id="sg-staff">{staff.map(s => <option key={s.name} value={s.name} />)}</datalist>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Review date</label>
                <input type="date" value={form.review_date ?? ''} onChange={e => set({ review_date: e.target.value })} className={input} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Goals prepared</label>
                <input type="date" value={form.goals_prepared ?? ''} onChange={e => set({ goals_prepared: e.target.value })} className={input} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-text-secondary mb-1">Milestones</label>
                <input value={form.milestones ?? ''} onChange={e => set({ milestones: e.target.value })} placeholder="e.g. 3 months (Nov 2026) · 6 months (Feb 2027) · 12 months (Aug 2027)" className={input} />
              </div>
            </div>

            {/* Goals */}
            <div className="mt-6 space-y-4">
              {goals.map((g, i) => (
                <div key={g.id} className="border border-border-light rounded-card p-4 bg-[#fbf9f4]">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Goal {i + 1}</span>
                    <input value={g.title} onChange={e => setGoal(i, { title: e.target.value })} placeholder="Goal title (e.g. Create and Protect Capacity)" className="flex-1 border border-border-light rounded-ctrl px-3 py-1.5 text-sm font-semibold focus:outline-none focus:border-ink" />
                    {goals.length > 1 && <button onClick={() => removeGoal(i)} title="Remove goal" className="text-text-muted hover:text-litred-alt text-sm">✕ Remove</button>}
                  </div>
                  <div className="space-y-3">
                    {SMART.map(s => (
                      <div key={s.key} className="flex gap-3">
                        <span className="shrink-0 w-7 h-7 rounded bg-ink text-gold font-bold text-sm flex items-center justify-center mt-0.5">{s.letter}</span>
                        <div className="flex-1">
                          <div className="text-xs font-semibold text-text-primary">{s.label} <span className="font-normal text-text-faint">— {s.hint}</span></div>
                          <textarea value={(g as any)[s.key] ?? ''} onChange={e => setGoal(i, { [s.key]: e.target.value } as any)} rows={2} className={input + ' mt-1 resize-y'} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <button onClick={addGoal} className="w-full border-2 border-dashed border-border-light rounded-card py-2.5 text-sm font-semibold text-text-muted hover:text-ink hover:border-ink">+ Add goal</button>
            </div>

            {/* Open items */}
            <div className="mt-6">
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Open items for reviewer</label>
              <div className="space-y-2">
                {items.map((it, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-sm text-text-muted mt-2">{i + 1}.</span>
                    <input value={it} onChange={e => setItem(i, e.target.value)} placeholder="Item to confirm before finalizing" className={input} />
                    {items.length > 1 && <button onClick={() => removeItem(i)} className="text-text-muted hover:text-litred-alt text-sm px-1">✕</button>}
                  </div>
                ))}
                <button onClick={addItem} className="text-xs font-semibold text-[#3f6b8a] hover:underline">+ Add item</button>
              </div>
            </div>

            {/* Follow-up & progress — the 3 / 6 / 12-month benchmarks */}
            <div className="mt-6">
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Follow-up &amp; progress <span className="font-normal text-text-faint">— check-in dates and progress at each benchmark</span></label>
              <div className="space-y-2">
                {checkins.map((c, i) => (
                  <div key={c.id} className="border border-border-light rounded-card p-3 bg-[#fbf9f4]">
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_130px] gap-2">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-0.5">Benchmark</label>
                        <input value={c.label} onChange={e => setCheckin(i, { label: e.target.value })} placeholder="3-month" className={input} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-0.5">Follow-up due</label>
                        <input type="date" value={c.due} onChange={e => setCheckin(i, { due: e.target.value })} className={input} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-0.5">Status</label>
                        <select value={c.status} onChange={e => setCheckin(i, { status: e.target.value })} className={input + ' bg-white'}>
                          {FOLLOWUP_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="mt-2">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-0.5">Progress made</label>
                      <textarea value={c.progress} onChange={e => setCheckin(i, { progress: e.target.value })} rows={2} placeholder="Progress at this check-in…" className={input + ' resize-y'} />
                    </div>
                    {checkins.length > 1 && <button onClick={() => removeCheckin(i)} className="mt-1.5 text-xs text-text-muted hover:text-litred-alt">✕ Remove benchmark</button>}
                  </div>
                ))}
                <button onClick={addCheckin} className="text-xs font-semibold text-[#3f6b8a] hover:underline">+ Add follow-up benchmark</button>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button onClick={save} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark">{editId ? 'Save changes' : 'Save form'}</button>
              <button onClick={() => setViewRow(currentForm)} className="bg-white border border-border-light text-ink text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-canvas">Preview</button>
              <button onClick={resetForm} className="text-sm text-text-muted px-3">Cancel</button>
            </div>
          </div>
        )}

        {/* List */}
        {rows.length === 0 ? (
          <div className="text-sm text-text-muted border border-dashed border-border-light rounded-card p-10 text-center max-w-md">No SMART goals forms yet.{!readOnly && ' Click “+ New SMART goals form” to create one.'}</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rows.map(r => (
              <div key={r.id} className="bg-white border border-border rounded-card p-5">
                <div className="font-semibold text-text-primary">{r.employee || '—'}</div>
                <div className="text-xs text-text-muted mt-0.5">Reviewer: {r.reviewer || '—'}{r.review_date ? ` · ${fmtLong(r.review_date)}` : ''}</div>
                <div className="text-xs text-text-muted mt-2">{r.goals.length} goal{r.goals.length === 1 ? '' : 's'}</div>
                {(() => {
                  const next = (r.checkins ?? []).filter(c => c.due && c.status !== 'Complete').sort((a, b) => a.due.localeCompare(b.due))[0];
                  return next ? <div className="text-xs font-semibold text-[#b07d2a] mt-1">Follow-up due {fmtLong(next.due)}{next.label ? ` · ${next.label}` : ''}</div> : null;
                })()}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => setViewRow(r)} className="text-xs font-semibold text-ink border border-border-light px-2.5 py-1 rounded-ctrl hover:bg-canvas">View</button>
                  <button onClick={() => printDoc(r)} className="text-xs font-semibold text-ink border border-border-light px-2.5 py-1 rounded-ctrl hover:bg-canvas">PDF</button>
                  <button onClick={() => downloadWord(r)} className="text-xs font-semibold text-ink border border-border-light px-2.5 py-1 rounded-ctrl hover:bg-canvas">Word</button>
                  {!readOnly && <button onClick={() => startEdit(r)} className="text-xs font-semibold text-ink border border-border-light px-2.5 py-1 rounded-ctrl hover:bg-canvas">Edit</button>}
                  {!readOnly && <button onClick={() => remove(r)} className="text-xs font-semibold text-litred-alt border border-border-light px-2.5 py-1 rounded-ctrl hover:bg-[#fdeaea]">Delete</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* View modal */}
      {viewRow && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center overflow-auto p-6" onClick={() => setViewRow(null)}>
          <div className="bg-white rounded-card max-w-3xl w-full my-6 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-end gap-2 mb-3">
              <button onClick={() => printDoc(viewRow)} className="text-xs font-semibold text-ink border border-border-light px-2.5 py-1 rounded-ctrl hover:bg-canvas">PDF</button>
              <button onClick={() => downloadWord(viewRow)} className="text-xs font-semibold text-ink border border-border-light px-2.5 py-1 rounded-ctrl hover:bg-canvas">Word</button>
              <button onClick={() => setViewRow(null)} className="text-xs font-semibold text-text-muted px-2">Close</button>
            </div>
            <div dangerouslySetInnerHTML={{ __html: smartGoalsDocHtml(viewRow) }} />
          </div>
        </div>
      )}
    </div>
  );
}

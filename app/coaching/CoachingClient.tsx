'use client';
import { useState, useRef } from 'react';
import { useToast } from '@/components/Toast';
import { useAccess } from '@/components/AccessProvider';
import { COACHING_TYPES, coachingDraft, coachingDocHtml } from '@/lib/coachingDoc';

interface Staff { name: string; position: string; email: string }
interface Signatory { name: string; position: string; role?: string; email?: string; signed_at?: string | null; signature_name?: string | null }
interface Row {
  id: string; employee: string; employee_email: string | null; coach_name: string; coach_position: string;
  coach_email: string | null; coaching_type: string; date: string | null; topic: string; notes: string;
  action_items: string; signatories: string; follow_up_date: string | null; status: string;
  submitted_at: string | null; signed_at: string | null; signature_name: string | null;
}
const EMPTY = {
  employee: '', employee_email: '', coach_name: '', coach_position: '', coach_email: '',
  coaching_type: 'Weekly', date: '', topic: '', notes: coachingDraft('Weekly'), action_items: '',
  signatories: [] as Signatory[], follow_up_date: '', status: 'Draft',
};

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(String(iso).slice(0, 10) + 'T12:00:00');
  return isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
const STATUS_PILL: Record<string, string> = {
  Draft: 'bg-[#f1ece3] text-[#8b8478]', Sent: 'bg-[#eef2f7] text-[#3f5a76]', Signed: 'bg-[#eef5f1] text-[#2f7d5b]',
};

export default function CoachingClient({ initialRows, staff }: { initialRows: Row[]; staff: Staff[] }) {
  const { showToast } = useToast();
  const { me } = useAccess(); const readOnly = !!me?.restricted;
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<typeof EMPTY>({ ...EMPTY });
  const [editId, setEditId] = useState<string | null>(null);
  const [filter, setFilter] = useState('All');
  const [viewRow, setViewRow] = useState<Row | null>(null);

  const posOf = (name: string) => staff.find(s => s.name === name)?.position ?? '';
  const emailOf = (name: string) => staff.find(s => s.name === name)?.email ?? '';
  const names = staff.map(s => s.name);

  const employees = Array.from(new Set(rows.map(r => r.employee).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const visible = filter === 'All' ? rows : rows.filter(r => r.employee === filter);

  const notesRef = useRef<HTMLTextAreaElement>(null);
  function set(k: keyof typeof EMPTY, v: any) { setForm(p => ({ ...p, [k]: v })); }
  // Bold / italic / bullet toolbar for the coaching notes.
  function applyNoteFmt(kind: 'bold' | 'italic' | 'bullet') {
    const ta = notesRef.current; if (!ta) return;
    const start = ta.selectionStart, end = ta.selectionEnd, val = form.notes;
    let next: string, caret: number;
    if (kind === 'bullet') {
      const lineStart = val.lastIndexOf('\n', start - 1) + 1;
      const block = val.slice(lineStart, Math.max(end, start));
      const bulleted = (block || '').split('\n').map(l => /^\s*[•\-]\s/.test(l) ? l : '• ' + l).join('\n');
      next = val.slice(0, lineStart) + bulleted + val.slice(Math.max(end, start));
      caret = lineStart + bulleted.length;
    } else {
      const mark = kind === 'bold' ? '**' : '*';
      const sel = val.slice(start, end) || (kind === 'bold' ? 'bold text' : 'italic text');
      next = val.slice(0, start) + mark + sel + mark + val.slice(end);
      caret = start + mark.length + sel.length + mark.length;
    }
    set('notes', next);
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(caret, caret); });
  }
  function resetForm() { setForm({ ...EMPTY, notes: coachingDraft('Weekly') }); setEditId(null); setShowForm(false); }

  function pickEmployee(name: string) { setForm(p => ({ ...p, employee: name, employee_email: emailOf(name) })); }
  function pickCoach(name: string) { setForm(p => ({ ...p, coach_name: name, coach_position: posOf(name), coach_email: emailOf(name) })); }
  function pickType(type: string) {
    // Refresh the standard draft only if the coach hasn't edited it away.
    setForm(p => ({ ...p, coaching_type: type, notes: (!p.notes.trim() || COACHING_TYPES.some(t => p.notes === coachingDraft(t))) ? coachingDraft(type) : p.notes }));
  }
  function addSignatory() { setForm(p => ({ ...p, signatories: [...p.signatories, { name: '', position: '', role: 'Reviewer' }] })); }
  function setSignatory(i: number, name: string) {
    setForm(p => ({ ...p, signatories: p.signatories.map((s, j) => j === i ? { ...s, name, position: posOf(name) || s.position, email: emailOf(name) || (s as any).email } : s) }));
  }
  function removeSignatory(i: number) { setForm(p => ({ ...p, signatories: p.signatories.filter((_, j) => j !== i) })); }

  function startEdit(r: Row) {
    let sig: Signatory[] = [];
    try { sig = JSON.parse(r.signatories || '[]'); } catch { /* ignore */ }
    setForm({
      employee: r.employee ?? '', employee_email: r.employee_email ?? '', coach_name: r.coach_name ?? '',
      coach_position: r.coach_position ?? '', coach_email: r.coach_email ?? '', coaching_type: r.coaching_type ?? 'Weekly',
      date: r.date ? String(r.date).slice(0, 10) : '', topic: r.topic ?? '', notes: r.notes ?? '', action_items: r.action_items ?? '',
      signatories: sig, follow_up_date: r.follow_up_date ? String(r.follow_up_date).slice(0, 10) : '', status: r.status ?? 'Draft',
    });
    setEditId(r.id); setShowForm(true);
  }

  async function save(): Promise<Row | null> {
    if (!form.employee.trim()) { showToast('Pick an employee'); return null; }
    const payload = { ...form };
    if (editId) {
      const res = await fetch('/api/coaching', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editId, ...payload }) });
      const { row } = await res.json();
      if (row) setRows(p => p.map(x => x.id === editId ? row : x));
      return row ?? null;
    }
    const res = await fetch('/api/coaching', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const { row } = await res.json();
    if (row) { setRows(p => [row, ...p]); setEditId(row.id); }
    return row ?? null;
  }

  async function saveDraft() { const r = await save(); if (r) { showToast('Draft saved'); resetForm(); } }

  async function submitForSignature() {
    const saved = await save();
    if (!saved) return;
    const res = await fetch('/api/coaching', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: saved.id, action: 'send' }) });
    const d = await res.json();
    if (d.row) setRows(p => p.map(x => x.id === saved.id ? d.row : x));
    if (d.emailed) showToast(`Sent to ${d.recipients > 1 ? `${d.recipients} signatories` : 'the signatory'} to sign`);
    else {
      // Fall back to a copyable link if email isn't configured / no address on file.
      try { await navigator.clipboard.writeText(d.signUrl); } catch { /* ignore */ }
      window.prompt(d.emailError ? `${d.emailError}\n\nShare this signing link:` : 'Signing link (copied):', d.signUrl);
    }
    resetForm();
  }

  async function remove(r: Row) {
    if (!confirm(`Delete this coaching form for ${r.employee || 'this employee'}?`)) return;
    await fetch(`/api/coaching?id=${encodeURIComponent(r.id)}`, { method: 'DELETE' });
    setRows(p => p.filter(x => x.id !== r.id));
    if (editId === r.id) resetForm();
    showToast('Deleted');
  }

  function printDoc(r: Row) {
    const win = window.open('', '_blank'); if (!win) return;
    // print-color-adjust keeps the navy/gold branding in the printed PDF.
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Coaching — ${r.employee}</title>
<style>@page{size:letter;margin:0.55in}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0;background:#faf8f4;padding:20px}</style>
</head><body>${coachingDocHtml(r)}<script>window.onload=function(){window.print()}</script></body></html>`);
    win.document.close();
  }
  function downloadWord(r: Row) {
    // Full HTML doc with the same branded body so Word keeps colors/formatting.
    const html = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8">
<style>@page{margin:0.6in}body{background:#faf8f4;padding:16px}</style></head><body>${coachingDocHtml(r)}</body></html>`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + html], { type: 'application/msword' }));
    a.download = `coaching-${(r.employee || 'form').replace(/\s+/g, '-')}.doc`;
    a.click();
  }

  const input = 'w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink';

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="px-8 py-5 bg-white border-b border-border flex-shrink-0 flex items-center gap-4 flex-wrap">
        <div>
          <h1 className="font-spectral text-[23px] font-semibold text-text-primary">Coaching</h1>
          <p className="text-sm text-text-muted mt-0.5">{rows.length} form{rows.length === 1 ? '' : 's'} · {rows.filter(r => r.status === 'Signed').length} signed</p>
        </div>
        <div className="ml-auto flex items-center gap-2.5 flex-wrap">
          <select value={filter} onChange={e => setFilter(e.target.value)} className="border border-border-light rounded-ctrl px-3 py-2 text-sm bg-white focus:outline-none focus:border-ink">
            <option value="All">All employees</option>
            {employees.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          {!readOnly && <button onClick={() => { if (showForm) resetForm(); else { resetForm(); setShowForm(true); } }} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark">+ New coaching form</button>}
        </div>
      </header>

      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-3xl">
          {showForm && !readOnly && (
            <div className="bg-[#fbf7ee] border border-border rounded-card p-5 mb-6 grid grid-cols-2 gap-4">
              <div className="col-span-2 text-sm font-semibold text-text-primary -mb-1">{editId ? 'Edit coaching form' : 'New coaching form'}</div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Employee *</label>
                <select value={form.employee} onChange={e => pickEmployee(e.target.value)} className={input + ' bg-white'}>
                  <option value="">Select employee…</option>
                  {names.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Coaching type</label>
                <select value={form.coaching_type} onChange={e => pickType(e.target.value)} className={input + ' bg-white'}>
                  {COACHING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Submitted by (coach)</label>
                <select value={form.coach_name} onChange={e => pickCoach(e.target.value)} className={input + ' bg-white'}>
                  <option value="">Select…</option>
                  {names.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Coach position <span className="text-text-muted font-normal">(auto)</span></label>
                <input value={form.coach_position} onChange={e => set('coach_position', e.target.value)} className={input} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Coaching date</label>
                <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className={input} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Follow-up date</label>
                <input type="date" value={form.follow_up_date} onChange={e => set('follow_up_date', e.target.value)} className={input} />
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-semibold text-text-secondary mb-1">Topic</label>
                <input value={form.topic} onChange={e => set('topic', e.target.value)} placeholder="e.g. 30-day check-in" className={input} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-text-secondary mb-1">Coaching notes <span className="text-text-muted font-normal">(standard draft — edit freely)</span></label>
                <div className="flex items-center gap-1 mb-1.5">
                  <button type="button" onClick={() => applyNoteFmt('bold')} title="Bold (**text**)" className="px-2.5 py-1 text-sm font-bold rounded-ctrl border border-border-light text-text-secondary hover:border-ink hover:text-text-primary">B</button>
                  <button type="button" onClick={() => applyNoteFmt('italic')} title="Italic (*text*)" className="px-2.5 py-1 text-sm italic rounded-ctrl border border-border-light text-text-secondary hover:border-ink hover:text-text-primary">I</button>
                  <button type="button" onClick={() => applyNoteFmt('bullet')} title="Bullet the line(s)" className="px-2.5 py-1 text-sm rounded-ctrl border border-border-light text-text-secondary hover:border-ink hover:text-text-primary">• List</button>
                </div>
                <textarea ref={notesRef} value={form.notes} onChange={e => set('notes', e.target.value)} rows={10} className={input + ' resize-y text-[13px]'} />
                <p className="text-[11px] text-text-muted mt-1"><code>**bold**</code>, <code>*italic*</code>, and lines starting with • become bullets in the document.</p>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-text-secondary mb-1">Action items <span className="text-text-muted font-normal">(one per line)</span></label>
                <textarea value={form.action_items} onChange={e => set('action_items', e.target.value)} rows={3} className={input + ' resize-y'} />
              </div>

              <div className="col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-text-secondary">Signatories</label>
                  <button onClick={addSignatory} className="text-[11px] font-semibold text-[#3f6b8a] hover:underline">+ Add signatory</button>
                </div>
                {form.signatories.length === 0 && <p className="text-[11px] text-text-muted">No signatories added.</p>}
                <div className="space-y-2">
                  {form.signatories.map((s, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <select value={s.name} onChange={e => setSignatory(i, e.target.value)} className={input + ' bg-white flex-1'}>
                        <option value="">Select name…</option>
                        {names.map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                      <select value={s.role ?? 'Reviewer'} onChange={e => setForm(p => ({ ...p, signatories: p.signatories.map((x, j) => j === i ? { ...x, role: e.target.value } : x) }))} className={input + ' bg-white w-28 shrink-0'}>
                        {['Reviewer', 'Reviewee'].map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <input value={s.position} onChange={e => setForm(p => ({ ...p, signatories: p.signatories.map((x, j) => j === i ? { ...x, position: e.target.value } : x) }))} placeholder="Position" className={input + ' flex-1'} />
                      <button onClick={() => removeSignatory(i)} className="text-text-muted hover:text-litred-alt text-sm px-1">✕</button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="col-span-2 flex items-center gap-2 flex-wrap pt-1">
                <button onClick={submitForSignature} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark">Submit &amp; send for signature</button>
                <button onClick={saveDraft} className="bg-white border border-border-light text-ink text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-canvas">Save draft</button>
                <button onClick={resetForm} className="text-sm text-text-muted px-3">Cancel</button>
              </div>
            </div>
          )}

          {visible.length === 0 ? (
            <div className="text-sm text-text-muted border border-dashed border-border-light rounded-card p-8 text-center">
              No coaching forms{filter !== 'All' ? ` for ${filter}` : ''} yet.{!readOnly && ' Click “New coaching form” to start.'}
            </div>
          ) : (
            <div className="space-y-3">
              {visible.map(r => (
                <div key={r.id} className="bg-white border border-border rounded-card p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-text-primary">{r.employee}</div>
                      <div className="text-xs text-text-muted mt-0.5">{r.coaching_type}{r.date ? ` · ${fmtDate(r.date)}` : ''}{r.coach_name ? ` · by ${r.coach_name}` : ''}</div>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full shrink-0 ${STATUS_PILL[r.status] ?? STATUS_PILL.Draft}`}>{r.status}</span>
                  </div>
                  {r.signed_at && <div className="text-xs text-[#2f7d5b] mt-2">✓ Signed by {r.signature_name} · {fmtDate(r.signed_at)}</div>}
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <button onClick={() => setViewRow(r)} className="text-xs font-semibold text-ink border border-border-light px-3 py-1 rounded-ctrl hover:bg-canvas">View</button>
                    <button onClick={() => printDoc(r)} className="text-xs font-semibold text-ink border border-border-light px-3 py-1 rounded-ctrl hover:bg-canvas">⤓ PDF</button>
                    <button onClick={() => downloadWord(r)} className="text-xs font-semibold text-ink border border-border-light px-3 py-1 rounded-ctrl hover:bg-canvas">⤓ Word</button>
                    {!readOnly && (
                      <div className="ml-auto flex items-center gap-2">
                        {r.status !== 'Signed' && <button onClick={() => startEdit(r)} className="text-xs font-semibold text-ink border border-border-light px-3 py-1 rounded-ctrl hover:bg-canvas">Edit</button>}
                        <button onClick={() => remove(r)} className="text-xs font-semibold text-litred-alt border border-border-light px-3 py-1 rounded-ctrl hover:bg-[#fdeaea]">Delete</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {viewRow && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-6 overflow-auto" onClick={() => setViewRow(null)}>
          <div className="bg-white rounded-card w-full max-w-2xl shadow-xl my-4" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <span className="text-sm font-semibold text-text-secondary">Coaching form</span>
              <div className="flex items-center gap-2">
                <button onClick={() => printDoc(viewRow)} className="text-xs font-semibold text-ink border border-border-light px-3 py-1.5 rounded-ctrl hover:bg-canvas">⤓ PDF</button>
                <button onClick={() => downloadWord(viewRow)} className="text-xs font-semibold text-ink border border-border-light px-3 py-1.5 rounded-ctrl hover:bg-canvas">⤓ Word</button>
                <button onClick={() => setViewRow(null)} className="text-text-muted hover:text-text-primary text-xl leading-none">×</button>
              </div>
            </div>
            <div className="p-6"><div dangerouslySetInnerHTML={{ __html: coachingDocHtml(viewRow) }} /></div>
          </div>
        </div>
      )}
    </div>
  );
}

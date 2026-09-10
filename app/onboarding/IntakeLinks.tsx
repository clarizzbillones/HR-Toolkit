'use client';
import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';
import { useAccess } from '@/components/AccessProvider';
import { INTAKE_ROLES, roleLabel, intakeFields, intakeUploads, REQUIRED_FIELDS, type IntakeRole } from '@/lib/onboardingIntake';

interface Intake {
  id: string; token: string; role: string; name: string | null; email: string | null;
  status: string; onboardee_id: string | null; profile_id: string | null; submitted_at: string | null; created_at: string;
}

export default function IntakeLinks() {
  const { showToast } = useToast();
  const { me } = useAccess();
  const readOnly = !!me?.restricted && !(me?.editSections ?? []).includes('/onboarding');
  const [rows, setRows] = useState<Intake[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ role: 'attorney', name: '', email: '' });
  const [creating, setCreating] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [includeFields, setIncludeFields] = useState<string[]>(() => intakeFields('attorney').map(f => f.id));
  const [includeUploads, setIncludeUploads] = useState<string[]>(() => [...intakeUploads('attorney')]);

  const roleFields = intakeFields(form.role as IntakeRole);
  const roleUploads = intakeUploads(form.role as IntakeRole);
  function changeRole(role: string) {
    setForm({ ...form, role });
    setIncludeFields(intakeFields(role as IntakeRole).map(f => f.id));
    setIncludeUploads([...intakeUploads(role as IntakeRole)]);
  }
  const toggleF = (id: string) => { if (REQUIRED_FIELDS.includes(id)) return; setIncludeFields(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]); };
  const toggleU = (l: string) => setIncludeUploads(p => p.includes(l) ? p.filter(x => x !== l) : [...p, l]);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const linkFor = (t: string) => `${origin}/onboarding/intake/${t}`;

  async function load() {
    setLoading(true);
    try { const d = await fetch('/api/onboarding/intake').then(r => r.json()); setRows(d.rows ?? []); }
    catch { showToast('Could not load intake links'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function create() {
    if (!form.name.trim()) { showToast('Enter the hire’s name first'); return; }
    setCreating(true);
    try {
      const res = await fetch('/api/onboarding/intake', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', ...form, fields: includeFields, uploads: includeUploads }) });
      const d = await res.json();
      if (!res.ok) { showToast(d.error || 'Could not create link'); return; }
      setRows(prev => [d.row, ...prev]);
      setForm({ role: form.role, name: '', email: '' });
      try { await navigator.clipboard.writeText(d.url); showToast('Link created & copied to clipboard'); }
      catch { showToast('Link created'); }
    } finally { setCreating(false); }
  }
  async function copy(t: string) {
    try { await navigator.clipboard.writeText(linkFor(t)); showToast('Link copied'); } catch { showToast('Copy failed'); }
  }
  async function remove(id: string) {
    if (!confirm('Delete this intake link? Anyone with the link will no longer be able to use it.')) return;
    setRows(prev => prev.filter(r => r.id !== id));
    await fetch(`/api/onboarding/intake?id=${id}`, { method: 'DELETE' });
  }
  const [remindingId, setRemindingId] = useState<string | null>(null);
  async function sendReminder(r: Intake) {
    let email = r.email ?? '';
    if (!email) { email = (window.prompt(`Email the onboarding form to ${r.name || 'this hire'} — enter their email:`) ?? '').trim(); if (!email) return; }
    setRemindingId(r.id);
    try {
      const res = await fetch('/api/onboarding/intake', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send', id: r.id, email, reminder: true }) });
      const d = await res.json();
      if (!res.ok) { showToast(d.error || 'Could not send reminder'); return; }
      if (!r.email) setRows(prev => prev.map(x => x.id === r.id ? { ...x, email } : x));
      showToast(`Reminder emailed to ${email}`);
    } finally { setRemindingId(null); }
  }

  // ---- View a completed submission (answers + attachments) ----
  interface Detail { name: string; email: string; roleLabel: string; status: string; submitted_at: string | null; answers: { id: string; label: string; value: string }[]; files: { id: string; name: string; label: string | null; kind: string | null }[]; }
  const [viewing, setViewing] = useState<Detail | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  async function openSubmission(id: string) {
    setViewLoading(true);
    try {
      const d = await fetch(`/api/onboarding/intake?detail=${id}`).then(r => r.json());
      if (d.detail) setViewing(d.detail); else showToast(d.error || 'Could not load submission');
    } catch { showToast('Could not load submission'); }
    finally { setViewLoading(false); }
  }
  function dataUrlToBlob(dataUrl: string): Blob {
    const [meta, b64] = dataUrl.split(',');
    const mime = /:(.*?);/.exec(meta)?.[1] || 'application/octet-stream';
    const bin = atob(b64); const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }
  async function openFile(fileId: string, download: boolean, fname: string) {
    try {
      const d = await fetch(`/api/onboarding/intake?file=${fileId}`).then(r => r.json());
      if (!d?.data) { showToast('Could not load file'); return; }
      const url = URL.createObjectURL(dataUrlToBlob(d.data));
      if (download) { const a = document.createElement('a'); a.href = url; a.download = d.name || fname || 'document'; document.body.appendChild(a); a.click(); a.remove(); }
      else window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch { showToast('Could not open file'); }
  }

  const input = 'border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink';

  return (
    <div className="flex-1 overflow-auto px-8 py-6">
      <div className="max-w-4xl space-y-6">
        <div className="bg-white border border-border rounded-card p-5">
          <h2 className="font-spectral text-[17px] font-semibold text-text-primary">Create an onboarding link</h2>
          <p className="text-sm text-text-muted mt-0.5 mb-4">Generate a unique link for a future hire to fill out their prerequisite info and upload documents — no login needed. Creating the link <b>adds them to the Onboarding dashboard right away</b> (awaiting their submission). When they submit, their details + uploaded files are added to their <b>Employee File</b> and their name is added to <b>Staffing</b>. The form matches the role you pick. Every link is saved below so you can copy it again anytime.</p>
          {readOnly ? (
            <div className="text-sm text-text-muted">You have view-only access here.</div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1">Role / form</label>
                  <select value={form.role} onChange={e => changeRole(e.target.value)} className={input + ' bg-white'}>
                    {INTAKE_ROLES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1">Name <span className="text-litred-alt">*</span></label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} onKeyDown={e => e.key === 'Enter' && create()} placeholder="Future hire’s name" className={input + ' w-52'} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1">Email <span className="font-normal normal-case text-text-faint">(optional)</span></label>
                  <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="name@email.com" className={input + ' w-56'} />
                </div>
                <button type="button" onClick={() => setShowCustomize(s => !s)} className="text-sm font-semibold text-[#3f6b8a] border border-border-light px-3 py-2 rounded-ctrl hover:bg-canvas">{showCustomize ? '▾' : '▸'} Customize questions ({includeFields.length + includeUploads.length})</button>
              </div>

              {showCustomize && (
                <div className="border border-border-light rounded-ctrl p-4 bg-canvas grid sm:grid-cols-2 gap-6">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-2">Questions to ask <span className="text-text-faint">({includeFields.length}/{roleFields.length})</span></div>
                    <div className="space-y-1.5 max-h-72 overflow-auto pr-1">
                      {roleFields.map(f => { const locked = REQUIRED_FIELDS.includes(f.id); return (
                        <label key={f.id} className={`flex items-center gap-2 text-sm ${locked ? 'text-text-muted' : 'cursor-pointer'}`}>
                          <input type="checkbox" className="w-4 h-4 accent-[#1b2a3d]" checked={includeFields.includes(f.id)} disabled={locked} onChange={() => toggleF(f.id)} />
                          <span>{f.label}{locked && <span className="text-text-faint"> · always included</span>}</span>
                        </label>
                      ); })}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-2">Documents to request <span className="text-text-faint">({includeUploads.length}/{roleUploads.length})</span></div>
                    <div className="space-y-1.5">
                      {roleUploads.map(u => (
                        <label key={u} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="checkbox" className="w-4 h-4 accent-[#1b2a3d]" checked={includeUploads.includes(u)} onChange={() => toggleU(u)} />
                          <span>{u}</span>
                        </label>
                      ))}
                      {roleUploads.length === 0 && <div className="text-sm text-text-faint">No documents for this role.</div>}
                    </div>
                  </div>
                </div>
              )}

              <button onClick={create} disabled={creating} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark disabled:opacity-50">{creating ? 'Creating…' : '＋ Create & copy link'}</button>
            </div>
          )}
        </div>

        <div className="bg-white border border-border rounded-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#f1ece3]"><tr>
              {['Hire', 'Form', 'Status', 'Link', ''].map(h => <th key={h} className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-text-secondary">{h}</th>)}
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={5} className="px-4 py-6 text-center text-text-muted">Loading…</td></tr>
              : rows.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-text-muted">No intake links yet. Create one above and share it with a future hire.</td></tr>
              : rows.map(r => {
                const done = r.status === 'Completed';
                return (
                  <tr key={r.id} className="border-t border-[#f1ece3] align-middle">
                    <td className="px-4 py-3">
                      <div className="font-medium text-text-primary">{r.name || <span className="text-text-faint">Unnamed</span>}</div>
                      {r.email && <div className="text-xs text-text-muted">{r.email}</div>}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{roleLabel(r.role)}</td>
                    <td className="px-4 py-3">
                      {done
                        ? <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#eef5f1] text-[#2f7d5b]" title="Added to Staffing & Employee File">✓ Submitted</span>
                        : <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#f7efe1] text-[#b07d2a]">Awaiting submission</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 max-w-[300px]">
                        <input readOnly value={linkFor(r.token)} onFocus={e => e.currentTarget.select()} className="flex-1 min-w-0 text-[11px] font-mono bg-[#f7f3ea] border border-border-light rounded px-2 py-1 text-text-secondary" />
                        <button onClick={() => copy(r.token)} title="Copy link" className="shrink-0 text-[#3f6b8a] hover:text-ink text-sm">⧉</button>
                        <a href={linkFor(r.token)} target="_blank" rel="noopener noreferrer" title="Open the form" className="shrink-0 text-[#3f6b8a] hover:text-ink text-sm">↗</a>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {done && <button onClick={() => openSubmission(r.id)} title="See what they submitted and open their uploaded documents" className="text-xs font-semibold text-[#3f6b8a] hover:underline mr-3">👁 View submission</button>}
                      {!readOnly && !done && <button onClick={() => sendReminder(r)} disabled={remindingId === r.id} title={r.email ? `Email the form to ${r.email}` : 'Email the form (you’ll enter their address)'} className="text-xs font-semibold text-[#3f6b8a] hover:underline mr-3 disabled:opacity-50">{remindingId === r.id ? 'Sending…' : '🔔 Send reminder'}</button>}
                      {!readOnly && <button onClick={() => remove(r.id)} className="text-xs font-semibold text-litred-alt hover:underline">Delete</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {(viewing || viewLoading) && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6" onClick={e => e.target === e.currentTarget && setViewing(null)}>
          <div className="bg-white rounded-card w-full max-w-lg max-h-[88vh] flex flex-col shadow-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-text-primary">{viewing ? (viewing.name || 'Submission') : 'Loading…'}</div>
                {viewing && <div className="text-xs text-text-muted mt-0.5">{viewing.roleLabel} onboarding intake{viewing.submitted_at ? ` · submitted ${new Date(viewing.submitted_at).toLocaleDateString()}` : ''}</div>}
              </div>
              <button onClick={() => setViewing(null)} className="text-text-muted hover:text-text-primary text-xl leading-none">×</button>
            </div>
            <div className="flex-1 overflow-auto p-5 space-y-5">
              {viewLoading && !viewing ? <p className="text-sm text-text-muted">Loading submission…</p> : viewing && (
                <>
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wide text-text-muted mb-2">Answers</div>
                    {viewing.answers.length === 0 ? <p className="text-sm text-text-muted">No answers recorded.</p> : (
                      <dl className="divide-y divide-border-light border border-border-light rounded-ctrl overflow-hidden">
                        {viewing.answers.map(a => (
                          <div key={a.id} className="flex gap-3 px-3 py-2">
                            <dt className="text-xs font-semibold text-text-secondary w-2/5 shrink-0">{a.label}</dt>
                            <dd className="text-sm text-text-primary flex-1 whitespace-pre-wrap break-words">{a.value}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </div>
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wide text-text-muted mb-2">Uploaded documents {viewing.files.length > 0 && `(${viewing.files.length})`}</div>
                    {viewing.files.length === 0 ? <p className="text-sm text-text-muted">No documents were uploaded.</p> : (
                      <div className="space-y-1.5">
                        {viewing.files.map(f => (
                          <div key={f.id} className="flex items-center gap-3 border border-border-light rounded-ctrl px-3 py-2">
                            <span className="text-lg shrink-0">📎</span>
                            <span className="flex-1 min-w-0">
                              <span className="block text-sm font-medium text-text-primary truncate">{f.label || f.name}</span>
                              {f.label && <span className="block text-xs text-text-muted truncate">{f.name}</span>}
                            </span>
                            <button onClick={() => openFile(f.id, false, f.name)} className="shrink-0 text-xs font-semibold text-[#3f6b8a] hover:underline">Open</button>
                            <button onClick={() => openFile(f.id, true, f.name)} className="shrink-0 text-xs font-semibold text-[#3f6b8a] hover:underline">Download</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-text-muted">These answers and documents are also filed in this person’s Employee File.</p>
                </>
              )}
            </div>
            <div className="px-5 py-3 border-t border-border flex justify-end">
              <button onClick={() => setViewing(null)} className="text-sm font-semibold text-text-secondary px-4 py-2">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

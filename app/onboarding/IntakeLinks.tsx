'use client';
import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';
import { useAccess } from '@/components/AccessProvider';
import { INTAKE_ROLES, roleLabel } from '@/lib/onboardingIntake';

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
      const res = await fetch('/api/onboarding/intake', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', ...form }) });
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
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1">Role / form</label>
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className={input + ' bg-white'}>
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
                      {!readOnly && <button onClick={() => remove(r.id)} className="text-xs font-semibold text-litred-alt hover:underline">Delete</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

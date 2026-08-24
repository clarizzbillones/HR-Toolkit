'use client';
import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';
import { SECTIONS, REPORT_TABS, type AccessGrant } from '@/lib/access';

const blank = { email: '', name: '', sections: [] as string[], reportTabs: [] as string[], editSections: [] as string[] };

export default function AccessClient() {
  const { showToast } = useToast();
  const [grants, setGrants] = useState<AccessGrant[]>([]);
  const [admins, setAdmins] = useState<string[]>([]);
  const [envAdmins, setEnvAdmins] = useState<string[]>([]);
  const [portalAdmins, setPortalAdmins] = useState<{ email: string; name: string }[]>([]);
  const [newAdmin, setNewAdmin] = useState({ email: '', name: '' });
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [editing, setEditing] = useState<typeof blank | null>(null);
  const [saving, setSaving] = useState(false);
  const [emailOnSave, setEmailOnSave] = useState(true);
  const [preview, setPreview] = useState<{ to: string; subject: string; html: string; full?: boolean; src: { email: string; name: string; sections: string[]; reportTabs: string[]; editSections: string[] } } | null>(null);
  const [busyEmail, setBusyEmail] = useState('');

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
  async function previewEmail(g: { email: string; name: string; sections: string[]; reportTabs: string[]; editSections?: string[] }) {
    const res = await fetch('/api/access/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...g, appUrl, preview: true }) });
    const d = await res.json();
    if (!res.ok) { showToast(d.error ?? 'Could not build preview'); return; }
    setPreview({ to: d.to, subject: d.subject, html: d.html, src: { email: g.email, name: g.name, sections: g.sections, reportTabs: g.reportTabs, editSections: g.editSections ?? [] } });
  }
  async function sendInvite(g: { email: string; name: string; sections: string[]; reportTabs: string[]; editSections?: string[]; full?: boolean }) {
    setBusyEmail(g.email);
    try {
      const res = await fetch('/api/access/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...g, appUrl }) });
      const d = await res.json();
      if (!res.ok) { showToast(d.error ?? 'Could not send email'); return false; }
      showToast(`Invite emailed to ${g.email}`); return true;
    } finally { setBusyEmail(''); }
  }

  async function load() {
    const res = await fetch('/api/access');
    if (res.status === 403) { setForbidden(true); return; }
    const d = await res.json();
    setGrants(d.grants ?? []);
    setAdmins(d.admins ?? []);
    setEnvAdmins(d.envAdmins ?? []);
    setPortalAdmins(d.portalAdmins ?? []);
  }
  useEffect(() => { load(); }, []);

  async function previewAdminEmail() {
    const email = newAdmin.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('Enter a valid email to preview'); return; }
    const res = await fetch('/api/access/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, name: newAdmin.name.trim(), full: true, appUrl, preview: true }) });
    const d = await res.json();
    if (!res.ok) { showToast(d.error ?? 'Could not build preview'); return; }
    setPreview({ to: d.to, subject: d.subject, html: d.html, full: true, src: { email, name: newAdmin.name.trim(), sections: [], reportTabs: [], editSections: [] } });
  }
  async function addAdmin() {
    const email = newAdmin.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('Enter a valid email'); return; }
    setAddingAdmin(true);
    try {
      const res = await fetch('/api/access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add-admin', email, name: newAdmin.name.trim() }) });
      const d = await res.json();
      if (!res.ok) { showToast(d.error ?? 'Could not add admin'); return; }
      setPortalAdmins(d.portalAdmins ?? []);
      setAdmins(prev => Array.from(new Set([...prev, email])).sort());
      if (d.removedGrant) setGrants(prev => prev.filter(g => g.email !== d.removedGrant));
      const nm = newAdmin.name.trim();
      setNewAdmin({ email: '', name: '' });
      showToast(`${email} is now a full-access admin`);
      // Email them the invite (link + how to sign in), like viewer invites.
      const inv = await fetch('/api/access/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, name: nm, full: true, appUrl }) });
      const invd = await inv.json().catch(() => ({}));
      showToast(inv.ok ? `Invite emailed to ${email}` : (invd.error ?? 'Admin added, but the invite email could not be sent'));
    } finally { setAddingAdmin(false); }
  }
  async function emailAdminInvite(email: string) {
    const name = portalAdmins.find(p => p.email === email)?.name ?? '';
    const inv = await fetch('/api/access/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, name, full: true, appUrl }) });
    const invd = await inv.json().catch(() => ({}));
    showToast(inv.ok ? `Invite emailed to ${email}` : (invd.error ?? 'Could not send email'));
  }
  async function removeAdmin(email: string) {
    if (!confirm(`Remove ${email} as a full-access admin? They'll fall back to full access without admin rights (unless you also add them as a viewer).`)) return;
    const res = await fetch('/api/access', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'remove-admin', email }) });
    const d = await res.json();
    if (!res.ok) { showToast(d.error ?? 'Could not remove'); return; }
    setPortalAdmins(d.portalAdmins ?? []);
    setAdmins(prev => prev.filter(a => a !== email));
    showToast('Admin removed');
  }

  function toggle(list: string[], key: string): string[] {
    return list.includes(key) ? list.filter(k => k !== key) : [...list, key];
  }
  async function save() {
    if (!editing) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editing.email.trim())) { showToast('Enter a valid email'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) });
      const d = await res.json();
      if (!res.ok) { showToast(d.error ?? 'Could not save'); return; }
      setGrants(prev => [...prev.filter(g => g.email !== d.grant.email), d.grant].sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email)));
      showToast(`Access saved for ${d.grant.name || d.grant.email}`);
      if (emailOnSave) await sendInvite(d.grant);
      setEditing(null);
    } finally { setSaving(false); }
  }
  async function remove(email: string) {
    if (!confirm(`Remove ${email} from the viewer list? They will get full access again.`)) return;
    setGrants(prev => prev.filter(g => g.email !== email));
    await fetch('/api/access', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    showToast('Removed');
  }
  const secLabel = (k: string) => k === '/' ? 'Dashboard — My Tasks' : (SECTIONS.find(s => s.key === k)?.label ?? k);
  const tabLabel = (k: string) => REPORT_TABS.find(t => t.key === k)?.label ?? k;

  if (forbidden) {
    return (
      <div className="p-10">
        <h1 className="font-spectral text-[23px] font-semibold text-text-primary mb-2">Access Control</h1>
        <p className="text-sm text-text-muted">You don’t have permission to manage access. Ask an owner/admin to grant it.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="px-8 py-5 bg-white border-b border-border flex items-center gap-4 flex-wrap flex-shrink-0">
        <div>
          <h1 className="font-spectral text-[23px] font-semibold text-text-primary">Access Control</h1>
          <p className="text-sm text-text-muted mt-0.5">Check the tabs a person can open. Each is <b>view-only</b> until you switch it to <b className="text-[#b07d2a]">✎ Can edit</b> — which lets them fill in and change entries (e.g. add their initials, date &amp; notes). <b>Onboarding Document</b> and <b>Offboarding Document</b> are their own permissions — check one (view or edit) to give someone just that document (they can fill it in) without opening up the rest of Onboarding/Offboarding, the checklist, exit interview, or the ability to delete anyone. Everyone not listed keeps full access.</p>
        </div>
        <button onClick={() => setEditing({ ...blank })} className="ml-auto bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark">＋ Add viewer</button>
      </header>

      <div className="flex-1 overflow-auto px-8 py-6 space-y-6">
        {/* Full-access admins */}
        <div className="bg-white border border-border rounded-card p-5 max-w-3xl">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-gold-muted">Full-access admins</span>
            <span className="text-[11px] text-text-muted">· manage access, see every tab (incl. Employee Files)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {admins.length === 0 ? <span className="text-sm text-text-muted">—</span> : admins.map(a => {
              const removable = !envAdmins.includes(a);
              return (
                <span key={a} className="inline-flex items-center gap-1.5 text-sm font-medium bg-[#eef5f1] text-[#2f7d5b] border border-[#cfe4d8] px-3 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2f7d5b]" />{a}
                  {removable
                    ? <>
                        <button onClick={() => emailAdminInvite(a)} title="Email invite (link + password)" className="ml-0.5 text-[#2f7d5b]/70 hover:text-[#2f7d5b]">✉</button>
                        <button onClick={() => removeAdmin(a)} title="Remove admin" className="text-[#2f7d5b]/60 hover:text-litred-alt">✕</button>
                      </>
                    : <span title="Set in the environment — permanent" className="ml-0.5 text-[10px] text-[#2f7d5b]/60 uppercase tracking-wide">env</span>}
                </span>
              );
            })}
          </div>
          {/* Add a full-access admin from the portal (stored in the app). */}
          <div className="flex flex-wrap items-end gap-2 mt-3 pt-3 border-t border-border-light">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-text-muted block mb-1">Email</label>
              <input value={newAdmin.email} onChange={e => setNewAdmin({ ...newAdmin, email: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && addAdmin()} placeholder="person@litson.co"
                className="border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink w-56" />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-text-muted block mb-1">Name <span className="font-normal normal-case text-text-faint">(optional)</span></label>
              <input value={newAdmin.name} onChange={e => setNewAdmin({ ...newAdmin, name: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && addAdmin()} placeholder="Full name"
                className="border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink w-48" />
            </div>
            <button onClick={previewAdminEmail} className="bg-white border border-border-light text-ink text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-canvas">👁 Preview email</button>
            <button onClick={addAdmin} disabled={addingAdmin} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark disabled:opacity-50">{addingAdmin ? 'Adding…' : '＋ Add admin & email invite'}</button>
          </div>
          <p className="text-[11px] text-text-muted mt-2">Add a full-access admin here, or set permanent ones via the ACCESS_ADMINS / HR_ADMINS environment variables (marked <b>env</b>). Everyone here has full access and cannot be restricted. They log in with the shared password.</p>
        </div>
        {editing && (
          <div className="bg-[#fbf7ee] border border-border rounded-card p-5 max-w-3xl">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Email (their login)</label>
                <input value={editing.email} onChange={e => setEditing({ ...editing, email: e.target.value })} placeholder="person@litson.co"
                  className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Name (optional)</label>
                <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="Full name"
                  className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
              </div>
            </div>

            <div className="mb-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-2">Sidebar sections they can open <span className="font-normal normal-case text-text-faint">· each checked tab is view-only until you switch it to <b className="text-[#b07d2a]">✎ Can edit</b></span></div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {SECTIONS.map(s => {
                  const viewing = editing.sections.includes(s.key);
                  const canEdit = editing.editSections.includes(s.key);
                  return (
                    <label key={s.key} title={s.key === '/' ? 'Gives this person a Dashboard showing ONLY the onboarding/offboarding tasks assigned to them — no firm-wide KPIs, birthdays, or modules.' : undefined}
                      className="flex items-center gap-2 text-sm bg-white border border-border-light rounded-ctrl px-3 py-2 cursor-pointer hover:border-ink">
                      <input type="checkbox" className="w-4 h-4 accent-[#1b2a3d] shrink-0" checked={viewing}
                        onChange={() => setEditing({ ...editing, sections: toggle(editing.sections, s.key), editSections: editing.editSections.filter(k => k !== s.key) })} />
                      <span className="truncate">{s.key === '/' ? 'Dashboard — My Tasks' : s.label}</span>
                      {viewing && (
                        <button type="button" onClick={e => { e.preventDefault(); setEditing({ ...editing, editSections: toggle(editing.editSections, s.key) }); }}
                          title={canEdit ? 'Can edit — they can add & change entries (initials, dates, notes). Click to make view-only.' : 'View-only — they can see but not change anything. Click to let them add & change entries.'}
                          className={`ml-auto shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${canEdit ? 'bg-[#f7efe1] border-[#e0c48a] text-[#b07d2a]' : 'border-border-light text-text-muted hover:text-[#b07d2a] hover:border-[#e0c48a]'}`}>{canEdit ? '✎ Can edit' : '👁 View only'}</button>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="mb-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-2">Report tabs they can view <span className="font-normal normal-case text-text-faint">(checking any grants Reports)</span></div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {REPORT_TABS.map(t => (
                  <label key={t.key} className="flex items-center gap-2 text-sm bg-white border border-border-light rounded-ctrl px-3 py-2 cursor-pointer hover:border-ink">
                    <input type="checkbox" className="w-4 h-4 accent-[#3f6b8a]" checked={editing.reportTabs.includes(t.key)}
                      onChange={() => setEditing({ ...editing, reportTabs: toggle(editing.reportTabs, t.key) })} />
                    <span>{t.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={save} disabled={saving} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark disabled:opacity-50">{saving ? 'Saving…' : 'Save access'}</button>
              <button onClick={() => previewEmail(editing)} className="bg-white border border-border-light text-ink text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-canvas">👁 Preview email</button>
              <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                <input type="checkbox" className="w-4 h-4 accent-[#1b2a3d]" checked={emailOnSave} onChange={e => setEmailOnSave(e.target.checked)} />
                Email them an invite when I save
              </label>
              <button onClick={() => setEditing(null)} className="text-sm text-text-muted px-3">Cancel</button>
            </div>
          </div>
        )}

        <div className="bg-white border border-border rounded-card overflow-hidden max-w-4xl">
          <table className="w-full text-sm">
            <thead className="bg-[#f1ece3]"><tr>
              {['Viewer', 'Sections', 'Report tabs', ''].map(h => <th key={h} className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-text-secondary">{h}</th>)}
            </tr></thead>
            <tbody>
              {grants.map(g => (
                <tr key={g.email} className="border-t border-[#f1ece3] align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium text-text-primary">{g.name || g.email.split('@')[0]}</div>
                    <div className="text-xs text-text-muted">{g.email}</div>
                  </td>
                  <td className="px-4 py-3 text-text-muted">
                    <div className="flex flex-wrap gap-1">{g.sections.length ? g.sections.map(k => { const ed = (g.editSections ?? []).includes(k); return <span key={k} title={ed ? 'Can edit' : 'View only'} className={`text-xs px-2 py-0.5 rounded-full ${ed ? 'bg-[#f7efe1] text-[#b07d2a] ring-1 ring-[#e0c48a]' : 'bg-[#eef2f7] text-[#3f5a76]'}`}>{secLabel(k)}{ed ? ' ✎' : ''}</span>; }) : <span className="text-text-faint">none</span>}</div>
                  </td>
                  <td className="px-4 py-3 text-text-muted">
                    <div className="flex flex-wrap gap-1">{g.reportTabs.length ? g.reportTabs.map(k => <span key={k} className="text-xs bg-[#e9f0f5] text-[#3f6b8a] px-2 py-0.5 rounded-full">{tabLabel(k)}</span>) : <span className="text-text-faint">—</span>}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <button onClick={() => previewEmail(g)} className="text-xs font-semibold text-text-secondary hover:underline mr-3">Preview</button>
                    <button onClick={() => sendInvite(g)} disabled={busyEmail === g.email} className="text-xs font-semibold text-[#3f6b8a] hover:underline mr-3 disabled:opacity-50">{busyEmail === g.email ? 'Sending…' : '✉ Email invite'}</button>
                    <button onClick={() => setEditing({ email: g.email, name: g.name, sections: [...g.sections], reportTabs: [...g.reportTabs], editSections: [...(g.editSections ?? [])] })} className="text-xs font-semibold text-ink hover:underline mr-3">Edit</button>
                    <button onClick={() => remove(g.email)} className="text-xs font-semibold text-litred-alt hover:underline">Remove</button>
                  </td>
                </tr>
              ))}
              {!grants.length && <tr><td colSpan={4} className="px-4 py-6 text-center text-text-muted">No viewers yet — everyone has full access. Click “Add viewer” to restrict someone to specific tabs.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6" onClick={e => e.target === e.currentTarget && setPreview(null)}>
          <div className="bg-white rounded-card w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-text-primary">Invite email preview</div>
                <div className="text-xs text-text-muted truncate">To: {preview.to} · Subject: {preview.subject}</div>
              </div>
              <button onClick={() => setPreview(null)} className="text-text-muted hover:text-text-primary text-xl leading-none shrink-0">×</button>
            </div>
            <div className="flex-1 overflow-auto bg-[#f4f1ea]">
              <div dangerouslySetInnerHTML={{ __html: preview.html }} />
            </div>
            <div className="px-5 py-3 border-t border-border flex justify-end gap-2">
              <button onClick={() => setPreview(null)} className="text-sm text-text-muted px-3">Close</button>
              <button onClick={async () => { const ok = await sendInvite({ ...preview.src, full: preview.full }); if (ok) setPreview(null); }}
                className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark">✉ Send this email</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

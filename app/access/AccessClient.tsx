'use client';
import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';
import { SECTIONS, REPORT_TABS, type AccessGrant } from '@/lib/access';

const blank = { email: '', name: '', sections: [] as string[], reportTabs: [] as string[] };

export default function AccessClient() {
  const { showToast } = useToast();
  const [grants, setGrants] = useState<AccessGrant[]>([]);
  const [forbidden, setForbidden] = useState(false);
  const [editing, setEditing] = useState<typeof blank | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch('/api/access');
    if (res.status === 403) { setForbidden(true); return; }
    const d = await res.json();
    setGrants(d.grants ?? []);
  }
  useEffect(() => { load(); }, []);

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
      setEditing(null);
      showToast(`Access saved for ${d.grant.name || d.grant.email}`);
    } finally { setSaving(false); }
  }
  async function remove(email: string) {
    if (!confirm(`Remove ${email} from the viewer list? They will get full access again.`)) return;
    setGrants(prev => prev.filter(g => g.email !== email));
    await fetch('/api/access', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    showToast('Removed');
  }
  const secLabel = (k: string) => SECTIONS.find(s => s.key === k)?.label ?? k;
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
          <p className="text-sm text-text-muted mt-0.5">Give specific people view-only access to just the tabs you check. Everyone not listed keeps full access.</p>
        </div>
        <button onClick={() => setEditing({ ...blank })} className="ml-auto bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark">＋ Add viewer</button>
      </header>

      <div className="flex-1 overflow-auto px-8 py-6 space-y-6">
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
              <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-2">Sidebar sections they can view</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {SECTIONS.map(s => (
                  <label key={s.key} className="flex items-center gap-2 text-sm bg-white border border-border-light rounded-ctrl px-3 py-2 cursor-pointer hover:border-ink">
                    <input type="checkbox" className="w-4 h-4 accent-[#1b2a3d]" checked={editing.sections.includes(s.key)}
                      onChange={() => setEditing({ ...editing, sections: toggle(editing.sections, s.key) })} />
                    <span>{s.label}</span>
                  </label>
                ))}
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

            <div className="flex gap-2">
              <button onClick={save} disabled={saving} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark disabled:opacity-50">{saving ? 'Saving…' : 'Save access'}</button>
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
                    <div className="flex flex-wrap gap-1">{g.sections.length ? g.sections.map(k => <span key={k} className="text-xs bg-[#eef2f7] text-[#3f5a76] px-2 py-0.5 rounded-full">{secLabel(k)}</span>) : <span className="text-text-faint">none</span>}</div>
                  </td>
                  <td className="px-4 py-3 text-text-muted">
                    <div className="flex flex-wrap gap-1">{g.reportTabs.length ? g.reportTabs.map(k => <span key={k} className="text-xs bg-[#e9f0f5] text-[#3f6b8a] px-2 py-0.5 rounded-full">{tabLabel(k)}</span>) : <span className="text-text-faint">—</span>}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <button onClick={() => setEditing({ email: g.email, name: g.name, sections: [...g.sections], reportTabs: [...g.reportTabs] })} className="text-xs font-semibold text-ink hover:underline mr-3">Edit</button>
                    <button onClick={() => remove(g.email)} className="text-xs font-semibold text-litred-alt hover:underline">Remove</button>
                  </td>
                </tr>
              ))}
              {!grants.length && <tr><td colSpan={4} className="px-4 py-6 text-center text-text-muted">No viewers yet — everyone has full access. Click “Add viewer” to restrict someone to specific tabs.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

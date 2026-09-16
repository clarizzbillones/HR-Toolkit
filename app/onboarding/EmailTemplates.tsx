'use client';
import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';

interface Tpl { id: string; name: string; subject: string; body: string }

export default function EmailTemplates() {
  const { showToast } = useToast();
  const [tpls, setTpls] = useState<Tpl[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState('');
  const [savedId, setSavedId] = useState('');

  async function load() {
    setLoading(true);
    try {
      const d = await fetch('/api/onboarding/email-templates').then(r => r.json());
      setTpls((d.rows ?? []).map((r: any) => ({ id: r.id, name: r.name ?? '', subject: r.subject ?? '', body: r.body ?? '' })));
    } catch { showToast('Could not load templates'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  // Local edit (instant), then persist on blur.
  const setLocal = (id: string, patch: Partial<Tpl>) => setTpls(ts => ts.map(t => t.id === id ? { ...t, ...patch } : t));
  async function save(id: string, patch: Partial<Tpl>) {
    try {
      await fetch('/api/onboarding/email-templates', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...patch }) });
      setSavedId(id); setTimeout(() => setSavedId(s => s === id ? '' : s), 1500);
    } catch { showToast('Could not save'); }
  }
  async function addTpl() {
    const res = await fetch('/api/onboarding/email-templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'New email template' }) });
    const { row } = await res.json();
    if (row) { setTpls(ts => [...ts, { id: row.id, name: row.name ?? '', subject: row.subject ?? '', body: row.body ?? '' }]); showToast('Template created'); }
  }
  async function removeTpl(t: Tpl) {
    if (!confirm(`Delete the template "${t.name || 'Untitled'}"?`)) return;
    setTpls(ts => ts.filter(x => x.id !== t.id));
    await fetch(`/api/onboarding/email-templates?id=${t.id}`, { method: 'DELETE' });
    showToast('Template deleted');
  }
  async function copy(key: string, text: string, label: string) {
    try { await navigator.clipboard.writeText(text); setCopiedKey(key); setTimeout(() => setCopiedKey(''), 1500); showToast(`${label} copied`); }
    catch { showToast('Copy failed'); }
  }

  const fieldInput = 'w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink';

  return (
    <div className="flex-1 overflow-auto px-8 py-6">
      <div className="max-w-3xl space-y-5">
        <div className="flex items-start justify-between gap-4">
          <p className="text-sm text-text-muted">Ready-to-send emails for new hires. Create your own, edit the text, and it saves automatically for the whole HR team. Copy and paste into Outlook when you send.</p>
          <button onClick={addTpl} className="shrink-0 bg-ink text-white text-sm font-semibold px-3.5 py-2 rounded-ctrl hover:bg-ink-dark">+ New template</button>
        </div>

        {loading ? (
          <p className="text-sm text-text-muted">Loading…</p>
        ) : tpls.length === 0 ? (
          <div className="text-sm text-text-muted border border-dashed border-border-light rounded-card p-10 text-center">No templates yet — click “+ New template” to create one.</div>
        ) : tpls.map(t => (
          <div key={t.id} className="bg-white border border-border rounded-card overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b border-border-light flex items-center gap-3">
              <input value={t.name} onChange={e => setLocal(t.id, { name: e.target.value })} onBlur={e => save(t.id, { name: e.target.value })}
                placeholder="Template name"
                className="flex-1 font-spectral text-[16px] font-semibold text-text-primary bg-transparent focus:outline-none focus:bg-canvas rounded px-1 -mx-1" />
              {savedId === t.id && <span className="text-[11px] text-[#2f7d5b] font-semibold">✓ Saved</span>}
              <button onClick={() => copy(t.id + '-all', `Subject: ${t.subject}\n\n${t.body}`, 'Email')}
                className="shrink-0 bg-white border border-border-light text-ink text-xs font-semibold px-3 py-1.5 rounded-ctrl hover:bg-canvas">
                {copiedKey === t.id + '-all' ? '✓ Copied' : '⧉ Copy email'}
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Subject</label>
                  <button onClick={() => copy(t.id + '-subj', t.subject, 'Subject')} className="text-[11px] font-semibold text-[#3f6b8a] hover:underline">{copiedKey === t.id + '-subj' ? '✓ Copied' : 'Copy subject'}</button>
                </div>
                <input value={t.subject} onChange={e => setLocal(t.id, { subject: e.target.value })} onBlur={e => save(t.id, { subject: e.target.value })} placeholder="Email subject" className={fieldInput} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Body</label>
                  <button onClick={() => copy(t.id + '-body', t.body, 'Body')} className="text-[11px] font-semibold text-[#3f6b8a] hover:underline">{copiedKey === t.id + '-body' ? '✓ Copied' : 'Copy body'}</button>
                </div>
                <textarea value={t.body} onChange={e => setLocal(t.id, { body: e.target.value })} onBlur={e => save(t.id, { body: e.target.value })} rows={14}
                  className={fieldInput + ' resize-y leading-relaxed whitespace-pre-wrap'} style={{ fontFamily: 'inherit' }} />
              </div>
              <div className="flex items-center gap-4 pt-1">
                <button onClick={() => removeTpl(t)} className="text-xs font-semibold text-litred-alt hover:underline">Delete template</button>
                <span className="text-[11px] text-text-faint ml-auto">Changes save automatically. Tip: replace [First name] before sending.</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

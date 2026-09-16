'use client';
import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';

interface Tpl { id: string; name: string; subject: string; body: string; builtin?: boolean }

// Built-in starter templates. Edits are saved per browser; "Reset" restores these.
const DEFAULTS: Tpl[] = [
  {
    id: 'welcome-onboarding-benefits',
    name: 'Welcome — Onboarding & Benefits Guide',
    subject: 'Welcome to Litson — Your Onboarding & Benefits Guide',
    builtin: true,
    body: `Hi [First name],

Welcome to Litson!

Attached is your Onboarding Guide and Benefits Guide, which includes important information to help you get started, including your Litson email credentials and links to the relevant SOPs.

Your Litson email and all required tools have been set up. I'll also send invitations to your Litson email for the tools you need, as well as any scheduled meetings. All necessary calls have also been scheduled and added to your calendar.

Once you log in, please change your temporary passwords and save your updated login credentials in Dashlane for secure access going forward.

The onboarding guide also includes the SOP links you'll need to reference as you get familiar with our processes.

Please let me know if you have any trouble accessing your email, tools, calendar, or any of the information in the onboarding guide.

Welcome again, and we're excited to have you join the team!`,
  },
];

const STORAGE = 'litson_onboarding_email_templates';

export default function EmailTemplates() {
  const { showToast } = useToast();
  const [tpls, setTpls] = useState<Tpl[]>(DEFAULTS);
  const [copiedKey, setCopiedKey] = useState('');

  // Load saved templates (merging in any new built-ins added later).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      const saved: Tpl[] = raw ? JSON.parse(raw) : [];
      if (Array.isArray(saved) && saved.length) {
        const savedIds = new Set(saved.map(t => t.id));
        const missingBuiltins = DEFAULTS.filter(d => !savedIds.has(d.id));
        setTpls([...saved, ...missingBuiltins]);
      }
    } catch { /* ignore */ }
  }, []);

  function persist(next: Tpl[]) {
    setTpls(next);
    try { localStorage.setItem(STORAGE, JSON.stringify(next)); } catch { /* ignore */ }
  }
  const update = (id: string, field: 'name' | 'subject' | 'body', val: string) =>
    persist(tpls.map(t => t.id === id ? { ...t, [field]: val } : t));
  function addTpl() {
    const id = 'tpl-' + Date.now().toString(36);
    persist([...tpls, { id, name: 'New email template', subject: '', body: '' }]);
  }
  function removeTpl(t: Tpl) {
    if (!confirm(`Delete the template "${t.name}"?`)) return;
    persist(tpls.filter(x => x.id !== t.id));
  }
  function resetTpl(t: Tpl) {
    const def = DEFAULTS.find(d => d.id === t.id);
    if (!def) return;
    persist(tpls.map(x => x.id === t.id ? { ...def } : x));
    showToast('Template reset to default');
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
          <p className="text-sm text-text-muted">Ready-to-send emails for new hires — tweak the text if you like, then copy and paste into Outlook. Edits are saved in this browser.</p>
          <button onClick={addTpl} className="shrink-0 bg-white border border-border-light text-ink text-sm font-semibold px-3.5 py-2 rounded-ctrl hover:bg-canvas">+ New template</button>
        </div>

        {tpls.map(t => (
          <div key={t.id} className="bg-white border border-border rounded-card overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b border-border-light flex items-center gap-3">
              <input value={t.name} onChange={e => update(t.id, 'name', e.target.value)}
                className="flex-1 font-spectral text-[16px] font-semibold text-text-primary bg-transparent focus:outline-none focus:bg-canvas rounded px-1 -mx-1" />
              <button onClick={() => copy(t.id + '-all', `Subject: ${t.subject}\n\n${t.body}`, 'Email')}
                className="shrink-0 bg-ink text-white text-xs font-semibold px-3 py-1.5 rounded-ctrl hover:bg-ink-dark">
                {copiedKey === t.id + '-all' ? '✓ Copied' : '⧉ Copy email'}
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Subject</label>
                  <button onClick={() => copy(t.id + '-subj', t.subject, 'Subject')} className="text-[11px] font-semibold text-[#3f6b8a] hover:underline">{copiedKey === t.id + '-subj' ? '✓ Copied' : 'Copy subject'}</button>
                </div>
                <input value={t.subject} onChange={e => update(t.id, 'subject', e.target.value)} placeholder="Email subject" className={fieldInput} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Body</label>
                  <button onClick={() => copy(t.id + '-body', t.body, 'Body')} className="text-[11px] font-semibold text-[#3f6b8a] hover:underline">{copiedKey === t.id + '-body' ? '✓ Copied' : 'Copy body'}</button>
                </div>
                <textarea value={t.body} onChange={e => update(t.id, 'body', e.target.value)} rows={14}
                  className={fieldInput + ' resize-y leading-relaxed whitespace-pre-wrap'} style={{ fontFamily: 'inherit' }} />
              </div>
              <div className="flex items-center gap-4 pt-1">
                {t.builtin && <button onClick={() => resetTpl(t)} className="text-xs font-semibold text-text-muted hover:text-text-primary">↺ Reset to default</button>}
                {!t.builtin && <button onClick={() => removeTpl(t)} className="text-xs font-semibold text-litred-alt hover:underline">Delete template</button>}
                <span className="text-[11px] text-text-faint ml-auto">Tip: replace [First name] before sending.</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

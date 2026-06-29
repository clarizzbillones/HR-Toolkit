'use client';
import { useState } from 'react';
import { useToast } from '@/components/Toast';
import EditGate from '@/components/EditGate';

const TEMPLATES = [
  'Onboarding Checklist',
  'Benefits Enrollment',
  'PTO Request Process',
  'Payroll Processing',
  'Performance Review',
  'Offboarding Checklist',
  'New Hire Orientation',
  'Contractor Engagement',
];

export default function SopClient() {
  const { showToast } = useToast();
  const [template, setTemplate] = useState(TEMPLATES[0]);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [draft, setDraft] = useState('');
  const [generating, setGenerating] = useState(false);

  async function generate() {
    setGenerating(true);
    try {
      const res = await fetch('/api/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'sop', params: { template, title: title || template, notes } }),
      });
      const data = await res.json();
      setDraft(data.draft ?? '');
    } catch { showToast('Generation failed'); }
    setGenerating(false);
  }

  function copyDraft() {
    navigator.clipboard.writeText(draft).then(() => showToast('Copied to clipboard'));
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="px-8 py-5 bg-white border-b border-border flex-shrink-0">
        <h1 className="font-spectral text-[23px] font-semibold text-text-primary">SOP Builder</h1>
        <p className="text-sm text-text-muted mt-0.5">Generate standard operating procedures with AI</p>
      </header>
      <div className="flex-1 overflow-auto p-8">
        <div className="grid grid-cols-2 gap-6 max-w-4xl">
          <div className="bg-white border border-border rounded-card p-6 space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-gold-muted mb-1">SOP Details</div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Template</label>
              <select value={template} onChange={e => setTemplate(e.target.value)}
                className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink bg-white">
                {TEMPLATES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Custom Title (optional)</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder={template}
                className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Additional Context / Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={5}
                placeholder="Firm-specific details, exceptions, special requirements…"
                className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink resize-none" />
            </div>
            <EditGate fallback={<p className="text-xs text-text-muted text-center py-2">View only — contact HR Admin to generate SOPs</p>}>
            <button onClick={generate} disabled={generating}
              className="w-full bg-ink text-white text-sm font-semibold py-2.5 rounded-ctrl hover:bg-ink-dark transition-colors disabled:opacity-40">
              {generating ? 'Generating…' : 'Generate SOP'}
            </button>
            </EditGate>
          </div>

          {draft ? (
            <div className="bg-white border border-border rounded-card p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-gold-muted flex-1">Output</span>
                <button onClick={copyDraft} className="text-xs font-semibold text-ink border border-border-light px-2.5 py-1.5 rounded hover:bg-canvas">Copy</button>
                <button onClick={generate} disabled={generating} className="text-xs font-semibold text-ink border border-border-light px-2.5 py-1.5 rounded hover:bg-canvas disabled:opacity-40">↺ Regenerate</button>
              </div>
              <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={24}
                className="w-full border border-border-light rounded-ctrl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-ink resize-none" />
            </div>
          ) : (
            <div className="bg-[#f1ece3] border border-border rounded-card p-6 flex items-center justify-center text-text-muted text-sm">
              Fill in the details and click Generate SOP
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';
import { useState, useEffect } from 'react';
import { useToast } from '@/components/Toast';
import { HR_FORMS, HR_FORM_PARTS, hrFormDocHtml } from '@/lib/hrForms';

interface SavedForm { title: string; body: string; baseId: string }

export default function HrFormsClient() {
  const { showToast } = useToast();
  const [id, setId] = useState(HR_FORMS[0].id);
  const [title, setTitle] = useState(HR_FORMS[0].title);
  const [body, setBody] = useState(HR_FORMS[0].body);
  const [saved, setSaved] = useState<Record<string, SavedForm>>({});
  const [savedName, setSavedName] = useState('');

  useEffect(() => {
    try { const raw = localStorage.getItem('litson_hr_forms'); if (raw) setSaved(JSON.parse(raw)); } catch { /* ignore */ }
  }, []);
  function persist(next: Record<string, SavedForm>) { setSaved(next); try { localStorage.setItem('litson_hr_forms', JSON.stringify(next)); } catch { /* ignore */ } }

  function loadTemplate(fid: string) {
    const f = HR_FORMS.find(x => x.id === fid);
    if (!f) return;
    setId(f.id); setTitle(f.title); setBody(f.body); setSavedName('');
  }
  function loadSaved(name: string) {
    const sv = saved[name]; if (!sv) { setSavedName(''); return; }
    setSavedName(name); setTitle(sv.title); setBody(sv.body); setId(sv.baseId);
  }
  function saveCopy() {
    const name = (window.prompt('Save this filled form as:', savedName || title) || '').trim();
    if (!name) return;
    persist({ ...saved, [name]: { title, body, baseId: id } });
    setSavedName(name); showToast('Saved');
  }
  function deleteSaved() {
    if (!savedName || !saved[savedName]) return;
    if (!window.confirm(`Delete “${savedName}”?`)) return;
    const next = { ...saved }; delete next[savedName]; persist(next); setSavedName('');
    showToast('Deleted');
  }

  function printPdf() {
    const win = window.open('', '_blank'); if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>@page{size:letter;margin:0.55in}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0;background:#faf8f4;padding:20px}</style>
</head><body>${hrFormDocHtml(title, body)}<script>window.onload=function(){window.print()}</script></body></html>`);
    win.document.close();
  }
  function downloadWord() {
    const html = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>@page{margin:0.6in}body{background:#fff;padding:16px}</style></head><body>${hrFormDocHtml(title, body)}</body></html>`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + html], { type: 'application/msword' }));
    a.download = `${title.replace(/[^\w]+/g, '-')}.doc`;
    a.click();
  }

  const input = 'w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink';

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="px-8 py-5 bg-white border-b border-border flex-shrink-0 flex items-center gap-4 flex-wrap">
        <div>
          <h1 className="font-spectral text-[23px] font-semibold text-text-primary">HR Forms &amp; Templates</h1>
          <p className="text-sm text-text-muted mt-0.5">Performance, discipline, pre-termination, severance &amp; health-coverage templates</p>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-8">
        <div className="grid grid-cols-[340px_1fr] gap-6 max-w-6xl items-start">
          {/* Form panel */}
          <div className="bg-white border border-border rounded-card p-5 space-y-4 sticky top-0">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-gold-muted mb-1.5">Template</div>
              <select value={savedName ? '' : id} onChange={e => loadTemplate(e.target.value)} className={input + ' bg-white'}>
                {HR_FORM_PARTS.map(part => (
                  <optgroup key={part} label={part}>
                    {HR_FORMS.filter(f => f.part === part).map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-xs font-bold uppercase tracking-wider text-gold-muted">My saved forms</div>
                <div className="flex gap-2">
                  <button onClick={saveCopy} className="text-[11px] font-semibold text-[#3f6b8a] hover:underline">💾 Save</button>
                  {savedName && saved[savedName] && <button onClick={deleteSaved} className="text-[11px] font-semibold text-litred-alt hover:underline">🗑</button>}
                </div>
              </div>
              <select value={savedName} onChange={e => loadSaved(e.target.value)} className={input + ' bg-white'}>
                <option value="">— Original templates —</option>
                {Object.keys(saved).sort((a, b) => a.localeCompare(b)).map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Title</label>
              <input value={title} onChange={e => setTitle(e.target.value)} className={input} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Form text — edit freely</label>
              <textarea value={body} onChange={e => setBody(e.target.value)} rows={20} className={input + ' resize-y text-[12.5px] leading-[1.5] font-mono'} />
              <p className="text-[11px] text-text-muted mt-1">Replace every <span className="text-litred-alt font-semibold">[bracketed]</span> field and delete instruction notes before use.</p>
            </div>
            <button onClick={() => loadTemplate(id)} className="w-full text-sm font-semibold text-text-muted hover:text-text-primary py-2 rounded-ctrl hover:bg-canvas border border-transparent hover:border-border">↺ Reset to original</button>
          </div>

          {/* Preview + actions */}
          <div className="space-y-3">
            <div className="bg-white border border-border rounded-card overflow-y-auto shadow-sm p-6" style={{ maxHeight: '64vh' }}>
              <div dangerouslySetInnerHTML={{ __html: hrFormDocHtml(title, body) }} />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={printPdf} className="bg-ink text-white text-sm font-semibold px-4 py-2.5 rounded-ctrl hover:bg-ink-dark">⤓ Print / PDF</button>
              <button onClick={downloadWord} className="bg-white border border-border-light text-ink text-sm font-semibold px-4 py-2.5 rounded-ctrl hover:bg-canvas">⤓ Word</button>
            </div>
            <p className="text-[11px] text-text-faint">Severance & release documents must be reviewed and approved by counsel before first use. Part D letters are transmittal letters only.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

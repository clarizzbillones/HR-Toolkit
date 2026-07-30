'use client';
import { useState, useEffect } from 'react';
import { useToast } from '@/components/Toast';
import { HR_FORMS, HR_FORM_PARTS, hrFormDocHtml } from '@/lib/hrForms';
import Lb0489Fill from './Lb0489Fill';
import SeveranceCalc from './SeveranceCalc';

// Forms with their own interactive builder instead of the plain text template.
const SPECIAL = new Set(['lb0489', 'c1']);

interface SavedForm { title: string; body: string; baseId: string }

// Drop the "A1 — " / "B1 — " style code prefix from a template title
// (keeps form numbers like "LB-0489 — …").
const cleanTitle = (t: string) => t.replace(/^[A-Z]\d+\s*[—-]\s*/, '');

export default function HrFormsClient() {
  const { showToast } = useToast();
  const [id, setId] = useState(HR_FORMS[0].id);
  const [title, setTitle] = useState(cleanTitle(HR_FORMS[0].title));
  const [body, setBody] = useState(HR_FORMS[0].body);
  const [saved, setSaved] = useState<Record<string, SavedForm>>({});
  const [savedName, setSavedName] = useState('');
  const [fills, setFills] = useState<Record<string, string>>({});

  // Detect the [bracketed] fill-in fields still present in the form text.
  const fields = Array.from(new Set(body.match(/\[[^\]]+\]/g) ?? []));
  function applyFills() {
    let next = body, n = 0;
    for (const token of fields) {
      const v = (fills[token] ?? '').trim();
      // Wrap the filled-in value so it renders bold in the preview / download.
      if (v) { next = next.split(token).join(`**${v}**`); n++; }
    }
    if (!n) { showToast('Type into a field first'); return; }
    setBody(next); setFills({});
    showToast(`Filled ${n} field${n > 1 ? 's' : ''}`);
  }

  // HR-only usage guidance for the current base template (never downloaded).
  const guidance = HR_FORMS.find(x => x.id === id)?.guidance;

  useEffect(() => {
    try { const raw = localStorage.getItem('litson_hr_forms'); if (raw) setSaved(JSON.parse(raw)); } catch { /* ignore */ }
  }, []);
  function persist(next: Record<string, SavedForm>) { setSaved(next); try { localStorage.setItem('litson_hr_forms', JSON.stringify(next)); } catch { /* ignore */ } }

  function loadTemplate(fid: string) {
    const f = HR_FORMS.find(x => x.id === fid);
    if (!f) return;
    setId(f.id); setTitle(cleanTitle(f.title)); setBody(f.body); setSavedName('');
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
        {SPECIAL.has(id) && (
          <div className="max-w-4xl space-y-4">
            <div className="bg-white border border-border rounded-card p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-gold-muted mb-1.5">Template</div>
              <select value={id} onChange={e => loadTemplate(e.target.value)} className={input + ' bg-white max-w-md'}>
                {HR_FORM_PARTS.map(part => (
                  <optgroup key={part} label={part}>
                    {HR_FORMS.filter(x => x.part === part).map(x => <option key={x.id} value={x.id}>{cleanTitle(x.title)}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            {guidance && (
              <div className="bg-[#eef2f7] border border-[#cbd8e6] rounded-card p-4 text-sm text-[#33506e]">
                <b>HR guidance (not printed):</b> {guidance}
              </div>
            )}
            {id === 'lb0489' ? <Lb0489Fill /> : <SeveranceCalc />}
          </div>
        )}
        {!SPECIAL.has(id) && (
        <div className="grid grid-cols-[340px_1fr] gap-6 max-w-6xl items-start">
          {/* Form panel */}
          <div className="bg-white border border-border rounded-card p-5 space-y-4 sticky top-0">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-gold-muted mb-1.5">Template</div>
              <select value={savedName ? '' : id} onChange={e => loadTemplate(e.target.value)} className={input + ' bg-white'}>
                {HR_FORM_PARTS.map(part => (
                  <optgroup key={part} label={part}>
                    {HR_FORMS.filter(f => f.part === part).map(f => <option key={f.id} value={f.id}>{cleanTitle(f.title)}</option>)}
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
            {fields.length > 0 && (
              <div className="border border-border-light rounded-ctrl p-3 bg-[#fbf7ee]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-gold-muted">Fill-in fields ({fields.length})</span>
                  <button onClick={applyFills} className="text-[11px] font-semibold text-white bg-ink px-2.5 py-1 rounded-ctrl hover:bg-ink-dark">Apply to form</button>
                </div>
                <div className="space-y-2 max-h-64 overflow-auto">
                  {fields.map(token => {
                    const long = token.length > 32;
                    return (
                      <div key={token}>
                        <label className="block text-[11px] font-semibold text-litred-alt mb-0.5 truncate" title={token}>{token}</label>
                        {long
                          ? <textarea value={fills[token] ?? ''} onChange={e => setFills(p => ({ ...p, [token]: e.target.value }))} rows={2} placeholder="Replace with your text…" className="w-full border border-border-light rounded-ctrl px-2 py-1.5 text-[12px] focus:outline-none focus:border-ink resize-y" />
                          : <input value={fills[token] ?? ''} onChange={e => setFills(p => ({ ...p, [token]: e.target.value }))} placeholder="Value…" className="w-full border border-border-light rounded-ctrl px-2 py-1.5 text-sm focus:outline-none focus:border-ink" />}
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-text-muted mt-1.5">Type values, then Apply — they replace the [brackets] in the form. Save or download when done.</p>
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Form text — edit freely</label>
              <textarea value={body} onChange={e => setBody(e.target.value)} rows={20} className={input + ' resize-y text-[12.5px] leading-[1.5] font-mono'} />
              <p className="text-[11px] text-text-muted mt-1">Replace every <span className="text-litred-alt font-semibold">[bracketed]</span> field — filled-in values show in <b>bold</b>. HR guidance is separate and never appears in the download.</p>
            </div>
            <button onClick={() => loadTemplate(id)} className="w-full text-sm font-semibold text-text-muted hover:text-text-primary py-2 rounded-ctrl hover:bg-canvas border border-transparent hover:border-border">↺ Reset to original</button>
          </div>

          {/* Preview + actions */}
          <div className="space-y-3">
            {guidance && (
              <div className="bg-[#eef2f7] border border-[#cbd8e6] rounded-card px-4 py-3 text-sm text-[#33506e]">
                <b>HR guidance (not printed):</b> {guidance}
              </div>
            )}
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
        )}
      </div>
    </div>
  );
}

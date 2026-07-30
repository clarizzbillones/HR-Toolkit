'use client';
import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/components/Toast';
import { HR_FORMS, HR_FORM_PARTS, hrFormDocHtml } from '@/lib/hrForms';
import { HANDBOOK_REFS, HANDBOOK_ISSUES, citationText } from '@/lib/handbook';
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
  // A token is a date field if it mentions "date" (singular) or an mm/dd/yyyy hint.
  const isDateToken = (t: string) => (/\bdate\b/i.test(t) && !/\bdates\b/i.test(t)) || /mm\/dd\/yyyy/i.test(t);
  // Render an ISO date value as a friendly long date; pass anything else through.
  function fmtMaybeDate(v: string) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      const d = new Date(v + 'T12:00:00');
      if (!isNaN(d.getTime())) return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }
    return v;
  }
  function applyFills() {
    let next = body, n = 0;
    for (const token of fields) {
      const v = fmtMaybeDate((fills[token] ?? '').trim());
      // Values fill in as normal weight; the field label stays bold.
      if (v) { next = next.split(token).join(v); n++; }
    }
    if (!n) { showToast('Type into a field first'); return; }
    setBody(next); setFills({});
    showToast(`Filled ${n} field${n > 1 ? 's' : ''}`);
  }

  // HR-only usage guidance for the current base template (never downloaded).
  const guidance = HR_FORMS.find(x => x.id === id)?.guidance;

  // The person who prepares / sends these letters (return contact + signature).
  const SENDER = { name: 'Clarizz Ann Alon', title: 'Human Resources', phone: '615-380-6550', email: 'clarizz@litson.co' };

  // Employee roster for the name dropdowns (auto-fills position + address).
  const [staff, setStaff] = useState<any[]>([]);
  useEffect(() => { fetch('/api/staff/basic').then(r => r.json()).then(d => setStaff(d.employees ?? [])).catch(() => {}); }, []);
  // In letters the employee is [EMPLOYEE NAME]/[FULL NAME] and [NAME] is the
  // sender; in warnings [NAME] is the employee. Detect which we're in.
  const hasEmpName = fields.some(t => /employee name|full name/i.test(t));
  const isLetterLike = hasEmpName || fields.some(t => /your name/i.test(t));
  const isNameToken = (t: string) => /employee name|full name/i.test(t) || (/^\[name\]$/i.test(t) && !hasEmpName);

  // Fill the sender / return-contact fields with Clarizz's details.
  function fillSenderInto(next: Record<string, string>) {
    for (const t of fields) {
      if (/^\[your name\]$/i.test(t)) next[t] = SENDER.name;
      else if (/^\[name\]$/i.test(t) && hasEmpName) next[t] = SENDER.name;
      else if (/\bphone\b/i.test(t)) next[t] = SENDER.phone;
      else if (/email\s*\/\s*address/i.test(t)) next[t] = SENDER.email;
      else if (/\bemail\b/i.test(t)) next[t] = SENDER.email;
      else if (/^\[title\]$/i.test(t) && isLetterLike) next[t] = SENDER.title;
    }
  }
  function pickName(token: string, value: string) {
    setFills(prev => {
      const next: Record<string, string> = { ...prev, [token]: value };
      const emp = staff.find(e => String(e.name).toLowerCase() === value.trim().toLowerCase());
      for (const tok of fields) {
        if (/address/i.test(tok)) { if (emp?.address) next[tok] = emp.address; }
        else if (/first\s*name/i.test(tok)) next[tok] = value.trim().split(/\s+/)[0] || next[tok] || '';
        else if (/\b(title|position)\b/i.test(tok) && !isLetterLike) { if (emp?.position) next[tok] = emp.position; }
      }
      // Sender fields (phone/email/signature) → Clarizz, as the letter's sender.
      fillSenderInto(next);
      return next;
    });
  }

  // ---- Rich-text toolbar for the form body ----
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  function wrapSelection(before: string, after: string) {
    const ta = bodyRef.current; if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    const sel = body.slice(s, e) || 'text';
    const next = body.slice(0, s) + before + sel + after + body.slice(e);
    setBody(next);
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(s + before.length, s + before.length + sel.length); });
  }
  function bulletSelection() {
    const ta = bodyRef.current; if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    // Expand to full lines.
    const ls = body.lastIndexOf('\n', s - 1) + 1;
    let le = body.indexOf('\n', e); if (le < 0) le = body.length;
    const block = body.slice(ls, le).split('\n').map(l => l.trim() ? (/^[•\-*]\s/.test(l) ? l : `• ${l}`) : l).join('\n');
    setBody(body.slice(0, ls) + block + body.slice(le));
    requestAnimationFrame(() => ta.focus());
  }

  // Handbook citation picker (for discipline forms).
  const [showCite, setShowCite] = useState(false);
  const [citeIssue, setCiteIssue] = useState('Attendance & tardiness');
  const citeMatches = HANDBOOK_REFS.filter(r => r.issues.includes(citeIssue));
  // ---- Send for e-signature ----
  type SignRow = { role: string; name: string; email: string };
  const [showSign, setShowSign] = useState(false);
  const [signers, setSigners] = useState<SignRow[]>([
    { role: 'Employee', name: '', email: '' },
    { role: 'Manager', name: '', email: '' },
    { role: 'HR', name: '', email: '' },
  ]);
  const [signNote, setSignNote] = useState('Please review and sign within 24 hours of receipt.');
  const [sentInfo, setSentInfo] = useState<{ id: string; url: string } | null>(null);
  const [sending, setSending] = useState(false);
  const ROLES = ['Employee', 'Manager', 'HR', 'Witness'];
  function updateSigner(i: number, patch: Partial<SignRow>) { setSigners(p => p.map((r, j) => j === i ? { ...r, ...patch } : r)); }
  async function sendForSignature() {
    const valid = signers.filter(s => s.name.trim());
    if (!valid.length) { showToast('Add at least one signatory name'); return; }
    setSending(true);
    try {
      const res = await fetch('/api/hr-forms/sign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send', title, body_html: hrFormDocHtml(title, body), note: signNote, signatories: valid }) });
      const d = await res.json();
      if (!res.ok) { showToast(d.error || 'Could not send'); return; }
      setSentInfo({ id: d.id, url: d.url });
      showToast(d.sent ? `Sent to ${d.sent} signatory${d.sent === 1 ? '' : 'ies'}` : 'Created — copy the link to share');
    } catch { showToast('Could not send'); }
    finally { setSending(false); }
  }
  async function sendReminder() {
    if (!sentInfo) return;
    const res = await fetch('/api/hr-forms/sign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'remind', id: sentInfo.id }) });
    const d = await res.json();
    showToast(res.ok ? (d.reminded ? `Reminder sent to ${d.reminded}` : 'No pending signers to remind') : (d.error || 'Failed'));
  }

  function insertCitation(text: string) {
    setBody(prev => {
      // Prefer to drop it onto the "Policy or standard involved" placeholder.
      const token = (prev.match(/\[Cite the handbook[^\]]*\]/) || [])[0];
      if (token) return prev.split(token).join(text);
      return prev.replace(/\s*$/, '') + `\n\n${text}`;
    });
    showToast('Citation added to the form');
  }

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

            {/* Handbook citation picker */}
            <div className="border border-[#cbd8e6] rounded-ctrl bg-[#eef2f7]">
              <button onClick={() => setShowCite(s => !s)} className="w-full flex items-center justify-between px-3 py-2 text-left">
                <span className="text-xs font-bold uppercase tracking-wider text-[#33506e]">📖 Cite from Handbook</span>
                <span className="text-[#33506e] text-sm">{showCite ? '▾' : '▸'}</span>
              </button>
              {showCite && (
                <div className="px-3 pb-3 space-y-2">
                  <p className="text-[11px] text-[#33506e]">Pick the issue, then insert the exact policy + standard into the form.</p>
                  <select value={citeIssue} onChange={e => setCiteIssue(e.target.value)} className={input + ' bg-white'}>
                    {HANDBOOK_ISSUES.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                  <div className="space-y-1.5 max-h-72 overflow-auto">
                    {citeMatches.map(r => (
                      <div key={r.id} className="bg-white border border-border-light rounded-ctrl p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[12px] font-semibold text-text-primary">{r.section} — {r.title}</span>
                          <button onClick={() => insertCitation(citationText(r))} className="shrink-0 text-[10px] font-semibold text-white bg-ink px-2 py-0.5 rounded-ctrl hover:bg-ink-dark">Insert</button>
                        </div>
                        <p className="text-[11px] text-text-muted mt-1 leading-snug">{r.standard}</p>
                      </div>
                    ))}
                    {!citeMatches.length && <p className="text-[11px] text-text-muted">No section for this issue.</p>}
                  </div>
                </div>
              )}
            </div>

            {fields.length > 0 && (
              <div className="border border-border-light rounded-ctrl p-3 bg-[#fbf7ee]">
                <div className="flex items-center justify-between mb-2 gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-gold-muted">Fill-in fields ({fields.length})</span>
                  <div className="flex items-center gap-1.5">
                    {isLetterLike && <button onClick={() => { setFills(prev => { const n = { ...prev }; fillSenderInto(n); return n; }); showToast('Filled sender — Clarizz'); }} className="text-[11px] font-semibold text-[#3f6b8a] hover:underline" title="Clarizz Ann Alon as the letter's sender / return contact">Sender: Clarizz</button>}
                    <button onClick={applyFills} className="text-[11px] font-semibold text-white bg-ink px-2.5 py-1 rounded-ctrl hover:bg-ink-dark">Apply to form</button>
                  </div>
                </div>
                <div className="space-y-2 max-h-64 overflow-auto">
                  {fields.map(token => {
                    const isDate = isDateToken(token);
                    const long = !isDate && token.length > 32;
                    const ctrl = 'w-full border border-border-light rounded-ctrl px-2 py-1.5 text-sm focus:outline-none focus:border-ink';
                    return (
                      <div key={token}>
                        <label className="block text-[11px] font-semibold text-litred-alt mb-0.5 truncate" title={token}>{token}</label>
                        {isNameToken(token)
                          ? <input list="hrf-emp" value={fills[token] ?? ''} onChange={e => pickName(token, e.target.value)} placeholder="Pick or type a name" className={ctrl} />
                          : isDate
                          ? <input type="date" value={fills[token] ?? ''} onChange={e => setFills(p => ({ ...p, [token]: e.target.value }))} className={ctrl} />
                          : long
                          ? <textarea value={fills[token] ?? ''} onChange={e => setFills(p => ({ ...p, [token]: e.target.value }))} rows={2} placeholder="Replace with your text…" className={ctrl + ' text-[12px] resize-y'} />
                          : <input value={fills[token] ?? ''} onChange={e => setFills(p => ({ ...p, [token]: e.target.value }))} placeholder="Value…" className={ctrl} />}
                      </div>
                    );
                  })}
                  <datalist id="hrf-emp">{staff.map(e => <option key={e.name} value={e.name} />)}</datalist>
                </div>
                <p className="text-[10px] text-text-muted mt-1.5">Type values, then Apply — they replace the [brackets] in the form. Save or download when done.</p>
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Form text — edit freely</label>
              <div className="flex items-center gap-1 mb-1.5">
                <button onClick={() => wrapSelection('**', '**')} title="Bold" className="w-7 h-7 rounded-ctrl border border-border-light text-sm font-bold hover:bg-canvas">B</button>
                <button onClick={() => wrapSelection('*', '*')} title="Italic" className="w-7 h-7 rounded-ctrl border border-border-light text-sm italic hover:bg-canvas">I</button>
                <button onClick={bulletSelection} title="Bullet list" className="w-7 h-7 rounded-ctrl border border-border-light text-sm hover:bg-canvas">•</button>
                <span className="text-[10px] text-text-muted ml-1">Select text, then Bold / Italic / Bullet</span>
              </div>
              <textarea ref={bodyRef} value={body} onChange={e => setBody(e.target.value)} rows={20} className={input + ' resize-y text-[12.5px] leading-[1.5] font-mono'} />
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
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={printPdf} className="bg-ink text-white text-sm font-semibold px-4 py-2.5 rounded-ctrl hover:bg-ink-dark">⤓ Print / PDF</button>
              <button onClick={downloadWord} className="bg-white border border-border-light text-ink text-sm font-semibold px-4 py-2.5 rounded-ctrl hover:bg-canvas">⤓ Word</button>
              <button onClick={() => setShowSign(s => !s)} className="bg-[#2f7d5b] text-white text-sm font-semibold px-4 py-2.5 rounded-ctrl hover:bg-[#276a4d]">✍ Send for signature</button>
            </div>

            {showSign && (
              <div className="bg-white border border-border rounded-card p-5 space-y-3">
                <div className="text-xs font-bold uppercase tracking-widest text-gold-muted">Send for e-signature</div>
                <p className="text-[11px] text-text-muted">Each signatory gets their own emailed link. The <b>Witness</b> signs only if the employee declines. A 24-hour reminder note is included automatically.</p>
                <div className="space-y-2">
                  {signers.map((s, i) => (
                    <div key={i} className="grid grid-cols-[110px_1fr_1fr_28px] gap-2 items-center">
                      <select value={s.role} onChange={e => updateSigner(i, { role: e.target.value })} className="border border-border-light rounded-ctrl px-2 py-1.5 text-xs bg-white">
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <input value={s.name} onChange={e => updateSigner(i, { name: e.target.value })} placeholder="Full name" className="border border-border-light rounded-ctrl px-2 py-1.5 text-xs" />
                      <input value={s.email} onChange={e => updateSigner(i, { email: e.target.value })} placeholder="email@litson.co" className="border border-border-light rounded-ctrl px-2 py-1.5 text-xs" />
                      <button onClick={() => setSigners(p => p.filter((_, j) => j !== i))} className="text-litred-alt text-sm" title="Remove">×</button>
                    </div>
                  ))}
                </div>
                <button onClick={() => setSigners(p => [...p, { role: 'Witness', name: '', email: '' }])} className="text-[11px] font-semibold text-[#3f6b8a] hover:underline">+ Add signatory / witness</button>
                <div>
                  <label className="block text-[11px] font-semibold text-text-secondary mb-1">Note to signatories</label>
                  <textarea value={signNote} onChange={e => setSignNote(e.target.value)} rows={2} className={input + ' resize-y text-xs'} />
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={sendForSignature} disabled={sending} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark disabled:opacity-50">{sending ? 'Sending…' : 'Send'}</button>
                  {sentInfo && <button onClick={sendReminder} className="bg-white border border-border-light text-ink text-sm font-semibold px-3 py-2 rounded-ctrl hover:bg-canvas">🔔 Send reminder</button>}
                </div>
                {sentInfo && (
                  <div className="bg-[#eef5f1] border border-[#cfe4d8] rounded-ctrl p-3 text-xs">
                    <div className="font-semibold text-[#2f7d5b] mb-1">Sent — signing link:</div>
                    <a href={sentInfo.url} target="_blank" rel="noopener noreferrer" className="text-[#3f6b8a] break-all hover:underline">{sentInfo.url}</a>
                    <div className="text-text-muted mt-1">You&apos;ll be notified when everyone has signed. HR is copied on completion.</div>
                  </div>
                )}
              </div>
            )}

            <p className="text-[11px] text-text-faint">Severance & release documents must be reviewed and approved by counsel before first use. Part D letters are transmittal letters only.</p>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

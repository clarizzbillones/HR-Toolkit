'use client';
import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';

interface Item { id: string; kind: 'section' | 'task'; title: string; body: string | null; done: boolean; sort_order: number; }

export default function OnboardingClient() {
  const { showToast } = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ title: string; body: string }>({ title: '', body: '' });
  const [hire, setHire] = useState('');

  useEffect(() => { fetch('/api/onboarding').then(r => r.json()).then(d => setItems(d.items ?? [])); }, []);

  const sections = items.filter(i => i.kind === 'section');
  const tasks = items.filter(i => i.kind === 'task');
  const doneCount = tasks.filter(t => t.done).length;

  async function patch(id: string, fields: Partial<Item>) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...fields } : i));
    await fetch('/api/onboarding', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...fields }) });
  }
  async function add(kind: 'section' | 'task') {
    const res = await fetch('/api/onboarding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, title: kind === 'section' ? 'New Section' : 'New checklist item', body: kind === 'section' ? '' : null }) });
    const { item } = await res.json();
    setItems(prev => [...prev, item]);
    if (kind === 'section') { setEditing(item.id); setDraft({ title: item.title, body: item.body ?? '' }); }
  }
  async function remove(id: string) {
    setItems(prev => prev.filter(i => i.id !== id));
    await fetch('/api/onboarding', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    showToast('Removed');
  }
  function startEdit(s: Item) { setEditing(s.id); setDraft({ title: s.title, body: s.body ?? '' }); }
  async function saveEdit(id: string) { await patch(id, { title: draft.title, body: draft.body }); setEditing(null); showToast('Saved'); }

  const greeting = hire.trim() ? `Hi ${hire.trim()},` : 'Welcome aboard,';

  function printGuide() {
    const esc = (v: string) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const secHtml = sections.map(s => `
      <section style="margin:0 0 22px;break-inside:avoid">
        <h2 style="font-size:15px;font-weight:700;color:#1b2a3d;border-left:4px solid #c9a24a;padding-left:10px;margin:0 0 8px">${esc(s.title)}</h2>
        <div style="white-space:pre-wrap;font-size:12px;line-height:1.6;color:#333">${esc(s.body ?? '')}</div>
      </section>`).join('');
    const taskHtml = tasks.map(t => `<li style="margin:2px 0;font-size:12px;color:#333">☐ ${esc(t.title)}</li>`).join('');
    const SANS = "'Helvetica Neue',Helvetica,Arial,sans-serif";
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>LITSON — New Hire Onboarding Guide</title>
      <style>@page{size:A4;margin:16mm} body{font-family:${SANS}} h2{break-after:avoid}</style></head>
      <body style="margin:0;color:#2a2a2a;-webkit-print-color-adjust:exact;print-color-adjust:exact">
        <div style="background:linear-gradient(120deg,#1b2a3d,#26405c);padding:26px 32px;border-bottom:4px solid #c9a24a;color:#fff">
          <div style="font-size:24px;font-weight:800;letter-spacing:.18em">LITSON</div>
          <div style="font-size:11px;color:#c9a24a;letter-spacing:.12em;font-weight:600">NEW HIRE ONBOARDING GUIDE</div>
        </div>
        <div style="padding:26px 32px">
          <p style="font-size:13px;color:#1b2a3d;font-weight:600;margin:0 0 18px">${esc(greeting)}</p>
          ${secHtml}
          <section style="break-inside:avoid">
            <h2 style="font-size:15px;font-weight:700;color:#1b2a3d;border-left:4px solid #2f7d5b;padding-left:10px;margin:0 0 8px">Onboarding Checklist</h2>
            <ul style="list-style:none;padding:0;margin:0;columns:2">${taskHtml}</ul>
          </section>
        </div>
      </body></html>`;
    const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 300); }
  }

  function copyEmail() {
    const text = `${greeting}\n\n` + sections.map(s => `${s.title.toUpperCase()}\n${s.body ?? ''}`).join('\n\n') +
      `\n\nONBOARDING CHECKLIST\n` + tasks.map(t => `- ${t.title}`).join('\n');
    navigator.clipboard?.writeText(text);
    showToast('Guide copied — paste into an email');
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="px-8 py-5 bg-white border-b border-border flex-shrink-0 flex items-center gap-4 flex-wrap">
        <div>
          <h1 className="font-spectral text-[23px] font-semibold text-text-primary">Onboarding</h1>
          <p className="text-sm text-text-muted mt-0.5">A welcome guide you can customize and send to new hires</p>
        </div>
        <div className="ml-auto flex items-center gap-2.5">
          <input value={hire} onChange={e => setHire(e.target.value)} placeholder="New hire name (optional)"
            className="border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink w-52" />
          <button onClick={copyEmail} className="bg-white border border-border-light text-ink text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-canvas">✉ Copy as email</button>
          <button onClick={printGuide} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark">🖨 Print / Save PDF</button>
        </div>
      </header>

      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl">
          {/* Guide sections */}
          <div className="lg:col-span-2 space-y-4">
            {sections.map(s => (
              <div key={s.id} className="bg-white border border-border rounded-card overflow-hidden">
                {editing === s.id ? (
                  <div className="p-5 space-y-3">
                    <input value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
                      className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm font-semibold focus:outline-none focus:border-ink" />
                    <textarea value={draft.body} onChange={e => setDraft(d => ({ ...d, body: e.target.value }))} rows={6}
                      className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(s.id)} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark">Save</button>
                      <button onClick={() => setEditing(null)} className="text-sm text-text-muted px-3">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="p-5 group">
                    <div className="flex items-start gap-2">
                      <h2 className="font-spectral text-[17px] font-semibold text-text-primary flex-1"
                        style={{ borderLeft: '3px solid #c9a24a', paddingLeft: 10 }}>{s.title}</h2>
                      <button onClick={() => startEdit(s)} className="text-xs font-semibold text-ink border border-border-light px-2.5 py-1 rounded-ctrl hover:bg-canvas opacity-0 group-hover:opacity-100">Edit</button>
                      <button onClick={() => remove(s.id)} className="text-xs font-semibold text-litred-alt border border-border-light px-2.5 py-1 rounded-ctrl hover:bg-[#fdeaea] opacity-0 group-hover:opacity-100">Delete</button>
                    </div>
                    <p className="text-sm text-text-secondary mt-2 whitespace-pre-wrap leading-relaxed pl-3">{s.body}</p>
                  </div>
                )}
              </div>
            ))}
            <button onClick={() => add('section')} className="w-full border-2 border-dashed border-border-light rounded-card py-3 text-sm font-semibold text-text-muted hover:text-ink hover:border-ink transition-colors">+ Add section</button>
          </div>

          {/* Checklist */}
          <div>
            <div className="bg-white border border-border rounded-card overflow-hidden sticky top-0">
              <div className="px-5 py-3 border-b border-border flex items-center justify-between" style={{ borderBottom: '2px solid #2f7d5b' }}>
                <h2 className="font-spectral text-[16px] font-semibold text-text-primary">Onboarding Checklist</h2>
                <span className="text-xs font-semibold text-[#2f7d5b]">{doneCount}/{tasks.length}</span>
              </div>
              <div className="p-3 space-y-1">
                {tasks.map(t => (
                  <label key={t.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-ctrl hover:bg-canvas cursor-pointer group">
                    <input type="checkbox" checked={t.done} onChange={e => patch(t.id, { done: e.target.checked })}
                      className="w-4 h-4 accent-[#2f7d5b]" />
                    <input value={t.title} onChange={e => patch(t.id, { title: e.target.value })}
                      className={`flex-1 bg-transparent text-sm focus:outline-none ${t.done ? 'line-through text-text-muted' : 'text-text-primary'}`} />
                    <button onClick={() => remove(t.id)} className="text-xs text-text-muted hover:text-litred-alt opacity-0 group-hover:opacity-100">✕</button>
                  </label>
                ))}
                <button onClick={() => add('task')} className="w-full text-left px-2 py-1.5 text-sm font-semibold text-text-muted hover:text-ink">+ Add item</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';
import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';

interface Item {
  id: string; guide: string; kind: 'section' | 'schedule' | 'sop' | 'tool' | 'table' | 'task';
  title: string; body: string | null; day: string | null; assignee: string | null;
  location: string | null; url: string | null; owner: string | null; done: boolean; sort_order: number;
}
// Render clickable links in section text.
// Supports [Label](https://url) for a friendly label; bare URLs are shortened.
function linkify(text: string | null) {
  const src = String(text ?? '');
  const re = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s]+)/g;
  const out: React.ReactNode[] = [];
  let last = 0, m: RegExpExecArray | null, i = 0;
  const cls = "text-[#3f6b8a] underline font-medium";
  while ((m = re.exec(src))) {
    if (m.index > last) out.push(<span key={i++}>{src.slice(last, m.index)}</span>);
    if (m[1]) {
      out.push(<a key={i++} href={m[2]} target="_blank" rel="noopener noreferrer" className={cls}>{m[1]}</a>);
    } else {
      const url = m[3]; let label = url.replace(/^https?:\/\//, '').replace(/^www\./, '');
      if (label.length > 42) label = label.slice(0, 42) + '…';
      out.push(<a key={i++} href={url} target="_blank" rel="noopener noreferrer" className={cls}>{label} ↗</a>);
    }
    last = m.index + m[0].length;
  }
  if (last < src.length) out.push(<span key={i++}>{src.slice(last)}</span>);
  return out;
}

interface TableData { headers: string[]; rows: string[][] }
function parseTable(body: string | null): TableData {
  try { const t = JSON.parse(body ?? ''); if (Array.isArray(t.headers) && Array.isArray(t.rows)) return t; } catch { /* ignore */ }
  return { headers: ['Column 1', 'Column 2'], rows: [['', '']] };
}

export default function OnboardingClient() {
  const { showToast } = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [guide, setGuide] = useState('General');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ title: string; body: string }>({ title: '', body: '' });
  // Draft/customize mode: edits are temporary and only affect the exported PDF
  const [draftMode, setDraftMode] = useState(false);
  const [snapshot, setSnapshot] = useState<Item[] | null>(null);
  function enterDraft() { setSnapshot(items.map(i => ({ ...i }))); setDraftMode(true); setEditing(null); }
  function exitDraft() { if (snapshot) setItems(snapshot); setSnapshot(null); setDraftMode(false); setEditing(null); showToast('Reverted to the saved template'); }
  const [hire, setHire] = useState('');
  const [view, setView] = useState<'dashboard' | 'guides'>('dashboard');
  const [people, setPeople] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const blankNew = { name: '', email: '', position: '', worker_type: 'Employee', guide: 'General', start_date: '', dob: '', phone: '' };
  const [newForm, setNewForm] = useState({ ...blankNew });

  useEffect(() => { fetch('/api/onboarding').then(r => r.json()).then(d => setItems(d.items ?? [])); }, []);
  useEffect(() => { fetch('/api/onboardees').then(r => r.json()).then(d => setPeople(d.rows ?? [])); }, []);

  function tasksFor(g: string) { return items.filter(i => i.guide === g && i.kind === 'task'); }
  const parseProg = (p: any) => { try { return JSON.parse(p ?? '{}') || {}; } catch { return {}; } };
  function progressOf(person: any) {
    const t = tasksFor(person.guide); const prog = parseProg(person.progress);
    const done = t.filter(x => prog[x.title]).length;
    return { done, total: t.length, pct: t.length ? Math.round(done / t.length * 100) : 0 };
  }
  async function addOnboardee() {
    if (!newForm.name.trim()) { showToast('Name required'); return; }
    const res = await fetch('/api/onboardees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newForm) });
    const { row } = await res.json();
    setPeople(prev => [row, ...prev]); setShowAdd(false); setNewForm({ ...blankNew }); setSelected(row.id);
    showToast('Onboarding started');
  }
  async function toggleTask(person: any, title: string, val: boolean) {
    const prog = { ...parseProg(person.progress), [title]: val };
    setPeople(prev => prev.map(p => p.id === person.id ? { ...p, progress: JSON.stringify(prog) } : p));
    await fetch('/api/onboardees', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: person.id, progress: prog }) });
  }
  async function completeOnboardee(person: any) {
    if (!confirm(`Mark ${person.name}'s onboarding complete? Their info will be added to the Staffing tab.`)) return;
    const res = await fetch('/api/onboardees', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: person.id, complete: true }) });
    const { row } = await res.json();
    setPeople(prev => prev.map(p => p.id === person.id ? row : p));
    showToast('Complete — added to Staffing');
  }
  async function deleteOnboardee(id: string) {
    if (!confirm('Remove this onboarding record?')) return;
    setPeople(prev => prev.filter(p => p.id !== id));
    if (selected === id) setSelected(null);
    await fetch('/api/onboardees', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
  }

  // Distinct guides, General first
  const guides = Array.from(new Set(items.map(i => i.guide))).sort((a, b) => (a === 'General' ? -1 : b === 'General' ? 1 : a.localeCompare(b)));
  useEffect(() => { if (guides.length && !guides.includes(guide)) setGuide(guides[0]); }, [items]); // eslint-disable-line

  const gItems = items.filter(i => i.guide === guide);
  const introSections = gItems.filter(i => i.kind === 'section' && i.sort_order < 50);
  const closingSections = gItems.filter(i => i.kind === 'section' && i.sort_order >= 50);
  const schedule = gItems.filter(i => i.kind === 'schedule');
  const tools = gItems.filter(i => i.kind === 'tool');
  const links = gItems.filter(i => i.kind === 'sop');
  const tables = gItems.filter(i => i.kind === 'table');
  const tasks = gItems.filter(i => i.kind === 'task');
  const hrTasks = tasks.filter(t => (t.owner ?? '') === 'HR');
  const hireTasks = tasks.filter(t => (t.owner ?? '') !== 'HR');
  const hireLabel = guide === 'Contractor' ? 'Contractor' : 'New Hire';
  const doneCount = tasks.filter(t => t.done).length;

  async function patch(id: string, fields: Partial<Item>) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...fields } : i));
    if (draftMode) return;
    await fetch('/api/onboarding', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...fields }) });
  }
  async function add(kind: Item['kind'], seed: Partial<Item> = {}) {
    if (draftMode) {
      const item = { id: 'tmp' + Date.now() + Math.random().toString(36).slice(2, 6), guide, kind, title: '', body: null, day: null, assignee: null, location: null, url: null, owner: null, done: false, sort_order: 9999, ...seed } as Item;
      setItems(prev => [...prev, item]); return item;
    }
    const res = await fetch('/api/onboarding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, guide, ...seed }) });
    const { item } = await res.json();
    setItems(prev => [...prev, item]);
    return item as Item;
  }
  async function addGuide() {
    const name = prompt('Name this guide (e.g. Attorney, Intern, Paralegal):')?.trim();
    if (!name) return;
    if (guides.includes(name)) { setGuide(name); return; }
    const res = await fetch('/api/onboarding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'section', guide: name, title: 'Welcome', body: 'Start building this guide — edit, add, or remove anything.' }) });
    const { item } = await res.json();
    setItems(prev => [...prev, item]); setGuide(name);
    showToast(`Created “${name}” guide`);
  }
  async function copyGuideFrom(from: string) {
    if (!confirm(`Copy the entire “${from}” guide into “${guide}”? The “${from}” guide stays unchanged; its content is added here.`)) return;
    const res = await fetch('/api/onboarding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'duplicate', from, to: guide }) });
    const { items } = await res.json();
    setItems(items ?? []);
    showToast(`Copied “${from}” into “${guide}”`);
  }
  async function deleteGuide() {
    if (guide === 'General') { showToast('Keep at least the General guide'); return; }
    if (!confirm(`Delete the entire “${guide}” guide? This cannot be undone.`)) return;
    setItems(prev => prev.filter(i => i.guide !== guide));
    setGuide('General');
    await fetch('/api/onboarding', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guide }) });
    showToast('Guide deleted');
  }
  async function remove(id: string) {
    setItems(prev => prev.filter(i => i.id !== id));
    if (draftMode) return;
    await fetch('/api/onboarding', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    showToast('Removed');
  }
  async function resetTemplate() {
    if (!confirm('Reset the whole guide back to the Litson template? This replaces all current content.')) return;
    const res = await fetch('/api/onboarding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reset' }) });
    const { items } = await res.json();
    setItems(items ?? []);
    showToast('Reset to template');
  }
  async function addSection() {
    const item = await add('section', { title: 'New Section', body: '' });
    setEditing(item.id); setDraft({ title: item.title, body: item.body ?? '' });
  }
  async function copyToGuide(s: Item) {
    const targets = guides.filter(g => g !== guide);
    const to = prompt(`Copy “${s.title}” to which guide?\n${targets.join(', ')}`, targets[0] ?? '')?.trim();
    if (!to) return;
    const res = await fetch('/api/onboarding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'section', guide: to, title: s.title, body: s.body }) });
    const { item } = await res.json();
    setItems(prev => [...prev, item]);
    showToast(`Copied to “${to}”`);
  }
  function startEdit(s: Item) { setEditing(s.id); setDraft({ title: s.title, body: s.body ?? '' }); }
  async function saveEdit(id: string) { await patch(id, { title: draft.title, body: draft.body }); setEditing(null); showToast('Saved'); }

  const greeting = hire.trim() ? `Hi ${hire.trim()},` : 'Welcome aboard,';

  const SectionCard = (s: Item) => (
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
            <h2 className="font-spectral text-[17px] font-semibold text-text-primary flex-1" style={{ borderLeft: '3px solid #c9a24a', paddingLeft: 10 }}>{s.title}</h2>
            <button onClick={() => startEdit(s)} className="text-xs font-semibold text-ink border border-border-light px-2.5 py-1 rounded-ctrl hover:bg-canvas opacity-0 group-hover:opacity-100">Edit</button>
            {guides.length > 1 && <button onClick={() => copyToGuide(s)} className="text-xs font-semibold text-ink border border-border-light px-2.5 py-1 rounded-ctrl hover:bg-canvas opacity-0 group-hover:opacity-100">Copy to…</button>}
            <button onClick={() => remove(s.id)} className="text-xs font-semibold text-litred-alt border border-border-light px-2.5 py-1 rounded-ctrl hover:bg-[#fdeaea] opacity-0 group-hover:opacity-100">Delete</button>
          </div>
          <p className="text-sm text-text-secondary mt-2 whitespace-pre-wrap leading-relaxed pl-3">{linkify(s.body)}</p>
        </div>
      )}
    </div>
  );

  const cell = "px-3 py-2 text-sm border-t border-[#f1ece3]";
  const inp = "w-full bg-transparent focus:outline-none focus:bg-canvas rounded px-1 -mx-1";

  function saveTable(id: string, d: TableData) { patch(id, { body: JSON.stringify(d) }); }

  // Reusable editable list (Tools or SOP Links)
  const LinkBlock = ({ kind, title, color, list, placeholder }: { kind: 'tool' | 'sop'; title: string; color: string; list: Item[]; placeholder: string }) => (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2.5 h-6 rounded-full" style={{ background: color }} />
        <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color }}>{title}</h2>
      </div>
      <div className="bg-white border border-border rounded-card p-3 space-y-1">
        {list.map(l => (
          <div key={l.id} className="flex items-center gap-2 px-2 py-1.5 rounded-ctrl hover:bg-canvas group">
            <input value={l.title} onChange={e => patch(l.id, { title: e.target.value })} className="flex-1 bg-transparent text-sm font-medium text-text-primary focus:outline-none" placeholder={placeholder} />
            <input value={l.url ?? ''} onChange={e => patch(l.id, { url: e.target.value })} className="w-56 bg-transparent text-sm text-[#3f6b8a] focus:outline-none border-l border-border-light pl-2" placeholder="paste link (optional)" />
            {l.url && <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#3f6b8a] hover:underline">↗</a>}
            <button onClick={() => remove(l.id)} className="text-xs text-text-muted hover:text-litred-alt opacity-0 group-hover:opacity-100">✕</button>
          </div>
        ))}
        <button onClick={() => add(kind, { title: placeholder })} className="w-full text-left px-2 py-1.5 text-sm font-semibold text-text-muted hover:text-ink">+ Add</button>
      </div>
    </div>
  );

  function printGuide() {
    const esc = (v: any) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const secHtml = (arr: Item[]) => arr.map(s => `
      <section style="margin:0 0 18px;break-inside:avoid">
        <h2 style="font-size:14px;font-weight:700;color:#1b2a3d;border-left:4px solid #c9a24a;padding-left:10px;margin:0 0 6px">${esc(s.title)}</h2>
        <div style="white-space:pre-wrap;font-size:12px;line-height:1.6;color:#333">${esc(s.body ?? '')
          .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" style="color:#3f6b8a">$1</a>')
          .replace(/(?<!href=")(https?:\/\/[^\s<]+)/g, (u: string) => { let l = u.replace(/^https?:\/\//, '').replace(/^www\./, ''); if (l.length > 42) l = l.slice(0, 42) + '…'; return `<a href="${u}" style="color:#3f6b8a">${l} ↗</a>`; })}</div>
      </section>`).join('');
    const schedHtml = schedule.length === 0 ? '' : `
      <h2 style="font-size:14px;font-weight:700;color:#1b2a3d;border-left:4px solid #3f6b8a;padding-left:10px;margin:20px 0 6px">2-Week Training Schedule</h2>
      <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:8px">
        <thead><tr style="background:#e9f0f5">${['Date','Agenda','Assignee','Notes','Location'].map(h => `<th style="text-align:left;padding:5px 8px;color:#3f6b8a;font-size:9px;text-transform:uppercase">${h}</th>`).join('')}</tr></thead>
        <tbody>${schedule.map(r => `<tr style="border-top:1px solid #eee">${[r.day, r.title, r.assignee, r.body, r.location].map(c => `<td style="padding:5px 8px;color:#333">${esc(c) || '—'}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>`;
    const listHtml = (heading: string, list: Item[]) => list.length === 0 ? '' : `
      <h2 style="font-size:14px;font-weight:700;color:#1b2a3d;border-left:4px solid #6b4f8a;padding-left:10px;margin:20px 0 6px">${heading}</h2>
      <ul style="columns:2;font-size:12px;color:#333;padding-left:16px">${list.map(l => `<li style="margin:2px 0">${l.url ? `<a href="${esc(l.url)}" style="color:#3f6b8a">${esc(l.title)}</a>` : esc(l.title)}</li>`).join('')}</ul>`;
    const toolsHtml = listHtml('Tools', tools);
    const linksHtml = listHtml('SOP Links', links);
    const tablesHtml = tables.map(t => { const d = parseTable(t.body); return `
      <h2 style="font-size:14px;font-weight:700;color:#1b2a3d;border-left:4px solid #8a6d3b;padding-left:10px;margin:20px 0 6px">${esc(t.title)}</h2>
      <table style="width:100%;border-collapse:collapse;font-size:11px;break-inside:avoid">
        <thead><tr style="background:#f0ece4">${d.headers.map(h => `<th style="text-align:left;padding:5px 8px;color:#8a6d3b;font-size:9px;text-transform:uppercase">${esc(h)}</th>`).join('')}</tr></thead>
        <tbody>${d.rows.map(r => `<tr style="border-top:1px solid #eee">${r.map(c => `<td style="padding:5px 8px;color:#333">${esc(c) || '—'}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>`; }).join('');
    // Outbound guide shows only the new-hire checklist — HR tasks stay internal
    const taskHtml = hireTasks.length ? `
      <h2 style="font-size:14px;font-weight:700;color:#1b2a3d;border-left:4px solid #2f7d5b;padding-left:10px;margin:20px 0 6px">Onboarding Checklist</h2>
      <ul style="list-style:none;padding:0;columns:2;font-size:12px;color:#333">${hireTasks.map(t => `<li style="margin:2px 0">${t.done ? '☑' : '☐'} ${esc(t.title)}</li>`).join('')}</ul>` : '';
    const SANS = "'Helvetica Neue',Helvetica,Arial,sans-serif";
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Litson — New Hire Onboarding Guide</title>
      <style>@page{size:A4;margin:14mm} body{font-family:${SANS}} h2{break-after:avoid} tr,td,th{break-inside:avoid}</style></head>
      <body style="margin:0;color:#2a2a2a;-webkit-print-color-adjust:exact;print-color-adjust:exact">
        <div style="background:linear-gradient(120deg,#1b2a3d,#26405c);padding:24px 32px;border-bottom:4px solid #c9a24a;color:#fff">
          <div style="font-size:24px;font-weight:800;letter-spacing:.18em">LITSON</div>
          <div style="font-size:11px;color:#c9a24a;letter-spacing:.12em;font-weight:600">${esc(guide.toUpperCase())} ONBOARDING GUIDE</div>
        </div>
        <div style="padding:24px 32px">
          <p style="font-size:13px;color:#1b2a3d;font-weight:600;margin:0 0 16px">${esc(greeting)}</p>
          ${secHtml(introSections)}${schedHtml}${toolsHtml}${linksHtml}${tablesHtml}${secHtml(closingSections)}${taskHtml}
        </div>
      </body></html>`;
    const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 300); }
  }

  function buildText() {
    const tbl = (t: Item) => { const d = parseTable(t.body); return `${t.title.toUpperCase()}\n` + [d.headers.join(' | '), ...d.rows.map(r => r.join(' | '))].join('\n'); };
    return `${greeting}\n\n`
      + introSections.map(s => `${s.title.toUpperCase()}\n${s.body ?? ''}`).join('\n\n')
      + (schedule.length ? `\n\n2-WEEK TRAINING SCHEDULE\n` + schedule.map(r => `${r.day} — ${r.title}${r.assignee ? ` (${r.assignee})` : ''}${r.location ? ` [${r.location}]` : ''}`).join('\n') : '')
      + (tools.length ? `\n\nTOOLS\n` + tools.map(l => `- ${l.title}${l.url ? `: ${l.url}` : ''}`).join('\n') : '')
      + (links.length ? `\n\nSOP LINKS\n` + links.map(l => `- ${l.title}${l.url ? `: ${l.url}` : ''}`).join('\n') : '')
      + (tables.length ? `\n\n` + tables.map(tbl).join('\n\n') : '')
      + (closingSections.length ? `\n\n` + closingSections.map(s => `${s.title.toUpperCase()}\n${s.body ?? ''}`).join('\n\n') : '')
      + (hireTasks.length ? `\n\nCHECKLIST\n` + hireTasks.map(t => `- ${t.title}`).join('\n') : '');
  }
  function copyEmail() { navigator.clipboard?.writeText(buildText()); showToast('Guide copied — paste into an email'); }
  function emailGuide() {
    const subject = `${guide} Onboarding Guide — Litson${hire.trim() ? ` (${hire.trim()})` : ''}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(buildText())}`;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="px-8 py-5 bg-white border-b border-border flex-shrink-0 flex items-center gap-4 flex-wrap">
        <div>
          <h1 className="font-spectral text-[23px] font-semibold text-text-primary">Onboarding</h1>
          <p className="text-sm text-text-muted mt-0.5">{view === 'dashboard' ? 'Track each new hire’s progress; completed people flow into Staffing' : 'Edit, add, or remove anything, then send it'}</p>
        </div>
        <div className="flex items-center bg-[#f1ece3] rounded-ctrl p-0.5 ml-4">
          {(['dashboard', 'guides'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`text-sm font-semibold px-4 py-1.5 rounded transition-colors ${view === v ? 'bg-white text-ink shadow-sm' : 'text-text-muted hover:text-text-primary'}`}>
              {v === 'dashboard' ? 'Dashboard' : 'Guide Templates'}
            </button>
          ))}
        </div>
        {view === 'guides' && (
          <div className="ml-auto flex items-center gap-2.5">
            <input value={hire} onChange={e => setHire(e.target.value)} placeholder="New hire name (optional)"
              className="border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink w-44" />
            {draftMode ? (
              <button onClick={exitDraft} className="bg-[#fdeaea] border border-[#f3c9c1] text-[#b0412f] text-sm font-semibold px-3 py-2 rounded-ctrl hover:bg-[#fbddd6]">✕ Discard changes</button>
            ) : (
              <>
                <button onClick={enterDraft} className="bg-white border border-border-light text-ink text-sm font-semibold px-3 py-2 rounded-ctrl hover:bg-canvas" title="Make temporary edits just for this PDF">✎ Customize for export</button>
                <button onClick={resetTemplate} className="bg-white border border-border-light text-text-muted text-sm font-semibold px-3 py-2 rounded-ctrl hover:bg-canvas">↺ Reset</button>
              </>
            )}
            <button onClick={copyEmail} className="bg-white border border-border-light text-ink text-sm font-semibold px-3 py-2 rounded-ctrl hover:bg-canvas">⧉ Copy</button>
            <button onClick={emailGuide} className="bg-white border border-border-light text-ink text-sm font-semibold px-3 py-2 rounded-ctrl hover:bg-canvas">✉ Email</button>
            <button onClick={printGuide} className="bg-ink text-white text-sm font-semibold px-3 py-2 rounded-ctrl hover:bg-ink-dark">🖨 PDF</button>
          </div>
        )}
        {view === 'dashboard' && (
          <button onClick={() => { setShowAdd(true); setNewForm({ ...blankNew, guide: guides[0] ?? 'General' }); }} className="ml-auto bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark">+ Add new hire</button>
        )}
      </header>

      {/* Guide selector (guides view only) */}
      {view === 'guides' && (
      <div className="px-8 pt-4 bg-white border-b border-border flex items-center gap-2 flex-wrap flex-shrink-0">
        {guides.map(g => (
          <button key={g} onClick={() => setGuide(g)}
            className={`text-sm font-semibold px-4 py-2 rounded-t-ctrl border-b-2 transition-colors ${guide === g ? 'border-ink text-ink' : 'border-transparent text-text-muted hover:text-text-primary'}`}>
            {g}
          </button>
        ))}
        <button onClick={addGuide} className="text-sm font-semibold px-3 py-2 text-text-muted hover:text-ink">+ New guide</button>
        {guide !== 'General' && !draftMode && (
          <div className="ml-auto flex items-center gap-3">
            <button onClick={() => copyGuideFrom('General')} className="text-xs font-semibold text-ink border border-border-light bg-white px-3 py-1.5 rounded-ctrl hover:bg-canvas">⧉ Copy General guide here</button>
            <button onClick={deleteGuide} className="text-xs font-semibold text-litred-alt hover:underline">Delete “{guide}” guide</button>
          </div>
        )}
      </div>
      )}

      {view === 'guides' && draftMode && (
        <div className="px-8 py-2 bg-[#fbf3e6] border-b border-[#e8d5b0] text-xs font-semibold text-[#8a6d3b] flex items-center gap-2 flex-shrink-0">
          ✎ Customize mode — edits and deletions here are <span className="underline">temporary</span> and only affect the PDF/email you export now. Discard when done to keep the saved template unchanged.
        </div>
      )}

      {view === 'dashboard' && Dashboard()}

      {view === 'guides' && (
      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 max-w-7xl">
          <div className="xl:col-span-2 space-y-6">
            {/* Intro sections */}
            <div className="space-y-4">
              {introSections.map(SectionCard)}
              <button onClick={addSection} className="w-full border-2 border-dashed border-border-light rounded-card py-2.5 text-sm font-semibold text-text-muted hover:text-ink hover:border-ink transition-colors">+ Add section</button>
            </div>

            {/* Schedule table */}
            {(schedule.length > 0 || guide === 'General') && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2.5 h-6 rounded-full bg-[#3f6b8a]" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-[#3f6b8a]">2-Week Training Schedule</h2>
              </div>
              <div className="bg-white border border-border rounded-card overflow-x-auto">
                <table className="w-full text-sm min-w-[720px]">
                  <thead className="bg-[#e9f0f5]"><tr>
                    {['Date', 'Agenda', 'Assignee', 'Notes', 'Location', ''].map(h => <th key={h} className="text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[#3f6b8a]">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {schedule.map(r => (
                      <tr key={r.id} className="group">
                        <td className={cell + ' w-28'}><input value={r.day ?? ''} onChange={e => patch(r.id, { day: e.target.value })} className={inp + ' font-medium'} /></td>
                        <td className={cell}><input value={r.title ?? ''} onChange={e => patch(r.id, { title: e.target.value })} className={inp} /></td>
                        <td className={cell + ' w-40'}><input value={r.assignee ?? ''} onChange={e => patch(r.id, { assignee: e.target.value })} className={inp + ' text-text-muted'} /></td>
                        <td className={cell + ' w-32'}><input value={r.body ?? ''} onChange={e => patch(r.id, { body: e.target.value })} className={inp + ' text-text-muted'} /></td>
                        <td className={cell + ' w-28'}><input value={r.location ?? ''} onChange={e => patch(r.id, { location: e.target.value })} className={inp + ' text-text-muted'} /></td>
                        <td className={cell + ' w-8 text-right'}><button onClick={() => remove(r.id)} className="text-xs text-text-muted hover:text-litred-alt opacity-0 group-hover:opacity-100">✕</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button onClick={() => add('schedule', { day: 'Day', title: 'New activity' })} className="w-full text-left px-3 py-2 text-sm font-semibold text-text-muted hover:text-ink border-t border-[#f1ece3]">+ Add row</button>
              </div>
            </div>
            )}

            {/* Tools */}
            <LinkBlock kind="tool" title="Tools" color="#6b4f8a" list={tools} placeholder="Tool name" />

            {/* SOP Links */}
            <LinkBlock kind="sop" title="SOP Links" color="#3f6b8a" list={links} placeholder="SOP name" />

            {/* Tables */}
            {tables.map(t => {
              const d = parseTable(t.body);
              return (
                <div key={t.id}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2.5 h-6 rounded-full bg-[#8a6d3b]" />
                    <input value={t.title} onChange={e => patch(t.id, { title: e.target.value })} className="text-sm font-bold uppercase tracking-wider text-[#6b5427] bg-transparent focus:outline-none flex-1" />
                    <button onClick={() => remove(t.id)} className="text-xs font-semibold text-litred-alt hover:underline">Delete table</button>
                  </div>
                  <div className="bg-white border border-border rounded-card overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-[#f0ece4]"><tr>
                        {d.headers.map((h, ci) => (
                          <th key={ci} className="text-left px-2 py-2"><input value={h} onChange={e => { const n = { ...d, headers: d.headers.map((x, i) => i === ci ? e.target.value : x) }; saveTable(t.id, n); }} className="w-full bg-transparent text-[11px] font-bold uppercase tracking-wider text-[#8a6d3b] focus:outline-none" /></th>
                        ))}
                        <th className="w-8" />
                      </tr></thead>
                      <tbody>
                        {d.rows.map((row, ri) => (
                          <tr key={ri} className="group border-t border-[#f1ece3]">
                            {row.map((c, ci) => (
                              <td key={ci} className="px-2 py-1.5 align-top"><textarea rows={1} value={c} onChange={e => { const rows = d.rows.map((r, i) => i === ri ? r.map((x, j) => j === ci ? e.target.value : x) : r); saveTable(t.id, { ...d, rows }); }} className="w-full bg-transparent text-sm text-text-secondary focus:outline-none focus:bg-canvas rounded resize-none" /></td>
                            ))}
                            <td className="px-1 text-right"><button onClick={() => saveTable(t.id, { ...d, rows: d.rows.filter((_, i) => i !== ri) })} className="text-xs text-text-muted hover:text-litred-alt opacity-0 group-hover:opacity-100">✕</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="flex gap-3 border-t border-[#f1ece3] px-3 py-2">
                      <button onClick={() => saveTable(t.id, { ...d, rows: [...d.rows, d.headers.map(() => '')] })} className="text-sm font-semibold text-text-muted hover:text-ink">+ Row</button>
                      <button onClick={() => saveTable(t.id, { headers: [...d.headers, 'Column'], rows: d.rows.map(r => [...r, '']) })} className="text-sm font-semibold text-text-muted hover:text-ink">+ Column</button>
                    </div>
                  </div>
                </div>
              );
            })}
            <button onClick={() => add('table', { title: 'New Table', body: JSON.stringify({ headers: ['Column 1', 'Column 2'], rows: [['', '']] }) })} className="w-full border-2 border-dashed border-border-light rounded-card py-2.5 text-sm font-semibold text-text-muted hover:text-ink hover:border-ink transition-colors">+ Add table</button>

            {/* Closing sections */}
            <div className="space-y-4">{closingSections.map(SectionCard)}</div>
          </div>

          {/* Checklist — grouped by who owns the to-do */}
          <div className="space-y-4">
            <div className="bg-white border border-border rounded-card overflow-hidden">
              <div className="px-5 py-3 border-b border-border flex items-center justify-between" style={{ borderBottom: '2px solid #2f7d5b' }}>
                <h2 className="font-spectral text-[16px] font-semibold text-text-primary">Onboarding Checklist</h2>
                <span className="text-xs font-semibold text-[#2f7d5b]">{doneCount}/{tasks.length}</span>
              </div>
              {([[hireLabel, hireTasks, '#2f7d5b'], ['HR', hrTasks, '#3f6b8a']] as [string, Item[], string][]).map(([label, list, color]) => (
                <div key={label} className="border-t border-[#f1ece3] first:border-t-0">
                  <div className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest" style={{ color }}>{label} to-do</div>
                  <div className="px-3 pb-2 space-y-1">
                    {list.map(t => (
                      <label key={t.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-ctrl hover:bg-canvas cursor-pointer group">
                        <input type="checkbox" checked={t.done} onChange={e => patch(t.id, { done: e.target.checked })} className="w-4 h-4" style={{ accentColor: color }} />
                        <input value={t.title} onChange={e => patch(t.id, { title: e.target.value })}
                          className={`flex-1 bg-transparent text-sm focus:outline-none ${t.done ? 'line-through text-text-muted' : 'text-text-primary'}`} />
                        <button onClick={() => patch(t.id, { owner: label === 'HR' ? 'New Hire' : 'HR' })} title="Move to the other list"
                          className="text-[10px] font-semibold text-text-muted hover:text-ink opacity-0 group-hover:opacity-100">⇄</button>
                        <button onClick={() => remove(t.id)} className="text-xs text-text-muted hover:text-litred-alt opacity-0 group-hover:opacity-100">✕</button>
                      </label>
                    ))}
                    <button onClick={() => add('task', { title: 'New item', owner: label })} className="w-full text-left px-2 py-1.5 text-sm font-semibold text-text-muted hover:text-ink">+ Add {label.toLowerCase()} item</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );

  function Dashboard() {
    const person = people.find(p => p.id === selected) ?? null;
    return (
      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl">
          {/* People list */}
          <div className="space-y-3">
            {people.length === 0 && <div className="text-sm text-text-muted border border-dashed border-border-light rounded-card p-6 text-center">No one onboarding yet — click “Add new hire”.</div>}
            {people.map(p => {
              const { done, total, pct } = progressOf(p);
              const complete = p.status === 'Complete';
              return (
                <button key={p.id} onClick={() => setSelected(p.id)}
                  className={`w-full text-left bg-white border rounded-card p-4 transition-colors ${selected === p.id ? 'border-ink' : 'border-border hover:border-border-light'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-text-primary truncate">{p.name}</div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${complete ? 'bg-[#eef5f1] text-[#2f7d5b]' : 'bg-[#f7efe1] text-[#b07d2a]'}`}>{complete ? 'Complete' : `${pct}%`}</span>
                  </div>
                  <div className="text-xs text-text-muted mt-0.5">{p.position || p.worker_type} · {p.guide} guide</div>
                  <div className="mt-2 h-1.5 bg-[#f1ece3] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: complete ? '#2f7d5b' : '#c9a24a' }} />
                  </div>
                  <div className="text-[11px] text-text-muted mt-1">{done}/{total} tasks</div>
                </button>
              );
            })}
          </div>

          {/* Detail panel */}
          <div className="lg:col-span-2">
            {!person ? (
              <div className="text-sm text-text-muted border border-dashed border-border-light rounded-card p-10 text-center">Select someone to see their checklist.</div>
            ) : (() => {
              const list = tasksFor(person.guide);
              const prog = parseProg(person.progress);
              const { done, total, pct } = progressOf(person);
              const allDone = total > 0 && done === total;
              return (
                <div className="bg-white border border-border rounded-card overflow-hidden">
                  <div className="px-5 py-4 border-b border-border flex items-start gap-3">
                    <div className="flex-1">
                      <h2 className="font-spectral text-[19px] font-semibold text-text-primary">{person.name}</h2>
                      <p className="text-sm text-text-muted">{[person.position, person.email, person.start_date && `Starts ${person.start_date}`].filter(Boolean).join(' · ')}</p>
                      <div className="flex gap-2 mt-1.5 text-[11px]">
                        <span className="font-semibold px-2 py-0.5 rounded-full bg-[#eef5f1] text-[#2f7d5b]">{person.worker_type}</span>
                        <span className="font-semibold px-2 py-0.5 rounded-full bg-[#e9f0f5] text-[#3f6b8a]">{person.guide} guide</span>
                        <span className="font-semibold px-2 py-0.5 rounded-full bg-[#f7efe1] text-[#b07d2a]">{pct}% complete</span>
                      </div>
                    </div>
                    <button onClick={() => deleteOnboardee(person.id)} className="text-xs font-semibold text-litred-alt border border-border-light px-2.5 py-1 rounded-ctrl hover:bg-[#fdeaea]">Remove</button>
                  </div>
                  <div className="p-4 space-y-1">
                    {list.map(t => {
                      const isDone = !!prog[t.title];
                      return (
                        <label key={t.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-ctrl hover:bg-canvas cursor-pointer">
                          <input type="checkbox" checked={isDone} onChange={e => toggleTask(person, t.title, e.target.checked)} className="w-4 h-4 accent-[#2f7d5b]" />
                          <span className={`flex-1 text-sm ${isDone ? 'line-through text-text-muted' : 'text-text-primary'}`}>{t.title}</span>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${(t.owner ?? '') === 'HR' ? 'bg-[#e9f0f5] text-[#3f6b8a]' : 'bg-[#eef5f1] text-[#2f7d5b]'}`}>{(t.owner ?? '') === 'HR' ? 'HR' : (person.worker_type === 'Contractor' ? 'Contractor' : 'New Hire')}</span>
                        </label>
                      );
                    })}
                    {list.length === 0 && <p className="text-sm text-text-muted px-2 py-3">This guide has no checklist items yet.</p>}
                  </div>
                  <div className="px-5 py-4 border-t border-border flex items-center justify-between">
                    <span className="text-sm text-text-muted">{done}/{total} done</span>
                    {person.status === 'Complete' ? (
                      <span className="text-sm font-semibold text-[#2f7d5b]">✓ Completed — added to Staffing</span>
                    ) : (
                      <button onClick={() => completeOnboardee(person)} disabled={!allDone}
                        className="bg-[#2f7d5b] text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-[#236045] disabled:opacity-40"
                        title={allDone ? '' : 'Finish all tasks first'}>Mark complete → add to Staffing</button>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Add new hire modal */}
        {showAdd && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6" onClick={() => setShowAdd(false)}>
            <div className="bg-white rounded-card w-full max-w-lg shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <h2 className="font-spectral text-[18px] font-semibold">Add new hire</h2>
                <button onClick={() => setShowAdd(false)} className="text-text-muted hover:text-text-primary text-xl leading-none">×</button>
              </div>
              <div className="p-6 grid grid-cols-2 gap-4">
                {([['Name', 'name'], ['Email', 'email'], ['Position', 'position'], ['Phone', 'phone'], ['Start date', 'start_date'], ['DOB', 'dob']] as [string, keyof typeof newForm][]).map(([l, k]) => (
                  <div key={k} className={k === 'name' ? 'col-span-2' : ''}>
                    <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1">{l}</label>
                    <input type={k === 'start_date' ? 'date' : 'text'} value={newForm[k]} onChange={e => setNewForm(f => ({ ...f, [k]: e.target.value }))}
                      placeholder={k === 'dob' ? 'MM/DD/YYYY' : undefined}
                      className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
                  </div>
                ))}
                <div>
                  <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1">Type</label>
                  <select value={newForm.worker_type} onChange={e => setNewForm(f => ({ ...f, worker_type: e.target.value }))} className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm bg-white focus:outline-none focus:border-ink">
                    {['Employee', 'Contractor'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1">Onboarding guide</label>
                  <select value={newForm.guide} onChange={e => setNewForm(f => ({ ...f, guide: e.target.value }))} className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm bg-white focus:outline-none focus:border-ink">
                    {guides.map(g => <option key={g}>{g}</option>)}
                  </select>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-border flex gap-2 justify-end">
                <button onClick={() => setShowAdd(false)} className="border border-border-light text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-canvas">Cancel</button>
                <button onClick={addOnboardee} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark">Start onboarding</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
}

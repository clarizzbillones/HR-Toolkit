'use client';
import { useEffect, useState, useRef, type ReactNode, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useToast } from '@/components/Toast';

interface Item {
  id: string; guide: string; kind: 'section' | 'schedule' | 'sop' | 'tool' | 'table' | 'task';
  title: string; body: string | null; day: string | null; assignee: string | null;
  location: string | null; url: string | null; owner: string | null; done: boolean; sort_order: number;
}
// Render section text with clickable links and **bold**.
// Supports [Label](https://url) for a friendly label; bare URLs are shortened.
function linkify(text: string | null) {
  const src = String(text ?? '');
  const re = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s]+)|\*\*([^*]+)\*\*/g;
  const out: ReactNode[] = [];
  let last = 0, m: RegExpExecArray | null, i = 0;
  const cls = "text-[#3f6b8a] underline font-medium";
  while ((m = re.exec(src))) {
    if (m.index > last) out.push(<span key={i++}>{src.slice(last, m.index)}</span>);
    if (m[1]) {
      out.push(<a key={i++} href={m[2]} target="_blank" rel="noopener noreferrer" className={cls}>{m[1]}</a>);
    } else if (m[3]) {
      const url = m[3]; let label = url.replace(/^https?:\/\//, '').replace(/^www\./, '');
      if (label.length > 42) label = label.slice(0, 42) + '…';
      out.push(<a key={i++} href={url} target="_blank" rel="noopener noreferrer" className={cls}>{label} ↗</a>);
    } else if (m[4]) {
      out.push(<strong key={i++} className="font-semibold text-text-primary">{m[4]}</strong>);
    }
    last = m.index + m[0].length;
  }
  if (last < src.length) out.push(<span key={i++}>{src.slice(last)}</span>);
  return out;
}

// New-hire journey: offer letter sent → viewed → accepted → onboarding → hired.
const STAGES: { key: string; label: string; icon: string }[] = [
  { key: 'offer_sent', label: 'Offer sent', icon: '📤' },
  { key: 'offer_viewed', label: 'Viewed', icon: '👀' },
  { key: 'offer_accepted', label: 'Accepted', icon: '✍️' },
  { key: 'onboarding', label: 'Onboarding', icon: '🚀' },
  { key: 'complete', label: 'Hire complete', icon: '✓' },
];
function stageOf(person: any): string {
  if (person?.status === 'Complete') return 'complete';
  return STAGES.some(s => s.key === person?.stage) ? person.stage : 'onboarding';
}
function stageIndex(key: string) { const i = STAGES.findIndex(s => s.key === key); return i < 0 ? 3 : i; }
function fmtDate(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(String(iso).length <= 10 ? iso + 'T12:00:00' : iso);
  return isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
  const blankNew = { name: '', email: '', position: '', worker_type: 'Employee', guide: 'General', start_date: '', onboarding_date: '', dob: '', phone: '' };
  const [newForm, setNewForm] = useState({ ...blankNew });

  useEffect(() => { fetch('/api/onboarding').then(r => r.json()).then(d => setItems(d.items ?? [])); }, []);
  const [composed, setComposed] = useState<{ name: string; sources: string[]; exclude: string[]; headers: Record<string, string> }[]>([]);
  useEffect(() => { fetch('/api/onboarding/compose').then(r => r.json()).then(d => setComposed(d.composed ?? [])).catch(() => {}); }, []);
  const [showNewHire, setShowNewHire] = useState(false);
  const [nhName, setNhName] = useState('');
  const [nhSources, setNhSources] = useState<string[]>([]);
  const [nhExclude, setNhExclude] = useState<string[]>([]);
  const [nhHeaders, setNhHeaders] = useState<Record<string, string>>({});
  async function createComposed() {
    const name = nhName.trim();
    if (!name || !nhSources.length) { showToast('Enter a name and pick at least one guide'); return; }
    await fetch('/api/onboarding/compose', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, sources: nhSources, exclude: nhExclude, headers: nhHeaders }) });
    setComposed(prev => [...prev.filter(c => c.name !== name), { name, sources: nhSources, exclude: nhExclude, headers: nhHeaders }]);
    setShowNewHire(false); setNhName(''); setNhSources([]); setNhExclude([]); setNhHeaders({}); setGuide(name);
    showToast('Combined guide saved');
  }
  function editComposed(c: { name: string; sources: string[]; exclude: string[]; headers: Record<string, string> }) {
    setNhName(c.name); setNhSources([...c.sources]); setNhExclude([...c.exclude]); setNhHeaders({ ...(c.headers ?? {}) }); setShowNewHire(true);
  }
  // Move a picked source guide earlier/later in the merge order.
  function moveNhSource(g: string, dir: -1 | 1) {
    setNhSources(prev => {
      const i = prev.indexOf(g), j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = prev.slice(); [next[i], next[j]] = [next[j], next[i]]; return next;
    });
  }
  // Merge items from source guides (in order), de-duplicating shared blocks by
  // kind+title, then dropping any explicitly excluded ones.
  function mergeGuideItems(sources: string[], exclude: string[] = []) {
    // Show every block from every source guide, in the chosen order. No auto
    // de-dup — you decide what to keep via the include/exclude checkboxes.
    const deduped = sources
      .flatMap((g, gi) => items.filter(i => i.guide === g).map(i => ({ i, gi })))
      .sort((a, b) => a.gi - b.gi || a.i.sort_order - b.i.sort_order)
      .map(x => x.i);
    return { deduped, visible: deduped.filter(it => !exclude.includes(it.id)) };
  }
  async function deleteComposed(name: string) {
    await fetch('/api/onboarding/compose', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    setComposed(prev => prev.filter(c => c.name !== name));
    setGuide('General');
    showToast('Combined guide removed');
  }
  const [blockOrders, setBlockOrders] = useState<Record<string, string[]>>({});
  useEffect(() => { fetch('/api/onboarding/order').then(r => r.json()).then(d => setBlockOrders(d.orders ?? {})).catch(() => {}); }, []);
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
  async function patchOnboardee(id: string, fields: Record<string, any>) {
    setPeople(prev => prev.map(p => p.id === id ? { ...p, ...fields } : p));
    await fetch('/api/onboardees', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...fields }) });
  }
  async function setStage(person: any, key: string) {
    if (key === 'complete') { completeOnboardee(person); return; }
    await patchOnboardee(person.id, { stage: key, ...(person.status === 'Complete' ? { status: 'In Progress' } : {}) });
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

  // Distinct building-block guides, General first
  const guides = Array.from(new Set(items.map(i => i.guide))).sort((a, b) => (a === 'General' ? -1 : b === 'General' ? 1 : a.localeCompare(b)));
  const composedNames = composed.map(c => c.name);
  const composedDef = composed.find(c => c.name === guide);
  const isComposed = !!composedDef;
  // The building-block guides this view draws from (itself, unless composed).
  const guideSources = composedDef ? composedDef.sources.filter(s => guides.includes(s)) : [guide];
  useEffect(() => { if (guides.length && !guides.includes(guide) && !composedNames.includes(guide)) setGuide(guides[0]); }, [items, composed]); // eslint-disable-line

  // Items for the active view. For composed guides, merge the chosen source
  // guides (in order), de-duplicate shared blocks, and drop excluded ones.
  const gItems = isComposed
    ? mergeGuideItems(guideSources, composedDef!.exclude).visible
    : items.filter(i => i.guide === guide);
  const sections = gItems.filter(i => i.kind === 'section').sort((a, b) => (isComposed ? 0 : a.sort_order - b.sort_order));
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
  async function add(kind: Item['kind'], seed: Partial<Item> = {}, targetGuide?: string) {
    // Composed guides aren't real guides, so new items must land in a real
    // source guide — callers on the combined view pass an explicit targetGuide.
    const g = targetGuide ?? (isComposed ? guideSources[0] : guide);
    if (draftMode) {
      const item = { id: 'tmp' + Date.now() + Math.random().toString(36).slice(2, 6), guide: g, kind, title: '', body: null, day: null, assignee: null, location: null, url: null, owner: null, done: false, sort_order: 9999, ...seed } as Item;
      setItems(prev => [...prev, item]); return item;
    }
    const res = await fetch('/api/onboarding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, guide: g, ...seed }) });
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
  async function addSection(targetGuide?: string) {
    const item = await add('section', { title: 'New Section', body: '' }, targetGuide);
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
  const [dragId, setDragId] = useState<string | null>(null);
  // Reorder sections within the same group (intro <50 / closing >=50) via drag & drop
  async function reorderSection(targetId: string) {
    if (!dragId || dragId === targetId) { setDragId(null); return; }
    const src = items.find(i => i.id === dragId), tgt = items.find(i => i.id === targetId);
    if (!src || !tgt || src.kind !== 'section' || tgt.kind !== 'section' || src.guide !== tgt.guide) { setDragId(null); return; }
    // Reorder freely across ALL sections in the dragged item's own guide (works
    // on the combined view too, where the active guide is a composed name).
    const all = items.filter(i => i.guide === src.guide && i.kind === 'section').sort((a, b) => a.sort_order - b.sort_order);
    const ids = all.map(i => i.id);
    ids.splice(ids.indexOf(dragId), 1);
    ids.splice(ids.indexOf(targetId), 0, dragId);
    const updated = ids.map((id, i) => ({ id, sort_order: i }));
    setItems(prev => prev.map(i => { const u = updated.find(x => x.id === i.id); return u ? { ...i, sort_order: u.sort_order } : i; }));
    setDragId(null);
    if (!draftMode) for (const u of updated) await fetch('/api/onboarding', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(u) });
  }
  // Move a section up (dir -1) or down (dir +1) by swapping order with its neighbour.
  async function moveSection(id: string, dir: -1 | 1) {
    const own = items.find(i => i.id === id)?.guide ?? guide;
    const all = items.filter(i => i.guide === own && i.kind === 'section').sort((a, b) => a.sort_order - b.sort_order);
    const idx = all.findIndex(i => i.id === id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= all.length) return;
    const ids = all.map(i => i.id);
    [ids[idx], ids[swap]] = [ids[swap], ids[idx]];
    const updated = ids.map((id, i) => ({ id, sort_order: i }));
    setItems(prev => prev.map(i => { const u = updated.find(x => x.id === i.id); return u ? { ...i, sort_order: u.sort_order } : i; }));
    if (!draftMode) for (const u of updated) await fetch('/api/onboarding', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(u) });
  }
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  // Prefix the line at the cursor with a bullet (or bullet the empty line).
  function insertBullet() {
    const ta = bodyRef.current;
    const text = draft.body;
    const pos = ta ? ta.selectionStart : text.length;
    const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
    if (text.slice(lineStart).startsWith('• ')) return; // already bulleted
    const next = text.slice(0, lineStart) + '• ' + text.slice(lineStart);
    setDraft(d => ({ ...d, body: next }));
    setTimeout(() => { if (ta) { ta.focus(); ta.selectionStart = ta.selectionEnd = pos + 2; } }, 0);
  }
  // Prefix the line at the cursor with the next number in the list.
  function insertNumber() {
    const ta = bodyRef.current;
    const text = draft.body;
    const pos = ta ? ta.selectionStart : text.length;
    const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
    if (/^\d+\.\s/.test(text.slice(lineStart))) return; // already numbered
    let n = 1;
    if (lineStart > 0) {
      const prevStart = text.lastIndexOf('\n', lineStart - 2) + 1;
      const mm = text.slice(prevStart, lineStart - 1).match(/^(\d+)\.\s/);
      if (mm) n = parseInt(mm[1]) + 1;
    }
    const prefix = `${n}. `;
    const next = text.slice(0, lineStart) + prefix + text.slice(lineStart);
    setDraft(d => ({ ...d, body: next }));
    setTimeout(() => { if (ta) { ta.focus(); ta.selectionStart = ta.selectionEnd = pos + prefix.length; } }, 0);
  }
  // Wrap the selection (or a placeholder) in **bold**.
  function insertBold() {
    const ta = bodyRef.current; if (!ta) return;
    const text = draft.body;
    const s = ta.selectionStart, e2 = ta.selectionEnd;
    const sel = text.slice(s, e2) || 'bold text';
    const next = text.slice(0, s) + '**' + sel + '**' + text.slice(e2);
    setDraft(d => ({ ...d, body: next }));
    setTimeout(() => { ta.focus(); ta.selectionStart = s + 2; ta.selectionEnd = s + 2 + sel.length; }, 0);
  }
  // Enter continues a bullet or numbered list; Enter on an empty marker ends it.
  function onBodyKeyDown(e: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== 'Enter' || e.shiftKey) return;
    const ta = e.currentTarget;
    const text = draft.body;
    const pos = ta.selectionStart;
    const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
    const line = text.slice(lineStart, pos);
    const numMatch = line.match(/^(\d+)\.\s/);
    const isBullet = /^•\s/.test(line);
    if (!isBullet && !numMatch) return;
    e.preventDefault();
    const emptyMarker = isBullet ? line.trim() === '•' : line.trim() === `${numMatch![1]}.`;
    if (emptyMarker) {
      const next = text.slice(0, lineStart) + text.slice(pos);
      setDraft(d => ({ ...d, body: next }));
      setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = lineStart; }, 0);
    } else {
      const ins = isBullet ? '\n• ' : `\n${parseInt(numMatch![1]) + 1}. `;
      const next = text.slice(0, pos) + ins + text.slice(pos);
      setDraft(d => ({ ...d, body: next }));
      setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = pos + ins.length; }, 0);
    }
  }
  function startEdit(s: Item) { setEditing(s.id); setDraft({ title: s.title, body: s.body ?? '' }); }
  async function saveEdit(id: string) { await patch(id, { title: draft.title, body: draft.body }); setEditing(null); showToast('Saved'); }

  // The person's name for greeting/PDF: the typed field, else the combined
  // guide's own name (which is the new hire's name).
  const personName = hire.trim() || (isComposed ? guide : '');
  const greeting = personName ? `Hi ${personName},` : 'Welcome aboard,';

  const SectionCard = (s: Item) => (
    <div key={s.id}
      draggable={editing !== s.id}
      onDragStart={() => setDragId(s.id)}
      onDragOver={e => e.preventDefault()}
      onDrop={() => reorderSection(s.id)}
      onDragEnd={() => setDragId(null)}
      className={`bg-white border border-border rounded-card overflow-hidden ${dragId === s.id ? 'opacity-40' : ''}`}>
      {editing === s.id ? (
        <div className="p-5 space-y-3">
          <input value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} placeholder="Section title"
            className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm font-semibold focus:outline-none focus:border-ink" />
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" onClick={insertBullet} title="Add a bullet to this line"
              className="text-xs font-semibold text-ink border border-border-light px-2.5 py-1 rounded-ctrl hover:bg-canvas">• Bullet</button>
            <button type="button" onClick={insertNumber} title="Number this line"
              className="text-xs font-semibold text-ink border border-border-light px-2.5 py-1 rounded-ctrl hover:bg-canvas">1. Number</button>
            <button type="button" onClick={insertBold} title="Bold the selected text"
              className="text-xs font-bold text-ink border border-border-light px-2.5 py-1 rounded-ctrl hover:bg-canvas">B Bold</button>
            <span className="text-[11px] text-text-muted">Enter keeps lists going · select text then Bold.</span>
          </div>
          <textarea ref={bodyRef} value={draft.body} onChange={e => setDraft(d => ({ ...d, body: e.target.value }))} onKeyDown={onBodyKeyDown} rows={6} placeholder="Write the section content…"
            className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
          <p className="text-[11px] text-text-muted">Tip: paste a link and it becomes clickable. For a friendly label use <code>[Label](https://link)</code>.</p>
          <div className="flex gap-2">
            <button onClick={() => saveEdit(s.id)} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark">Save</button>
            <button onClick={() => setEditing(null)} className="text-sm text-text-muted px-3">Cancel</button>
          </div>
        </div>
      ) : (
        <div className="p-5 group">
          <div className="flex items-start gap-2">
            <span className="cursor-grab select-none text-text-faint opacity-0 group-hover:opacity-100 mt-1" title="Drag to reorder">⠿</span>
            {(() => {
              const sib = items.filter(i => i.guide === s.guide && i.kind === 'section').sort((a, b) => a.sort_order - b.sort_order);
              const idx = sib.findIndex(x => x.id === s.id);
              return (
                <div className="flex flex-col -mt-0.5 opacity-0 group-hover:opacity-100">
                  <button disabled={idx === 0} onClick={() => moveSection(s.id, -1)} title="Move up"
                    className="text-[11px] leading-tight text-text-muted hover:text-ink disabled:opacity-25 disabled:cursor-default">▲</button>
                  <button disabled={idx === sib.length - 1} onClick={() => moveSection(s.id, 1)} title="Move down"
                    className="text-[11px] leading-tight text-text-muted hover:text-ink disabled:opacity-25 disabled:cursor-default">▼</button>
                </div>
              );
            })()}
            <h2 onClick={() => startEdit(s)} title="Click to edit"
              className="font-spectral text-[17px] font-semibold text-text-primary flex-1 cursor-text hover:text-ink" style={{ borderLeft: '3px solid #c9a24a', paddingLeft: 10 }}>{s.title}</h2>
            <button onClick={() => startEdit(s)} className="text-xs font-semibold text-ink border border-border-light px-2.5 py-1 rounded-ctrl hover:bg-canvas opacity-60 group-hover:opacity-100">✎ Edit</button>
            {guides.length > 1 && <button onClick={() => copyToGuide(s)} className="text-xs font-semibold text-ink border border-border-light px-2.5 py-1 rounded-ctrl hover:bg-canvas opacity-0 group-hover:opacity-100">Copy to…</button>}
            <button onClick={() => remove(s.id)} className="text-xs font-semibold text-litred-alt border border-border-light px-2.5 py-1 rounded-ctrl hover:bg-[#fdeaea] opacity-0 group-hover:opacity-100">Delete</button>
          </div>
          {(s.body ?? '').trim()
            ? <p onClick={e => { if ((e.target as HTMLElement).tagName !== 'A') startEdit(s); }} title="Click to edit"
                className="text-sm text-text-secondary mt-2 whitespace-pre-wrap leading-relaxed pl-3 cursor-text">{linkify(s.body)}</p>
            : <p onClick={() => startEdit(s)} title="Click to edit"
                className="text-sm text-text-faint italic mt-2 leading-relaxed pl-3 cursor-text hover:text-text-muted">Click to add content…</p>}
        </div>
      )}
    </div>
  );

  const cell = "px-3 py-2 text-sm border-t border-[#f1ece3]";
  const inp = "w-full bg-transparent focus:outline-none focus:bg-canvas rounded px-1 -mx-1";

  function saveTable(id: string, d: TableData) { patch(id, { body: JSON.stringify(d) }); }

  // Reusable editable list (Tools or SOP Links)
  const LinkBlock = ({ kind, title, color, list, placeholder, addGuide }: { kind: 'tool' | 'sop'; title: string; color: string; list: Item[]; placeholder: string; addGuide?: string }) => (
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
        <button onClick={() => add(kind, { title: placeholder }, addGuide)} className="w-full text-left px-2 py-1.5 text-sm font-semibold text-text-muted hover:text-ink">+ Add</button>
      </div>
    </div>
  );

  // Inner HTML for a guide body, from an explicit item list + name. Reused by
  // the on-screen combined view, the PDF export, and the combine-panel preview.
  function innerHtmlFor(list: Item[], name: string, opts?: { noGreeting?: boolean }) {
    const esc = (v: any) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const secs = list.filter(i => i.kind === 'section');
    const sched = list.filter(i => i.kind === 'schedule');
    const tls = list.filter(i => i.kind === 'tool');
    const lnk = list.filter(i => i.kind === 'sop');
    const tbls = list.filter(i => i.kind === 'table');
    const greet = name.trim() ? `Hi ${name.trim()},` : 'Welcome aboard,';
    const secHtml = secs.map(s => `
      <section style="margin:0 0 18px;break-inside:avoid">
        <h2 style="font-size:14px;font-weight:700;color:#1b2a3d;border-left:4px solid #c9a24a;padding-left:10px;margin:0 0 6px">${esc(s.title)}</h2>
        <div style="white-space:pre-wrap;font-size:12px;line-height:1.6;color:#333">${esc(s.body ?? '')
          .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" style="color:#3f6b8a">$1</a>')
          .replace(/(?<!href=")(https?:\/\/[^\s<]+)/g, (u: string) => { let l = u.replace(/^https?:\/\//, '').replace(/^www\./, ''); if (l.length > 42) l = l.slice(0, 42) + '…'; return `<a href="${u}" style="color:#3f6b8a">${l} ↗</a>`; })
          .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')}</div>
      </section>`).join('');
    const schedHtml = sched.length === 0 ? '' : `
      <h2 style="font-size:14px;font-weight:700;color:#1b2a3d;border-left:4px solid #3f6b8a;padding-left:10px;margin:20px 0 6px">2-Week Training Schedule</h2>
      <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:8px">
        <thead><tr style="background:#e9f0f5">${['Date','Agenda','Assignee','Notes','Location'].map(h => `<th style="text-align:left;padding:5px 8px;color:#3f6b8a;font-size:9px;text-transform:uppercase">${h}</th>`).join('')}</tr></thead>
        <tbody>${sched.map(r => `<tr style="border-top:1px solid #eee">${[r.day, r.title, r.assignee, r.body, r.location].map(c => `<td style="padding:5px 8px;color:#333">${esc(c) || '—'}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>`;
    const listHtml = (heading: string, l: Item[]) => l.length === 0 ? '' : `
      <h2 style="font-size:14px;font-weight:700;color:#1b2a3d;border-left:4px solid #6b4f8a;padding-left:10px;margin:20px 0 6px">${heading}</h2>
      <ul style="columns:2;font-size:12px;color:#333;padding-left:16px">${l.map(x => `<li style="margin:2px 0">${x.url ? `<a href="${esc(x.url)}" style="color:#3f6b8a">${esc(x.title)}</a>` : esc(x.title)}</li>`).join('')}</ul>`;
    const toolsHtml = listHtml('Tools', tls);
    const linksHtml = listHtml('SOP Links', lnk);
    const tablesHtml = tbls.map(t => { const d = parseTable(t.body); return `
      <h2 style="font-size:14px;font-weight:700;color:#1b2a3d;border-left:4px solid #8a6d3b;padding-left:10px;margin:20px 0 6px">${esc(t.title)}</h2>
      <table style="width:100%;border-collapse:collapse;font-size:11px;break-inside:avoid">
        <thead><tr style="background:#f0ece4">${d.headers.map(h => `<th style="text-align:left;padding:5px 8px;color:#8a6d3b;font-size:9px;text-transform:uppercase">${esc(h)}</th>`).join('')}</tr></thead>
        <tbody>${d.rows.map(r => `<tr style="border-top:1px solid #eee">${r.map(c => `<td style="padding:5px 8px;color:#333">${esc(c) || '—'}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>`; }).join('');
    // Checklist lives only in the Dashboard, so it's intentionally not rendered here.
    const greetHtml = opts?.noGreeting ? '' : `<p style="font-size:13px;color:#1b2a3d;font-weight:600;margin:0 0 16px">${esc(greet)}</p>`;
    return `${greetHtml}${secHtml}${schedHtml}${toolsHtml}${linksHtml}${tablesHtml}`;
  }

  // Combined guide: greeting once, then each source guide as its own titled
  // section with a separator + header (custom label, defaulting to the guide name).
  function combinedInnerHtml(sources: string[], exclude: string[], headers: Record<string, string> | undefined, name: string) {
    const esc = (v: any) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const greet = name.trim() ? `Hi ${name.trim()},` : 'Welcome aboard,';
    const greetHtml = `<p style="font-size:13px;color:#1b2a3d;font-weight:600;margin:0 0 16px">${esc(greet)}</p>`;
    const sep = (label: string) => `<div style="margin:30px 0 14px;border-top:2px solid #c9a24a;padding-top:12px">
      <div style="font-size:10px;letter-spacing:.14em;color:#c9a24a;font-weight:700;text-transform:uppercase">Section</div>
      <div style="font-size:18px;font-weight:800;color:#1b2a3d;margin-top:2px">${esc(label)}</div></div>`;
    const body = sources.map(g => {
      const list = items.filter(i => i.guide === g && !exclude.includes(i.id)).sort((a, b) => a.sort_order - b.sort_order);
      if (!list.length) return '';
      const label = (headers?.[g] && headers[g].trim()) || `${g} Onboarding`;
      return sep(label) + innerHtmlFor(list, '', { noGreeting: true });
    }).join('');
    return greetHtml + body;
  }

  // On-screen combined view: grouped-by-source for composed guides, else flat.
  function guideInnerHtml() {
    return isComposed
      ? combinedInnerHtml(guideSources, composedDef!.exclude, composedDef!.headers, personName)
      : innerHtmlFor(gItems, personName);
  }

  // Open a print window for pre-built inner HTML, with a name + header label.
  function printDoc(innerHtml: string, name: string, label: string) {
    const esc = (v: any) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const SANS = "'Helvetica Neue',Helvetica,Arial,sans-serif";
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Litson — New Hire Onboarding Guide</title>
      <style>@page{size:A4;margin:14mm} body{font-family:${SANS}} h2{break-after:avoid} tr,td,th{break-inside:avoid}</style></head>
      <body style="margin:0;color:#2a2a2a;-webkit-print-color-adjust:exact;print-color-adjust:exact">
        <div style="background:linear-gradient(120deg,#1b2a3d,#26405c);padding:24px 32px;border-bottom:4px solid #c9a24a;color:#fff">
          <div style="font-size:24px;font-weight:800;letter-spacing:.18em">LITSON</div>
          <div style="font-size:11px;color:#c9a24a;letter-spacing:.12em;font-weight:600">${esc((label || 'NEW HIRE').toUpperCase())} ONBOARDING GUIDE</div>
          ${name.trim() ? `<div style="font-size:20px;font-weight:700;margin-top:10px;color:#fff">${esc(name.trim())}</div>` : ''}
        </div>
        <div style="padding:24px 32px">${innerHtml}</div>
      </body></html>`;
    const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 300); }
  }

  function printGuide() {
    printDoc(guideInnerHtml(), personName, isComposed ? guideSources.join(' + ') : guide);
  }

  function buildText() {
    const tbl = (t: Item) => { const d = parseTable(t.body); return `${t.title.toUpperCase()}\n` + [d.headers.join(' | '), ...d.rows.map(r => r.join(' | '))].join('\n'); };
    return `${greeting}\n\n`
      + sections.map(s => `${s.title.toUpperCase()}\n${s.body ?? ''}`).join('\n\n')
      + (schedule.length ? `\n\n2-WEEK TRAINING SCHEDULE\n` + schedule.map(r => `${r.day} — ${r.title}${r.assignee ? ` (${r.assignee})` : ''}${r.location ? ` [${r.location}]` : ''}`).join('\n') : '')
      + (tools.length ? `\n\nTOOLS\n` + tools.map(l => `- ${l.title}${l.url ? `: ${l.url}` : ''}`).join('\n') : '')
      + (links.length ? `\n\nSOP LINKS\n` + links.map(l => `- ${l.title}${l.url ? `: ${l.url}` : ''}`).join('\n') : '')
      + (tables.length ? `\n\n` + tables.map(tbl).join('\n\n') : '');
  }
  function copyEmail() { navigator.clipboard?.writeText(buildText()); showToast('Guide copied — paste into an email'); }
  function emailGuide() {
    const subject = `${guide} Onboarding Guide — Litson${hire.trim() ? ` (${hire.trim()})` : ''}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(buildText())}`;
  }

  // ---- Reorderable content blocks (left column) ----
  const DEFAULT_BLOCK_ORDER = ['sections', 'schedule', 'tools', 'sop', 'tables'];
  const scheduleShown = schedule.length > 0 || guide === 'General';
  const blockShown: Record<string, boolean> = { sections: true, schedule: scheduleShown, tools: true, sop: true, tables: true };
  // Saved order for this guide, sanitized to known keys with any missing appended.
  const blockOrder = (() => {
    const saved = blockOrders[guide];
    const arr = (saved && saved.length ? saved : DEFAULT_BLOCK_ORDER).filter(k => DEFAULT_BLOCK_ORDER.includes(k));
    for (const k of DEFAULT_BLOCK_ORDER) if (!arr.includes(k)) arr.push(k);
    return arr;
  })();
  const visibleBlocks = blockOrder.filter(k => blockShown[k]);
  // Block order for a single source guide inside a combined view: its saved
  // order, showing sections always and other block types only when they carry
  // items (mirrors what the combined guide already displayed).
  function composedBlockOrder(g: string, list: Item[]): string[] {
    const shown: Record<string, boolean> = {
      sections: true,
      schedule: list.some(i => i.kind === 'schedule'),
      tools: list.some(i => i.kind === 'tool'),
      sop: list.some(i => i.kind === 'sop'),
      tables: list.some(i => i.kind === 'table'),
    };
    const saved = blockOrders[g];
    const arr = (saved && saved.length ? saved : DEFAULT_BLOCK_ORDER).filter(k => DEFAULT_BLOCK_ORDER.includes(k));
    for (const k of DEFAULT_BLOCK_ORDER) if (!arr.includes(k)) arr.push(k);
    return arr.filter(k => shown[k]);
  }
  async function moveBlock(k: string, dir: -1 | 1) {
    const vis = visibleBlocks.slice();
    const i = vis.indexOf(k), j = i + dir;
    if (i < 0 || j < 0 || j >= vis.length) return;
    [vis[i], vis[j]] = [vis[j], vis[i]];
    const full = [...vis, ...DEFAULT_BLOCK_ORDER.filter(x => !vis.includes(x))];
    setBlockOrders(prev => ({ ...prev, [guide]: full }));
    await fetch('/api/onboarding/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guide, order: full }) });
  }
  // Editable blocks for one guide's item list. Reused by the normal guide view
  // (its own items) and by each source group inside a combined guide, so edits
  // on the combined view save straight to the real underlying source items.
  function blocksFor(list: Item[], srcGuide: string): Record<string, ReactNode> {
    const secs = list.filter(i => i.kind === 'section').sort((a, b) => a.sort_order - b.sort_order);
    const sched = list.filter(i => i.kind === 'schedule');
    const tls = list.filter(i => i.kind === 'tool');
    const lnks = list.filter(i => i.kind === 'sop');
    const tbls = list.filter(i => i.kind === 'table');
    const schedShown = sched.length > 0 || (srcGuide === 'General' && !isComposed);
    return {
    sections: (
      <div className="space-y-4">
        {secs.map(SectionCard)}
        <button onClick={() => addSection(srcGuide)} className="w-full border-2 border-dashed border-border-light rounded-card py-2.5 text-sm font-semibold text-text-muted hover:text-ink hover:border-ink transition-colors">+ Add section</button>
      </div>
    ),
    schedule: schedShown ? (
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
              {sched.map(r => (
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
          <button onClick={() => add('schedule', { day: 'Day', title: 'New activity' }, srcGuide)} className="w-full text-left px-3 py-2 text-sm font-semibold text-text-muted hover:text-ink border-t border-[#f1ece3]">+ Add row</button>
        </div>
      </div>
    ) : null,
    tools: LinkBlock({ kind: 'tool', title: 'Tools', color: '#6b4f8a', list: tls, placeholder: 'Tool name', addGuide: srcGuide }),
    sop: LinkBlock({ kind: 'sop', title: 'SOP Links', color: '#3f6b8a', list: lnks, placeholder: 'SOP name', addGuide: srcGuide }),
    tables: (
      <div className="space-y-6">
        {tbls.map(t => {
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
        <button onClick={() => add('table', { title: 'New Table', body: JSON.stringify({ headers: ['Column 1', 'Column 2'], rows: [['', '']] }) }, srcGuide)} className="w-full border-2 border-dashed border-border-light rounded-card py-2.5 text-sm font-semibold text-text-muted hover:text-ink hover:border-ink transition-colors">+ Add table</button>
      </div>
    ),
    };
  }
  const blockNodes = blocksFor(gItems, guide);

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
        {composed.length > 0 && <span className="mx-1 text-border-light">|</span>}
        {composed.map(c => (
          <button key={c.name} onClick={() => setGuide(c.name)}
            className={`text-sm font-semibold px-4 py-2 rounded-t-ctrl border-b-2 transition-colors ${guide === c.name ? 'border-ink text-ink' : 'border-transparent text-text-muted hover:text-text-primary'}`}
            title={`Combined: ${c.sources.join(' + ')}`}>
            👤 {c.name}
          </button>
        ))}
        <button onClick={() => { setNhSources([]); setNhName(''); setShowNewHire(v => !v); }} className="text-sm font-semibold px-3 py-2 text-[#3f6b8a] hover:text-ink">+ New hire (combine)</button>
        {guide !== 'General' && !draftMode && !isComposed && (
          <div className="ml-auto flex items-center gap-3">
            <button onClick={() => copyGuideFrom('General')} className="text-xs font-semibold text-ink border border-border-light bg-white px-3 py-1.5 rounded-ctrl hover:bg-canvas">⧉ Copy General guide here</button>
            <button onClick={deleteGuide} className="text-xs font-semibold text-litred-alt hover:underline">Delete “{guide}” guide</button>
          </div>
        )}
        {isComposed && composedDef && (
          <div className="ml-auto flex items-center gap-3">
            <button onClick={() => editComposed(composedDef)} className="text-xs font-semibold text-ink border border-border-light bg-white px-3 py-1.5 rounded-ctrl hover:bg-canvas">⚙ Edit combine</button>
            <button onClick={() => deleteComposed(guide)} className="text-xs font-semibold text-litred-alt hover:underline">Remove “{guide}” combined guide</button>
          </div>
        )}
      </div>
      )}

      {view === 'guides' && showNewHire && (
        <div className="px-8 py-4 bg-[#f5f8fb] border-b border-[#d9e4ee] flex-shrink-0 max-h-[60vh] overflow-auto">
          <div className="max-w-3xl">
            <div className="text-sm font-semibold text-text-primary mb-2">New hire — combine guides</div>
            <div className="flex items-center gap-2 mb-3">
              <input value={nhName} onChange={e => setNhName(e.target.value)} placeholder="Name (e.g. Damon)"
                className="w-56 border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
              <span className="text-xs text-text-muted">then pick which guides apply:</span>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {guides.map(g => {
                const on = nhSources.includes(g);
                return (
                  <button key={g} onClick={() => setNhSources(prev => on ? prev.filter(x => x !== g) : [...prev, g])}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-ctrl border transition-colors ${on ? 'bg-ink text-white border-ink' : 'bg-white text-text-secondary border-border-light hover:border-ink'}`}>
                    {on ? '✓ ' : ''}{g}
                  </button>
                );
              })}
            </div>

            {/* Order + a section header (titled divider) for each picked guide */}
            {nhSources.length >= 1 && (
              <div className="mb-3">
                <div className="text-[11px] font-semibold text-text-muted mb-1">Order &amp; section headers — each guide gets a titled divider in the combined guide:</div>
                <div className="flex flex-col gap-1.5">
                  {nhSources.map((g, i) => (
                    <div key={g} className="flex items-center gap-2 text-sm">
                      <span className="w-5 text-text-muted text-right">{i + 1}.</span>
                      <span className="font-medium text-text-primary w-24 shrink-0">{g}</span>
                      <input value={nhHeaders[g] ?? ''} onChange={e => setNhHeaders(h => ({ ...h, [g]: e.target.value }))}
                        placeholder={`${g} Onboarding`}
                        className="flex-1 border border-border-light rounded-ctrl px-2 py-1 text-sm focus:outline-none focus:border-ink" />
                      {nhSources.length > 1 && (
                        <>
                          <button disabled={i === 0} onClick={() => moveNhSource(g, -1)} title="Move up"
                            className="text-xs text-text-muted hover:text-ink disabled:opacity-25 px-1">▲</button>
                          <button disabled={i === nhSources.length - 1} onClick={() => moveNhSource(g, 1)} title="Move down"
                            className="text-xs text-text-muted hover:text-ink disabled:opacity-25 px-1">▼</button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Which boxes/blocks to include */}
            {nhSources.length > 0 && (() => {
              const { deduped } = mergeGuideItems(nhSources, []);
              const groups: [Item['kind'], string][] = [['section', 'Sections'], ['schedule', 'Schedule rows'], ['tool', 'Tools'], ['sop', 'SOP Links'], ['table', 'Tables']];
              return (
                <div className="mb-3">
                  <div className="text-[11px] font-semibold text-text-muted mb-1">Boxes to include (uncheck to leave out):</div>
                  <div className="border border-border-light rounded-ctrl bg-white p-3 space-y-2.5">
                    {groups.map(([kind, label]) => {
                      const list = deduped.filter(it => it.kind === kind);
                      if (!list.length) return null;
                      return (
                        <div key={kind}>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-0.5">{label}</div>
                          <div className="grid grid-cols-2 gap-x-6">
                            {list.map(it => {
                              const inc = !nhExclude.includes(it.id);
                              return (
                                <label key={it.id} className="flex items-center gap-2 px-1 py-0.5 text-sm cursor-pointer">
                                  <input type="checkbox" checked={inc}
                                    onChange={() => setNhExclude(prev => inc ? [...prev, it.id] : prev.filter(x => x !== it.id))}
                                    className="w-3.5 h-3.5 shrink-0" />
                                  <span className={`truncate ${inc ? 'text-text-primary' : 'line-through text-text-muted'}`}>{it.title || '(untitled)'}</span>
                                  {nhSources.length > 1 && <span className="text-[10px] text-text-muted shrink-0">· {it.guide}</span>}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            <div className="flex gap-2 items-center sticky bottom-0 bg-[#f5f8fb] py-2 -mx-1 px-1 border-t border-[#d9e4ee]">
              <button onClick={createComposed} disabled={!nhName.trim() || !nhSources.length}
                className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark disabled:opacity-40">Save combined guide</button>
              <button onClick={() => printDoc(combinedInnerHtml(nhSources, nhExclude, nhHeaders, nhName), nhName, nhSources.join(' + '))} disabled={!nhSources.length}
                className="bg-white border border-border-light text-ink text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-canvas disabled:opacity-40">🖨 Preview PDF</button>
              <button onClick={() => setShowNewHire(false)} className="text-sm text-text-muted px-3">Cancel</button>
              <span className="text-[11px] text-text-muted ml-auto">Save it to get a 👤 tab, or Preview the PDF right now.</span>
            </div>
          </div>
        </div>
      )}

      {view === 'guides' && draftMode && (
        <div className="px-8 py-2 bg-[#fbf3e6] border-b border-[#e8d5b0] text-xs font-semibold text-[#8a6d3b] flex items-center gap-2 flex-shrink-0">
          ✎ Customize mode — edits and deletions here are <span className="underline">temporary</span> and only affect the PDF/email you export now. Discard when done to keep the saved template unchanged.
        </div>
      )}

      {view === 'dashboard' && Dashboard()}

      {view === 'guides' && isComposed && composedDef && (
      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="max-w-5xl">
          <div className="mb-4 px-4 py-3 bg-[#eef2f7] border border-[#c7d4e2] rounded-card text-sm text-[#3f5a76] flex items-center gap-2 flex-wrap">
            <span>🧩 <b>{guide}</b> is a combined guide, assembled from <b>{guideSources.join(' + ') || '—'}</b>. Edit any section right here — changes save to that source guide and update everywhere it appears.</span>
            {guideSources.map(s => (
              <button key={s} onClick={() => setGuide(s)} className="text-xs font-semibold text-ink border border-border-light bg-white px-2.5 py-1 rounded-ctrl hover:bg-canvas">Open {s}</button>
            ))}
          </div>

          <p className="font-spectral text-[17px] font-semibold text-text-primary mb-6">{personName.trim() ? `Hi ${personName.trim()},` : 'Welcome aboard,'}</p>

          <div className="space-y-8">
            {guideSources.map(g => {
              const list = items.filter(i => i.guide === g && !composedDef.exclude.includes(i.id));
              if (!list.length) return null;
              const label = (composedDef.headers?.[g] && composedDef.headers[g].trim()) || `${g} Onboarding`;
              const nodes = blocksFor(list, g);
              const order = composedBlockOrder(g, list);
              return (
                <div key={g}>
                  <div className="mb-4 pt-3 border-t-2 border-[#c9a24a]">
                    <div className="text-[10px] tracking-[0.14em] text-[#c9a24a] font-bold uppercase">Section</div>
                    <div className="text-[20px] font-extrabold text-text-primary mt-0.5">{label}</div>
                  </div>
                  <div className="space-y-6">
                    {order.map(k => <div key={k}>{nodes[k]}</div>)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      )}

      {view === 'guides' && !isComposed && (
      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="max-w-5xl">
          <div className="space-y-6">
            {/* Blocks render in the saved order; hover a block for ▲▼ to move it */}
            {visibleBlocks.map((k, i) => (
              <div key={k} className="relative group/blk">
                <div className="absolute -top-2 right-1 z-10 flex gap-0.5 opacity-0 group-hover/blk:opacity-100">
                  <button disabled={i === 0} onClick={() => moveBlock(k, -1)} title="Move block up"
                    className="text-xs bg-white border border-border-light rounded px-1.5 py-0.5 text-text-muted hover:text-ink disabled:opacity-25 disabled:cursor-default shadow-sm">▲</button>
                  <button disabled={i === visibleBlocks.length - 1} onClick={() => moveBlock(k, 1)} title="Move block down"
                    className="text-xs bg-white border border-border-light rounded px-1.5 py-0.5 text-text-muted hover:text-ink disabled:opacity-25 disabled:cursor-default shadow-sm">▼</button>
                </div>
                {blockNodes[k]}
              </div>
            ))}
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
                  <div className="flex items-center gap-2 mt-1.5">
                    {(() => { const st = STAGES.find(s => s.key === stageOf(p)) ?? STAGES[3]; return (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#eef2f7] text-[#3f5a76]">{st.icon} {st.label}</span>
                    ); })()}
                    {p.start_date && <span className="text-[11px] text-text-muted">Starts {fmtDate(p.start_date)}</span>}
                  </div>
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
                      <p className="text-sm text-text-muted">{[person.position, person.email].filter(Boolean).join(' · ')}</p>
                      <div className="flex gap-2 mt-1.5 text-[11px]">
                        <span className="font-semibold px-2 py-0.5 rounded-full bg-[#eef5f1] text-[#2f7d5b]">{person.worker_type}</span>
                        <span className="font-semibold px-2 py-0.5 rounded-full bg-[#e9f0f5] text-[#3f6b8a]">{person.guide} guide</span>
                        <span className="font-semibold px-2 py-0.5 rounded-full bg-[#f7efe1] text-[#b07d2a]">{pct}% complete</span>
                      </div>
                    </div>
                    <button onClick={() => deleteOnboardee(person.id)} className="text-xs font-semibold text-litred-alt border border-border-light px-2.5 py-1 rounded-ctrl hover:bg-[#fdeaea]">Remove</button>
                  </div>

                  {/* Hiring journey: offer sent → viewed → accepted → onboarding → hired */}
                  <div className="px-5 py-4 border-b border-border bg-[#faf8f4]">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2.5">Hiring journey</div>
                    <div className="flex items-center flex-wrap gap-y-1">
                      {STAGES.map((s, i) => {
                        const curr = stageIndex(stageOf(person));
                        const reached = i <= curr;
                        const active = i === curr;
                        const isComplete = s.key === 'complete';
                        const clickable = !isComplete || allDone || stageOf(person) === 'complete';
                        return (
                          <div key={s.key} className="flex items-center">
                            <button onClick={() => clickable && setStage(person, s.key)} disabled={!clickable}
                              title={isComplete && !clickable ? 'Finish all tasks first' : `Set stage: ${s.label}`}
                              className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                                active ? 'bg-ink text-white border-ink'
                                : reached ? 'bg-[#eef5f1] text-[#2f7d5b] border-[#cfe4d8] hover:bg-[#e2efe8]'
                                : 'bg-white text-text-muted border-border-light hover:border-ink'} ${clickable ? '' : 'opacity-40 cursor-default'}`}>
                              <span>{s.icon}</span><span>{s.label}</span>
                            </button>
                            {i < STAGES.length - 1 && <span className={`w-4 h-0.5 mx-0.5 ${i < curr ? 'bg-[#2f7d5b]' : 'bg-[#e5ddd0]'}`} />}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Key dates — editable inline */}
                  <div className="px-5 py-4 border-b border-border grid grid-cols-2 gap-4 max-w-md">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">Start date</label>
                      <input type="date" value={person.start_date ?? ''} onChange={e => patchOnboardee(person.id, { start_date: e.target.value })}
                        className="w-full border border-border-light rounded-ctrl px-2.5 py-1.5 text-sm focus:outline-none focus:border-ink" />
                      {person.start_date && <p className="text-[11px] text-text-muted mt-1">{fmtDate(person.start_date)}</p>}
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">Onboarding date</label>
                      <input type="date" value={person.onboarding_date ?? ''} onChange={e => patchOnboardee(person.id, { onboarding_date: e.target.value })}
                        className="w-full border border-border-light rounded-ctrl px-2.5 py-1.5 text-sm focus:outline-none focus:border-ink" />
                      {person.onboarding_date && <p className="text-[11px] text-text-muted mt-1">{fmtDate(person.onboarding_date)}</p>}
                    </div>
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
                {([['Name', 'name'], ['Email', 'email'], ['Position', 'position'], ['Phone', 'phone'], ['Start date', 'start_date'], ['Onboarding date', 'onboarding_date'], ['DOB', 'dob']] as [string, keyof typeof newForm][]).map(([l, k]) => (
                  <div key={k} className={k === 'name' ? 'col-span-2' : ''}>
                    <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1">{l}</label>
                    <input type={k === 'start_date' || k === 'onboarding_date' ? 'date' : 'text'} value={newForm[k]} onChange={e => setNewForm(f => ({ ...f, [k]: e.target.value }))}
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

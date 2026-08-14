'use client';
import { useEffect, useLayoutEffect, useState, useRef, type ReactNode, type KeyboardEvent as ReactKeyboardEvent, type UIEvent as ReactUIEvent } from 'react';
import { useSession } from 'next-auth/react';
import { useToast } from '@/components/Toast';
import IntakeLinks from './IntakeLinks';
import { FIRM_SYSTEMS } from '@/lib/firmSystems';

interface Item {
  id: string; guide: string; kind: 'section' | 'schedule' | 'sop' | 'tool' | 'table' | 'task' | 'blocklabel' | 'blockhidden';
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

// A section body can embed a table using a [TABLE] … [/TABLE] fence — the first
// row is the header, cells are separated by "|", everything outside a fence is
// normal section text. This keeps each topic's prose and its table together in
// reading order, instead of pushing every table into one block at the bottom.
type BodyBlock = { type: 'text'; text: string } | { type: 'table'; headers: string[]; rows: string[][] };
function parseBodyBlocks(body: string | null): BodyBlock[] {
  const src = String(body ?? '');
  const out: BodyBlock[] = [];
  const re = /\[TABLE\]\r?\n?([\s\S]*?)\[\/TABLE\]/gi;
  let last = 0, m: RegExpExecArray | null;
  const pushText = (t: string) => { const s = t.replace(/^\s*\n|\s+$/g, ''); if (s) out.push({ type: 'text', text: s }); };
  while ((m = re.exec(src))) {
    if (m.index > last) pushText(src.slice(last, m.index));
    const grid = m[1].split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => l.split('|').map(c => c.trim()));
    if (grid.length) out.push({ type: 'table', headers: grid[0], rows: grid.slice(1) });
    last = re.lastIndex;
  }
  if (last < src.length) pushText(src.slice(last));
  if (!out.length) out.push({ type: 'text', text: src });
  return out;
}

// Read-only render of a section body (text + inline tables) for the guide view.
// Clicking anywhere opens the section editor, matching the plain-text sections.
function SectionBodyView({ body, onEdit }: { body: string | null; onEdit: () => void }) {
  const blocks = parseBodyBlocks(body);
  return (
    <div className="mt-2 pl-3 space-y-2.5">
      {blocks.map((b, i) => b.type === 'text' ? (
        <p key={i} onClick={e => { if ((e.target as HTMLElement).tagName !== 'A') onEdit(); }} title="Click to edit"
          className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed cursor-text">{linkify(b.text)}</p>
      ) : (
        <div key={i} onClick={onEdit} title="Click to edit" className="overflow-x-auto cursor-text">
          <table className="w-full text-sm bg-white border border-border rounded-card overflow-hidden">
            <thead className="bg-[#f0ece4]"><tr>{b.headers.map((h, ci) => (
              <th key={ci} className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#8a6d3b]">{h}</th>
            ))}</tr></thead>
            <tbody>{b.rows.map((r, ri) => (
              <tr key={ri} className="border-t border-[#f1ece3]">{r.map((c, ci) => (
                <td key={ci} className="px-3 py-2 text-text-secondary align-top">{linkify(c)}</td>
              ))}</tr>
            ))}</tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

// New-hire journey: undecided (no offer yet) → offer sent → viewed → accepted →
// onboarding → hired.
const STAGES: { key: string; label: string; icon: string }[] = [
  { key: 'undecided', label: 'Undecided', icon: '🤔' },
  { key: 'offer_sent', label: 'Offer sent', icon: '📤' },
  { key: 'offer_viewed', label: 'Viewed', icon: '👀' },
  { key: 'offer_accepted', label: 'Accepted', icon: '✍️' },
  { key: 'onboarding', label: 'Onboarding', icon: '🚀' },
  { key: 'complete', label: 'Hire complete', icon: '✓' },
];
function stageOf(person: any): string {
  if (person?.status === 'Complete') return 'complete';
  // '' = not started / none selected — the default for a brand-new hire.
  return STAGES.some(s => s.key === person?.stage) ? person.stage : '';
}
function stageIndex(key: string) { return STAGES.findIndex(s => s.key === key); }

// Litson's full hiring & onboarding workflow — the standard journey a new hire
// follows, interview through first check-ins. Stage 3 is conditional (only when
// the hire is asked to meet the partners) and rejoins the flow either way.
const WORKFLOW: { n: number; title: string; sub: string; owner: string; conditional?: boolean }[] = [
  { n: 1, title: 'Initial interview', sub: 'Director of Operations + HR', owner: 'HR' },
  { n: 2, title: 'Final interview', sub: 'Alex', owner: 'Alex' },
  { n: 3, title: 'Partner 1:1 calls', sub: 'Scheduled by HR — only if Alex asks the hire to meet the partners', owner: 'HR', conditional: true },
  { n: 4, title: 'Offer letter sent', sub: 'Prepared and sent by HR', owner: 'HR' },
  { n: 5, title: 'Offer letter accepted', sub: 'Start date determined', owner: 'HR' },
  { n: 6, title: 'Onboarding instructions', sub: 'Emailed to the new employee', owner: 'HR' },
  { n: 7, title: 'Access and tools activated', sub: 'HR and Catie, before start date', owner: 'HR & Catie' },
  { n: 8, title: 'Onboarding calls scheduled', sub: 'By HR', owner: 'HR' },
  { n: 9, title: 'Onboarding form link sent', sub: 'Employee submits the intake form', owner: 'HR' },
  { n: 10, title: 'Onboarding call', sub: 'On the employee’s start date', owner: 'HR' },
  { n: 11, title: '1:1 with Caitlin', sub: 'Tasks and support needed', owner: 'Caitlin' },
  { n: 12, title: 'HR and finance calls', sub: 'Plus any additional calls', owner: 'HR & Finance' },
  { n: 13, title: '1st weekly check-in', sub: 'Catie, HR, and Caitlin', owner: 'Catie · HR · Caitlin' },
  { n: 14, title: 'Succeeding check-ins', sub: 'Scheduled by Caitlin', owner: 'Caitlin' },
];
// Bridge between the coarse Hiring-Journey stage and the 14-step workflow, so the
// Dashboard stage pills and the Workflow chart stay in sync.
// Milestone steps to mark done when a stage is selected (additive — never wipes
// detailed onboarding progress). Step 3 (partner calls) is optional, so excluded.
const WF_MILESTONE: Record<string, number[]> = {
  undecided: [1],
  offer_sent: [1, 2, 4],
  offer_viewed: [1, 2, 4],
  offer_accepted: [1, 2, 4, 5],
  onboarding: [1, 2, 4, 5],
};
// Firm tools that can be seeded into the onboarding checklist as their own
// "Tools" group (separate from Tasks). Checklist items whose title matches one
// of these render under Tools.
const CHECKLIST_TOOLS = [...FIRM_SYSTEMS];
const TOOL_TITLE_SET = new Set(CHECKLIST_TOOLS.map(t => t.toLowerCase()));
const isToolTitle = (t: string) => TOOL_TITLE_SET.has(String(t ?? '').trim().toLowerCase());

// The hiring-journey stage implied by the furthest completed workflow step.
function stageFromMaxStep(maxN: number): string {
  if (maxN >= 6) return 'onboarding';
  if (maxN >= 5) return 'offer_accepted';
  if (maxN >= 4) return 'offer_sent';
  if (maxN >= 1) return 'undecided';
  return '';
}

// Category tags for the person. Re-hires / transfers often skip the standard
// guide and are tracked with their own plan/to-do list instead.
const TAGS = ['New hire', 'Re-hire', 'Transfer', 'Promotion', 'Intern', 'Seasonal'];
// Reserved guide key holding the single global onboarding checklist.
const CHECKLIST_GUIDE = '__checklist';
interface Todo { id: string; text: string; done: boolean }
function todosOf(person: any): Todo[] {
  try { const t = JSON.parse(person?.todos ?? '[]'); return Array.isArray(t) ? t : []; } catch { return []; }
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(String(iso).length <= 10 ? iso + 'T12:00:00' : iso);
  return isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
// Effective onboarding date: a person's start date, or — for a re-hire with no
// start date yet — their rehire date. '' when neither is set.
function effectiveStart(p: any): string {
  const s = String(p?.start_date ?? '').slice(0, 10);
  if (s) return s;
  if (p?.tag === 'Re-hire') return String(p?.rehire_date ?? '').slice(0, 10);
  return '';
}
// Label for the date chip: "Starts …", "Rehired …", or null (TBC / not set).
function startLabel(p: any): string | null {
  if (String(p?.start_date ?? '').slice(0, 10)) return `Starts ${fmtDate(p.start_date)}`;
  if (p?.tag === 'Re-hire' && String(p?.rehire_date ?? '').slice(0, 10)) return `Rehired ${fmtDate(p.rehire_date)}`;
  return null;
}
// Two-letter avatar initials from a name (e.g. "Carly Crotty" -> "CC").
function initialsOf(name: string) {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '—';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
// Status-report badge colors, keyed by the label from statusLabelOf().
const REPORT_STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
  'Hired': { bg: '#eef5f1', fg: '#2f7d5b' },
  'Offer accepted': { bg: '#eef5f1', fg: '#2f7d5b' },
  'Offer viewed': { bg: '#eef2f7', fg: '#3f5a76' },
  'Offer sent': { bg: '#eef2f7', fg: '#3f5a76' },
  'Undecided': { bg: '#f6efe1', fg: '#9a7b3e' },
  'In progress': { bg: '#f7efe1', fg: '#b07d2a' },
  'Not started': { bg: '#f1ece3', fg: '#8b8478' },
};

interface TableData { headers: string[]; rows: string[][] }
function parseTable(body: string | null): TableData {
  try { const t = JSON.parse(body ?? ''); if (Array.isArray(t.headers) && Array.isArray(t.rows)) return t; } catch { /* ignore */ }
  return { headers: ['Column 1', 'Column 2'], rows: [['', '']] };
}

// Notes editor with explicit Save / Delete controls (the plain onBlur textarea
// made it unclear whether anything saved).
function NoteEditor({ note, onSave }: { note: string; onSave: (v: string) => void }) {
  const [val, setVal] = useState(note ?? '');
  useEffect(() => { setVal(note ?? ''); }, [note]);
  const dirty = (val ?? '') !== (note ?? '');
  return (
    <div>
      <textarea value={val} onChange={e => setVal(e.target.value)} rows={2}
        placeholder="e.g. Waiting on signed offer · needs laptop shipped · prioritize"
        className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm text-black focus:outline-none focus:border-ink resize-y" />
      <div className="flex items-center gap-2 mt-1.5">
        <button onClick={() => onSave(val.trim())} disabled={!dirty}
          className="bg-ink text-white text-xs font-semibold px-3 py-1.5 rounded-ctrl hover:bg-ink-dark disabled:opacity-40">Save note</button>
        {(note || val) && (
          <button onClick={() => { setVal(''); onSave(''); }}
            className="text-xs font-semibold text-litred-alt border border-border-light px-3 py-1.5 rounded-ctrl hover:bg-[#fdeaea]">Delete</button>
        )}
        {dirty && <span className="text-[11px] text-[#b07d2a]">Unsaved changes</span>}
      </div>
    </div>
  );
}

export default function OnboardingClient() {
  const { showToast } = useToast();
  const { data: session } = useSession();
  const [showReport, setShowReport] = useState(false);
  const [editNoteId, setEditNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
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
  const [view, setView] = useState<'dashboard' | 'guides' | 'intake' | 'workflow'>('dashboard');
  const [addingWf, setAddingWf] = useState(false);
  const [wfHire, setWfHire] = useState(''); // which hire's progress to light up on the workflow
  useEffect(() => { try { const t = new URLSearchParams(window.location.search).get('tab'); if (t && ['dashboard', 'workflow', 'guides', 'intake'].includes(t)) setView(t as any); } catch { /* ignore */ } }, []);
  const [people, setPeople] = useState<any[]>([]);
  // Once a hire is marked complete (hired), drop them from the workflow picker.
  useEffect(() => { if (wfHire) { const p = people.find(x => String(x.id) === wfHire); if (p && p.status === 'Complete') setWfHire(''); } }, [people, wfHire]);
  const [selected, setSelected] = useState<string | null>(null);
  const [dashTab, setDashTab] = useState<'active' | 'hired'>('active');
  // W-8BEN (international contractor tax form) status for the selected person.
  const [w8Rec, setW8Rec] = useState<any>(null);
  const [w8Busy, setW8Busy] = useState(false);
  const [w8Email, setW8Email] = useState('');   // editable recipient (prefilled from the hire; change it to test)
  useEffect(() => {
    if (!selected) { setW8Rec(null); return; }
    setW8Email(people.find((x: any) => x.id === selected)?.email ?? '');
    fetch(`/api/onboarding/w8ben?onboardeeId=${selected}`).then(r => r.json()).then(d => setW8Rec(d.row ?? null)).catch(() => setW8Rec(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);
  async function sendW8ben(p: any) {
    const to = (w8Email || p.email || '').trim();
    setW8Busy(true);
    try {
      const res = await fetch('/api/onboarding/w8ben', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send', onboardee_id: p.id, contractor_name: p.name, contractor_email: to }) });
      const d = await res.json();
      if (!res.ok) { showToast(d.error || 'Could not send'); return; }
      setW8Rec({ id: d.id, contractor_name: p.name, contractor_email: to, status: 'Sent', token: d.token });
      if (d.emailed) showToast(`W-8BEN emailed to ${to}`);
      else showToast(`Link created — email didn't send${d.mail?.error ? ` (${d.mail.error})` : ''}. Use the “Open the form link” below to test.`);
    } catch { showToast('Could not send'); }
    finally { setW8Busy(false); }
  }
  async function deleteW8ben() {
    if (!w8Rec?.id) { setW8Rec(null); return; }
    if (!confirm('Delete this W-8BEN request?')) return;
    await fetch(`/api/onboarding/w8ben?id=${w8Rec.id}`, { method: 'DELETE' });
    setW8Rec(null); showToast('W-8BEN request deleted');
  }
  const [showAdd, setShowAdd] = useState(false);
  const blankNew = { name: '', email: '', position: '', worker_type: 'Employee', guide: 'General', tag: 'New hire', start_date: '', onboarding_date: '', dob: '', phone: '' };
  const [newForm, setNewForm] = useState({ ...blankNew });

  useEffect(() => { fetch('/api/onboarding').then(r => r.json()).then(d => setItems(d.items ?? [])); }, []);
  const [composed, setComposed] = useState<{ name: string; sources: string[]; exclude: string[]; headers: Record<string, string> }[]>([]);
  useEffect(() => { fetch('/api/onboarding/compose').then(r => r.json()).then(d => setComposed(d.composed ?? [])).catch(() => {}); }, []);

  // Custom drag order for the guide tabs (base guides + combined guides), saved
  // per-browser so the order you arrange them in sticks between visits.
  const [guideOrder, setGuideOrder] = useState<string[]>([]);
  const [composedOrder, setComposedOrder] = useState<string[]>([]);
  useEffect(() => {
    try {
      setGuideOrder(JSON.parse(localStorage.getItem('hrkit.ob.guideOrder') || '[]'));
      setComposedOrder(JSON.parse(localStorage.getItem('hrkit.ob.composedOrder') || '[]'));
    } catch { /* ignore */ }
  }, []);
  const dragName = useRef<string | null>(null);
  // Names in `order` first (in that order), then any not-yet-ordered names.
  function applyOrder(names: string[], order: string[]): string[] {
    const known = order.filter(n => names.includes(n));
    return [...known, ...names.filter(n => !known.includes(n))];
  }
  function moveBefore(list: string[], from: string, to: string): string[] {
    const arr = list.slice();
    const fi = arr.indexOf(from);
    if (fi < 0) return arr;
    arr.splice(fi, 1);
    const ti = arr.indexOf(to);
    arr.splice(ti < 0 ? arr.length : ti, 0, from);
    return arr;
  }
  function dropOnGuide(target: string) {
    const from = dragName.current; dragName.current = null;
    if (!from || from === target) return;
    const next = moveBefore(applyOrder(guides, guideOrder), from, target);
    setGuideOrder(next);
    try { localStorage.setItem('hrkit.ob.guideOrder', JSON.stringify(next)); } catch { /* ignore */ }
  }
  function dropOnComposed(target: string) {
    const from = dragName.current; dragName.current = null;
    if (!from || from === target) return;
    const next = moveBefore(applyOrder(composed.map(c => c.name), composedOrder), from, target);
    setComposedOrder(next);
    try { localStorage.setItem('hrkit.ob.composedOrder', JSON.stringify(next)); } catch { /* ignore */ }
  }

  // Keep the reader on the same section when switching between guides, so you
  // can flip between two people and compare the same table (Tools, Schedule…)
  // side-by-side without losing your place. We remember which block is at the
  // top of the view and re-anchor to the matching block in the next guide;
  // if it has no such block we fall back to the same scroll offset.
  const scrollRef = useRef<HTMLDivElement>(null);
  const savedScroll = useRef(0);
  const currentSection = useRef<string | null>(null);
  function handleGuideScroll(e: ReactUIEvent<HTMLDivElement>) {
    const cont = e.currentTarget;
    savedScroll.current = cont.scrollTop;
    const cTop = cont.getBoundingClientRect().top;
    let top: string | null = null;
    cont.querySelectorAll('[data-sec]').forEach(el => {
      if (el.getBoundingClientRect().top - cTop <= 80) top = el.getAttribute('data-sec');
    });
    currentSection.current = top;
  }
  useLayoutEffect(() => {
    const cont = scrollRef.current;
    if (!cont) return;
    const key = currentSection.current;
    const el = key ? cont.querySelector(`[data-sec="${key}"]`) : null;
    if (el) {
      cont.scrollTop += el.getBoundingClientRect().top - cont.getBoundingClientRect().top - 12;
    } else {
      cont.scrollTop = savedScroll.current;
    }
  }, [guide]);
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
  // Duplicate the active guide under a new name as a fully independent copy.
  // A combined guide (like Paige) is flattened into its own editable guide so
  // changes to the copy never touch the original or its shared sources; a plain
  // building-block guide has all of its items copied into the new guide.
  async function duplicateGuide() {
    const name = prompt(`Duplicate “${guide}” as:`, `${guide} (copy)`)?.trim();
    if (!name) return;
    if (guides.includes(name) || composedNames.includes(name)) { showToast(`“${name}” already exists`); return; }
    const payload = (isComposed && composedDef)
      ? { action: 'duplicate-composed', to: name, sources: composedDef.sources, exclude: composedDef.exclude }
      : { action: 'duplicate', from: guide, to: name };
    const res = await fetch('/api/onboarding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const { items: newItems } = await res.json();
    if (Array.isArray(newItems)) setItems(newItems);
    setGuide(name);
    showToast(`Duplicated “${guide}” → “${name}” (independent copy)`);
  }
  async function renameGuide() {
    const name = prompt(`Rename the “${guide}” guide (tab) to:`, guide)?.trim();
    if (!name || name === guide) return;
    if (guides.includes(name) || composedNames.includes(name)) { showToast(`“${name}” already exists`); return; }
    const res = await fetch('/api/onboarding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'rename-guide', from: guide, to: name }) });
    const d = await res.json();
    if (!res.ok) { showToast(d.error || 'Rename failed'); return; }
    if (Array.isArray(d.items)) setItems(d.items);
    setGuide(name);
    showToast(`Renamed to “${name}”`);
  }
  const [blockOrders, setBlockOrders] = useState<Record<string, string[]>>({});
  useEffect(() => { fetch('/api/onboarding/order').then(r => r.json()).then(d => setBlockOrders(d.orders ?? {})).catch(() => {}); }, []);
  useEffect(() => { fetch('/api/onboardees').then(r => r.json()).then(d => setPeople(d.rows ?? [])); }, []);

  // The onboarding checklist is one global list shared by every new hire,
  // independent of which guide they're on (stored under CHECKLIST_GUIDE).
  function tasksFor(_g?: string) { return items.filter(i => i.kind === 'task' && i.guide === CHECKLIST_GUIDE); }
  const parseProg = (p: any) => { try { return JSON.parse(p ?? '{}') || {}; } catch { return {}; } };
  function progressOf(person: any) {
    // Combine the guide checklist with the person's own plan/to-dos, so re-hires
    // who skip the guide are still tracked (and can be marked complete).
    const t = tasksFor(person.guide); const prog = parseProg(person.progress);
    const guideDone = t.filter(x => prog[x.title]).length;
    const todos = todosOf(person);
    const todoDone = todos.filter(td => td.done).length;
    const total = t.length + todos.length;
    const done = guideDone + todoDone;
    return { done, total, pct: total ? Math.round(done / total * 100) : 0 };
  }

  // Human-readable status for the report (mirrors the dashboard card's logic).
  function statusLabelOf(p: any): string {
    if (p.status === 'Complete') return 'Hired';
    const st = stageOf(p);
    if (st === 'offer_accepted') return 'Offer accepted';
    if (st === 'undecided') return 'Undecided';
    if (st === 'offer_viewed') return 'Offer viewed';
    if (st === 'offer_sent') return 'Offer sent';
    if (st === 'onboarding') return 'In progress';
    return progressOf(p).pct > 0 ? 'In progress' : 'Not started';
  }

  const preparer = (() => {
    const u: any = session?.user;
    if (u?.name) return String(u.name);
    const local = String(u?.email ?? '').split('@')[0];
    if (!local) return 'HR';
    return local.split(/[._-]/)[0].replace(/^\w/, c => c.toUpperCase());
  })();

  // Everything the status report needs, computed from the active onboardees.
  function buildReport() {
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
    const active = people.filter(p => p.status !== 'Complete');
    const hiredCount = people.filter(p => p.status === 'Complete').length;

    let sumDone = 0, sumTotal = 0;
    active.forEach(p => { const { done, total } = progressOf(p); sumDone += done; sumTotal += total; });
    const tasksPct = sumTotal ? Math.round(sumDone / sumTotal * 100) : 0;

    const withStart = active.map(p => ({ p, s: effectiveStart(p) })).filter(x => x.s);
    const upcoming = withStart.filter(x => x.s >= todayStr).sort((a, b) => a.s.localeCompare(b.s));
    const byDate = [...withStart].sort((a, b) => a.s.localeCompare(b.s));
    const earliest = upcoming[0] ?? byDate[0];
    const nextStart = earliest?.s ?? null;
    const earliestId = earliest?.p.id ?? null;

    const sorted = [...active].sort((a, b) => {
      const sa = effectiveStart(a), sb = effectiveStart(b);
      if (!sa && !sb) return a.name.localeCompare(b.name);
      if (!sa) return 1; if (!sb) return -1;
      return sa.localeCompare(sb);
    });

    const rows = sorted.map(p => {
      const { done, total } = progressOf(p);
      const status = statusLabelOf(p);
      // The hand-written note (shown as "Notes: …"), kept separate from the
      // small auto hint (earliest start / clear to proceed / role to confirm).
      const note = (p.note ?? '').trim();
      let hint = '';
      if (!p.position || p.guide === 'None') hint = 'Role and guide to confirm';
      else if (p.id === earliestId) hint = 'Earliest start — prioritize';
      else if (stageOf(p) === 'offer_accepted') hint = 'Clear to proceed';
      return {
        id: p.id, name: p.name, initials: initialsOf(p.name),
        sub: `${p.position || p.worker_type}${p.guide && p.guide !== 'None' ? ` · ${p.guide} guide` : ''}`,
        status, done, total, note, hint,
        start: startLabel(p) ?? 'Start date TBC',
      };
    });

    return {
      asOf: fmtDate(todayStr), preparer,
      inOnboarding: active.length, hiredCount, tasksPct,
      nextStart: nextStart ? fmtDate(nextStart) : '—',
      rows,
    };
  }

  function printReport() {
    const r = buildReport();
    const win = window.open('', '_blank');
    if (!win) { showToast('Allow pop-ups to print the report'); return; }
    const esc = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const stat = (label: string, value: string) =>
      `<div style="flex:1;background:#fff;border:0.75pt solid #e6ddcd;border-top:2.5pt solid #c9a24a;border-radius:8pt;padding:9pt 11pt">
        <div style="font-size:7.5pt;font-weight:700;color:#8a8474;text-transform:uppercase;letter-spacing:.06em;margin-bottom:3pt">${esc(label)}</div>
        <div style="font-size:18pt;font-weight:600;color:#1b2a3d;line-height:1">${esc(value)}</div>
      </div>`;
    const rowHtml = r.rows.map(row => {
      const c = REPORT_STATUS_COLOR[row.status] ?? REPORT_STATUS_COLOR['Not started'];
      return `<div style="position:relative;background:#fff;border:0.75pt solid #e6ddcd;border-left:3pt solid ${c.fg};border-radius:8pt;padding:11pt 13pt;margin-bottom:9pt;break-inside:avoid">
        <div style="display:flex;align-items:flex-start;gap:11pt">
          <div style="width:30pt;height:30pt;border-radius:50%;background:${c.bg};color:${c.fg};font-size:9.5pt;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">${esc(row.initials)}</div>
          <div style="flex:1">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10pt">
              <div>
                <div style="font-weight:700;color:#1b2a3d;font-size:11pt">${esc(row.name)}</div>
                <div style="font-size:9pt;color:#8a8474;margin-top:1pt">${esc(row.sub)}</div>
              </div>
              <div style="font-size:8.5pt;color:#6a6456;white-space:nowrap;background:#f7f4ef;border:0.5pt solid #e6ddcd;border-radius:9pt;padding:2pt 8pt">${esc(row.start)}</div>
            </div>
            <div style="margin-top:6pt">
              <span style="font-size:8.5pt;font-weight:600;padding:2pt 8pt;border-radius:10pt;background:${c.bg};color:${c.fg}">${esc(row.status)}</span>
              <span style="font-size:8.5pt;color:#8a8474;margin-left:8pt">${row.done}/${row.total} tasks</span>
              ${row.hint ? `<span style="font-size:8.5pt;color:#b07d2a;margin-left:8pt">· ${esc(row.hint)}</span>` : ''}
            </div>
            ${row.note ? `<div style="font-size:10.5pt;color:#000;margin-top:7pt;background:#faf8f4;border:0.5pt solid #ece5d8;border-radius:6pt;padding:6pt 9pt"><span style="font-weight:700">Notes:</span> ${esc(row.note)}</div>` : ''}
          </div>
        </div>
      </div>`;
    }).join('');

    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Onboarding status report</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  @page{size:letter;margin:0.55in}
  body{font-family:Georgia,'Times New Roman',serif;color:#1b2a3d;font-size:10.5pt;background:#faf8f4;-webkit-print-color-adjust:exact;print-color-adjust:exact}
</style></head><body>
  <div style="background:#1b2a3d;border-radius:12pt;padding:16pt 18pt;margin-bottom:16pt;position:relative;overflow:hidden">
    <div style="position:absolute;top:0;left:0;right:0;height:3pt;background:linear-gradient(to right,#c9a24a,#e6d3a3 55%,#c9a24a)"></div>
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <div style="font-size:16pt;font-weight:700;letter-spacing:0.3em;color:#c9a24a;line-height:1">LITSON</div>
        <div style="font-size:7pt;font-weight:700;letter-spacing:0.24em;text-transform:uppercase;color:#9fb0c4;margin-top:3pt">PLLC · Human Resources</div>
        <div style="font-size:19pt;font-weight:700;color:#fff;margin-top:11pt">Onboarding status report</div>
        <div style="font-size:9.5pt;color:#aebccd;margin-top:3pt">Prepared by ${esc(r.preparer)}</div>
      </div>
      <div style="font-size:8.5pt;color:#e7edf3;background:rgba(255,255,255,0.1);border:0.5pt solid rgba(255,255,255,0.25);border-radius:9pt;padding:3pt 9pt">As of ${esc(r.asOf)}</div>
    </div>
  </div>
  <div style="display:flex;gap:9pt;margin-bottom:16pt">
    ${stat('In onboarding', String(r.inOnboarding))}
    ${stat('Hired', String(r.hiredCount))}
    ${stat('Tasks complete', r.tasksPct + '%')}
    ${stat('Next start date', r.nextStart)}
  </div>
  <div style="display:flex;align-items:center;gap:6pt;margin-bottom:9pt">
    <span style="display:inline-block;width:14pt;height:2.5pt;border-radius:2pt;background:#c9a24a"></span>
    <span style="font-size:8pt;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#1b2a3d">Onboarding pipeline</span>
  </div>
  ${rowHtml || '<div style="padding:20pt 0;color:#8a8474;text-align:center">No one is currently onboarding.</div>'}
  <script>window.onload=function(){window.print()}</script>
</body></html>`);
    win.document.close();
  }

  // Report as an Excel file (an HTML table Excel opens natively).
  function exportReportExcel() {
    const r = buildReport();
    const esc = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const head = ['Name', 'Role / Guide', 'Status', 'Tasks', 'Start date', 'Note'];
    const trs = r.rows.map(row => `<tr><td>${esc(row.name)}</td><td>${esc(row.sub)}</td><td>${esc(row.status)}</td><td>${row.done}/${row.total}</td><td>${esc(row.start)}</td><td>${esc(row.note || row.hint)}</td></tr>`).join('');
    const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>
      <table border="1" cellspacing="0" cellpadding="4">
        <tr><td colspan="6"><b>Onboarding status report</b></td></tr>
        <tr><td colspan="6">LITSON PLLC · As of ${esc(r.asOf)} · Prepared by ${esc(r.preparer)}</td></tr>
        <tr><td colspan="6">In onboarding: ${r.inOnboarding} · Hired: ${r.hiredCount} · Tasks complete: ${r.tasksPct}% · Next start: ${esc(r.nextStart)}</td></tr>
        <tr></tr>
        <tr>${head.map(h => `<th align="left" bgcolor="#1b2a3d"><font color="#ffffff">${h}</font></th>`).join('')}</tr>
        ${trs}
      </table></body></html>`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([html], { type: 'application/vnd.ms-excel' }));
    a.download = `onboarding-status-${r.asOf.replace(/[^\w]+/g, '-')}.xls`;
    a.click();
    showToast('Excel downloaded');
  }

  // Copy the branded, card-style report to the clipboard for pasting into an
  // email. Uses email-safe table markup so it keeps the report's look.
  async function copyReportForEmail() {
    const r = buildReport();
    const esc = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const statCell = (l: string, v: string) =>
      `<td width="25%" valign="top" bgcolor="#ffffff" style="background:#ffffff;border:1px solid #e6ddcd;border-top:3px solid #c9a24a;padding:9px 11px">
        <div style="font-size:9px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#8a8474">${esc(l)}</div>
        <div style="font-size:19px;font-weight:bold;color:#1b2a3d;margin-top:2px">${esc(v)}</div></td>`;
    const cardHtml = r.rows.map(row => {
      const c = REPORT_STATUS_COLOR[row.status] ?? REPORT_STATUS_COLOR['Not started'];
      return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:10px"><tr>
        <td width="4" bgcolor="${c.fg}" style="background:${c.fg};width:4px"></td>
        <td bgcolor="#ffffff" style="background:#ffffff;border:1px solid #e6ddcd;border-left:none;padding:12px 14px">
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td width="42" valign="top">
              <table cellpadding="0" cellspacing="0"><tr><td width="34" height="34" align="center" valign="middle" bgcolor="${c.bg}" style="background:${c.bg};color:${c.fg};font-weight:bold;font-size:12px;border-radius:17px">${esc(row.initials)}</td></tr></table>
            </td>
            <td valign="top">
              <table width="100%" cellpadding="0" cellspacing="0"><tr>
                <td valign="top"><span style="font-weight:bold;font-size:15px;color:#1b2a3d">${esc(row.name)}</span><br><span style="font-size:12px;color:#8a8474">${esc(row.sub)}</span></td>
                <td align="right" valign="top"><span style="font-size:11px;color:#6a6456;background:#f7f4ef;border:1px solid #e6ddcd;padding:2px 8px;border-radius:9px;white-space:nowrap">${esc(row.start)}</span></td>
              </tr></table>
              <div style="margin-top:7px">
                <span style="font-size:11px;font-weight:bold;color:${c.fg};background:${c.bg};padding:3px 9px;border-radius:10px">${esc(row.status)}</span>
                <span style="font-size:11px;color:#8a8474;margin-left:8px">${row.done}/${row.total} tasks</span>
                ${row.hint ? `<span style="font-size:11px;color:#b07d2a;margin-left:8px">&middot; ${esc(row.hint)}</span>` : ''}
              </div>
              ${row.note ? `<div style="margin-top:8px;font-size:13px;color:#000000;background:#faf8f4;border:1px solid #ece5d8;padding:7px 10px;border-radius:6px"><b>Notes:</b> ${esc(row.note)}</div>` : ''}
            </td>
          </tr></table>
        </td>
      </tr></table>`;
    }).join('');
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;background:#faf8f4;padding:16px;max-width:660px">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:14px"><tr>
        <td bgcolor="#1b2a3d" style="background:#1b2a3d;border-top:3px solid #c9a24a;padding:16px 18px">
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td valign="top">
              <div style="font-size:16px;font-weight:bold;letter-spacing:5px;color:#c9a24a">LITSON</div>
              <div style="font-size:8px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:#9fb0c4;margin-top:2px">PLLC &middot; Human Resources</div>
              <div style="font-size:20px;font-weight:bold;color:#ffffff;margin-top:11px">Onboarding status report</div>
              <div style="font-size:12px;color:#aebccd;margin-top:3px">Prepared by ${esc(r.preparer)}</div>
            </td>
            <td align="right" valign="top"><span style="font-size:11px;color:#e7edf3;border:1px solid #3a4a5d;padding:3px 9px;border-radius:9px;white-space:nowrap">As of ${esc(r.asOf)}</span></td>
          </tr></table>
        </td>
      </tr></table>
      <table width="100%" cellpadding="0" cellspacing="8" style="margin:-8px 0 8px"><tr>
        ${statCell('In onboarding', String(r.inOnboarding))}
        ${statCell('Hired', String(r.hiredCount))}
        ${statCell('Tasks complete', r.tasksPct + '%')}
        ${statCell('Next start date', r.nextStart)}
      </tr></table>
      <div style="font-size:9px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:#1b2a3d;margin:6px 0 10px">Onboarding pipeline</div>
      ${cardHtml}
    </div>`;
    const text = [
      `Onboarding status report — As of ${r.asOf} · Prepared by ${r.preparer}`,
      `In onboarding: ${r.inOnboarding} · Hired: ${r.hiredCount} · Tasks complete: ${r.tasksPct}% · Next start: ${r.nextStart}`,
      '',
      ...r.rows.map(row => `• ${row.name} — ${row.sub} | ${row.status} | ${row.done}/${row.total} tasks | ${row.start}${(row.note || row.hint) ? ` | ${row.note || row.hint}` : ''}`),
    ].join('\n');
    try {
      if (navigator.clipboard && typeof window !== 'undefined' && 'ClipboardItem' in window) {
        await navigator.clipboard.write([new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' }),
        })]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      showToast('Copied — paste into your email');
    } catch { showToast('Copy failed — try Excel or Print instead'); }
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
    // Click the current stage again to clear it back to none / not started.
    const next = stageOf(person) === key ? '' : key;
    // Keep the Workflow chart in sync: mark this stage's milestone steps done in
    // the hire's checklist (additive) so both views move together.
    const clTitles = new Set(tasksFor().map((t: any) => String(t.title ?? '').trim()));
    const prog = parseProg(person.progress);
    const milestones = WF_MILESTONE[next] ?? [];
    const newProg: Record<string, any> = { ...prog }; let progChanged = false;
    for (const s of WORKFLOW) { if (clTitles.has(s.title) && milestones.includes(s.n) && !newProg[s.title]) { newProg[s.title] = true; progChanged = true; } }
    const body: Record<string, any> = { id: person.id, stage: next };
    if (person.status === 'Complete') body.status = 'In Progress';
    if (progChanged) body.progress = newProg;
    setPeople(prev => prev.map(p => p.id === person.id ? { ...p, stage: next, ...(person.status === 'Complete' ? { status: 'In Progress' } : {}), ...(progChanged ? { progress: JSON.stringify(newProg) } : {}) } : p));
    await fetch('/api/onboardees', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }
  const [newTodo, setNewTodo] = useState('');
  function saveTodos(person: any, todos: Todo[]) { patchOnboardee(person.id, { todos }); }
  function addTodo(person: any, text: string) {
    const t = text.trim(); if (!t) return;
    saveTodos(person, [...todosOf(person), { id: 't' + Date.now() + Math.random().toString(36).slice(2, 6), text: t, done: false }]);
    setNewTodo('');
  }
  function toggleTodo(person: any, id: string, done: boolean) {
    saveTodos(person, todosOf(person).map(td => td.id === id ? { ...td, done } : td));
  }
  function editTodo(person: any, id: string, text: string) {
    saveTodos(person, todosOf(person).map(td => td.id === id ? { ...td, text } : td));
  }
  function removeTodo(person: any, id: string) {
    saveTodos(person, todosOf(person).filter(td => td.id !== id));
  }
  async function toggleTask(person: any, title: string, val: boolean) {
    const prog = { ...parseProg(person.progress), [title]: val };
    const body: Record<string, any> = { id: person.id, progress: prog };
    // If this is a workflow step, keep the Hiring Journey stage in sync so the
    // Dashboard stepper moves with it (never auto-completes — that's explicit).
    if (WORKFLOW.some(s => s.title === title) && person.status !== 'Complete') {
      const maxN = WORKFLOW.reduce((m, s) => (prog[s.title] ? Math.max(m, s.n) : m), 0);
      body.stage = stageFromMaxStep(maxN);
    }
    setPeople(prev => prev.map(p => p.id === person.id ? { ...p, progress: JSON.stringify(prog), ...(body.stage !== undefined ? { stage: body.stage } : {}) } : p));
    await fetch('/api/onboardees', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }
  async function completeOnboardee(person: any) {
    if (!confirm(`Mark ${person.name} as hired? Their info is added to the Staffing directory and they move to the Hired tab.`)) return;
    const res = await fetch('/api/onboardees', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: person.id, complete: true }) });
    const { row } = await res.json();
    setPeople(prev => prev.map(p => p.id === person.id ? row : p));
    setDashTab('hired');
    showToast(`${person.name} hired — added to Staffing`);
  }
  // Re-push a hired person into Staffing (idempotent — only inserts if missing).
  async function addToStaffing(person: any) {
    await fetch('/api/onboardees', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: person.id, complete: true }) });
    showToast(`${person.name} is in the Staffing directory`);
  }
  async function deleteOnboardee(id: string) {
    if (!confirm('Remove this onboarding record?')) return;
    setPeople(prev => prev.filter(p => p.id !== id));
    if (selected === id) setSelected(null);
    await fetch('/api/onboardees', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
  }

  // Distinct building-block guides, General first
  const guides = Array.from(new Set(items.map(i => i.guide))).filter(g => g !== CHECKLIST_GUIDE).sort((a, b) => (a === 'General' ? -1 : b === 'General' ? 1 : a.localeCompare(b)));
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
  // Append the workflow stages to the onboarding checklist (skipping any already
  // there by title), so each hire's checklist follows the journey.
  async function addWorkflowToChecklist() {
    setAddingWf(true);
    try {
      const have = new Set(tasksFor().map(t => String(t.title ?? '').trim().toLowerCase()));
      let added = 0;
      for (const s of WORKFLOW) {
        if (have.has(s.title.toLowerCase())) continue;
        await add('task', { title: s.title, owner: s.owner }, CHECKLIST_GUIDE);
        added++;
      }
      showToast(added ? `Added ${added} step${added > 1 ? 's' : ''} to the onboarding checklist` : 'All workflow steps are already in the checklist');
    } finally { setAddingWf(false); }
  }

  // Add the firm tools (incl. Briefcatch) to the checklist's Tools group.
  async function addToolsToChecklist() {
    const have = new Set(tasksFor().map(t => String(t.title ?? '').trim().toLowerCase()));
    let added = 0;
    for (const t of CHECKLIST_TOOLS) { if (have.has(t.toLowerCase())) continue; await add('task', { title: t, owner: 'HR' }, CHECKLIST_GUIDE); added++; }
    showToast(added ? `Added ${added} tool${added > 1 ? 's' : ''} to the checklist` : 'All tools are already in the checklist');
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
  // Copy a whole block of links (Tools or SOP), keeping each item's URL, into
  // another guide. A combined guide (e.g. Paige) can't hold items itself, so
  // the links land in its first source guide — which is what its view shows.
  async function copyLinksToGuide(kind: 'sop' | 'tool', list: Item[]) {
    const label = kind === 'sop' ? 'SOP link' : 'tool';
    if (!list.length) { showToast(`No ${label}s here to copy`); return; }
    const targets = [...guides, ...composedNames].filter(n => n !== guide);
    if (!targets.length) { showToast('No other guide to copy to'); return; }
    const to = prompt(`Copy these ${list.length} ${label}${list.length > 1 ? 's' : ''} (with their links) to which guide?\n\n${targets.join(', ')}`, targets[0])?.trim();
    if (!to) return;
    const q = to.toLowerCase();
    // Exact match first, then a forgiving contains-match (so "paige" finds "Paige Nutini").
    const comp = composed.find(c => c.name.toLowerCase() === q) ?? composed.find(c => c.name.toLowerCase().includes(q));
    const base = guides.find(g => g.toLowerCase() === q) ?? guides.find(g => g.toLowerCase().includes(q));
    const destGuide = comp ? (comp.sources[0] ?? '') : (base ?? '');
    if (!destGuide) { showToast(`Couldn’t find a guide named “${to}”`); return; }
    const destLabel = comp ? comp.name : destGuide;
    // If the destination already has links of this kind, let HR decide whether
    // to make this set THE model (replace) or just add to what's there (append).
    const existing = items.filter(i => i.guide === destGuide && i.kind === kind);
    let replace = false;
    if (existing.length) {
      replace = confirm(`“${destLabel}” already has ${existing.length} ${label}${existing.length > 1 ? 's' : ''}.\n\nOK  → replace them with these ${list.length} (make this the model).\nCancel → add these on top of the existing ones.`);
    }
    if (replace) {
      for (const e of existing) await fetch('/api/onboarding', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: e.id }) });
    }
    const created: Item[] = [];
    for (const l of list) {
      const res = await fetch('/api/onboarding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, guide: destGuide, title: l.title, url: l.url ?? null }) });
      const { item } = await res.json();
      if (item) created.push(item);
    }
    setItems(prev => [...prev.filter(i => !(replace && i.guide === destGuide && i.kind === kind)), ...created]);
    showToast(`${replace ? 'Replaced' : 'Copied'} ${created.length} ${label}${created.length > 1 ? 's' : ''} ${replace ? 'in' : 'to'} “${destLabel}”`);
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
  // Drag & drop reordering for 2-week training schedule rows, scoped to the
  // dragged row's own guide (works on the combined view too).
  const [schedDragId, setSchedDragId] = useState<string | null>(null);
  async function reorderSchedule(targetId: string) {
    if (!schedDragId || schedDragId === targetId) { setSchedDragId(null); return; }
    const src = items.find(i => i.id === schedDragId), tgt = items.find(i => i.id === targetId);
    if (!src || !tgt || src.kind !== 'schedule' || tgt.kind !== 'schedule' || src.guide !== tgt.guide) { setSchedDragId(null); return; }
    const all = items.filter(i => i.guide === src.guide && i.kind === 'schedule').sort((a, b) => a.sort_order - b.sort_order);
    const ids = all.map(i => i.id);
    ids.splice(ids.indexOf(schedDragId), 1);
    ids.splice(ids.indexOf(targetId), 0, schedDragId);
    const updated = ids.map((id, i) => ({ id, sort_order: i }));
    setItems(prev => prev.map(i => { const u = updated.find(x => x.id === i.id); return u ? { ...i, sort_order: u.sort_order } : i; }));
    setSchedDragId(null);
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

  const SectionCard = (s: Item) => {
    // Only attach drag handlers when NOT editing — a draggable card blocks
    // typing / text selection in the section's textarea while you edit it.
    const dragProps = editing === s.id ? {} : {
      draggable: true,
      onDragStart: () => setDragId(s.id),
      onDragOver: (e: any) => e.preventDefault(),
      onDrop: () => reorderSection(s.id),
      onDragEnd: () => setDragId(null),
    };
    return (
    <div key={s.id} {...dragProps}
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
          <p className="text-[11px] text-text-muted">Tip: paste a link and it becomes clickable. For a friendly label use <code>[Label](https://link)</code>. To drop in a table, wrap rows in <code>[TABLE] … [/TABLE]</code> — first line is the header, separate columns with <code>|</code>.</p>
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
            ? <SectionBodyView body={s.body} onEdit={() => startEdit(s)} />
            : <p onClick={() => startEdit(s)} title="Click to edit"
                className="text-sm text-text-faint italic mt-2 leading-relaxed pl-3 cursor-text hover:text-text-muted">Click to add content…</p>}
        </div>
      )}
    </div>
    );
  };

  const cell = "px-3 py-2 text-sm border-t border-[#f1ece3]";
  // Clear click-to-edit affordance: shows a hover tint + text cursor so cells
  // read as editable, and a gold ring when focused.
  const inp = "w-full bg-transparent rounded px-1.5 py-0.5 -mx-1 cursor-text transition-colors hover:bg-[#f3efe7] focus:bg-white focus:ring-1 focus:ring-[#c9a24a] focus:outline-none";

  function saveTable(id: string, d: TableData) { patch(id, { body: JSON.stringify(d) }); }

  // Reusable editable list (Tools or SOP Links)
  // Custom, per-guide label for a block header (Tools / SOP Links). Typed into a
  // local draft and persisted once on blur so it doesn't spawn items per key.
  const blockLabel = (g: string, bk: string, fallback: string) =>
    items.find(i => i.kind === 'blocklabel' && i.guide === g && i.day === bk)?.title || fallback;
  const [hdrDraft, setHdrDraft] = useState<Record<string, string>>({});
  async function saveBlockLabel(g: string, bk: string, text: string) {
    const matches = items.filter(i => i.kind === 'blocklabel' && i.guide === g && i.day === bk);
    if (matches.length) {
      patch(matches[0].id, { title: text });
      for (const extra of matches.slice(1)) remove(extra.id); // clean up any earlier dupes
    } else {
      await add('blocklabel' as Item['kind'], { title: text, day: bk }, g);
    }
  }

  const LinkBlock = ({ kind, title, color, list, placeholder, addGuide }: { kind: 'tool' | 'sop'; title: string; color: string; list: Item[]; placeholder: string; addGuide?: string }) => {
    const g = addGuide ?? guide;
    const hk = `${g}:${kind}`;
    return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2.5 h-6 rounded-full" style={{ background: color }} />
        <input
          value={hdrDraft[hk] ?? blockLabel(g, kind, title)}
          onChange={e => setHdrDraft(d => ({ ...d, [hk]: e.target.value }))}
          onBlur={() => { const v = hdrDraft[hk]; if (v != null) { const t = v.trim() || title; saveBlockLabel(g, kind, t); setHdrDraft(d => { const n = { ...d }; delete n[hk]; return n; }); } }}
          title="Click to rename this header"
          className="text-sm font-bold uppercase tracking-wider bg-transparent rounded px-1 -mx-1 focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#c9a24a] w-56" style={{ color }} />
        {list.length > 0 && (
          <button onClick={() => copyLinksToGuide(kind, list)}
            className="ml-auto text-[11px] font-semibold text-text-muted hover:text-ink border border-border-light rounded-ctrl px-2 py-0.5 hover:bg-canvas"
            title={`Copy these ${title} (with their links) to another guide`}>⧉ Copy to…</button>
        )}
        <button onClick={() => hideBlock(kind === 'tool' ? 'tools' : 'sop')}
          className={`${list.length > 0 ? '' : 'ml-auto'} text-[11px] font-semibold text-litred-alt hover:underline`}
          title="Remove this whole section from this guide (you can restore it)">✕ Remove section</button>
      </div>
      <div className="bg-white border border-border rounded-card p-3 space-y-1">
        {list.map(l => (
          <div key={l.id} className="flex items-center gap-2 px-2 py-1.5 rounded-ctrl hover:bg-canvas group">
            <input value={l.title} onChange={e => patch(l.id, { title: e.target.value })} className="flex-1 bg-transparent text-sm font-medium text-text-primary rounded px-1 -mx-1 cursor-text hover:bg-white focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#c9a24a]" placeholder={placeholder} title="Click to rename" />
            <input value={l.url ?? ''} onChange={e => patch(l.id, { url: e.target.value })} className="w-56 bg-transparent text-sm text-[#3f6b8a] rounded px-1 hover:bg-white focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#c9a24a] border-l border-border-light pl-2" placeholder="paste link (optional)" />
            {l.url && <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#3f6b8a] hover:underline">↗</a>}
            <button onClick={() => remove(l.id)} className="text-xs text-text-muted hover:text-litred-alt opacity-0 group-hover:opacity-100">✕</button>
          </div>
        ))}
        <button onClick={() => add(kind, { title: placeholder }, addGuide)} className="w-full text-left px-2 py-1.5 text-sm font-semibold text-text-muted hover:text-ink">+ Add</button>
      </div>
    </div>
    );
  };

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
    const textToHtml = (str: string) => esc(str)
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" style="color:#3f6b8a">$1</a>')
      .replace(/(?<!href=")(https?:\/\/[^\s<]+)/g, (u: string) => { let l = u.replace(/^https?:\/\//, '').replace(/^www\./, ''); if (l.length > 42) l = l.slice(0, 42) + '…'; return `<a href="${u}" style="color:#3f6b8a">${l} ↗</a>`; })
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    const inlineTableHtml = (headers: string[], rows: string[][]) => `
      <table style="width:100%;border-collapse:collapse;font-size:11px;break-inside:avoid;margin:6px 0 8px">
        <thead><tr style="background:#f0ece4">${headers.map(h => `<th style="text-align:left;padding:5px 8px;color:#8a6d3b;font-size:9px;text-transform:uppercase">${esc(h)}</th>`).join('')}</tr></thead>
        <tbody>${rows.map(r => `<tr style="border-top:1px solid #eee">${r.map(c => `<td style="padding:5px 8px;color:#333">${textToHtml(c) || '—'}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>`;
    const secHtml = secs.map(s => {
      const inner = parseBodyBlocks(s.body).map(b => b.type === 'text'
        ? `<div style="white-space:pre-wrap;font-size:12px;line-height:1.6;color:#333;margin:0 0 6px">${textToHtml(b.text)}</div>`
        : inlineTableHtml(b.headers, b.rows)).join('');
      return `
      <section style="margin:0 0 18px;break-inside:avoid">
        <h2 style="font-size:14px;font-weight:700;color:#1b2a3d;border-left:4px solid #c9a24a;padding-left:10px;margin:0 0 6px">${esc(s.title)}</h2>
        ${inner}
      </section>`;
    }).join('');
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
    const bodyText = (body: string | null) => parseBodyBlocks(body).map(b => b.type === 'text'
      ? b.text
      : [b.headers.join(' | '), ...b.rows.map(r => r.join(' | '))].join('\n')).join('\n\n');
    return `${greeting}\n\n`
      + sections.map(s => `${s.title.toUpperCase()}\n${bodyText(s.body)}`).join('\n\n')
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
  // Blocks the user has removed (hidden) for this guide — restorable.
  const hiddenBlocks = new Set(items.filter(i => i.kind === 'blockhidden' && i.guide === guide).map(i => i.day || ''));
  const BLOCK_LABELS: Record<string, string> = { schedule: 'Schedule', tools: 'Tools', sop: 'SOP Links', tables: 'Tables' };
  async function hideBlock(key: string) {
    if (items.some(i => i.kind === 'blockhidden' && i.guide === guide && i.day === key)) return;
    await add('blockhidden' as Item['kind'], { title: key, day: key }, guide);
  }
  async function restoreBlock(key: string) {
    for (const it of items.filter(i => i.kind === 'blockhidden' && i.guide === guide && i.day === key)) remove(it.id);
  }
  const blockShown: Record<string, boolean> = {
    sections: true,
    schedule: scheduleShown && !hiddenBlocks.has('schedule'),
    tools: !hiddenBlocks.has('tools'),
    sop: !hiddenBlocks.has('sop'),
    tables: !hiddenBlocks.has('tables'),
  };
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
    const sched = list.filter(i => i.kind === 'schedule').sort((a, b) => a.sort_order - b.sort_order);
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
          <span className="text-[11px] text-text-muted font-normal normal-case tracking-normal">— click any cell to edit</span>
          <button onClick={() => hideBlock('schedule')} className="ml-auto text-[11px] font-semibold text-litred-alt hover:underline" title="Remove this schedule from this guide (restorable)">✕ Remove section</button>
        </div>
        <div className="bg-white border border-border rounded-card overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-[#e9f0f5]"><tr>
              {['', 'Date', 'Agenda', 'Assignee', 'Notes', 'Location', ''].map((h, i) => <th key={i} className="text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[#3f6b8a]">{h}</th>)}
            </tr></thead>
            <tbody>
              {sched.map(r => (
                <tr key={r.id}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => reorderSchedule(r.id)}
                  className={`group ${schedDragId === r.id ? 'opacity-40' : ''}`}>
                  <td className={cell + ' w-6 text-center'}>
                    <span draggable onDragStart={() => setSchedDragId(r.id)} onDragEnd={() => setSchedDragId(null)}
                      className="cursor-grab select-none text-text-faint opacity-0 group-hover:opacity-100" title="Drag to reorder">⠿</span>
                  </td>
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
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-6 rounded-full bg-[#8a6d3b]" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#6b5427]">Tables</h2>
          <button onClick={() => hideBlock('tables')} className="ml-auto text-[11px] font-semibold text-litred-alt hover:underline" title="Remove all tables from this guide (restorable)">✕ Remove section</button>
        </div>
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
          <p className="text-sm text-text-muted mt-0.5">{view === 'dashboard' ? 'Track each new hire’s progress; completed people flow into Staffing' : view === 'intake' ? 'Share a link for future hires to fill out their info and upload documents' : view === 'workflow' ? 'The standard hiring & onboarding journey, interview to first check-ins' : 'Edit, add, or remove anything, then send it'}</p>
        </div>
        <div className="flex items-center bg-[#f1ece3] rounded-ctrl p-0.5 ml-4">
          {(['dashboard', 'workflow', 'guides', 'intake'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`text-sm font-semibold px-4 py-1.5 rounded transition-colors ${view === v ? 'bg-white text-ink shadow-sm' : 'text-text-muted hover:text-text-primary'}`}>
              {v === 'dashboard' ? 'Dashboard' : v === 'workflow' ? 'Workflow' : v === 'guides' ? 'Guide Templates' : 'Intake Links'}
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
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setShowReport(true)} className="bg-white border border-border-light text-ink text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-canvas" title="A shareable status summary you can screenshot or download">📄 Status report</button>
            <button onClick={() => { setShowAdd(true); setNewForm({ ...blankNew, guide: guides[0] ?? 'General' }); }} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark">+ Add new hire</button>
          </div>
        )}
      </header>

      {/* Guide selector (guides view only) */}
      {view === 'guides' && (
      <div className="px-8 pt-4 bg-white border-b border-border flex items-center gap-2 flex-wrap flex-shrink-0">
        {applyOrder(guides, guideOrder).map(g => (
          <button key={g} onClick={() => setGuide(g)}
            draggable onDragStart={() => { dragName.current = g; }} onDragOver={e => e.preventDefault()} onDrop={() => dropOnGuide(g)}
            title="Drag to reorder"
            className={`text-sm font-semibold px-4 py-2 rounded-t-ctrl border-b-2 transition-colors cursor-grab active:cursor-grabbing ${guide === g ? 'border-ink text-ink' : 'border-transparent text-text-muted hover:text-text-primary'}`}>
            {g}
          </button>
        ))}
        <button onClick={addGuide} className="text-sm font-semibold px-3 py-2 text-text-muted hover:text-ink">+ New guide</button>
        {composed.length > 0 && <span className="mx-1 text-border-light">|</span>}
        {applyOrder(composed.map(c => c.name), composedOrder).map(name => composed.find(c => c.name === name)!).filter(Boolean).map(c => (
          <button key={c.name} onClick={() => setGuide(c.name)}
            draggable onDragStart={() => { dragName.current = c.name; }} onDragOver={e => e.preventDefault()} onDrop={() => dropOnComposed(c.name)}
            className={`text-sm font-semibold px-4 py-2 rounded-t-ctrl border-b-2 transition-colors cursor-grab active:cursor-grabbing ${guide === c.name ? 'border-ink text-ink' : 'border-transparent text-text-muted hover:text-text-primary'}`}
            title={`Combined: ${c.sources.join(' + ')} · drag to reorder`}>
            👤 {c.name}
          </button>
        ))}
        <button onClick={() => { setNhSources([]); setNhName(''); setShowNewHire(v => !v); }} className="text-sm font-semibold px-3 py-2 text-[#3f6b8a] hover:text-ink">+ New hire (combine)</button>
        {!draftMode && !isComposed && (
          <div className="ml-auto flex items-center gap-3">
            {guide !== 'General' && (
              <button onClick={() => copyGuideFrom('General')} className="text-xs font-semibold text-ink border border-border-light bg-white px-3 py-1.5 rounded-ctrl hover:bg-canvas">⧉ Copy General guide here</button>
            )}
            <button onClick={renameGuide} className="text-xs font-semibold text-ink border border-border-light bg-white px-3 py-1.5 rounded-ctrl hover:bg-canvas">✎ Rename tab</button>
            <button onClick={duplicateGuide} className="text-xs font-semibold text-ink border border-border-light bg-white px-3 py-1.5 rounded-ctrl hover:bg-canvas">⧉ Duplicate</button>
            {guide !== 'General' && (
              <button onClick={deleteGuide} className="text-xs font-semibold text-litred-alt hover:underline">Delete “{guide}” guide</button>
            )}
          </div>
        )}
        {isComposed && composedDef && (
          <div className="ml-auto flex items-center gap-3">
            <button onClick={duplicateGuide} className="text-xs font-semibold text-ink border border-border-light bg-white px-3 py-1.5 rounded-ctrl hover:bg-canvas">⧉ Duplicate</button>
            <button onClick={() => editComposed(composedDef)} className="text-xs font-semibold text-ink border border-border-light bg-white px-3 py-1.5 rounded-ctrl hover:bg-canvas">⚙ Edit combine</button>
            <button onClick={() => deleteComposed(guide)} className="text-xs font-semibold text-litred-alt hover:underline">Remove “{guide}” combined guide</button>
          </div>
        )}
      </div>
      )}

      {view === 'guides' && showNewHire && (
        <div className="px-8 py-4 bg-[#f5f8fb] border-b border-[#d9e4ee] flex-1 min-h-0 overflow-auto">
          <div className="max-w-3xl">
            {/* Sticky header: name + save always visible, no scrolling needed */}
            <div className="sticky top-0 z-10 bg-[#f5f8fb] -mx-1 px-1 pt-1 pb-3 border-b border-[#d9e4ee] mb-3">
              <div className="text-sm font-semibold text-text-primary mb-2">New combined guide</div>
              <div className="flex items-center gap-2 flex-wrap">
                <input value={nhName} onChange={e => setNhName(e.target.value)} placeholder="Name this guide (e.g. Damon)"
                  className="w-64 border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
                <button onClick={createComposed} disabled={!nhName.trim() || !nhSources.length}
                  className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark disabled:opacity-40">Save combined guide</button>
                <button onClick={() => printDoc(combinedInnerHtml(nhSources, nhExclude, nhHeaders, nhName), nhName, nhSources.join(' + '))} disabled={!nhSources.length}
                  className="bg-white border border-border-light text-ink text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-canvas disabled:opacity-40">🖨 Preview PDF</button>
                <button onClick={() => setShowNewHire(false)} className="text-sm text-text-muted px-3">Cancel</button>
              </div>
              {(!nhName.trim() || !nhSources.length) && (
                <p className="text-[11px] text-[#b0412f] mt-1.5">
                  {!nhName.trim() && !nhSources.length ? 'Enter a name and pick at least one guide below to save.'
                    : !nhName.trim() ? 'Enter a name above to save.' : 'Pick at least one guide below to save.'}
                </p>
              )}
            </div>
            <div className="text-xs text-text-muted mb-2">Pick which guides apply:</div>
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

            <div className="flex gap-2 items-center py-2">
              <button onClick={createComposed} disabled={!nhName.trim() || !nhSources.length}
                className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark disabled:opacity-40">Save combined guide</button>
              <span className="text-[11px] text-text-muted">Saving gives it a 👤 tab you can open, edit, and export.</span>
            </div>
          </div>
        </div>
      )}

      {view === 'guides' && draftMode && (
        <div className="px-8 py-2 bg-[#fbf3e6] border-b border-[#e8d5b0] text-xs font-semibold text-[#8a6d3b] flex items-center gap-2 flex-shrink-0">
          ✎ Customize mode — edits and deletions here are <span className="underline">temporary</span> and only affect the PDF/email you export now. Discard when done to keep the saved template unchanged.
        </div>
      )}

      {view === 'intake' && <IntakeLinks />}
      {view === 'workflow' && (() => {
        const STAGE_WF: Record<string, number> = { '': 0, undecided: 0, offer_sent: 4, offer_viewed: 4, offer_accepted: 5, onboarding: 10, complete: 14 };
        const sel = people.find(p => String(p.id) === wfHire) || null;
        const reached = sel ? (sel.status === 'Complete' ? 14 : (STAGE_WF[stageOf(sel)] ?? 0)) : 0;
        // Prefer per-step tracking from the hire's checklist when the workflow
        // steps have been added to it; otherwise fall back to the coarse stage.
        const clTitles = new Set(tasksFor().map((t: any) => String(t.title ?? '').trim()));
        const hasChecklist = !!sel && WORKFLOW.some(s => clTitles.has(s.title));
        const prog: Record<string, any> = sel ? parseProg(sel.progress) : {};
        const currentStep = hasChecklist ? WORKFLOW.filter(s => !s.conditional && clTitles.has(s.title)).find(s => !prog[s.title]) : null;
        const currentN = currentStep?.n ?? null;
        const stageLabel = sel ? (hasChecklist ? (currentStep ? currentStep.title : 'All steps complete') : (STAGES.find(s => s.key === stageOf(sel))?.label ?? 'Not started')) : '';
        return (
        <div className="flex-1 overflow-auto px-8 py-6">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
              <div>
                <h2 className="font-spectral text-[18px] font-semibold text-text-primary">Hiring &amp; onboarding workflow</h2>
                <p className="text-sm text-text-muted mt-0.5">The standard journey every new hire follows. Pick a hire to light up their progress, or add the steps to the onboarding checklist.</p>
              </div>
              <button onClick={addWorkflowToChecklist} disabled={addingWf} className="bg-ink text-white text-sm font-semibold px-3.5 py-2 rounded-ctrl hover:bg-ink-dark disabled:opacity-50 shrink-0">{addingWf ? 'Adding…' : '＋ Add steps to checklist'}</button>
            </div>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Show progress for</span>
              <select value={wfHire} onChange={e => setWfHire(e.target.value)} className="border border-border-light rounded-ctrl px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:border-ink">
                <option value="">— Standard workflow (no hire) —</option>
                {people.filter(p => p.status !== 'Complete').map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
              </select>
              {sel && <span className="text-xs text-text-muted">Currently at: <b className="text-text-secondary">{stageLabel}</b></span>}
              {sel && hasChecklist && currentStep && <button onClick={() => toggleTask(sel, currentStep.title, true)} className="bg-[#2f7d5b] text-white text-xs font-semibold px-3 py-1.5 rounded-ctrl hover:bg-[#276a4d]">✓ Complete “{currentStep.title}” →</button>}
              {sel && hasChecklist && !currentStep && sel.status !== 'Complete' && <button onClick={() => completeOnboardee(sel)} className="bg-ink text-white text-xs font-semibold px-3 py-1.5 rounded-ctrl hover:bg-ink-dark">✓ Mark onboarding complete</button>}
              {sel && (
                <span className="ml-auto flex items-center gap-3 text-[11px] text-text-muted">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#2f7d5b]" />Done</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#c9a24a]" />Current</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#c3bbab]" />Upcoming</span>
                </span>
              )}
            </div>
            <div className="bg-white border border-border rounded-card p-4 overflow-x-auto">
              {(() => {
                const boxW = 300, boxH = 52, rowH = 84, leftX = 30, cx = leftX + boxW / 2;
                const decision = { title: 'Alex’s instruction', sub: 'Meet the partners?', decision: true } as any;
                const branch = WORKFLOW.find(s => s.n === 3)!;
                const col: any[] = [];
                for (const s of WORKFLOW) { if (s.n === 3) continue; col.push(s); if (s.n === 2) col.push(decision); }
                const decIdx = col.findIndex(c => c.decision);
                const yTop = (i: number) => 10 + i * rowH;
                const brX = 420, brW = 260, brCx = brX + brW / 2, brY = yTop(decIdx);
                const width = brX + brW + 10, height = yTop(col.length - 1) + boxH + 12;
                // Per-hire status of each box: done / current / upcoming (or plain when no hire selected).
                const statusOf = (item: any): 'plain' | 'done' | 'current' | 'upcoming' => {
                  if (!sel) return 'plain';
                  if (hasChecklist) {
                    if (item.decision) return prog['Final interview'] ? 'done' : 'upcoming';
                    if (prog[item.title]) return 'done';
                    if (!item.conditional && item.n === currentN) return 'current';
                    return 'upcoming';
                  }
                  if (item.decision) return reached >= 4 ? 'done' : reached >= 3 ? 'current' : 'upcoming';
                  if (item.conditional) return reached >= 4 ? 'done' : 'upcoming';
                  const n = item.n as number;
                  if (n < reached) return 'done';
                  if (n === reached) return 'current';
                  return 'upcoming';
                };
                const box = (x: number, y: number, w: number, item: any) => {
                  const st = statusOf(item);
                  let fill: string, stroke: string, circle: string, tFill = '#1b2a3d', sFill = '#8a8474';
                  if (st === 'plain') { const gold = item.decision || item.conditional; fill = gold ? '#fbf7ee' : '#f4faf6'; stroke = gold ? '#e0c48a' : '#cfe4d8'; circle = item.conditional ? '#c9a24a' : '#1b2a3d'; }
                  else if (st === 'done') { fill = '#eef5f1'; stroke = '#9ccbb2'; circle = '#2f7d5b'; }
                  else if (st === 'current') { fill = '#fff7e6'; stroke = '#c9a24a'; circle = '#c9a24a'; }
                  else { fill = '#f6f4f0'; stroke = '#e6ddcd'; circle = '#c3bbab'; tFill = '#9a9384'; sFill = '#b3ab9c'; }
                  const hasNum = !!item.n, tx = x + (hasNum ? 44 : 16), sw = st === 'current' ? 2 : 1;
                  const clickable = !!sel && hasChecklist && hasNum && clTitles.has(item.title);
                  return (
                    <g key={`${x}-${y}-${item.title}`} onClick={clickable ? () => toggleTask(sel, item.title, !prog[item.title]) : undefined} style={clickable ? { cursor: 'pointer' } : undefined}>
                      {clickable && <title>{prog[item.title] ? 'Click to mark not done' : 'Click to mark done'}</title>}
                      <rect x={x} y={y} width={w} height={boxH} rx={10} fill={fill} stroke={stroke} strokeWidth={sw} strokeDasharray={item.conditional ? '5 4' : undefined} />
                      {hasNum && <><circle cx={x + 24} cy={y + boxH / 2} r={12} fill={circle} />{st === 'done' ? <text x={x + 24} y={y + boxH / 2 + 4} textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">✓</text> : <text x={x + 24} y={y + boxH / 2 + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">{item.n}</text>}</>}
                      <text x={tx} y={y + 22} fontSize="12.5" fontWeight="700" fill={tFill}>{item.title}</text>
                      <text x={tx} y={y + 38} fontSize="10.5" fill={sFill}>{item.sub}</text>
                    </g>
                  );
                };
                return (
                  <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ maxWidth: width, minWidth: 560, display: 'block', margin: '0 auto' }}>
                    <defs><marker id="wf-arrow" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#aeb6c0" /></marker></defs>
                    {col.slice(0, -1).map((_, i) => (
                      <line key={`c${i}`} x1={cx} y1={yTop(i) + boxH} x2={cx} y2={yTop(i + 1)} stroke="#aeb6c0" strokeWidth={1.5} markerEnd="url(#wf-arrow)" />
                    ))}
                    <line x1={leftX + boxW} y1={brY + boxH / 2} x2={brX} y2={brY + boxH / 2} stroke="#aeb6c0" strokeWidth={1.5} markerEnd="url(#wf-arrow)" />
                    <polyline points={`${brCx},${brY + boxH} ${brCx},${brY + boxH + 16} ${cx},${brY + boxH + 16}`} fill="none" stroke="#aeb6c0" strokeWidth={1.5} />
                    {col.map((item, i) => box(leftX, yTop(i), boxW, item))}
                    {box(brX, brY, brW, branch)}
                  </svg>
                );
              })()}
            </div>
            <p className="text-[11px] text-text-muted mt-3 italic">{sel ? (hasChecklist ? 'Click any step to mark it done for this hire, or use “Complete … →” to advance to the next one. ' : 'Highlighting reflects the hire’s onboarding stage — click “Add steps to checklist” to enable click-to-advance step tracking. ') : ''}Stage 3 (Partner 1:1 calls) is conditional — it only happens if the hire is asked to meet the partners, and the flow continues either way.</p>
          </div>
        </div>
        );
      })()}
      {view === 'dashboard' && Dashboard()}

      {view === 'guides' && !showNewHire && isComposed && composedDef && (
      <div ref={scrollRef} onScroll={handleGuideScroll} className="flex-1 overflow-auto px-8 py-6">
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
                    {order.map(k => <div key={k} data-sec={k}>{nodes[k]}</div>)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      )}

      {view === 'guides' && !showNewHire && !isComposed && (
      <div ref={scrollRef} onScroll={handleGuideScroll} className="flex-1 overflow-auto px-8 py-6">
        <div className="max-w-5xl">
          <div className="space-y-6">
            {/* Blocks render in the saved order; hover a block for ▲▼ to move it */}
            {visibleBlocks.map((k, i) => (
              <div key={k} data-sec={k} className="relative group/blk">
                <div className="absolute -top-2 right-1 z-10 flex gap-0.5 opacity-0 group-hover/blk:opacity-100">
                  <button disabled={i === 0} onClick={() => moveBlock(k, -1)} title="Move block up"
                    className="text-xs bg-white border border-border-light rounded px-1.5 py-0.5 text-text-muted hover:text-ink disabled:opacity-25 disabled:cursor-default shadow-sm">▲</button>
                  <button disabled={i === visibleBlocks.length - 1} onClick={() => moveBlock(k, 1)} title="Move block down"
                    className="text-xs bg-white border border-border-light rounded px-1.5 py-0.5 text-text-muted hover:text-ink disabled:opacity-25 disabled:cursor-default shadow-sm">▼</button>
                </div>
                {blockNodes[k]}
              </div>
            ))}
            {[...hiddenBlocks].filter(k => BLOCK_LABELS[k]).length > 0 && (
              <div className="flex items-center gap-2 flex-wrap text-[11px] text-text-muted border-t border-border-light pt-3">
                <span className="font-semibold">Removed sections:</span>
                {[...hiddenBlocks].filter(k => BLOCK_LABELS[k]).map(k => (
                  <button key={k} onClick={() => restoreBlock(k)} className="font-semibold text-[#3f6b8a] hover:underline border border-border-light rounded-ctrl px-2 py-0.5 hover:bg-canvas">↩ Restore {BLOCK_LABELS[k]}</button>
                ))}
              </div>
            )}
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
            {(() => {
              const activeCount = people.filter(p => p.status !== 'Complete').length;
              const hiredCount = people.filter(p => p.status === 'Complete').length;
              return (
                <div className="flex gap-1 bg-canvas border border-border-light rounded-ctrl p-1">
                  <button onClick={() => setDashTab('active')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-ctrl transition-colors ${dashTab === 'active' ? 'bg-ink text-white' : 'text-text-secondary hover:text-text-primary'}`}>
                    Onboarding{activeCount ? ` (${activeCount})` : ''}
                  </button>
                  <button onClick={() => setDashTab('hired')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-ctrl transition-colors ${dashTab === 'hired' ? 'bg-[#2f7d5b] text-white' : 'text-text-secondary hover:text-text-primary'}`}>
                    ✓ Hired{hiredCount ? ` (${hiredCount})` : ''}
                  </button>
                </div>
              );
            })()}
            {(() => {
              const list = people
                .filter(p => dashTab === 'hired' ? p.status === 'Complete' : p.status !== 'Complete')
                .sort((a, b) => {
                  // Soonest start date first; entries without a start date go last.
                  const sa = (a.start_date || '').slice(0, 10), sb = (b.start_date || '').slice(0, 10);
                  if (!sa && !sb) return a.name.localeCompare(b.name);
                  if (!sa) return 1;
                  if (!sb) return -1;
                  return sa.localeCompare(sb);
                });
              if (!list.length) return (
                <div className="text-sm text-text-muted border border-dashed border-border-light rounded-card p-6 text-center">
                  {dashTab === 'hired' ? 'No hires yet — complete an onboarding to move someone here.' : 'No one onboarding yet — click “Add new hire”.'}
                </div>
              );
              return list.map(p => {
              const { done, total, pct } = progressOf(p);
              const complete = p.status === 'Complete';
              return (
                <button key={p.id} onClick={() => setSelected(p.id)}
                  className={`w-full text-left bg-white border rounded-card p-4 transition-colors ${selected === p.id ? 'border-ink' : 'border-border hover:border-border-light'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-text-primary truncate">{p.name}</div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${complete ? 'bg-[#eef5f1] text-[#2f7d5b]' : 'bg-[#f7efe1] text-[#b07d2a]'}`}>{complete ? 'Complete' : `${pct}%`}</span>
                  </div>
                  <div className="text-xs text-text-muted mt-0.5">{p.position || p.worker_type} · {p.guide === 'None' ? 'No guide' : `${p.guide} guide`}</div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {p.tag && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#ede9f5] text-[#6b5b8a]">{p.tag}</span>}
                    {(() => { const st = STAGES.find(s => s.key === stageOf(p)); return st ? (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#eef2f7] text-[#3f5a76]">{st.icon} {st.label}</span>
                    ) : (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#f1ece3] text-text-muted">Not started</span>
                    ); })()}
                  </div>
                  {startLabel(p) ? (
                    <div className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-bold text-[#2f6b45] bg-[#eef5f1] border border-[#cfe4d8] px-2.5 py-1 rounded-ctrl">
                      <span aria-hidden>📅</span><span>{startLabel(p)}</span>
                    </div>
                  ) : (
                    <div className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-text-muted bg-[#f7f4ef] border border-border-light px-2.5 py-1 rounded-ctrl">
                      <span aria-hidden>📅</span><span>No start date set</span>
                    </div>
                  )}
                  <div className="mt-2 h-1.5 bg-[#f1ece3] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: complete ? '#2f7d5b' : '#c9a24a' }} />
                  </div>
                  <div className="text-[11px] text-text-muted mt-1">{done}/{total} tasks</div>
                  {p.note && <div className="text-[12px] text-black mt-2 leading-snug"><span className="font-bold">Notes:</span> {p.note}</div>}
                </button>
              );
            });
            })()}
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
                      <div className="flex gap-2 mt-1.5 text-[11px] flex-wrap items-center">
                        <span className="font-semibold px-2 py-0.5 rounded-full bg-[#eef5f1] text-[#2f7d5b]">{person.worker_type}</span>
                        {person.tag && <span className="font-semibold px-2 py-0.5 rounded-full bg-[#ede9f5] text-[#6b5b8a]">{person.tag}</span>}
                        <span className="font-semibold px-2 py-0.5 rounded-full bg-[#e9f0f5] text-[#3f6b8a]">{person.guide === 'None' ? 'No guide' : `${person.guide} guide`}</span>
                        <span className="font-semibold px-2 py-0.5 rounded-full bg-[#f7efe1] text-[#b07d2a]">{pct}% complete</span>
                      </div>
                    </div>
                    <button onClick={() => deleteOnboardee(person.id)} className="text-xs font-semibold text-litred-alt border border-border-light px-2.5 py-1 rounded-ctrl hover:bg-[#fdeaea]">Remove</button>
                  </div>

                  {/* Hiring journey: offer sent → viewed → accepted → onboarding → hired */}
                  <div className="px-5 py-4 border-b border-border bg-[#faf8f4]">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2.5">Hiring journey{stageOf(person) === '' && <span className="ml-2 font-semibold text-text-faint normal-case tracking-normal">· Not started — pick a stage</span>}</div>
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

                  {/* Key dates + tag — editable inline */}
                  <div className="px-5 py-4 border-b border-border grid grid-cols-3 gap-4 max-w-2xl">
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
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">Tag</label>
                      <select value={person.tag ?? ''} onChange={e => patchOnboardee(person.id, { tag: e.target.value })}
                        className="w-full border border-border-light rounded-ctrl px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:border-ink">
                        <option value="">— none —</option>
                        {TAGS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    {person.tag === 'Re-hire' && (
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">Rehire date</label>
                        <input type="date" value={person.rehire_date ?? ''} onChange={e => patchOnboardee(person.id, { rehire_date: e.target.value })}
                          className="w-full border border-border-light rounded-ctrl px-2.5 py-1.5 text-sm focus:outline-none focus:border-ink" />
                        {person.rehire_date && <p className="text-[11px] text-text-muted mt-1">{fmtDate(person.rehire_date)}</p>}
                      </div>
                    )}
                  </div>

                  {/* HR note — free text, surfaces on the status report */}
                  <div className="px-5 py-4 border-b border-border">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1.5">Notes <span className="font-semibold text-text-faint normal-case tracking-normal">· shows on the status report</span></label>
                    <NoteEditor key={person.id} note={person.note ?? ''} onSave={v => { patchOnboardee(person.id, { note: v }); showToast(v ? 'Note saved' : 'Note deleted'); }} />
                  </div>

                  {/* Plan & To-dos — the user's own tracking list (works for re-hires
                      and anyone skipping the standard guide) */}
                  <div className="px-5 py-4 border-b border-border">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2">Plan &amp; To-dos</div>
                    <div className="space-y-1">
                      {todosOf(person).map(td => (
                        <div key={td.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-ctrl hover:bg-canvas group">
                          <input type="checkbox" checked={td.done} onChange={e => toggleTodo(person, td.id, e.target.checked)} className="w-4 h-4 accent-[#2f7d5b]" />
                          <input value={td.text} onChange={e => editTodo(person, td.id, e.target.value)}
                            className={`flex-1 text-sm bg-transparent focus:outline-none ${td.done ? 'line-through text-text-muted' : 'text-text-primary'}`} />
                          <button onClick={() => removeTodo(person, td.id)} className="text-xs text-text-muted hover:text-litred-alt opacity-0 group-hover:opacity-100">✕</button>
                        </div>
                      ))}
                      {todosOf(person).length === 0 && <p className="text-sm text-text-faint italic px-2 py-1">No items yet — add your plan or to-dos below.</p>}
                    </div>
                    <div className="flex gap-2 mt-2">
                      <input value={newTodo} onChange={e => setNewTodo(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addTodo(person, newTodo); }}
                        placeholder="Add a to-do (e.g. re-activate email, confirm equipment)…"
                        className="flex-1 border border-border-light rounded-ctrl px-3 py-1.5 text-sm focus:outline-none focus:border-ink" />
                      <button onClick={() => addTodo(person, newTodo)} className="bg-ink text-white text-sm font-semibold px-3 py-1.5 rounded-ctrl hover:bg-ink-dark">Add</button>
                    </div>
                  </div>

                  {person.worker_type === 'Contractor' && (
                    <div className="px-5 py-4 border-b border-border bg-[#fbf7ee]">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gold-muted">International contractor — Form W-8BEN</div>
                        {w8Rec && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${w8Rec.status === 'Completed' ? 'bg-[#eef5f1] text-[#2f7d5b]' : 'bg-[#f7efe1] text-[#b07d2a]'}`}>{w8Rec.status === 'Completed' ? 'Completed' : 'Sent — awaiting'}</span>}
                      </div>
                      {!w8Rec ? (
                        <div className="space-y-2">
                          <p className="text-[12px] text-text-muted">Email the official W-8BEN to complete. They fill it online and a finalized, non-editable PDF is sent back to you and to them.</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <input value={w8Email} onChange={e => setW8Email(e.target.value)} placeholder="recipient@email.com" className="flex-1 min-w-[200px] border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
                            <button onClick={() => sendW8ben(person)} disabled={w8Busy || !w8Email.trim()} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark disabled:opacity-50">{w8Busy ? 'Sending…' : '✉ Send W-8BEN'}</button>
                          </div>
                          <p className="text-[10px] text-text-faint">Testing? Put your own email here to preview what the contractor receives.</p>
                        </div>
                      ) : w8Rec.status === 'Completed' ? (
                        <div className="flex items-center gap-3 flex-wrap text-sm">
                          <span className="text-[#2f7d5b] font-semibold">✓ Completed & filed</span>
                          <a href={`/api/onboarding/w8ben?download=${w8Rec.id}`} target="_blank" rel="noopener noreferrer" className="text-[#3f6b8a] font-semibold hover:underline">⤓ Download W-8BEN PDF</a>
                          <button onClick={deleteW8ben} className="text-[11px] text-litred-alt hover:underline ml-auto">Delete</button>
                        </div>
                      ) : (
                        <div className="text-sm space-y-1.5">
                          <div className="text-text-muted">Sent{w8Rec.contractor_email ? ` to ${w8Rec.contractor_email}` : ''} — awaiting their submission.</div>
                          {w8Rec.token && <a href={`/onboarding/w8ben/${w8Rec.token}`} target="_blank" rel="noopener noreferrer" className="text-[#3f6b8a] font-semibold hover:underline break-all">↗ Open the form link (to preview / test)</a>}
                          <div className="flex items-center gap-3 flex-wrap">
                            <button onClick={() => sendW8ben(person)} disabled={w8Busy} className="text-[#3f6b8a] font-semibold hover:underline">🔔 Resend</button>
                            <button onClick={deleteW8ben} className="text-[11px] text-litred-alt hover:underline ml-auto">Delete</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="p-4 space-y-1">
                    <div className="flex items-center justify-between px-2 mb-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Onboarding checklist</div>
                      <span className="text-[10px] text-text-faint">Shared checklist — edits apply to every new hire</span>
                    </div>
                    {(() => {
                      const renderRow = (t: any) => {
                        const isDone = !!prog[t.title];
                        const isHR = (t.owner ?? '') === 'HR';
                        return (
                          <div key={t.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-ctrl hover:bg-canvas group">
                            <input type="checkbox" checked={isDone} onChange={e => toggleTask(person, t.title, e.target.checked)} className="w-4 h-4 accent-[#2f7d5b] shrink-0" />
                            <input value={t.title} onChange={e => patch(t.id, { title: e.target.value })}
                              className={`flex-1 text-sm bg-transparent focus:outline-none ${isDone ? 'line-through text-text-muted' : 'text-text-primary'}`} />
                            <button onClick={() => patch(t.id, { owner: isHR ? '' : 'HR' })} title="Toggle who owns this task"
                              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${isHR ? 'bg-[#e9f0f5] text-[#3f6b8a]' : 'bg-[#eef5f1] text-[#2f7d5b]'}`}>
                              {isHR ? 'HR' : (person.worker_type === 'Contractor' ? 'Contractor' : 'New Hire')}
                            </button>
                            <button onClick={() => remove(t.id)} title="Delete task" className="text-xs text-text-muted hover:text-litred-alt opacity-0 group-hover:opacity-100 shrink-0">✕</button>
                          </div>
                        );
                      };
                      const toolItems = list.filter(t => isToolTitle(t.title));
                      const taskItems = list.filter(t => !isToolTitle(t.title));
                      return (
                        <>
                          <div className="flex items-center justify-between px-2 mt-1 mb-0.5">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-[#6b4f8a]">🧰 Tools {toolItems.length > 0 && <span className="text-text-faint">({toolItems.filter(t => prog[t.title]).length}/{toolItems.length})</span>}</div>
                            <button onClick={addToolsToChecklist} className="text-[11px] font-semibold text-[#3f6b8a] hover:underline">＋ Add setup tools</button>
                          </div>
                          {toolItems.map(renderRow)}
                          {toolItems.length === 0 && <p className="text-xs text-text-faint px-2 py-1">No tools yet — click “Add setup tools” to list Briefcatch, Clio, Dropbox, etc.</p>}
                          <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted px-2 mt-3 mb-0.5">✓ Tasks {taskItems.length > 0 && <span className="text-text-faint">({taskItems.filter(t => prog[t.title]).length}/{taskItems.length})</span>}</div>
                          {taskItems.map(renderRow)}
                          {list.length === 0 && <p className="text-sm text-text-muted px-2 py-2">No checklist items yet.</p>}
                          <button onClick={() => add('task', { title: 'New task', owner: 'HR' }, CHECKLIST_GUIDE)}
                            className="w-full text-left px-2 py-1.5 text-sm font-semibold text-text-muted hover:text-ink">+ Add checklist item</button>
                        </>
                      );
                    })()}
                  </div>
                  <div className="px-5 py-4 border-t border-border flex items-center justify-between gap-3 flex-wrap">
                    <span className="text-sm text-text-muted">{done}/{total} done</span>
                    {person.status === 'Complete' ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-[#2f7d5b]">✓ Hired · in Staffing</span>
                        <a href="/staffing" className="text-sm font-semibold text-ink border border-border-light px-3 py-2 rounded-ctrl hover:bg-canvas">Open in Staffing ↗</a>
                        <button onClick={() => addToStaffing(person)} className="text-xs font-semibold text-text-muted border border-border-light px-3 py-2 rounded-ctrl hover:bg-canvas" title="Re-add if the Staffing record was removed">Re-add to Staffing</button>
                      </div>
                    ) : (
                      <button onClick={() => completeOnboardee(person)} disabled={!allDone}
                        className="bg-[#2f7d5b] text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-[#236045] disabled:opacity-40"
                        title={allDone ? '' : 'Finish all tasks first'}>Mark hired → add to Staffing</button>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Onboarding status report modal */}
        {showReport && (() => {
          const r = buildReport();
          return (
            <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-6 overflow-auto" onClick={() => setShowReport(false)}>
              <div className="bg-white rounded-card w-full max-w-2xl shadow-xl my-4" onClick={e => e.stopPropagation()}>
                <div className="px-6 py-3 border-b border-border flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-text-secondary">Onboarding status report</span>
                  <div className="flex items-center gap-2">
                    <button onClick={copyReportForEmail} className="bg-white border border-border-light text-ink text-xs font-semibold px-3 py-1.5 rounded-ctrl hover:bg-canvas">⧉ Copy for email</button>
                    <button onClick={exportReportExcel} className="bg-white border border-border-light text-ink text-xs font-semibold px-3 py-1.5 rounded-ctrl hover:bg-canvas">⤓ Excel</button>
                    <button onClick={printReport} className="bg-ink text-white text-xs font-semibold px-3 py-1.5 rounded-ctrl hover:bg-ink-dark">⤓ Print / PDF</button>
                    <button onClick={() => setShowReport(false)} className="text-text-muted hover:text-text-primary text-xl leading-none">×</button>
                  </div>
                </div>
                {/* Report body — screenshot-friendly */}
                <div className="px-8 py-8 bg-[#faf8f4]">
                  {/* Litson-branded header banner (navy + gold) */}
                  <div className="rounded-2xl px-7 py-6 mb-6 relative overflow-hidden" style={{ background: '#1b2a3d' }}>
                    <div className="absolute inset-x-0 top-0 h-1" style={{ background: 'linear-gradient(to right, #c9a24a, #e6d3a3 55%, #c9a24a)' }} />
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-spectral text-[22px] font-bold tracking-[0.32em] text-[#c9a24a] leading-none">LITSON</div>
                        <div className="text-[9px] font-semibold uppercase tracking-[0.28em] text-[#9fb0c4] mt-1">PLLC · Human Resources</div>
                        <h2 className="font-spectral text-[25px] font-semibold text-white mt-4 leading-tight">Onboarding status report</h2>
                        <p className="text-[12px] text-[#aebccd] mt-1">Prepared by {r.preparer}</p>
                      </div>
                      <span className="text-[11px] font-medium text-[#e7edf3] whitespace-nowrap border border-white/20 px-3 py-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>As of {r.asOf}</span>
                    </div>
                  </div>

                  {/* Headline stats — gold top accent */}
                  <div className="grid grid-cols-4 gap-3 mb-7">
                    {([['In onboarding', String(r.inOnboarding)], ['Hired', String(r.hiredCount)], ['Tasks complete', `${r.tasksPct}%`], ['Next start date', r.nextStart]] as [string, string][]).map(([l, v]) => (
                      <div key={l} className="bg-white border border-border-light rounded-xl px-4 py-3 shadow-sm" style={{ borderTop: '3px solid #c9a24a' }}>
                        <div className="text-[9.5px] font-bold uppercase tracking-wider text-[#8a8474] mb-1">{l}</div>
                        <div className="text-[22px] font-semibold leading-tight" style={{ color: '#1b2a3d' }}>{v}</div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-4 h-[3px] rounded-full" style={{ background: '#c9a24a' }} />
                    <span className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: '#1b2a3d' }}>Onboarding pipeline</span>
                  </div>

                  {/* One elevated card per person */}
                  <div className="space-y-3.5">
                    {r.rows.length ? r.rows.map(row => {
                      const c = REPORT_STATUS_COLOR[row.status] ?? REPORT_STATUS_COLOR['Not started'];
                      return (
                        <div key={row.id} className="group relative bg-white border border-border-light rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                          <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: c.fg }} />
                          <div className="flex items-start gap-3.5 pl-5 pr-4 py-4">
                            <div className="w-11 h-11 rounded-full text-[13px] font-bold flex items-center justify-center shrink-0" style={{ background: c.bg, color: c.fg }}>{row.initials}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="font-semibold text-[15px] text-text-primary truncate">{row.name}</div>
                                  <div className="text-xs text-text-muted mt-0.5">{row.sub}</div>
                                </div>
                                <span className="text-[11px] font-semibold text-text-secondary whitespace-nowrap bg-[#f7f4ef] border border-border-light px-2.5 py-1 rounded-full shrink-0">{row.start}</span>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap mt-2.5">
                                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full" style={{ background: c.bg, color: c.fg }}>{row.status}</span>
                                <span className="text-[11px] text-text-muted">{row.done}/{row.total} tasks</span>
                                {row.hint && <span className="text-[11px] font-medium text-[#b07d2a]">· {row.hint}</span>}
                              </div>
                              {editNoteId === row.id ? (
                                <div className="mt-3">
                                  <textarea value={noteDraft} onChange={e => setNoteDraft(e.target.value)} rows={2} autoFocus
                                    placeholder="Type a note…"
                                    className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm text-black focus:outline-none focus:border-ink resize-y" />
                                  <div className="flex items-center gap-2 mt-1.5">
                                    <button onClick={() => { patchOnboardee(row.id, { note: noteDraft.trim() }); setEditNoteId(null); showToast('Note saved'); }}
                                      className="bg-ink text-white text-xs font-semibold px-3 py-1 rounded-ctrl hover:bg-ink-dark">Save</button>
                                    <button onClick={() => setEditNoteId(null)} className="text-xs text-text-muted px-2">Cancel</button>
                                    {row.note && (
                                      <button onClick={() => { patchOnboardee(row.id, { note: '' }); setEditNoteId(null); showToast('Note deleted'); }}
                                        className="ml-auto text-xs font-semibold text-litred-alt px-2 hover:underline">Delete</button>
                                    )}
                                  </div>
                                </div>
                              ) : row.note ? (
                                <div className="mt-3 flex items-start gap-2 bg-[#faf8f4] border border-border-light rounded-lg px-3 py-2">
                                  <p className="text-[14px] text-black leading-snug flex-1"><span className="font-bold">Notes:</span> {row.note}</p>
                                  <button onClick={() => { setEditNoteId(row.id); setNoteDraft(row.note); }}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity text-[11px] font-semibold text-[#3f6b8a] hover:underline shrink-0 pt-0.5">Edit</button>
                                </div>
                              ) : (
                                <button onClick={() => { setEditNoteId(row.id); setNoteDraft(''); }}
                                  className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity text-[11px] font-semibold text-[#3f6b8a] hover:underline">＋ Add note</button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }) : (
                      <div className="bg-white border border-border-light rounded-xl px-4 py-10 text-center text-sm text-text-muted">No one is currently onboarding.</div>
                    )}
                  </div>
                  <p className="text-[11px] text-text-faint mt-4">Tip: hover a person to add, edit, or delete their note. Screenshot this card, or use Print / PDF for a clean full-page export.</p>
                </div>
              </div>
            </div>
          );
        })()}

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
                  <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1">Tag</label>
                  <select value={newForm.tag} onChange={e => setNewForm(f => ({ ...f, tag: e.target.value }))} className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm bg-white focus:outline-none focus:border-ink">
                    <option value="">— none —</option>
                    {TAGS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1">Onboarding guide</label>
                  <select value={newForm.guide} onChange={e => setNewForm(f => ({ ...f, guide: e.target.value }))} className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm bg-white focus:outline-none focus:border-ink">
                    {guides.map(g => <option key={g}>{g}</option>)}
                    <option value="None">None (no guide — track with plan/to-dos)</option>
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

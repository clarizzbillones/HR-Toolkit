'use client';
import { useState, useRef } from 'react';
import clsx from 'clsx';
import { useToast } from '@/components/Toast';
import { useUndo } from '@/components/UndoProvider';
import EodModal from '@/components/EodModal';
import EditGate from '@/components/EditGate';

interface Task {
  id: string; title: string; sub: string; due_tag: string; status: string;
  status_history: string; notes: string; created_at: string; completed_date?: string;
}

function pill(status: string) {
  if (status === 'done') return 'bg-[#eef5f1] text-[#2f7d5b]';
  if (status === 'doing') return 'bg-[#e9f0f5] text-[#3f6b8a]';
  return 'bg-[#f7efe1] text-[#b07d2a]';
}
function pillLabel(status: string) {
  if (status === 'done') return 'Done';
  if (status === 'doing') return 'In Progress';
  return 'Pending';
}
function dueDateChip(due: string | null, today: string): { label: string; cls: string } | null {
  if (!due) return null;
  if (due < today) return { label: 'Overdue', cls: 'bg-[#fdeaea] text-[#b0412f]' };
  if (due === today) return { label: 'Due today', cls: 'bg-[#fdeaea] text-[#b0412f]' };
  const d = new Date(due + 'T12:00:00');
  const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return { label, cls: 'bg-[#f7efe1] text-[#b07d2a]' };
}

const COLS = [
  {
    key: 'todo',
    label: 'Not started',
    headColor: '#92826d',
    bg: 'bg-[#f0ece5]',
    cardBorder: 'border-l-[#c0b09a]',
    dot: 'bg-[#c0b09a]',
  },
  {
    key: 'doing',
    label: 'In progress',
    headColor: '#2a5f8a',
    bg: 'bg-[#e8f0f7]',
    cardBorder: 'border-l-[#3f6b8a]',
    dot: 'bg-[#3f6b8a]',
  },
  {
    key: 'done',
    label: 'Completed',
    headColor: '#1f6b4a',
    bg: 'bg-[#e6f3ec]',
    cardBorder: 'border-l-[#2f7d5b]',
    dot: 'bg-[#2f7d5b]',
  },
];

export default function TasksClient({ initialTasks }: { initialTasks: Task[] }) {
  const { showToast } = useToast();
  const { pushUndo } = useUndo();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [view, setView] = useState<'board' | 'list' | 'archived'>('board');
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDue, setNewDue] = useState('');
  const [selected, setSelected] = useState<Task | null>(null);
  const [noteInput, setNoteInput] = useState('');
  const [showEod, setShowEod] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [overrideDate, setOverrideDate] = useState('');
  const [archivedTasks, setArchivedTasks] = useState<Task[]>([]);
  const [archivedDateFilter, setArchivedDateFilter] = useState('');
  const dragId = useRef<string | null>(null);

  const today = overrideDate || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
  const pending = tasks.filter(t => t.status !== 'done' && t.status !== 'archived');
  const done = tasks.filter(t => t.status === 'done');

  function loadArchived() {
    fetch('/api/tasks?status=archived').then(r => r.json()).then(d => setArchivedTasks(d.tasks ?? []));
  }

  const hasChecked = checkedIds.size > 0;

  function toggleCheck(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setCheckedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function clearChecked() { setCheckedIds(new Set()); }
  function selectAll() { setCheckedIds(new Set(tasks.filter(t => t.status !== 'archived').map(t => t.id))); }

  async function addTask() {
    if (!newTitle.trim()) return;
    const res = await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: newTitle, dueTag: newDue || null }) });
    const { task } = await res.json();
    setTasks(prev => [task, ...prev]);
    pushUndo({ label: `Add task "${task.title}"`, req: { url: `/api/tasks/${task.id}`, method: 'DELETE' } });
    setNewTitle('');
    setNewDue('');
    setShowAdd(false);
    showToast('Task added');
  }

  async function updateStatus(id: string, status: string) {
    const res = await fetch(`/api/tasks/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    const { task } = await res.json();
    if (status === 'archived') {
      setTasks(prev => prev.filter(t => t.id !== id));
      if (selected?.id === id) setSelected(null);
    } else {
      setTasks(prev => prev.map(t => t.id === id ? task : t));
      if (selected?.id === id) setSelected(task);
    }
  }

  async function bulkMove(status: string) {
    await Promise.all([...checkedIds].map(id => updateStatus(id, status)));
    clearChecked();
    showToast(`Moved ${checkedIds.size} task${checkedIds.size > 1 ? 's' : ''}`);
  }

  async function bulkDelete() {
    const ids = [...checkedIds];
    const removed = tasks.filter(t => ids.includes(t.id));
    await Promise.all(ids.map(id => fetch(`/api/tasks/${id}`, { method: 'DELETE' })));
    setTasks(prev => prev.filter(t => !ids.includes(t.id)));
    removed.forEach(t => pushUndo({ label: `Delete task "${t.title}"`, req: { url: '/api/tasks', method: 'POST', body: { title: t.title, sub: t.sub, dueTag: t.due_tag } } }));
    clearChecked();
    showToast(`Deleted ${ids.length} task${ids.length > 1 ? 's' : ''}`);
  }

  async function updateTitle(id: string, title: string) {
    if (!title.trim()) return;
    const res = await fetch(`/api/tasks/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) });
    const { task } = await res.json();
    setTasks(prev => prev.map(t => t.id === id ? task : t));
    if (selected?.id === id) setSelected(task);
  }

  async function updateDueDate(id: string, due: string) {
    const res = await fetch(`/api/tasks/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ due_tag: due || null }) });
    const { task } = await res.json();
    setTasks(prev => prev.map(t => t.id === id ? task : t));
    if (selected?.id === id) setSelected(task);
  }

  async function addNote(id: string) {
    if (!noteInput.trim()) return;
    const res = await fetch(`/api/tasks/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note: noteInput }) });
    const { task } = await res.json();
    setTasks(prev => prev.map(t => t.id === id ? task : t));
    setSelected(task);
    setNoteInput('');
    showToast('Note added');
  }

  async function deleteTask(id: string) {
    const t = tasks.find(x => x.id === id);
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    setTasks(prev => prev.filter(x => x.id !== id));
    setSelected(null);
    if (t) pushUndo({ label: `Delete task "${t.title}"`, req: { url: '/api/tasks', method: 'POST', body: { title: t.title, sub: t.sub, dueTag: t.due_tag } } });
    showToast('Task deleted — Ctrl+Z to undo');
  }

  function onDragStart(id: string) { dragId.current = id; }
  function onDrop(status: string) {
    if (dragId.current) updateStatus(dragId.current, status);
    dragId.current = null;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <header className="flex items-center gap-4 px-8 py-5 bg-white border-b border-border flex-shrink-0 flex-wrap">
        <div>
          <h1 className="font-spectral text-[23px] font-semibold text-text-primary">Open HR Tasks</h1>
          <p className="text-sm text-text-muted mt-0.5">{view === 'archived' ? `${archivedTasks.length} archived tasks` : `${pending.length} open · ${done.length} completed today`}</p>
        </div>
        <div className="ml-auto flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-text-muted font-semibold">Date</span>
            <input type="date" value={overrideDate} onChange={e => setOverrideDate(e.target.value)}
              className="border border-border-light rounded-ctrl px-2.5 py-2 text-sm bg-white focus:outline-none focus:border-ink" />
            {overrideDate && <button onClick={() => setOverrideDate('')} className="text-xs text-text-muted hover:text-text-primary font-semibold">Today</button>}
          </div>
          <div className="flex gap-1 bg-[#f1ece3] p-1 rounded-ctrl">
            <button onClick={() => setView('board')} className={clsx('px-3 py-1.5 rounded text-sm font-medium transition-colors', view === 'board' ? 'bg-white text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary')}>Board</button>
            <button onClick={() => setView('list')} className={clsx('px-3 py-1.5 rounded text-sm font-medium transition-colors', view === 'list' ? 'bg-white text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary')}>List</button>
            <button onClick={() => { setView('archived'); loadArchived(); }} className={clsx('px-3 py-1.5 rounded text-sm font-medium transition-colors', view === 'archived' ? 'bg-white text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary')}>Archived</button>
          </div>
          <EditGate><button onClick={() => setShowAdd(v => !v)} className="bg-white border border-border-light text-ink text-sm font-semibold px-4 py-2.5 rounded-ctrl hover:bg-canvas transition-colors">＋ Add task</button></EditGate>
          <button onClick={() => setShowEod(true)} className="bg-ink text-white text-sm font-semibold px-4 py-2.5 rounded-ctrl hover:bg-ink-dark transition-colors">Generate EOD Report</button>
        </div>
      </header>

      {showAdd && (
        <div className="flex gap-2.5 items-center px-8 py-3.5 bg-warm-deep border-b border-border flex-shrink-0 flex-wrap">
          <input
            value={newTitle} onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTask()}
            placeholder="New task title — press Enter to add…"
            className="flex-1 min-w-48 border border-border-light rounded-ctrl px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-ink"
            autoFocus
          />
          <input type="date" value={newDue} onChange={e => setNewDue(e.target.value)}
            className="border border-border-light rounded-ctrl px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-ink bg-white" />
          <button onClick={addTask} className="bg-ink text-white text-sm font-semibold px-4 py-2.5 rounded-ctrl">Add</button>
        </div>
      )}

      {/* Bulk action bar */}
      <div className={clsx('flex items-center gap-3 px-8 py-2.5 bg-[#1a2233] text-white flex-shrink-0 flex-wrap transition-all', hasChecked ? 'opacity-100' : 'opacity-0 pointer-events-none h-0 py-0 overflow-hidden')}>
        <span className="text-sm font-semibold">{checkedIds.size} selected</span>
        <span className="text-white/30 text-sm">·</span>
        <span className="text-xs text-white/60 font-medium">Move to:</span>
        {COLS.map(col => (
          <button key={col.key} onClick={() => bulkMove(col.key)}
            className="text-xs font-semibold px-3 py-1.5 rounded-full border border-white/20 hover:bg-white/10 transition-colors">
            {col.label}
          </button>
        ))}
        <button onClick={() => bulkMove('archived')}
          className="text-xs font-semibold px-3 py-1.5 rounded-full border border-[#c9a24a]/60 text-[#c9a24a] hover:bg-[#c9a24a]/10 transition-colors">
          Archive
        </button>
        <button onClick={bulkDelete}
          className="text-xs font-semibold px-3 py-1.5 rounded-full bg-[#b0412f]/80 hover:bg-[#b0412f] transition-colors ml-1">
          Delete
        </button>
        <button onClick={clearChecked} className="ml-auto text-xs text-white/50 hover:text-white/80 transition-colors">
          ✕ Clear
        </button>
      </div>

      {/* Board */}
      {view === 'board' && (
        <div className="flex-1 overflow-auto p-8">
          <div className="grid grid-cols-3 gap-4 items-start">
            {COLS.map(col => {
              const colTasks = tasks.filter(t => t.status === col.key);
              return (
                <div
                  key={col.key}
                  className={clsx('rounded-xl p-3.5 flex flex-col gap-2.5 min-h-48', col.bg)}
                  onDrop={() => onDrop(col.key)}
                  onDragOver={e => e.preventDefault()}
                >
                  {(() => {
                    const allChecked = colTasks.length > 0 && colTasks.every(t => checkedIds.has(t.id));
                    const someChecked = colTasks.some(t => checkedIds.has(t.id));
                    return (
                      <div className="flex items-center gap-2 px-1 pb-1 border-b border-black/5">
                        <button
                          onClick={() => {
                            setCheckedIds(prev => {
                              const next = new Set(prev);
                              if (allChecked) { colTasks.forEach(t => next.delete(t.id)); }
                              else { colTasks.forEach(t => next.add(t.id)); }
                              return next;
                            });
                          }}
                          className={clsx('w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all',
                            allChecked ? 'border-transparent' : someChecked ? 'border-transparent' : 'border-black/20 hover:border-black/40'
                          )}
                          style={allChecked || someChecked ? { backgroundColor: col.headColor, borderColor: col.headColor } : {}}
                          title={allChecked ? 'Deselect all' : 'Select all'}
                        >
                          {allChecked && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5"><polyline points="5 12 10 17 19 7"/></svg>}
                          {!allChecked && someChecked && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>}
                        </button>
                        <span className="text-sm font-bold" style={{ color: col.headColor }}>{col.label}</span>
                        <span className="ml-auto text-xs font-bold px-1.5 py-0.5 rounded-full bg-black/8 text-black/40">{colTasks.length}</span>
                      </div>
                    );
                  })()}
                  {colTasks.map(t => {
                    const notesArr = JSON.parse(t.notes || '[]');
                    const isChecked = checkedIds.has(t.id);
                    return (
                      <div
                        key={t.id}
                        draggable
                        onDragStart={() => onDragStart(t.id)}
                        onClick={() => !hasChecked && setSelected(t)}
                        className={clsx(
                          'group bg-white border rounded-[10px] px-3.5 py-3 shadow-sm hover:shadow-card transition-all border-l-4',
                          col.cardBorder,
                          isChecked ? 'ring-2 ring-[#3f6b8a] ring-offset-1' : 'border-[#e6e0d5]',
                          hasChecked ? 'cursor-pointer' : 'cursor-pointer'
                        )}
                      >
                        <div className="flex items-start gap-2.5">
                          {/* Checkbox */}
                          <button
                            onClick={e => toggleCheck(t.id, e)}
                            className={clsx(
                              'flex-shrink-0 mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center transition-all',
                              isChecked
                                ? 'bg-[#3f6b8a] border-[#3f6b8a]'
                                : 'border-[#c0b9aa] bg-white opacity-0 group-hover:opacity-100'
                            )}
                          >
                            {isChecked && (
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5"><polyline points="5 12 10 17 19 7"/></svg>
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-text-primary font-semibold leading-snug">{t.title}</div>
                            {t.sub && <div className="text-xs text-text-muted mt-0.5">{t.sub}</div>}
                            <div className="flex items-center gap-2 mt-2">
                              {(() => { const c = dueDateChip(t.due_tag, today); return c ? <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${c.cls}`}>{c.label}</span> : null; })()}
                              {notesArr.length > 0 && <span className="text-xs text-text-muted flex items-center gap-1">📝 {notesArr.length}</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {colTasks.length === 0 && (
                    <div className="text-xs text-center text-black/25 py-6 italic">Drop tasks here</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* List */}
      {view === 'list' && (
        <div className="flex-1 overflow-auto px-8 py-6 max-w-3xl w-full">
          <div className="text-xs font-bold tracking-widest uppercase text-gold-muted mb-2.5">Pending</div>
          <div className="bg-white border border-border rounded-card overflow-hidden mb-6">
            {pending.map(t => {
              const notesArr = JSON.parse(t.notes || '[]');
              const isChecked = checkedIds.has(t.id);
              return (
                <div key={t.id} className={clsx('group flex items-start gap-3.5 px-4.5 py-4 border-b border-[#f1ece3] last:border-0', isChecked && 'bg-[#f0f5fa]')}>
                  <button
                    onClick={e => toggleCheck(t.id, e)}
                    className={clsx('w-5 h-5 rounded-md border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-all',
                      isChecked ? 'bg-[#3f6b8a] border-[#3f6b8a]' : 'border-[#c0b9aa] hover:border-ink'
                    )}
                  >
                    {isChecked && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5"><polyline points="5 12 10 17 19 7"/></svg>}
                  </button>
                  <div onClick={() => setSelected(t)} className="flex-1 cursor-pointer">
                    <div className="text-sm text-text-primary font-medium">{t.title}</div>
                    {t.sub && <div className="text-xs text-text-muted mt-0.5">{t.sub}</div>}
                  </div>
                  {notesArr.length > 0 && <span className="text-xs text-text-muted self-center">📝 {notesArr.length}</span>}
                  {(() => { const c = dueDateChip(t.due_tag, today); return c ? <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${c.cls}`}>{c.label}</span> : null; })()}
                </div>
              );
            })}
            {pending.length === 0 && <div className="px-4.5 py-4 text-sm text-text-muted">No pending tasks</div>}
          </div>
          <div className="text-xs font-bold tracking-widest uppercase text-gold-muted mb-2.5">Completed today</div>
          <div className="bg-white border border-border rounded-card overflow-hidden">
            {done.map(t => {
              const isChecked = checkedIds.has(t.id);
              return (
                <div key={t.id} className={clsx('group flex items-center gap-3.5 px-4.5 py-3.5 border-b border-[#f1ece3] last:border-0', isChecked && 'bg-[#f0f5fa]')}>
                  <button
                    onClick={e => toggleCheck(t.id, e)}
                    className={clsx('w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-all',
                      isChecked ? 'bg-[#3f6b8a] border-[#3f6b8a]' : 'bg-[#2f7d5b] border-[#2f7d5b]'
                    )}
                  >
                    {isChecked
                      ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5"><polyline points="5 12 10 17 19 7"/></svg>
                      : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="5 12 10 17 19 7"/></svg>
                    }
                  </button>
                  <div onClick={() => setSelected(t)} className="flex-1 text-sm text-text-muted line-through cursor-pointer">{t.title}</div>
                </div>
              );
            })}
            {done.length === 0 && <div className="px-4.5 py-4 text-sm text-text-muted">None yet today</div>}
          </div>
        </div>
      )}

      {/* Task detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={e => e.target === e.currentTarget && setSelected(null)}>
          <div className="bg-white rounded-card w-full max-w-lg shadow-xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-5 border-b border-border flex items-start gap-3">
              <div className="flex-1">
                <input
                  key={selected.id}
                  defaultValue={selected.title}
                  onBlur={e => { if (e.target.value.trim() && e.target.value.trim() !== selected.title) updateTitle(selected.id, e.target.value); }}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  className="w-full font-semibold text-text-primary bg-transparent border border-transparent hover:border-border-light focus:border-ink rounded-ctrl px-2 py-1 -mx-2 focus:outline-none"
                />
                {selected.sub && <div className="text-sm text-text-muted mt-0.5 px-0.5">{selected.sub}</div>}
              </div>
              <button onClick={() => setSelected(null)} className="text-text-muted hover:text-text-primary text-xl leading-none">×</button>
            </div>
            <div className="overflow-auto flex-1 p-6">
              <div className="mb-5">
                <div className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2">Due Date</div>
                <input type="date" defaultValue={selected.due_tag || ''} onBlur={e => updateDueDate(selected.id, e.target.value)}
                  className="border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink bg-white" />
                {selected.due_tag && (
                  <button onClick={() => updateDueDate(selected.id, '')} className="ml-2 text-xs text-text-muted hover:text-litred-alt">Clear</button>
                )}
              </div>

              <div className="mb-5">
                <div className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2">Status</div>
                <div className="flex gap-2">
                  {[['todo','Not started'],['doing','In progress'],['done','Done']].map(([s,l]) => (
                    <button key={s} onClick={() => updateStatus(selected.id, s)} className={clsx('text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors', selected.status === s ? pill(s) + ' border-transparent' : 'border-border text-text-secondary hover:bg-canvas')}>{l}</button>
                  ))}
                </div>
              </div>
              <div className="mb-5">
                <div className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2">Status History</div>
                {JSON.parse(selected.status_history || '[]').map((h: any, i: number) => (
                  <div key={i} className="text-sm text-text-secondary py-1 border-b border-[#f1ece3] last:border-0">
                    Moved to <span className={`font-semibold ${pill(h.status)} px-2 py-0.5 rounded-full text-xs`}>{pillLabel(h.status)}</span> — {new Date(h.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </div>
                ))}
              </div>
              <div className="mb-5">
                <div className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2">Notes</div>
                {JSON.parse(selected.notes || '[]').map((n: any, i: number) => (
                  <div key={i} className="text-sm py-2 border-b border-[#f1ece3] last:border-0">
                    <span className="text-xs text-text-muted mr-2">{n.date}</span>{n.text}
                  </div>
                ))}
                <div className="flex gap-2 mt-2.5">
                  <input value={noteInput} onChange={e => setNoteInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addNote(selected.id)} placeholder="Add a note…" className="flex-1 border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
                  <button onClick={() => addNote(selected.id)} className="bg-ink text-white text-sm font-semibold px-3 py-2 rounded-ctrl">Add</button>
                </div>
              </div>
              <button onClick={() => deleteTask(selected.id)} className="text-sm text-litred-alt font-semibold hover:underline">Delete task</button>
            </div>
          </div>
        </div>
      )}

      {/* Archived view */}
      {view === 'archived' && (
        <div className="flex-1 overflow-auto px-8 py-6 max-w-3xl w-full">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-bold text-text-muted uppercase tracking-widest">Filter by date</span>
            <input type="date" value={archivedDateFilter} onChange={e => setArchivedDateFilter(e.target.value)}
              className="border border-border-light rounded-ctrl px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:border-ink" />
            {archivedDateFilter && <button onClick={() => setArchivedDateFilter('')} className="text-xs text-text-muted hover:text-text-primary font-semibold">Clear</button>}
          </div>
          {(() => {
            const filtered = archivedDateFilter
              ? archivedTasks.filter(t => t.completed_date === archivedDateFilter)
              : archivedTasks;
            if (filtered.length === 0) return <div className="text-sm text-text-muted">No archived tasks{archivedDateFilter ? ' for this date' : ''}.</div>;
            // Group by completed_date
            const groups: Record<string, Task[]> = {};
            for (const t of filtered) {
              const key = t.completed_date || 'Unknown';
              if (!groups[key]) groups[key] = [];
              groups[key].push(t);
            }
            return Object.entries(groups).sort(([a],[b]) => b.localeCompare(a)).map(([date, ts]) => (
              <div key={date} className="mb-6">
                <div className="text-xs font-bold tracking-widest uppercase text-gold-muted mb-2">{date === 'Unknown' ? 'Unknown date' : new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div>
                <div className="bg-white border border-border rounded-card overflow-hidden">
                  {ts.map(t => (
                    <div key={t.id} className="flex items-center gap-3.5 px-4.5 py-3.5 border-b border-[#f1ece3] last:border-0">
                      <div className="w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center bg-[#c0b09a] border-[#c0b09a]">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="5 12 10 17 19 7"/></svg>
                      </div>
                      <div className="flex-1 text-sm text-text-muted line-through">{t.title}</div>
                      {t.due_tag && <span className="text-xs text-text-muted">{t.due_tag}</span>}
                    </div>
                  ))}
                </div>
              </div>
            ));
          })()}
        </div>
      )}

      {showEod && <EodModal onClose={() => setShowEod(false)} />}
    </div>
  );
}

'use client';
import { useState, useRef } from 'react';
import clsx from 'clsx';
import { useToast } from '@/components/Toast';
import EodModal from '@/components/EodModal';
import EditGate from '@/components/EditGate';

interface Task {
  id: string; title: string; sub: string; due_tag: string; status: string;
  status_history: string; notes: string; created_at: string;
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
function tagStyle(tag: string | null) {
  if (!tag) return null;
  const c = tag === 'Today' ? '#b0412f' : '#8b8478';
  return `text-xs font-semibold rounded-full px-2 py-0.5 ${tag === 'Today' ? 'bg-[#fdeaea] text-[#b0412f]' : 'bg-[#f1ece3] text-[#8b8478]'}`;
}

export default function TasksClient({ initialTasks }: { initialTasks: Task[] }) {
  const { showToast } = useToast();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [view, setView] = useState<'board' | 'list'>('board');
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [selected, setSelected] = useState<Task | null>(null);
  const [noteInput, setNoteInput] = useState('');
  const [showEod, setShowEod] = useState(false);
  const dragId = useRef<string | null>(null);

  const pending = tasks.filter(t => t.status !== 'done');
  const done = tasks.filter(t => t.status === 'done');
  const todayDate = new Date().toLocaleDateString('en-US');

  async function addTask() {
    if (!newTitle.trim()) return;
    const res = await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: newTitle }) });
    const { task } = await res.json();
    setTasks(prev => [task, ...prev]);
    setNewTitle('');
    setShowAdd(false);
    showToast('Task added');
  }

  async function updateStatus(id: string, status: string) {
    const res = await fetch(`/api/tasks/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
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
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    setTasks(prev => prev.filter(t => t.id !== id));
    setSelected(null);
    showToast('Task deleted');
  }

  const boardCols = [
    { key: 'todo', label: 'Not started', headColor: '#8b8478' },
    { key: 'doing', label: 'In progress', headColor: '#3f6b8a' },
    { key: 'done', label: 'Completed', headColor: '#2f7d5b' },
  ];

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
          <p className="text-sm text-text-muted mt-0.5">{pending.length} open · {done.length} completed today</p>
        </div>
        <div className="ml-auto flex items-center gap-2.5 flex-wrap">
          <div className="flex gap-1 bg-[#f1ece3] p-1 rounded-ctrl">
            <button onClick={() => setView('board')} className={clsx('px-3 py-1.5 rounded text-sm font-medium transition-colors', view === 'board' ? 'bg-white text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary')}>Board</button>
            <button onClick={() => setView('list')} className={clsx('px-3 py-1.5 rounded text-sm font-medium transition-colors', view === 'list' ? 'bg-white text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary')}>List</button>
          </div>
          <EditGate><button onClick={() => setShowAdd(v => !v)} className="bg-white border border-border-light text-ink text-sm font-semibold px-4 py-2.5 rounded-ctrl hover:bg-canvas transition-colors">＋ Add task</button></EditGate>
          <button onClick={() => setShowEod(true)} className="bg-ink text-white text-sm font-semibold px-4 py-2.5 rounded-ctrl hover:bg-ink-dark transition-colors">Generate EOD Report</button>
        </div>
      </header>

      {showAdd && (
        <div className="flex gap-2.5 items-center px-8 py-3.5 bg-warm-deep border-b border-border flex-shrink-0">
          <input
            value={newTitle} onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTask()}
            placeholder="New task title — press Enter to add…"
            className="flex-1 max-w-xl border border-border-light rounded-ctrl px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-ink"
            autoFocus
          />
          <button onClick={addTask} className="bg-ink text-white text-sm font-semibold px-4 py-2.5 rounded-ctrl">Add</button>
        </div>
      )}

      {/* Board */}
      {view === 'board' && (
        <div className="flex-1 overflow-auto p-8">
          <div className="grid grid-cols-3 gap-4 items-start">
            {boardCols.map(col => {
              const colTasks = tasks.filter(t => t.status === col.key);
              return (
                <div
                  key={col.key}
                  className="bg-[#f1ece3] rounded-xl p-3.5 flex flex-col gap-2.5 min-h-48"
                  onDrop={() => onDrop(col.key)}
                  onDragOver={e => e.preventDefault()}
                >
                  <div className="flex items-center px-1">
                    <span className="text-sm font-bold" style={{ color: col.headColor }}>{col.label}</span>
                    <span className="ml-auto text-xs text-text-muted font-semibold">{colTasks.length}</span>
                  </div>
                  {colTasks.map(t => {
                    const notesArr = JSON.parse(t.notes || '[]');
                    return (
                      <div
                        key={t.id}
                        draggable
                        onDragStart={() => onDragStart(t.id)}
                        onClick={() => setSelected(t)}
                        className="bg-white border border-[#e6e0d5] rounded-[10px] px-3.5 py-3 cursor-pointer shadow-sm hover:shadow-card transition-shadow"
                      >
                        <div className="text-sm text-text-primary font-semibold leading-snug">{t.title}</div>
                        {t.sub && <div className="text-xs text-text-muted mt-0.5">{t.sub}</div>}
                        <div className="flex items-center gap-2 mt-2.5">
                          {t.due_tag && <span className={tagStyle(t.due_tag) ?? ''}>{t.due_tag}</span>}
                          {notesArr.length > 0 && <span className="text-xs text-text-muted flex items-center gap-1">📝 {notesArr.length}</span>}
                        </div>
                      </div>
                    );
                  })}
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
              return (
                <div key={t.id} className="flex items-start gap-3.5 px-4.5 py-4 border-b border-[#f1ece3] last:border-0">
                  <button onClick={() => updateStatus(t.id, 'done')} className="w-5 h-5 rounded-md border-2 border-[#c0b9aa] flex-shrink-0 mt-0.5 hover:border-ink transition-colors" />
                  <div onClick={() => setSelected(t)} className="flex-1 cursor-pointer">
                    <div className="text-sm text-text-primary font-medium">{t.title}</div>
                    {t.sub && <div className="text-xs text-text-muted mt-0.5">{t.sub}</div>}
                  </div>
                  {notesArr.length > 0 && <span className="text-xs text-text-muted self-center">📝 {notesArr.length}</span>}
                  {t.due_tag && <span className={tagStyle(t.due_tag) ?? ''}>{t.due_tag}</span>}
                </div>
              );
            })}
            {pending.length === 0 && <div className="px-4.5 py-4 text-sm text-text-muted">No pending tasks</div>}
          </div>
          <div className="text-xs font-bold tracking-widest uppercase text-gold-muted mb-2.5">Completed today</div>
          <div className="bg-white border border-border rounded-card overflow-hidden">
            {done.map(t => (
              <div key={t.id} className="flex items-center gap-3.5 px-4.5 py-3.5 border-b border-[#f1ece3] last:border-0">
                <div className="w-5 h-5 rounded-md bg-[#2f7d5b] flex items-center justify-center flex-shrink-0">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="5 12 10 17 19 7"/></svg>
                </div>
                <div onClick={() => setSelected(t)} className="flex-1 text-sm text-text-muted line-through cursor-pointer">{t.title}</div>
              </div>
            ))}
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
                <div className="font-semibold text-text-primary">{selected.title}</div>
                {selected.sub && <div className="text-sm text-text-muted mt-0.5">{selected.sub}</div>}
              </div>
              <button onClick={() => setSelected(null)} className="text-text-muted hover:text-text-primary text-xl leading-none">×</button>
            </div>
            <div className="overflow-auto flex-1 p-6">
              {/* Status switcher */}
              <div className="mb-5">
                <div className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2">Status</div>
                <div className="flex gap-2">
                  {[['todo','Not started'],['doing','In progress'],['done','Done']].map(([s,l]) => (
                    <button key={s} onClick={() => updateStatus(selected.id, s)} className={clsx('text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors', selected.status === s ? pill(s) + ' border-transparent' : 'border-border text-text-secondary hover:bg-canvas')}>{l}</button>
                  ))}
                </div>
              </div>

              {/* History */}
              <div className="mb-5">
                <div className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2">Status History</div>
                {JSON.parse(selected.status_history || '[]').map((h: any, i: number) => (
                  <div key={i} className="text-sm text-text-secondary py-1 border-b border-[#f1ece3] last:border-0">
                    Moved to <span className={`font-semibold ${pill(h.status)} px-2 py-0.5 rounded-full text-xs`}>{pillLabel(h.status)}</span> — {new Date(h.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </div>
                ))}
              </div>

              {/* Notes */}
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

      {showEod && <EodModal onClose={() => setShowEod(false)} />}
    </div>
  );
}

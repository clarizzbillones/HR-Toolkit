'use client';
import { useEffect, useState } from 'react';
import { useToast } from './Toast';

interface Task {
  id: string; title: string; sub: string; due_tag: string; status: string; notes: string;
}

export default function EodModal({ onClose }: { onClose: () => void }) {
  const { showToast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState('');
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  useEffect(() => {
    fetch('/api/tasks').then(r => r.json()).then(d => setTasks(d.tasks ?? []));
  }, []);

  const done = tasks.filter(t => t.status === 'done');
  const pending = tasks.filter(t => t.status !== 'done');

  function statusPill(status: string) {
    if (status === 'done') return 'bg-[#eef5f1] text-[#2f7d5b]';
    if (status === 'doing') return 'bg-[#e9f0f5] text-[#3f6b8a]';
    return 'bg-[#f7efe1] text-[#b07d2a]';
  }
  function statusLabel(status: string) {
    if (status === 'done') return 'Done';
    if (status === 'doing') return 'In Progress';
    return 'Pending';
  }

  function printPdf() {
    window.print();
  }

  async function sendPartners() {
    const res = await fetch('/api/tasks/eod-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    });
    const d = await res.json();
    showToast(d.message ?? 'Report sent');
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-card w-full max-w-3xl max-h-[92vh] flex flex-col shadow-xl overflow-hidden no-print">
        {/* Letterhead */}
        <div
          className="px-8 py-6 flex items-center justify-between flex-shrink-0"
          style={{ background: 'linear-gradient(120deg,#1b2a3d,#26405c)', borderBottom: '4px solid #c9a24a' }}
        >
          <div>
            <div className="font-spectral text-2xl font-bold tracking-widest text-white">LITSON</div>
            <div className="text-xs tracking-widest text-gold mt-0.5">ATTORNEYS AT LAW · NASHVILLE, TENNESSEE</div>
          </div>
          <div className="text-right text-xs text-[#cdd7e2] leading-relaxed">
            End-of-Day Report<br />{today}
          </div>
        </div>

        <div className="overflow-auto flex-1 p-7">
          {/* Stat cards */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            <StatCard label="Tasks Done" value={done.length} color="#2f7d5b" bg="#eef5f1" />
            <StatCard label="Pending" value={pending.length} color="#b07d2a" bg="#f7efe1" />
            <StatCard label="On PTO" value="—" color="#3f6b8a" bg="#e9f0f5" />
            <StatCard label="Open Items" value={pending.length} color="#b0412f" bg="#fdeaea" />
          </div>

          {/* Task table */}
          <div className="mb-6">
            <div className="grid grid-cols-[2fr_1fr_1fr_2fr] gap-2 py-2 border-b border-border-warm text-[10px] uppercase tracking-wider text-text-faint font-bold">
              <div>Task</div><div>Status</div><div>Due</div><div>Notes</div>
            </div>
            {tasks.map((t) => {
              const taskNotes = JSON.parse(t.notes || '[]') as {text:string}[];
              return (
                <div key={t.id} className="grid grid-cols-[2fr_1fr_1fr_2fr] gap-2 py-2.5 border-b border-[#f4efe6] items-start">
                  <div>
                    <div className="text-sm text-text-primary font-medium">{t.title}</div>
                    {t.sub && <div className="text-xs text-text-muted mt-0.5">{t.sub}</div>}
                  </div>
                  <div><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusPill(t.status)}`}>{statusLabel(t.status)}</span></div>
                  <div className="text-xs text-text-secondary">{t.due_tag || '—'}</div>
                  <div className="text-xs text-text-secondary">{taskNotes.map(n=>n.text).join('; ') || '—'}</div>
                </div>
              );
            })}
          </div>

          {/* Notes for reviewer */}
          <div className="mb-4">
            <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Notes for reviewer</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add any additional context for Catie or Ryan…"
              className="w-full h-24 border border-border rounded-ctrl px-3 py-2.5 text-sm text-text-primary resize-none focus:outline-none focus:border-ink"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 px-7 py-4 border-t border-border flex-shrink-0">
          <button onClick={printPdf} className="bg-ink text-white text-sm font-semibold px-4 py-2.5 rounded-ctrl hover:bg-ink-dark transition-colors">
            ⤓ PDF
          </button>
          <button onClick={sendPartners} className="bg-white border border-border text-text-primary text-sm font-semibold px-4 py-2.5 rounded-ctrl hover:bg-canvas transition-colors">
            Send to Partners
          </button>
          <button onClick={onClose} className="ml-auto text-sm text-text-secondary hover:text-text-primary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color, bg }: { label: string; value: string|number; color: string; bg: string }) {
  return (
    <div className="rounded-card p-4" style={{ background: bg }}>
      <div className="text-xs font-semibold uppercase tracking-wider" style={{ color }}>{label}</div>
      <div className="text-3xl font-bold mt-1 font-spectral" style={{ color }}>{value}</div>
    </div>
  );
}

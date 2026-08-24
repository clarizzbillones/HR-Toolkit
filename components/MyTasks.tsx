'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Task { source: 'onboarding' | 'offboarding'; personId: string; personName: string; section: string; label: string; deadline: string; assignee: string }

// Dashboard panel: the onboarding/offboarding document tasks assigned to the
// person viewing it, not yet done. Clicking a task opens that person's document.
export default function MyTasks({ alwaysShow = false }: { alwaysShow?: boolean }) {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  useEffect(() => {
    fetch('/api/my-tasks').then(r => r.json()).then(d => setTasks(d.tasks ?? [])).catch(() => setTasks([]));
  }, []);

  if (!tasks) return null; // still loading
  // Normally the panel only appears when there's something to show. When it's a
  // restricted viewer's whole dashboard (alwaysShow), keep it with an empty
  // state so they never see a blank page.
  if (tasks.length === 0) {
    if (!alwaysShow) return null;
    return (
      <div className="bg-white border border-border rounded-card p-5 mb-6">
        <h2 className="text-base font-bold text-text-primary">My assigned tasks</h2>
        <p className="text-sm text-text-muted mt-1">You’re all caught up — no onboarding or offboarding tasks are assigned to you right now.</p>
      </div>
    );
  }

  const href = (t: Task) => t.source === 'onboarding'
    ? `/onboarding?person=${encodeURIComponent(t.personId)}`
    : `/offboarding?person=${encodeURIComponent(t.personId)}`;

  return (
    <div className="bg-white border border-border rounded-card p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-base font-bold text-text-primary">My assigned tasks</h2>
          <p className="text-xs text-text-muted mt-0.5">Onboarding &amp; offboarding items assigned to you that still need a date done. Click one to open the document.</p>
        </div>
        <span className="shrink-0 text-xs font-bold text-white bg-ink rounded-full px-2.5 py-1">{tasks.length}</span>
      </div>
      <div className="space-y-1.5">
        {tasks.map((t, i) => (
          <Link key={i} href={href(t)}
            className="flex items-center gap-3 px-3 py-2 rounded-ctrl border border-border-light hover:bg-canvas transition-colors group">
            <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${t.source === 'onboarding' ? 'bg-[#eef5f1] text-[#2f7d5b]' : 'bg-[#f7efe1] text-[#b07d2a]'}`}>
              {t.source === 'onboarding' ? 'Onboarding' : 'Offboarding'}
            </span>
            <span className="font-semibold text-sm text-text-primary truncate">{t.label}</span>
            <span className="text-sm text-text-muted truncate">— {t.personName}</span>
            <span className="hidden sm:inline text-[11px] text-text-faint">· {t.section}</span>
            <span className="ml-auto shrink-0 flex items-center gap-3">
              {t.deadline && <span className="text-[11px] text-text-muted whitespace-nowrap">Due {t.deadline}</span>}
              <span className="text-text-faint group-hover:text-ink">→</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

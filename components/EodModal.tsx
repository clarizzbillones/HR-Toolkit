'use client';
import { useEffect, useRef, useState } from 'react';
import { useToast } from './Toast';

interface Task {
  id: string; title: string; sub: string; due_tag: string; status: string; notes: string;
}

export default function EodModal({ onClose }: { onClose: () => void }) {
  const { showToast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [ptoToday, setPtoToday] = useState<string[]>([]);
  const reportRef = useRef<HTMLDivElement>(null);
  const [notes, setNotes] = useState('');
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const todayIso = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });

  useEffect(() => {
    fetch('/api/tasks').then(r => r.json()).then(d => setTasks(d.tasks ?? []));
    // Load PTO entries + calendar events and find who's out today
    Promise.all([
      fetch('/api/pto').then(r => r.json()).catch(() => ({ entries: [] })),
      fetch('/api/connections').then(r => r.json()).catch(() => ({})),
    ]).then(([ptoData, connData]) => {
      const entries: { employee: string; start_date: string; end_date: string; type: string }[] = ptoData.entries ?? [];
      const calEvents: { name: string; tag: string; start: string; end: string; title: string }[] = connData.calendar_events ?? [];

      const names = new Set<string>();

      entries
        .filter(e =>
          e.start_date <= todayIso && e.end_date >= todayIso &&
          (e as any).status === 'Approved' &&
          !/wfh|work\s+from\s+home|personal\s+leave|personal/i.test(e.type) &&
          ((e as any).days == null || Number((e as any).days) >= 1)
        )
        .forEach(e => names.add(e.employee));

      calEvents
        .filter(c =>
          c.start <= todayIso && c.end >= todayIso &&
          !/wfh|work from home/i.test(c.tag) &&
          !/interview|in office|meeting|call|training|travel|fundraiser|conference|in \w+ for|\w+ in \w+/i.test(c.title)
        )
        .forEach(c => names.add(c.name));

      setPtoToday([...names]);
    });
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
    const taskRows = tasks.map(t => {
      const taskNotes = JSON.parse(t.notes || '[]') as {text:string}[];
      return `<tr style="border-bottom:1px solid #f4efe6">
        <td style="padding:8px 4px;font-size:13px;font-weight:500">${t.title}${t.sub ? `<br><span style="font-size:11px;color:#888">${t.sub}</span>` : ''}</td>
        <td style="padding:8px 4px;font-size:11px">${statusLabel(t.status)}</td>
        <td style="padding:8px 4px;font-size:11px;color:#666">${t.due_tag || '—'}</td>
        <td style="padding:8px 4px;font-size:11px;color:#666">${taskNotes.map(n=>n.text).join('; ') || '—'}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><title>EOD Report – ${today}</title>
    <style>body{font-family:Georgia,serif;margin:0;padding:0}
    table{width:100%;border-collapse:collapse}
    th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#999;padding:6px 4px;border-bottom:2px solid #e0d9ce}
    </style></head><body>
    <div style="background:linear-gradient(120deg,#1b2a3d,#26405c);padding:24px 32px;border-bottom:4px solid #c9a24a;display:flex;justify-content:space-between;align-items:center">
      <div><div style="font-size:22px;font-weight:700;color:#fff;letter-spacing:.15em">LITSON</div>
      <div style="font-size:10px;color:#cdd7e2;letter-spacing:.1em;margin-top:2px">ATTORNEYS AT LAW · NASHVILLE, TENNESSEE</div></div>
      <div style="text-align:right;font-size:11px;color:#cdd7e2;line-height:1.6">End-of-Day Report<br>${today}</div>
    </div>
    <div style="padding:24px 32px">
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px">
        <div style="background:#eef5f1;padding:14px;border-radius:6px"><div style="font-size:10px;font-weight:700;color:#2f7d5b;text-transform:uppercase">Tasks Done</div><div style="font-size:28px;font-weight:700;color:#2f7d5b">${done.length}</div></div>
        <div style="background:#f7efe1;padding:14px;border-radius:6px"><div style="font-size:10px;font-weight:700;color:#b07d2a;text-transform:uppercase">Pending</div><div style="font-size:28px;font-weight:700;color:#b07d2a">${pending.length}</div></div>
        <div style="background:#e9f0f5;padding:14px;border-radius:6px"><div style="font-size:10px;font-weight:700;color:#3f6b8a;text-transform:uppercase">On PTO Today</div><div style="font-size:28px;font-weight:700;color:#3f6b8a">${ptoToday.length}</div>${ptoToday.length ? `<div style="font-size:11px;color:#3f6b8a;margin-top:4px">${ptoToday.join(', ')}</div>` : ''}</div>
        <div style="background:#fdeaea;padding:14px;border-radius:6px"><div style="font-size:10px;font-weight:700;color:#b0412f;text-transform:uppercase">Open Items</div><div style="font-size:28px;font-weight:700;color:#b0412f">${pending.length}</div></div>
      </div>
      <table><thead><tr><th>Task</th><th>Status</th><th>Due</th><th>Notes</th></tr></thead><tbody>${taskRows}</tbody></table>
      ${notes ? `<div style="margin-top:24px;padding:16px;background:#fafaf8;border:1px solid #e8e3da;border-radius:6px"><div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#999;margin-bottom:8px">Notes for Reviewer</div><div style="font-size:13px;color:#333">${notes}</div></div>` : ''}
    </div></body></html>`;

    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  }

  async function takeScreenshot() {
    if (!reportRef.current) return;
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const link = document.createElement('a');
      link.download = `EOD-Report-${new Date().toISOString().slice(0,10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      showToast('Screenshot saved');
    } catch { showToast('Screenshot failed'); }
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

        <div className="overflow-auto flex-1 p-7" ref={reportRef}>
          {/* Stat cards */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            <StatCard label="Tasks Done" value={done.length} color="#2f7d5b" bg="#eef5f1" />
            <StatCard label="Pending" value={pending.length} color="#b07d2a" bg="#f7efe1" />
            <StatCard label="On PTO Today" value={ptoToday.length} color="#3f6b8a" bg="#e9f0f5" sub={ptoToday.join(', ') || undefined} />
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
          <button onClick={takeScreenshot} className="bg-white border border-border text-text-primary text-sm font-semibold px-4 py-2.5 rounded-ctrl hover:bg-canvas transition-colors">
            📷 Screenshot
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

function StatCard({ label, value, color, bg, sub }: { label: string; value: string|number; color: string; bg: string; sub?: string }) {
  return (
    <div className="rounded-card p-4" style={{ background: bg }}>
      <div className="text-xs font-semibold uppercase tracking-wider" style={{ color }}>{label}</div>
      <div className="text-3xl font-bold mt-1 font-spectral" style={{ color }}>{value}</div>
      {sub && <div className="text-xs mt-1 leading-snug" style={{ color, opacity: 0.8 }}>{sub}</div>}
    </div>
  );
}

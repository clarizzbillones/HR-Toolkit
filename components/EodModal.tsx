'use client';
import { useEffect, useRef, useState } from 'react';
import { useToast } from './Toast';

interface Task {
  id: string; title: string; sub: string; due_tag: string; status: string; notes: string; completed_date?: string;
}

const NAME_ALIASES: [RegExp, string][] = [
  [/^(vms|victoria|victoria\s+seeley)$/i, 'Victoria Seeley'],
  [/^(mrg|matt|mg|matt\s+gibbs)$/i, 'Matt Gibbs'],
  [/^(matthew\s+nunez|matt\s+nunez|nunez)$/i, 'Matthew Nunez'],
  [/^(syerra|syerra\s+ryan)$/i, 'Syerra Ryan'],
  [/^(ryan|ryan\s+leite)$/i, 'Ryan Leite'],
  [/^(sl|clarizz|cb|clarizz\s+ann\s+billones|clarizz\s+ann\s+alon|clarizz\s+alon)$/i, 'Clarizz Ann Billones'],
  [/^(jr'?|jrg|john|john\s+ross\s+glover|john\s+glover)$/i, 'John Ross Glover'],
  [/^(clint|clint\s+palmer)$/i, 'Clint Palmer'],
  [/^(caitlin|caitlin\s+giuliano)$/i, 'Caitlin Giuliano'],
  [/^(shannen|shannen\s+sharpe)$/i, 'Shannen Sharpe'],
  [/^(simran|simran\s+mohini|simran\s+mohini\s+jain)$/i, 'Simran Mohini Jain'],
  [/^(kelynn|kl|ke'?lynn|ke'?lynn\s+enalls)$/i, "Ke'Lynn Enalls"],
  [/^(ct|catie|catie\s+toole|catherine\s+tool(e)?)$/i, 'Catie Toole'],
  [/^(carly|carly\s+cro(?:l{1,2}|tt)y)$/i, 'Carly Crotty'],
  [/^(brent|bh|brent\s+hannafan)$/i, 'Brent Hannafan'],
  [/^(brittany|bb|brittany\s+brewer)$/i, 'Brittany Brewer'],
  [/^(ally|ally\s+foresman)$/i, 'Ally Foresman'],
  [/^(amy\s+green)$/i, 'Amy Green'],
  [/^(amy\s+nelson)$/i, 'Amy Nelson'],
  [/^(alicia|avh|alicia\s+van[-\s]?huizen)$/i, 'Alicia Van Huizen'],
  [/^(paula|paula\s+valle|paula\s+laborne\s+valle|paula\s+laborne)$/i, 'Paula Laborne Valle'],
  [/^(ridwan|ridwan\s+ahmed)$/i, 'Ridwan Ahmed'],
  [/^(alex|alex\s+little)$/i, 'Alex Little'],
  [/^(ashley|ashley\s+abraham)$/i, 'Ashley Abraham'],
  [/^(fernanda|fernanda\s+guillen)$/i, 'Fernanda Guillen'],
  [/^(joey|joey\s+mundy)$/i, 'Joey Mundy'],
  [/^(kelley|kelley\s+hess)$/i, 'Kelley Hess'],
  [/^(sloan|sloan\s+nickel)$/i, 'Sloan Nickel'],
  [/^(ted|ted\s+canter)$/i, 'Ted Canter'],
  [/^(zach|zachary|zachary\s+lawson|zach\s+lawson)$/i, 'Zachary Lawson'],
  [/^(isabella|isabella\s+maria\s+ardila|isabella\s+ardila)$/i, 'Isabella Maria Ardila'],
  [/^(naomi|naomi\s+alinajad)$/i, 'Naomi Alinajad'],
];

function resolveAlias(n: string): string {
  const t = n.trim();
  for (const [re, canonical] of NAME_ALIASES) {
    if (re.test(t)) return canonical;
  }
  return t;
}

function dedupeNames(names: string[]): string[] {
  const seen = new Map<string, string>();
  for (const n of names) {
    const resolved = resolveAlias(n);
    const key = resolved.trim().toLowerCase();
    if (!seen.has(key)) seen.set(key, resolved);
  }
  return [...seen.values()];
}

export default function EodModal({ onClose }: { onClose: () => void }) {
  const { showToast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [ptoToday, setPtoToday] = useState<string[]>([]);
  const reportRef = useRef<HTMLDivElement>(null);
  const [notes, setNotes] = useState('');
  const defaultIso = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
  const [selectedDate, setSelectedDate] = useState(defaultIso);

  const reportDateLabel = new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  useEffect(() => {
    fetch(`/api/tasks?eodDate=${selectedDate}`).then(r => r.json()).then(d => setTasks(d.tasks ?? []));
  }, [selectedDate]);

  useEffect(() => {
    fetch(`/api/pto/today?date=${selectedDate}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.names)) setPtoToday(dedupeNames(d.names)); })
      .catch(() => {});
  }, [selectedDate]);

  // "Tasks Done" mirrors the board's Completed column: for today, count every
  // task currently marked done; for a past date, count items completed on it.
  const done = selectedDate === defaultIso
    ? tasks.filter(t => t.status === 'done')
    : tasks.filter(t => (t.status === 'done' || t.status === 'archived') && t.completed_date === selectedDate);
  // Open items = everything still open (In Progress + Not Started); Pending card = In Progress only
  const pending = tasks.filter(t => t.status !== 'done' && t.status !== 'archived');
  const inProgress = tasks.filter(t => t.status === 'doing');

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

  function pillBg(status: string) {
    if (status === 'done') return 'background:#eef5f1;color:#2f7d5b';
    if (status === 'doing') return 'background:#e9f0f5;color:#3f6b8a';
    return 'background:#f7efe1;color:#b07d2a';
  }

  function printPdf() {
    const taskRows = [...done, ...pending].map(t => {
      const taskNotes = JSON.parse(t.notes || '[]') as {text:string}[];
      return `<tr style="border-bottom:1px solid #f4efe6">
        <td style="padding:10px 8px;font-size:13px;font-weight:500;color:#1a1a1a">${t.title}${t.sub ? `<br><span style="font-size:11px;color:#888">${t.sub}</span>` : ''}</td>
        <td style="padding:10px 8px"><span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;${pillBg(t.status)}">${statusLabel(t.status)}</span></td>
        <td style="padding:10px 8px;font-size:12px;color:#555">${t.due_tag || '—'}</td>
        <td style="padding:10px 8px;font-size:12px;color:#555">${taskNotes.map(n=>n.text).join('; ') || '—'}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><title>EOD Report – ${reportDateLabel}</title>
    <style>
      *{box-sizing:border-box}
      body{font-family:Georgia,serif;margin:0;padding:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      table{width:100%;border-collapse:collapse}
      th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#999;padding:8px 8px 6px;border-bottom:2px solid #e0d9ce;font-family:Arial,sans-serif}
      @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    </style></head><body>
    <div style="background:linear-gradient(120deg,#1b2a3d,#26405c);padding:24px 32px;border-bottom:4px solid #c9a24a;display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-size:22px;font-weight:700;color:#fff;letter-spacing:.15em;font-family:Georgia,serif">LITSON</div>
        <div style="font-size:10px;color:#c9a24a;letter-spacing:.12em;margin-top:3px;font-family:Arial,sans-serif">ATTORNEYS AT LAW · NASHVILLE, TENNESSEE</div>
      </div>
      <div style="text-align:right;font-size:11px;color:#cdd7e2;line-height:1.7;font-family:Arial,sans-serif">End-of-Day Report<br><strong style="color:#fff">${reportDateLabel}</strong></div>
    </div>
    <div style="padding:24px 32px">
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:28px">
        <div style="background:#eef5f1;padding:16px;border-radius:8px">
          <div style="font-size:10px;font-weight:700;color:#2f7d5b;text-transform:uppercase;letter-spacing:.08em;font-family:Arial,sans-serif">Tasks Done</div>
          <div style="font-size:32px;font-weight:700;color:#2f7d5b;margin-top:4px;font-family:Georgia,serif">${done.length}</div>
        </div>
        <div style="background:#f7efe1;padding:16px;border-radius:8px">
          <div style="font-size:10px;font-weight:700;color:#b07d2a;text-transform:uppercase;letter-spacing:.08em;font-family:Arial,sans-serif">Pending</div>
          <div style="font-size:32px;font-weight:700;color:#b07d2a;margin-top:4px;font-family:Georgia,serif">${inProgress.length}</div>
        </div>
        <div style="background:#e9f0f5;padding:16px;border-radius:8px">
          <div style="font-size:10px;font-weight:700;color:#3f6b8a;text-transform:uppercase;letter-spacing:.08em;font-family:Arial,sans-serif">On PTO Today</div>
          <div style="font-size:32px;font-weight:700;color:#3f6b8a;margin-top:4px;font-family:Georgia,serif">${ptoToday.length}</div>
          ${ptoToday.length ? `<div style="font-size:11px;color:#3f6b8a;margin-top:4px;font-family:Arial,sans-serif">${ptoToday.join(', ')}</div>` : ''}
        </div>
        <div style="background:#fdeaea;padding:16px;border-radius:8px">
          <div style="font-size:10px;font-weight:700;color:#b0412f;text-transform:uppercase;letter-spacing:.08em;font-family:Arial,sans-serif">Open Items</div>
          <div style="font-size:32px;font-weight:700;color:#b0412f;margin-top:4px;font-family:Georgia,serif">${pending.length}</div>
        </div>
      </div>
      <table>
        <thead><tr>
          <th style="width:35%">Task</th>
          <th style="width:15%">Status</th>
          <th style="width:15%">Due</th>
          <th>Notes</th>
        </tr></thead>
        <tbody>${taskRows}</tbody>
      </table>
      ${notes ? `<div style="margin-top:24px;padding:16px;background:#fafaf8;border:1px solid #e8e3da;border-radius:8px"><div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#999;margin-bottom:8px;font-family:Arial,sans-serif;letter-spacing:.08em">Notes for Reviewer</div><div style="font-size:13px;color:#333;line-height:1.6">${notes}</div></div>` : ''}
    </div></body></html>`;

    const w = window.open('', '_blank', 'width=960,height=750');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
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
          <div className="flex items-start gap-6">
            <div className="text-right text-xs text-[#cdd7e2] leading-relaxed">
              End-of-Day Report<br />
              <span>{reportDateLabel}</span>
              <br />
              <input
                type="date"
                value={selectedDate}
                onChange={e => e.target.value && setSelectedDate(e.target.value)}
                className="mt-1 text-xs bg-transparent border border-[#4a6a8a] rounded px-1.5 py-0.5 text-[#cdd7e2] cursor-pointer focus:outline-none focus:border-[#c9a24a] no-print"
                style={{ colorScheme: 'dark' }}
              />
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-[#cdd7e2] hover:text-white text-xl leading-none mt-0.5 flex-shrink-0"
              aria-label="Close"
            >✕</button>
          </div>
        </div>

        <div className="overflow-auto flex-1 p-7" ref={reportRef}>
          {/* Stat cards */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            <StatCard label="Tasks Done" value={done.length} color="#2f7d5b" bg="#eef5f1" />
            <StatCard label="Pending" value={inProgress.length} color="#b07d2a" bg="#f7efe1" />
            <StatCard label="On PTO Today" value={ptoToday.length} color="#3f6b8a" bg="#e9f0f5" sub={ptoToday.join(', ') || undefined} />
            <StatCard label="Open Items" value={pending.length} color="#b0412f" bg="#fdeaea" />
          </div>

          {/* Task table */}
          <div className="mb-6">
            <div className="grid grid-cols-[2fr_1fr_1fr_2fr] gap-2 py-2 border-b border-border-warm text-[10px] uppercase tracking-wider text-text-faint font-bold">
              <div>Task</div><div>Status</div><div>Due</div><div>Notes</div>
            </div>
            {[...done, ...pending].map((t) => {
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
          <button type="button" onClick={onClose} className="ml-auto text-sm font-semibold text-text-secondary hover:text-text-primary px-3 py-1.5 rounded-ctrl hover:bg-canvas border border-transparent hover:border-border transition-colors">
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

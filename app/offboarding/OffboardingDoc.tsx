'use client';
import { useEffect, useRef, useState } from 'react';
import {
  BENEFITS_REF, OFFBOARDING_ASSIGNEES, DEFAULT_ACCOUNTS,
  docProgress, docSignedOff, newRow,
  type OffboardingDoc as Doc, type Cell,
} from '@/lib/offboardingDoc';

interface RecLite { id: string; name: string; position: string | null; separation_date: string | null; doc: Doc }

// Catie's streamlined offboarding document: Pre-Offboarding → Tools → IT, each
// task assigned to a person who initials + dates it, then Catie signs off.
export default function OffboardingDoc({ rec, readOnly, lockAssignment, assignees, onAddAssignee, onRemoveAssignee, onSave }: {
  rec: RecLite; readOnly?: boolean; lockAssignment?: boolean;
  assignees?: string[];
  onAddAssignee?: (name: string) => void;
  onRemoveAssignee?: (name: string) => void;
  onSave: (doc: Doc) => void;
}) {
  // When lockAssignment is on (anyone who isn't a full-access admin), assigning
  // tasks and adding/removing/reordering rows are locked — they can only fill in
  // their part (initials / date / notes).
  const [doc, setDoc] = useState<Doc>(rec.doc);
  const ref = useRef<Doc>(rec.doc);
  // A locked document freezes the structure and assignments (rows, assignees,
  // ops decisions) so they can't change by accident — but assigned people can
  // still mark their part done. Catie (full access) can unlock to change anything.
  const locked = !!doc.locked;
  const cellRO = readOnly;                                    // initials / date / notes — always open (unless view-only)
  const assignRO = readOnly || lockAssignment || locked;     // assignee + structural edits
  const assigneeList = assignees && assignees.length ? assignees : [...OFFBOARDING_ASSIGNEES];
  const removableNames = assigneeList.filter(a => !OFFBOARDING_ASSIGNEES.includes(a as any));
  useEffect(() => { setDoc(rec.doc); ref.current = rec.doc; }, [rec.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function apply(mut: (d: Doc) => void): Doc {
    const next: Doc = JSON.parse(JSON.stringify(ref.current));
    mut(next); ref.current = next; setDoc(next); return next;
  }
  const persist = () => onSave(ref.current);
  const done = (c?: Cell) => !!(c && (c.initial ?? '').trim() && (c.date ?? '').trim());

  function removeAssignee(n: string) {
    if (!window.confirm(`Remove "${n}" from the assignee list for every offboarding?`)) return;
    apply(d => {
      for (const key of ['hr', 'accounts', 'it'] as const) for (const r of d[key]) if (r.cell.assignee === n) r.cell.assignee = '';
      for (const k of ['hr', 'ops', 'it'] as const) if ((d.signoff as any)[k]?.assignee === n) (d.signoff as any)[k].assignee = '';
    });
    persist();
    onRemoveAssignee?.(n);
  }
  function toggleLock() { apply(d => { d.locked = !d.locked; }); persist(); }
  // Add any standard closing tools (Westlaw, Tybera, court e-filing, Lawline,
  // Courtdrive, etc.) that aren't already on this record — for offboardings
  // created before a tool was added to the standard list.
  function addStandardTools() {
    const have = new Set(doc.accounts.map(a => a.label.trim().toLowerCase()));
    const missing = DEFAULT_ACCOUNTS.filter(t => !have.has(t.label.trim().toLowerCase()));
    if (!missing.length) { window.alert('All standard tools are already listed.'); return; }
    apply(d => { for (const t of missing) { const r = newRow(t.label); r.hint = t.hint; d.accounts.push(r); } });
    persist();
  }

  const { done: dn, total } = docProgress(doc);
  const pct = total ? Math.round((dn / total) * 100) : 0;
  const signed = docSignedOff(doc);

  // Drag-and-drop reorder within a section.
  const dragRow = useRef<{ key: 'hr' | 'accounts' | 'it'; i: number } | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  function moveRow(listKey: 'hr' | 'accounts' | 'it', from: number, to: number) {
    if (from === to) return;
    apply(d => { const arr = d[listKey]; const [m] = arr.splice(from, 1); arr.splice(to, 0, m); });
    persist();
  }
  // Bulk-select rows (across sections) and move them to another section.
  const [selIds, setSelIds] = useState<Set<string>>(new Set());
  const toggleSel = (id: string) => setSelIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const SECTION_MOVE: { key: 'hr' | 'accounts' | 'it'; label: string }[] = [
    { key: 'hr', label: 'Pre-Offboarding' }, { key: 'accounts', label: 'Tools' }, { key: 'it', label: 'IT' },
  ];
  function moveSelectedTo(target: 'hr' | 'accounts' | 'it') {
    if (!selIds.size) return;
    apply(d => {
      const moving: any[] = [];
      for (const key of ['hr', 'accounts', 'it'] as const) {
        if (key === target) continue;
        d[key] = d[key].filter(r => { if (selIds.has(r.id)) { moving.push(r); return false; } return true; });
      }
      d[target].push(...moving);
    });
    persist();
    setSelIds(new Set());
  }

  // One editable cell (Assigned To / Initial / Date / Notes).
  function CellFields({ get, set }: { get: () => Cell; set: (patch: Partial<Cell>, commit: boolean) => void }) {
    const c = get();
    return (
      <div className="grid grid-cols-2 sm:grid-cols-[130px_70px_140px_1fr] gap-x-2 gap-y-1 mt-2">
        {/* Column captions so the fields read clearly */}
        <span className="hidden sm:block text-[9px] font-bold uppercase tracking-wider text-text-faint">Assigned to</span>
        <span className="hidden sm:block text-[9px] font-bold uppercase tracking-wider text-text-faint">Initials</span>
        <span className="hidden sm:block text-[9px] font-bold uppercase tracking-wider text-[#2f7d5b]">Date done</span>
        <span className="hidden sm:block text-[9px] font-bold uppercase tracking-wider text-text-faint">Notes</span>
        <select disabled={assignRO} value={c.assignee ?? ''}
          onChange={e => {
            const v = e.target.value;
            if (v === '__add__') { const name = window.prompt('Add an assignee name:')?.trim(); if (name) { onAddAssignee?.(name); set({ assignee: name }, true); } return; }
            set({ assignee: v }, true);
          }}
          className="border border-border-light rounded-ctrl px-2 py-1.5 text-sm bg-white focus:outline-none focus:border-ink disabled:bg-[#f6f4f0] disabled:text-text-secondary">
          <option value="">Assign to…</option>
          {c.assignee && !assigneeList.includes(c.assignee) && <option value={c.assignee}>{c.assignee}</option>}
          {assigneeList.map(a => <option key={a} value={a}>{a}</option>)}
          {!assignRO && <option value="__add__">➕ Add name…</option>}
        </select>
        <input disabled={cellRO} value={c.initial ?? ''} onChange={e => set({ initial: e.target.value }, false)} onBlur={persist} placeholder="Initials"
          className="border border-border-light rounded-ctrl px-2 py-1.5 text-sm focus:outline-none focus:border-ink text-center uppercase" maxLength={6} />
        <input disabled={cellRO} type="date" value={c.date ?? ''} onChange={e => set({ date: e.target.value }, true)}
          className="border border-border-light rounded-ctrl px-2 py-1.5 text-sm focus:outline-none focus:border-ink" />
        <input disabled={cellRO} value={c.notes ?? ''} onChange={e => set({ notes: e.target.value }, false)} onBlur={persist} placeholder="Notes"
          className="border border-border-light rounded-ctrl px-2 py-1.5 text-sm focus:outline-none focus:border-ink" />
      </div>
    );
  }

  // A read-only titled task row with its cell (used for the sign-off rows).
  function TaskRow({ label, get, set }: { label: string; get: () => Cell; set: (p: Partial<Cell>, commit: boolean) => void; }) {
    const complete = done(get());
    return (
      <div className={`rounded-ctrl border px-3 py-2.5 ${complete ? 'border-[#cfe4d8] bg-[#f4faf6]' : 'border-border-light bg-white'}`}>
        <div className="flex items-start gap-2">
          <span className={`mt-0.5 text-sm ${complete ? 'text-[#2f7d5b]' : 'text-text-faint'}`}>{complete ? '✓' : '○'}</span>
          <div className="flex-1 min-w-0"><div className="text-sm font-medium text-text-primary">{label}</div></div>
        </div>
        {CellFields({ get, set })}
      </div>
    );
  }

  // An editable list of rows for a section — rename, remove, add, reorder (drag),
  // bulk-select, and fill each cell. Structural edits are locked for assignRO.
  function RowSection({ listKey, addLabel, placeholder }: { listKey: 'hr' | 'accounts' | 'it'; addLabel: string; placeholder: string }) {
    const rows = doc[listKey];
    return (
      <div className="space-y-2">
        {rows.map((a, i) => {
          const complete = done(a.cell);
          return (
            <div key={a.id}
              onDragOver={assignRO ? undefined : (e => { e.preventDefault(); if (dragOver !== `${listKey}:${i}`) setDragOver(`${listKey}:${i}`); })}
              onDrop={assignRO ? undefined : (() => { const s = dragRow.current; dragRow.current = null; setDragOver(null); if (s && s.key === listKey) moveRow(listKey, s.i, i); })}
              className={`rounded-ctrl border px-3 py-2.5 ${dragOver === `${listKey}:${i}` ? 'border-ink ring-1 ring-[#c9a24a]' : complete ? 'border-[#cfe4d8] bg-[#f4faf6]' : 'border-border-light bg-white'}`}>
              <div className="flex items-start gap-2">
                {!assignRO && (
                  <input type="checkbox" checked={selIds.has(a.id)} onChange={() => toggleSel(a.id)} title="Select to move between sections"
                    className="mt-1.5 w-4 h-4 accent-[#1b2a3d] shrink-0" />
                )}
                {!assignRO && (
                  <span draggable onDragStart={() => { dragRow.current = { key: listKey, i }; }} onDragEnd={() => { dragRow.current = null; setDragOver(null); }}
                    title="Drag to reorder" className="mt-1 cursor-grab active:cursor-grabbing select-none text-text-faint hover:text-text-muted text-sm">⠿</span>
                )}
                <span className={`mt-1.5 text-sm ${complete ? 'text-[#2f7d5b]' : 'text-text-faint'}`}>{complete ? '✓' : '○'}</span>
                <input disabled={assignRO} value={a.label} onChange={e => apply(d => { d[listKey][i].label = e.target.value; })} onBlur={persist}
                  placeholder={placeholder} className="flex-1 min-w-0 text-sm font-medium text-text-primary bg-transparent border border-transparent hover:border-border-light focus:border-ink rounded px-1.5 py-0.5 focus:outline-none disabled:hover:border-transparent" />
                {!assignRO && <button onClick={() => { apply(d => { d[listKey].splice(i, 1); }); persist(); }} title="Remove row" className="text-text-muted hover:text-litred-alt text-sm shrink-0">✕</button>}
              </div>
              {a.hint && <div className="text-[11px] text-text-muted mt-0.5 ml-6">{a.hint}</div>}
              {CellFields({ get: () => doc[listKey][i].cell, set: (p, commit) => { apply(d => { d[listKey][i].cell = { ...d[listKey][i].cell, ...p }; }); if (commit) persist(); } })}
            </div>
          );
        })}
        {!assignRO && <button onClick={() => { apply(d => { d[listKey].push(newRow()); }); persist(); }} className="w-full border-2 border-dashed border-border-light rounded-ctrl py-2 text-sm font-semibold text-text-muted hover:text-ink hover:border-ink">{addLabel}</button>}
      </div>
    );
  }

  const opsField = (label: string, key: keyof Doc['ops']) => (
    <div>
      <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1">{label}</label>
      <input disabled={assignRO} value={doc.ops[key] ?? ''} onChange={e => apply(d => { d.ops[key] = e.target.value; })} onBlur={persist}
        className="w-full border border-border-light rounded-ctrl px-2.5 py-2 text-sm focus:outline-none focus:border-ink disabled:bg-[#f6f4f0]" />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Progress + sign-off banner */}
      <div className="bg-white border border-border rounded-card p-5">
        {!readOnly && !lockAssignment && (
          <div className="flex justify-end mb-2">
            <button onClick={toggleLock} title={locked ? 'Unlock to change assignments' : 'Lock to prevent accidental changes to rows/assignees'}
              className={`text-[11px] font-semibold border px-2.5 py-1 rounded-ctrl ${locked ? 'bg-[#f7efe1] border-[#e0c48a] text-[#b07d2a] hover:bg-[#f2e6cf]' : 'text-ink border-border-light hover:bg-canvas'}`}>{locked ? '🔒 Locked' : '🔓 Lock'}</button>
          </div>
        )}
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="font-semibold text-text-secondary">{dn} of {total} tasks initialed &amp; dated</span>
          <span className="text-text-muted">{pct}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-[#eee7da] overflow-hidden"><div className="h-full rounded-full bg-[#c9a24a] transition-all" style={{ width: `${pct}%` }} /></div>
        <div className={`mt-3 text-sm rounded-ctrl px-3 py-2 ${signed ? 'bg-[#eef5f1] text-[#2f7d5b] border border-[#cfe4d8]' : 'bg-[#faf7f0] text-text-secondary border border-[#efe6d5]'}`}>
          {signed
            ? '✓ Signed off by Catie — complete. The employee has been moved to Offboarded and the signed document filed to their Employee File (HR Hub) automatically.'
            : 'Not complete until Catie reviews and signs off all three sections below. On sign-off, the employee is moved to Offboarded and the signed PDF is filed automatically.'}
        </div>
        {locked && (
          <div className="mt-2 text-[12px] rounded-ctrl px-3 py-2 bg-[#f7efe1] text-[#8a6d3b] border border-[#e0c48a]">
            🔒 <b>Locked</b> — the rows, assignees, and Ops decisions are frozen to prevent accidental changes. Assigned people can still mark their part done (<b>initials</b>, <b>date</b>, <b>notes</b>).{!readOnly && !lockAssignment ? ' Click 🔒 Locked above to unlock and change assignments.' : ''}
          </div>
        )}
        {lockAssignment && !readOnly && !locked && (
          <div className="mt-2 text-[12px] rounded-ctrl px-3 py-2 bg-[#eef2f7] text-[#3f5a76] border border-[#d4e0ec]">
            HR assigns each task and manages the rows. You can mark your part done — add your <b>initials</b>, the <b>date</b>, and any <b>notes</b>. Assigning tasks and adding/removing/reordering rows are done by a full-access admin.
          </div>
        )}
        {/* Manage assignee names — add, or remove added names with ✕ */}
        {!assignRO && (
          <div className="mt-3 flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted mr-1">Assignee names</span>
            {removableNames.map(n => (
              <span key={n} className="inline-flex items-center gap-1 text-[11px] font-semibold bg-[#eef2f7] text-[#3f5a76] border border-[#d4e0ec] rounded-full pl-2.5 pr-1 py-0.5">
                {n}
                <button onClick={() => removeAssignee(n)} title={`Remove ${n}`} className="w-4 h-4 leading-none rounded-full text-[#3f5a76]/60 hover:text-white hover:bg-litred-alt">✕</button>
              </span>
            ))}
            {removableNames.length === 0 && <span className="text-[11px] text-text-faint">built-in team only</span>}
            <button onClick={() => { const name = window.prompt('Add an assignee name:')?.trim(); if (name) onAddAssignee?.(name); }} className="text-[11px] font-semibold text-[#3f6b8a] hover:underline ml-1">➕ Add name</button>
          </div>
        )}
      </div>

      {/* Bulk move: select rows in any section, then send them to another */}
      {!assignRO && selIds.size > 0 && (
        <div className="sticky top-0 z-20 bg-white border-2 border-ink rounded-card px-4 py-3 flex items-center gap-2 flex-wrap shadow-card">
          <span className="text-sm font-semibold text-text-primary">{selIds.size} selected</span>
          <span className="text-xs text-text-muted">Move to:</span>
          {SECTION_MOVE.map(s => (
            <button key={s.key} onClick={() => moveSelectedTo(s.key)}
              className="text-xs font-semibold text-ink border border-border-light bg-white px-3 py-1.5 rounded-ctrl hover:bg-canvas">{s.label}</button>
          ))}
          <button onClick={() => setSelIds(new Set())} className="ml-auto text-xs font-semibold text-text-muted hover:text-ink">Clear</button>
        </div>
      )}

      {/* Section 1 — Pre-Offboarding */}
      <Section heading="Section 1 — Pre-Offboarding" blurb="Employment status, benefits, and departure logistics.">
        {RowSection({ listKey: 'hr', addLabel: '+ Add Pre-Offboarding task', placeholder: 'Task name' })}
        {/* Benefits quick reference */}
        <div className="mt-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-gold-muted mb-1.5">Benefits quick reference</div>
          <div className="overflow-x-auto border border-border-light rounded-ctrl">
            <table className="w-full text-sm min-w-[560px]">
              <thead className="bg-[#faf7f0]"><tr>{['Benefit', 'Coverage ends', 'Notes'].map(h => <th key={h} className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-text-muted">{h}</th>)}</tr></thead>
              <tbody>{BENEFITS_REF.map((b, i) => (
                <tr key={i} className="border-t border-[#f1ece3]"><td className="px-3 py-2 font-medium text-text-primary">{b.benefit}</td><td className="px-3 py-2 text-text-secondary">{b.ends}</td><td className="px-3 py-2 text-text-muted">{b.notes}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      </Section>

      {/* Section 2 — Tools */}
      <Section heading="Section 2 — Tools" blurb="Access, mailbox, and account/tool decisions. Complete after Section 1; IT will not act until this section is signed off.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {opsField('Access cutoff date', 'accessCutoff')}
          {opsField('Mailbox disposition (shared / forward / hold — to whom)', 'mailbox')}
          {opsField('Electronic file ownership transferred to', 'fileOwner')}
          {opsField('Exceptions or holds (system + until when)', 'exceptions')}
        </div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-gold-muted">Accounts / tools to close</div>
          {!assignRO && <button onClick={addStandardTools} title="Add any standard closing tools (Westlaw, Tybera, court e-filing, Lawline, Courtdrive, …) not already listed" className="text-[11px] font-semibold text-[#3f6b8a] hover:underline">+ Add standard tools</button>}
        </div>
        {RowSection({ listKey: 'accounts', addLabel: '+ Add tool / account', placeholder: 'Account / system name' })}
        {!assignRO && (
          <button onClick={addStandardTools} className="mt-2 w-full border-2 border-dashed border-[#c9b48a] bg-[#fbf7ee] rounded-ctrl py-2 text-sm font-semibold text-[#8a6d3b] hover:bg-[#f6efe0]">
            + Add standard tools (Westlaw, Tybera, court e-filing, Lawline, Courtdrive…)
          </button>
        )}
      </Section>

      {/* Section 3 — IT */}
      <Section heading="Section 3 — IT" blurb="Final technical shutdown and confirmation. Complete only after Sections 1 and 2 are signed off.">
        {RowSection({ listKey: 'it', addLabel: '+ Add IT task', placeholder: 'Task name' })}
      </Section>

      {/* Sign-Off */}
      <Section heading="Sign-Off — Catie" blurb="The offboarding is complete only once all three sections are signed off.">
        <div className="space-y-2">
          {([['hr', 'Pre-Offboarding — Section 1 complete'], ['ops', 'Tools — Section 2 complete'], ['it', 'IT — Section 3 complete']] as const).map(([key, label]) => (
            <div key={key}>{TaskRow({ label,
              get: () => doc.signoff[key] ?? {},
              set: (p, commit) => { apply(d => { d.signoff[key] = { ...(d.signoff[key] ?? {}), ...p }; }); if (commit) persist(); } })}</div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({ heading, blurb, children }: { heading: string; blurb: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-border rounded-card p-5">
      <h3 className="font-spectral text-[16px] font-semibold text-text-primary">{heading}</h3>
      <p className="text-[12px] text-text-muted mb-3 mt-0.5">{blurb}</p>
      {children}
    </div>
  );
}

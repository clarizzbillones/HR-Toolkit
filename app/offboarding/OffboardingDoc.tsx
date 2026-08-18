'use client';
import { useEffect, useRef, useState } from 'react';
import {
  DOC_SECTIONS, BENEFITS_REF, OFFBOARDING_ASSIGNEES,
  docProgress, docSignedOff, newAccount,
  type OffboardingDoc as Doc, type Cell,
} from '@/lib/offboardingDoc';

interface RecLite { id: string; name: string; position: string | null; separation_date: string | null; doc: Doc }

// Catie's streamlined offboarding document: HR → Ops → IT, each task assigned to
// a person who initials + dates it, then Catie signs off each section.
export default function OffboardingDoc({ rec, readOnly, lockAssignment, onSave }: {
  rec: RecLite; readOnly?: boolean; lockAssignment?: boolean; onSave: (doc: Doc) => void;
}) {
  // When lockAssignment is on (anyone who isn't a full-access admin), assigning
  // tasks and adding/removing accounts are locked — they can only fill in their
  // part (initials / date / notes). Full-access admins (Catie/Clarizz) can do all.
  const assignRO = readOnly || lockAssignment;
  const [doc, setDoc] = useState<Doc>(rec.doc);
  const ref = useRef<Doc>(rec.doc);
  // Re-init only when switching to a different record (not on every save round-trip).
  useEffect(() => { setDoc(rec.doc); ref.current = rec.doc; }, [rec.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function apply(mut: (d: Doc) => void): Doc {
    const next: Doc = JSON.parse(JSON.stringify(ref.current));
    mut(next); ref.current = next; setDoc(next); return next;
  }
  const persist = () => onSave(ref.current);
  const done = (c?: Cell) => !!(c && (c.initial ?? '').trim() && (c.date ?? '').trim());

  const { done: dn, total } = docProgress(doc);
  const pct = total ? Math.round((dn / total) * 100) : 0;
  const signed = docSignedOff(doc);

  // One editable cell (Assigned To / Initial / Date / Notes). Text fields save
  // on blur; selects/dates save immediately.
  function CellFields({ get, set }: { get: () => Cell; set: (patch: Partial<Cell>, commit: boolean) => void }) {
    const c = get();
    return (
      <div className="grid grid-cols-2 sm:grid-cols-[130px_70px_140px_1fr] gap-2 mt-2">
        <select disabled={assignRO} value={c.assignee ?? ''} onChange={e => set({ assignee: e.target.value }, true)}
          className="border border-border-light rounded-ctrl px-2 py-1.5 text-sm bg-white focus:outline-none focus:border-ink disabled:bg-[#f6f4f0] disabled:text-text-secondary">
          <option value="">Assign to…</option>
          {c.assignee && !OFFBOARDING_ASSIGNEES.includes(c.assignee as any) && <option value={c.assignee}>{c.assignee}</option>}
          {OFFBOARDING_ASSIGNEES.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <input disabled={readOnly} value={c.initial ?? ''} onChange={e => set({ initial: e.target.value }, false)} onBlur={persist} placeholder="Initials"
          className="border border-border-light rounded-ctrl px-2 py-1.5 text-sm focus:outline-none focus:border-ink text-center uppercase" maxLength={6} />
        <input disabled={readOnly} type="date" value={c.date ?? ''} onChange={e => set({ date: e.target.value }, true)}
          className="border border-border-light rounded-ctrl px-2 py-1.5 text-sm focus:outline-none focus:border-ink" />
        <input disabled={readOnly} value={c.notes ?? ''} onChange={e => set({ notes: e.target.value }, false)} onBlur={persist} placeholder="Notes"
          className="border border-border-light rounded-ctrl px-2 py-1.5 text-sm focus:outline-none focus:border-ink" />
      </div>
    );
  }

  // A titled task row with its cell.
  function TaskRow({ label, hint, get, set }: { label: string; hint?: string; get: () => Cell; set: (p: Partial<Cell>, commit: boolean) => void; }) {
    const complete = done(get());
    return (
      <div className={`rounded-ctrl border px-3 py-2.5 ${complete ? 'border-[#cfe4d8] bg-[#f4faf6]' : 'border-border-light bg-white'}`}>
        <div className="flex items-start gap-2">
          <span className={`mt-0.5 text-sm ${complete ? 'text-[#2f7d5b]' : 'text-text-faint'}`}>{complete ? '✓' : '○'}</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-text-primary">{label}</div>
            {hint && <div className="text-[11px] text-text-muted mt-0.5">{hint}</div>}
          </div>
        </div>
        <CellFields get={get} set={set} />
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

  const hr = DOC_SECTIONS.find(s => s.key === 'hr')!;
  const it = DOC_SECTIONS.find(s => s.key === 'it')!;

  return (
    <div className="space-y-5">
      {/* Progress + sign-off banner */}
      <div className="bg-white border border-border rounded-card p-5">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="font-semibold text-text-secondary">{dn} of {total} tasks initialed & dated</span>
          <span className="text-text-muted">{pct}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-[#eee7da] overflow-hidden"><div className="h-full rounded-full bg-[#c9a24a] transition-all" style={{ width: `${pct}%` }} /></div>
        <div className={`mt-3 text-sm rounded-ctrl px-3 py-2 ${signed ? 'bg-[#eef5f1] text-[#2f7d5b] border border-[#cfe4d8]' : 'bg-[#faf7f0] text-text-secondary border border-[#efe6d5]'}`}>
          {signed
            ? '✓ Signed off by Catie — complete. The employee has been moved to Offboarded and the signed document filed to their Employee File (HR Hub) automatically.'
            : 'Not complete until Catie reviews and signs off all three sections below. On sign-off, the employee is moved to Offboarded and the signed PDF is filed automatically.'}
        </div>
        {lockAssignment && !readOnly && (
          <div className="mt-2 text-[12px] rounded-ctrl px-3 py-2 bg-[#eef2f7] text-[#3f5a76] border border-[#d4e0ec]">
            HR assigns each task and adds accounts. You can mark your part done — add your <b>initials</b>, the <b>date</b>, and any <b>notes</b>. Assigning tasks and adding/removing accounts are done by a full-access admin.
          </div>
        )}
      </div>

      {/* Section 1 — HR */}
      <Section heading={hr.heading} blurb={hr.blurb}>
        <div className="space-y-2">
          {hr.items.map(itm => (
            <TaskRow key={itm.id} label={itm.label} hint={itm.hint}
              get={() => doc.items[itm.id] ?? {}}
              set={(p, commit) => { apply(d => { d.items[itm.id] = { ...(d.items[itm.id] ?? {}), ...p }; }); if (commit) persist(); }} />
          ))}
        </div>
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

      {/* Section 2 — Ops */}
      <Section heading="Section 2 — Ops" blurb="Access, mailbox, and account decisions. Complete after HR; IT will not act until this section is signed off.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {opsField('Access cutoff date', 'accessCutoff')}
          {opsField('Mailbox disposition (shared / forward / hold — to whom)', 'mailbox')}
          {opsField('Electronic file ownership transferred to', 'fileOwner')}
          {opsField('Exceptions or holds (system + until when)', 'exceptions')}
        </div>
        <div className="text-[11px] font-bold uppercase tracking-wider text-gold-muted mb-1.5">Accounts to close</div>
        <div className="space-y-2">
          {doc.accounts.map((a, i) => {
            const complete = done(a.cell);
            return (
              <div key={a.id} className={`rounded-ctrl border px-3 py-2.5 ${complete ? 'border-[#cfe4d8] bg-[#f4faf6]' : 'border-border-light bg-white'}`}>
                <div className="flex items-start gap-2">
                  <span className={`mt-1.5 text-sm ${complete ? 'text-[#2f7d5b]' : 'text-text-faint'}`}>{complete ? '✓' : '○'}</span>
                  <input disabled={assignRO} value={a.label} onChange={e => apply(d => { d.accounts[i].label = e.target.value; })} onBlur={persist}
                    placeholder="Account / system name" className="flex-1 min-w-0 text-sm font-medium text-text-primary bg-transparent border border-transparent hover:border-border-light focus:border-ink rounded px-1.5 py-0.5 focus:outline-none disabled:hover:border-transparent" />
                  {!assignRO && <button onClick={() => { apply(d => { d.accounts.splice(i, 1); }); persist(); }} title="Remove account" className="text-text-muted hover:text-litred-alt text-sm shrink-0">✕</button>}
                </div>
                {a.hint && <div className="text-[11px] text-text-muted mt-0.5 ml-6">{a.hint}</div>}
                <CellFields get={() => doc.accounts[i].cell} set={(p, commit) => { apply(d => { d.accounts[i].cell = { ...d.accounts[i].cell, ...p }; }); if (commit) persist(); }} />
              </div>
            );
          })}
          {!assignRO && <button onClick={() => { apply(d => { d.accounts.push(newAccount()); }); persist(); }} className="w-full border-2 border-dashed border-border-light rounded-ctrl py-2 text-sm font-semibold text-text-muted hover:text-ink hover:border-ink">+ Add account</button>}
        </div>
      </Section>

      {/* Section 3 — IT */}
      <Section heading={it.heading} blurb={it.blurb}>
        <div className="space-y-2">
          {it.items.map(itm => (
            <TaskRow key={itm.id} label={itm.label} hint={itm.hint}
              get={() => doc.items[itm.id] ?? {}}
              set={(p, commit) => { apply(d => { d.items[itm.id] = { ...(d.items[itm.id] ?? {}), ...p }; }); if (commit) persist(); }} />
          ))}
        </div>
      </Section>

      {/* Sign-Off */}
      <Section heading="Sign-Off — Catie" blurb="The offboarding is complete only once all three sections are signed off.">
        <div className="space-y-2">
          {([['hr', 'HR — Section 1 complete'], ['ops', 'Ops — Section 2 complete'], ['it', 'IT — Section 3 complete']] as const).map(([key, label]) => (
            <TaskRow key={key} label={label}
              get={() => doc.signoff[key] ?? {}}
              set={(p, commit) => { apply(d => { d.signoff[key] = { ...(d.signoff[key] ?? {}), ...p }; }); if (commit) persist(); }} />
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

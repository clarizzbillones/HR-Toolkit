'use client';
import { useEffect, useRef, useState } from 'react';
import {
  ONB_DOC_SECTIONS, ONB_BENEFITS_REF, ONBOARDING_ASSIGNEES,
  docProgress, docSignedOff, newAccount, templateFromDoc,
  type OnboardingDoc as Doc, type Cell, type DocTemplate,
} from '@/lib/onboardingDoc';

const ASSIGNEE_LIST_ID = 'onb-assignees';

interface RecLite { id: string; name: string; position: string | null; start_date: string | null; doc: Doc }

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(String(iso).slice(0, 10) + 'T12:00:00');
  return isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function esc(s: any) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// Catie's streamlined onboarding document: HR → Ops → IT, each task assigned to
// a person with a deadline, who then initials + dates it, then Catie signs off
// each section. Mirrors the offboarding document.
export default function OnboardingDoc({ rec, readOnly, lockAssignment, assignees, onAddAssignee, onTemplateSave, onSave }: {
  rec: RecLite; readOnly?: boolean; lockAssignment?: boolean;
  assignees?: string[];
  onAddAssignee?: (name: string) => void;
  onTemplateSave?: (rows: Omit<DocTemplate, 'assignees'>) => void;
  onSave: (doc: Doc) => void;
}) {
  // When lockAssignment is on (granted editors who aren't full-access admins),
  // the "Assigned to" and "Deadline" are set by an admin up front and can't be
  // changed — they can only mark their part done (initials / date / notes).
  const assignRO = readOnly || lockAssignment;
  const assigneeList = assignees && assignees.length ? assignees : [...ONBOARDING_ASSIGNEES];
  const [doc, setDoc] = useState<Doc>(rec.doc);
  const ref = useRef<Doc>(rec.doc);
  // Re-init only when switching to a different record (not on every save round-trip).
  useEffect(() => { setDoc(rec.doc); ref.current = rec.doc; }, [rec.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function apply(mut: (d: Doc) => void): Doc {
    const next: Doc = JSON.parse(JSON.stringify(ref.current));
    mut(next); ref.current = next; setDoc(next); return next;
  }
  const persist = () => onSave(ref.current);
  // Structural edits (rename / add / remove a row) update the SHARED template so
  // every hire's document stays the same; cell edits stay on this hire.
  const saveStructure = () => { persist(); onTemplateSave?.(templateFromDoc(ref.current)); };
  const done = (c?: Cell) => !!(c && (c.initial ?? '').trim() && (c.date ?? '').trim());

  const { done: dn, total } = docProgress(doc);
  const pct = total ? Math.round((dn / total) * 100) : 0;
  const signed = docSignedOff(doc);

  // One editable cell (Assigned To / Deadline / Initial / Date done / Notes).
  // Text fields save on blur; selects/dates save immediately.
  function CellFields({ get, set }: { get: () => Cell; set: (patch: Partial<Cell>, commit: boolean) => void }) {
    const c = get();
    return (
      <div className="grid grid-cols-2 sm:grid-cols-[130px_140px_70px_140px_1fr] gap-x-2 gap-y-1 mt-2">
        {/* Column captions — shown once per row so the two date fields read clearly */}
        <span className="hidden sm:block text-[9px] font-bold uppercase tracking-wider text-text-faint">Assigned to</span>
        <span className="hidden sm:block text-[9px] font-bold uppercase tracking-wider text-[#b07d2a]">Deadline</span>
        <span className="hidden sm:block text-[9px] font-bold uppercase tracking-wider text-text-faint">Initials</span>
        <span className="hidden sm:block text-[9px] font-bold uppercase tracking-wider text-[#2f7d5b]">Date done</span>
        <span className="hidden sm:block text-[9px] font-bold uppercase tracking-wider text-text-faint">Notes</span>
        <input list={ASSIGNEE_LIST_ID} disabled={assignRO} value={c.assignee ?? ''} placeholder="Assign to…"
          onChange={e => set({ assignee: e.target.value }, false)}
          onBlur={() => { persist(); const v = (get().assignee ?? '').trim(); if (v && !assigneeList.includes(v)) onAddAssignee?.(v); }}
          className="border border-border-light rounded-ctrl px-2 py-1.5 text-sm bg-white focus:outline-none focus:border-ink disabled:bg-[#f6f4f0] disabled:text-text-secondary" />
        <input disabled={assignRO} type="date" value={c.deadline ?? ''} onChange={e => set({ deadline: e.target.value }, true)} title="Deadline"
          className="border border-border-light rounded-ctrl px-2 py-1.5 text-sm focus:outline-none focus:border-ink bg-[#fdf9f1] disabled:bg-[#f6f4f0] [color-scheme:light]" />
        <input disabled={readOnly} value={c.initial ?? ''} onChange={e => set({ initial: e.target.value }, false)} onBlur={persist} placeholder="—"
          className="border border-border-light rounded-ctrl px-2 py-1.5 text-sm focus:outline-none focus:border-ink text-center uppercase" maxLength={6} />
        <input disabled={readOnly} type="date" value={c.date ?? ''} onChange={e => set({ date: e.target.value }, true)} title="Date completed"
          className="border border-border-light rounded-ctrl px-2 py-1.5 text-sm focus:outline-none focus:border-ink bg-[#f6faf7] [color-scheme:light]" />
        <input disabled={readOnly} value={c.notes ?? ''} onChange={e => set({ notes: e.target.value }, false)} onBlur={persist} placeholder="Notes"
          className="border border-border-light rounded-ctrl px-2 py-1.5 text-sm focus:outline-none focus:border-ink" />
      </div>
    );
  }

  // A titled task row with its cell.
  function TaskRow({ label, hint, get, set }: { label: string; hint?: string; get: () => Cell; set: (p: Partial<Cell>, commit: boolean) => void; }) {
    const c = get();
    const complete = done(c);
    return (
      <div className={`rounded-ctrl border px-3 py-2.5 ${complete ? 'border-[#cfe4d8] bg-[#f4faf6]' : 'border-border-light bg-white'}`}>
        <div className="flex items-start gap-2">
          <span className={`mt-0.5 text-sm ${complete ? 'text-[#2f7d5b]' : 'text-text-faint'}`}>{complete ? '✓' : '○'}</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-text-primary">{label}</div>
            {hint && <div className="text-[11px] text-text-muted mt-0.5">{hint}</div>}
          </div>
          {!complete && c.deadline && <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#f7efe1] text-[#b07d2a]" title="Deadline">Due {fmtDate(c.deadline)}</span>}
        </div>
        {CellFields({ get, set })}
      </div>
    );
  }

  // An editable list of rows for a section — rename the label, remove a row, add
  // rows, and fill each cell. Structural edits (rename/add/remove) are locked
  // for granted editors (assignRO); they can still fill in initials/date/notes.
  function RowSection({ listKey, addLabel, placeholder }: { listKey: 'hr' | 'accounts' | 'it'; addLabel: string; placeholder: string }) {
    const rows = doc[listKey];
    return (
      <div className="space-y-2">
        {rows.map((a, i) => {
          const complete = done(a.cell);
          return (
            <div key={a.id} className={`rounded-ctrl border px-3 py-2.5 ${complete ? 'border-[#cfe4d8] bg-[#f4faf6]' : 'border-border-light bg-white'}`}>
              <div className="flex items-start gap-2">
                <span className={`mt-1.5 text-sm ${complete ? 'text-[#2f7d5b]' : 'text-text-faint'}`}>{complete ? '✓' : '○'}</span>
                <input disabled={assignRO} value={a.label} onChange={e => apply(d => { d[listKey][i].label = e.target.value; })} onBlur={saveStructure}
                  placeholder={placeholder} className="flex-1 min-w-0 text-sm font-medium text-text-primary bg-transparent border border-transparent hover:border-border-light focus:border-ink rounded px-1.5 py-0.5 focus:outline-none disabled:hover:border-transparent" />
                {!complete && a.cell.deadline && <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#f7efe1] text-[#b07d2a]" title="Deadline">Due {fmtDate(a.cell.deadline)}</span>}
                {!assignRO && <button onClick={() => { apply(d => { d[listKey].splice(i, 1); }); saveStructure(); }} title="Remove row" className="text-text-muted hover:text-litred-alt text-sm shrink-0">✕</button>}
              </div>
              {a.hint && <div className="text-[11px] text-text-muted mt-0.5 ml-6">{a.hint}</div>}
              {CellFields({ get: () => doc[listKey][i].cell, set: (p, commit) => { apply(d => { d[listKey][i].cell = { ...d[listKey][i].cell, ...p }; }); if (commit) persist(); } })}
            </div>
          );
        })}
        {!assignRO && <button onClick={() => { apply(d => { d[listKey].push(newAccount()); }); saveStructure(); }} className="w-full border-2 border-dashed border-border-light rounded-ctrl py-2 text-sm font-semibold text-text-muted hover:text-ink hover:border-ink">{addLabel}</button>}
      </div>
    );
  }

  const hr = ONB_DOC_SECTIONS.find(s => s.key === 'hr')!;
  const it = ONB_DOC_SECTIONS.find(s => s.key === 'it')!;

  // Print / PDF of the current document.
  function printDoc() {
    const win = window.open('', '_blank'); if (!win) return;
    const d = doc;
    const th = (h: string[]) => `<tr>${h.map(x => `<th style="text-align:left;padding:5px 7px;font-size:8.5px;text-transform:uppercase;letter-spacing:.05em;color:#8a8474;border-bottom:1.5px solid #e6ddcd">${esc(x)}</th>`).join('')}</tr>`;
    const cellRow = (label: string, hint: string | undefined, c: any) => `<tr style="border-bottom:1px solid #f1ece3">
      <td style="padding:6px 7px;font-size:12px;vertical-align:top">${esc(label)}${hint ? `<div style="color:#8a8474;font-size:10px">${esc(hint)}</div>` : ''}</td>
      <td style="padding:6px 7px;font-size:12px">${esc(c?.assignee || '')}</td>
      <td style="padding:6px 7px;font-size:12px;white-space:nowrap">${esc(fmtDate(c?.deadline) || '')}</td>
      <td style="padding:6px 7px;font-size:12px;text-transform:uppercase">${esc(c?.initial || '')}</td>
      <td style="padding:6px 7px;font-size:12px;white-space:nowrap">${esc(fmtDate(c?.date) || '')}</td>
      <td style="padding:6px 7px;font-size:11px;color:#555">${esc(c?.notes || '')}</td>
    </tr>`;
    const table = (rows: string) => `<table style="width:100%;border-collapse:collapse;margin-top:6px"><thead>${th(['Item', 'Assigned To', 'Deadline', 'Initial', 'Date done', 'Notes'])}</thead><tbody>${rows}</tbody></table>`;
    const sectionHead = (h: string, blurb: string) => `<div style="font-size:13px;font-weight:700;color:#1b2a3d;margin-top:18px">${esc(h)}</div><div style="font-size:11px;color:#8a8474">${esc(blurb)}</div>`;
    const benefits = `<div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#8a6d3b;margin-top:12px">Benefits quick reference</div>
      <table style="width:100%;border-collapse:collapse;margin-top:4px"><thead>${th(['Benefit', 'Coverage begins', 'Notes'])}</thead><tbody>${ONB_BENEFITS_REF.map(b => `<tr style="border-bottom:1px solid #f1ece3"><td style="padding:5px 7px;font-size:12px;font-weight:600">${esc(b.benefit)}</td><td style="padding:5px 7px;font-size:12px">${esc(b.begins)}</td><td style="padding:5px 7px;font-size:11px;color:#555">${esc(b.notes)}</td></tr>`).join('')}</tbody></table>`;
    const signoff = `<div style="font-size:13px;font-weight:700;color:#1b2a3d;margin-top:18px">Sign-Off — Catie</div>
      ${table([['hr', 'HR — Section 1 complete'], ['ops', 'Ops — Section 2 complete'], ['it', 'IT — Section 3 complete']].map(([k, l]) => cellRow(l, undefined, (d.signoff as any)[k])).join(''))}`;
    const meta = (l: string, v: string) => `<div style="min-width:150px"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#8a8474">${esc(l)}</div><div style="font-weight:600;color:#1b2a3d">${esc(v) || '—'}</div></div>`;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Onboarding Document — ${esc(rec.name)}</title>
<style>@page{size:letter;margin:0.5in}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0;background:#faf8f4;padding:22px;font-family:Georgia,'Times New Roman',serif;color:#1b2a3d}table{page-break-inside:auto}tr{page-break-inside:avoid}</style></head><body>
<div style="max-width:760px;margin:0 auto">
  <div style="background:#1b2a3d;border-top:3px solid #c9a24a;border-radius:10px;padding:16px 18px">
    <div style="font-size:15px;font-weight:700;letter-spacing:4px;color:#c9a24a">LITSON PLLC</div>
    <div style="font-size:19px;font-weight:700;color:#fff;margin-top:8px">Employee Onboarding Checklist</div>
    <div style="font-size:10px;color:#9fb0c4;margin-top:3px">Complete in order: HR first, then Ops, then IT. Each item is assigned with a deadline, then signed off with initials and a date as it's completed.</div>
  </div>
  <div style="display:flex;gap:22px;flex-wrap:wrap;padding:14px 2px;border-bottom:1px solid #e6ddcd">
    ${meta('Employee name', rec.name)}${meta('Position / Title', rec.position || '')}${meta('Start date', fmtDate(rec.start_date))}
  </div>
  ${sectionHead(hr.heading, hr.blurb)}${table(d.hr.map(r => cellRow(r.label, r.hint, r.cell)).join(''))}${benefits}
  ${sectionHead('Section 2 — Ops', 'Accounts to open for the new hire. Complete after HR; IT will not act until this section is signed off.')}
  <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#8a6d3b;margin-top:10px">Accounts to open</div>${table(d.accounts.map(a => cellRow(a.label, a.hint, a.cell)).join(''))}
  ${sectionHead(it.heading, it.blurb)}${table(d.it.map(r => cellRow(r.label, r.hint, r.cell)).join(''))}
  ${signoff}
  <div style="margin-top:18px;font-size:11px;font-style:italic;color:#8a8474;border-top:1px solid #e6ddcd;padding-top:8px">Onboarding is complete only once Catie has signed off all three sections. The signed document files automatically to the employee's Employee File (HR Hub).</div>
</div>
<script>window.onload=function(){window.print()}</script></body></html>`);
    win.document.close();
  }

  return (
    <div className="space-y-5">
      {/* Assignee suggestions — built-in names plus any the firm has added. Type a
          new name in any "Assign to" box to add it for everyone. */}
      <datalist id={ASSIGNEE_LIST_ID}>{assigneeList.map(a => <option key={a} value={a} />)}</datalist>
      {/* Progress + sign-off banner */}
      <div className="bg-white border border-border rounded-card p-5">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Onboarding document · HR → Ops → IT</div>
          <button onClick={printDoc} className="text-[11px] font-semibold text-ink border border-border-light px-2.5 py-1 rounded-ctrl hover:bg-canvas">⤓ Print / PDF</button>
        </div>
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="font-semibold text-text-secondary">{dn} of {total} tasks initialed & dated</span>
          <span className="text-text-muted">{pct}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-[#eee7da] overflow-hidden"><div className="h-full rounded-full bg-[#c9a24a] transition-all" style={{ width: `${pct}%` }} /></div>
        <div className={`mt-3 text-sm rounded-ctrl px-3 py-2 ${signed ? 'bg-[#eef5f1] text-[#2f7d5b] border border-[#cfe4d8]' : 'bg-[#faf7f0] text-text-secondary border border-[#efe6d5]'}`}>
          {signed
            ? '✓ Signed off by Catie — complete. The signed document has been filed to this hire’s Employee File (HR Hub) automatically.'
            : 'Not complete until Catie reviews and signs off all three sections below. On sign-off, the signed PDF is filed to the Employee File automatically.'}
        </div>
        {lockAssignment && !readOnly && (
          <div className="mt-2 text-[12px] rounded-ctrl px-3 py-2 bg-[#eef2f7] text-[#3f5a76] border border-[#d4e0ec]">
            HR assigns each task and its deadline. You can mark your part done — add your <b>initials</b>, the <b>date</b>, and any <b>notes</b>. The Assigned&nbsp;to and Deadline are set by HR and locked.
          </div>
        )}
      </div>

      {/* Section 1 — HR */}
      <Section heading={hr.heading} blurb={hr.blurb}>
        {RowSection({ listKey: 'hr', addLabel: '+ Add HR task', placeholder: 'Task name' })}
        {/* Benefits quick reference */}
        <div className="mt-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-gold-muted mb-1.5">Benefits quick reference</div>
          <div className="overflow-x-auto border border-border-light rounded-ctrl">
            <table className="w-full text-sm min-w-[560px]">
              <thead className="bg-[#faf7f0]"><tr>{['Benefit', 'Coverage begins', 'Notes'].map(h => <th key={h} className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-text-muted">{h}</th>)}</tr></thead>
              <tbody>{ONB_BENEFITS_REF.map((b, i) => (
                <tr key={i} className="border-t border-[#f1ece3]"><td className="px-3 py-2 font-medium text-text-primary">{b.benefit}</td><td className="px-3 py-2 text-text-secondary">{b.begins}</td><td className="px-3 py-2 text-text-muted">{b.notes}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      </Section>

      {/* Section 2 — Ops */}
      <Section heading="Section 2 — Ops" blurb="Accounts to open for the new hire. Complete after HR; IT will not act until this section is signed off.">
        <div className="text-[11px] font-bold uppercase tracking-wider text-gold-muted mb-1.5">Accounts to open</div>
        {RowSection({ listKey: 'accounts', addLabel: '+ Add account', placeholder: 'Account / system name' })}
      </Section>

      {/* Section 3 — IT */}
      <Section heading={it.heading} blurb={it.blurb}>
        {RowSection({ listKey: 'it', addLabel: '+ Add IT task', placeholder: 'Task name' })}
      </Section>

      {/* Sign-Off */}
      <Section heading="Sign-Off — Catie" blurb="Onboarding is complete only once all three sections are signed off.">
        <div className="space-y-2">
          {([['hr', 'HR — Section 1 complete'], ['ops', 'Ops — Section 2 complete'], ['it', 'IT — Section 3 complete']] as const).map(([key, label]) => (
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

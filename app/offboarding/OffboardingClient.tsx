'use client';
import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';
import { useAccess } from '@/components/AccessProvider';
import {
  OFFBOARDING_CHECKLIST, OFFBOARDING_ITEMS, SEPARATION_TYPES,
  activeProgress, offboardingStatus, isItemExcluded, ageAt, tenureLabel, defaultExcluded,
} from '@/lib/offboarding';
import { EXIT_QUESTIONS as EXIT_Q } from '@/lib/exitInterview';
import OffboardingDoc from './OffboardingDoc';
import { DOC_SECTIONS, BENEFITS_REF, type OffboardingDoc as Doc } from '@/lib/offboardingDoc';

interface Rec {
  id: string; name: string; position: string | null; manager: string | null;
  separation_date: string | null; separation_type: string | null; prepared_by: string | null;
  checklist: Record<string, boolean>; excluded: Record<string, boolean>; offer_severance: boolean;
  dob: string | null; hire_date: string | null; notes: string | null; offboarded?: boolean;
  doc: Doc;
}
interface Emp { name: string; position: string | null; dob: string | null; start_date: string | null; email?: string | null }

const STATUS_PILL: Record<string, string> = {
  'Complete': 'bg-[#eef5f1] text-[#2f7d5b]', 'In progress': 'bg-[#f7efe1] text-[#b07d2a]', 'Not started': 'bg-[#f1ece3] text-[#8b8478]',
};
function fmtDate(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(String(iso).slice(0, 10) + 'T12:00:00');
  return isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function esc(s: any) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

export default function OffboardingClient() {
  const { showToast } = useToast();
  const { me } = useAccess(); const readOnly = !!me?.restricted;
  const [rows, setRows] = useState<Rec[]>([]);
  const [employees, setEmployees] = useState<Emp[]>([]);
  const [loading, setLoading] = useState(true);
  const [selId, setSelId] = useState<string | null>(null);
  // Which view of a record: Catie's streamlined signed document, or the longer
  // legal-compliance checklist. Default to the document (the go-forward process).
  const [docView, setDocView] = useState<'document' | 'compliance'>('document');
  const [showAdd, setShowAdd] = useState(false);
  const emptyForm = { name: '', position: '', manager: '', separation_date: '', separation_type: SEPARATION_TYPES[0], prepared_by: '', dob: '', hire_date: '', offer_severance: false };
  const [form, setForm] = useState({ ...emptyForm });

  const input = 'w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink';

  useEffect(() => { void load(); }, []);
  async function load() {
    setLoading(true);
    try {
      const d = await fetch('/api/offboarding').then(r => r.json());
      setRows(d.rows ?? []); setEmployees(d.employees ?? []);
    } catch { showToast('Could not load'); }
    finally { setLoading(false); }
  }

  const selected = rows.find(r => r.id === selId) ?? null;

  // ---- Exit interview ----
  const [exitRec, setExitRec] = useState<any>(null);
  const [exitEmail, setExitEmail] = useState('');
  const [exitBusy, setExitBusy] = useState(false);
  useEffect(() => {
    if (!selId || !selected) { setExitRec(null); return; }
    setExitEmail(employees.find(e => e.name === selected.name)?.email ?? '');
    fetch(`/api/offboarding/exit?offboardingId=${selId}`).then(r => r.json()).then(d => setExitRec(d.row ?? null)).catch(() => setExitRec(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selId]);
  async function deleteExit() {
    if (!exitRec?.id) { setExitRec(null); return; }
    if (!confirm('Delete this exit interview' + (exitRec.status === 'Completed' ? ' and its responses' : '') + '?')) return;
    await fetch(`/api/offboarding/exit?id=${exitRec.id}`, { method: 'DELETE' });
    setExitRec(null); showToast('Exit interview deleted');
  }
  async function sendExit(resend = false) {
    if (!selected) return;
    setExitBusy(true);
    try {
      const res = await fetch('/api/offboarding/exit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send', offboarding_id: selected.id, employee_name: selected.name, employee_email: exitEmail.trim() }) });
      const d = await res.json();
      if (!res.ok) { showToast(d.error || 'Could not send'); return; }
      setExitRec({ id: d.id, status: 'Sent', token: d.url.split('/').pop(), employee_email: exitEmail.trim() });
      showToast(d.emailed ? (resend ? 'Exit interview re-sent' : 'Exit interview sent') : 'Created — copy the link');
    } catch { showToast('Could not send'); }
    finally { setExitBusy(false); }
  }

  async function addRecord() {
    if (!form.name.trim()) { showToast('Pick or type an employee'); return; }
    const res = await fetch('/api/offboarding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const d = await res.json();
    if (!res.ok) { showToast(d.error || 'Failed'); return; }
    setRows(p => [d.row, ...p]); setShowAdd(false); setForm({ ...emptyForm });
    setSelId(d.row.id); showToast('Offboarding started');
  }

  async function patch(id: string, changes: Partial<Rec>) {
    setRows(p => p.map(r => r.id === id ? { ...r, ...changes } as Rec : r));
    try {
      const res = await fetch('/api/offboarding', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...changes }) });
      const d = await res.json();
      if (d.row) setRows(p => p.map(r => r.id === id ? d.row : r));
    } catch { showToast('Save failed'); }
  }
  async function toggleItem(rec: Rec, itemId: string) {
    if (readOnly) return;
    const checklist = { ...rec.checklist, [itemId]: !rec.checklist[itemId] };
    await patch(rec.id, { checklist });
    // When the checklist reaches Complete, move the employee to Offboarded in
    // Staffing & Employee Files automatically (same as the manual button).
    // Guarded by !rec.offboarded so it fires once, on the transition.
    if (!rec.offboarded && offboardingStatus({ ...rec, checklist } as any) === 'Complete') {
      await markOffboarded({ ...rec, checklist }, true);
    }
  }
  function toggleExclude(rec: Rec, itemId: string) {
    if (readOnly) return;
    const excluded = { ...rec.excluded };
    if (excluded[itemId]) delete excluded[itemId]; else excluded[itemId] = true;
    patch(rec.id, { excluded });
  }
  function applyAgeSuggestion(rec: Rec) {
    const sugg = defaultExcluded(rec.dob, rec.separation_date);
    const excluded = { ...rec.excluded };
    for (const it of OFFBOARDING_ITEMS) if (it.age40) { if (sugg[it.id]) excluded[it.id] = true; else delete excluded[it.id]; }
    patch(rec.id, { excluded });
    showToast('Applied age suggestion');
  }
  async function markOffboarded(rec: Rec, on: boolean) {
    const res = await fetch('/api/offboarding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'mark-offboarded', id: rec.id, offboarded: on }) });
    const d = await res.json();
    if (d.row) setRows(p => p.map(r => r.id === rec.id ? d.row : r));
    showToast(on ? `${rec.name} moved to Offboarded` : 'Restored to active');
  }
  async function remove(rec: Rec) {
    if (!confirm(`Delete offboarding for ${rec.name}?`)) return;
    await fetch(`/api/offboarding?id=${rec.id}`, { method: 'DELETE' });
    setRows(p => p.filter(r => r.id !== rec.id)); setSelId(null); showToast('Deleted');
  }

  // Normalize any stored date (ISO or mm/dd/yyyy) to yyyy-mm-dd for date inputs.
  function toISO(s: any): string {
    if (!s) return '';
    const str = String(s).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
    const m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/.exec(str);
    if (m) { let y = +m[3]; if (y < 100) y += y < 30 ? 2000 : 1900; return `${y}-${String(+m[1]).padStart(2, '0')}-${String(+m[2]).padStart(2, '0')}`; }
    return '';
  }
  function pickEmployee(name: string) {
    const emp = employees.find(e => e.name === name);
    setForm(f => ({ ...f, name, position: emp?.position ?? f.position, dob: toISO(emp?.dob) || f.dob, hire_date: toISO(emp?.start_date) || f.hire_date }));
  }

  function printDoc(rec: Rec) {
    const win = window.open('', '_blank'); if (!win) return;
    const { done, total } = activeProgress(rec);
    const meta = (l: string, v: string) => `<div style="min-width:150px"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#8a8474">${esc(l)}</div><div style="font-weight:600;color:#1b2a3d">${esc(v) || '—'}</div></div>`;
    const sections = OFFBOARDING_CHECKLIST.map(s => {
      const items = s.items.filter(it => !isItemExcluded(rec, s, it));
      if (!items.length) return '';
      return `<div style="margin-top:16px">
        <div style="font-size:12px;font-weight:700;color:#1b2a3d">${esc(s.heading)} <span style="font-weight:400;color:#8a8474">· ${esc(s.chapter)}</span></div>
        ${items.map(it => `<div style="display:flex;gap:8px;margin-top:5px;font-size:13px;line-height:1.45"><span style="color:${rec.checklist[it.id] ? '#2f7d5b' : '#b9b1a2'};font-weight:700">${rec.checklist[it.id] ? '☑' : '☐'}</span><span>${esc(it.label)}${it.hint ? ` <span style="color:#8a8474;font-size:11px">(${esc(it.hint)})</span>` : ''}</span></div>`).join('')}
      </div>`;
    }).join('');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Offboarding — ${esc(rec.name)}</title>
<style>@page{size:letter;margin:0.55in}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0;background:#faf8f4;padding:24px;font-family:Georgia,'Times New Roman',serif;color:#1b2a3d}</style></head><body>
<div style="max-width:720px;margin:0 auto">
  <div style="background:#1b2a3d;border-top:3px solid #c9a24a;border-radius:10px;padding:16px 18px">
    <div style="font-size:15px;font-weight:700;letter-spacing:4px;color:#c9a24a">LITSON</div>
    <div style="font-size:7.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#9fb0c4;margin-top:2px">PLLC &middot; Human Resources</div>
    <div style="font-size:19px;font-weight:700;color:#fff;margin-top:9px">Separation / Offboarding Checklist</div>
  </div>
  <div style="display:flex;gap:22px;flex-wrap:wrap;padding:14px 2px;border-bottom:1px solid #e6ddcd">
    ${meta('Employee', rec.name)}${meta('Position', rec.position || '')}${meta('Manager', rec.manager || '')}
    ${meta('Separation date', fmtDate(rec.separation_date))}${meta('Type', rec.separation_type || '')}${meta('Prepared by', rec.prepared_by || '')}
  </div>
  <div style="margin-top:10px;font-size:13px;color:#8a8474">${done} of ${total} steps complete${rec.offer_severance ? '' : ' · severance section not applicable'}</div>
  ${sections}
  ${rec.notes ? `<div style="margin-top:18px"><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#8a8474">Notes</div><div style="font-size:13px;white-space:pre-wrap;margin-top:4px">${esc(rec.notes)}</div></div>` : ''}
  <div style="margin-top:20px;font-size:11px;font-style:italic;color:#8a8474;border-top:1px solid #e6ddcd;padding-top:8px">Built from the LITSON PLLC HR Compliance &amp; Risk Management Manual. Severance &amp; release steps require a lawyer's review before use.</div>
</div>
<script>window.onload=function(){window.print()}</script></body></html>`);
    win.document.close();
  }

  // Print Catie's signed Offboarding Document (HR → Ops → IT, initials/dates).
  function printOffDoc(rec: Rec) {
    const win = window.open('', '_blank'); if (!win) return;
    const d = rec.doc;
    const th = (h: string[]) => `<tr>${h.map(x => `<th style="text-align:left;padding:5px 7px;font-size:8.5px;text-transform:uppercase;letter-spacing:.05em;color:#8a8474;border-bottom:1.5px solid #e6ddcd">${esc(x)}</th>`).join('')}</tr>`;
    const cellRow = (label: string, hint: string | undefined, c: any) => `<tr style="border-bottom:1px solid #f1ece3">
      <td style="padding:6px 7px;font-size:12px;vertical-align:top">${esc(label)}${hint ? `<div style="color:#8a8474;font-size:10px">${esc(hint)}</div>` : ''}</td>
      <td style="padding:6px 7px;font-size:12px">${esc(c?.assignee || '')}</td>
      <td style="padding:6px 7px;font-size:12px;text-transform:uppercase">${esc(c?.initial || '')}</td>
      <td style="padding:6px 7px;font-size:12px;white-space:nowrap">${esc(fmtDate(c?.date) || '')}</td>
      <td style="padding:6px 7px;font-size:11px;color:#555">${esc(c?.notes || '')}</td>
    </tr>`;
    const table = (rows: string) => `<table style="width:100%;border-collapse:collapse;margin-top:6px"><thead>${th(['Item', 'Assigned To', 'Initial', 'Date', 'Notes'])}</thead><tbody>${rows}</tbody></table>`;
    const hr = DOC_SECTIONS.find(s => s.key === 'hr')!;
    const it = DOC_SECTIONS.find(s => s.key === 'it')!;
    const sectionHead = (h: string, blurb: string) => `<div style="font-size:13px;font-weight:700;color:#1b2a3d;margin-top:18px">${esc(h)}</div><div style="font-size:11px;color:#8a8474">${esc(blurb)}</div>`;
    const benefits = `<div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#8a6d3b;margin-top:12px">Benefits quick reference</div>
      <table style="width:100%;border-collapse:collapse;margin-top:4px"><thead>${th(['Benefit', 'Coverage ends', 'Notes'])}</thead><tbody>${BENEFITS_REF.map(b => `<tr style="border-bottom:1px solid #f1ece3"><td style="padding:5px 7px;font-size:12px;font-weight:600">${esc(b.benefit)}</td><td style="padding:5px 7px;font-size:12px">${esc(b.ends)}</td><td style="padding:5px 7px;font-size:11px;color:#555">${esc(b.notes)}</td></tr>`).join('')}</tbody></table>`;
    const opsInfo = `<div style="margin-top:8px;font-size:12px;line-height:1.7">
      <div><b>Access cutoff date:</b> ${esc(d.ops.accessCutoff || '—')}</div>
      <div><b>Mailbox disposition:</b> ${esc(d.ops.mailbox || '—')}</div>
      <div><b>Electronic file ownership transferred to:</b> ${esc(d.ops.fileOwner || '—')}</div>
      <div><b>Exceptions or holds:</b> ${esc(d.ops.exceptions || '—')}</div></div>`;
    const signoff = `<div style="font-size:13px;font-weight:700;color:#1b2a3d;margin-top:18px">Sign-Off — Catie</div>
      ${table([['hr', 'HR — Section 1 complete'], ['ops', 'Ops — Section 2 complete'], ['it', 'IT — Section 3 complete']].map(([k, l]) => cellRow(l, undefined, (d.signoff as any)[k])).join(''))}`;
    const meta = (l: string, v: string) => `<div style="min-width:150px"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#8a8474">${esc(l)}</div><div style="font-weight:600;color:#1b2a3d">${esc(v) || '—'}</div></div>`;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Offboarding Document — ${esc(rec.name)}</title>
<style>@page{size:letter;margin:0.5in}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0;background:#faf8f4;padding:22px;font-family:Georgia,'Times New Roman',serif;color:#1b2a3d}table{page-break-inside:auto}tr{page-break-inside:avoid}</style></head><body>
<div style="max-width:740px;margin:0 auto">
  <div style="background:#1b2a3d;border-top:3px solid #c9a24a;border-radius:10px;padding:16px 18px">
    <div style="font-size:15px;font-weight:700;letter-spacing:4px;color:#c9a24a">LITSON PLLC</div>
    <div style="font-size:19px;font-weight:700;color:#fff;margin-top:8px">Employee Offboarding Checklist</div>
    <div style="font-size:10px;color:#9fb0c4;margin-top:3px">Complete in order: HR first, then Ops, then IT. Each item is signed off with initials and a date as it's completed.</div>
  </div>
  <div style="display:flex;gap:22px;flex-wrap:wrap;padding:14px 2px;border-bottom:1px solid #e6ddcd">
    ${meta('Employee name', rec.name)}${meta('Position / Title', rec.position || '')}${meta('Last day of employment', fmtDate(rec.separation_date))}
  </div>
  ${sectionHead(hr.heading, hr.blurb)}${table(hr.items.map(i => cellRow(i.label, i.hint, d.items[i.id])).join(''))}${benefits}
  ${sectionHead('Section 2 — Ops', 'Access, mailbox, and account decisions. Complete after HR; IT will not act until this section is signed off.')}${opsInfo}
  <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#8a6d3b;margin-top:10px">Accounts to close</div>${table(d.accounts.map(a => cellRow(a.label, a.hint, a.cell)).join(''))}
  ${sectionHead(it.heading, it.blurb)}${table(it.items.map(i => cellRow(i.label, i.hint, d.items[i.id])).join(''))}
  ${signoff}
  <div style="margin-top:18px;font-size:11px;font-style:italic;color:#8a8474;border-top:1px solid #e6ddcd;padding-top:8px">Offboarding is complete only once Catie has signed off all three sections. File the completed document in the employee's Employee File (HR Hub).</div>
</div>
<script>window.onload=function(){window.print()}</script></body></html>`);
    win.document.close();
  }

  // ---- Detail view ----
  if (selected) {
    const rec = selected;
    const { done, total } = activeProgress(rec);
    const pct = total ? Math.round((done / total) * 100) : 0;
    const status = offboardingStatus(rec);
    const age = ageAt(rec.dob, rec.separation_date);
    const tenureStr = tenureLabel(rec.hire_date, rec.separation_date);
    const field = (label: string, key: keyof Rec, type = 'text') => (
      <div>
        <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1">{label}</label>
        {type === 'select'
          ? <select disabled={readOnly} value={(rec[key] as string) ?? ''} onChange={e => patch(rec.id, { [key]: e.target.value } as any)} className={input + ' bg-white'}>
              {SEPARATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          : <input disabled={readOnly} type={type} value={(rec[key] as string) ?? ''} onChange={e => patch(rec.id, { [key]: e.target.value } as any)} className={input} />}
      </div>
    );
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <header className="px-8 py-4 bg-white border-b border-border flex-shrink-0 flex items-center gap-3">
          <button onClick={() => setSelId(null)} className="text-sm font-semibold text-text-secondary hover:text-ink">← All offboarding</button>
          <span className="text-text-faint">/</span>
          <span className="text-sm font-semibold text-text-primary">{rec.name}</span>
          <span className={`ml-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_PILL[status]}`}>{status}</span>
          <div className="ml-auto flex items-center gap-2">
            {rec.offboarded && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#eceff3] text-[#4a5a6d]">Offboarded</span>}
            {!readOnly && (rec.offboarded
              ? <button onClick={() => markOffboarded(rec, false)} className="text-sm font-semibold text-text-secondary border border-border-light px-3 py-2 rounded-ctrl hover:bg-canvas">↩ Restore to active</button>
              : <button onClick={() => markOffboarded(rec, true)} className="bg-[#4a5a6d] text-white text-sm font-semibold px-3.5 py-2 rounded-ctrl hover:bg-[#3c4a5a]" title="Mark offboarded and move to the Offboarded lists in Staffing & Employee Files">✓ Move to Offboarded</button>)}
            <button onClick={() => (docView === 'document' ? printOffDoc(rec) : printDoc(rec))} className="bg-ink text-white text-sm font-semibold px-3.5 py-2 rounded-ctrl hover:bg-ink-dark" title={docView === 'document' ? 'Print Catie’s signed offboarding document' : 'Print the compliance checklist'}>⤓ Print / PDF</button>
            {!readOnly && <button onClick={() => remove(rec)} className="text-sm font-semibold text-litred-alt border border-border-light px-3 py-2 rounded-ctrl hover:bg-[#fdeaea]">Delete</button>}
          </div>
        </header>
        <div className="flex-1 overflow-auto p-8">
          <div className="max-w-3xl space-y-6">
            {/* Header card */}
            <div className="bg-white border border-border rounded-card p-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {field('Employee', 'name')}
                {field('Position', 'position')}
                {field('Manager', 'manager')}
                {field('Separation date', 'separation_date', 'date')}
                {field('Type of separation', 'separation_type', 'select')}
                {field('Prepared by', 'prepared_by')}
                {field('Date of birth', 'dob', 'date')}
                {field('Hire date', 'hire_date', 'date')}
                <div className="flex items-end">
                  <label className={`flex items-center gap-2 text-sm ${readOnly ? '' : 'cursor-pointer'}`}>
                    <input type="checkbox" disabled={readOnly} checked={rec.offer_severance} onChange={e => patch(rec.id, { offer_severance: e.target.checked })} className="w-4 h-4 accent-[#c9a24a]" />
                    <span className="font-semibold text-text-secondary">Offering severance</span>
                  </label>
                </div>
              </div>

              {/* Applicability box */}
              {(age != null || tenureStr) && (
                <div className="mt-5 bg-[#fbf7ee] border border-[#ecd9b6] rounded-ctrl px-4 py-3 text-sm">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-gold-muted mb-1">What applies to {rec.name.split(' ')[0]}</div>
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-text-secondary">
                    {age != null && <span><span className="text-text-muted">Age at separation:</span> <b>{age}</b> {age < 40 ? '— under 40, so the age-40 disclosure steps are pre-marked N/A' : '— 40 or older, so the age-40 disclosure steps apply'}</span>}
                    {tenureStr && <span><span className="text-text-muted">Length of service:</span> <b>{tenureStr}</b></span>}
                  </div>
                  {!readOnly && rec.dob && <button onClick={() => applyAgeSuggestion(rec)} className="mt-2 text-[11px] font-semibold text-[#3f6b8a] hover:underline">↺ Re-apply age suggestion</button>}
                </div>
              )}

              {docView === 'compliance' && (
              <div className="mt-5">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-text-secondary">{done} of {total} applicable steps complete</span>
                  <span className="text-text-muted">{pct}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-[#eee7da] overflow-hidden">
                  <div className="h-full rounded-full bg-[#c9a24a] transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
              )}
            </div>

            {/* View toggle: Catie's signed document vs the compliance checklist */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center bg-[#f1ece3] rounded-ctrl p-0.5">
                {([['document', 'Offboarding document'], ['compliance', 'Compliance checklist']] as const).map(([v, label]) => (
                  <button key={v} onClick={() => setDocView(v)}
                    className={`text-sm font-semibold px-4 py-1.5 rounded transition-colors ${docView === v ? 'bg-white text-ink shadow-sm' : 'text-text-muted hover:text-text-primary'}`}>{label}</button>
                ))}
              </div>
              {docView === 'document' && <span className="text-[11px] text-text-muted">Catie’s streamlined process — assign each task, initial &amp; date, then Catie signs off.</span>}
            </div>

            {/* Checklist */}
            <div className="space-y-5">
              {docView === 'document' && (
                <OffboardingDoc rec={rec as any} readOnly={readOnly} onSave={d => patch(rec.id, { doc: d } as any)} />
              )}
              {docView === 'compliance' && OFFBOARDING_CHECKLIST.map(sec => {
                const sectionOff = !!sec.severance && !rec.offer_severance;
                const activeItems = sec.items.filter(it => !isItemExcluded(rec, sec, it));
                const secDone = activeItems.filter(it => rec.checklist[it.id]).length;
                return (
                  <div key={sec.key} className={`bg-white border border-border rounded-card p-5 ${sectionOff ? 'opacity-70' : ''}`}>
                    <div className="flex items-baseline gap-2 mb-3">
                      <h3 className="font-spectral text-[16px] font-semibold text-text-primary">{sec.heading}</h3>
                      <span className="text-[11px] text-text-muted">{sec.chapter}</span>
                      {sec.severance && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#f7efe1] text-[#b07d2a]">only if severance</span>}
                      <span className="ml-auto text-[11px] font-semibold text-text-muted">{sectionOff ? 'N/A' : `${secDone}/${activeItems.length}`}</span>
                    </div>
                    {sectionOff ? (
                      <div className="text-sm text-text-muted">Not offering severance — this section is skipped. Turn on <b>Offering severance</b> above to include it.</div>
                    ) : (
                      <div className="space-y-1.5">
                        {sec.items.map(it => {
                          const excluded = !!rec.excluded[it.id];
                          const on = !!rec.checklist[it.id];
                          return (
                            <div key={it.id} className={`flex items-start gap-3 text-sm rounded-ctrl px-2 py-1.5 -mx-2 group ${excluded ? 'opacity-55' : ''}`}>
                              <input type="checkbox" checked={on && !excluded} disabled={readOnly || excluded} onChange={() => toggleItem(rec, it.id)} className="mt-0.5 w-4 h-4 accent-[#2f7d5b] shrink-0" />
                              <div className="flex-1 min-w-0">
                                <span className={excluded ? 'text-text-muted line-through' : on ? 'text-text-muted line-through' : 'text-text-secondary'}>{it.label}</span>
                                {it.hint && <span className="text-[11px] text-text-muted"> ({it.hint})</span>}
                                {it.age40 && <span className="ml-1 text-[10px] font-semibold px-1 py-0.5 rounded bg-[#eef2f7] text-[#3f5a76] align-middle">age 40+</span>}
                              </div>
                              {!readOnly && (
                                <button onClick={() => toggleExclude(rec, it.id)} title={excluded ? 'Mark as applicable' : 'Not applicable'} className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${excluded ? 'border-[#cfe4d8] text-[#2f7d5b] hover:bg-[#eef5f1]' : 'border-border-light text-text-muted hover:bg-canvas opacity-0 group-hover:opacity-100'}`}>{excluded ? 'Applies' : 'N/A'}</button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Exit interview */}
              <div className="bg-white border border-border rounded-card p-5">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-gold-muted">Exit interview</label>
                  <div className="flex items-center gap-2">
                    {exitRec && <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${exitRec.status === 'Completed' ? 'bg-[#eef5f1] text-[#2f7d5b]' : 'bg-[#f7efe1] text-[#b07d2a]'}`}>{exitRec.status === 'Completed' ? 'Completed' : 'Sent — awaiting response'}</span>}
                    {exitRec && !readOnly && <button onClick={deleteExit} className="text-[11px] font-semibold text-litred-alt border border-border-light px-2 py-0.5 rounded-ctrl hover:bg-[#fdeaea]">Delete</button>}
                  </div>
                </div>
                {!exitRec ? (
                  <div className="space-y-2">
                    <p className="text-sm text-text-muted">Email the departing employee a short, confidential exit interview. Their responses come back here and file to their Employee File.</p>
                    {!readOnly && (
                      <div className="flex gap-2 flex-wrap items-center">
                        <input value={exitEmail} onChange={e => setExitEmail(e.target.value)} placeholder="employee@email.com" className={input + ' max-w-xs'} />
                        <button onClick={() => sendExit()} disabled={exitBusy} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark disabled:opacity-50">{exitBusy ? 'Sending…' : '✉ Send exit interview'}</button>
                      </div>
                    )}
                  </div>
                ) : exitRec.status === 'Completed' ? (
                  <div className="space-y-2">
                    {(exitRec.answers ? Object.keys(exitRec.answers) : []).length === 0 && <p className="text-sm text-text-muted">Completed. Responses are filed in the Employee File.</p>}
                    {EXIT_Q.map(q => exitRec.answers?.[q.id] != null && exitRec.answers?.[q.id] !== '' ? (
                      <div key={q.id} className="text-sm"><span className="font-semibold text-text-primary">{q.label}</span><div className="text-text-secondary">{q.type === 'rating' ? `${exitRec.answers[q.id]} / 5` : String(exitRec.answers[q.id])}</div></div>
                    ) : null)}
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    <p className="text-text-muted">Sent{exitRec.employee_email ? ` to ${exitRec.employee_email}` : ''} — awaiting the employee’s response.</p>
                    {exitRec.token && <a href={`/offboarding/exit/${exitRec.token}`} target="_blank" rel="noopener noreferrer" className="text-[#3f6b8a] hover:underline break-all">Open the form link</a>}
                    {!readOnly && <div><button onClick={() => sendExit(true)} disabled={exitBusy} className="text-[#3f6b8a] font-semibold hover:underline">🔔 Resend</button></div>}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="bg-white border border-border rounded-card p-5">
                <label className="block text-xs font-bold uppercase tracking-widest text-gold-muted mb-2">Notes</label>
                <textarea disabled={readOnly} value={rec.notes ?? ''} onChange={e => patch(rec.id, { notes: e.target.value })} rows={4} className={input + ' resize-y'} placeholder="Anything to note about this separation…" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- Tiles view ----
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="px-8 py-5 bg-white border-b border-border flex-shrink-0 flex items-center gap-4 flex-wrap">
        <div>
          <h1 className="font-spectral text-[23px] font-semibold text-text-primary">Offboarding</h1>
          <p className="text-sm text-text-muted mt-0.5">{rows.length} separation{rows.length === 1 ? '' : 's'} · plain-language checklist from the HR Compliance Manual</p>
        </div>
        {!readOnly && <button onClick={() => setShowAdd(true)} className="ml-auto bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark">+ Start offboarding</button>}
      </header>

      <div className="flex-1 overflow-auto p-8">
        {loading ? (
          <div className="text-sm text-text-muted">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-text-muted border border-dashed border-border-light rounded-card p-10 text-center max-w-md mx-auto">No offboarding in progress.{!readOnly && ' Click “Start offboarding” to open a checklist for a departing employee.'}</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rows.map(r => {
              const { done, total } = activeProgress(r);
              const pct = total ? Math.round((done / total) * 100) : 0;
              const status = offboardingStatus(r);
              return (
                <button key={r.id} onClick={() => setSelId(r.id)} className="bg-white border border-border rounded-card p-5 text-left shadow-sm hover:shadow-md hover:border-border-light transition-all">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-text-primary truncate">{r.name}</div>
                      {r.position && <div className="text-xs text-text-muted truncate">{r.position}</div>}
                    </div>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${STATUS_PILL[status]}`}>{status}</span>
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-xs text-text-muted">
                    {r.separation_date && <span>Sep. {fmtDate(r.separation_date)}</span>}
                    {r.separation_type && <span className="truncate">· {r.separation_type}</span>}
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-text-muted">{done}/{total} steps</span>
                      <span className="text-text-muted">{pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-[#eee7da] overflow-hidden">
                      <div className="h-full rounded-full bg-[#c9a24a]" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {showAdd && !readOnly && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="bg-white rounded-card w-full max-w-lg shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="font-spectral text-[18px] font-semibold">Start offboarding</h2>
              <button onClick={() => setShowAdd(false)} className="text-text-muted hover:text-text-primary text-xl leading-none">×</button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1">Employee *</label>
                <input list="offb-emp" value={form.name} onChange={e => pickEmployee(e.target.value)} placeholder="Pick or type a name" className={input} />
                <datalist id="offb-emp">{employees.map(e => <option key={e.name} value={e.name} />)}</datalist>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1">Position</label>
                <input value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} className={input} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1">Manager</label>
                <input value={form.manager} onChange={e => setForm(f => ({ ...f, manager: e.target.value }))} className={input} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1">Separation date</label>
                <input type="date" value={form.separation_date} onChange={e => setForm(f => ({ ...f, separation_date: e.target.value }))} className={input} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1">Type of separation</label>
                <select value={form.separation_type} onChange={e => setForm(f => ({ ...f, separation_type: e.target.value }))} className={input + ' bg-white'}>
                  {SEPARATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1">Date of birth</label>
                <input type="date" value={form.dob} onChange={e => setForm(f => ({ ...f, dob: e.target.value }))} className={input} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1">Hire date</label>
                <input type="date" value={form.hire_date} onChange={e => setForm(f => ({ ...f, hire_date: e.target.value }))} className={input} />
              </div>
              {form.dob && form.separation_date && (
                <div className="col-span-2 text-[11px] text-text-muted -mt-1">Age at separation: <b>{ageAt(form.dob, form.separation_date)}</b>{ageAt(form.dob, form.separation_date)! < 40 ? ' — age-40 steps will be pre-marked N/A' : ' — age-40 steps will apply'}</div>
              )}
              <div className="col-span-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.offer_severance} onChange={e => setForm(f => ({ ...f, offer_severance: e.target.checked }))} className="w-4 h-4 accent-[#c9a24a]" />
                  <span className="font-semibold text-text-secondary">Offering severance</span>
                  <span className="text-text-muted text-xs">— leave off to hide the severance section</span>
                </label>
              </div>
              <div className="col-span-2">
                <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1">Prepared by</label>
                <input value={form.prepared_by} onChange={e => setForm(f => ({ ...f, prepared_by: e.target.value }))} placeholder="Catie / Clarizz" className={input} />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setShowAdd(false)} className="text-sm text-text-muted px-3">Cancel</button>
              <button onClick={addRecord} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark">Start checklist</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';
import { useState, useEffect } from 'react';
import { useToast } from '@/components/Toast';
import { ageAt, tenure } from '@/lib/offboarding';

// Tier reference from the firm's Severance Calculation Worksheet (C1).
const TIERS: Record<string, { label: string; baseWeeks: number; perYear: number; cap: number }> = {
  '1': { label: 'Tier 1 — Admin', baseWeeks: 2, perYear: 1, cap: 12 },
  '2': { label: 'Tier 2 — Paralegal / Specialist', baseWeeks: 3, perYear: 1.5, cap: 16 },
  '3': { label: 'Tier 3 — Manager', baseWeeks: 4, perYear: 2, cap: 20 },
  '4': { label: 'Tier 4 — Director / Attorney', baseWeeks: 4, perYear: 2, cap: 26 },
};
const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

const DEFAULTS = {
  name: '', position: '', hireDate: '', sepDate: '', age: '', dob: '',
  annualSalary: '', tier: '1', serviceYears: '', serviceMonths: '', riskEnhancement: false,
  cobraMonths: '', transitionStipend: '', notes: '',
  preparerName: '', preparerDate: '', approverName: '', approverEmail: '',
};
interface Emp { name: string; position: string; dob: string; start_date: string; salary: string }

const inputCls = 'w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink';
function Field({ label, value, onChange, type = 'text', ph, col = 1, prefix }: { label: string; value: string; onChange: (v: string) => void; type?: string; ph?: string; col?: number; prefix?: string }) {
  return (
    <div className={col === 2 ? 'col-span-2' : ''}>
      <label className="block text-xs font-semibold text-text-secondary mb-1">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">{prefix}</span>}
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={ph} className={inputCls + (prefix ? ' pl-7' : '')} />
      </div>
    </div>
  );
}

export default function SeveranceCalc() {
  const { showToast } = useToast();
  const [f, setF] = useState({ ...DEFAULTS });
  const set = (k: keyof typeof DEFAULTS, v: any) => setF(p => ({ ...p, [k]: v }));
  const [employees, setEmployees] = useState<Emp[]>([]);
  const [showApproval, setShowApproval] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentInfo, setSentInfo] = useState<{ id: string; url: string } | null>(null);

  useEffect(() => { fetch('/api/staff/basic').then(r => r.json()).then(d => setEmployees(d.employees ?? [])).catch(() => {}); }, []);

  // Pick an employee: fill position + hire date, remember DOB, and compute age
  // (as of the separation date, else today) and years of service automatically.
  const onlyNum = (s: any) => String(s ?? '').replace(/[^0-9.]/g, '');
  function pickEmployee(name: string) {
    const emp = employees.find(e => e.name.toLowerCase() === name.trim().toLowerCase());
    setF(p => {
      const dob = emp?.dob ?? p.dob;
      const hireDate = emp?.start_date ?? p.hireDate;
      const age = ageAt(dob, p.sepDate);
      const t = tenure(hireDate, p.sepDate);
      const salary = emp?.salary ? onlyNum(emp.salary) : p.annualSalary;
      return {
        ...p, name,
        position: emp?.position || p.position,
        dob, hireDate,
        annualSalary: salary,
        age: age != null ? String(age) : p.age,
        serviceYears: t ? String(t.years) : p.serviceYears,
        serviceMonths: t ? String(t.months) : p.serviceMonths,
      };
    });
  }
  // Keep age + length of service in step if the separation/hire date changes.
  useEffect(() => {
    setF(p => {
      const next = { ...p };
      if (p.dob) { const a = ageAt(p.dob, p.sepDate); if (a != null) next.age = String(a); }
      if (p.hireDate) { const t = tenure(p.hireDate, p.sepDate); if (t) { next.serviceYears = String(t.years); next.serviceMonths = String(t.months); } }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.sepDate, f.hireDate, f.dob]);

  const t = TIERS[f.tier] ?? TIERS['1'];
  const annual = parseFloat(f.annualSalary) || 0;
  const years = (parseFloat(f.serviceYears) || 0) + (parseFloat(f.serviceMonths) || 0) / 12;
  const weeklyRate = annual / 52;
  const serviceWeeks = years * t.perYear;
  const subtotalWeeks = t.baseWeeks + serviceWeeks;
  const cappedWeeks = Math.min(subtotalWeeks, t.cap);
  const finalWeeks = Math.ceil(cappedWeeks);              // round up to a whole week
  const factor = f.riskEnhancement ? 1.5 : 1;
  const total = finalWeeks * weeklyRate * factor;
  const capped = subtotalWeeks > t.cap;

  const rows: [string, string, boolean?][] = [
    ['Weekly base rate (annual ÷ 52)', money(weeklyRate)],
    ['Base weeks for tier', String(t.baseWeeks)],
    ['Weeks per year of service', String(t.perYear)],
    ['Service weeks (years × rate)', `${serviceWeeks.toFixed(2)} wk`],
    ['Subtotal weeks (base + service)', `${subtotalWeeks.toFixed(2)} wk`],
    ['Tier cap', `${t.cap} wk`],
    ['Capped weeks (lesser of subtotal & cap)', `${cappedWeeks.toFixed(2)} wk${capped ? '  (cap applied)' : ''}`],
    ['Rounded up to whole weeks', `${finalWeeks} wk`],
    ['Risk enhancement', f.riskEnhancement ? '× 1.5 (authorized)' : 'None'],
  ];
  const nonCash = [
    f.cobraMonths ? `COBRA premium subsidy: ${f.cobraMonths} month(s)` : '',
    f.transitionStipend ? `Career transition stipend: ${money(parseFloat(f.transitionStipend) || 0)}` : '',
  ].filter(Boolean);

  // The branded worksheet as HTML — reused by print and the approval email/page.
  function buildWorksheetHtml(opts: { forApproval?: boolean } = {}): string {
    const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const meta = (l: string, v: string) => `<div style="min-width:150px"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#8a8474">${esc(l)}</div><div style="font-weight:600;color:#1b2a3d">${esc(v) || '—'}</div></div>`;
    const line = (l: string, v: string) => `<div style="display:flex;justify-content:space-between;gap:16px;padding:5px 0;border-bottom:1px solid #efe8db"><span>${esc(l)}</span><span style="font-weight:600;color:#1b2a3d">${esc(v)}</span></div>`;
    const sigBlock = opts.forApproval
      ? `<div style="margin-top:18px"><b>Prepared by:</b> ${esc(f.preparerName) || '—'}${f.preparerDate ? ` &middot; ${esc(f.preparerDate)}` : ''}</div>
         <div style="margin-top:6px;color:#8a8474">Approval is captured electronically below.</div>`
      : `<div style="margin-top:18px">Prepared by ${esc(f.preparerName) ? `<b>${esc(f.preparerName)}</b>` : '______________________________'}   Date __________</div>
         <div style="margin-top:12px">Approved by ______________________________   Date __________</div>`;
    return `<div style="max-width:680px;margin:0 auto;font-family:Georgia,'Times New Roman',serif;color:#1b2a3d;font-size:13.5px;line-height:1.55">
  <div style="background:#1b2a3d;border-top:3px solid #c9a24a;border-radius:10px;padding:16px 18px;margin-bottom:16px">
    <div style="font-size:15px;font-weight:700;letter-spacing:4px;color:#c9a24a">LITSON</div>
    <div style="font-size:7.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#9fb0c4;margin-top:2px">PLLC &middot; Human Resources</div>
    <div style="font-size:18px;font-weight:700;color:#fff;margin-top:9px">Severance Calculation Worksheet (C1)</div>
  </div>
  <div style="display:flex;gap:22px;flex-wrap:wrap;padding-bottom:14px;border-bottom:1px solid #e6ddcd;margin-bottom:12px">
    ${meta('Employee', f.name)}${meta('Position', f.position)}${meta('Hire date', f.hireDate)}${meta('Separation date', f.sepDate)}${meta('Age', f.age)}
  </div>
  <div style="font-weight:700;font-size:14.5px;margin:8px 0 4px">Inputs</div>
  ${line('Annual base salary (base only)', money(annual))}
  ${line('Tier', t.label)}
  ${line('Length of service', `${f.serviceYears || 0} yr ${f.serviceMonths || 0} mo  (${years.toFixed(2)} yrs)`)}
  <div style="font-weight:700;font-size:14.5px;margin:14px 0 4px">Calculation</div>
  ${rows.map(r => line(r[0], r[1])).join('')}
  <div style="display:flex;justify-content:space-between;gap:16px;margin-top:12px;background:#1b2a3d;color:#fff;border-radius:8px;padding:12px 16px"><span style="font-weight:700">TOTAL SEVERANCE</span><span style="font-weight:700;font-size:18px;color:#e9cf94">${money(total)}</span></div>
  ${nonCash.length ? `<div style="font-weight:700;font-size:14.5px;margin:16px 0 4px">Non-cash components</div>${nonCash.map(n => `<div style="padding:3px 0">• ${esc(n)}</div>`).join('')}` : ''}
  ${f.notes ? `<div style="margin-top:12px"><div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#8a8474">Notes / justification</div><div style="white-space:pre-wrap">${esc(f.notes)}</div></div>` : ''}
  ${sigBlock}
  <div style="margin-top:16px;padding-top:8px;border-top:1px solid #e6ddcd;font-size:10px;font-style:italic;color:#8a8474">Payment structure: lump sum. Under Tenn. Code Ann. § 50-7-303(a)(12), severance paid as salary continuation may disqualify the employee from unemployment benefits for the covered weeks; lump sum generally does not. Any deviation from the formula requires written justification and second approval.</div>
</div>`;
  }

  function printWorksheet() {
    const win = window.open('', '_blank'); if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Severance Worksheet — ${f.name}</title>
<style>@page{size:letter;margin:0.55in}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0;background:#faf8f4;padding:24px}</style></head><body>${buildWorksheetHtml()}<script>window.onload=function(){window.print()}</script></body></html>`);
    win.document.close();
  }

  // Send the worksheet to an approver by email; they approve on the sign page.
  async function sendForApproval() {
    if (!f.approverName.trim()) { showToast('Add the approver’s name'); return; }
    setSending(true);
    try {
      const signatories = [{ role: 'Approver', name: f.approverName.trim(), email: f.approverEmail.trim() }];
      const pdfPayload = {
        employee: f.name, position: f.position, hireDate: f.hireDate, sepDate: f.sepDate, age: f.age,
        annualSalary: money(annual), tier: t.label, serviceLabel: `${f.serviceYears || 0} yr ${f.serviceMonths || 0} mo`,
        rows, total: money(total), nonCash, notes: f.notes, preparerName: f.preparerName, preparerDate: f.preparerDate,
      };
      const res = await fetch('/api/hr-forms/sign', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', title: `Severance Worksheet — ${f.name || 'employee'}`, body_html: buildWorksheetHtml({ forApproval: true }), note: `Please review and approve this severance calculation${f.preparerName ? `, prepared by ${f.preparerName}` : ''}.`, signatories,
          attach_to_file: true, employee_name: f.name, category: 'Severance', pdf_payload: pdfPayload }) });
      const d = await res.json();
      if (!res.ok) { showToast(d.error || 'Could not send'); return; }
      setSentInfo({ id: d.id, url: d.url });
      showToast(f.approverEmail ? 'Sent to the approver' : 'Created — copy the link to share');
    } catch { showToast('Could not send'); }
    finally { setSending(false); }
  }
  async function remindApprover() {
    if (!sentInfo) return;
    const res = await fetch('/api/hr-forms/sign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'remind', id: sentInfo.id }) });
    const d = await res.json();
    showToast(res.ok ? (d.reminded ? 'Reminder sent' : 'Already approved / nothing pending') : (d.error || 'Failed'));
  }

  return (
    <div className="max-w-3xl grid grid-cols-[1fr_300px] gap-6 items-start max-lg:grid-cols-1">
      {/* Inputs */}
      <div className="bg-white border border-border rounded-card p-6 grid grid-cols-2 gap-4">
        <div className="col-span-2 text-xs font-bold uppercase tracking-wider text-gold-muted">Employee</div>
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-text-secondary mb-1">Employee name</label>
          <input list="sev-emp" value={f.name} onChange={e => pickEmployee(e.target.value)} placeholder="Pick or type a name" className={inputCls} />
          <datalist id="sev-emp">{employees.map(e => <option key={e.name} value={e.name} />)}</datalist>
        </div>
        <Field label="Position" value={f.position} onChange={v => set('position', v)} />
        <Field label="Date of birth" value={f.dob} onChange={v => set('dob', v)} type="date" />
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-1">Age {f.dob ? <span className="text-[10px] text-[#2f7d5b] font-normal">· auto from DOB</span> : <span className="text-[10px] text-text-muted font-normal">· enter DOB or type</span>}</label>
          <input value={f.age} onChange={e => set('age', e.target.value)} placeholder="if 40+, OWBPA applies" className={inputCls} />
        </div>
        <Field label="Hire date" value={f.hireDate} onChange={v => set('hireDate', v)} type="date" />
        <Field label="Separation date" value={f.sepDate} onChange={v => set('sepDate', v)} type="date" />

        <div className="col-span-2 text-xs font-bold uppercase tracking-wider text-gold-muted pt-2">Severance inputs</div>
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-text-secondary mb-1">Annual base salary <span className="text-[10px] text-text-muted font-normal">· exclude bonus/OT/commission{f.annualSalary && employees.some(e => e.name.toLowerCase() === f.name.toLowerCase() && e.salary) ? ' · auto-filled, editable' : ''}</span></label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">$</span>
            <input type="number" value={f.annualSalary} onChange={e => set('annualSalary', e.target.value)} className={inputCls + ' pl-7'} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-1">Tier</label>
          <select value={f.tier} onChange={e => set('tier', e.target.value)} className={inputCls + ' bg-white'}>
            {Object.entries(TIERS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-1">Length of service (at the firm){f.hireDate && <span className="text-[10px] text-[#2f7d5b] font-normal"> · auto</span>}</label>
          <div className="flex gap-2">
            <div className="relative flex-1"><input type="number" value={f.serviceYears} onChange={e => set('serviceYears', e.target.value)} placeholder="0" className={inputCls + ' pr-9'} /><span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-text-muted">yrs</span></div>
            <div className="relative flex-1"><input type="number" value={f.serviceMonths} onChange={e => set('serviceMonths', e.target.value)} placeholder="0" className={inputCls + ' pr-9'} /><span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-text-muted">mos</span></div>
          </div>
        </div>
        <div className="col-span-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={f.riskEnhancement} onChange={e => set('riskEnhancement', e.target.checked)} className="w-4 h-4 accent-[#c9a24a]" />
            <span className="font-semibold text-text-secondary">Apply 1.5× risk enhancement</span>
            <span className="text-text-muted text-xs">— requires written justification & second approval</span>
          </label>
        </div>

        <div className="col-span-2 text-xs font-bold uppercase tracking-wider text-gold-muted pt-2">Non-cash components (optional)</div>
        <Field label="COBRA subsidy — months" value={f.cobraMonths} onChange={v => set('cobraMonths', v)} type="number" />
        <Field label="Career transition stipend" value={f.transitionStipend} onChange={v => set('transitionStipend', v)} type="number" prefix="$" />
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-text-secondary mb-1">Notes / justification</label>
          <textarea value={f.notes} onChange={e => set('notes', e.target.value)} rows={2} className={inputCls + ' resize-y'} />
        </div>
      </div>

      {/* Live result */}
      <div className="bg-white border border-border rounded-card p-5 sticky top-0">
        <div className="text-xs font-bold uppercase tracking-wider text-gold-muted mb-3">Calculation</div>
        <div className="space-y-1.5 text-sm">
          {rows.map(([l, v]) => (
            <div key={l} className="flex justify-between gap-3">
              <span className="text-text-muted">{l}</span>
              <span className="font-semibold text-text-primary text-right">{v}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 bg-[#1b2a3d] rounded-ctrl px-4 py-3 flex items-center justify-between">
          <span className="text-white font-semibold text-sm">Total severance</span>
          <span className="text-[#e9cf94] font-bold text-xl">{money(total)}</span>
        </div>
        {capped && <p className="text-[11px] text-[#b07d2a] mt-2">Tier cap applied — subtotal exceeded {t.cap} weeks.</p>}
        <button onClick={printWorksheet} className="mt-4 w-full bg-ink text-white text-sm font-semibold px-4 py-2.5 rounded-ctrl hover:bg-ink-dark">⤓ Download worksheet (PDF)</button>
        <button onClick={() => setShowApproval(s => !s)} className="mt-2 w-full bg-[#2f7d5b] text-white text-sm font-semibold px-4 py-2.5 rounded-ctrl hover:bg-[#276a4d]">✍ Send for approval</button>
        <button onClick={() => setF({ ...DEFAULTS })} className="mt-2 w-full text-sm font-semibold text-text-muted hover:text-text-primary py-2">Reset</button>

        {showApproval && (
          <div className="mt-3 border-t border-border-light pt-3 space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-gold-muted">Prepared by (you)</div>
            <input value={f.preparerName} onChange={e => set('preparerName', e.target.value)} placeholder="Your name" className={inputCls} />
            <input type="date" value={f.preparerDate} onChange={e => set('preparerDate', e.target.value)} className={inputCls} />
            <div className="text-[11px] font-bold uppercase tracking-wider text-gold-muted pt-1">Send to approver</div>
            <input value={f.approverName} onChange={e => set('approverName', e.target.value)} placeholder="Approver name" className={inputCls} />
            <input value={f.approverEmail} onChange={e => set('approverEmail', e.target.value)} placeholder="approver@litson.co" className={inputCls} />
            <button onClick={sendForApproval} disabled={sending} className="w-full bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark disabled:opacity-50">{sending ? 'Sending…' : 'Send for approval'}</button>
            {sentInfo && (
              <div className="bg-[#eef5f1] border border-[#cfe4d8] rounded-ctrl p-2.5 text-[11px]">
                <div className="font-semibold text-[#2f7d5b] mb-1">Sent — approval link:</div>
                <a href={sentInfo.url} target="_blank" rel="noopener noreferrer" className="text-[#3f6b8a] break-all hover:underline">{sentInfo.url}</a>
                <button onClick={remindApprover} className="mt-2 block text-[#3f6b8a] font-semibold hover:underline">🔔 Send reminder</button>
                <div className="text-text-muted mt-1">Once approved, the signed worksheet is filed as a PDF under the employee.</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

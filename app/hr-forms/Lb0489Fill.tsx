'use client';
import { useState } from 'react';
import { useToast } from '@/components/Toast';

const DEFAULTS = {
  name: '', ssn: '', empFrom: '', empTo: '', occupation: '', location: '',
  reason: 'Lack of Work', layoff: '', recallDate: '', weekEnding: '', vacationPay: '',
  received: 'None', item6Amount: '', item6From: '', item6To: '', explain: '',
  employerName: 'Litson PLLC', employerAddress: '54 Music Square E Ste 300, Nashville, TN 37203',
  employerPhone: '(615) 985-8205', employerEmail: '', accountNumber: '',
  signerTitle: '', dateCompleted: '',
};

export default function Lb0489Fill() {
  const { showToast } = useToast();
  const [f, setF] = useState({ ...DEFAULTS });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof DEFAULTS, v: string) => setF(p => ({ ...p, [k]: v }));
  const input = 'w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink';

  async function download() {
    setBusy(true);
    try {
      const res = await fetch('/api/hr-forms/lb0489', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
      if (!res.ok) { showToast('Could not generate the PDF'); return; }
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `LB-0489-${(f.name || 'form').replace(/[^\w]+/g, '-')}.pdf`;
      a.click();
      showToast('LB-0489 downloaded');
    } catch { showToast('Could not generate the PDF'); }
    finally { setBusy(false); }
  }

  const Field = ({ label, k, type = 'text', ph, col = 1 }: { label: string; k: keyof typeof DEFAULTS; type?: string; ph?: string; col?: number }) => (
    <div className={col === 2 ? 'col-span-2' : ''}>
      <label className="block text-xs font-semibold text-text-secondary mb-1">{label}</label>
      <input type={type} value={f[k]} onChange={e => set(k, e.target.value)} placeholder={ph} className={input} />
    </div>
  );
  const Radio = ({ label, k, options }: { label: string; k: keyof typeof DEFAULTS; options: string[] }) => (
    <div className="col-span-2">
      <label className="block text-xs font-semibold text-text-secondary mb-1">{label}</label>
      <div className="flex gap-2 flex-wrap">
        {options.map(o => (
          <button key={o} type="button" onClick={() => set(k, f[k] === o ? '' : o)}
            className={`text-sm font-semibold px-3 py-1.5 rounded-ctrl border transition-colors ${f[k] === o ? 'bg-ink text-white border-ink' : 'bg-white text-text-secondary border-border-light hover:border-ink'}`}>
            {o}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="max-w-3xl">
      <div className="bg-[#eef2f7] border border-[#cbd8e6] rounded-card p-4 mb-5 text-sm text-[#33506e]">
        <b>Official TN Separation Notice (LB-0489).</b> Fill the fields below and download — the exact state PDF is filled in, keeping its original format. Give the completed copy to the employee within 24 hours of separation.
      </div>
      <div className="bg-white border border-border rounded-card p-6 grid grid-cols-2 gap-4">
        <div className="col-span-2 text-xs font-bold uppercase tracking-wider text-gold-muted">Employee</div>
        <Field label="Employee name" k="name" ph="First Middle Last" col={2} />
        <Field label="Social Security Number" k="ssn" />
        <Field label="Occupation" k="occupation" />
        <Field label="Last employed — From" k="empFrom" ph="mm/dd/yyyy" />
        <Field label="Last employed — To" k="empTo" ph="mm/dd/yyyy" />
        <Field label="Where work was performed" k="location" col={2} />

        <div className="col-span-2 text-xs font-bold uppercase tracking-wider text-gold-muted pt-2">Separation</div>
        <Radio label="Reason for separation" k="reason" options={['Lack of Work', 'Discharge', 'Quit']} />
        {f.reason === 'Lack of Work' && <Radio label="If lack of work, layoff is" k="layoff" options={['Permanent', 'Temporary']} />}
        {f.layoff === 'Temporary' && <Field label="Recall date" k="recallDate" ph="mm/dd/yyyy" col={2} />}
        {f.layoff === 'Temporary' && <Field label="Vacation pay — Week ending" k="weekEnding" ph="mm/dd/yyyy" />}
        {f.layoff === 'Temporary' && <Field label="Vacation pay — Amount ($)" k="vacationPay" />}
        <Field label="If other than lack of work, explain the circumstances" k="explain" col={2} />

        <div className="col-span-2 text-xs font-bold uppercase tracking-wider text-gold-muted pt-2">Item 6 — Pay after separation</div>
        <Radio label="Employee received" k="received" options={['None', 'Wages in Lieu of Notice', 'Severance Pay']} />
        {f.received !== 'None' && <Field label="Amount ($)" k="item6Amount" />}
        {f.received !== 'None' && <Field label="Period from" k="item6From" ph="mm/dd/yyyy" />}
        {f.received !== 'None' && <Field label="Period to" k="item6To" ph="mm/dd/yyyy" col={2} />}

        <div className="col-span-2 text-xs font-bold uppercase tracking-wider text-gold-muted pt-2">Employer</div>
        <Field label="Employer name" k="employerName" />
        <Field label="Employer telephone" k="employerPhone" />
        <Field label="Employer address" k="employerAddress" col={2} />
        <Field label="Employer email" k="employerEmail" />
        <Field label="Employer account number (LB-0851 / LB-0456)" k="accountNumber" />
        <Field label="Title of person signing" k="signerTitle" />
        <Field label="Date completed & released to employee" k="dateCompleted" ph="mm/dd/yyyy" />
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button onClick={download} disabled={busy} className="bg-ink text-white text-sm font-semibold px-4 py-2.5 rounded-ctrl hover:bg-ink-dark disabled:opacity-50">
          {busy ? 'Generating…' : '⤓ Download filled LB-0489 (official PDF)'}
        </button>
        <button onClick={() => setF({ ...DEFAULTS })} className="text-sm font-semibold text-text-muted hover:text-text-primary px-3 py-2.5">Reset</button>
      </div>
      <p className="text-[11px] text-text-faint mt-2">The employer's signature is applied on the printed copy. The downloaded PDF stays fillable so you can adjust before printing.</p>
    </div>
  );
}

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

const inputCls = 'w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink';

// Defined at module scope (NOT inside the component) so the inputs keep focus
// while typing — a component defined inline is a new type on every keystroke.
function Field({ label, value, onChange, type = 'text', ph, col = 1 }: { label: string; value: string; onChange: (v: string) => void; type?: string; ph?: string; col?: number }) {
  return (
    <div className={col === 2 ? 'col-span-2' : ''}>
      <label className="block text-xs font-semibold text-text-secondary mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={ph} className={inputCls} />
    </div>
  );
}
function Radio({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="col-span-2">
      <label className="block text-xs font-semibold text-text-secondary mb-1">{label}</label>
      <div className="flex gap-2 flex-wrap">
        {options.map(o => (
          <button key={o} type="button" onClick={() => onChange(value === o ? '' : o)}
            className={`text-sm font-semibold px-3 py-1.5 rounded-ctrl border transition-colors ${value === o ? 'bg-ink text-white border-ink' : 'bg-white text-text-secondary border-border-light hover:border-ink'}`}>
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Lb0489Fill() {
  const { showToast } = useToast();
  const [f, setF] = useState({ ...DEFAULTS });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof DEFAULTS, v: string) => setF(p => ({ ...p, [k]: v }));

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

  return (
    <div className="max-w-3xl">
      <div className="bg-[#eef2f7] border border-[#cbd8e6] rounded-card p-4 mb-5 text-sm text-[#33506e]">
        <b>Official TN Separation Notice (LB-0489).</b> Fill the fields below and download — the exact state PDF is filled in, keeping its original format. Give the completed copy to the employee within 24 hours of separation.
      </div>
      <div className="bg-white border border-border rounded-card p-6 grid grid-cols-2 gap-4">
        <div className="col-span-2 text-xs font-bold uppercase tracking-wider text-gold-muted">Employee</div>
        <Field label="Employee name" value={f.name} onChange={v => set('name', v)} ph="First Middle Last" col={2} />
        <Field label="Social Security Number" value={f.ssn} onChange={v => set('ssn', v)} />
        <Field label="Occupation" value={f.occupation} onChange={v => set('occupation', v)} />
        <Field label="Last employed — From" value={f.empFrom} onChange={v => set('empFrom', v)} ph="mm/dd/yyyy" />
        <Field label="Last employed — To" value={f.empTo} onChange={v => set('empTo', v)} ph="mm/dd/yyyy" />
        <Field label="Where work was performed" value={f.location} onChange={v => set('location', v)} col={2} />

        <div className="col-span-2 text-xs font-bold uppercase tracking-wider text-gold-muted pt-2">Separation</div>
        <Radio label="Reason for separation" value={f.reason} onChange={v => set('reason', v)} options={['Lack of Work', 'Discharge', 'Quit']} />
        {f.reason === 'Lack of Work' && <Radio label="If lack of work, layoff is" value={f.layoff} onChange={v => set('layoff', v)} options={['Permanent', 'Temporary']} />}
        {f.layoff === 'Temporary' && <Field label="Recall date" value={f.recallDate} onChange={v => set('recallDate', v)} ph="mm/dd/yyyy" col={2} />}
        {f.layoff === 'Temporary' && <Field label="Vacation pay — Week ending" value={f.weekEnding} onChange={v => set('weekEnding', v)} ph="mm/dd/yyyy" />}
        {f.layoff === 'Temporary' && <Field label="Vacation pay — Amount ($)" value={f.vacationPay} onChange={v => set('vacationPay', v)} />}
        <Field label="If other than lack of work, explain the circumstances" value={f.explain} onChange={v => set('explain', v)} col={2} />

        <div className="col-span-2 text-xs font-bold uppercase tracking-wider text-gold-muted pt-2">Item 6 — Pay after separation</div>
        <Radio label="Employee received" value={f.received} onChange={v => set('received', v)} options={['None', 'Wages in Lieu of Notice', 'Severance Pay']} />
        {f.received !== 'None' && <Field label="Amount ($)" value={f.item6Amount} onChange={v => set('item6Amount', v)} />}
        {f.received !== 'None' && <Field label="Period from" value={f.item6From} onChange={v => set('item6From', v)} ph="mm/dd/yyyy" />}
        {f.received !== 'None' && <Field label="Period to" value={f.item6To} onChange={v => set('item6To', v)} ph="mm/dd/yyyy" col={2} />}

        <div className="col-span-2 text-xs font-bold uppercase tracking-wider text-gold-muted pt-2">Employer</div>
        <Field label="Employer name" value={f.employerName} onChange={v => set('employerName', v)} />
        <Field label="Employer telephone" value={f.employerPhone} onChange={v => set('employerPhone', v)} />
        <Field label="Employer address" value={f.employerAddress} onChange={v => set('employerAddress', v)} col={2} />
        <Field label="Employer email" value={f.employerEmail} onChange={v => set('employerEmail', v)} />
        <Field label="Employer account number (LB-0851 / LB-0456)" value={f.accountNumber} onChange={v => set('accountNumber', v)} />
        <Field label="Title of person signing" value={f.signerTitle} onChange={v => set('signerTitle', v)} />
        <Field label="Date completed & released to employee" value={f.dateCompleted} onChange={v => set('dateCompleted', v)} ph="mm/dd/yyyy" />
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

'use client';
import { useState } from 'react';
import clsx from 'clsx';
import { useToast } from '@/components/Toast';
import EditGate from '@/components/EditGate';

type EmpType = 'contractor' | 'employee';

interface Form {
  name: string; email: string; role: string; dept: string;
  salary: string; startDate: string; location: string; notes: string;
}

const EMPTY: Form = { name: '', email: '', role: '', dept: '', salary: '', startDate: '', location: '', notes: '' };

export default function OffersClient() {
  const { showToast } = useToast();
  const [empType, setEmpType] = useState<EmpType>('contractor');
  const [form, setForm] = useState<Form>(EMPTY);
  const [draft, setDraft] = useState('');
  const [generating, setGenerating] = useState(false);

  function set(k: keyof Form, v: string) { setForm(p => ({ ...p, [k]: v })); }

  async function generate() {
    setGenerating(true);
    try {
      const res = await fetch('/api/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'offer',
          employeeType: empType,
          name: form.name,
          email: form.email,
          role: form.role,
          dept: form.dept,
          salary: form.salary,
          startDate: form.startDate,
          location: form.location,
          notes: form.notes,
        }),
      });
      const data = await res.json();
      setDraft(data.text ?? data.draft ?? '');
    } catch { showToast('Generation failed'); }
    setGenerating(false);
  }

  function printPdf() {
    const win = window.open('', '_blank');
    if (!win) return;
    const lines = draft.split('\n').map(l =>
      `<div style="min-height:1em">${l.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') || '&nbsp;'}</div>`
    ).join('');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Offer Letter – ${form.name}</title>
    <style>
      *{box-sizing:border-box}
      body{font-family:Georgia,serif;margin:0;padding:40px 56px;color:#1b2230;max-width:820px;margin:0 auto;font-size:13.5px;line-height:1.75;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      @media print{body{padding:32px 48px}}
    </style></head><body>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px">
      <div style="background:#1b2a3d;padding:13px 20px;display:inline-flex;align-items:center">
        <span style="font-family:Arial,sans-serif;font-size:21px;font-weight:700;letter-spacing:0.22em;color:#fff">LITSON</span><span style="color:#e63329;font-size:21px;font-weight:700">°</span>
      </div>
      <div style="text-align:right;font-size:11px;color:#333;line-height:1.7;font-family:Arial,sans-serif">
        J. Alex Little<br>615.985.8189<br>alex@litson.co
      </div>
    </div>
    <div style="font-family:Georgia,serif;color:#1b2230">${lines}</div>
    <div style="margin-top:40px;padding-top:10px;border-top:1px solid #ddd;font-family:Arial,sans-serif;font-size:10px;color:#777">
      Litson PLLC · 54 Music Square East, Suite 300 · Nashville, TN 37203 · www.litson.co
    </div>
    </body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 400);
  }

  function downloadTxt() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([draft], { type: 'text/plain' }));
    a.download = `offer-${form.name.replace(/\s+/g, '-') || 'letter'}.txt`;
    a.click();
  }

  const ready = !!(form.name && form.role && form.salary);

  const fields: [string, keyof Form, string][] = [
    ['Candidate Name *', 'name', 'text'],
    ['Email', 'email', 'email'],
    ['Role / Title *', 'role', 'text'],
    ...(empType === 'employee' ? [['Department', 'dept', 'text'] as [string, keyof Form, string]] : []),
    [empType === 'contractor' ? 'Monthly Rate ($) *' : 'Annual Salary ($) *', 'salary', 'text'],
    ['Start Date', 'startDate', 'date'],
    ['Location', 'location', 'text'],
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="px-8 py-5 bg-white border-b border-border flex-shrink-0">
        <h1 className="font-spectral text-[23px] font-semibold text-text-primary">Offer Letters</h1>
        <p className="text-sm text-text-muted mt-0.5">AI-generated offer letters on Litson letterhead</p>
      </header>

      <div className="flex-1 overflow-auto p-8">
        <div className="grid grid-cols-[360px_1fr] gap-6 max-w-5xl items-start">

          {/* Form panel */}
          <div className="bg-white border border-border rounded-card p-6 space-y-4 sticky top-0">
            {/* Type toggle */}
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-gold-muted mb-2">Letter Type</div>
              <div className="flex gap-2">
                <button onClick={() => setEmpType('contractor')}
                  className={clsx('flex-1 py-2 text-sm font-semibold rounded-ctrl border transition-colors',
                    empType === 'contractor' ? 'bg-ink text-white border-ink' : 'bg-white text-text-secondary border-border hover:border-ink')}>
                  1099 Contractor
                </button>
                <button onClick={() => setEmpType('employee')}
                  className={clsx('flex-1 py-2 text-sm font-semibold rounded-ctrl border transition-colors',
                    empType === 'employee' ? 'bg-ink text-white border-ink' : 'bg-white text-text-secondary border-border hover:border-ink')}>
                  W-2 Employee
                </button>
              </div>
            </div>

            <div className="text-xs font-bold uppercase tracking-wider text-gold-muted pt-1">Candidate Details</div>

            {fields.map(([label, key, type]) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-text-secondary mb-1">{label}</label>
                <input
                  type={type}
                  value={form[key]}
                  onChange={e => set(key, e.target.value)}
                  placeholder={key === 'location' ? (empType === 'contractor' ? 'Remote' : 'Nashville, TN') : ''}
                  className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink"
                />
              </div>
            ))}

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Additional Notes</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
                className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink resize-none" />
            </div>

            <EditGate fallback={
              <p className="text-xs text-text-muted text-center py-2">View only — contact HR Admin to generate letters</p>
            }>
              <button onClick={generate} disabled={!ready || generating}
                className="w-full bg-ink text-white text-sm font-semibold py-2.5 rounded-ctrl hover:bg-ink-dark transition-colors disabled:opacity-40">
                {generating ? 'Generating…' : `Generate ${empType === 'contractor' ? 'Contractor' : 'Employee'} Letter`}
              </button>
            </EditGate>
          </div>

          {/* Letter preview panel */}
          <div className="space-y-3">
            <div className="bg-white border border-border rounded-card overflow-hidden shadow-sm">
              {/* Letterhead */}
              <div className="flex items-start justify-between px-8 pt-7 pb-5 border-b border-[#e8e2d8]">
                <div className="bg-[#1b2a3d] px-4 py-2.5 flex items-center">
                  <span className="font-sans text-[19px] font-bold tracking-[0.22em] text-white">LITSON</span>
                  <span className="text-[#e63329] text-[19px] font-bold">°</span>
                </div>
                <div className="text-right text-[11px] text-text-muted leading-relaxed font-sans">
                  J. Alex Little<br />615.985.8189<br />alex@litson.co
                </div>
              </div>

              {/* Body */}
              {draft ? (
                <div className="px-8 py-6">
                  <textarea
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    className="w-full text-[13.5px] leading-[1.75] text-text-primary resize-none focus:outline-none border-none bg-transparent"
                    style={{ fontFamily: 'Georgia, serif', minHeight: '560px' }}
                  />
                </div>
              ) : (
                <div className="px-8 py-20 text-center">
                  <div className="text-text-muted text-sm italic">Fill in the form and click Generate to create the letter</div>
                </div>
              )}

              {/* Footer */}
              <div className="px-8 pt-3 pb-5 border-t border-[#e8e2d8]">
                <p className="text-[10px] text-text-muted font-sans tracking-wide">
                  Litson PLLC · 54 Music Square East, Suite 300 · Nashville, TN 37203 · www.litson.co
                </p>
              </div>
            </div>

            {draft && (
              <div className="flex items-center gap-2">
                <button onClick={printPdf}
                  className="bg-ink text-white text-sm font-semibold px-4 py-2.5 rounded-ctrl hover:bg-ink-dark transition-colors">
                  ⤓ Print / PDF
                </button>
                <button onClick={downloadTxt}
                  className="bg-white border border-border text-text-primary text-sm font-semibold px-4 py-2.5 rounded-ctrl hover:bg-canvas transition-colors">
                  ↓ TXT
                </button>
                <button onClick={() => { setDraft(''); setForm(EMPTY); }}
                  className="ml-auto text-sm font-semibold text-text-muted hover:text-text-primary px-3 py-2 rounded-ctrl hover:bg-canvas border border-transparent hover:border-border transition-colors">
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

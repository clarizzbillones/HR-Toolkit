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
    const bodyFont = `"Century Schoolbook","Century","Book Antiqua",Georgia,serif`;
    // Detect signature block and inject SVG signature above it
    const sigLine = 'J. Alex Little';
    const lines = draft.split('\n').map((l, i, arr) => {
      const safe = l.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      if (l.trim() === sigLine && i > 0 && arr[i-1].trim() === '') {
        return `<div style="margin-top:28px;margin-bottom:2px">
          <svg xmlns="http://www.w3.org/2000/svg" width="160" height="52" viewBox="0 0 160 52" style="display:block">
            <path d="M12,38 C18,20 28,12 34,18 C38,22 30,32 26,36 C22,40 30,34 40,28 C50,22 56,20 58,24 C60,28 54,34 60,30 C66,26 72,22 76,26 C80,30 74,36 80,32 C86,28 92,24 96,28 C100,32 98,36 104,30 C108,26 114,22 118,26 C122,30 120,34 126,30 C132,26 138,24 144,28" stroke="#1b2230" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div style="min-height:1em">${safe}</div>`;
      }
      return `<div style="min-height:1em">${safe || '&nbsp;'}</div>`;
    }).join('');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Offer Letter – ${form.name}</title>
    <style>
      *{box-sizing:border-box}
      body{font-family:${bodyFont};margin:0 auto;padding:44px 60px;color:#1b2230;max-width:820px;font-size:13.5px;line-height:1.8;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      @media print{body{padding:36px 52px}}
    </style></head><body>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:36px">
      <div style="background:#1b2a3d;padding:14px 22px;display:inline-flex;align-items:center">
        <span style="font-family:Arial,sans-serif;font-size:22px;font-weight:700;letter-spacing:0.22em;color:#fff">LITSON</span><span style="color:#e63329;font-size:22px;font-weight:700">°</span>
      </div>
      <div style="text-align:right;font-size:10.5px;color:#3a3a3a;line-height:1.8;font-family:Arial,sans-serif;margin-top:4px">
        <strong style="font-size:11px">J. Alex Little</strong><br>Founding &amp; Managing Partner<br>615.985.8189<br>alex@litson.co
      </div>
    </div>
    <div style="font-family:${bodyFont};color:#1b2230">${lines}</div>
    <div style="margin-top:48px;padding-top:8px;border-top:1px solid #ccc;font-family:Arial,sans-serif;font-size:9.5px;color:#888;letter-spacing:0.02em">
      Litson PLLC &nbsp;·&nbsp; 6339 Charlotte Pike, Unit C321 &nbsp;·&nbsp; Nashville, TN 37209 &nbsp;·&nbsp; www.litson.co
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
                <div className="bg-[#1b2a3d] px-4 py-3 flex items-center">
                  <span className="font-sans text-[20px] font-bold tracking-[0.22em] text-white">LITSON</span>
                  <span className="text-[#e63329] text-[20px] font-bold">°</span>
                </div>
                <div className="text-right text-[10.5px] text-text-muted leading-[1.8] font-sans mt-1">
                  <span className="font-semibold text-[11px] text-text-primary">J. Alex Little</span><br />
                  Founding &amp; Managing Partner<br />615.985.8189<br />alex@litson.co
                </div>
              </div>

              {/* Body */}
              {draft ? (
                <div className="px-8 py-6">
                  <textarea
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    className="w-full text-[13.5px] leading-[1.8] text-text-primary resize-none focus:outline-none border-none bg-transparent"
                    style={{ fontFamily: '"Century Schoolbook","Century","Book Antiqua",Georgia,serif', minHeight: '560px' }}
                  />
                </div>
              ) : (
                <div className="px-8 py-20 text-center">
                  <div className="text-text-muted text-sm italic">Fill in the form and click Generate to create the letter</div>
                </div>
              )}

              {/* Footer */}
              <div className="px-8 pt-3 pb-5 border-t border-[#ccc]">
                <p className="text-[9.5px] text-text-muted font-sans tracking-wide">
                  Litson PLLC &nbsp;·&nbsp; 6339 Charlotte Pike, Unit C321 &nbsp;·&nbsp; Nashville, TN 37209 &nbsp;·&nbsp; www.litson.co
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

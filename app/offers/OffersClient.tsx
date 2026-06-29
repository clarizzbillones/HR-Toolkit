'use client';
import { useState, useRef } from 'react';
import { useToast } from '@/components/Toast';
import EditGate from '@/components/EditGate';

interface OfferParams {
  candidate: string; role: string; dept: string; salary: string;
  startDate: string; supervisor: string; location: string; notes: string;
}

export default function OffersClient({ employees }: { employees: string[] }) {
  const { showToast } = useToast();
  const [params, setParams] = useState<OfferParams>({
    candidate: '', role: '', dept: '', salary: '', startDate: '', supervisor: '', location: 'Nashville, TN', notes: '',
  });
  const [draft, setDraft] = useState('');
  const [generating, setGenerating] = useState(false);
  const [letterheadUrl, setLetterheadUrl] = useState<string | null>(null);
  const [sigUrl, setSigUrl] = useState<string | null>(null);
  const letterheadRef = useRef<HTMLInputElement>(null);
  const sigRef = useRef<HTMLInputElement>(null);

  function set(k: keyof OfferParams, v: string) { setParams(p => ({ ...p, [k]: v })); }

  async function generate() {
    setGenerating(true);
    try {
      const res = await fetch('/api/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'offer', params }) });
      const data = await res.json();
      setDraft(data.draft ?? '');
    } catch { showToast('Generation failed'); }
    setGenerating(false);
  }

  function handleImg(type: 'letterhead' | 'sig', file: File) {
    const url = URL.createObjectURL(file);
    if (type === 'letterhead') setLetterheadUrl(url);
    else setSigUrl(url);
  }

  function downloadTxt() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([draft], { type: 'text/plain' }));
    a.download = `offer-${params.candidate.replace(/\s+/g, '-') || 'letter'}.txt`;
    a.click();
  }

  function printPdf() {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Offer Letter</title><style>
      body{font-family:Georgia,serif;max-width:680px;margin:40px auto;color:#1b2230;line-height:1.7}
      .lh{width:100%;margin-bottom:24px}
      pre{white-space:pre-wrap;font-family:inherit;font-size:15px}
      .sig{max-width:200px;margin-top:32px}
    </style></head><body>
    ${letterheadUrl ? `<img src="${letterheadUrl}" class="lh" />` : '<div style="text-align:center;font-size:22px;font-weight:bold;margin-bottom:24px;color:#213044">LITSON, PLLC</div>'}
    <pre>${draft.replace(/</g,'&lt;')}</pre>
    ${sigUrl ? `<img src="${sigUrl}" class="sig" />` : ''}
    </body></html>`);
    win.document.close();
    setTimeout(() => { win.print(); }, 400);
  }

  const ready = params.candidate && params.role && params.salary;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="px-8 py-5 bg-white border-b border-border flex-shrink-0">
        <h1 className="font-spectral text-[23px] font-semibold text-text-primary">Offer Letters</h1>
        <p className="text-sm text-text-muted mt-0.5">Generate AI-drafted offer letters with letterhead</p>
      </header>
      <div className="flex-1 overflow-auto p-8">
        <div className="grid grid-cols-2 gap-6 max-w-4xl">
          {/* Form */}
          <div className="bg-white border border-border rounded-card p-6 space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-gold-muted mb-1">Candidate Details</div>
            {([
              ['Candidate Name', 'candidate', 'text'],
              ['Role / Title', 'role', 'text'],
              ['Department', 'dept', 'text'],
              ['Annual Salary', 'salary', 'text'],
              ['Start Date', 'startDate', 'date'],
              ['Supervisor', 'supervisor', 'text'],
              ['Location', 'location', 'text'],
            ] as [string, keyof OfferParams, string][]).map(([label, key, type]) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-text-secondary mb-1">{label}</label>
                <input type={type} value={params[key]} onChange={e => set(key, e.target.value)}
                  className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
              </div>
            ))}
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Additional Notes</label>
              <textarea value={params.notes} onChange={e => set('notes', e.target.value)} rows={3}
                className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink resize-none" />
            </div>
            <EditGate fallback={<p className="text-xs text-text-muted text-center py-2">View only — contact HR Admin to generate letters</p>}>
            <button onClick={generate} disabled={!ready || generating}
              className="w-full bg-ink text-white text-sm font-semibold py-2.5 rounded-ctrl hover:bg-ink-dark transition-colors disabled:opacity-40">
              {generating ? 'Generating…' : 'Generate Offer Letter'}
            </button>
            </EditGate>
          </div>

          {/* Assets + output */}
          <div className="space-y-4">
            <div className="bg-white border border-border rounded-card p-5">
              <div className="text-xs font-bold uppercase tracking-wider text-gold-muted mb-3">Brand Assets</div>
              <div className="space-y-3">
                <div>
                  <input ref={letterheadRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleImg('letterhead', e.target.files[0])} />
                  <button onClick={() => letterheadRef.current?.click()} className="text-sm text-ink font-semibold border border-border-light px-3 py-2 rounded-ctrl hover:bg-canvas w-full text-left">
                    {letterheadUrl ? '✓ Letterhead uploaded' : '↑ Upload Letterhead'}
                  </button>
                </div>
                <div>
                  <input ref={sigRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleImg('sig', e.target.files[0])} />
                  <button onClick={() => sigRef.current?.click()} className="text-sm text-ink font-semibold border border-border-light px-3 py-2 rounded-ctrl hover:bg-canvas w-full text-left">
                    {sigUrl ? '✓ Signature uploaded' : '↑ Upload Signature'}
                  </button>
                </div>
              </div>
            </div>

            {draft && (
              <div className="bg-white border border-border rounded-card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-gold-muted flex-1">Draft</span>
                  <button onClick={downloadTxt} className="text-xs font-semibold text-ink border border-border-light px-2.5 py-1.5 rounded hover:bg-canvas">↓ TXT</button>
                  <button onClick={printPdf} className="text-xs font-semibold text-ink border border-border-light px-2.5 py-1.5 rounded hover:bg-canvas">🖨 PDF</button>
                </div>
                <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={18}
                  className="w-full border border-border-light rounded-ctrl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-ink resize-none" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

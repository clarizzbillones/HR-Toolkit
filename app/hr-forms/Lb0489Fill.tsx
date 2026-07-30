'use client';
import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/components/Toast';

const DEFAULTS = {
  name: '', ssn: '', empFrom: '', empTo: '', occupation: '', location: '',
  reason: 'Lack of Work', layoff: '', recallDate: '', weekEnding: '', vacationPay: '',
  received: 'None', item6Amount: '', item6From: '', item6To: '', explain: '',
  employerName: 'Litson PLLC', employerAddress: '54 Music Square E Ste 300, Nashville, TN 37203',
  employerPhone: '(615) 985-8205', employerEmail: '', accountNumber: '06417726',
  signerTitle: 'Founding & Managing Partner', signerName: 'Alex Little', signatureImage: '', dateCompleted: '',
};

const inputCls = 'w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink';

// Normalize a stored date (ISO or mm/dd/yyyy) to yyyy-mm-dd for a date input.
function toISO(s: string): string {
  if (!s) return '';
  const str = String(s).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  const m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/.exec(str);
  if (m) { let y = +m[3]; if (y < 100) y += y < 30 ? 2000 : 1900; return `${y}-${String(+m[1]).padStart(2, '0')}-${String(+m[2]).padStart(2, '0')}`; }
  return '';
}

// Render a typed name as a cursive signature image (PNG data URL).
function typedToImage(text: string): string {
  const c = document.createElement('canvas'); c.width = 440; c.height = 90;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#0b1f3a';
  ctx.font = "44px 'Segoe Script','Brush Script MT','Snell Roundhand',cursive";
  ctx.textBaseline = 'middle';
  ctx.fillText(text || '', 8, 50);
  return c.toDataURL('image/png');
}

// Draw-your-signature pad.
function SigPad({ onImage }: { onImage: (d: string) => void }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  function pos(e: any) { const c = ref.current!; const r = c.getBoundingClientRect(); const t = e.touches?.[0]; return { x: (t ? t.clientX : e.clientX) - r.left, y: (t ? t.clientY : e.clientY) - r.top }; }
  function start(e: any) { e.preventDefault(); drawing.current = true; const ctx = ref.current!.getContext('2d')!; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); }
  function move(e: any) { if (!drawing.current) return; e.preventDefault(); const ctx = ref.current!.getContext('2d')!; const p = pos(e); ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#0b1f3a'; ctx.lineTo(p.x, p.y); ctx.stroke(); }
  function end() { if (!drawing.current) return; drawing.current = false; onImage(ref.current!.toDataURL('image/png')); }
  function clear() { const c = ref.current!; c.getContext('2d')!.clearRect(0, 0, c.width, c.height); onImage(''); }
  return (
    <div>
      <canvas ref={ref} width={440} height={90} onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end} onTouchStart={start} onTouchMove={move} onTouchEnd={end}
        style={{ width: '100%', maxWidth: 440, height: 90, border: '1px solid #d8cfbe', borderRadius: 8, background: '#fff', touchAction: 'none', cursor: 'crosshair' }} />
      <button type="button" onClick={clear} className="text-[11px] text-text-muted mt-1">Clear</button>
    </div>
  );
}

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
  const [sigMode, setSigMode] = useState<'type' | 'draw'>('type');
  const set = (k: keyof typeof DEFAULTS, v: string) => setF(p => ({ ...p, [k]: v }));

  // Roster for the name dropdown. Picking a name prefills occupation + start
  // date from Staffing / Employee Files — but never the SSN.
  const [employees, setEmployees] = useState<any[]>([]);
  useEffect(() => { fetch('/api/staff/basic').then(r => r.json()).then(d => setEmployees(d.employees ?? [])).catch(() => {}); }, []);
  function pickEmployee(name: string) {
    setF(p => {
      const emp = employees.find(e => String(e.name).toLowerCase() === name.trim().toLowerCase());
      if (!emp) return { ...p, name };
      return { ...p, name, occupation: emp.position || p.occupation, empFrom: toISO(emp.start_date) || p.empFrom };
    });
  }

  // Pre-render Alex's typed signature on first load; load saved signatures from
  // the toolkit (shared across devices) plus this browser's last one.
  const [savedSig, setSavedSig] = useState('');
  const [serverSigs, setServerSigs] = useState<{ name: string; image: string }[]>([]);
  useEffect(() => {
    try { const s = localStorage.getItem('litson_lb0489_sig'); if (s) setSavedSig(s); } catch { /* ignore */ }
    fetch('/api/signatures').then(r => r.json()).then(d => setServerSigs(d.signatures ?? [])).catch(() => {});
    setF(p => p.signatureImage ? p : { ...p, signatureImage: typedToImage(p.signerName) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function setTypedName(v: string) { setF(p => ({ ...p, signerName: v, signatureImage: typedToImage(v) })); }
  async function saveSig() {
    if (!f.signatureImage) return;
    try { localStorage.setItem('litson_lb0489_sig', f.signatureImage); setSavedSig(f.signatureImage); } catch { /* ignore */ }
    try {
      const res = await fetch('/api/signatures', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: f.signerName.trim() || 'Signature', image: f.signatureImage }) });
      const d = await res.json();
      if (d.signatures) setServerSigs(d.signatures);
      showToast(`Saved ${f.signerName || 'signature'} to the toolkit`);
    } catch { showToast('Saved on this device'); }
  }

  // The government PDF expects mm/dd/yyyy; the date pickers give ISO — convert.
  function toMdy(iso: string) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? `${m[2]}/${m[3]}/${m[1]}` : iso;
  }
  const DATE_KEYS: (keyof typeof DEFAULTS)[] = ['empFrom', 'empTo', 'recallDate', 'weekEnding', 'item6From', 'item6To', 'dateCompleted'];

  async function download() {
    setBusy(true);
    try {
      const payload: any = { ...f };
      for (const k of DATE_KEYS) payload[k] = toMdy(f[k]);
      const res = await fetch('/api/hr-forms/lb0489', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
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
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-text-secondary mb-1">Employee name</label>
          <input list="lb-emp" value={f.name} onChange={e => pickEmployee(e.target.value)} placeholder="Pick or type a name" className={inputCls} />
          <datalist id="lb-emp">{employees.map(e => <option key={e.name} value={e.name} />)}</datalist>
        </div>
        <Field label="Social Security Number" value={f.ssn} onChange={v => set('ssn', v)} />
        <Field label="Occupation" value={f.occupation} onChange={v => set('occupation', v)} />
        <Field label="Last employed — From" value={f.empFrom} onChange={v => set('empFrom', v)} type="date" />
        <Field label="Last employed — To" value={f.empTo} onChange={v => set('empTo', v)} type="date" />
        <Field label="Where work was performed" value={f.location} onChange={v => set('location', v)} col={2} />

        <div className="col-span-2 text-xs font-bold uppercase tracking-wider text-gold-muted pt-2">Separation</div>
        <Radio label="Reason for separation" value={f.reason} onChange={v => set('reason', v)} options={['Lack of Work', 'Discharge', 'Quit']} />
        {f.reason === 'Lack of Work' && <Radio label="If lack of work, layoff is" value={f.layoff} onChange={v => set('layoff', v)} options={['Permanent', 'Temporary']} />}
        {f.layoff === 'Temporary' && <Field label="Recall date" value={f.recallDate} onChange={v => set('recallDate', v)} type="date" col={2} />}
        {f.layoff === 'Temporary' && <Field label="Vacation pay — Week ending" value={f.weekEnding} onChange={v => set('weekEnding', v)} type="date" />}
        {f.layoff === 'Temporary' && <Field label="Vacation pay — Amount ($)" value={f.vacationPay} onChange={v => set('vacationPay', v)} />}
        <Field label="If other than lack of work, explain the circumstances" value={f.explain} onChange={v => set('explain', v)} col={2} />

        <div className="col-span-2 text-xs font-bold uppercase tracking-wider text-gold-muted pt-2">Item 6 — Pay after separation</div>
        <Radio label="Employee received" value={f.received} onChange={v => set('received', v)} options={['None', 'Wages in Lieu of Notice', 'Severance Pay']} />
        {f.received !== 'None' && <Field label="Amount ($)" value={f.item6Amount} onChange={v => set('item6Amount', v)} />}
        {f.received !== 'None' && <div className="col-span-2 text-[11px] text-text-muted -mt-1">These dates are the period the pay <b>covers</b> — not the employment dates. Employment dates go in “Last employed — From / To” above.</div>}
        {f.received !== 'None' && <Field label="Pay covers — from" value={f.item6From} onChange={v => set('item6From', v)} type="date" />}
        {f.received !== 'None' && <Field label="Pay covers — to" value={f.item6To} onChange={v => set('item6To', v)} type="date" col={2} />}

        <div className="col-span-2 text-xs font-bold uppercase tracking-wider text-gold-muted pt-2">Employer</div>
        <Field label="Employer name" value={f.employerName} onChange={v => set('employerName', v)} />
        <Field label="Employer telephone" value={f.employerPhone} onChange={v => set('employerPhone', v)} />
        <Field label="Employer address" value={f.employerAddress} onChange={v => set('employerAddress', v)} col={2} />
        <Field label="Employer email" value={f.employerEmail} onChange={v => set('employerEmail', v)} />
        <Field label="TN SUI / Employer account number" value={f.accountNumber} onChange={v => set('accountNumber', v)} />
        <Field label="Title of person signing" value={f.signerTitle} onChange={v => set('signerTitle', v)} />
        <Field label="Date completed & released to employee" value={f.dateCompleted} onChange={v => set('dateCompleted', v)} type="date" />

        <div className="col-span-2 text-xs font-bold uppercase tracking-wider text-gold-muted pt-2">Signature</div>
        <div className="col-span-2">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {(['type', 'draw'] as const).map(m => (
              <button key={m} type="button" onClick={() => setSigMode(m)} className={`text-xs font-semibold px-3 py-1.5 rounded-ctrl border ${sigMode === m ? 'bg-ink text-white border-ink' : 'bg-white text-text-secondary border-border-light hover:border-ink'}`}>{m === 'type' ? 'Type name' : 'Draw'}</button>
            ))}
            {serverSigs.map(s => (
              <button key={s.name} type="button" onClick={() => setF(p => ({ ...p, signatureImage: s.image, signerName: s.name }))} className="text-xs font-semibold text-[#3f6b8a] hover:underline">Use {s.name}</button>
            ))}
            {savedSig && !serverSigs.length && <button type="button" onClick={() => set('signatureImage', savedSig)} className="text-xs font-semibold text-[#3f6b8a] hover:underline">Use saved signature</button>}
            {f.signatureImage && <button type="button" onClick={saveSig} className="text-xs font-semibold text-[#2f7d5b] hover:underline">💾 Save this signature</button>}
            {f.signatureImage && <button type="button" onClick={() => set('signatureImage', '')} className="text-xs text-litred-alt">Clear</button>}
          </div>
          {sigMode === 'type'
            ? <input value={f.signerName} onChange={e => setTypedName(e.target.value)} placeholder="Signer's full name" className={inputCls} />
            : <SigPad onImage={img => set('signatureImage', img)} />}
          {f.signatureImage
            // eslint-disable-next-line @next/next/no-img-element
            ? <div className="mt-2"><span className="text-[11px] text-text-muted">Signature preview:</span><br /><img src={f.signatureImage} alt="signature" style={{ height: 46, maxWidth: 240 }} /></div>
            : <p className="text-[11px] text-text-muted mt-1">No signature — the line will be left blank to sign by hand.</p>}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button onClick={download} disabled={busy} className="bg-ink text-white text-sm font-semibold px-4 py-2.5 rounded-ctrl hover:bg-ink-dark disabled:opacity-50">
          {busy ? 'Generating…' : '⤓ Download filled LB-0489 (official PDF)'}
        </button>
        <button onClick={() => setF({ ...DEFAULTS })} className="text-sm font-semibold text-text-muted hover:text-text-primary px-3 py-2.5">Reset</button>
      </div>
      <p className="text-[11px] text-text-faint mt-2">The signature above is stamped onto the official PDF. The downloaded copy is finalized (flattened) so it can’t be edited outside the toolkit — make changes here and re-download.</p>
    </div>
  );
}

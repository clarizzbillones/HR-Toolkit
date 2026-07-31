'use client';
import { useEffect, useRef, useState } from 'react';
import { W8BEN_FIELDS } from '@/lib/w8ben';

function SignPad({ onImage }: { onImage: (d: string) => void }) {
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
      <button type="button" onClick={clear} style={{ marginTop: 4, background: 'none', border: 'none', color: '#8a8474', fontSize: 12, cursor: 'pointer' }}>Clear</button>
    </div>
  );
}

export default function W8benPage({ params }: { params: { token: string } }) {
  const { token } = params;
  const [row, setRow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<Record<string, any>>({});
  const [sigMode, setSigMode] = useState<'type' | 'draw'>('type');
  const [drawn, setDrawn] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/onboarding/w8ben?token=${encodeURIComponent(token)}`).then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else { setRow(d.row); if (d.row?.status === 'Completed') setDone(true); else setData(d.row?.data ?? {}); } })
      .catch(() => setError('Could not load this form.')).finally(() => setLoading(false));
  }, [token]);

  const inp: React.CSSProperties = { width: '100%', border: '1px solid #d8cfbe', borderRadius: 8, padding: '9px 11px', fontSize: 15, boxSizing: 'border-box' };
  function set(k: string, v: any) { setData(d => ({ ...d, [k]: v })); }

  async function submit() {
    for (const f of W8BEN_FIELDS) if (f.req && !String(data[f.id] ?? '').trim()) { setError(`Please complete: ${f.label}`); return; }
    if (!data.capacity) { setError('Please check the certification box to sign.'); return; }
    const signatureImage = sigMode === 'draw' ? drawn : '';
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/onboarding/w8ben', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'submit', token, data: { ...data, signatureImage } }) });
      const d = await res.json();
      if (!res.ok) { setError(d.error || 'Could not submit.'); return; }
      setDone(true);
    } catch { setError('Could not submit.'); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#faf8f4', padding: '32px 16px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ background: '#1b2a3d', borderTop: '3px solid #c9a24a', borderRadius: 10, padding: '16px 18px', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: 4, color: '#c9a24a' }}>LITSON</div>
          <div style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#9fb0c4', marginTop: 2 }}>PLLC · Human Resources</div>
          <div style={{ fontSize: 19, fontWeight: 700, color: '#fff', marginTop: 9 }}>Form W-8BEN</div>
          <div style={{ fontSize: 12, color: '#9fb0c4', marginTop: 2 }}>Certificate of Foreign Status of Beneficial Owner</div>
        </div>
        {loading ? <p style={{ color: '#8a8474' }}>Loading…</p>
        : error && !row ? <div style={{ background: '#fff', border: '1px solid #e6ddcd', borderRadius: 12, padding: 24, color: '#b0412f' }}>{error}</div>
        : done ? (
          <div style={{ background: '#eef5f1', border: '1px solid #cfe4d8', borderRadius: 12, padding: 22, textAlign: 'center' }}>
            <div style={{ fontWeight: 700, color: '#2f7d5b', fontSize: 16 }}>✓ Thank you.</div>
            <div style={{ color: '#33503f', fontSize: 13, marginTop: 4 }}>Your W-8BEN has been submitted. A finalized PDF has been sent to Litson PLLC and to you. You can close this page.</div>
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #e6ddcd', borderRadius: 12, padding: 22 }}>
            <p style={{ marginTop: 0, color: '#555', fontSize: 13 }}>Please complete the fields below exactly as they should appear on the official IRS form. We’ll place them onto the government PDF and send you a finalized, non-editable copy.</p>
            {W8BEN_FIELDS.map(f => (
              <div key={f.id} style={{ marginBottom: 12 }}>
                {f.type === 'check' ? (
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, color: '#1b2a3d', cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!data[f.id]} onChange={e => set(f.id, e.target.checked)} /> {f.label}
                  </label>
                ) : (
                  <>
                    <label style={{ display: 'block', fontWeight: 600, color: '#1b2a3d', marginBottom: 5, fontSize: 13.5 }}>{f.label}{f.req ? ' *' : ''}</label>
                    <input type={f.type === 'date' ? 'date' : 'text'} value={data[f.id] ?? ''} onChange={e => set(f.id, e.target.value)} style={inp} />
                  </>
                )}
              </div>
            ))}
            <div style={{ marginTop: 4, marginBottom: 12 }}>
              <label style={{ display: 'block', fontWeight: 600, color: '#1b2a3d', marginBottom: 6, fontSize: 13.5 }}>Signature of beneficial owner *</label>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                {(['type', 'draw'] as const).map(m => (
                  <button key={m} type="button" onClick={() => setSigMode(m)} style={{ fontSize: 13, fontWeight: 600, padding: '5px 12px', borderRadius: 6, cursor: 'pointer', border: '1px solid ' + (sigMode === m ? '#1b2a3d' : '#d8cfbe'), background: sigMode === m ? '#1b2a3d' : '#fff', color: sigMode === m ? '#fff' : '#555' }}>{m === 'type' ? 'Type name' : 'Draw'}</button>
                ))}
              </div>
              {sigMode === 'type'
                ? <input value={data.printName ?? ''} onChange={e => set('printName', e.target.value)} placeholder="Type your full legal name" style={{ ...inp, fontFamily: 'Georgia, serif', fontStyle: 'italic' }} />
                : <SignPad onImage={setDrawn} />}
              <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 12, fontSize: 13, color: '#1b2a3d', cursor: 'pointer' }}>
                <input type="checkbox" checked={!!data.capacity} onChange={e => set('capacity', e.target.checked)} style={{ marginTop: 3 }} />
                <span>I certify that I have the capacity to sign for the person identified on line 1 of this form. *</span>
              </label>
              <p style={{ fontSize: 11, color: '#8a8474', marginTop: 6 }}>Under penalties of perjury, this is your electronic signature certifying the information is true, correct, and complete.</p>
            </div>
            {error && <p style={{ color: '#b0412f', fontSize: 13 }}>{error}</p>}
            <button onClick={submit} disabled={busy} style={{ marginTop: 4, background: busy ? '#9aa4b0' : '#1b2a3d', color: '#fff', border: 'none', fontWeight: 700, padding: '12px 24px', borderRadius: 8, cursor: 'pointer', fontSize: 15 }}>{busy ? 'Submitting…' : 'Submit W-8BEN'}</button>
          </div>
        )}
      </div>
    </div>
  );
}

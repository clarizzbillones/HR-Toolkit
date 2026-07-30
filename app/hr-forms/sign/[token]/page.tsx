'use client';
import { useEffect, useRef, useState } from 'react';

interface Sig { role: string; name: string; signed_at?: string | null; signature_name?: string | null; signature_image?: string | null }

const ROLE_BADGE: Record<string, string> = {
  HR: '#3f5a76', Manager: '#8a6d2a', Employee: '#2f7d5b', Witness: '#8b5a2b',
};

function SignPad({ onImage }: { onImage: (d: string | null) => void }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);
  function pos(e: any) {
    const c = ref.current!; const r = c.getBoundingClientRect();
    const t = e.touches?.[0];
    return { x: (t ? t.clientX : e.clientX) - r.left, y: (t ? t.clientY : e.clientY) - r.top };
  }
  function start(e: any) { e.preventDefault(); drawing.current = true; const ctx = ref.current!.getContext('2d')!; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); }
  function move(e: any) {
    if (!drawing.current) return; e.preventDefault();
    const ctx = ref.current!.getContext('2d')!; const p = pos(e);
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#1b2a3d'; ctx.lineTo(p.x, p.y); ctx.stroke();
    dirty.current = true;
  }
  function end() { if (!drawing.current) return; drawing.current = false; if (dirty.current) onImage(ref.current!.toDataURL('image/png')); }
  function clear() { const c = ref.current!; c.getContext('2d')!.clearRect(0, 0, c.width, c.height); dirty.current = false; onImage(null); }
  return (
    <div>
      <canvas ref={ref} width={440} height={120}
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={move} onTouchEnd={end}
        style={{ width: '100%', maxWidth: 440, height: 120, border: '1px solid #d8cfbe', borderRadius: 8, background: '#fff', touchAction: 'none', cursor: 'crosshair' }} />
      <button type="button" onClick={clear} style={{ marginTop: 6, background: 'none', border: 'none', color: '#8a8474', fontSize: 12, cursor: 'pointer' }}>Clear</button>
    </div>
  );
}

export default function HrFormSignPage({ params }: { params: { token: string } }) {
  const { token } = params;
  const [row, setRow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [mode, setMode] = useState<'type' | 'draw'>('type');
  const [typed, setTyped] = useState('');
  const [drawn, setDrawn] = useState<string | null>(null);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  function load() {
    return fetch(`/api/hr-forms/sign?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setRow(d.row); })
      .catch(() => setError('Could not load this form.'))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token]);

  const sigs: Sig[] = row?.signatories ?? [];
  const requiredLeft = sigs.filter(s => !s.signed_at && s.role !== 'Witness').length;
  const allSigned = sigs.length > 0 && requiredLeft === 0;

  function openSign(i: number) { setOpenIdx(i); setMode('type'); setTyped(sigs[i].name || ''); setDrawn(null); setAck(false); setError(''); }

  async function submit(i: number) {
    const s = sigs[i];
    const signature_name = mode === 'type' ? typed.trim() : '';
    const signature_image = mode === 'draw' ? drawn : null;
    if ((!signature_name && !signature_image) || !ack) return;
    setBusy(true);
    try {
      const res = await fetch('/api/hr-forms/sign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'sign', token, role: s.role, name: s.name, signature_name, signature_image }) });
      const d = await res.json();
      if (!res.ok) { setError(d.error || 'Could not submit.'); return; }
      setOpenIdx(null); setMsg(d.allSigned ? 'All required signatures complete — thank you.' : 'Your signature is recorded.');
      await load();
    } catch { setError('Could not submit.'); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#faf8f4', padding: '32px 16px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {loading ? <p style={{ color: '#8a8474' }}>Loading…</p>
        : error && !row ? (
          <div style={{ background: '#fff', border: '1px solid #e6ddcd', borderRadius: 12, padding: 28, textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: 4, color: '#c9a24a' }}>LITSON</div>
            <p style={{ marginTop: 12, color: '#b0412f' }}>{error}</p>
          </div>
        ) : (
          <>
            {row.note && (
              <div style={{ background: '#f7efe1', border: '1px solid #ecd9b6', borderRadius: 12, padding: 14, marginBottom: 16, color: '#8a6d2a', fontWeight: 600 }}>
                ⏱ {row.note}
              </div>
            )}
            <div style={{ background: '#fff', border: '1px solid #e6ddcd', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div dangerouslySetInnerHTML={{ __html: row.body_html || `<h2>${row.title}</h2>` }} />
            </div>

            {msg && <div style={{ background: '#eef5f1', border: '1px solid #cfe4d8', borderRadius: 12, padding: 14, marginTop: 16, color: '#2f7d5b', fontWeight: 600 }}>{msg}</div>}

            <div style={{ background: '#fff', border: '1px solid #e6ddcd', borderRadius: 12, padding: 20, marginTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#8a8474', marginBottom: 4 }}>Signatures</div>
              {allSigned && <div style={{ color: '#2f7d5b', fontWeight: 700, margin: '8px 0' }}>✓ All required signatures are complete.</div>}
              {sigs.map((s, i) => (
                <div key={i} style={{ borderTop: i ? '1px solid #f1ece3' : 'none', padding: '12px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div>
                      <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, color: '#fff', background: ROLE_BADGE[s.role] ?? '#666', borderRadius: 8, padding: '1px 8px', marginRight: 8 }}>{s.role}</span>
                      <span style={{ fontWeight: 600, color: '#1b2a3d' }}>{s.name}</span>
                      {s.role === 'Witness' && !s.signed_at && <div style={{ fontSize: 12, color: '#8a8474', marginTop: 3 }}>Signs only if the employee declines to sign.</div>}
                    </div>
                    {s.signed_at
                      ? <span style={{ color: '#2f7d5b', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>✓ Signed</span>
                      : openIdx === i ? null
                        : <button onClick={() => openSign(i)} style={{ background: '#1b2a3d', color: '#fff', border: 'none', fontWeight: 700, padding: '8px 16px', borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap' }}>Sign as {s.role}</button>}
                  </div>
                  {s.signed_at && s.signature_image && <img src={s.signature_image} alt="signature" style={{ height: 48, marginTop: 6 }} />}
                  {s.signed_at && !s.signature_image && s.signature_name && <div style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 18, color: '#1b2a3d', marginTop: 4 }}>{s.signature_name}</div>}

                  {openIdx === i && !s.signed_at && (
                    <div style={{ marginTop: 10, background: '#faf8f4', borderRadius: 8, padding: 12 }}>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                        {(['type', 'draw'] as const).map(m => (
                          <button key={m} onClick={() => setMode(m)} style={{ fontSize: 13, fontWeight: 600, padding: '5px 12px', borderRadius: 6, cursor: 'pointer', border: '1px solid ' + (mode === m ? '#1b2a3d' : '#d8cfbe'), background: mode === m ? '#1b2a3d' : '#fff', color: mode === m ? '#fff' : '#555' }}>{m === 'type' ? 'Type name' : 'Draw signature'}</button>
                        ))}
                      </div>
                      {mode === 'type'
                        ? <input value={typed} onChange={e => setTyped(e.target.value)} placeholder="Type your full legal name" style={{ width: '100%', border: '1px solid #d8cfbe', borderRadius: 8, padding: '10px 12px', fontSize: 15, boxSizing: 'border-box', fontFamily: 'Georgia, serif', fontStyle: 'italic' }} />
                        : <SignPad onImage={setDrawn} />}
                      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 10, fontSize: 13, color: '#444', cursor: 'pointer' }}>
                        <input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} style={{ marginTop: 3 }} />
                        <span>I acknowledge I have reviewed this document. My signature above is my electronic signature, dated at submission. It does not necessarily indicate agreement with its contents.</span>
                      </label>
                      {error && <p style={{ color: '#b0412f', fontSize: 13, marginTop: 8 }}>{error}</p>}
                      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                        <button onClick={() => submit(i)} disabled={busy || !ack || (mode === 'type' ? !typed.trim() : !drawn)} style={{ background: (busy || !ack || (mode === 'type' ? !typed.trim() : !drawn)) ? '#9aa4b0' : '#1b2a3d', color: '#fff', border: 'none', fontWeight: 700, padding: '10px 20px', borderRadius: 8, cursor: 'pointer' }}>{busy ? 'Submitting…' : 'Sign & submit'}</button>
                        <button onClick={() => setOpenIdx(null)} style={{ background: 'none', border: 'none', color: '#8a8474', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

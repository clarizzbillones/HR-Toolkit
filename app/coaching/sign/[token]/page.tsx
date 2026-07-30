'use client';
import { useEffect, useState } from 'react';
import { coachingDocHtml, parseSignatories, type Signatory } from '@/lib/coachingDoc';

export default function CoachingSignPage({ params }: { params: { token: string } }) {
  const { token } = params;
  const [row, setRow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [signing, setSigning] = useState<string | null>(null); // signatory name being signed
  const [name, setName] = useState('');
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  function load() {
    return fetch(`/api/coaching/sign?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setRow(d.row); })
      .catch(() => setError('Could not load this form.'))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token]);

  const signers: Signatory[] = row ? parseSignatories(row.signatories) : [];
  const allSigned = signers.length > 0 ? signers.every(s => s.signed_at) : !!row?.signed_at;

  async function submit() {
    if (!name.trim() || !ack || !signing) return;
    setBusy(true);
    try {
      const res = await fetch('/api/coaching/sign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, signatory: signing, signature_name: name.trim() }) });
      const d = await res.json();
      if (!res.ok) { setError(d.error || 'Could not submit.'); return; }
      setSigning(null); setName(''); setAck(false);
      setMsg(d.allSigned ? 'All signatures complete — thank you.' : 'Your signature is recorded.');
      await load();
    } catch { setError('Could not submit.'); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#faf8f4', padding: '32px 16px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {loading ? (
          <p style={{ color: '#8a8474' }}>Loading…</p>
        ) : error && !row ? (
          <div style={{ background: '#fff', border: '1px solid #e6ddcd', borderRadius: 12, padding: 28, textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: 4, color: '#c9a24a' }}>LITSON</div>
            <p style={{ marginTop: 12, color: '#b0412f' }}>{error}</p>
          </div>
        ) : (
          <>
            <div style={{ background: '#fff', border: '1px solid #e6ddcd', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div dangerouslySetInnerHTML={{ __html: coachingDocHtml(row) }} />
            </div>

            {msg && <div style={{ background: '#eef5f1', border: '1px solid #cfe4d8', borderRadius: 12, padding: 14, marginTop: 16, color: '#2f7d5b', fontWeight: 600 }}>{msg}</div>}

            {allSigned ? (
              <div style={{ background: '#eef5f1', border: '1px solid #cfe4d8', borderRadius: 12, padding: 20, marginTop: 16, textAlign: 'center' }}>
                <div style={{ fontWeight: 700, color: '#2f7d5b', fontSize: 16 }}>✓ This form is fully signed.</div>
                <div style={{ color: '#33503f', fontSize: 13, marginTop: 4 }}>Signed copies have been emailed to all signatories and HR. You can close this page.</div>
              </div>
            ) : (
              <div style={{ background: '#fff', border: '1px solid #e6ddcd', borderRadius: 12, padding: 20, marginTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#8a8474', marginBottom: 12 }}>Signatures</div>
                {signers.length === 0 && <p style={{ fontSize: 13, color: '#666' }}>No signatories listed on this form.</p>}
                {signers.map((s, i) => (
                  <div key={i} style={{ borderTop: i ? '1px solid #f1ece3' : 'none', padding: '10px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                      <div>
                        <div style={{ fontWeight: 600, color: '#1b2a3d' }}>{s.name}</div>
                        <div style={{ fontSize: 12, color: '#8a8474' }}>{s.position}</div>
                      </div>
                      {s.signed_at
                        ? <span style={{ color: '#2f7d5b', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>✓ Signed</span>
                        : signing === s.name
                          ? null
                          : <button onClick={() => { setSigning(s.name); setName(s.name); setAck(false); setError(''); }} style={{ background: '#1b2a3d', color: '#fff', border: 'none', fontWeight: 700, padding: '8px 16px', borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap' }}>Sign as {s.name.split(' ')[0]}</button>}
                    </div>
                    {signing === s.name && !s.signed_at && (
                      <div style={{ marginTop: 10, background: '#faf8f4', borderRadius: 8, padding: 12 }}>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 4 }}>Type your full legal name</label>
                        <input value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', border: '1px solid #d8cfbe', borderRadius: 8, padding: '10px 12px', fontSize: 15, boxSizing: 'border-box' }} />
                        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 10, fontSize: 13, color: '#444', cursor: 'pointer' }}>
                          <input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} style={{ marginTop: 3 }} />
                          <span>I acknowledge I have reviewed this coaching form. Typing my name is my electronic signature, dated at submission.</span>
                        </label>
                        {error && <p style={{ color: '#b0412f', fontSize: 13, marginTop: 8 }}>{error}</p>}
                        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                          <button onClick={submit} disabled={!name.trim() || !ack || busy} style={{ background: (!name.trim() || !ack || busy) ? '#9aa4b0' : '#1b2a3d', color: '#fff', border: 'none', fontWeight: 700, padding: '10px 20px', borderRadius: 8, cursor: (!name.trim() || !ack || busy) ? 'default' : 'pointer' }}>{busy ? 'Submitting…' : 'Sign & submit'}</button>
                          <button onClick={() => { setSigning(null); setError(''); }} style={{ background: 'none', border: 'none', color: '#8a8474', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

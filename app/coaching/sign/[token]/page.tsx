'use client';
import { useEffect, useState } from 'react';
import { coachingDocHtml } from '@/lib/coachingDoc';

export default function CoachingSignPage({ params }: { params: { token: string } }) {
  const { token } = params;
  const [row, setRow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/coaching/sign?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else { setRow(d.row); if (d.row?.signed_at) setDone(true); } })
      .catch(() => setError('Could not load this form.'))
      .finally(() => setLoading(false));
  }, [token]);

  async function sign() {
    if (!name.trim() || !ack) return;
    setBusy(true);
    try {
      const res = await fetch('/api/coaching/sign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, signature_name: name.trim() }) });
      const d = await res.json();
      if (!res.ok) { setError(d.error || 'Could not submit.'); return; }
      setDone(true);
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

            {done ? (
              <div style={{ background: '#eef5f1', border: '1px solid #cfe4d8', borderRadius: 12, padding: 20, marginTop: 16, textAlign: 'center' }}>
                <div style={{ fontWeight: 700, color: '#2f7d5b', fontSize: 16 }}>✓ Thank you — your form is signed.</div>
                <div style={{ color: '#33503f', fontSize: 13, marginTop: 4 }}>A signed copy has been emailed to you, your coach, and HR. You can close this page.</div>
              </div>
            ) : (
              <div style={{ background: '#fff', border: '1px solid #e6ddcd', borderRadius: 12, padding: 20, marginTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#8a8474', marginBottom: 10 }}>Electronic signature</div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 4 }}>Type your full legal name</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name"
                  style={{ width: '100%', border: '1px solid #d8cfbe', borderRadius: 8, padding: '10px 12px', fontSize: 15, boxSizing: 'border-box' }} />
                <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 12, fontSize: 13, color: '#444', cursor: 'pointer' }}>
                  <input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} style={{ marginTop: 3 }} />
                  <span>I acknowledge that I have reviewed this coaching form. Typing my name serves as my electronic signature and is dated at the time of submission.</span>
                </label>
                {error && <p style={{ color: '#b0412f', fontSize: 13, marginTop: 10 }}>{error}</p>}
                <button onClick={sign} disabled={!name.trim() || !ack || busy}
                  style={{ marginTop: 14, background: (!name.trim() || !ack || busy) ? '#9aa4b0' : '#1b2a3d', color: '#fff', border: 'none', fontWeight: 700, padding: '11px 22px', borderRadius: 8, cursor: (!name.trim() || !ack || busy) ? 'default' : 'pointer' }}>
                  {busy ? 'Submitting…' : 'Sign & submit'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

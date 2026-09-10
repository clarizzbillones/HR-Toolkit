'use client';
import { useEffect, useState } from 'react';

interface Field { id: string; label: string; type: string; hint?: string }

export default function InfoRequestPage({ params }: { params: { token: string } }) {
  const { token } = params;
  const [row, setRow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/info-request?token=${encodeURIComponent(token)}`).then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else { setRow(d.row); if (d.row?.status === 'Completed') { setDone(true); setAnswers(d.row.answers || {}); } } })
      .catch(() => setError('Could not load this form.')).finally(() => setLoading(false));
  }, [token]);

  const fields: Field[] = row?.fields ?? [];

  async function submit() {
    setError('');
    // Require every requested field; validate email fields lightly.
    const missing = fields.filter(f => !String(answers[f.id] ?? '').trim());
    if (missing.length) { setError(`Please fill in: ${missing.map(f => f.label).join(', ')}`); return; }
    const badEmail = fields.find(f => f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(answers[f.id] ?? '').trim()));
    if (badEmail) { setError(`Please enter a valid ${badEmail.label.toLowerCase()}.`); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/info-request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'submit', token, answers }) });
      const d = await res.json();
      if (!res.ok) { setError(d.error || 'Could not submit.'); if (d.done) setDone(true); return; }
      setDone(true);
    } catch { setError('Could not submit — please try again.'); }
    finally { setBusy(false); }
  }

  const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #d8cfbe', borderRadius: 8, padding: '10px 12px', fontSize: 15, color: '#1b2a3d', outline: 'none' };

  return (
    <div style={{ minHeight: '100vh', background: '#faf8f4', padding: '32px 16px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <div style={{ background: '#1b2a3d', borderTop: '3px solid #c9a24a', borderRadius: 10, padding: '16px 18px', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: 4, color: '#c9a24a' }}>LITSON PLLC</div>
          <div style={{ fontSize: 19, fontWeight: 700, color: '#fff', marginTop: 8 }}>Update Your Information</div>
        </div>

        {loading ? <p style={{ color: '#8a8474' }}>Loading…</p>
        : error && !row ? <div style={{ background: '#fff', border: '1px solid #e6ddcd', borderRadius: 12, padding: 24, color: '#b0412f' }}>{error}</div>
        : done ? (
          <div style={{ background: '#eef5f1', border: '1px solid #cfe4d8', borderRadius: 12, padding: 22, textAlign: 'center' }}>
            <div style={{ fontWeight: 700, color: '#2f7d5b', fontSize: 16 }}>✓ Thank you!</div>
            <div style={{ color: '#33503f', fontSize: 13, marginTop: 4 }}>Your information has been recorded. You can close this page.</div>
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #e6ddcd', borderRadius: 12, padding: 22 }}>
            <p style={{ marginTop: 0, color: '#555' }}>Hi {String(row?.name || '').split(' ')[0]}, please confirm the details below so our records are up to date. No login or password needed.</p>
            {fields.map((f, i) => (
              <div key={f.id} style={{ borderTop: i === 0 ? 'none' : '1px solid #eee3d0', paddingTop: i === 0 ? 6 : 14, marginTop: i === 0 ? 0 : 2, marginBottom: 4 }}>
                <label style={{ display: 'block', fontWeight: 600, color: '#1b2a3d', fontSize: 14, marginBottom: 6 }}>{f.label}</label>
                {f.type === 'textarea'
                  ? <textarea value={answers[f.id] ?? ''} onChange={e => setAnswers(a => ({ ...a, [f.id]: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                  : <input type={f.type === 'email' ? 'email' : f.type === 'tel' ? 'tel' : f.type === 'date' ? 'date' : 'text'}
                      value={answers[f.id] ?? ''} onChange={e => setAnswers(a => ({ ...a, [f.id]: e.target.value }))}
                      autoComplete={f.type === 'email' ? 'email' : f.type === 'tel' ? 'tel' : 'off'} style={inputStyle} />}
                {f.hint && <div style={{ fontSize: 12, color: '#8a8474', marginTop: 6 }}>{f.hint}</div>}
              </div>
            ))}
            {error && <p style={{ color: '#b0412f', fontSize: 13, marginTop: 14 }}>{error}</p>}
            <button onClick={submit} disabled={busy} style={{ marginTop: 16, background: busy ? '#9aa4b0' : '#1b2a3d', color: '#fff', border: 'none', fontWeight: 700, padding: '12px 24px', borderRadius: 8, cursor: busy ? 'default' : 'pointer', fontSize: 15 }}>{busy ? 'Submitting…' : 'Submit'}</button>
            <p style={{ fontSize: 12, color: '#999', marginTop: 14 }}>Your responses are shared only with Litson PLLC's HR team.</p>
          </div>
        )}
      </div>
    </div>
  );
}

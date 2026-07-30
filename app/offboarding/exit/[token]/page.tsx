'use client';
import { useEffect, useState } from 'react';

export default function ExitInterviewPage({ params }: { params: { token: string } }) {
  const { token } = params;
  const [row, setRow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/offboarding/exit?token=${encodeURIComponent(token)}`).then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else { setRow(d.row); if (d.row?.status === 'Completed') { setDone(true); setAnswers(d.row.answers || {}); } } })
      .catch(() => setError('Could not load this form.')).finally(() => setLoading(false));
  }, [token]);

  async function submit() {
    setBusy(true);
    try {
      const res = await fetch('/api/offboarding/exit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'submit', token, answers }) });
      const d = await res.json();
      if (!res.ok) { setError(d.error || 'Could not submit.'); return; }
      setDone(true);
    } catch { setError('Could not submit.'); }
    finally { setBusy(false); }
  }

  const inp: React.CSSProperties = { width: '100%', border: '1px solid #d8cfbe', borderRadius: 8, padding: '10px 12px', fontSize: 15, boxSizing: 'border-box' };

  return (
    <div style={{ minHeight: '100vh', background: '#faf8f4', padding: '32px 16px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ background: '#1b2a3d', borderTop: '3px solid #c9a24a', borderRadius: 10, padding: '16px 18px', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: 4, color: '#c9a24a' }}>LITSON</div>
          <div style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#9fb0c4', marginTop: 2 }}>PLLC · Human Resources</div>
          <div style={{ fontSize: 19, fontWeight: 700, color: '#fff', marginTop: 9 }}>Exit Interview</div>
        </div>
        {loading ? <p style={{ color: '#8a8474' }}>Loading…</p>
        : error && !row ? <div style={{ background: '#fff', border: '1px solid #e6ddcd', borderRadius: 12, padding: 24, color: '#b0412f' }}>{error}</div>
        : done ? (
          <div style={{ background: '#eef5f1', border: '1px solid #cfe4d8', borderRadius: 12, padding: 22, textAlign: 'center' }}>
            <div style={{ fontWeight: 700, color: '#2f7d5b', fontSize: 16 }}>✓ Thank you.</div>
            <div style={{ color: '#33503f', fontSize: 13, marginTop: 4 }}>Your exit interview has been submitted. You can close this page.</div>
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #e6ddcd', borderRadius: 12, padding: 22 }}>
            <p style={{ marginTop: 0, color: '#555' }}>Hi {String(row?.employee_name || '').split(' ')[0]}, your candid feedback is confidential and helps us improve. Thank you for taking a few minutes.</p>
            {(row?.questions ?? []).map((q: any) => (
              <div key={q.id} style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontWeight: 600, color: '#1b2a3d', marginBottom: 6 }}>{q.label}</label>
                {q.type === 'longtext' ? <textarea rows={3} value={answers[q.id] ?? ''} onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))} style={{ ...inp, resize: 'vertical' }} />
                : q.type === 'choice' ? (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {q.options.map((o: string) => (
                      <button key={o} type="button" onClick={() => setAnswers(a => ({ ...a, [q.id]: o }))} style={{ fontSize: 13, fontWeight: 600, padding: '7px 12px', borderRadius: 8, cursor: 'pointer', border: '1px solid ' + (answers[q.id] === o ? '#1b2a3d' : '#d8cfbe'), background: answers[q.id] === o ? '#1b2a3d' : '#fff', color: answers[q.id] === o ? '#fff' : '#555' }}>{o}</button>
                    ))}
                  </div>
                ) : q.type === 'rating' ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[1, 2, 3, 4, 5].map(n => (
                      <button key={n} type="button" onClick={() => setAnswers(a => ({ ...a, [q.id]: n }))} style={{ width: 40, height: 40, borderRadius: 8, cursor: 'pointer', fontWeight: 700, border: '1px solid ' + (answers[q.id] === n ? '#c9a24a' : '#d8cfbe'), background: answers[q.id] === n ? '#c9a24a' : '#fff', color: answers[q.id] === n ? '#1b2a3d' : '#555' }}>{n}</button>
                    ))}
                  </div>
                ) : <input value={answers[q.id] ?? ''} onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))} style={inp} />}
              </div>
            ))}
            {error && <p style={{ color: '#b0412f', fontSize: 13 }}>{error}</p>}
            <button onClick={submit} disabled={busy} style={{ marginTop: 6, background: busy ? '#9aa4b0' : '#1b2a3d', color: '#fff', border: 'none', fontWeight: 700, padding: '12px 24px', borderRadius: 8, cursor: 'pointer', fontSize: 15 }}>{busy ? 'Submitting…' : 'Submit exit interview'}</button>
          </div>
        )}
      </div>
    </div>
  );
}

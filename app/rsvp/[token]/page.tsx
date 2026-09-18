'use client';
import { useEffect, useState } from 'react';

interface Q { id: string; label: string; type?: 'choice' | 'text'; options?: string[]; showIf?: { q: string; value: string } }

export default function RsvpPage({ params }: { params: { token: string } }) {
  const { token } = params;
  const [row, setRow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/rsvp?token=${encodeURIComponent(token)}`).then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else { setRow(d.row); if (d.row?.status === 'Completed') { setDone(true); setAnswers(d.row.answers || {}); } } })
      .catch(() => setError('Could not load this form.')).finally(() => setLoading(false));
  }, [token]);

  const ev = row?.event;
  const questions: Q[] = ev?.questions ?? [];

  // A question is shown only if it has no condition, or the referenced answer
  // matches AND that referenced question is itself shown (so chained conditions
  // like plus-one → plus-one name hide together when "attending" is No).
  const byId = (id: string) => questions.find(q => q.id === id);
  const visible = (q: Q): boolean => {
    if (!q.showIf) return true;
    const parent = byId(q.showIf.q);
    if (parent && !visible(parent)) return false;
    return answers[q.showIf.q] === q.showIf.value;
  };

  async function submit() {
    setError('');
    const shown = questions.filter(visible);
    const missing = shown.filter(q => !String(answers[q.id] ?? '').trim());
    if (missing.length) { setError('Please answer every question.'); return; }
    // Only submit answers for the questions that were shown.
    const clean: Record<string, string> = {};
    for (const q of shown) if (answers[q.id] != null) clean[q.id] = answers[q.id];
    setBusy(true);
    try {
      const res = await fetch('/api/rsvp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'submit', token, answers: clean }) });
      const d = await res.json();
      if (!res.ok) { setError(d.error || 'Could not submit.'); if (d.done) setDone(true); return; }
      setDone(true);
    } catch { setError('Could not submit — please try again.'); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#faf8f4', padding: '32px 16px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <div style={{ background: '#1b2a3d', borderTop: '3px solid #c9a24a', borderRadius: 10, padding: '16px 18px', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: 4, color: '#c9a24a' }}>LITSON PLLC</div>
          <div style={{ fontSize: 19, fontWeight: 700, color: '#fff', marginTop: 8 }}>{ev?.title ?? 'RSVP'}</div>
        </div>

        {loading ? <p style={{ color: '#8a8474' }}>Loading…</p>
        : error && !row ? <div style={{ background: '#fff', border: '1px solid #e6ddcd', borderRadius: 12, padding: 24, color: '#b0412f' }}>{error}</div>
        : done ? (
          <div style={{ background: '#eef5f1', border: '1px solid #cfe4d8', borderRadius: 12, padding: 22, textAlign: 'center' }}>
            <div style={{ fontWeight: 700, color: '#2f7d5b', fontSize: 16 }}>✓ Thank you for your RSVP!</div>
            <div style={{ color: '#33503f', fontSize: 13, marginTop: 4 }}>Your response has been recorded. You can close this page.</div>
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #e6ddcd', borderRadius: 12, padding: 22 }}>
            {ev?.description && <p style={{ marginTop: 0, color: '#555', whiteSpace: 'pre-wrap' }}>{ev.description}</p>}
            {(() => { let num = 0; return questions.filter(visible).map((q) => {
              const isText = q.type === 'text';
              if (!isText) num += 1;
              return (
                <div key={q.id} style={{ borderTop: '1px solid #eee3d0', paddingTop: 14, marginTop: 12 }}>
                  <div style={{ fontWeight: 600, color: '#1b2a3d', fontSize: 15, marginBottom: 8 }}>{isText ? '' : `${num}. `}{q.label}</div>
                  {isText ? (
                    <input value={answers[q.id] ?? ''} onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))} placeholder="Full name"
                      style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #d8cfbe', borderRadius: 8, padding: '10px 12px', fontSize: 15, color: '#1b2a3d', outline: 'none' }} />
                  ) : (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {(q.options ?? []).map(o => {
                        const on = answers[q.id] === o;
                        return (
                          <button key={o} type="button" onClick={() => setAnswers(a => ({ ...a, [q.id]: o }))}
                            style={{ fontSize: 14, fontWeight: 600, padding: '9px 20px', borderRadius: 20, cursor: 'pointer', border: '1px solid ' + (on ? '#1b2a3d' : '#d8cfbe'), background: on ? '#1b2a3d' : '#fff', color: on ? '#fff' : '#555' }}>{o}</button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }); })()}
            {error && <p style={{ color: '#b0412f', fontSize: 13, marginTop: 14 }}>{error}</p>}
            <button onClick={submit} disabled={busy} style={{ marginTop: 18, background: busy ? '#9aa4b0' : '#1b2a3d', color: '#fff', border: 'none', fontWeight: 700, padding: '12px 24px', borderRadius: 8, cursor: busy ? 'default' : 'pointer', fontSize: 15 }}>{busy ? 'Submitting…' : 'Submit RSVP'}</button>
            <p style={{ fontSize: 12, color: '#999', marginTop: 14 }}>Your response is shared only with Litson PLLC's HR team.</p>
          </div>
        )}
      </div>
    </div>
  );
}

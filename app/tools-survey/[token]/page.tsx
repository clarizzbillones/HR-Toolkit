'use client';
import { useEffect, useState } from 'react';

interface Tool { name: string; hint: string }
const OPTS: { key: string; label: string }[] = [
  { key: 'use', label: 'I use it' },
  { key: 'access', label: 'Have access, don’t use' },
  { key: 'no', label: 'No access' },
];

export default function ToolsSurveyPage({ params }: { params: { token: string } }) {
  const { token } = params;
  const [row, setRow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/tools-survey?token=${encodeURIComponent(token)}`).then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else { setRow(d.row); if (d.row?.status === 'Completed') { setDone(true); setAnswers(d.row.answers || {}); } } })
      .catch(() => setError('Could not load this form.')).finally(() => setLoading(false));
  }, [token]);

  async function submit() {
    setError('');
    const tools: Tool[] = row?.tools ?? [];
    const missing = tools.filter(t => !answers[t.name]);
    if (missing.length) { setError(`Please answer for: ${missing.map(t => t.name).join(', ')}`); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/tools-survey', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'submit', token, answers }) });
      const d = await res.json();
      if (!res.ok) { setError(d.error || 'Could not submit.'); if (d.done) setDone(true); return; }
      setDone(true);
    } catch { setError('Could not submit — please try again.'); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#faf8f4', padding: '32px 16px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ background: '#1b2a3d', borderTop: '3px solid #c9a24a', borderRadius: 10, padding: '16px 18px', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: 4, color: '#c9a24a' }}>LITSON PLLC</div>
          <div style={{ fontSize: 19, fontWeight: 700, color: '#fff', marginTop: 8 }}>Tools &amp; Access Survey</div>
        </div>

        {loading ? <p style={{ color: '#8a8474' }}>Loading…</p>
        : error && !row ? <div style={{ background: '#fff', border: '1px solid #e6ddcd', borderRadius: 12, padding: 24, color: '#b0412f' }}>{error}</div>
        : done ? (
          <div style={{ background: '#eef5f1', border: '1px solid #cfe4d8', borderRadius: 12, padding: 22, textAlign: 'center' }}>
            <div style={{ fontWeight: 700, color: '#2f7d5b', fontSize: 16 }}>✓ Thank you!</div>
            <div style={{ color: '#33503f', fontSize: 13, marginTop: 4 }}>Your tools &amp; access have been recorded. You can close this page.</div>
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #e6ddcd', borderRadius: 12, padding: 22 }}>
            <p style={{ marginTop: 0, color: '#555' }}>Hi {String(row?.name || '').split(' ')[0]}, for each tool below, tell us whether you use it, have access but don’t use it, or have no access. If you have access — even if you never use it — please mark that so our records are complete.</p>
            {(row?.tools ?? []).map((t: Tool) => (
              <div key={t.name} style={{ borderTop: '1px solid #eee3d0', padding: '12px 0' }}>
                <div style={{ fontWeight: 600, color: '#1b2a3d', fontSize: 15 }}>{t.name}{t.hint && <span style={{ fontWeight: 400, color: '#8a8474', fontSize: 13 }}> — {t.hint}</span>}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  {OPTS.map(o => {
                    const on = answers[t.name] === o.key;
                    return (
                      <button key={o.key} type="button" onClick={() => setAnswers(a => ({ ...a, [t.name]: o.key }))}
                        style={{ fontSize: 13, fontWeight: 600, padding: '7px 14px', borderRadius: 20, cursor: 'pointer', border: '1px solid ' + (on ? '#1b2a3d' : '#d8cfbe'), background: on ? '#1b2a3d' : '#fff', color: on ? '#fff' : '#555' }}>{o.label}</button>
                    );
                  })}
                </div>
              </div>
            ))}
            {error && <p style={{ color: '#b0412f', fontSize: 13, marginTop: 14 }}>{error}</p>}
            <button onClick={submit} disabled={busy} style={{ marginTop: 16, background: busy ? '#9aa4b0' : '#1b2a3d', color: '#fff', border: 'none', fontWeight: 700, padding: '12px 24px', borderRadius: 8, cursor: busy ? 'default' : 'pointer', fontSize: 15 }}>{busy ? 'Submitting…' : 'Submit tools & access'}</button>
            <p style={{ fontSize: 12, color: '#999', marginTop: 14 }}>Your responses are shared only with Litson PLLC’s HR team.</p>
          </div>
        )}
      </div>
    </div>
  );
}

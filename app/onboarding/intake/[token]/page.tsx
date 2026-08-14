'use client';
import { useEffect, useRef, useState } from 'react';

interface Field { id: string; label: string; type: string; required?: boolean; options?: string[]; hint?: string }
const MAX_FILE = 6 * 1024 * 1024;
const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.heic';

function fileToDataUrl(f: File): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f); });
}

export default function IntakePage({ params }: { params: { token: string } }) {
  const { token } = params;
  const [row, setRow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [files, setFiles] = useState<{ name: string; data: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/onboarding/intake?token=${encodeURIComponent(token)}`).then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else { setRow(d.row); if (d.row?.status === 'Completed') setDone(true); if (d.row?.name && !answers.full_legal_name) setAnswers(a => ({ ...a, full_legal_name: d.row.name })); } })
      .catch(() => setError('Could not load this form.')).finally(() => setLoading(false));
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onPick(list: FileList | null) {
    if (!list) return;
    const next: { name: string; data: string }[] = [];
    for (const f of Array.from(list)) {
      if (f.size > MAX_FILE) { setError(`"${f.name}" is larger than 6 MB — please compress or split it.`); continue; }
      next.push({ name: f.name, data: await fileToDataUrl(f) });
    }
    setFiles(prev => [...prev, ...next]);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function submit() {
    setError('');
    const missing = (row?.fields ?? []).filter((f: Field) => f.required && !String(answers[f.id] ?? '').trim());
    if (missing.length) { setError(`Please fill in: ${missing.map((f: Field) => f.label).join(', ')}`); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/onboarding/intake', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'submit', token, answers, files }) });
      const d = await res.json();
      if (!res.ok) { setError(d.error || 'Could not submit.'); if (d.done) setDone(true); return; }
      setDone(true);
    } catch { setError('Could not submit — please try again.'); }
    finally { setBusy(false); }
  }

  const inp: React.CSSProperties = { width: '100%', border: '1px solid #d8cfbe', borderRadius: 8, padding: '10px 12px', fontSize: 15, boxSizing: 'border-box', background: '#fff' };
  const set = (id: string, v: any) => setAnswers(a => ({ ...a, [id]: v }));
  // Repeatable "list" fields (e.g. court admissions).
  const listVals = (id: string): string[] => { const v = answers[id]; return Array.isArray(v) && v.length ? v : ['']; };
  const setListVal = (id: string, i: number, v: string) => setAnswers(a => { const arr = [...listVals(id)]; arr[i] = v; return { ...a, [id]: arr }; });
  const addRow = (id: string) => setAnswers(a => ({ ...a, [id]: [...listVals(id), ''] }));
  const removeRow = (id: string, i: number) => setAnswers(a => { const arr = listVals(id).filter((_, j) => j !== i); return { ...a, [id]: arr.length ? arr : [''] }; });

  return (
    <div style={{ minHeight: '100vh', background: '#faf8f4', padding: '32px 16px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 660, margin: '0 auto' }}>
        <div style={{ background: '#1b2a3d', borderTop: '3px solid #c9a24a', borderRadius: 10, padding: '16px 18px', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: 4, color: '#c9a24a' }}>LITSON PLLC</div>
          <div style={{ fontSize: 19, fontWeight: 700, color: '#fff', marginTop: 8 }}>New Hire Onboarding{row?.roleLabel ? ` — ${row.roleLabel}` : ''}</div>
        </div>

        {loading ? <p style={{ color: '#8a8474' }}>Loading…</p>
        : error && !row ? <div style={{ background: '#fff', border: '1px solid #e6ddcd', borderRadius: 12, padding: 24, color: '#b0412f' }}>{error}</div>
        : done ? (
          <div style={{ background: '#eef5f1', border: '1px solid #cfe4d8', borderRadius: 12, padding: 22, textAlign: 'center' }}>
            <div style={{ fontWeight: 700, color: '#2f7d5b', fontSize: 16 }}>✓ Thank you!</div>
            <div style={{ color: '#33503f', fontSize: 13, marginTop: 4 }}>Your onboarding information has been submitted to our HR team. You can close this page.</div>
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #e6ddcd', borderRadius: 12, padding: 22 }}>
            <p style={{ marginTop: 0, color: '#555' }}>Welcome! Please complete your onboarding details below and upload the requested documents. This goes straight to our HR team — it usually takes about 10 minutes.</p>

            {(row?.fields ?? []).map((f: Field) => (
              <div key={f.id} style={{ marginBottom: 15 }}>
                <label style={{ display: 'block', fontWeight: 600, color: '#1b2a3d', marginBottom: 5, fontSize: 14 }}>{f.label}{f.required && <span style={{ color: '#b0412f' }}> *</span>}</label>
                {f.type === 'list' ? (
                  <div>
                    {listVals(f.id).map((v, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                        <input value={v} onChange={e => setListVal(f.id, i, e.target.value)} placeholder="e.g. U.S. District Court, N.D. Texas" style={inp} />
                        {listVals(f.id).length > 1 && <button type="button" onClick={() => removeRow(f.id, i)} style={{ border: '1px solid #d8cfbe', background: '#fff', borderRadius: 8, padding: '0 12px', color: '#b0412f', cursor: 'pointer', fontSize: 15 }}>✕</button>}
                      </div>
                    ))}
                    <button type="button" onClick={() => addRow(f.id)} style={{ border: '1px dashed #c9b48a', background: '#fbf7ee', borderRadius: 8, padding: '7px 12px', color: '#8a6d3b', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>+ Add another</button>
                  </div>
                ) : f.type === 'longtext' ? <textarea rows={2} value={answers[f.id] ?? ''} onChange={e => set(f.id, e.target.value)} style={{ ...inp, resize: 'vertical' }} />
                : f.type === 'select' ? (
                  <select value={answers[f.id] ?? ''} onChange={e => set(f.id, e.target.value)} style={inp}>
                    <option value="">Select…</option>
                    {(f.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : <input type={f.type === 'date' ? 'date' : f.type === 'email' ? 'email' : f.type === 'tel' ? 'tel' : 'text'} value={answers[f.id] ?? ''} onChange={e => set(f.id, e.target.value)} style={inp} />}
                {f.hint && <div style={{ fontSize: 12, color: '#8a8474', marginTop: 3 }}>{f.hint}</div>}
              </div>
            ))}

            {/* Uploads */}
            <div style={{ marginTop: 18, borderTop: '1px solid #eee3d0', paddingTop: 16 }}>
              <div style={{ fontWeight: 700, color: '#1b2a3d', fontSize: 14 }}>Upload documents</div>
              {(row?.uploads ?? []).length > 0 && (
                <div style={{ fontSize: 13, color: '#8a6d3b', margin: '6px 0 10px' }}>
                  Please attach: {(row.uploads as string[]).join(' · ')}. PDF, Word, Excel or photo files (up to 6 MB each).
                </div>
              )}
              <input ref={fileRef} type="file" accept={ACCEPT} multiple onChange={e => onPick(e.target.files)}
                style={{ display: 'block', fontSize: 14, marginBottom: files.length ? 10 : 0 }} />
              {files.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f7f3ea', border: '1px solid #e6ddcd', borderRadius: 8, padding: '7px 10px', marginBottom: 6, fontSize: 13 }}>
                  <span style={{ flex: 1, color: '#1b2a3d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📄 {f.name}</span>
                  <button type="button" onClick={() => setFiles(p => p.filter((_, j) => j !== i))} style={{ border: 'none', background: 'none', color: '#b0412f', cursor: 'pointer', fontSize: 15 }}>✕</button>
                </div>
              ))}
            </div>

            {error && <p style={{ color: '#b0412f', fontSize: 13, marginTop: 14 }}>{error}</p>}
            <button onClick={submit} disabled={busy} style={{ marginTop: 12, background: busy ? '#9aa4b0' : '#1b2a3d', color: '#fff', border: 'none', fontWeight: 700, padding: '12px 24px', borderRadius: 8, cursor: busy ? 'default' : 'pointer', fontSize: 15 }}>{busy ? 'Submitting…' : 'Submit onboarding information'}</button>
            <p style={{ fontSize: 12, color: '#999', marginTop: 14 }}>Your information is shared only with Litson PLLC's HR team.</p>
          </div>
        )}
      </div>
    </div>
  );
}

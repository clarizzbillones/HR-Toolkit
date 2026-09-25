'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import clsx from 'clsx';
import { useToast } from '@/components/Toast';
import { useAccess } from '@/components/AccessProvider';
import { canEditSection } from '@/lib/access';

interface Doc {
  id: string; name: string; category: string; file_name: string;
  mime: string; size: number; uploaded_by: string | null; created_at: string;
}

const MAX = 15 * 1024 * 1024;

function fmtSize(n: number) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
function fmtDate(s: string) {
  try { return new Date(s).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return ''; }
}
function iconFor(mime: string, fname: string) {
  const f = `${mime} ${fname}`.toLowerCase();
  if (/pdf/.test(f)) return '📕';
  if (/word|\.docx?|officedocument\.word/.test(f)) return '📘';
  if (/sheet|excel|\.xlsx?|\.csv/.test(f)) return '📗';
  if (/presentation|powerpoint|\.pptx?/.test(f)) return '📙';
  if (/image|\.png|\.jpe?g|\.gif|\.webp|\.svg/.test(f)) return '🖼️';
  if (/zip|compress/.test(f)) return '🗜️';
  return '📄';
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export default function DocumentsClient() {
  const { showToast } = useToast();
  const { me } = useAccess();
  const canEdit = canEditSection(me, '/documents');

  const [rows, setRows] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [uploadCat, setUploadCat] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/documents');
      const d = await res.json();
      setRows(d.rows ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const categories = useMemo(() => {
    const s = new Set<string>();
    rows.forEach(r => { if (r.category?.trim()) s.add(r.category.trim()); });
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (catFilter && (r.category ?? '') !== catFilter) return false;
      if (!q) return true;
      return `${r.name} ${r.file_name} ${r.category}`.toLowerCase().includes(q);
    });
  }, [rows, search, catFilter]);

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length) return;
    setBusy(true);
    let ok = 0, fail = 0;
    for (const file of list) {
      if (file.size > MAX) { showToast(`${file.name} is too large (max 15 MB)`); fail++; continue; }
      try {
        const dataUrl = await fileToDataUrl(file);
        const res = await fetch('/api/documents', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: dataUrl, file_name: file.name, name: file.name, category: uploadCat.trim() }),
        });
        if (res.ok) { const { row } = await res.json(); if (row) setRows(rs => [row, ...rs]); ok++; }
        else { fail++; }
      } catch { fail++; }
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = '';
    if (ok) showToast(`${ok} document${ok > 1 ? 's' : ''} uploaded`);
    if (fail && !ok) showToast('Upload failed');
  }

  async function rename(d: Doc) {
    const name = prompt('Rename document', d.name);
    if (name == null || name.trim() === d.name) return;
    setRows(rs => rs.map(r => r.id === d.id ? { ...r, name: name.trim() } : r));
    await fetch('/api/documents', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: d.id, name: name.trim() }) });
  }
  async function recategorize(d: Doc, category: string) {
    setRows(rs => rs.map(r => r.id === d.id ? { ...r, category } : r));
    await fetch('/api/documents', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: d.id, category }) });
  }
  async function remove(d: Doc) {
    if (!confirm(`Delete "${d.name}"? This removes it for everyone.`)) return;
    await fetch(`/api/documents?id=${d.id}`, { method: 'DELETE' });
    setRows(rs => rs.filter(r => r.id !== d.id));
    showToast('Document deleted');
  }

  const totalSize = rows.reduce((a, r) => a + (r.size ?? 0), 0);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-canvas">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="px-8 py-5 bg-white border-b border-border flex items-center justify-between gap-4 flex-shrink-0">
        <div>
          <h1 className="font-spectral text-[23px] font-semibold text-text-primary">📁 Company Documents</h1>
          <p className="text-sm text-text-muted mt-0.5">Shared library of firm documents &amp; resources</p>
        </div>
        {canEdit && (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark shadow-sm disabled:opacity-60"
          >
            {busy ? 'Uploading…' : '+ Upload document'}
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={e => { if (e.target.files) uploadFiles(e.target.files); }}
        />
      </header>

      <div className="flex-1 overflow-auto px-8 py-6">
        {/* ── Toolbar ──────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search documents…"
            className="flex-1 min-w-[220px] border border-border-light rounded-ctrl px-3.5 py-2 text-sm bg-white focus:outline-none focus:border-ink/40 focus:ring-1 focus:ring-ink/20"
          />
          <select
            value={catFilter}
            onChange={e => setCatFilter(e.target.value)}
            className="border border-border-light rounded-ctrl px-3 py-2 text-sm bg-white focus:outline-none focus:border-ink/40"
          >
            <option value="">All categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {canEdit && (
            <input
              value={uploadCat}
              onChange={e => setUploadCat(e.target.value)}
              placeholder="Category for new uploads (optional)"
              title="New uploads will be filed under this category"
              className="min-w-[220px] border border-dashed border-border-light rounded-ctrl px-3 py-2 text-sm bg-canvas focus:outline-none focus:border-ink/40"
            />
          )}
        </div>

        {/* ── Drop zone (edit only) ────────────────────────────── */}
        {canEdit && (
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files) uploadFiles(e.dataTransfer.files); }}
            onClick={() => fileRef.current?.click()}
            className={clsx(
              'mb-6 rounded-card border-2 border-dashed px-6 py-7 text-center cursor-pointer transition-colors',
              dragOver ? 'border-ink bg-ink/5' : 'border-border-light bg-white hover:border-ink/40'
            )}
          >
            <div className="text-2xl mb-1">⬆️</div>
            <div className="text-sm font-semibold text-text-primary">Drag &amp; drop files here, or click to browse</div>
            <div className="text-xs text-text-muted mt-0.5">Up to 15 MB per file. PDF, Word, Excel, images, and more.</div>
          </div>
        )}

        {/* ── List ─────────────────────────────────────────────── */}
        {loading ? (
          <div className="text-sm text-text-muted py-10 text-center">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-text-muted py-10 text-center bg-white border border-border rounded-card">
            {rows.length === 0 ? 'No documents yet.' : 'No documents match your search.'}
          </div>
        ) : (
          <div className="bg-white border border-border rounded-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-separate border-spacing-0" style={{ minWidth: 820 }}>
                <colgroup>
                  <col style={{ width: 'auto' }} />
                  <col style={{ width: 190 }} />
                  <col style={{ width: 110 }} />
                  <col style={{ width: 140 }} />
                  <col style={{ width: 180 }} />
                </colgroup>
                <thead>
                  <tr style={{ background: 'linear-gradient(180deg,#243449 0%,#1b2a3d 100%)' }}>
                    {['Document', 'Category', 'Size', 'Added', ''].map((h, idx) => (
                      <th key={h + idx} className="text-left px-3.5 py-3 text-[10.5px] font-bold uppercase tracking-wider text-[#c9d3e0] whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d, i) => (
                    <tr key={d.id} className={clsx('border-b border-border-light', i % 2 ? 'bg-canvas/40' : 'bg-white', 'hover:bg-ink/[0.03]')}>
                      <td className="px-3.5 py-3 align-top">
                        <div className="flex items-start gap-2.5">
                          <span className="text-lg leading-none mt-0.5">{iconFor(d.mime, d.file_name)}</span>
                          <div className="min-w-0">
                            <a
                              href={`/api/documents?download=${d.id}`}
                              className="font-semibold text-text-primary hover:text-ink hover:underline break-words"
                            >
                              {d.name || d.file_name}
                            </a>
                            {d.file_name && d.file_name !== d.name && (
                              <div className="text-xs text-text-muted break-words">{d.file_name}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3.5 py-3 align-top">
                        {canEdit ? (
                          <input
                            defaultValue={d.category ?? ''}
                            placeholder="—"
                            onBlur={e => { const v = e.target.value.trim(); if (v !== (d.category ?? '')) recategorize(d, v); }}
                            className="w-full bg-transparent text-sm text-text-secondary rounded-md px-2 py-1 border border-transparent hover:border-border-light focus:outline-none focus:bg-white focus:border-ink/40"
                          />
                        ) : (
                          <span className="text-text-secondary">{d.category || '—'}</span>
                        )}
                      </td>
                      <td className="px-3.5 py-3 align-top text-text-muted whitespace-nowrap">{fmtSize(d.size)}</td>
                      <td className="px-3.5 py-3 align-top text-text-muted whitespace-nowrap">{fmtDate(d.created_at)}</td>
                      <td className="px-3.5 py-3 align-top whitespace-nowrap text-right">
                        <a
                          href={`/api/documents?download=${d.id}`}
                          className="inline-block text-xs font-semibold text-ink hover:underline mr-3"
                        >
                          Download
                        </a>
                        {canEdit && (
                          <>
                            <button onClick={() => rename(d)} className="text-xs font-semibold text-text-muted hover:text-text-primary mr-3" title="Rename">Rename</button>
                            <button onClick={() => remove(d)} className="text-xs font-semibold text-litred hover:underline" title="Delete">Delete</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-3.5 py-2.5 text-xs text-text-muted border-t border-border-light bg-canvas/40">
              {rows.length} document{rows.length === 1 ? '' : 's'} · {fmtSize(totalSize)} total
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

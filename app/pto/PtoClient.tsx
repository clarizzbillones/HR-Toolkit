'use client';
import { useState, useRef } from 'react';
import clsx from 'clsx';
import { useToast } from '@/components/Toast';
import EditGate from '@/components/EditGate';

interface PtoEntry {
  id: string; employee: string; start_date: string; end_date: string;
  days: number; type: string; status: string; notes: string;
}

const TYPE_COLORS: Record<string, string> = {
  'Vacation': 'bg-[#e9f0f5] text-[#3f6b8a]',
  'Sick': 'bg-[#fdeaea] text-[#b0412f]',
  'Personal': 'bg-[#f7efe1] text-[#b07d2a]',
  'Bereavement': 'bg-[#ede9f5] text-[#6b5b8a]',
  'Maternity': 'bg-[#eef5f1] text-[#2f7d5b]',
  'Paternity': 'bg-[#eef5f1] text-[#2f7d5b]',
  'FMLA': 'bg-[#f1ece3] text-[#8b8478]',
};
function typeChip(type: string) {
  return TYPE_COLORS[type] ?? 'bg-[#f1ece3] text-[#8b8478]';
}

function mapPtoRows(rows: Record<string, string>[]): Omit<PtoEntry, 'id' | 'status'>[] {
  if (!rows.length) return [];
  const headers = Object.keys(rows[0]);
  const find = (re: RegExp) => headers.find(h => re.test(h)) ?? '';
  const nameCol = find(/employee|name|staff|person/i);
  const startCol = find(/start|from|begin|first/i) || find(/date/i);
  const endCol = find(/end|to|thru|through|last|return/i);
  const typeCol = find(/type|reason|category|leave|kind/i);
  const daysCol = find(/days|amount|qty|total|hours/i);

  return rows.map(r => {
    const startStr = r[startCol] ?? '';
    const endStr = r[endCol] ?? '';
    const startDate = startStr ? new Date(startStr) : null;
    const endDate = endStr ? new Date(endStr) : null;
    let days = daysCol ? Number(r[daysCol]) || 0 : 0;
    if (!days && startDate && endDate) {
      days = Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
    }
    return {
      employee: r[nameCol] ?? '',
      start_date: startDate ? startDate.toISOString().slice(0, 10) : '',
      end_date: endDate ? endDate.toISOString().slice(0, 10) : startDate ? startDate.toISOString().slice(0, 10) : '',
      days,
      type: r[typeCol] ?? 'Vacation',
      notes: '',
    };
  }).filter(r => r.employee && r.start_date);
}

export default function PtoClient({ initialEntries }: { initialEntries: PtoEntry[] }) {
  const { showToast } = useToast();
  const [entries, setEntries] = useState<PtoEntry[]>(initialEntries);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<Omit<PtoEntry, 'id' | 'status'>[] | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const today = new Date().toISOString().slice(0, 10);
  const outToday = entries.filter(e => e.start_date <= today && e.end_date >= today && e.status === 'Approved');

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const { read, utils } = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = read(buf, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });
      const mapped = mapPtoRows(json);
      if (!mapped.length) { showToast('No valid rows found — check column headers'); setUploading(false); return; }
      setPreview(mapped);
    } catch {
      showToast('Failed to parse file');
    }
    setUploading(false);
  }

  async function confirmImport() {
    if (!preview) return;
    setImporting(true);
    const res = await fetch('/api/pto', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entries: preview }) });
    const data = await res.json();
    setEntries(data.entries);
    setPreview(null);
    showToast(`Imported ${preview.length} entries`);
    setImporting(false);
  }

  const conflicts = entries.filter(e =>
    entries.some(o => o.id !== e.id && o.employee === e.employee && o.start_date <= e.end_date && o.end_date >= e.start_date)
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="flex items-center gap-4 px-8 py-5 bg-white border-b border-border flex-shrink-0 flex-wrap">
        <div>
          <h1 className="font-spectral text-[23px] font-semibold text-text-primary">PTO Reports</h1>
          <p className="text-sm text-text-muted mt-0.5">{entries.length} entries · {outToday.length} out today</p>
        </div>
        <div className="ml-auto flex items-center gap-2.5">
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          <EditGate><button onClick={() => fileRef.current?.click()} disabled={uploading} className="bg-white border border-border-light text-ink text-sm font-semibold px-4 py-2.5 rounded-ctrl hover:bg-canvas transition-colors disabled:opacity-50">
            {uploading ? 'Reading…' : '↑ Upload CSV / XLSX'}
          </button></EditGate>
          <a href="https://outlook.office.com/calendar" target="_blank" rel="noreferrer" className="bg-ink text-white text-sm font-semibold px-4 py-2.5 rounded-ctrl hover:bg-ink-dark transition-colors">
            Cross-check in Outlook ↗
          </a>
        </div>
      </header>

      {/* Import preview */}
      {preview && (
        <div className="px-8 py-4 bg-[#f7efe1] border-b border-border flex-shrink-0">
          <div className="flex items-center gap-4 mb-3">
            <span className="text-sm font-semibold text-text-primary">{preview.length} rows parsed — review before importing</span>
            <button onClick={confirmImport} disabled={importing} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark transition-colors disabled:opacity-50">{importing ? 'Importing…' : 'Confirm Import'}</button>
            <button onClick={() => setPreview(null)} className="text-sm text-text-muted hover:text-text-primary">Cancel</button>
          </div>
          <div className="overflow-x-auto max-h-48 border border-border rounded-card bg-white">
            <table className="text-xs w-full">
              <thead className="bg-[#f1ece3] sticky top-0">
                <tr>{['Employee','Start','End','Days','Type'].map(h => <th key={h} className="text-left px-3 py-2 font-semibold text-text-secondary">{h}</th>)}</tr>
              </thead>
              <tbody>
                {preview.slice(0, 20).map((r, i) => (
                  <tr key={i} className="border-t border-[#f1ece3]">
                    <td className="px-3 py-2">{r.employee}</td>
                    <td className="px-3 py-2">{r.start_date}</td>
                    <td className="px-3 py-2">{r.end_date}</td>
                    <td className="px-3 py-2">{r.days}</td>
                    <td className="px-3 py-2"><span className={clsx('px-2 py-0.5 rounded-full font-semibold', typeChip(r.type))}>{r.type}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {conflicts.length > 0 && (
        <div className="px-8 py-3 bg-[#fdeaea] border-b border-[#f5c6c6] flex-shrink-0">
          <span className="text-sm font-semibold text-[#b0412f]">⚠ {conflicts.length} overlapping entries detected</span>
        </div>
      )}

      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="bg-white border border-border rounded-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#f1ece3] border-b border-border">
              <tr>
                {['Employee','Start Date','End Date','Days','PTO Type','Status','Notes'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-text-secondary">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.id} className="border-t border-[#f1ece3] hover:bg-canvas transition-colors">
                  <td className="px-4 py-3 font-medium text-text-primary">{e.employee}</td>
                  <td className="px-4 py-3 text-text-secondary">{e.start_date}</td>
                  <td className="px-4 py-3 text-text-secondary">{e.end_date}</td>
                  <td className="px-4 py-3 text-text-secondary">{e.days}</td>
                  <td className="px-4 py-3"><span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full', typeChip(e.type))}>{e.type}</span></td>
                  <td className="px-4 py-3">
                    <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full',
                      e.status === 'Approved' ? 'bg-[#eef5f1] text-[#2f7d5b]' :
                      e.status === 'Pending' ? 'bg-[#f7efe1] text-[#b07d2a]' :
                      'bg-[#fdeaea] text-[#b0412f]'
                    )}>{e.status}</span>
                  </td>
                  <td className="px-4 py-3 text-text-muted">{e.notes}</td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-text-muted">No PTO entries — upload a CSV or XLSX to get started</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

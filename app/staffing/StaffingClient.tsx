'use client';
import { useState, useRef } from 'react';
import clsx from 'clsx';
import { useToast } from '@/components/Toast';

interface Staff {
  id: string; name: string; position: string | null; dialpad: string | null;
  personal_phone: string | null; email: string | null; start_date: string | null;
  dob: string | null; favorite_color: string | null; favorite_treat: string | null;
  note: string | null; ktn: string | null; marriott: string | null; delta: string | null; weight: string | null;
}
interface Vendor {
  id: string; entity: string | null; name: string | null; phone: string | null;
  email: string | null; website: string | null; notes: string | null;
}

const COLUMNS: { key: keyof Staff; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'position', label: 'Position' },
  { key: 'dialpad', label: 'Dialpad #' },
  { key: 'personal_phone', label: 'Personal Phone' },
  { key: 'email', label: 'Email' },
  { key: 'start_date', label: 'Start Date' },
  { key: 'dob', label: 'DOB' },
  { key: 'favorite_color', label: 'Favorite Color' },
  { key: 'favorite_treat', label: 'Favorite Treat' },
  { key: 'note', label: 'Note' },
  { key: 'ktn', label: 'KTN' },
  { key: 'marriott', label: 'Marriott' },
  { key: 'delta', label: 'Delta' },
  { key: 'weight', label: 'Weight' },
];
const VENDOR_COLUMNS: { key: keyof Vendor; label: string }[] = [
  { key: 'entity', label: 'Facility / Entity' },
  { key: 'name', label: 'Contact Name' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'website', label: 'Website' },
  { key: 'notes', label: 'Notes' },
];

function excelToDate(v: any): string {
  if (typeof v === 'number' && v > 20000 && v < 60000) {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return d.toISOString().slice(0, 10);
  }
  return String(v ?? '').trim();
}

function mapStaff(row: Record<string, any>): Partial<Staff> {
  const headers = Object.keys(row);
  const find = (re: RegExp) => headers.find(h => re.test(h));
  const get = (re: RegExp) => { const h = find(re); return h ? row[h] : ''; };
  const start = get(/start\s*date|employment\s*start/i);
  const dob = get(/dob|birth/i);
  return {
    name: String(get(/^name/i) || get(/name/i) || '').trim(),
    position: String(get(/position|title|role/i) || ''),
    dialpad: String(get(/dialpad/i) || ''),
    personal_phone: String(get(/personal\s*phone|cell|mobile/i) || ''),
    email: String(get(/email/i) || ''),
    start_date: start ? excelToDate(start) : '',
    dob: dob ? excelToDate(dob) : '',
    favorite_color: String(get(/favorite\s*color/i) || ''),
    favorite_treat: String(get(/favorite\s*treat|snack/i) || ''),
    note: String(get(/^note/i) || get(/note/i) || ''),
    ktn: String(get(/ktn|known\s*traveler/i) || ''),
    marriott: String(get(/marriot/i) || ''),
    delta: String(get(/delta/i) || ''),
    weight: String(get(/weight/i) || ''),
  };
}

function mapVendor(row: Record<string, any>): Partial<Vendor> {
  const headers = Object.keys(row);
  const find = (re: RegExp) => headers.find(h => re.test(h));
  const get = (re: RegExp) => { const h = find(re); return String((h ? row[h] : '') ?? '').trim(); };
  return {
    entity: get(/facility|entity|vendor|company|carrier/i),
    name: get(/^name|contact/i),
    phone: get(/phone/i),
    email: get(/email/i),
    website: get(/website|url|site/i),
    notes: get(/note/i),
  };
}

const BLANK: Partial<Staff> = { name: '', position: '', dialpad: '', personal_phone: '', email: '', start_date: '', dob: '', favorite_color: '', favorite_treat: '', note: '', ktn: '', marriott: '', delta: '', weight: '' };
const BLANK_V: Partial<Vendor> = { entity: '', name: '', phone: '', email: '', website: '', notes: '' };

export default function StaffingClient({ initialRows, initialVendors }: { initialRows: Staff[]; initialVendors: Vendor[] }) {
  const { showToast } = useToast();
  const [tab, setTab] = useState<'employees' | 'vendors'>('employees');
  const [rows, setRows] = useState<Staff[]>(initialRows);
  const [vendors, setVendors] = useState<Vendor[]>(initialVendors);
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [edit, setEdit] = useState<Partial<Staff> | null>(null);
  const [editV, setEditV] = useState<Partial<Vendor> | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = rows.filter(r => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (r.name ?? '').toLowerCase().includes(s) || (r.position ?? '').toLowerCase().includes(s) || (r.email ?? '').toLowerCase().includes(s);
  });
  const filteredV = vendors.filter(r => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (r.entity ?? '').toLowerCase().includes(s) || (r.name ?? '').toLowerCase().includes(s) || (r.email ?? '').toLowerCase().includes(s);
  });

  // Upload the admin workbook — populate BOTH the Litson employee directory and the vendor list.
  async function handleFile(file: File) {
    setUploading(true);
    try {
      const { read, utils } = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = read(buf, { type: 'array' });
      const names = wb.SheetNames;

      // Litson employees: prefer an "Employees" sheet; never the vendor or offboarded sheet
      const empSheet = names.find(n => /employ/i.test(n) && !/offboard|vendor/i.test(n))
        ?? names.find(n => /staff|roster|team/i.test(n) && !/vendor/i.test(n));
      // Vendors / contacts
      const venSheet = names.find(n => /vendor|insurance|contact\s*list/i.test(n) && !/employ/i.test(n));

      let empCount = 0, venCount = 0;
      if (empSheet) {
        const json = utils.sheet_to_json<Record<string, any>>(wb.Sheets[empSheet], { defval: '' });
        const mapped = json.map(mapStaff).filter(r => (r.name ?? '').toString().trim());
        if (mapped.length) {
          const res = await fetch('/api/staffing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows: mapped, replace: true }) });
          const data = await res.json(); setRows(data.rows ?? []); empCount = data.inserted ?? mapped.length;
        }
      }
      if (venSheet) {
        const json = utils.sheet_to_json<Record<string, any>>(wb.Sheets[venSheet], { defval: '' });
        const mapped = json.map(mapVendor).filter(r => (r.entity ?? '').toString().trim() || (r.name ?? '').toString().trim());
        if (mapped.length) {
          const res = await fetch('/api/vendors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows: mapped, replace: true }) });
          const data = await res.json(); setVendors(data.rows ?? []); venCount = data.inserted ?? mapped.length;
        }
      }
      if (!empCount && !venCount) showToast('Could not find employee or vendor sheets in this file');
      else showToast(`Imported ${empCount} Litson employees${venSheet ? ` · ${venCount} vendors` : ''}`);
    } catch { showToast('Failed to read file'); }
    setUploading(false);
  }

  async function saveStaff() {
    if (!edit?.name?.trim()) { showToast('Name is required'); return; }
    setSaving(true);
    try {
      if (edit.id) {
        const res = await fetch('/api/staffing', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(edit) });
        const { row } = await res.json(); setRows(prev => prev.map(r => r.id === row.id ? row : r));
      } else {
        const res = await fetch('/api/staffing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(edit) });
        const { rows: all } = await res.json(); setRows(all);
      }
      setEdit(null); showToast('Saved');
    } finally { setSaving(false); }
  }
  async function saveVendor() {
    if (!editV?.entity?.trim() && !editV?.name?.trim()) { showToast('Entity or contact name required'); return; }
    setSaving(true);
    try {
      if (editV.id) {
        const res = await fetch('/api/vendors', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editV) });
        const { row } = await res.json(); setVendors(prev => prev.map(r => r.id === row.id ? row : r));
      } else {
        const res = await fetch('/api/vendors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editV) });
        const { rows: all } = await res.json(); setVendors(all);
      }
      setEditV(null); showToast('Saved');
    } finally { setSaving(false); }
  }

  async function delStaff(id: string) {
    if (!confirm('Remove this person from the directory?')) return;
    await fetch('/api/staffing', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    setRows(prev => prev.filter(r => r.id !== id)); showToast('Removed');
  }
  async function delVendor(id: string) {
    if (!confirm('Remove this vendor/contact?')) return;
    await fetch('/api/vendors', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    setVendors(prev => prev.filter(r => r.id !== id)); showToast('Removed');
  }

  function exportCsv() {
    if (tab === 'employees') {
      const header = COLUMNS.map(c => c.label);
      const body = filtered.map(r => COLUMNS.map(c => `"${String(r[c.key] ?? '').replace(/"/g, '""')}"`).join(','));
      dl('staff-directory.csv', [header.join(','), ...body].join('\n'));
      showToast(`Exported ${filtered.length} staff`);
    } else {
      const header = VENDOR_COLUMNS.map(c => c.label);
      const body = filteredV.map(r => VENDOR_COLUMNS.map(c => `"${String(r[c.key] ?? '').replace(/"/g, '""')}"`).join(','));
      dl('vendor-contacts.csv', [header.join(','), ...body].join('\n'));
      showToast(`Exported ${filteredV.length} vendors`);
    }
  }
  function dl(name: string, csv: string) {
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="flex items-center gap-4 px-8 py-5 bg-white border-b border-border flex-shrink-0 flex-wrap">
        <div>
          <h1 className="font-spectral text-[23px] font-semibold text-text-primary">Staffing &amp; Contacts</h1>
          <p className="text-sm text-text-muted mt-0.5">{rows.length} Litson employees · {vendors.length} vendors &amp; contacts</p>
        </div>
        <div className="flex gap-1 bg-[#f1ece3] p-1 rounded-ctrl ml-4">
          {(['employees', 'vendors'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={clsx('px-4 py-1.5 rounded text-sm font-medium transition-colors', tab === t ? 'bg-white text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary')}>
              {t === 'employees' ? 'Litson Employees' : 'Vendors & Contacts'}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2.5">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
            className="border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink w-48" />
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={e => { if (e.target.files?.[0]) { handleFile(e.target.files[0]); e.target.value = ''; } }} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="bg-white border border-border-light text-ink text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-canvas disabled:opacity-50">
            {uploading ? 'Reading…' : '↑ Upload XLSX'}
          </button>
          <button onClick={exportCsv} className="bg-white border border-border-light text-ink text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-canvas">↓ Export</button>
          {tab === 'employees'
            ? <button onClick={() => setEdit({ ...BLANK })} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark">+ Add</button>
            : <button onClick={() => setEditV({ ...BLANK_V })} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark">+ Add</button>}
        </div>
      </header>

      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="bg-white border border-border rounded-card overflow-hidden">
          <div className="overflow-x-auto">
            {tab === 'employees' ? (
              <table className="w-full text-sm whitespace-nowrap">
                <thead className="bg-[#f1ece3]"><tr>
                  {COLUMNS.map(c => <th key={c.key} className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-text-secondary">{c.label}</th>)}
                  <th className="px-4 py-2.5" />
                </tr></thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id} className="border-t border-[#f1ece3] hover:bg-canvas">
                      {COLUMNS.map(c => (
                        <td key={c.key} className={`px-4 py-3 ${c.key === 'name' ? 'font-medium text-text-primary' : 'text-text-muted'}`}>
                          {c.key === 'email' && r.email ? <a href={`mailto:${r.email}`} className="text-[#3f6b8a] hover:underline">{r.email}</a> : (r[c.key] ?? '—') || '—'}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button onClick={() => setEdit(r)} className="text-xs font-semibold text-ink border border-border-light px-2.5 py-1 rounded-ctrl hover:bg-canvas">Edit</button>
                        <button onClick={() => delStaff(r.id)} className="ml-1.5 text-xs font-semibold text-litred-alt border border-border-light px-2.5 py-1 rounded-ctrl hover:bg-[#fdeaea]">Delete</button>
                      </td>
                    </tr>
                  ))}
                  {!filtered.length && <tr><td colSpan={COLUMNS.length + 1} className="px-4 py-10 text-center text-text-muted">
                    {rows.length ? 'No matches' : 'No employees yet — upload your admin XLSX.'}
                  </td></tr>}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-[#f1ece3]"><tr>
                  {VENDOR_COLUMNS.map(c => <th key={c.key} className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-text-secondary">{c.label}</th>)}
                  <th className="px-4 py-2.5" />
                </tr></thead>
                <tbody>
                  {filteredV.map(r => (
                    <tr key={r.id} className="border-t border-[#f1ece3] hover:bg-canvas">
                      <td className="px-4 py-3 font-medium text-text-primary">{r.entity ?? '—'}</td>
                      <td className="px-4 py-3 text-text-muted">{r.name ?? '—'}</td>
                      <td className="px-4 py-3 text-text-muted">{r.phone ?? '—'}</td>
                      <td className="px-4 py-3">{r.email ? <a href={`mailto:${r.email}`} className="text-[#3f6b8a] hover:underline">{r.email}</a> : '—'}</td>
                      <td className="px-4 py-3">{r.website ? <a href={/^https?:/.test(r.website) ? r.website : `https://${r.website}`} target="_blank" rel="noopener noreferrer" className="text-[#3f6b8a] hover:underline">{r.website}</a> : '—'}</td>
                      <td className="px-4 py-3 text-text-muted max-w-[240px] truncate">{r.notes ?? '—'}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button onClick={() => setEditV(r)} className="text-xs font-semibold text-ink border border-border-light px-2.5 py-1 rounded-ctrl hover:bg-canvas">Edit</button>
                        <button onClick={() => delVendor(r.id)} className="ml-1.5 text-xs font-semibold text-litred-alt border border-border-light px-2.5 py-1 rounded-ctrl hover:bg-[#fdeaea]">Delete</button>
                      </td>
                    </tr>
                  ))}
                  {!filteredV.length && <tr><td colSpan={VENDOR_COLUMNS.length + 1} className="px-4 py-10 text-center text-text-muted">
                    {vendors.length ? 'No matches' : 'No vendors yet — upload your admin XLSX (VendorInsurance sheet).'}
                  </td></tr>}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Employee modal */}
      {edit && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6" onClick={() => setEdit(null)}>
          <div className="bg-white rounded-card w-full max-w-2xl max-h-[88vh] flex flex-col shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="font-spectral text-[18px] font-semibold text-text-primary">{edit.id ? 'Edit Employee' : 'Add Employee'}</h2>
              <button onClick={() => setEdit(null)} className="text-text-muted hover:text-text-primary text-xl leading-none">×</button>
            </div>
            <div className="overflow-auto p-6 grid grid-cols-2 gap-4">
              {COLUMNS.map(c => (
                <div key={c.key} className={c.key === 'note' ? 'col-span-2' : ''}>
                  <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1">{c.label}</label>
                  <input value={(edit[c.key] as string) ?? ''} onChange={e => setEdit(p => ({ ...p, [c.key]: e.target.value }))}
                    type={c.key === 'start_date' || c.key === 'dob' ? 'date' : 'text'}
                    className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-border flex gap-2 justify-end">
              <button onClick={() => setEdit(null)} className="border border-border-light text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-canvas">Cancel</button>
              <button onClick={saveStaff} disabled={saving} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark disabled:opacity-40">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Vendor modal */}
      {editV && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6" onClick={() => setEditV(null)}>
          <div className="bg-white rounded-card w-full max-w-lg shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="font-spectral text-[18px] font-semibold text-text-primary">{editV.id ? 'Edit Vendor / Contact' : 'Add Vendor / Contact'}</h2>
              <button onClick={() => setEditV(null)} className="text-text-muted hover:text-text-primary text-xl leading-none">×</button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              {VENDOR_COLUMNS.map(c => (
                <div key={c.key} className={c.key === 'notes' || c.key === 'entity' ? 'col-span-2' : ''}>
                  <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1">{c.label}</label>
                  <input value={(editV[c.key] as string) ?? ''} onChange={e => setEditV(p => ({ ...p, [c.key]: e.target.value }))}
                    className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-border flex gap-2 justify-end">
              <button onClick={() => setEditV(null)} className="border border-border-light text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-canvas">Cancel</button>
              <button onClick={saveVendor} disabled={saving} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark disabled:opacity-40">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

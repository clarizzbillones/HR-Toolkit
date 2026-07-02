'use client';
import { useState, useRef } from 'react';
import clsx from 'clsx';
import { useToast } from '@/components/Toast';
import { useUndo } from '@/components/UndoProvider';

interface Staff {
  id: string; name: string; position: string | null; dialpad: string | null;
  personal_phone: string | null; email: string | null; start_date: string | null;
  dob: string | null; favorite_color: string | null; favorite_treat: string | null;
  note: string | null; ktn: string | null; marriott: string | null; delta: string | null;
  southwest?: string | null; weight?: string | null; offboarded?: string | null;
}
interface Vendor {
  id: string; entity: string | null; name: string | null; phone: string | null;
  email: string | null; website: string | null; notes: string | null;
}

const EMP_COLUMNS: { key: keyof Staff; label: string }[] = [
  { key: 'name', label: 'Name' }, { key: 'position', label: 'Position' },
  { key: 'dialpad', label: 'Dialpad Number' }, { key: 'personal_phone', label: 'Personal Phone Number' },
  { key: 'email', label: 'Email' }, { key: 'start_date', label: 'Employment Start Date' },
  { key: 'dob', label: 'DOB' }, { key: 'favorite_color', label: 'Favorite Color' },
  { key: 'favorite_treat', label: 'Favorite Treat' }, { key: 'note', label: 'Note' },
  { key: 'ktn', label: 'KTN' }, { key: 'marriott', label: 'Marriott' },
  { key: 'delta', label: 'Delta' }, { key: 'southwest', label: 'Southwest' }, { key: 'weight', label: 'Weight' },
];
const OFF_COLUMNS: { key: keyof Staff; label: string }[] = [
  { key: 'name', label: 'Name' }, { key: 'position', label: 'Position' },
  { key: 'dialpad', label: 'Dialpad Number' }, { key: 'personal_phone', label: 'Personal Phone Number' },
  { key: 'email', label: 'Email' }, { key: 'start_date', label: 'Employment Start Date' },
  { key: 'dob', label: 'DOB' }, { key: 'favorite_color', label: 'Favorite Color' },
  { key: 'favorite_treat', label: 'Favorite Treat' }, { key: 'note', label: 'Note' },
  { key: 'ktn', label: 'KTN' }, { key: 'marriott', label: 'Marriott' },
  { key: 'delta', label: 'Delta' }, { key: 'southwest', label: 'Southwest' }, { key: 'offboarded', label: 'Offboarded' },
];
const VENDOR_COLUMNS: { key: keyof Vendor; label: string }[] = [
  { key: 'entity', label: 'Facility/Entity' }, { key: 'name', label: 'Name' },
  { key: 'phone', label: 'Phone Number' }, { key: 'email', label: 'Email' },
  { key: 'website', label: 'Website' }, { key: 'notes', label: 'Notes' },
];

type TabKey = 'employees' | 'vendors' | 'offboarded';
const TABS: { key: TabKey; label: string; accent: string; soft: string; text: string }[] = [
  { key: 'employees',  label: 'Litson Employees',    accent: '#2f7d5b', soft: '#eef5f1', text: '#2f7d5b' },
  { key: 'vendors',    label: 'Vendors & Insurance', accent: '#3f6b8a', soft: '#e9f0f5', text: '#3f6b8a' },
  { key: 'offboarded', label: 'Offboarded',          accent: '#b0412f', soft: '#fdeaea', text: '#b0412f' },
];

function excelToDate(v: any): string {
  if (typeof v === 'number' && v > 20000 && v < 60000) {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return d.toISOString().slice(0, 10);
  }
  return String(v ?? '').trim();
}

// Normalize any date value (excel serial, ISO, m/d/yy) to MM/DD/YYYY
function toMMDDYYYY(v: any): string {
  if (v == null || v === '') return '';
  let y: number, m: number, d: number;
  if (typeof v === 'number' && v > 20000 && v < 60000) {
    const dt = new Date(Math.round((v - 25569) * 86400 * 1000));
    y = dt.getUTCFullYear(); m = dt.getUTCMonth() + 1; d = dt.getUTCDate();
  } else {
    const s = String(v).trim();
    let mo = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);            // ISO
    if (mo) { y = +mo[1]; m = +mo[2]; d = +mo[3]; }
    else {
      mo = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);    // m/d/y
      if (mo) { m = +mo[1]; d = +mo[2]; y = +mo[3]; if (y < 100) y += 1900 + (y < 30 ? 100 : 0); }
      else return s;
    }
  }
  return `${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}/${y}`;
}

function mapStaff(row: Record<string, any>, offboarded = false): Partial<Staff> {
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
    dob: dob ? toMMDDYYYY(dob) : '',
    favorite_color: String(get(/favorite\s*color/i) || ''),
    favorite_treat: String(get(/favorite\s*treat|snack/i) || ''),
    note: String(get(/^note/i) || get(/note/i) || ''),
    ktn: String(get(/ktn|known\s*traveler/i) || ''),
    marriott: String(get(/marriot/i) || ''),
    delta: String(get(/delta/i) || ''),
    southwest: String(get(/southwest|rapid\s*rewards/i) || ''),
    ...(offboarded
      ? { offboarded: (() => { const v = get(/offboard|term|end\s*date/i); return v ? excelToDate(v) : ''; })() }
      : { weight: String(get(/weight/i) || '') }),
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

export default function StaffingClient({ initialRows, initialVendors, initialOffboarded }: { initialRows: Staff[]; initialVendors: Vendor[]; initialOffboarded: Staff[] }) {
  const { showToast } = useToast();
  const { pushUndo } = useUndo();
  const [tab, setTab] = useState<TabKey>('employees');
  const [rows, setRows] = useState<Staff[]>(initialRows);
  const [vendors, setVendors] = useState<Vendor[]>(initialVendors);
  const [offboarded, setOffboarded] = useState<Staff[]>(initialOffboarded);
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [editStaff, setEditStaff] = useState<{ data: Partial<Staff>; kind: 'employees' | 'offboarded' } | null>(null);
  const [editV, setEditV] = useState<Partial<Vendor> | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const active = TABS.find(t => t.key === tab)!;
  const s = search.toLowerCase();
  const fStaff = rows.filter(r => !search || (r.name ?? '').toLowerCase().includes(s) || (r.position ?? '').toLowerCase().includes(s) || (r.email ?? '').toLowerCase().includes(s));
  const fOff = offboarded.filter(r => !search || (r.name ?? '').toLowerCase().includes(s) || (r.position ?? '').toLowerCase().includes(s) || (r.email ?? '').toLowerCase().includes(s));
  const fVen = vendors.filter(r => !search || (r.entity ?? '').toLowerCase().includes(s) || (r.name ?? '').toLowerCase().includes(s) || (r.email ?? '').toLowerCase().includes(s));

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const { read, utils } = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = read(buf, { type: 'array' });
      const names = wb.SheetNames;
      const empSheet = names.find(n => /employ/i.test(n) && !/offboard|vendor/i.test(n));
      const offSheet = names.find(n => /offboard|terminat/i.test(n));
      const venSheet = names.find(n => /vendor|insurance|contact\s*list/i.test(n) && !/employ/i.test(n));

      let e = 0, o = 0, v = 0;
      if (empSheet) {
        const json = utils.sheet_to_json<Record<string, any>>(wb.Sheets[empSheet], { defval: '' });
        const mapped = json.map(r => mapStaff(r, false)).filter(r => r.name);
        if (mapped.length) { const res = await fetch('/api/staffing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows: mapped, replace: true }) }); const d = await res.json(); setRows(d.rows ?? []); e = d.inserted ?? 0; }
      }
      if (offSheet) {
        const json = utils.sheet_to_json<Record<string, any>>(wb.Sheets[offSheet], { defval: '' });
        const mapped = json.map(r => mapStaff(r, true)).filter(r => r.name);
        if (mapped.length) { const res = await fetch('/api/offboarded', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows: mapped, replace: true }) }); const d = await res.json(); setOffboarded(d.rows ?? []); o = d.inserted ?? 0; }
      }
      if (venSheet) {
        const json = utils.sheet_to_json<Record<string, any>>(wb.Sheets[venSheet], { defval: '' });
        const mapped = json.map(mapVendor).filter(r => (r.entity ?? '').toString().trim() || (r.name ?? '').toString().trim());
        if (mapped.length) { const res = await fetch('/api/vendors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows: mapped, replace: true }) }); const d = await res.json(); setVendors(d.rows ?? []); v = d.inserted ?? 0; }
      }
      if (!e && !o && !v) showToast('No matching sheets found');
      else showToast(`Imported — ${e} employees · ${o} offboarded · ${v} vendors`);
    } catch { showToast('Failed to read file'); }
    setUploading(false);
  }

  async function saveStaff() {
    const st = editStaff; if (!st?.data.name?.trim()) { showToast('Name is required'); return; }
    const url = st.kind === 'offboarded' ? '/api/offboarded' : '/api/staffing';
    const setter = st.kind === 'offboarded' ? setOffboarded : setRows;
    setSaving(true);
    try {
      if (st.data.id) {
        const res = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(st.data) });
        const { row } = await res.json(); setter(prev => prev.map(r => r.id === row.id ? row : r));
      } else {
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(st.data) });
        const { rows: all } = await res.json(); setter(all);
      }
      setEditStaff(null); showToast('Saved');
    } finally { setSaving(false); }
  }
  async function saveVendor() {
    if (!editV?.entity?.trim() && !editV?.name?.trim()) { showToast('Entity or contact name required'); return; }
    setSaving(true);
    try {
      if (editV.id) { const res = await fetch('/api/vendors', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editV) }); const { row } = await res.json(); setVendors(prev => prev.map(r => r.id === row.id ? row : r)); }
      else { const res = await fetch('/api/vendors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editV) }); const { rows: all } = await res.json(); setVendors(all); }
      setEditV(null); showToast('Saved');
    } finally { setSaving(false); }
  }
  async function delStaff(kind: 'employees' | 'offboarded', id: string) {
    const url = kind === 'offboarded' ? '/api/offboarded' : '/api/staffing';
    const row = (kind === 'offboarded' ? offboarded : rows).find(r => r.id === id);
    await fetch(url, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    (kind === 'offboarded' ? setOffboarded : setRows)(prev => prev.filter(r => r.id !== id));
    if (row) { const { id: _drop, ...data } = row as any; pushUndo({ label: `Delete ${row.name}`, req: { url, method: 'POST', body: data } }); }
    showToast('Removed — Ctrl+Z to undo');
  }
  async function delVendor(id: string) {
    const row = vendors.find(r => r.id === id);
    await fetch('/api/vendors', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    setVendors(prev => prev.filter(r => r.id !== id));
    if (row) { const { id: _drop, ...data } = row as any; pushUndo({ label: `Delete ${row.entity ?? row.name}`, req: { url: '/api/vendors', method: 'POST', body: data } }); }
    showToast('Removed — Ctrl+Z to undo');
  }

  function dl(name: string, csv: string) { const b = new Blob([csv], { type: 'text/csv' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; a.click(); }
  function exportCsv() {
    if (tab === 'vendors') {
      const body = fVen.map(r => VENDOR_COLUMNS.map(c => `"${String(r[c.key] ?? '').replace(/"/g, '""')}"`).join(','));
      dl('vendors.csv', [VENDOR_COLUMNS.map(c => c.label).join(','), ...body].join('\n'));
    } else {
      const cols = tab === 'offboarded' ? OFF_COLUMNS : EMP_COLUMNS;
      const data = tab === 'offboarded' ? fOff : fStaff;
      const body = data.map(r => cols.map(c => `"${String(r[c.key] ?? '').replace(/"/g, '""')}"`).join(','));
      dl(`${tab}.csv`, [cols.map(c => c.label).join(','), ...body].join('\n'));
    }
    showToast('Exported');
  }

  const BLANK_STAFF: Partial<Staff> = Object.fromEntries(EMP_COLUMNS.map(c => [c.key, ''])) as any;
  const BLANK_OFF: Partial<Staff> = Object.fromEntries(OFF_COLUMNS.map(c => [c.key, ''])) as any;
  const BLANK_V: Partial<Vendor> = { entity: '', name: '', phone: '', email: '', website: '', notes: '' };

  function StaffTable({ cols, data, kind }: { cols: { key: keyof Staff; label: string }[]; data: Staff[]; kind: 'employees' | 'offboarded' }) {
    return (
      <table className="w-full text-sm whitespace-nowrap">
        <thead style={{ background: active.soft }}><tr>
          {cols.map(c => <th key={c.key}
            className={`text-left px-4 py-3 text-xs font-bold uppercase tracking-wider ${c.key === 'name' ? 'sticky left-0 z-20' : ''}`}
            style={{ color: active.text, ...(c.key === 'name' ? { background: active.soft, boxShadow: '2px 0 0 #e6e0d5' } : {}) }}>{c.label}</th>)}
          <th className="px-4 py-3" />
        </tr></thead>
        <tbody>
          {data.map(r => (
            <tr key={r.id} className="border-t border-[#f1ece3] hover:bg-canvas group">
              {cols.map(c => (
                <td key={c.key}
                  className={`px-4 py-3 ${c.key === 'name' ? 'font-medium text-text-primary sticky left-0 z-10 bg-white group-hover:bg-canvas' : 'text-text-muted'}`}
                  style={c.key === 'name' ? { boxShadow: '2px 0 0 #f1ece3' } : undefined}>
                  {c.key === 'email' && r.email ? <a href={`mailto:${r.email}`} className="text-[#3f6b8a] hover:underline">{r.email}</a>
                    : c.key === 'dob' ? (toMMDDYYYY(r.dob) || '—')
                    : (r[c.key] ?? '—') || '—'}
                </td>
              ))}
              <td className="px-4 py-3 text-right whitespace-nowrap">
                <button onClick={() => setEditStaff({ data: r, kind })} className="text-xs font-semibold text-ink border border-border-light px-2.5 py-1 rounded-ctrl hover:bg-canvas">Edit</button>
                <button onClick={() => delStaff(kind, r.id)} className="ml-1.5 text-xs font-semibold text-litred-alt border border-border-light px-2.5 py-1 rounded-ctrl hover:bg-[#fdeaea]">Delete</button>
              </td>
            </tr>
          ))}
          {!data.length && <tr><td colSpan={cols.length + 1} className="px-4 py-10 text-center text-text-muted">No records yet — upload your admin XLSX.</td></tr>}
        </tbody>
      </table>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="px-8 py-5 bg-white border-b border-border flex-shrink-0">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="w-3 h-8 rounded-full" style={{ background: active.accent }} />
            <div>
              <h1 className="font-spectral text-[23px] font-semibold text-text-primary">Staffing &amp; Contacts</h1>
              <p className="text-sm text-text-muted mt-0.5">{rows.length} employees · {vendors.length} vendors · {offboarded.length} offboarded</p>
            </div>
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
            <button onClick={() => { if (tab === 'vendors') setEditV({ ...BLANK_V }); else setEditStaff({ data: { ...(tab === 'offboarded' ? BLANK_OFF : BLANK_STAFF) }, kind: tab }); }}
              className="text-white text-sm font-semibold px-4 py-2 rounded-ctrl" style={{ background: active.accent }}>+ Add</button>
          </div>
        </div>

        {/* Color-coded tabs */}
        <div className="flex gap-2 mt-4">
          {TABS.map(t => {
            const on = tab === t.key;
            const count = t.key === 'employees' ? rows.length : t.key === 'vendors' ? vendors.length : offboarded.length;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={clsx('flex items-center gap-2 px-4 py-2 rounded-ctrl text-sm font-semibold transition-all border')}
                style={on
                  ? { background: t.accent, color: '#fff', borderColor: t.accent }
                  : { background: t.soft, color: t.text, borderColor: 'transparent' }}>
                {t.label}
                <span className="text-xs px-1.5 py-0.5 rounded-full" style={on ? { background: 'rgba(255,255,255,0.25)' } : { background: '#fff', color: t.text }}>{count}</span>
              </button>
            );
          })}
        </div>
      </header>

      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="bg-white border rounded-card overflow-hidden" style={{ borderColor: active.soft, borderTop: `3px solid ${active.accent}` }}>
          <div className="overflow-x-auto">
            {tab === 'employees' && <StaffTable cols={EMP_COLUMNS} data={fStaff} kind="employees" />}
            {tab === 'offboarded' && <StaffTable cols={OFF_COLUMNS} data={fOff} kind="offboarded" />}
            {tab === 'vendors' && (
              <table className="w-full text-sm">
                <thead style={{ background: active.soft }}><tr>
                  {VENDOR_COLUMNS.map(c => <th key={c.key} className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider" style={{ color: active.text }}>{c.label}</th>)}
                  <th className="px-4 py-3" />
                </tr></thead>
                <tbody>
                  {fVen.map(r => (
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
                  {!fVen.length && <tr><td colSpan={VENDOR_COLUMNS.length + 1} className="px-4 py-10 text-center text-text-muted">No vendors yet — upload your admin XLSX.</td></tr>}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Staff modal */}
      {editStaff && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6" onClick={() => setEditStaff(null)}>
          <div className="bg-white rounded-card w-full max-w-2xl max-h-[88vh] flex flex-col shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: active.soft, borderBottom: `2px solid ${active.accent}` }}>
              <h2 className="font-spectral text-[18px] font-semibold text-text-primary">{editStaff.data.id ? 'Edit' : 'Add'} {editStaff.kind === 'offboarded' ? 'Offboarded' : 'Employee'}</h2>
              <button onClick={() => setEditStaff(null)} className="text-text-muted hover:text-text-primary text-xl leading-none">×</button>
            </div>
            <div className="overflow-auto p-6 grid grid-cols-2 gap-4">
              {(editStaff.kind === 'offboarded' ? OFF_COLUMNS : EMP_COLUMNS).map(c => (
                <div key={c.key} className={c.key === 'note' ? 'col-span-2' : ''}>
                  <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1">{c.label}</label>
                  <input value={(editStaff.data[c.key] as string) ?? ''} onChange={e => setEditStaff(p => p && ({ ...p, data: { ...p.data, [c.key]: e.target.value } }))}
                    type={c.key === 'start_date' || c.key === 'offboarded' ? 'date' : 'text'}
                    placeholder={c.key === 'dob' ? 'MM/DD/YYYY' : undefined}
                    onBlur={c.key === 'dob' ? (e => setEditStaff(p => p && ({ ...p, data: { ...p.data, dob: toMMDDYYYY(e.target.value) } }))) : undefined}
                    className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-border flex gap-2 justify-end">
              <button onClick={() => setEditStaff(null)} className="border border-border-light text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-canvas">Cancel</button>
              <button onClick={saveStaff} disabled={saving} className="text-white text-sm font-semibold px-4 py-2 rounded-ctrl disabled:opacity-40" style={{ background: active.accent }}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Vendor modal */}
      {editV && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6" onClick={() => setEditV(null)}>
          <div className="bg-white rounded-card w-full max-w-lg shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderBottom: '2px solid #3f6b8a' }}>
              <h2 className="font-spectral text-[18px] font-semibold text-text-primary">{editV.id ? 'Edit' : 'Add'} Vendor / Contact</h2>
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
              <button onClick={saveVendor} disabled={saving} className="text-white text-sm font-semibold px-4 py-2 rounded-ctrl disabled:opacity-40" style={{ background: '#3f6b8a' }}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

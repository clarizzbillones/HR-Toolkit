'use client';
import { useState } from 'react';
import { useToast } from '@/components/Toast';
import { useAccess } from '@/components/AccessProvider';

interface Profile {
  id: string; name: string; photo: string | null; position: string | null; department: string | null;
  email: string | null; phone: string | null; start_date: string | null; details: string | null; doc_count?: number;
}
interface Doc {
  id: string; profile_id: string; category: string; title: string; doc_date: string | null;
  summary: string; what_we_did: string; next_steps: string; author: string; has_attachment?: boolean; attachment_name?: string | null;
}

const CATEGORIES = ['Performance Review', 'Coaching', 'Remark / Timeline', 'Other'];
const CAT_COLOR: Record<string, string> = {
  'Performance Review': 'bg-[#eef2f7] text-[#3f5a76]', 'Coaching': 'bg-[#eef5f1] text-[#2f7d5b]',
  'Remark / Timeline': 'bg-[#fdeaea] text-[#b0412f]', 'Other': 'bg-[#f1ece3] text-[#8b8478]',
};
const MAX_PHOTO = 2 * 1024 * 1024;
const MAX_FILE = 3.5 * 1024 * 1024;
function fileToDataUrl(f: File): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f); });
}
function initials(name: string) { return (name || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase(); }
function fmtDate(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(String(iso).slice(0, 10) + 'T12:00:00');
  return isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
const EMPTY_P = { name: '', position: '', department: '', email: '', phone: '', start_date: '', details: '', photo: '' };
const EMPTY_D = { category: 'Remark / Timeline', title: '', doc_date: '', summary: '', what_we_did: '', next_steps: '', author: '' };

export default function EmployeeFilesClient({ initialProfiles }: { initialProfiles: Profile[] }) {
  const { showToast } = useToast();
  const { me } = useAccess(); const readOnly = !!me?.restricted;
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Profile | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [showAddEmp, setShowAddEmp] = useState(false);
  const [empForm, setEmpForm] = useState({ ...EMPTY_P });
  const [editingProfile, setEditingProfile] = useState(false);
  const [docForm, setDocForm] = useState({ ...EMPTY_D });
  const [docFile, setDocFile] = useState<File | null>(null);
  const [showDocForm, setShowDocForm] = useState(false);
  const [editDocId, setEditDocId] = useState<string | null>(null);

  const input = 'w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink';
  const s = search.toLowerCase();
  const filtered = profiles.filter(p => !s || (p.name ?? '').toLowerCase().includes(s) || (p.position ?? '').toLowerCase().includes(s));

  async function openProfile(p: Profile) {
    setSelected(p); setEditingProfile(false); setShowDocForm(false); setEditDocId(null);
    const d = await fetch(`/api/employee-files?id=${p.id}`).then(r => r.json());
    if (d.profile) setSelected(d.profile);
    setDocs(d.docs ?? []);
  }

  async function addEmployee() {
    if (!empForm.name.trim()) { showToast('Name required'); return; }
    const res = await fetch('/api/employee-files', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(empForm) });
    const { profile } = await res.json();
    setProfiles(p => [...p, { ...profile, doc_count: 0 }].sort((a, b) => a.name.localeCompare(b.name)));
    setShowAddEmp(false); setEmpForm({ ...EMPTY_P }); showToast('Employee added');
  }
  async function saveProfile() {
    if (!selected) return;
    const res = await fetch('/api/employee-files', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(selected) });
    const { profile } = await res.json();
    if (profile) { setSelected(profile); setProfiles(p => p.map(x => x.id === profile.id ? { ...profile, doc_count: x.doc_count } : x)); }
    setEditingProfile(false); showToast('Saved');
  }
  async function deleteProfile() {
    if (!selected || !confirm(`Delete ${selected.name} and all their documents?`)) return;
    await fetch(`/api/employee-files?id=${selected.id}`, { method: 'DELETE' });
    setProfiles(p => p.filter(x => x.id !== selected.id));
    setSelected(null); showToast('Deleted');
  }

  async function pickPhoto(f: File, target: 'add' | 'profile') {
    if (f.size > MAX_PHOTO) { showToast('Photo too large (max 2 MB)'); return; }
    const url = await fileToDataUrl(f);
    if (target === 'add') setEmpForm(p => ({ ...p, photo: url }));
    else setSelected(p => p ? { ...p, photo: url } : p);
  }

  function startDoc() { setDocForm({ ...EMPTY_D }); setDocFile(null); setEditDocId(null); setShowDocForm(true); }
  function startEditDoc(d: Doc) {
    setDocForm({ category: d.category, title: d.title ?? '', doc_date: d.doc_date ? String(d.doc_date).slice(0, 10) : '', summary: d.summary ?? '', what_we_did: d.what_we_did ?? '', next_steps: d.next_steps ?? '', author: d.author ?? '' });
    setDocFile(null); setEditDocId(d.id); setShowDocForm(true);
  }
  async function saveDoc() {
    if (!selected) return;
    let attach: any = {};
    if (docFile) { if (docFile.size > MAX_FILE) { showToast('File too large (max ~3.5 MB)'); return; } attach = { attachment_name: docFile.name, attachment_data: await fileToDataUrl(docFile) }; }
    if (editDocId) {
      const res = await fetch('/api/employee-files/doc', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editDocId, ...docForm, ...attach }) });
      const { doc } = await res.json();
      if (doc) setDocs(p => p.map(x => x.id === editDocId ? doc : x));
    } else {
      const res = await fetch('/api/employee-files/doc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile_id: selected.id, ...docForm, ...attach }) });
      const { doc } = await res.json();
      if (doc) { setDocs(p => [doc, ...p]); bumpCount(selected.id, 1); }
    }
    setShowDocForm(false); setEditDocId(null); showToast('Saved');
  }
  async function deleteDoc(d: Doc) {
    if (!confirm('Delete this entry?')) return;
    await fetch(`/api/employee-files/doc?id=${d.id}`, { method: 'DELETE' });
    setDocs(p => p.filter(x => x.id !== d.id));
    if (selected) bumpCount(selected.id, -1);
  }
  function bumpCount(id: string, delta: number) { setProfiles(p => p.map(x => x.id === id ? { ...x, doc_count: (x.doc_count ?? 0) + delta } : x)); }

  async function pullFrom(source: 'staffing' | 'coaching' | 'reviews') {
    if (!selected) return;
    const res = await fetch('/api/employee-files/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profileId: selected.id, source }) });
    const d = await res.json();
    if (!res.ok) { showToast(d.error || 'Import failed'); return; }
    await openProfile(selected);
    showToast(d.message || 'Imported');
  }

  // ---- Detail view ----
  if (selected) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <header className="px-8 py-4 bg-white border-b border-border flex-shrink-0 flex items-center gap-3">
          <button onClick={() => setSelected(null)} className="text-sm font-semibold text-text-secondary hover:text-ink">← All employees</button>
          <span className="text-text-faint">/</span>
          <span className="text-sm font-semibold text-text-primary">{selected.name}</span>
        </header>
        <div className="flex-1 overflow-auto p-8">
          <div className="max-w-3xl space-y-6">
            {/* Profile card */}
            <div className="bg-white border border-border rounded-card p-6">
              <div className="flex items-start gap-5">
                <label className={`shrink-0 ${!readOnly && editingProfile ? 'cursor-pointer' : ''}`}>
                  {selected.photo
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={selected.photo} alt={selected.name} className="w-24 h-24 rounded-full object-cover border border-border-light" />
                    : <div className="w-24 h-24 rounded-full bg-[#1b2a3d] text-[#c9a24a] flex items-center justify-center text-2xl font-bold">{initials(selected.name)}</div>}
                  {!readOnly && editingProfile && <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) pickPhoto(f, 'profile'); }} />}
                  {!readOnly && editingProfile && <div className="text-[11px] text-[#3f6b8a] text-center mt-1">Change photo</div>}
                </label>
                <div className="flex-1 min-w-0">
                  {editingProfile ? (
                    <div className="grid grid-cols-2 gap-3">
                      {([['Name', 'name'], ['Position', 'position'], ['Department', 'department'], ['Email', 'email'], ['Phone', 'phone'], ['Start date', 'start_date']] as [string, keyof Profile][]).map(([l, k]) => (
                        <div key={k} className={k === 'name' ? 'col-span-2' : ''}>
                          <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1">{l}</label>
                          <input type={k === 'start_date' ? 'date' : 'text'} value={(selected[k] as string) ?? ''} onChange={e => setSelected(p => p ? { ...p, [k]: e.target.value } : p)} className={input} />
                        </div>
                      ))}
                      <div className="col-span-2">
                        <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1">Details</label>
                        <textarea value={selected.details ?? ''} onChange={e => setSelected(p => p ? { ...p, details: e.target.value } : p)} rows={3} className={input + ' resize-y'} />
                      </div>
                      <div className="col-span-2 flex gap-2">
                        <button onClick={saveProfile} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark">Save</button>
                        <button onClick={() => openProfile(selected)} className="text-sm text-text-muted px-3">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h1 className="font-spectral text-[24px] font-semibold text-text-primary">{selected.name}</h1>
                      <p className="text-sm text-text-muted">{[selected.position, selected.department].filter(Boolean).join(' · ')}</p>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-3 text-sm">
                        {selected.email && <div><span className="text-text-muted">Email:</span> {selected.email}</div>}
                        {selected.phone && <div><span className="text-text-muted">Phone:</span> {selected.phone}</div>}
                        {selected.start_date && <div><span className="text-text-muted">Start date:</span> {fmtDate(selected.start_date)}</div>}
                      </div>
                      {selected.details && <p className="text-sm text-text-secondary mt-3 whitespace-pre-wrap">{selected.details}</p>}
                      {!readOnly && (
                        <div className="flex gap-2 mt-4">
                          <button onClick={() => setEditingProfile(true)} className="text-xs font-semibold text-ink border border-border-light px-3 py-1.5 rounded-ctrl hover:bg-canvas">Edit profile</button>
                          <button onClick={deleteProfile} className="text-xs font-semibold text-litred-alt border border-border-light px-3 py-1.5 rounded-ctrl hover:bg-[#fdeaea]">Delete</button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Documents */}
            <div>
              <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                <h2 className="text-xs font-bold uppercase tracking-widest text-gold-muted">Documents & timeline</h2>
                {!readOnly && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] text-text-muted">Pull:</span>
                    <button onClick={() => pullFrom('staffing')} className="text-xs font-semibold text-[#3f6b8a] border border-border-light px-2.5 py-1 rounded-ctrl hover:bg-canvas">Staffing details</button>
                    <button onClick={() => pullFrom('coaching')} className="text-xs font-semibold text-[#3f6b8a] border border-border-light px-2.5 py-1 rounded-ctrl hover:bg-canvas">Coaching</button>
                    <button onClick={() => pullFrom('reviews')} className="text-xs font-semibold text-[#3f6b8a] border border-border-light px-2.5 py-1 rounded-ctrl hover:bg-canvas">Reviews</button>
                    <button onClick={startDoc} className="bg-ink text-white text-sm font-semibold px-3 py-1.5 rounded-ctrl hover:bg-ink-dark ml-1">+ Add entry</button>
                  </div>
                )}
              </div>

              {showDocForm && !readOnly && (
                <div className="bg-[#fbf7ee] border border-border rounded-card p-5 mb-4 grid grid-cols-2 gap-4">
                  <div className="col-span-2 text-sm font-semibold text-text-primary -mb-1">{editDocId ? 'Edit entry' : 'New entry'}</div>
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1">Type</label>
                    <select value={docForm.category} onChange={e => setDocForm(p => ({ ...p, category: e.target.value }))} className={input + ' bg-white'}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1">Date</label>
                    <input type="date" value={docForm.doc_date} onChange={e => setDocForm(p => ({ ...p, doc_date: e.target.value }))} className={input} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-text-secondary mb-1">Title</label>
                    <input value={docForm.title} onChange={e => setDocForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. 6-month review summary" className={input} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-text-secondary mb-1">{docForm.category === 'Remark / Timeline' ? 'What happened' : 'Summary'}</label>
                    <textarea value={docForm.summary} onChange={e => setDocForm(p => ({ ...p, summary: e.target.value }))} rows={3} className={input + ' resize-y'} placeholder={docForm.category === 'Remark / Timeline' ? 'Describe the event with dates and specifics…' : 'Summary…'} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1">What we did</label>
                    <textarea value={docForm.what_we_did} onChange={e => setDocForm(p => ({ ...p, what_we_did: e.target.value }))} rows={2} className={input + ' resize-y'} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1">Next steps</label>
                    <textarea value={docForm.next_steps} onChange={e => setDocForm(p => ({ ...p, next_steps: e.target.value }))} rows={2} className={input + ' resize-y'} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1">Logged by</label>
                    <input value={docForm.author} onChange={e => setDocForm(p => ({ ...p, author: e.target.value }))} placeholder="Catie / Clarizz" className={input} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1">Attachment</label>
                    <input type="file" onChange={e => setDocFile(e.target.files?.[0] ?? null)} className="text-xs" />
                  </div>
                  <div className="col-span-2 flex gap-2">
                    <button onClick={saveDoc} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark">{editDocId ? 'Save' : 'Add entry'}</button>
                    <button onClick={() => { setShowDocForm(false); setEditDocId(null); }} className="text-sm text-text-muted px-3">Cancel</button>
                  </div>
                </div>
              )}

              {docs.length === 0 ? (
                <div className="text-sm text-text-muted border border-dashed border-border-light rounded-card p-6 text-center">No documents or remarks yet.</div>
              ) : (
                <div className="space-y-3">
                  {docs.map(d => (
                    <div key={d.id} className="bg-white border border-border rounded-card p-4 shadow-sm">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${CAT_COLOR[d.category] ?? CAT_COLOR.Other}`}>{d.category}</span>
                        {d.doc_date && <span className="text-xs text-text-muted">{fmtDate(d.doc_date)}</span>}
                        {d.title && <span className="text-sm font-semibold text-text-primary">{d.title}</span>}
                        {!readOnly && (
                          <div className="ml-auto flex gap-2">
                            <button onClick={() => startEditDoc(d)} className="text-xs font-semibold text-ink border border-border-light px-2.5 py-1 rounded-ctrl hover:bg-canvas">Edit</button>
                            <button onClick={() => deleteDoc(d)} className="text-xs font-semibold text-litred-alt border border-border-light px-2.5 py-1 rounded-ctrl hover:bg-[#fdeaea]">Delete</button>
                          </div>
                        )}
                      </div>
                      {d.summary && <p className="text-sm text-text-secondary mt-2 whitespace-pre-wrap">{d.summary}</p>}
                      {d.what_we_did && <p className="text-sm mt-2"><span className="font-semibold text-text-primary">What we did:</span> <span className="text-text-secondary">{d.what_we_did}</span></p>}
                      {d.next_steps && <p className="text-sm mt-1"><span className="font-semibold text-text-primary">Next steps:</span> <span className="text-text-secondary">{d.next_steps}</span></p>}
                      <div className="flex items-center gap-3 mt-2 text-xs text-text-muted">
                        {d.author && <span>Logged by {d.author}</span>}
                        {d.has_attachment && <a href={`/api/employee-files/doc?file=${d.id}`} target="_blank" rel="noopener noreferrer" className="text-[#3f6b8a] hover:underline font-medium">📎 {d.attachment_name || 'Attachment'}</a>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- Tiles / list view ----
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="px-8 py-5 bg-white border-b border-border flex-shrink-0 flex items-center gap-4 flex-wrap">
        <div>
          <h1 className="font-spectral text-[23px] font-semibold text-text-primary">Employee Files</h1>
          <p className="text-sm text-text-muted mt-0.5">{profiles.length} employee{profiles.length === 1 ? '' : 's'}</p>
        </div>
        <div className="ml-auto flex items-center gap-2.5 flex-wrap">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" className="border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
          {!readOnly && <button onClick={() => { setEmpForm({ ...EMPTY_P }); setShowAddEmp(true); }} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark">+ Add employee</button>}
        </div>
      </header>

      <div className="flex-1 overflow-auto p-8">
        {filtered.length === 0 ? (
          <div className="text-sm text-text-muted border border-dashed border-border-light rounded-card p-10 text-center max-w-md mx-auto">No employees yet.{!readOnly && ' Click “Add employee” to create the first profile.'}</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map(p => (
              <button key={p.id} onClick={() => openProfile(p)} className="bg-white border border-border rounded-card p-5 text-center shadow-sm hover:shadow-md hover:border-border-light transition-all">
                {p.photo
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={p.photo} alt={p.name} className="w-20 h-20 rounded-full object-cover border border-border-light mx-auto" />
                  : <div className="w-20 h-20 rounded-full bg-[#1b2a3d] text-[#c9a24a] flex items-center justify-center text-xl font-bold mx-auto">{initials(p.name)}</div>}
                <div className="font-semibold text-text-primary mt-3 truncate">{p.name}</div>
                {p.position && <div className="text-xs text-text-muted truncate">{p.position}</div>}
                <div className="text-[11px] text-text-muted mt-2">{p.doc_count ?? 0} document{(p.doc_count ?? 0) === 1 ? '' : 's'}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {showAddEmp && !readOnly && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6" onClick={e => e.target === e.currentTarget && setShowAddEmp(false)}>
          <div className="bg-white rounded-card w-full max-w-lg shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="font-spectral text-[18px] font-semibold">Add employee</h2>
              <button onClick={() => setShowAddEmp(false)} className="text-text-muted hover:text-text-primary text-xl leading-none">×</button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              <div className="col-span-2 flex items-center gap-4">
                <label className="cursor-pointer">
                  {empForm.photo
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={empForm.photo} alt="" className="w-16 h-16 rounded-full object-cover border border-border-light" />
                    : <div className="w-16 h-16 rounded-full bg-[#f1ece3] flex items-center justify-center text-text-muted text-xs">Photo</div>}
                  <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) pickPhoto(f, 'add'); }} />
                </label>
                <span className="text-xs text-text-muted">Click to upload a photo (optional)</span>
              </div>
              {([['Name *', 'name'], ['Position', 'position'], ['Department', 'department'], ['Email', 'email'], ['Phone', 'phone'], ['Start date', 'start_date']] as [string, keyof typeof empForm][]).map(([l, k]) => (
                <div key={k} className={k === 'name' ? 'col-span-2' : ''}>
                  <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1">{l}</label>
                  <input type={k === 'start_date' ? 'date' : 'text'} value={empForm[k]} onChange={e => setEmpForm(p => ({ ...p, [k]: e.target.value }))} className={input} />
                </div>
              ))}
              <div className="col-span-2">
                <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1">Details</label>
                <textarea value={empForm.details} onChange={e => setEmpForm(p => ({ ...p, details: e.target.value }))} rows={2} className={input + ' resize-y'} />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setShowAddEmp(false)} className="text-sm text-text-muted px-3">Cancel</button>
              <button onClick={addEmployee} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark">Add employee</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

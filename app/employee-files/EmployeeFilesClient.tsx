'use client';
import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';
import { useAccess } from '@/components/AccessProvider';
import { FIRM_SYSTEMS, ACCOUNT_STATUSES, ACCESS_LEVELS } from '@/lib/firmSystems';

interface Profile {
  id: string; name: string; photo: string | null; position: string | null; department: string | null;
  email: string | null; phone: string | null; start_date: string | null; details: string | null; doc_count?: number; offboarded?: boolean;
  address?: string | null; salary?: string | null; dob?: string | null;
  favorite_color?: string | null; favorite_treat?: string | null; ktn?: string | null;
  marriott?: string | null; delta?: string | null; southwest?: string | null; american?: string | null;
  weight?: string | null; worker_type?: string | null; accounts_locked?: boolean; docs_locked?: boolean;
}
// Extra profile fields, grouped for the edit form + read-only display.
const EXTRA_GROUPS: { heading: string; fields: [string, keyof Profile][] }[] = [
  { heading: 'Personal', fields: [['Address', 'address'], ['Date of birth', 'dob'], ['Salary', 'salary'], ['Worker type', 'worker_type'], ['Favorite color', 'favorite_color'], ['Favorite treat', 'favorite_treat'], ['Shirt / weight', 'weight']] },
  { heading: 'Travel', fields: [['Known Traveler # (KTN)', 'ktn'], ['Marriott #', 'marriott'], ['Delta #', 'delta'], ['Southwest #', 'southwest'], ['American #', 'american']] },
];
const EXTRA_KEYS: (keyof Profile)[] = EXTRA_GROUPS.flatMap(g => g.fields.map(f => f[1]));
interface Doc {
  id: string; profile_id: string; category: string; title: string; doc_date: string | null;
  summary: string; what_we_did: string; next_steps: string; author: string; has_attachment?: boolean; attachment_name?: string | null;
}

interface Account {
  id: string; profile_id: string; system: string; account: string;
  access_level: string; status: string; source: string; notes: string;
}
const ACCT_LEVEL_COLOR: Record<string, string> = {
  'Admin': 'bg-[#e9f0f5] text-[#3f6b8a] border-[#cfe0ec]',
  'Standard user': 'bg-[#f7efe1] text-[#b07d2a] border-[#e0c48a]',
};
const ACCT_STATUS_COLOR: Record<string, string> = {
  'Active': 'bg-[#eef5f1] text-[#2f7d5b] border-[#cfe4d8]',
  'Needs review': 'bg-[#f7efe1] text-[#b07d2a] border-[#e0c48a]',
  'Suspended': 'bg-[#eef2f7] text-[#3f5a76] border-[#d4dde8]',
  'Closed': 'bg-[#f1ece3] text-[#8b8478] border-[#e2dccf]',
};

const ACCT_INPUT = 'w-full bg-transparent border border-transparent hover:border-border-light focus:border-ink rounded px-2 py-1 text-sm focus:outline-none disabled:hover:border-transparent';

const CATEGORIES = ['Performance Review', 'Coaching', 'Onboarding', 'Tools & Access', 'Remark / Timeline', 'Other'];
const CAT_COLOR: Record<string, string> = {
  'Performance Review': 'bg-[#eef2f7] text-[#3f5a76]', 'Coaching': 'bg-[#eef5f1] text-[#2f7d5b]',
  'Onboarding': 'bg-[#f0ebe0] text-[#8a6d3b]', 'Tools & Access': 'bg-[#eef2f7] text-[#4a5a6d]',
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
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showAddEmp, setShowAddEmp] = useState(false);
  const [empForm, setEmpForm] = useState({ ...EMPTY_P });
  const [editingProfile, setEditingProfile] = useState(false);
  const [docForm, setDocForm] = useState({ ...EMPTY_D });
  const [docFile, setDocFile] = useState<File | null>(null);
  const [showDocForm, setShowDocForm] = useState(false);
  const [editDocId, setEditDocId] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);

  const [tab, setTab] = useState<'employees' | 'contractors' | 'offboarded'>('employees');
  const input = 'w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink';
  const s = search.toLowerCase();
  const isContractor = (p: Profile) => /contract/i.test(String(p.worker_type ?? ''));
  const offCount = profiles.filter(p => p.offboarded).length;
  const empCount = profiles.filter(p => !p.offboarded && !isContractor(p)).length;
  const conCount = profiles.filter(p => !p.offboarded && isContractor(p)).length;
  const filtered = profiles
    .filter(p => tab === 'offboarded' ? p.offboarded : tab === 'contractors' ? (!p.offboarded && isContractor(p)) : (!p.offboarded && !isContractor(p)))
    .filter(p => !s || (p.name ?? '').toLowerCase().includes(s) || (p.position ?? '').toLowerCase().includes(s));

  async function openProfile(p: Profile) {
    setSelected(p); setEditingProfile(false); setShowDocForm(false); setEditDocId(null);
    setAccounts([]);
    const [d, a] = await Promise.all([
      fetch(`/api/employee-files?id=${p.id}`).then(r => r.json()),
      fetch(`/api/employee-accounts?profileId=${p.id}`).then(r => r.json()).catch(() => ({})),
    ]);
    if (d.profile) setSelected(d.profile);
    setDocs(d.docs ?? []);
    setAccounts(a.accounts ?? []);
  }

  // Resync this profile from Staffing and report what matched — makes a name
  // mismatch obvious (the usual reason a Staffing email edit doesn't appear).
  async function resyncFromStaffing(linkName?: string) {
    if (!selected) return;
    const res = await fetch('/api/employee-files', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'resync-report', id: selected.id, linkName }) });
    const d = await res.json();
    if (d.profile) setSelected(d.profile);
    if (d.matched) { showToast(`Synced from Staffing (${d.staffingName}). Email is now ${d.staffingEmail || '—'}.`); return; }
    if (d.offboardedMatch) { showToast(`“${selected.name}” is in Offboarded staff, not active Staffing. Restore them or fix the name to sync.`); return; }
    // No exact match — offer to link to the closest Staffing name (typo fix).
    const cand = (d.candidates ?? [])[0];
    if (cand) {
      if (confirm(`No Staffing record is spelled exactly “${selected.name}”.\n\nStaffing has “${cand.name}”${cand.email ? ` (${cand.email})` : ''}. This is likely the same person spelled differently.\n\nRename this Employee File to “${cand.name}” and sync from that Staffing record?`)) {
        await resyncFromStaffing(cand.name);
      }
      return;
    }
    showToast(`No Staffing record matches “${selected.name}”. Check the name is spelled exactly the same in Staffing.`);
  }

  // Lock/unlock the Accounts & Access list so it can't be edited or deleted by
  // accident. Persisted per employee.
  async function toggleAccountsLock() {
    if (!selected) return;
    const locked = !selected.accounts_locked;
    setSelected(p => p ? { ...p, accounts_locked: locked } : p);
    try {
      await fetch('/api/employee-files', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'set-accounts-lock', id: selected.id, locked }) });
      showToast(locked ? '🔒 Accounts locked — no edits' : '🔓 Accounts unlocked');
    } catch { showToast('Could not update lock'); }
  }
  async function toggleDocsLock() {
    if (!selected) return;
    const locked = !selected.docs_locked;
    setSelected(p => p ? { ...p, docs_locked: locked } : p);
    try {
      await fetch('/api/employee-files', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'set-docs-lock', id: selected.id, locked }) });
      showToast(locked ? '🔒 Documents locked — no edits' : '🔓 Documents unlocked');
    } catch { showToast('Could not update lock'); }
  }

  // ---- Accounts & Access ----
  async function addAccount() {
    if (!selected) return;
    const res = await fetch('/api/employee-accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profileId: selected.id, status: 'Active' }) });
    const d = await res.json();
    if (d.account) setAccounts(prev => [...prev, d.account]);
  }
  async function seedStandardAccounts() {
    if (!selected) return;
    const res = await fetch('/api/employee-accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profileId: selected.id, action: 'seed-standard' }) });
    const d = await res.json();
    if (d.accounts) { setAccounts(d.accounts); showToast(d.created ? `Added ${d.created} standard system${d.created > 1 ? 's' : ''}` : 'All standard systems already listed'); }
  }
  // Update a field locally; commit=true persists (selects on change, text on blur).
  function editAccount(id: string, changes: Partial<Account>, commit: boolean) {
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, ...changes } : a));
    if (commit) void fetch('/api/employee-accounts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...changes }) });
  }
  function commitAccount(a: Account) {
    void fetch('/api/employee-accounts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: a.id, system: a.system, account: a.account, access_level: a.access_level, notes: a.notes }) });
  }
  async function removeAccount(id: string) {
    setAccounts(prev => prev.filter(a => a.id !== id));
    await fetch(`/api/employee-accounts?id=${id}`, { method: 'DELETE' });
  }
  // Generate a per-employee Tools & Access survey link (no login). On submit it
  // files to the Employee File and updates this Accounts & Access list.
  async function createToolsSurvey() {
    if (!selected) return;
    const res = await fetch('/api/tools-survey', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', profileId: selected.id, name: selected.name, email: selected.email }) });
    const d = await res.json();
    if (!res.ok) { showToast(d.error || 'Could not create link'); return; }
    try { await navigator.clipboard.writeText(d.url); showToast('Tools survey link created & copied — share it with the employee'); }
    catch { showToast('Tools survey link created'); }
  }
  async function emailToolsSurvey() {
    if (!selected) return;
    if (!selected.email) { showToast('No email on file — use “Copy link” instead'); return; }
    const res = await fetch('/api/tools-survey', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send', profileId: selected.id, name: selected.name, email: selected.email }) });
    const d = await res.json();
    showToast(res.ok && d.emailed ? `Tools survey emailed to ${selected.email}` : (d.error || 'Could not email the survey'));
    if (res.ok) loadSurveyStatus();
  }
  // Per-employee tools-survey status (profile_id -> 'Sent' | 'Completed').
  const [surveyStatus, setSurveyStatus] = useState<Record<string, string>>({});
  async function loadSurveyStatus() {
    try {
      const d = await fetch('/api/tools-survey').then(r => r.json());
      const map: Record<string, string> = {};
      for (const r of (d.rows ?? [])) {
        if (!r.profile_id) continue;
        if (map[r.profile_id] === 'Completed') continue;
        if (r.status === 'Completed') map[r.profile_id] = 'Completed';
        else if (!map[r.profile_id]) map[r.profile_id] = r.status || 'Sent';
      }
      setSurveyStatus(map);
    } catch { /* ignore */ }
  }
  useEffect(() => { loadSurveyStatus(); }, []);
  // Clicking "Employee Files" in the sidebar while a profile is open returns to
  // the list (the route doesn't change, so we reset here).
  useEffect(() => {
    const h = (e: Event) => { if ((e as CustomEvent).detail === '/employee-files') setSelected(null); };
    window.addEventListener('hr-nav', h);
    return () => window.removeEventListener('hr-nav', h);
  }, []);

  async function testToolsSurvey() {
    const email = window.prompt('Send a test Tools & Access survey to which email?');
    if (!email || !email.trim()) return;
    const res = await fetch('/api/tools-survey', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send-test', email: email.trim() }) });
    const d = await res.json();
    showToast(res.ok && d.emailed ? `Test survey emailed to ${email.trim()}` : (d.error || 'Could not send the test'));
  }
  const [bulkBusy, setBulkBusy] = useState(false);
  const [showSurvey, setShowSurvey] = useState(false);
  const [surveySel, setSurveySel] = useState<Set<string>>(new Set());
  // Filter the survey recipient list by response status so you can see who's
  // still pending at a glance. 'pending' = survey sent but not yet submitted.
  const [surveyFilter, setSurveyFilter] = useState<'all' | 'pending' | 'submitted' | 'notsent'>('all');
  const sendableEmployees = () => profiles.filter(p => !p.offboarded && String(p.email ?? '').trim());
  function openSurveyModal() {
    // Default to everyone who has an email and hasn't submitted yet.
    setSurveySel(new Set(sendableEmployees().filter(p => surveyStatus[p.id] !== 'Completed').map(p => p.id)));
    setShowSurvey(true);
  }
  function toggleSurveySel(id: string) { setSurveySel(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
  async function sendSurveySelected() {
    const ids = [...surveySel];
    if (!ids.length) { showToast('Select at least one employee'); return; }
    setBulkBusy(true);
    try {
      const res = await fetch('/api/tools-survey', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send-bulk', profileIds: ids }) });
      const d = await res.json();
      if (!res.ok) { showToast(d.error || 'Could not send'); return; }
      showToast(`Survey emailed to ${d.sent} of ${d.total}${d.failed?.length ? ` · ${d.failed.length} failed` : ''}`);
      loadSurveyStatus(); setShowSurvey(false);
    } finally { setBulkBusy(false); }
  }

  const [syncing, setSyncing] = useState(false);
  async function syncStaffing() {
    setSyncing(true);
    try {
      const res = await fetch('/api/employee-files', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'sync-staffing' }) });
      const d = await res.json();
      if (d.profiles) setProfiles(d.profiles);
      showToast(d.created ? `Added ${d.created} employee${d.created === 1 ? '' : 's'} from Staffing` : 'Already up to date with Staffing');
    } catch { showToast('Sync failed'); }
    finally { setSyncing(false); }
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

  // Read the attached document with AI and pre-fill title / date / summary.
  async function autoRead() {
    if (!docFile) { showToast('Choose a file first'); return; }
    setParsing(true);
    try {
      const fd = new FormData(); fd.append('file', docFile);
      const res = await fetch('/api/employee-files/parse', { method: 'POST', body: fd });
      const d = await res.json();
      if (!res.ok) { showToast(d.error || 'Could not read the document'); return; }
      const f = d.fields ?? {};
      setDocForm(p => ({
        ...p,
        title: f.title || p.title,
        doc_date: f.date || p.doc_date,
        summary: f.summary || p.summary,
      }));
      showToast('Read the document — review the fields');
    } catch { showToast('Could not read the document'); }
    finally { setParsing(false); }
  }

  // Re-pull from every source on demand. The file already auto-syncs on open;
  // this is just a manual "check for updates now" that re-opens it.
  async function refreshNow() {
    if (!selected) return;
    setSyncing(true);
    try { await openProfile(selected); showToast('Refreshed from Staffing, Coaching & Reviews'); }
    finally { setSyncing(false); }
  }

  // ---- Detail view ----
  if (selected) {
    // Accounts / documents are read-only when the viewer is restricted OR that
    // section is locked (guards against accidental edits & deletes).
    const acctRO = readOnly || !!selected.accounts_locked;
    const docsRO = readOnly || !!selected.docs_locked;
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
                      {EXTRA_GROUPS.map(g => (
                        <div key={g.heading} className="col-span-2">
                          <div className="text-[10px] font-bold uppercase tracking-widest text-gold-muted mb-1.5 mt-1">{g.heading}</div>
                          <div className="grid grid-cols-2 gap-3">
                            {g.fields.map(([l, k]) => (
                              <div key={k}>
                                <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1">{l}</label>
                                <input type={k === 'dob' ? 'date' : 'text'} value={(selected[k] as string) ?? ''} onChange={e => setSelected(p => p ? { ...p, [k]: e.target.value } : p)} className={input} />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
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
                      {EXTRA_GROUPS.some(g => g.fields.some(([, k]) => selected[k])) && (
                        <div className="mt-4 space-y-3">
                          {EXTRA_GROUPS.map(g => {
                            const shown = g.fields.filter(([, k]) => selected[k]);
                            if (!shown.length) return null;
                            return (
                              <div key={g.heading}>
                                <div className="text-[10px] font-bold uppercase tracking-widest text-gold-muted mb-1">{g.heading}</div>
                                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                                  {shown.map(([l, k]) => (
                                    <div key={k}><span className="text-text-muted">{l}:</span> {k === 'dob' ? fmtDate(selected[k] as string) : String(selected[k])}</div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {!readOnly && (
                        <div className="flex gap-2 mt-4 flex-wrap">
                          <button onClick={() => setEditingProfile(true)} className="text-xs font-semibold text-ink border border-border-light px-3 py-1.5 rounded-ctrl hover:bg-canvas">Edit profile</button>
                          <button onClick={() => resyncFromStaffing()} title="Pull the latest email, phone, position, etc. from Staffing (and report if the name doesn't match)" className="text-xs font-semibold text-[#3f6b8a] border border-border-light px-3 py-1.5 rounded-ctrl hover:bg-canvas">↻ Resync from Staffing</button>
                          <button onClick={deleteProfile} className="text-xs font-semibold text-litred-alt border border-border-light px-3 py-1.5 rounded-ctrl hover:bg-[#fdeaea]">Delete</button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Accounts & access */}
            <div>
              <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-widest text-gold-muted">Accounts &amp; access</h2>
                  <p className="text-[11px] text-text-muted mt-0.5">A running list of the firm systems {selected.name.split(' ')[0]} can access — pulled into their offboarding checklist automatically.</p>
                </div>
                {!readOnly && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={toggleAccountsLock} title={selected.accounts_locked ? 'Locked — click to unlock and allow edits' : 'Lock this list so nothing can be edited or deleted by accident'}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-ctrl border ${selected.accounts_locked ? 'bg-[#f7efe1] border-[#e0c48a] text-[#b07d2a]' : 'border-border-light text-text-secondary hover:bg-canvas'}`}>
                      {selected.accounts_locked ? '🔒 Locked' : '🔓 Lock'}
                    </button>
                    {selected.email && <button onClick={emailToolsSurvey} title={`Email the Tools & Access survey to ${selected.email}`} className="text-xs font-semibold text-[#3f6b8a] border border-border-light px-2.5 py-1 rounded-ctrl hover:bg-canvas">✉ Email survey</button>}
                    <button onClick={createToolsSurvey} title="Create a no-login link the employee fills out; their answers update this list & file to their Employee File" className="text-xs font-semibold text-[#3f6b8a] border border-border-light px-2.5 py-1 rounded-ctrl hover:bg-canvas">⧉ Copy survey link</button>
                    {!selected.accounts_locked && accounts.length > 0 && <button onClick={seedStandardAccounts} className="text-xs font-semibold text-[#3f6b8a] border border-border-light px-2.5 py-1 rounded-ctrl hover:bg-canvas">+ Standard systems</button>}
                    {!selected.accounts_locked && <button onClick={addAccount} className="bg-ink text-white text-sm font-semibold px-3 py-1.5 rounded-ctrl hover:bg-ink-dark">+ Add account</button>}
                  </div>
                )}
              </div>
              <div className="bg-white border border-border rounded-card overflow-hidden mb-2">
                {accounts.length === 0 ? (
                  <div className="px-5 py-8 text-center text-sm text-text-muted">
                    No accounts listed yet.{!acctRO && <> Start with <button onClick={seedStandardAccounts} className="text-[#3f6b8a] font-semibold hover:underline">the standard firm systems</button>, then adjust per person.</>}
                  </div>
                ) : (
                  <>
                    <div className="hidden sm:grid grid-cols-[1.4fr_1fr_128px_1.6fr_26px] gap-2 px-4 py-2 bg-[#f1ece3] text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                      <span>System</span><span>Access level</span><span>Status</span><span>Notes</span><span></span>
                    </div>
                    <div className="divide-y divide-[#f1ece3]">
                      {accounts.map(a => (
                        <div key={a.id} className="grid grid-cols-2 sm:grid-cols-[1.4fr_1fr_128px_1.6fr_26px] gap-2 px-4 py-2 items-center">
                          <input list="firm-systems" disabled={acctRO} value={a.system ?? ''} onChange={e => editAccount(a.id, { system: e.target.value }, false)} onBlur={() => commitAccount(a)} placeholder="System" className={ACCT_INPUT + ' font-medium text-text-primary'} />
                          <select disabled={acctRO} value={a.access_level || 'Standard user'} onChange={e => editAccount(a.id, { access_level: e.target.value }, true)} className={`text-xs font-semibold px-2 py-1 rounded-full border ${acctRO ? '' : 'cursor-pointer'} ${ACCT_LEVEL_COLOR[a.access_level || 'Standard user'] || 'bg-[#f1ece3] text-[#8b8478] border-border-light'}`}>
                            {(a.access_level && !ACCESS_LEVELS.includes(a.access_level as any) ? [a.access_level] : []).map(v => <option key={v} value={v}>{v}</option>)}
                            {ACCESS_LEVELS.map(v => <option key={v} value={v}>{v}</option>)}
                          </select>
                          <select disabled={acctRO} value={a.status || 'Active'} onChange={e => editAccount(a.id, { status: e.target.value }, true)} className={`text-xs font-semibold px-2 py-1 rounded-full border ${acctRO ? '' : 'cursor-pointer'} ${ACCT_STATUS_COLOR[a.status] || ACCT_STATUS_COLOR['Active']}`}>
                            {ACCOUNT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                          <input disabled={acctRO} value={a.notes ?? ''} onChange={e => editAccount(a.id, { notes: e.target.value }, false)} onBlur={() => commitAccount(a)} placeholder="Notes" className={ACCT_INPUT} />
                          {!acctRO ? <button onClick={() => removeAccount(a.id)} title="Remove account" className="text-text-muted hover:text-litred-alt text-sm justify-self-center">✕</button> : <span className="justify-self-center text-text-faint text-xs" title="Locked">🔒</span>}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <datalist id="firm-systems">{FIRM_SYSTEMS.map(s => <option key={s} value={s} />)}</datalist>
            </div>

            {/* Documents */}
            <div>
              <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                <h2 className="text-xs font-bold uppercase tracking-widest text-gold-muted">Documents & timeline</h2>
                {!readOnly && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-[11px] text-text-muted" title="Staffing details, Coaching forms, and Performance Reviews are pulled in automatically whenever this file is opened — no need to click anything.">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#2f7d5b]" />Auto-synced from Staffing · Coaching · Reviews
                    </span>
                    <button onClick={toggleDocsLock} title={selected.docs_locked ? 'Locked — click to unlock and allow edits' : 'Lock these documents so nothing can be edited or deleted by accident'}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-ctrl border ${selected.docs_locked ? 'bg-[#f7efe1] border-[#e0c48a] text-[#b07d2a]' : 'border-border-light text-text-secondary hover:bg-canvas'}`}>
                      {selected.docs_locked ? '🔒 Locked' : '🔓 Lock'}
                    </button>
                    <button onClick={() => refreshNow()} disabled={syncing} className="text-xs font-semibold text-[#3f6b8a] border border-border-light px-2.5 py-1 rounded-ctrl hover:bg-canvas disabled:opacity-50">{syncing ? 'Refreshing…' : '↻ Refresh now'}</button>
                    {!docsRO && <button onClick={startDoc} className="bg-ink text-white text-sm font-semibold px-3 py-1.5 rounded-ctrl hover:bg-ink-dark ml-1">+ Add entry</button>}
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
                    <div className="flex items-center gap-2">
                      <input type="file" onChange={e => setDocFile(e.target.files?.[0] ?? null)} className="text-xs" />
                      {docFile && <button type="button" onClick={autoRead} disabled={parsing} className="shrink-0 text-[11px] font-semibold text-white bg-[#1b2a3d] px-2.5 py-1 rounded-ctrl hover:bg-[#243750] disabled:opacity-50">{parsing ? 'Reading…' : '✨ Auto-read'}</button>}
                    </div>
                    <p className="text-[10px] text-text-muted mt-1">PDF, DOCX or image — Auto-read fills in the title, date & summary for you.</p>
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
                        {!docsRO && (
                          <div className="ml-auto flex gap-2">
                            <button onClick={() => startEditDoc(d)} className="text-xs font-semibold text-ink border border-border-light px-2.5 py-1 rounded-ctrl hover:bg-canvas">Edit</button>
                            <button onClick={() => deleteDoc(d)} className="text-xs font-semibold text-litred-alt border border-border-light px-2.5 py-1 rounded-ctrl hover:bg-[#fdeaea]">Delete</button>
                          </div>
                        )}
                        {readOnly ? null : docsRO && <span className="ml-auto text-text-faint text-xs" title="Locked">🔒</span>}
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
          <p className="text-sm text-text-muted mt-0.5">{empCount} employee{empCount === 1 ? '' : 's'} · {conCount} contractor{conCount === 1 ? '' : 's'}{offCount ? ` · ${offCount} offboarded` : ''}</p>
        </div>
        <div className="ml-auto flex items-center gap-2.5 flex-wrap">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" className="border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
          {!readOnly && <button onClick={syncStaffing} disabled={syncing} className="bg-white border border-border-light text-ink text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-canvas disabled:opacity-50" title="Create a tile for every employee in Staffing">{syncing ? 'Syncing…' : '⇪ Sync from Staffing'}</button>}
          {!readOnly && <button onClick={testToolsSurvey} className="bg-white border border-border-light text-text-secondary text-sm font-semibold px-3 py-2 rounded-ctrl hover:bg-canvas" title="Send a test Tools & Access survey to any email to preview it">✉ Test</button>}
          {!readOnly && <button onClick={openSurveyModal} className="bg-white border border-border-light text-ink text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-canvas" title="Choose which employees receive the Tools & Access survey">✉ Send tools survey</button>}
          {!readOnly && <button onClick={() => { setEmpForm({ ...EMPTY_P }); setShowAddEmp(true); }} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark">+ Add employee</button>}
        </div>
      </header>

      <div className="px-8 pt-4 bg-white border-b border-border flex-shrink-0 flex gap-1">
        {([['employees', `Employees (${empCount})`], ['contractors', `Contractors (${conCount})`], ['offboarded', `Offboarded (${offCount})`]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`text-sm font-semibold px-4 py-2 rounded-t-ctrl border-b-2 ${tab === k ? 'border-gold text-text-primary' : 'border-transparent text-text-muted hover:text-text-secondary'}`}>{l}</button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-8">
        {filtered.length === 0 ? (
          <div className="text-sm text-text-muted border border-dashed border-border-light rounded-card p-10 text-center max-w-md mx-auto">{tab === 'offboarded' ? 'No offboarded employees yet. Complete an offboarding and click “Move to Offboarded”.' : tab === 'contractors' ? 'No contractors here. Contractors are people whose Worker type is “Contractor” (set in their profile or Staffing).' : <>No employees yet.{!readOnly && ' Click “⇪ Sync from Staffing” to create a tile for everyone, or “Add employee” for one.'}</>}</div>
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
                {surveyStatus[p.id] && <div className={`mt-1.5 inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${surveyStatus[p.id] === 'Completed' ? 'bg-[#eef5f1] text-[#2f7d5b]' : 'bg-[#f7efe1] text-[#b07d2a]'}`} title="Tools & Access survey">{surveyStatus[p.id] === 'Completed' ? '✓ Tools submitted' : 'Survey sent'}</div>}
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

      {/* Tools survey — choose recipients */}
      {showSurvey && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6" onClick={e => e.target === e.currentTarget && setShowSurvey(false)}>
          <div className="bg-white rounded-card w-full max-w-lg max-h-[85vh] flex flex-col shadow-xl overflow-hidden">
            {(() => {
              const everyone = profiles.filter(p => !p.offboarded);
              const nPending = everyone.filter(p => surveyStatus[p.id] === 'Sent').length;
              const nSubmitted = everyone.filter(p => surveyStatus[p.id] === 'Completed').length;
              const nNotSent = everyone.filter(p => !surveyStatus[p.id]).length;
              const shown = everyone.filter(p => {
                const st = surveyStatus[p.id];
                if (surveyFilter === 'pending') return st === 'Sent';
                if (surveyFilter === 'submitted') return st === 'Completed';
                if (surveyFilter === 'notsent') return !st;
                return true;
              });
              const chip = (key: typeof surveyFilter, label: string, n: number, cls: string) => (
                <button onClick={() => setSurveyFilter(key)}
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${surveyFilter === key ? cls : 'bg-white border-border-light text-text-muted hover:text-text-primary'}`}>{label} <b>{n}</b></button>
              );
              return (
                <>
                  <div className="px-5 py-3.5 border-b border-border flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-text-primary">Tools &amp; Access survey</div>
                      <div className="text-xs text-text-muted mt-0.5">{nPending} awaiting response · {nSubmitted} submitted · {nNotSent} not sent. <b>{surveySel.size}</b> selected to send.</div>
                    </div>
                    <button onClick={() => setShowSurvey(false)} className="text-text-muted hover:text-text-primary text-xl leading-none">×</button>
                  </div>
                  <div className="px-5 py-2 border-b border-border-light flex items-center gap-1.5 flex-wrap">
                    {chip('all', 'All', everyone.length, 'bg-[#eef2f7] border-[#c9d6e3] text-[#3f5a76]')}
                    {chip('pending', '⏳ Awaiting response', nPending, 'bg-[#f7efe1] border-[#e0c48a] text-[#b07d2a]')}
                    {chip('submitted', '✓ Submitted', nSubmitted, 'bg-[#eef5f1] border-[#cfe4d8] text-[#2f7d5b]')}
                    {chip('notsent', 'Not sent', nNotSent, 'bg-[#f3f0ea] border-border-light text-text-muted')}
                  </div>
                  <div className="px-5 py-2 border-b border-border-light flex items-center gap-4 text-[11px] font-semibold">
                    <button onClick={() => setSurveySel(new Set(shown.filter(p => String(p.email ?? '').trim()).map(p => p.id)))} className="text-[#3f6b8a] hover:underline">Select shown</button>
                    <button onClick={() => setSurveySel(new Set(sendableEmployees().filter(p => surveyStatus[p.id] !== 'Completed').map(p => p.id)))} className="text-[#3f6b8a] hover:underline">Only non-responders</button>
                    <button onClick={() => setSurveySel(new Set())} className="text-text-muted hover:underline">Clear</button>
                  </div>
                  <div className="flex-1 overflow-auto p-3 space-y-0.5">
                    {shown.length === 0 && <p className="text-sm text-text-muted text-center py-6">No one in this group.</p>}
                    {shown.map(p => {
                      const email = String(p.email ?? '').trim();
                      const st = surveyStatus[p.id];
                      return (
                        <label key={p.id} className={`flex items-center gap-3 px-2 py-1.5 rounded-ctrl ${email ? 'hover:bg-canvas cursor-pointer' : 'opacity-50'}`}>
                          <input type="checkbox" disabled={!email} checked={surveySel.has(p.id)} onChange={() => toggleSurveySel(p.id)} className="w-4 h-4 accent-[#1b2a3d]" />
                          <span className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-text-primary">{p.name}</span>
                            <span className="text-xs text-text-muted ml-2">{email || 'no email on file'}</span>
                          </span>
                          {st
                            ? <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${st === 'Completed' ? 'bg-[#eef5f1] text-[#2f7d5b]' : 'bg-[#f7efe1] text-[#b07d2a]'}`}>{st === 'Completed' ? '✓ Submitted' : '⏳ Awaiting'}</span>
                            : <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 bg-[#f3f0ea] text-text-muted">Not sent</span>}
                        </label>
                      );
                    })}
                  </div>
                </>
              );
            })()}
            <div className="px-5 py-3 border-t border-border flex justify-end gap-2">
              <button onClick={() => setShowSurvey(false)} className="text-sm text-text-muted px-3">Cancel</button>
              <button onClick={sendSurveySelected} disabled={bulkBusy || surveySel.size === 0} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark disabled:opacity-50">{bulkBusy ? 'Sending…' : `✉ Send to ${surveySel.size}`}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

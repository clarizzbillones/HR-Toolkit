'use client';
import { useEffect, useState, useCallback } from 'react';
import { BENEFITS, BENEFIT_STATUSES, BENEFIT_PROVIDERS, benefitStatusChip, type Enrollment, type Benefit } from '@/lib/benefits';
import { formatDate } from '@/lib/formatDate';

// Benefits enrollment UI, shared by the Insurance tile (firm-wide roster) and
// each Employee File (one person). Both read/write /api/benefits.
type Draft = { person_name: string; benefit: string; status: string; enrolled_date: string; plan: string; notes: string };

export default function BenefitsEnrollment({ mode, personName, canEdit = true }: {
  mode: 'roster' | 'person';
  personName?: string;
  canEdit?: boolean;
}) {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [employees, setEmployees] = useState<{ name: string; position: string | null }[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [edit, setEdit] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    const url = mode === 'person' && personName ? `/api/benefits?name=${encodeURIComponent(personName)}` : '/api/benefits';
    fetch(url).then(r => r.json()).then(d => {
      setEnrollments(d.enrollments ?? []);
      if (d.employees) setEmployees(d.employees);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, [mode, personName]);
  useEffect(() => { load(); }, [load]);

  const find = (name: string, benefit: string): Enrollment | undefined =>
    enrollments.find(e => e.person_name?.trim().toLowerCase() === name.trim().toLowerCase() && e.benefit === benefit);

  function openCell(name: string, benefit: string) {
    if (!canEdit) return;
    const e = find(name, benefit);
    setEdit({ person_name: name, benefit, status: e?.status ?? '', enrolled_date: (e?.enrolled_date ?? '').slice(0, 10), plan: e?.plan ?? '', notes: e?.notes ?? '' });
  }

  async function save() {
    if (!edit) return;
    setSaving(true);
    try {
      await fetch('/api/benefits', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(edit) });
      setEnrollments(prev => {
        const rest = prev.filter(e => !(e.person_name?.trim().toLowerCase() === edit.person_name.trim().toLowerCase() && e.benefit === edit.benefit));
        return [...rest, { ...edit } as Enrollment];
      });
      setEdit(null);
    } finally { setSaving(false); }
  }

  async function clearCell() {
    if (!edit) return;
    setSaving(true);
    try {
      await fetch('/api/benefits', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ person_name: edit.person_name, benefit: edit.benefit }) });
      setEnrollments(prev => prev.filter(e => !(e.person_name?.trim().toLowerCase() === edit.person_name.trim().toLowerCase() && e.benefit === edit.benefit)));
      setEdit(null);
    } finally { setSaving(false); }
  }

  // A compact status pill (+ plan/date hint) for a cell.
  const Cell = ({ name, benefit }: { name: string; benefit: string }) => {
    const e = find(name, benefit);
    const label = e?.status || '—';
    return (
      <button
        onClick={() => openCell(name, benefit)}
        disabled={!canEdit}
        title={canEdit ? 'Click to edit' : undefined}
        className={`w-full text-left rounded-ctrl px-2 py-1.5 transition-colors ${canEdit ? 'hover:ring-1 hover:ring-border cursor-pointer' : 'cursor-default'}`}>
        <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${benefitStatusChip(e?.status ?? '')}`}>{label}</span>
        {(e?.plan || e?.enrolled_date) && (
          <span className="block text-[10px] text-text-muted mt-0.5 truncate">
            {e?.plan}{e?.plan && e?.enrolled_date ? ' · ' : ''}{e?.enrolled_date ? formatDate(e.enrolled_date) : ''}
          </span>
        )}
      </button>
    );
  };

  if (!loaded) return <div className="text-sm text-text-muted">Loading benefits…</div>;

  // ---- Person mode: a compact list of this person's four elections ----------
  if (mode === 'person') {
    return (
      <div className="space-y-2">
        {BENEFITS.map(benefit => {
          const e = find(personName ?? '', benefit);
          return (
            <div key={benefit} className="flex items-center gap-3 rounded-ctrl border border-border-light px-3 py-2">
              <span className="w-28 shrink-0">
                <span className="block text-xs font-bold uppercase tracking-wide text-text-muted">{benefit}</span>
                <span className="block text-[10px] text-text-faint truncate">{BENEFIT_PROVIDERS[benefit as Benefit]}</span>
              </span>
              <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${benefitStatusChip(e?.status ?? '')}`}>{e?.status || '—'}</span>
              <span className="flex-1 min-w-0 text-xs text-text-muted truncate">
                {e?.plan ? e.plan : ''}{e?.plan && e?.enrolled_date ? ' · ' : ''}{e?.enrolled_date ? `enrolled ${formatDate(e.enrolled_date)}` : ''}{e?.notes ? `${(e?.plan || e?.enrolled_date) ? ' · ' : ''}${e.notes}` : ''}
              </span>
              {canEdit && <button onClick={() => openCell(personName ?? '', benefit)} className="shrink-0 text-xs font-semibold text-ink hover:underline">Edit</button>}
            </div>
          );
        })}
        {edit && Editor()}
      </div>
    );
  }

  // ---- Roster mode: all employees × the four benefits -----------------------
  // Include anyone with an enrollment even if they're no longer in Staffing.
  const names = new Set(employees.map(e => e.name));
  const extraNames = enrollments.map(e => e.person_name).filter(n => n && !names.has(n));
  const roster = [...employees.map(e => ({ name: e.name, position: e.position })), ...[...new Set(extraNames)].map(n => ({ name: n, position: null }))];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[720px]">
        <thead>
          <tr className="border-b border-[#f1ece3] text-xs font-bold uppercase tracking-wider text-text-muted">
            <th className="text-left px-4 py-3 sticky left-0 bg-white">Employee</th>
            {BENEFITS.map(b => (
              <th key={b} className="text-left px-3 py-3">
                <div>{b}</div>
                <div className="text-[10px] font-medium normal-case tracking-normal text-text-faint">{BENEFIT_PROVIDERS[b as Benefit]}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {roster.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-text-muted">No employees found</td></tr>}
          {roster.map(r => (
            <tr key={r.name} className="border-b border-[#f1ece3] last:border-0 hover:bg-canvas">
              <td className="px-4 py-2 sticky left-0 bg-white">
                <div className="font-semibold text-text-primary whitespace-nowrap">{r.name}</div>
                {r.position && <div className="text-[11px] text-text-muted whitespace-nowrap">{r.position}</div>}
              </td>
              {BENEFITS.map(b => <td key={b} className="px-3 py-2 align-top">{Cell({ name: r.name, benefit: b })}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {edit && Editor()}
    </div>
  );

  // Shared edit modal.
  function Editor() {
    if (!edit) return null;
    return (
      <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6" onClick={() => setEdit(null)}>
        <div className="bg-white rounded-card w-full max-w-md shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="px-5 py-4 border-b border-border">
            <h3 className="font-spectral text-[17px] font-semibold text-text-primary">{edit.benefit} · {edit.person_name}</h3>
            <p className="text-xs text-text-muted mt-0.5">{BENEFIT_PROVIDERS[edit.benefit as Benefit] ? `${BENEFIT_PROVIDERS[edit.benefit as Benefit]} · ` : ''}record this person&rsquo;s election.</p>
          </div>
          <div className="px-5 py-4 space-y-3">
            <div>
              <label className="text-xs font-bold text-text-muted uppercase tracking-wide block mb-1">Status</label>
              <select value={edit.status} onChange={e => setEdit({ ...edit, status: e.target.value })}
                className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm bg-white focus:outline-none focus:border-ink">
                <option value="">— not recorded —</option>
                {BENEFIT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-text-muted uppercase tracking-wide block mb-1">Enrollment date</label>
                <input type="date" value={edit.enrolled_date} onChange={e => setEdit({ ...edit, enrolled_date: e.target.value })}
                  className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm bg-white focus:outline-none focus:border-ink" />
              </div>
              <div>
                <label className="text-xs font-bold text-text-muted uppercase tracking-wide block mb-1">Plan / tier</label>
                <input value={edit.plan} onChange={e => setEdit({ ...edit, plan: e.target.value })} placeholder="e.g. Silver · Family"
                  className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm bg-white focus:outline-none focus:border-ink" />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-text-muted uppercase tracking-wide block mb-1">Notes</label>
              <input value={edit.notes} onChange={e => setEdit({ ...edit, notes: e.target.value })} placeholder="Dependents, special cases…"
                className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm bg-white focus:outline-none focus:border-ink" />
            </div>
          </div>
          <div className="px-5 py-4 border-t border-border flex items-center justify-between">
            <button onClick={clearCell} disabled={saving} className="text-xs text-[#b0412f] hover:underline">Clear entry</button>
            <div className="flex gap-2">
              <button onClick={() => setEdit(null)} className="text-sm text-text-muted px-4 py-2">Cancel</button>
              <button onClick={save} disabled={saving} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

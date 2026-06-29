'use client';
import { useState } from 'react';
import clsx from 'clsx';
import { useToast } from '@/components/Toast';

interface Employee {
  id: string; name: string; role: string; dept: string; hire_date: string | null;
  review_6mo_status: string | null; review_1yr_status: string | null; review_notes: string | null;
}

const REVIEW_STATUSES = ['Not Started', 'Scheduled', 'Complete'];

function statusStyle(s: string) {
  if (s === 'Complete') return 'bg-[#eef5f1] text-[#2f7d5b]';
  if (s === 'Scheduled') return 'bg-[#e9f0f5] text-[#3f6b8a]';
  return 'bg-[#f7efe1] text-[#b07d2a]';
}

function daysSince(dateStr: string) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

export default function ReviewsClient({ initialEmployees }: { initialEmployees: Employee[] }) {
  const { showToast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'due6' | 'due1' | 'complete'>('all');
  const [updating, setUpdating] = useState<string | null>(null);

  async function updateReview(id: string, field: 'review_6mo_status' | 'review_1yr_status', value: string) {
    setUpdating(id + field);
    const res = await fetch(`/api/employees/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });
    if (res.ok) {
      const { employee } = await res.json();
      setEmployees(prev => prev.map(e => e.id === id ? employee : e));
      showToast('Review updated');
    }
    setUpdating(null);
  }

  const filtered = employees.filter(e => {
    if (filter === 'due6') { const d = daysSince(e.hire_date ?? ''); return d !== null && d >= 150 && e.review_6mo_status !== 'Complete'; }
    if (filter === 'due1') { const d = daysSince(e.hire_date ?? ''); return d !== null && d >= 330 && e.review_1yr_status !== 'Complete'; }
    if (filter === 'complete') return e.review_6mo_status === 'Complete' && e.review_1yr_status === 'Complete';
    return true;
  });

  const complete6 = employees.filter(e => e.review_6mo_status === 'Complete').length;
  const complete1 = employees.filter(e => e.review_1yr_status === 'Complete').length;
  const due6 = employees.filter(e => { const d = daysSince(e.hire_date ?? ''); return d !== null && d >= 150 && e.review_6mo_status !== 'Complete'; }).length;
  const due1 = employees.filter(e => { const d = daysSince(e.hire_date ?? ''); return d !== null && d >= 330 && e.review_1yr_status !== 'Complete'; }).length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="px-8 py-5 bg-white border-b border-border flex-shrink-0">
        <h1 className="font-spectral text-[23px] font-semibold text-text-primary">Performance Reviews</h1>
        <p className="text-sm text-text-muted mt-0.5">{complete6} / {employees.length} 6-month · {complete1} / {employees.length} 1-year complete</p>
      </header>

      <div className="grid grid-cols-4 gap-4 px-8 py-5 flex-shrink-0">
        {[
          { label: 'Total Staff', value: employees.length, color: undefined },
          { label: '6-Mo Complete', value: complete6, color: '#2f7d5b' },
          { label: '1-Yr Complete', value: complete1, color: '#3f6b8a' },
          { label: 'Past Due', value: due6 + due1, color: '#b0412f' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-border rounded-card px-5 py-4">
            <div className="text-xs font-bold uppercase tracking-wider text-text-muted mb-1">{s.label}</div>
            <div className="text-3xl font-spectral font-semibold" style={{ color: s.color ?? '#1b2230' }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-1 px-8 pb-3 flex-shrink-0">
        {([['all','All'],['due6','6-Mo Due'],['due1','1-Yr Due'],['complete','Complete']] as const).map(([f, l]) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${filter === f ? 'bg-ink text-white' : 'bg-[#f1ece3] text-text-secondary hover:bg-[#e8e3da]'}`}>
            {l}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto px-8 pb-6">
        <div className="bg-white border border-border rounded-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#f1ece3] border-b border-border">
              <tr>{['Name','Role','Dept','Hire Date','Tenure','6-Mo Review','1-Yr Review'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-text-secondary">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {filtered.map(e => {
                const days = daysSince(e.hire_date ?? '');
                const tenure = days !== null ? (days >= 365 ? `${Math.floor(days / 365)}y ${Math.floor((days % 365) / 30)}m` : `${Math.floor(days / 30)}mo`) : '—';
                return (
                  <>
                    <tr key={e.id} onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                      className="border-t border-[#f1ece3] hover:bg-canvas transition-colors cursor-pointer">
                      <td className="px-4 py-3 font-medium text-text-primary">{e.name}</td>
                      <td className="px-4 py-3 text-text-secondary">{e.role}</td>
                      <td className="px-4 py-3 text-text-secondary">{e.dept}</td>
                      <td className="px-4 py-3 text-text-muted">{e.hire_date || '—'}</td>
                      <td className="px-4 py-3 text-text-muted">{tenure}</td>
                      <td className="px-4 py-3">
                        <select value={e.review_6mo_status ?? 'Not Started'} disabled={updating === e.id + 'review_6mo_status'}
                          onClick={ev => ev.stopPropagation()}
                          onChange={ev => updateReview(e.id, 'review_6mo_status', ev.target.value)}
                          className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full border-0 focus:outline-none cursor-pointer', statusStyle(e.review_6mo_status ?? 'Not Started'))}>
                          {REVIEW_STATUSES.map(s => <option key={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <select value={e.review_1yr_status ?? 'Not Started'} disabled={updating === e.id + 'review_1yr_status'}
                          onClick={ev => ev.stopPropagation()}
                          onChange={ev => updateReview(e.id, 'review_1yr_status', ev.target.value)}
                          className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full border-0 focus:outline-none cursor-pointer', statusStyle(e.review_1yr_status ?? 'Not Started'))}>
                          {REVIEW_STATUSES.map(s => <option key={s}>{s}</option>)}
                        </select>
                      </td>
                    </tr>
                    {expanded === e.id && (
                      <tr key={e.id + '-notes'} className="bg-[#fbfaf7]">
                        <td colSpan={7} className="px-6 py-3 text-sm text-text-secondary">{e.review_notes ?? 'No notes yet.'}</td>
                      </tr>
                    )}
                  </>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-text-muted">No employees match this filter</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

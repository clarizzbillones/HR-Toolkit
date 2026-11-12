'use client';
import { useEffect, useMemo, useState } from 'react';
import { CostModal, type CostRow } from '@/components/ActualCost';
import { LEDGER_LINES, RETIREMENT_PLANS, type CostSettings, type LineKey } from '@/lib/actualCost';

// Reports: headcount, tenure, benefits enrollment (who's on what) and — for the cost viewers
// only — employer cost. Opened from Staffing and Employee Files. Charts are plain HTML bars in one
// hue (every chart here is a single series), each with a hover tooltip and a table underneath.

const BAR = '#2a78d6';      // data hue (single series)
const TRACK = '#edf1f6';    // unfilled part of a bar
const BENEFITS = ['Medical', 'Dental', 'Vision', 'Life', 'Malpractice'] as const;
const STATUSES = ['Enrolled', 'Pending', 'Declined', 'Waived', 'Not eligible'] as const;

const norm = (s: any) => String(s ?? '').normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().toLowerCase();
function parseDay(v: any): Date | null {
  const s = String(v ?? '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
  if (m) { let y = +m[3]; if (y < 100) y += y < 50 ? 2000 : 1900; return new Date(y, +m[1] - 1, +m[2]); }
  return null;
}
const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

interface Person { id: string; name: string; worker_type: string | null; position: string | null; start_date: string | null; offboarded: boolean; offboarded_date: string | null }

// One hover tooltip for the whole view.
function useTip() {
  const [tip, setTip] = useState<{ x: number; y: number; lines: string[] } | null>(null);
  const on = (lines: string[]) => ({
    onMouseMove: (e: React.MouseEvent) => setTip({ x: e.clientX, y: e.clientY, lines }),
    onMouseLeave: () => setTip(null),
  });
  const node = tip && (
    <div className="fixed z-[60] pointer-events-none bg-[#1b2a3d] text-white text-xs rounded-ctrl px-3 py-2 shadow-lg max-w-[260px]"
      style={{ left: Math.min(tip.x + 14, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 270), top: tip.y + 14 }}>
      {tip.lines.map((l, i) => <div key={i} className={i === 0 ? 'font-semibold mb-0.5' : 'text-white/80 tabular-nums'}>{l}</div>)}
    </div>
  );
  return { on, node };
}

function Tile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white border border-border-light rounded-card px-4 py-3">
      <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">{label}</div>
      <div className="font-spectral text-2xl font-semibold text-text-primary tabular-nums mt-0.5">{value}</div>
      {sub && <div className="text-[11px] text-text-muted mt-0.5">{sub}</div>}
    </div>
  );
}

function Card({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-border-light rounded-card p-5">
      <div className="flex items-baseline justify-between gap-3 mb-4 flex-wrap">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gold-muted">{title}</h3>
        {note && <span className="text-[11px] text-text-muted">{note}</span>}
      </div>
      {children}
    </section>
  );
}

// Horizontal bars: label · bar (value of max) · value text. Hover shows `tip`.
function HBars({ items, max, tipOn }: { items: { label: string; value: number; text: string; tip: string[] }[]; max: number; tipOn: (l: string[]) => any }) {
  return (
    <div className="space-y-1">
      {items.map(it => (
        <div key={it.label} {...tipOn(it.tip)} className="grid grid-cols-[minmax(90px,190px)_1fr_auto] items-center gap-3 py-1 rounded hover:bg-canvas px-1 -mx-1 cursor-default">
          <span className="text-sm text-text-secondary truncate">{it.label}</span>
          <div className="h-3.5 rounded-[4px]" style={{ background: TRACK }}>
            <div className="h-full rounded-[4px]" style={{ width: `${max ? Math.max(it.value ? 1.5 : 0, (it.value / max) * 100) : 0}%`, background: BAR }} />
          </div>
          <span className="text-sm tabular-nums text-text-primary text-right min-w-[88px]">{it.text}</span>
        </div>
      ))}
    </div>
  );
}

// Columns over a category axis (years). Value labels on top, baseline at the bottom.
function Columns({ items, tipOn, height = 140 }: { items: { label: string; value: number; tip: string[] }[]; tipOn: (l: string[]) => any; height?: number }) {
  const max = Math.max(1, ...items.map(i => i.value));
  if (!items.length) return <p className="text-sm text-text-muted">No dates on file.</p>;
  return (
    <div className="overflow-x-auto">
      <div className="flex items-end gap-1.5 border-b border-border-light" style={{ height: height + 22, minWidth: items.length * 34 }}>
        {items.map(it => (
          <div key={it.label} {...tipOn(it.tip)} className="flex-1 min-w-[28px] flex flex-col items-center justify-end h-full cursor-default group">
            <span className="text-[11px] tabular-nums text-text-secondary mb-1">{it.value || ''}</span>
            <div className="w-full max-w-[36px] rounded-t-[4px] group-hover:opacity-80" style={{ height: (it.value / max) * height, background: BAR }} />
          </div>
        ))}
      </div>
      <div className="flex gap-1.5 mt-1" style={{ minWidth: items.length * 34 }}>
        {items.map(it => <span key={it.label} className="flex-1 min-w-[28px] text-center text-[11px] text-text-muted tabular-nums">{it.label}</span>)}
      </div>
    </div>
  );
}

const th = 'text-left text-[11px] font-bold uppercase tracking-wider text-text-muted px-3 py-2 whitespace-nowrap';
const td = 'px-3 py-2 whitespace-nowrap';

type ReportData = { staff: Person[]; enrollments: any[]; vendors: number };
type ReportCost = { settings: CostSettings; rows: CostRow[] };

export function StaffReports({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<ReportData | null>(null);
  const [cost, setCost] = useState<ReportCost | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    fetch('/api/staffing/reports').then(r => (r.ok ? r.json() : Promise.reject())).then(setData).catch(() => setErr('Could not load the report data.'));
    // Cost answers only for Clarizz and Catie; everyone else simply gets no cost sections.
    fetch('/api/staffing/cost').then(r => (r.ok ? r.json() : null)).then(d => d && setCost(d)).catch(() => {});
  }, []);
  return (
    <CostModal title="Reports" onClose={onClose}>
      {err && <p className="text-sm text-litred-alt">{err}</p>}
      {!data && !err && <p className="text-sm text-text-muted">Loading…</p>}
      {data && <ReportsBody data={data} cost={cost} />}
    </CostModal>
  );
}

export function ReportsBody({ data, cost }: { data: ReportData; cost: ReportCost | null }) {
  const { on, node } = useTip();

  const r = useMemo(() => {
    if (!data) return null;
    const now = new Date(), year = now.getFullYear();
    const active = data.staff.filter(s => !s.offboarded);
    const emps = active.filter(s => (s.worker_type || 'Employee') !== 'Contractor');
    const contractors = active.filter(s => s.worker_type === 'Contractor');
    const off = data.staff.filter(s => s.offboarded);
    // Benefits: person → benefit → status (employees only).
    const enr = new Map<string, Record<string, string>>();
    for (const e of data.enrollments) { const k = norm(e.person_name); enr.set(k, { ...(enr.get(k) ?? {}), [e.benefit]: e.status || '' }); }
    const statusOf = (p: Person, b: string) => enr.get(norm(p.name))?.[b] || '';
    const costByName = new Map((cost?.rows ?? []).map(c => [norm(c.name), c]));
    const planOf = (p: Person) => costByName.get(norm(p.name))?.inputs.retirementPlan ?? null;
    const benefitRows = [...BENEFITS.map(b => {
      const counts: Record<string, number> = Object.fromEntries([...STATUSES, ''].map(s => [s, 0]));
      for (const p of emps) { const s = statusOf(p, b); counts[(STATUSES as readonly string[]).includes(s) ? s : '']++; }
      return { label: b, counts, enrolled: counts.Enrolled };
    }), ...(cost ? [(() => {
      const counts: Record<string, number> = Object.fromEntries([...STATUSES, ''].map(s => [s, 0]));
      for (const p of emps) { const pl = planOf(p); if (!pl) counts['']++; else if (pl === 'none') counts.Declined++; else counts.Enrolled++; }
      return { label: '401(k)', counts, enrolled: counts.Enrolled };
    })()] : [])];
    // Tenure (employees + contractors who are active).
    const yearsIn = (p: Person) => { const d = parseDay(p.start_date); return d ? (now.getTime() - d.getTime()) / (365.25 * 864e5) : null; };
    const tenures = active.map(yearsIn).filter((n): n is number => n != null && n >= 0);
    const bands: [string, (n: number) => boolean][] = [['Under 1 year', n => n < 1], ['1–3 years', n => n >= 1 && n < 3], ['3–5 years', n => n >= 3 && n < 5], ['5–10 years', n => n >= 5 && n < 10], ['10+ years', n => n >= 10]];
    // Start year (active) and offboard year.
    const byYear = (list: Person[], field: 'start_date' | 'offboarded_date') => {
      const m = new Map<number, string[]>();
      for (const p of list) { const d = parseDay(p[field]); if (d) m.set(d.getFullYear(), [...(m.get(d.getFullYear()) ?? []), p.name]); }
      const ys = [...m.keys()].sort((a, b) => a - b);
      if (!ys.length) return [];
      const out = [] as { label: string; value: number; tip: string[] }[];
      for (let y = Math.max(ys[0], ys[ys.length - 1] - 14); y <= ys[ys.length - 1]; y++) {
        const names = m.get(y) ?? [];
        out.push({ label: String(y), value: names.length, tip: [`${y} · ${names.length}`, ...names.slice(0, 8), ...(names.length > 8 ? [`+${names.length - 8} more`] : [])] });
      }
      return out;
    };
    // Roles (active), every title — same merging as the old "By role" strip (case/space-insensitive).
    const roles = new Map<string, { label: string; names: string[] }>();
    for (const p of active) {
      const label = (p.position || '').trim() || 'Unspecified', k = label.toLowerCase().replace(/\s+/g, ' ');
      const cur = roles.get(k) ?? { label, names: [] }; cur.names.push(p.name); roles.set(k, cur);
    }
    const topRoles = [...roles.values()].sort((a, b) => (a.label === 'Unspecified' ? 1 : b.label === 'Unspecified' ? -1 : b.names.length - a.names.length || a.label.localeCompare(b.label)))
      .map(x => [x.label, x.names] as [string, string[]]);
    // Cost.
    const costRows = (cost?.rows ?? []).filter(c => !c.offboarded && c.cost.entered);
    const ytdByLine = LEDGER_LINES.map(x => ({ key: x.key as LineKey, label: x.key === 'suta' || x.key === 'suta2' ? (x.key === 'suta' ? 'State unemployment' : 'Second state unemployment') : x.label,
      value: Math.round(costRows.reduce((t, c) => t + (c.inputs.ledger?.ytd?.[x.key] ?? 0), 0) * 100) / 100 })).filter(x => x.value > 0)
      .sort((a, b) => b.value - a.value);
    return { year, active, emps, contractors, off, offThisYear: off.filter(p => parseDay(p.offboarded_date)?.getFullYear() === year),
      statusOf, planOf, benefitRows, tenures, bands, startYears: byYear(active, 'start_date'), offYears: byYear(off, 'offboarded_date'),
      topRoles, costRows, ytdByLine,
      costEmployees: (cost?.rows ?? []).filter(c => !c.offboarded && (c.worker_type || 'Employee') !== 'Contractor') };
  }, [data, cost]);

  if (!r) return null;
  return (
    <>
      {node}
        <div className="space-y-5">
          {/* Headline numbers */}
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            <Tile label="Employees" value={r.emps.length} />
            <Tile label="Contractors" value={r.contractors.length} />
            <Tile label={`Offboarded ${r.year}`} value={r.offThisYear.length} sub={`${r.off.length} all time`} />
            <Tile label="Vendors" value={data!.vendors} />
            <Tile label="Average tenure" value={r.tenures.length ? `${(r.tenures.reduce((a, b) => a + b, 0) / r.tenures.length).toFixed(1)} yrs` : '—'} sub={`${r.tenures.length} with a start date`} />
            {cost
              ? <Tile label={`Actual cost ${cost.settings.year}`} value={money(r.costRows.reduce((t, c) => t + c.cost.total, 0))} sub={`entered for ${r.costRows.length} of ${r.costEmployees.length} employees`} />
              : <Tile label="Medical enrolled" value={`${pct(r.benefitRows[0].enrolled, r.emps.length)}%`} sub={`${r.benefitRows[0].enrolled} of ${r.emps.length} employees`} />}
          </div>

          {/* Benefits */}
          <Card title="Benefits enrollment" note={`Employees only (${r.emps.length}) · from the Benefits roster${cost ? '; 401(k) from the cost view' : ''}`}>
            <HBars tipOn={on} max={r.emps.length} items={r.benefitRows.map(b => ({
              label: b.label, value: b.enrolled, text: `${b.enrolled} of ${r.emps.length} · ${pct(b.enrolled, r.emps.length)}%`,
              tip: [b.label, ...STATUSES.filter(s => b.counts[s]).map(s => `${s}: ${b.counts[s]}`), ...(b.counts[''] ? [`Not recorded: ${b.counts['']}`] : [])],
            }))} />
            <div className="overflow-x-auto mt-5 border border-border-light rounded-card">
              <table className="w-full text-sm">
                <thead className="bg-canvas"><tr><th className={th}>Benefit</th>{STATUSES.map(s => <th key={s} className={`${th} text-right`}>{s}</th>)}<th className={`${th} text-right`}>Not recorded</th></tr></thead>
                <tbody>{r.benefitRows.map(b => (
                  <tr key={b.label} className="border-t border-[#f1ece3]"><td className={`${td} font-semibold`}>{b.label}</td>
                    {STATUSES.map(s => <td key={s} className={`${td} text-right tabular-nums ${b.counts[s] ? '' : 'text-text-muted'}`}>{b.counts[s]}</td>)}
                    <td className={`${td} text-right tabular-nums ${b.counts[''] ? 'text-[#b07d2a] font-semibold' : 'text-text-muted'}`}>{b.counts['']}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </Card>

          <Card title="Who’s enrolled" note="✓ enrolled · – declined, waived or not eligible · blank = not recorded">
            <div className="overflow-x-auto border border-border-light rounded-card max-h-[420px]">
              <table className="w-full text-sm">
                <thead className="bg-canvas sticky top-0"><tr><th className={th}>Employee</th><th className={th}>Position</th>
                  {BENEFITS.map(b => <th key={b} className={`${th} text-center`}>{b}</th>)}{cost && <th className={`${th} text-center`}>401(k)</th>}</tr></thead>
                <tbody>{r.emps.map(p => (
                  <tr key={p.id} className="border-t border-[#f1ece3] hover:bg-canvas">
                    <td className={`${td} font-semibold text-text-primary`}>{p.name}</td><td className={`${td} text-text-secondary`}>{p.position || ''}</td>
                    {BENEFITS.map(b => { const s = r.statusOf(p, b); return (
                      <td key={b} title={s || 'Not recorded'} className={`${td} text-center ${s === 'Enrolled' ? 'text-[#2f7d5b] font-bold' : s === 'Pending' ? 'text-[#b07d2a]' : 'text-text-muted'}`}>
                        {s === 'Enrolled' ? '✓' : s === 'Pending' ? 'Pending' : s ? '–' : ''}</td>); })}
                    {cost && (() => { const pl = r.planOf(p); return <td className={`${td} text-center ${pl && pl !== 'none' ? 'text-[#2f7d5b] font-semibold' : 'text-text-muted'}`}>
                      {pl ? (pl === 'none' ? '–' : RETIREMENT_PLANS.find(x => x.key === pl)?.label) : ''}</td>; })()}
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Team by role" note={`Active, employees + contractors (${r.active.length})`}>
              <HBars tipOn={on} max={Math.max(1, ...r.topRoles.map(([, n]) => n.length))} items={r.topRoles.map(([label, names]) => ({
                label, value: names.length, text: String(names.length), tip: [`${label} · ${names.length}`, ...names.slice(0, 10), ...(names.length > 10 ? [`+${names.length - 10} more`] : [])] }))} />
            </Card>
            <Card title="Tenure" note="Active, from start date">
              <HBars tipOn={on} max={Math.max(1, ...r.bands.map(([, f]) => r.tenures.filter(f).length))} items={r.bands.map(([label, f]) => {
                const n = r.tenures.filter(f).length; return { label, value: n, text: String(n), tip: [label, `${n} people · ${pct(n, r.tenures.length)}%`] }; })} />
            </Card>
            <Card title="Start year" note="Active team, by year they started">
              <Columns tipOn={on} items={r.startYears} />
            </Card>
            <Card title="Offboarded by year" note={`${r.off.length} people`}>
              <Columns tipOn={on} items={r.offYears} />
            </Card>
          </div>

          {cost && (
            <>
              <Card title={`Employer cost by type · YTD ${cost.settings.year}`} note="Visible only to Clarizz and Catie · from amounts entered in the cost view">
                {r.ytdByLine.length
                  ? <HBars tipOn={on} max={r.ytdByLine[0].value} items={r.ytdByLine.map(x => ({ label: x.label, value: x.value, text: money(x.value),
                      tip: [x.label, `${money(x.value)} YTD`, `${pct(x.value, r.ytdByLine.reduce((t, y) => t + y.value, 0))}% of employer cost`] }))} />
                  : <p className="text-sm text-text-muted">No YTD amounts entered yet.</p>}
              </Card>
              <Card title={`Actual cost by employee · ${cost.settings.year}`} note={`${r.costRows.length} of ${r.costEmployees.length} employees entered · total uses YTD until a year total is entered`}>
                {r.costRows.length ? (() => {
                  const sorted = [...r.costRows].sort((a, b) => b.cost.total - a.cost.total);
                  return <>
                    <HBars tipOn={on} max={sorted[0].cost.total} items={sorted.map(c => ({ label: c.name, value: c.cost.total, text: money(c.cost.total),
                      tip: [c.name, `Actual cost ${money(c.cost.total)}`, ...(c.inputs.ledger?.checks ? [`${c.inputs.ledger.checks} paychecks in YTD`] : [])] }))} />
                    <div className="overflow-x-auto mt-5 border border-border-light rounded-card">
                      <table className="w-full text-sm">
                        <thead className="bg-canvas"><tr><th className={th}>Employee</th><th className={th}>Position</th><th className={`${th} text-right`}>Employer cost YTD</th><th className={`${th} text-right`}>Actual cost {cost.settings.year}</th></tr></thead>
                        <tbody>
                          {sorted.map(c => { const ytd = LEDGER_LINES.reduce((t, x) => t + (c.inputs.ledger?.ytd?.[x.key] ?? 0), 0); return (
                            <tr key={c.id} className="border-t border-[#f1ece3]"><td className={`${td} font-semibold`}>{c.name}</td><td className={`${td} text-text-secondary`}>{c.position || ''}</td>
                              <td className={`${td} text-right tabular-nums`}>{money(ytd)}</td><td className={`${td} text-right tabular-nums font-semibold`}>{money(c.cost.total)}</td></tr>); })}
                          <tr className="border-t-2 border-text-primary bg-canvas font-bold"><td className={td}>Total</td><td className={td} />
                            <td className={`${td} text-right tabular-nums`}>{money(sorted.reduce((t, c) => t + LEDGER_LINES.reduce((s, x) => s + (c.inputs.ledger?.ytd?.[x.key] ?? 0), 0), 0))}</td>
                            <td className={`${td} text-right tabular-nums`}>{money(sorted.reduce((t, c) => t + c.cost.total, 0))}</td></tr>
                        </tbody>
                      </table>
                    </div>
                  </>;
                })() : <p className="text-sm text-text-muted">No amounts entered yet.</p>}
              </Card>
            </>
          )}
        </div>
    </>
  );
}

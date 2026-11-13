'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { styledSheet, downloadWorkbook } from '@/lib/xlsxStyle';
import { CostModal, type CostRow } from '@/components/ActualCost';
import { LEDGER_LINES, DEFAULT_STATE, stateName, type CostSettings, type LineKey } from '@/lib/actualCost';

// Reports: headcount, tenure, benefits enrollment (who's on what) and — for the cost viewers
// only — employer cost. Opened from Staffing and Employee Files. Charts are plain HTML bars in one
// hue (every chart here is a single series), each with a hover tooltip and a table underneath.

const BAR = '#2a78d6';      // data hue (single series)
const TRACK = '#edf1f6';    // unfilled part of a bar
const BENEFITS = ['Medical', 'Dental', 'Vision', 'Life', 'Malpractice', '401(k)'] as const;
const STATUSES = ['Enrolled', 'Pending', 'Declined', 'Waived', 'Not eligible'] as const;

const norm = (s: any) => String(s ?? '').normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().toLowerCase();
function parseDay(v: any): Date | null {
  const s = String(v ?? '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
  if (m) { let y = +m[3]; if (y < 100) y += y < 50 ? 2000 : 1900; return new Date(y, +m[1] - 1, +m[2]); }
  // Free text like "April 31, 2026" or "Offboarded - Last day of work Jan 5, 2025".
  m = s.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/i);
  if (m) { const mo = 'janfebmaraprmayjunjulaugsepoctnovdec'.indexOf(m[1].toLowerCase()) / 3; return new Date(+m[3], mo, Math.min(+m[2], new Date(+m[3], mo + 1, 0).getDate())); }
  m = s.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/) || s.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (m) return m[1].length === 4 ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(+m[3], +m[1] - 1, +m[2]);
  return null;
}
const fmtDay = (d: Date | null) => (d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');
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
        <div key={it.label} {...tipOn(it.tip)} className="grid grid-cols-[minmax(90px,220px)_1fr_auto] items-center gap-3 py-1 rounded hover:bg-canvas px-1 -mx-1 cursor-default">
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
    // 401(k): yes when the Benefits roster says Enrolled OR an employer 401(k) match is entered in the
    // cost view (cost viewers only). `conflict` = the roster says otherwise than the cost entries.
    const matchEntered = (p: Person) => { const L = costByName.get(norm(p.name))?.inputs.ledger; if (!L) return false;
      return (['check', 'ytd', 'total'] as const).some(c => (L[c]?.match ?? 0) > 0 || (L[c]?.catchupMatch ?? 0) > 0); };
    const k401 = (p: Person) => {
      const roster = statusOf(p, '401(k)'), fromCost = !!cost && matchEntered(p);
      const yes = roster === 'Enrolled' || fromCost;
      // Only flag people whose cost has been entered — otherwise a missing match just means "not entered yet".
      const costEntered = !!costByName.get(norm(p.name))?.cost.entered;
      const conflict = !!cost && costEntered && !!roster && roster !== 'Pending' && (roster === 'Enrolled') !== fromCost;
      return { yes, roster, fromCost, conflict };
    };
    const statusFor = (p: Person, b: string) => (b === '401(k)' && k401(p).fromCost ? 'Enrolled' : statusOf(p, b));
    const benefitRows = [...BENEFITS.map(b => {
      const counts: Record<string, number> = Object.fromEntries([...STATUSES, ''].map(s => [s, 0]));
      for (const p of emps) { const s = statusFor(p, b); counts[(STATUSES as readonly string[]).includes(s) ? s : '']++; }
      return { label: b, counts, enrolled: counts.Enrolled };
    })];
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
    // YTD by cost line; unemployment (SUI) split by state — the person's state for the main SUI line,
    // their second state for the second line. `who` = names behind each bar (for the tooltip).
    const byLine = new Map<string, { label: string; value: number; who: string[] }>();
    const add = (k: string, label: string, n: number, who: string) => {
      if (!n) return; const cur = byLine.get(k) ?? { label, value: 0, who: [] };
      cur.value = Math.round((cur.value + n) * 100) / 100; cur.who.push(who); byLine.set(k, cur);
    };
    for (const c of costRows) for (const x of LEDGER_LINES) {
      const n = c.inputs.ledger?.ytd?.[x.key] ?? 0;
      if (x.key === 'suta' || x.key === 'suta2') {
        const code = (x.key === 'suta' ? c.inputs.workState : c.inputs.workState2) || DEFAULT_STATE;
        add('sui-' + code, `${stateName(code)} unemployment`, n, c.name);
      } else add(x.key, x.label, n, c.name);
    }
    const ytdByLine = [...byLine.values()].sort((a, b) => b.value - a.value);
    return { year, active, emps, contractors, off, offThisYear: off.filter(p => parseDay(p.offboarded_date)?.getFullYear() === year),
      statusOf, k401, benefitRows, tenures, bands, startYears: byYear(active, 'start_date'), offYears: byYear(off, 'offboarded_date'),
      topRoles, costRows, ytdByLine, offUndated: off.filter(p => !parseDay(p.offboarded_date)).length,
      costEmployees: (cost?.rows ?? []).filter(c => !c.offboarded && (c.worker_type || 'Employee') !== 'Contractor') };
  }, [data, cost]);

  const box = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState('');
  if (!r) return null;
  const today = new Date().toISOString().slice(0, 10);
  const timeAt = (p: Person) => {
    const s0 = parseDay(p.start_date), e0 = parseDay(p.offboarded_date);
    const yrs = s0 && e0 && e0 >= s0 ? (e0.getTime() - s0.getTime()) / (365.25 * 864e5) : null;
    return yrs == null ? '' : yrs < 1 ? `${Math.max(1, Math.round(yrs * 12))} mo` : `${yrs.toFixed(1)} yrs`;
  };
  const offSorted = [...r.off].sort((a, b) => (parseDay(b.offboarded_date)?.getTime() ?? 0) - (parseDay(a.offboarded_date)?.getTime() ?? 0));
  const costSorted = [...r.costRows].sort((a, b) => b.cost.total - a.cost.total);
  const ytdOf = (c: CostRow) => Math.round(LEDGER_LINES.reduce((t, x) => t + (c.inputs.ledger?.ytd?.[x.key] ?? 0), 0) * 100) / 100;

  // Excel: one formatted tab per section (cost tabs only for the cost viewers).
  async function exportExcel() {
    setBusy('excel');
    try {
      const X: any = await import('xlsx-js-style');
      const R = r!;
      const sheets: [string, any][] = [];
      const summary: [string, string | number][] = [['Employees', R.emps.length], ['Contractors', R.contractors.length], [`Offboarded ${R.year}`, R.offThisYear.length],
        ['Offboarded (all time)', R.off.length], ['Vendors', data.vendors],
        ['Average tenure (years)', R.tenures.length ? Number((R.tenures.reduce((a, b) => a + b, 0) / R.tenures.length).toFixed(1)) : ''],
        ...BENEFITS.map(b => [`${b} enrolled`, `${R.benefitRows.find(x => x.label === b)?.enrolled ?? 0} of ${R.emps.length}`] as [string, string]),
        ...(cost ? [[`Actual cost ${cost.settings.year}`, money(R.costRows.reduce((t, c) => t + c.cost.total, 0))], ['Employees with cost entered', `${R.costRows.length} of ${R.costEmployees.length}`]] as [string, string][] : [])];
      sheets.push(['Summary', styledSheet(X, { headers: ['Measure', 'Value'], rows: summary, widths: [32, 22] })]);
      sheets.push(['Benefits', styledSheet(X, { headers: ['Benefit', ...STATUSES, 'Not recorded', '% enrolled'], widths: [16, 11, 11, 11, 11, 13, 14, 12],
        rows: R.benefitRows.map(b => [b.label, ...STATUSES.map(s => b.counts[s]), b.counts[''], `${pct(b.enrolled, R.emps.length)}%`]) })]);
      sheets.push(['Enrollment by person', styledSheet(X, { headers: ['Employee', 'Position', ...BENEFITS], widths: [24, 28, ...BENEFITS.map(() => 14)],
        rows: R.emps.map(p => [p.name, p.position || '', ...BENEFITS.map(b => (b === '401(k)' ? (R.k401(p).yes ? 'Yes' : 'No') : R.statusOf(p, b) || 'Not recorded'))]) })]);
      sheets.push(['Team by role', styledSheet(X, { headers: ['Role', 'People', 'Names'], widths: [32, 9, 80], rows: R.topRoles.map(([l, n]) => [l, n.length, n.join(', ')]) })]);
      sheets.push(['Tenure', styledSheet(X, { headers: ['Tenure', 'People'], widths: [18, 10], rows: R.bands.map(([l, f]) => [l, R.tenures.filter(f).length]) })]);
      sheets.push(['Start year', styledSheet(X, { headers: ['Year', 'People', 'Names'], widths: [10, 9, 80], rows: R.startYears.map(y => [y.label, y.value, y.tip.slice(1).join(', ')]) })]);
      sheets.push(['Offboarded', styledSheet(X, { headers: ['Name', 'Position', 'Type', 'Start date', 'Last day', 'Time at Litson'], widths: [24, 30, 12, 14, 16, 14],
        rows: offSorted.map(p => [p.name, p.position || '', p.worker_type || 'Employee', fmtDay(parseDay(p.start_date)), fmtDay(parseDay(p.offboarded_date)) || 'Not recorded', timeAt(p)]) })]);
      if (cost) {
        sheets.push(['Employer cost by type', styledSheet(X, { headers: ['Type', `YTD ${cost.settings.year}`, 'People'], widths: [32, 18, 80], totals: true, money: i => i === 1,
          rows: R.ytdByLine.map(x => [x.label, x.value, x.who.join(', ')]) })]);
        sheets.push(['Actual cost by employee', styledSheet(X, { headers: ['Employee', 'Position', 'Employer cost YTD', `Actual cost ${cost.settings.year}`], widths: [26, 32, 22, 22], totals: true, money: i => i >= 2,
          rows: costSorted.map(c => [c.name, c.position || '', ytdOf(c), c.cost.total]) })]);
      }
      downloadWorkbook(X, sheets, `Litson-Reports-${today}.xlsx`);
    } finally { setBusy(''); }
  }

  // PDF: print the report as shown (charts included) from a clean window → "Save as PDF".
  function exportPdf() {
    const el = box.current; if (!el) return;
    const w = window.open('', '_blank'); if (!w) return;
    const css = [...document.querySelectorAll('style, link[rel="stylesheet"]')].map(n => n.outerHTML).join('');
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Litson Reports ${today}</title>${css}
      <style>body{background:#fff;padding:24px;-webkit-print-color-adjust:exact;print-color-adjust:exact}.no-print{display:none!important}
      .max-h-\\[420px\\]{max-height:none!important;overflow:visible!important}section{break-inside:avoid}@page{size:letter landscape;margin:12mm}</style></head>
      <body><h1 style="font-family:Spectral,serif;font-size:22px;font-weight:600;margin:0 0 4px">Litson Reports</h1>
      <p style="font-size:12px;color:#8b8478;margin:0 0 16px">${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>${el.outerHTML}</body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 600);
  }

  return (
    <>
      {node}
      <div className="flex justify-end gap-2 mb-4 no-print">
        <button onClick={exportPdf} className="bg-white border border-border-light text-ink text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-canvas" title="Print or save the report as a PDF">⬇ PDF</button>
        <button onClick={exportExcel} disabled={!!busy} className="bg-white border border-border-light text-ink text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-canvas disabled:opacity-50" title="Every chart and table as Excel tabs">{busy ? 'Exporting…' : '⬇ Excel'}</button>
      </div>
        <div ref={box} className="space-y-5">
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
          <Card title="Benefits enrollment" note={`Employees only (${r.emps.length}) · from the Benefits roster${cost ? '; 401(k) also counts an employer match entered in cost' : ''}`}>
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

          <Card title="Who’s enrolled" note={`✓ enrolled · – declined, waived or not eligible · blank = not recorded${cost ? ' · 401(k): ✓ from the roster or an employer match in cost; ⚠ = they disagree' : ''}`}>
            <div className="overflow-x-auto border border-border-light rounded-card max-h-[420px]">
              <table className="w-full text-sm">
                <thead className="bg-canvas sticky top-0"><tr><th className={th}>Employee</th><th className={th}>Position</th>
                  {BENEFITS.map(b => <th key={b} className={`${th} text-center`}>{b}</th>)}</tr></thead>
                <tbody>{r.emps.map(p => (
                  <tr key={p.id} className="border-t border-[#f1ece3] hover:bg-canvas">
                    <td className={`${td} font-semibold text-text-primary`}>{p.name}</td><td className={`${td} text-text-secondary`}>{p.position || ''}</td>
                    {BENEFITS.map(b => { if (b === '401(k)') { const k = r.k401(p); return (
                      <td key={b} className={`${td} text-center ${k.yes ? 'text-[#2f7d5b] font-bold' : 'text-text-muted'}`}
                        title={k.conflict ? `Check: Benefits roster says ${k.roster || 'not recorded'}, but ${k.fromCost ? 'an employer 401(k) match is entered in cost' : 'no employer 401(k) match is entered in cost'}`
                          : k.fromCost && !k.roster ? 'Employer 401(k) match entered in cost; not on the Benefits roster yet' : k.roster || (k.yes ? 'Enrolled' : 'No 401(k)')}>
                        {k.yes ? '✓' : '–'}{(k.conflict || (k.fromCost && !k.roster)) && <span className="ml-1 text-[#b07d2a]">{k.conflict ? '⚠' : '•'}</span>}</td>); }
                      const s = r.statusOf(p, b); return (
                      <td key={b} title={s || 'Not recorded'} className={`${td} text-center ${s === 'Enrolled' ? 'text-[#2f7d5b] font-bold' : s === 'Pending' ? 'text-[#b07d2a]' : 'text-text-muted'}`}>
                        {s === 'Enrolled' ? '✓' : s === 'Pending' ? 'Pending' : s ? '–' : ''}</td>); })}
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
            <Card title="Offboarded by year" note={`${r.off.length} people${r.offUndated ? ` · ${r.offUndated} without a last-day date` : ''}`}>
              <Columns tipOn={on} items={r.offYears} />
            </Card>
          </div>

          <Card title="Offboarded" note={`${r.off.length} people · most recent first`}>
            {r.off.length ? (
              <div className="overflow-x-auto border border-border-light rounded-card">
                <table className="w-full text-sm">
                  <thead className="bg-canvas"><tr><th className={th}>Name</th><th className={th}>Position</th><th className={th}>Type</th><th className={th}>Start date</th><th className={th}>Last day</th><th className={`${th} text-right`}>Time at Litson</th></tr></thead>
                  <tbody>{[...r.off].sort((a, b) => (parseDay(b.offboarded_date)?.getTime() ?? 0) - (parseDay(a.offboarded_date)?.getTime() ?? 0)).map(p => {
                    const s0 = parseDay(p.start_date), e0 = parseDay(p.offboarded_date);
                    const yrs = s0 && e0 && e0 >= s0 ? (e0.getTime() - s0.getTime()) / (365.25 * 864e5) : null;
                    const raw = String(p.offboarded_date ?? '').trim();
                    return (
                      <tr key={p.id} className="border-t border-[#f1ece3] hover:bg-canvas">
                        <td className={`${td} font-semibold text-text-primary`}>{p.name}</td><td className={`${td} text-text-secondary`}>{p.position || ''}</td>
                        <td className={`${td} text-text-secondary`}>{p.worker_type || 'Employee'}</td><td className={`${td} tabular-nums`}>{fmtDay(s0)}</td>
                        <td className={`${td} tabular-nums`} title={raw}>{e0 ? fmtDay(e0) : <span className="text-[#b07d2a]">Not recorded</span>}</td>
                        <td className={`${td} text-right tabular-nums`}>{yrs == null ? '—' : yrs < 1 ? `${Math.max(1, Math.round(yrs * 12))} mo` : `${yrs.toFixed(1)} yrs`}</td>
                      </tr>); })}</tbody>
                </table>
              </div>
            ) : <p className="text-sm text-text-muted">No one offboarded.</p>}
          </Card>

          {cost && (
            <>
              <Card title={`Employer cost by type · YTD ${cost.settings.year}`} note="Visible only to Clarizz and Catie · from amounts entered in the cost view">
                {r.ytdByLine.length
                  ? <HBars tipOn={on} max={r.ytdByLine[0].value} items={r.ytdByLine.map(x => ({ label: x.label, value: x.value, text: money(x.value),
                      tip: [x.label, `${money(x.value)} YTD · ${pct(x.value, r.ytdByLine.reduce((t, y) => t + y.value, 0))}% of employer cost`, `${x.who.length} ${x.who.length === 1 ? 'person' : 'people'}`, ...x.who.slice(0, 8), ...(x.who.length > 8 ? [`+${x.who.length - 8} more`] : [])] }))} />
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

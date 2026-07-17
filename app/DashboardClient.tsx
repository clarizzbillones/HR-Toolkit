'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import EodModal from '@/components/EodModal';

interface Props {
  pendingCount: number;
  doneCount: number;
  dueToday: number;
  ptoToday: number;
  payrollDaysLeft: number | null;
  cutoffToday: boolean;
  nextPayrollDate: string | null;
  payrollSchedule: string | null;
  empCount: number;
  reviewsDone: number;
  onboarding: number;
  birthdays: { name: string; dob: string }[];
  anniversaries: { name: string; years: number; date: string }[];
  deadlines: { label: string; date: string; days: number; kind: string }[];
}

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function greeting(name: string) {
  const h = new Date().getHours();
  const salute = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const first = name.split(' ')[0];
  return `${salute}, ${first}`;
}

const modules = [
  {
    href: '/tasks', label: 'Open HR Tasks',
    icon: <TaskIcon />, iconBg: 'bg-[#e8f0f8]', iconColor: 'text-[#3f6b8a]',
    descFn: (p: Props) => `${p.pendingCount} pending · ${p.doneCount} completed today.`,
    badgeFn: (p: Props) => p.dueToday > 0 ? `${p.dueToday} due today` : null, badgeColor: '#b0412f',
  },
  {
    href: '/pto', label: 'PTO Reports',
    icon: <PtoIcon />, iconBg: 'bg-[#eef5f1]', iconColor: 'text-[#2f7d5b]',
    descFn: () => 'Generate a report from uploaded CSV/XLSX documents.',
    badgeFn: (p: Props) => p.ptoToday > 0 ? `${p.ptoToday} out today` : null, badgeColor: '#b07d2a',
  },
  {
    href: '/offers', label: 'Offer Letters',
    icon: <OfferIcon />, iconBg: 'bg-[#f0edf8]', iconColor: 'text-[#6b5b8a]',
    descFn: () => 'Draft from your firm template — AI fills the details you enter.',
    badgeFn: () => null,
  },
  {
    href: '/sop', label: 'SOP Builder',
    icon: <SopIcon />, iconBg: 'bg-[#fdf3e8]', iconColor: 'text-[#b07d2a]',
    descFn: () => 'Generate standard operating procedures with AI.',
    badgeFn: () => null,
  },
  {
    href: '/payroll', label: 'Payroll',
    icon: <PayrollIcon />, iconBg: 'bg-[#eef5f1]', iconColor: 'text-[#2f7d5b]',
    descFn: (p: Props) => p.nextPayrollDate ? `${p.payrollSchedule ?? 'Payroll'}. Next run ${fmtDate(p.nextPayrollDate)}.` : 'No upcoming payroll periods.',
    badgeFn: (p: Props) => p.cutoffToday ? 'Cutoff today' : null, badgeColor: '#b07d2a',
  },
  {
    href: '/pto', label: 'Outlook Calendar',
    icon: <CalIcon />, iconBg: 'bg-[#e8f0f8]', iconColor: 'text-[#3f6b8a]',
    descFn: () => 'Connect Litson Availability — combined with PTO report.',
    badgeFn: () => null,
  },
  {
    href: '/trips', label: 'Trip Help Desk',
    icon: <TripIcon />, iconBg: 'bg-[#fdeaea]', iconColor: 'text-[#b0412f]',
    descFn: () => 'Travel requests from attorneys and staff.',
    badgeFn: () => null,
  },
  {
    href: '/reviews', label: 'Performance Reviews',
    icon: <ReviewIcon />, iconBg: 'bg-[#fdf3e8]', iconColor: 'text-[#b07d2a]',
    descFn: (p: Props) => `Q2 cycle — ${p.reviewsDone} of ${p.empCount} reviews complete.`,
    badgeFn: (p: Props) => p.empCount - p.reviewsDone > 0 ? `${p.empCount - p.reviewsDone} remaining` : 'All complete',
    badgeColor: '#5b6473',
  },
  {
    href: '/onboarding', label: 'Onboarding',
    icon: <OfferIcon />, iconBg: 'bg-[#fdf3e8]', iconColor: 'text-[#b07d2a]',
    descFn: (p: Props) => p.onboarding > 0 ? `${p.onboarding} new hire${p.onboarding > 1 ? 's' : ''} in progress.` : 'Add a new hire and track their setup.',
    badgeFn: (p: Props) => p.onboarding > 0 ? `${p.onboarding} in progress` : null, badgeColor: '#c9a24a',
  },
  {
    href: '/reports', label: 'Reports',
    icon: <ReportsIcon />, iconBg: 'bg-[#f0edf8]', iconColor: 'text-[#6b5b8a]',
    descFn: () => 'Monthly packs, insurance invoices, reimbursements, cash-out ledger.',
    badgeFn: () => null,
  },
  {
    href: '/design', label: 'Graphic Design',
    icon: <DesignIcon />, iconBg: 'bg-[#fdeaea]', iconColor: 'text-[#b0412f]',
    descFn: () => 'Generate birthday and work anniversary greeting images.',
    badgeFn: () => null,
  },
];

export default function DashboardClient(props: Props) {
  const { data: session } = useSession();
  const [showEod, setShowEod] = useState(false);
  const [ptoToday, setPtoToday] = useState<number>(props.ptoToday);
  const [ptoNames, setPtoNames] = useState<string[]>([]);
  const [overrideDate, setOverrideDate] = useState('');

  const activeDate = overrideDate || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });

  useEffect(() => {
    fetch(`/api/pto/today?date=${activeDate}`).then(r => r.json()).then(d => {
      if (typeof d.count === 'number') setPtoToday(d.count);
      if (Array.isArray(d.names)) setPtoNames(d.names);
    }).catch(() => {});
  }, [activeDate]);
  const userName = session?.user?.name ?? 'there';
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <header className="flex items-center px-8 py-5 bg-white border-b border-border flex-shrink-0">
        <div>
          <h1 className="font-spectral text-[24px] font-semibold text-text-primary">{greeting(userName)}</h1>
          <p className="text-sm text-text-muted mt-0.5">{today} · {props.empCount} employees</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-text-muted font-semibold">Date</span>
            <input type="date" value={overrideDate} onChange={e => setOverrideDate(e.target.value)}
              className="border border-border-light rounded-ctrl px-2.5 py-2 text-sm bg-white focus:outline-none focus:border-ink" />
            {overrideDate && <button onClick={() => setOverrideDate('')} className="text-xs text-text-muted hover:text-text-primary font-semibold">Today</button>}
          </div>
          <div className="flex items-center gap-2 bg-canvas border border-border rounded-ctrl px-4 py-2.5 w-56 text-text-faint text-sm">
            <SearchIcon /> Search people, tasks…
          </div>
          <button
            onClick={() => setShowEod(true)}
            className="bg-ink text-white text-sm font-semibold px-4 py-2.5 rounded-ctrl hover:bg-ink-dark transition-colors"
          >
            Generate EOD Report
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-8">
        {/* KPI strip — boxes flash red when a deadline is almost missed (≤3 days / overdue) */}
        {(() => {
          const payrollDays = props.payrollDaysLeft;
          const payrollUrgent = payrollDays !== null && payrollDays <= 3;
          const reviewDeadline = props.deadlines.filter(d => d.kind === 'review').map(d => d.days).sort((a, b) => a - b)[0];
          const reviewUrgent = reviewDeadline !== undefined && reviewDeadline <= 3;
          const urgencyText = (d: number) => d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? 'due today!' : d === 1 ? 'due tomorrow!' : `${d} days left`;
          return (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <KpiCard
            label="Open Tasks" value={props.pendingCount}
            sub={props.dueToday > 0 ? `${props.dueToday} due today` : 'none due today'}
            subColor={props.dueToday > 0 ? '#b0412f' : undefined}
            accent="#3f6b8a" href="/tasks"
          />
          <KpiCard
            label="PTO Today" value={ptoToday}
            sub={ptoNames.length ? ptoNames.join(', ') : 'out of office'}
            accent="#2f7d5b" href="/pto"
          />
          <KpiCard
            label={props.payrollSchedule ? `Next Payroll · ${props.payrollSchedule}` : 'Next Payroll'}
            value={props.payrollDaysLeft !== null ? `${props.payrollDaysLeft}d` : '—'}
            sub={payrollDays === null ? 'no payroll to run'
              : payrollUrgent ? `⚠ deadline ${urgencyText(payrollDays)}`
              : `until ${props.payrollSchedule ? props.payrollSchedule.toLowerCase() + ' ' : ''}deadline`}
            subColor={payrollUrgent ? '#b0412f' : props.cutoffToday ? '#b07d2a' : undefined}
            accent="#b07d2a" href="/payroll" urgent={payrollUrgent}
          />
          <KpiCard
            label="Reviews" value={`${props.reviewsDone}/${props.empCount}`}
            sub={reviewUrgent && reviewDeadline !== undefined ? `⚠ review ${urgencyText(reviewDeadline)}` : 'complete this cycle'}
            subColor={reviewUrgent ? '#b0412f' : undefined}
            accent="#6b5b8a" href="/reviews" urgent={reviewUrgent}
          />
        </div>
          );
        })()}

        {/* Upcoming birthdays & anniversaries (this month) */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white border border-border rounded-card p-5" style={{ borderTop: '3px solid #c9a24a' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-bold tracking-widest uppercase text-[#8a6d3b]">🎂 Birthdays this month</div>
              <a href="/reports" className="text-xs font-semibold text-[#8a6d3b] hover:underline">Monthly pack ↗</a>
            </div>
            {props.birthdays.length ? (
              <div className="flex flex-wrap gap-2">
                {props.birthdays.map((b, i) => (
                  <div key={i} className="border border-border-light rounded-ctrl px-3 py-1.5 text-sm">
                    <span className="font-semibold text-text-primary">{b.name}</span>
                    <span className="text-text-muted text-xs ml-1.5">{b.dob}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-text-muted">None this month.</p>}
          </div>
          <div className="bg-white border border-border rounded-card p-5" style={{ borderTop: '3px solid #8a6d3b' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-bold tracking-widest uppercase text-[#6b5427]">🎉 Work anniversaries this month</div>
              <a href="/reports" className="text-xs font-semibold text-[#6b5427] hover:underline">Monthly pack ↗</a>
            </div>
            {props.anniversaries.length ? (
              <div className="flex flex-wrap gap-2">
                {props.anniversaries.map((a, i) => (
                  <div key={i} className="border border-border-light rounded-ctrl px-3 py-1.5 text-sm">
                    <span className="font-semibold text-text-primary">{a.name}</span>
                    <span className="text-text-muted text-xs ml-1.5">{a.years} {a.years === 1 ? 'yr' : 'yrs'} · {a.date}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-text-muted">None this month.</p>}
          </div>
        </div>

        {/* Module grid */}
        <div className="text-xs font-bold tracking-widest uppercase text-gold-muted mb-3.5">Modules</div>
        <div className="grid grid-cols-3 gap-4">
          {modules.map((mod) => {
            const badge = mod.badgeFn(props);
            return (
              <Link
                key={mod.href}
                href={mod.href}
                className="bg-white border border-border rounded-card p-5 flex flex-col gap-3 min-h-[132px] hover:shadow-card hover:border-[#d0c8b8] transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-[10px] ${mod.iconBg} ${mod.iconColor} flex items-center justify-center flex-shrink-0`}>
                    {mod.icon}
                  </div>
                  <div className="font-semibold text-[15px] text-text-primary group-hover:text-ink transition-colors">{mod.label}</div>
                </div>
                <div className="text-sm text-text-secondary leading-snug flex-1">{mod.descFn(props)}</div>
                {badge && (
                  <div className="text-xs font-semibold" style={{ color: mod.badgeColor ?? '#5b6473' }}>
                    {badge}
                  </div>
                )}
              </Link>
            );
          })}
        </div>

        {/* EOD bar */}
        <button
          onClick={() => setShowEod(true)}
          className="mt-5 w-full bg-ink rounded-card px-6 py-5 flex items-center gap-5 hover:bg-[#1e2b3e] transition-colors text-left"
        >
          <div className="w-10 h-10 rounded-[10px] bg-white/10 flex items-center justify-center flex-shrink-0">
            <EodIcon />
          </div>
          <div className="flex-1">
            <div className="font-spectral text-[17px] font-semibold text-white">End-of-Day Report</div>
            <div className="text-sm text-[#9aa6b6] mt-0.5">
              {props.doneCount} tasks done · {props.pendingCount} pending · {ptoToday} on PTO — ready to compile.
            </div>
          </div>
          <div className="bg-gold text-ink font-bold text-sm px-5 py-2.5 rounded-ctrl flex-shrink-0 whitespace-nowrap">
            Compile Report →
          </div>
        </button>
      </div>

      {showEod && <EodModal onClose={() => setShowEod(false)} />}
    </div>
  );
}

function KpiCard({ label, value, sub, subColor, accent, href, urgent }: {
  label: string; value: string | number; sub: string; subColor?: string; accent: string; href: string; urgent?: boolean;
}) {
  const c = urgent ? '#b0412f' : accent;
  return (
    <Link href={href}
      className={`rounded-card p-5 hover:shadow-lg transition-all block group relative overflow-hidden ${urgent ? 'ring-2 ring-[#b0412f]' : ''}`}
      style={{ background: '#fff', border: `1px solid ${c}33`, borderTop: `4px solid ${c}`, boxShadow: urgent ? '0 2px 10px #b0412f33' : `0 1px 3px ${accent}1a` }}>
      <div className="absolute inset-0 pointer-events-none" style={{ background: c, opacity: urgent ? 0.09 : 0.05 }} />
      <div className="relative flex items-center justify-between mb-1">
        <div className="text-[11px] uppercase tracking-widest font-bold" style={{ color: c }}>{label}</div>
        <span className={`w-2.5 h-2.5 rounded-full ${urgent ? 'animate-pulse' : ''}`} style={{ background: c }} />
      </div>
      <div className="relative font-spectral text-[42px] font-bold leading-none mt-2" style={{ color: c }}>
        {value}
      </div>
      <div className="relative text-xs mt-2.5 font-semibold" style={{ color: subColor ?? '#6b6355' }}>{sub}</div>
    </Link>
  );
}

function SearchIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/></svg>; }
function TaskIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="4" y="4" width="16" height="16" rx="2"/><polyline points="8 12 11 15 16 9"/></svg>; }
function PtoIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="5" y="3" width="14" height="18" rx="2"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="13" y2="16"/></svg>; }
function OfferIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="5" width="18" height="14" rx="2"/><polyline points="3 7 12 13 21 7"/></svg>; }
function SopIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><line x1="5" y1="7" x2="19" y2="7"/><line x1="5" y1="12" x2="19" y2="12"/><line x1="5" y1="17" x2="14" y2="17"/></svg>; }
function PayrollIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10.5h4a1.6 1.6 0 0 1 0 3.2h-3a1.6 1.6 0 0 0 0 3.2h4"/></svg>; }
function CalIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="4" y="5" width="16" height="15" rx="2"/><line x1="4" y1="9" x2="20" y2="9"/><line x1="9" y1="3" x2="9" y2="7"/><line x1="15" y1="3" x2="15" y2="7"/></svg>; }
function TripIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 21s-6-5.2-6-10a6 6 0 0 1 12 0c0 4.8-6 10-6 10z"/><circle cx="12" cy="11" r="2.2"/></svg>; }
function ReviewIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><line x1="6" y1="20" x2="6" y2="13"/><line x1="12" y1="20" x2="12" y2="8"/><line x1="18" y1="20" x2="18" y2="11"/></svg>; }
function ReportsIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M6 2h8l4 4v16H6z"/><polyline points="14 2 14 6 18 6"/><line x1="8" y1="10" x2="15" y2="10"/><line x1="8" y1="14" x2="13" y2="14"/></svg>; }
function DesignIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 2a10 10 0 1 0 0 20"/><path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>; }
function EodIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.7"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>; }

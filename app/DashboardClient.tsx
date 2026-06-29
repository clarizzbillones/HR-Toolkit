'use client';
import Link from 'next/link';
import { useState } from 'react';
import EodModal from '@/components/EodModal';

interface Props {
  pendingCount: number;
  doneCount: number;
  dueToday: number;
  ptoToday: number;
  payrollDaysLeft: number | null;
  cutoffToday: boolean;
  nextPayrollDate: string | null;
  empCount: number;
  reviewsDone: number;
}

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

const modules = [
  { href: '/tasks', label: 'Open HR Tasks', icon: <TaskIcon />, descFn: (p: Props) => `${p.pendingCount} pending · ${p.doneCount} completed today. Roll into your End-of-Day report.`, badgeFn: (p: Props) => p.dueToday > 0 ? `${p.dueToday} due today` : null, badgeColor: '#b0412f' },
  { href: '/pto', label: 'PTO Reports', icon: <PtoIcon />, descFn: () => 'Generate a report from uploaded CSV/XLSX documents.', badgeFn: (p: Props) => `${p.ptoToday} out today`, badgeColor: '#b07d2a' },
  { href: '/offers', label: 'Offer Letters', icon: <OfferIcon />, descFn: () => 'Draft from your firm template — AI fills the details you enter.', badgeFn: () => null },
  { href: '/sop', label: 'SOP Builder', icon: <SopIcon />, descFn: () => 'Build SOPs on your standard Litson template.', badgeFn: () => null },
  { href: '/payroll', label: 'Payroll', icon: <PayrollIcon />, descFn: (p: Props) => p.nextPayrollDate ? `Semi-monthly. Next run ${fmtDate(p.nextPayrollDate)}.` : 'No upcoming payroll periods.', badgeFn: (p: Props) => p.cutoffToday ? 'Cutoff today' : null, badgeColor: '#b07d2a' },
  { href: '/calendar', label: 'Outlook Calendar', icon: <CalIcon />, descFn: () => 'Sync PTO with the shared Outlook firm calendar.', badgeFn: () => null },
  { href: '/trips', label: 'Trip Help Desk', icon: <TripIcon />, descFn: () => 'Travel requests from attorneys and staff.', badgeFn: () => null },
  { href: '/reviews', label: 'Performance Reviews', icon: <ReviewIcon />, descFn: (p: Props) => `Q2 cycle in progress — ${p.reviewsDone} of ${p.empCount} reviews complete.`, badgeFn: (p: Props) => `${p.empCount - p.reviewsDone} remaining`, badgeColor: '#5b6473' },
  { href: '/reports', label: 'Reports', icon: <ReportsIcon />, descFn: () => 'Monthly packs, insurance invoices, reimbursements, cash-out ledger.', badgeFn: () => null },
  { href: '/design', label: 'Graphic Design', icon: <DesignIcon />, descFn: () => 'Generate birthday and work anniversary greeting images.', badgeFn: () => null },
];

export default function DashboardClient(props: Props) {
  const [showEod, setShowEod] = useState(false);
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <header className="flex items-center px-8 py-5 bg-white border-b border-border flex-shrink-0">
        <div>
          <h1 className="font-spectral text-[23px] font-semibold text-text-primary">Good morning, Renee</h1>
          <p className="text-sm text-text-muted mt-0.5">{today} · {props.empCount} employees</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
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
        {/* KPI strip */}
        <div className="grid grid-cols-4 gap-3.5 mb-5">
          <KpiCard label="Open Tasks" value={props.pendingCount} sub={`${props.dueToday} due today`} subColor="#b0412f" href="/tasks" />
          <KpiCard label="PTO Today" value={props.ptoToday} sub="out of office" href="/calendar" />
          <KpiCard
            label="Next Payroll"
            value={props.payrollDaysLeft !== null ? `${props.payrollDaysLeft}d` : '—'}
            sub={props.cutoffToday ? 'cutoff today' : 'days away'}
            subColor={props.cutoffToday ? '#b07d2a' : undefined}
            href="/payroll"
          />
          <KpiCard label="Reviews" value={`${props.reviewsDone}/${props.empCount}`} sub="complete" href="/reviews" />
        </div>

        {/* Module grid */}
        <div className="text-xs font-bold tracking-widest uppercase text-gold-muted mb-3">Modules</div>
        <div className="grid grid-cols-3 gap-3.5">
          {modules.map((mod) => {
            const badge = mod.badgeFn(props);
            return (
              <Link
                key={mod.href}
                href={mod.href}
                className="bg-white border border-border rounded-card p-4.5 flex flex-col gap-2.5 min-h-[128px] hover:shadow-card transition-shadow group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-[9px] bg-[#eef1f0] flex items-center justify-center flex-shrink-0 text-ink">
                    {mod.icon}
                  </div>
                  <div className="font-semibold text-[15px] text-text-primary">{mod.label}</div>
                </div>
                <div className="text-sm text-text-secondary leading-snug">{mod.descFn(props)}</div>
                {badge && (
                  <div className="mt-auto text-xs font-semibold" style={{ color: mod.badgeColor ?? '#5b6473' }}>
                    {badge}
                  </div>
                )}
              </Link>
            );
          })}
        </div>

        {/* EOD CTA bar */}
        <button
          onClick={() => setShowEod(true)}
          className="mt-5 w-full bg-ink rounded-card p-5 flex items-center gap-5 hover:bg-ink-light transition-colors text-left"
        >
          <div className="flex-1">
            <div className="font-spectral text-[17px] font-semibold text-white">End-of-Day Report</div>
            <div className="text-sm text-[#9aa6b6] mt-0.5">
              {props.doneCount} tasks done · {props.pendingCount} pending · {props.ptoToday} on PTO — ready to compile and send.
            </div>
          </div>
          <div className="bg-gold text-ink font-bold text-sm px-5 py-2.5 rounded-ctrl flex-shrink-0">
            Compile Report
          </div>
        </button>
      </div>

      {showEod && <EodModal onClose={() => setShowEod(false)} />}
    </div>
  );
}

function KpiCard({ label, value, sub, subColor, href }: { label: string; value: string | number; sub: string; subColor?: string; href: string }) {
  return (
    <Link href={href} className="bg-white border border-border rounded-card p-4 hover:shadow-card transition-shadow block">
      <div className="text-xs text-text-muted uppercase tracking-widest">{label}</div>
      <div className="font-spectral text-[30px] font-semibold text-text-primary mt-1">{value}</div>
      <div className="text-xs mt-0.5" style={{ color: subColor ?? '#5b6473' }}>{sub}</div>
    </Link>
  );
}

function SearchIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/></svg>; }
function TaskIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="4" y="4" width="16" height="16" rx="2"/><polyline points="8 12 11 15 16 9"/></svg>; }
function PtoIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="5" y="3" width="14" height="18" rx="2"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="13" y2="16"/></svg>; }
function OfferIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="5" width="18" height="14" rx="2"/><polyline points="3 7 12 13 21 7"/></svg>; }
function SopIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><line x1="5" y1="7" x2="19" y2="7"/><line x1="5" y1="12" x2="19" y2="12"/><line x1="5" y1="17" x2="14" y2="17"/></svg>; }
function PayrollIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10.5h4a1.6 1.6 0 0 1 0 3.2h-3a1.6 1.6 0 0 0 0 3.2h4"/></svg>; }
function CalIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="4" y="5" width="16" height="15" rx="2"/><line x1="4" y1="9" x2="20" y2="9"/><line x1="9" y1="3" x2="9" y2="7"/><line x1="15" y1="3" x2="15" y2="7"/></svg>; }
function TripIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 21s-6-5.2-6-10a6 6 0 0 1 12 0c0 4.8-6 10-6 10z"/><circle cx="12" cy="11" r="2.2"/></svg>; }
function ReviewIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><line x1="6" y1="20" x2="6" y2="13"/><line x1="12" y1="20" x2="12" y2="8"/><line x1="18" y1="20" x2="18" y2="11"/></svg>; }
function ReportsIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 2h8l4 4v16H6z"/><polyline points="14 2 14 6 18 6"/><line x1="8" y1="10" x2="15" y2="10"/><line x1="8" y1="14" x2="13" y2="14"/></svg>; }
function DesignIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/></svg>; }

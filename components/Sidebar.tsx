'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

const navItems = [
  { href: '/',          label: 'Dashboard' },
  { href: '/tasks',     label: 'Open HR Tasks', badgeKey: 'tasks' },
  { href: '/pto',       label: 'PTO Reports' },
  { href: '/offers',    label: 'Offer Letters' },
  { href: '/sop',       label: 'SOP Builder' },
  { href: '/payroll',   label: 'Payroll' },
  { href: '/calendar',  label: 'Outlook Calendar' },
  { href: '/trips',     label: 'Trip Help Desk' },
  { href: '/reviews',   label: 'Performance Reviews' },
  { href: '/reports',   label: 'Reports' },
  { href: '/design',    label: 'Graphic Design' },
];

interface SidebarProps {
  pendingTaskCount?: number;
}

export default function Sidebar({ pendingTaskCount }: SidebarProps) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  return (
    <aside
      className="flex flex-col h-screen flex-shrink-0 overflow-hidden"
      style={{
        width: 236,
        background: 'linear-gradient(180deg, #213044 0%, #1b2a3d 100%)',
      }}
    >
      {/* Wordmark */}
      <div className="px-6 py-6 border-b border-white/8">
        <div className="font-spectral text-2xl font-semibold tracking-widest text-white">LITSON</div>
        <div className="text-xs tracking-widest uppercase text-[#8b97a8] mt-0.5">HR Toolkit</div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-auto py-3.5 px-3.5 flex flex-col gap-0.5">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-all duration-100',
                active
                  ? 'text-white font-semibold'
                  : 'text-[#9aa6b6] hover:text-white hover:bg-white/6'
              )}
              style={
                active
                  ? {
                      borderLeft: '3px solid #c9a24a',
                      paddingLeft: 9,
                      background: 'rgba(255,255,255,0.09)',
                    }
                  : { borderLeft: '3px solid transparent', paddingLeft: 9 }
              }
            >
              <span className="flex-1">{item.label}</span>
              {item.badgeKey === 'tasks' && (pendingTaskCount ?? 0) > 0 && (
                <span className="bg-litred text-white text-xs font-semibold px-2 py-0.5 rounded-full leading-none">
                  {pendingTaskCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer avatar */}
      <div className="px-4 py-4 border-t border-white/8 flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
          style={{ background: '#c9a24a', color: '#1b2230' }}
        >
          RM
        </div>
        <div>
          <div className="text-white text-sm font-semibold leading-tight">Renee Mathis</div>
          <div className="text-[#8b97a8] text-xs">HR Administrator</div>
        </div>
      </div>
    </aside>
  );
}

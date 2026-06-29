'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession, signOut, signIn } from 'next-auth/react';
import { useState, useRef, useEffect } from 'react';
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

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

interface SidebarProps { pendingTaskCount?: number; }

export default function Sidebar({ pendingTaskCount }: SidebarProps) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const userName = session?.user?.name ?? 'Clarizz Alon';
  const userEmail = session?.user?.email ?? '';
  const role = (session?.user as any)?.role ?? 'hr';
  const roleLabel = role === 'admin' ? 'Admin Viewer' : 'HR Administrator';

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function isActive(href: string) {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  return (
    <aside
      className="flex flex-col h-screen flex-shrink-0 overflow-hidden"
      style={{ width: 236, background: 'linear-gradient(180deg, #213044 0%, #1b2a3d 100%)' }}
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
                active ? 'text-white font-semibold' : 'text-[#9aa6b6] hover:text-white hover:bg-white/6'
              )}
              style={
                active
                  ? { borderLeft: '3px solid #c9a24a', paddingLeft: 9, background: 'rgba(255,255,255,0.09)' }
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

      {/* Footer with user menu */}
      <div className="relative px-4 py-4 border-t border-white/8" ref={menuRef}>
        {/* Popup menu */}
        {menuOpen && (
          <div className="absolute bottom-full left-4 right-4 mb-2 bg-[#1b2a3d] border border-white/15 rounded-card shadow-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10">
              <div className="text-white text-xs font-semibold truncate">{userName}</div>
              <div className="text-[#8b97a8] text-[10px] truncate">{userEmail}</div>
              <div className="mt-1">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${role === 'admin' ? 'bg-[#3f6b8a]/30 text-[#7ab3d4]' : 'bg-[#c9a24a]/20 text-[#c9a24a]'}`}>
                  {roleLabel}
                </span>
              </div>
            </div>
            {status === 'authenticated' ? (
              <button
                onClick={() => { setMenuOpen(false); signOut({ callbackUrl: '/auth/signin' }); }}
                className="w-full text-left px-4 py-3 text-sm text-[#9aa6b6] hover:text-white hover:bg-white/8 transition-colors"
              >
                Sign out
              </button>
            ) : (
              <button
                onClick={() => { setMenuOpen(false); signIn(); }}
                className="w-full text-left px-4 py-3 text-sm text-[#9aa6b6] hover:text-white hover:bg-white/8 transition-colors"
              >
                Sign in
              </button>
            )}
          </div>
        )}

        {/* Avatar row — click to toggle menu */}
        <button
          onClick={() => setMenuOpen(v => !v)}
          className="flex items-center gap-3 w-full text-left hover:opacity-80 transition-opacity"
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
            style={{ background: '#c9a24a', color: '#1b2230' }}
          >
            {initials(userName)}
          </div>
          <div className="min-w-0">
            <div className="text-white text-sm font-semibold leading-tight truncate">{userName}</div>
            <div className="text-[#8b97a8] text-xs">{roleLabel}</div>
          </div>
          <svg className="ml-auto shrink-0 text-[#8b97a8]" width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d={menuOpen ? 'M2 8l4-4 4 4' : 'M2 4l4 4 4-4'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </aside>
  );
}

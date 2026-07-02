'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession, signOut, signIn } from 'next-auth/react';
import { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';

const navItems = [
  { href: '/',          label: 'Dashboard' },
  { href: '/tasks',     label: 'Open HR Tasks', badgeKey: 'tasks' },
  { href: '/pto',       label: 'PTO & Calendar' },
  { href: '/offers',    label: 'Offer Letters' },
  { href: '/sop',       label: 'SOP Builder' },
  { href: '/payroll',   label: 'Payroll' },
  { href: '/trips',     label: 'Trip Help Desk' },
  { href: '/reviews',   label: 'Performance Reviews' },
  { href: '/staffing',  label: 'Staffing' },
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
  const [inviteOpen, setInviteOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const INVITE_PWD = 'litson2026';
  function copy(text: string) { navigator.clipboard?.writeText(text); }

  // Draggable nav order, persisted in the browser
  const [order, setOrder] = useState<string[]>(navItems.map(i => i.href));
  const [dragHref, setDragHref] = useState<string | null>(null);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('nav-order') || 'null');
      if (Array.isArray(saved)) {
        const known = navItems.map(i => i.href);
        const merged = [...saved.filter((h: string) => known.includes(h)), ...known.filter(h => !saved.includes(h))];
        setOrder(merged);
      }
    } catch { /* ignore */ }
  }, []);
  const orderedItems = order.map(h => navItems.find(i => i.href === h)).filter(Boolean) as typeof navItems;
  function onDrop(targetHref: string) {
    if (!dragHref || dragHref === targetHref) { setDragHref(null); return; }
    const next = [...order];
    const from = next.indexOf(dragHref); const to = next.indexOf(targetHref);
    next.splice(from, 1); next.splice(to, 0, dragHref);
    setOrder(next); setDragHref(null);
    try { localStorage.setItem('nav-order', JSON.stringify(next)); } catch { /* ignore */ }
  }

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
        {orderedItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              draggable
              onDragStart={() => setDragHref(item.href)}
              onDragOver={e => e.preventDefault()}
              onDrop={() => onDrop(item.href)}
              onDragEnd={() => setDragHref(null)}
              className={clsx(
                'group flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-all duration-100',
                active ? 'text-white font-semibold' : 'text-[#9aa6b6] hover:text-white hover:bg-white/6',
                dragHref === item.href && 'opacity-40'
              )}
              style={
                active
                  ? { borderLeft: '3px solid #c9a24a', paddingLeft: 9, background: 'rgba(255,255,255,0.09)' }
                  : { borderLeft: '3px solid transparent', paddingLeft: 9 }
              }
            >
              <span className="cursor-grab select-none text-[#5c6b7e] opacity-0 group-hover:opacity-100 -ml-1" title="Drag to reorder">⠿</span>
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
            <button
              onClick={() => { setMenuOpen(false); setInviteOpen(true); }}
              className="w-full text-left px-4 py-3 text-sm text-[#9aa6b6] hover:text-white hover:bg-white/8 transition-colors border-b border-white/10"
            >
              Invite teammate
            </button>
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

      {/* Invite modal */}
      {inviteOpen && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-6" onClick={() => setInviteOpen(false)}>
          <div className="bg-white rounded-card w-full max-w-md shadow-xl overflow-hidden text-text-primary" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="font-spectral text-[18px] font-semibold">Invite a teammate</h2>
              <button onClick={() => setInviteOpen(false)} className="text-text-muted hover:text-text-primary text-xl leading-none">×</button>
            </div>
            <div className="px-6 py-5 space-y-4 text-sm">
              <p className="text-text-secondary">Share these with anyone you want to give access. They sign in with <span className="font-semibold">their own email</span> and the shared password below.</p>
              <div>
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1">App link</label>
                <div className="flex gap-2">
                  <input readOnly value={`${appUrl}/auth/signin`} className="flex-1 border border-border-light rounded-ctrl px-3 py-2 text-sm bg-canvas" />
                  <button onClick={() => copy(`${appUrl}/auth/signin`)} className="bg-white border border-border-light text-ink text-sm font-semibold px-3 py-2 rounded-ctrl hover:bg-canvas">Copy</button>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-1">Password</label>
                <div className="flex gap-2">
                  <input readOnly value={INVITE_PWD} className="flex-1 border border-border-light rounded-ctrl px-3 py-2 text-sm bg-canvas font-mono" />
                  <button onClick={() => copy(INVITE_PWD)} className="bg-white border border-border-light text-ink text-sm font-semibold px-3 py-2 rounded-ctrl hover:bg-canvas">Copy</button>
                </div>
              </div>
              <a href={`mailto:?subject=${encodeURIComponent('LITSON HR Toolkit access')}&body=${encodeURIComponent(`You've been invited to the LITSON HR Toolkit.\n\nSign in: ${appUrl}/auth/signin\nUse your email and the password: ${INVITE_PWD}`)}`}
                className="block text-center bg-ink text-white text-sm font-semibold px-4 py-2.5 rounded-ctrl hover:bg-ink-dark">
                ✉ Email this invite
              </a>
              <p className="text-xs text-text-muted">Tip: to change the shared password, set the <span className="font-mono">APP_PASSWORD</span> environment variable in Vercel.</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAccess } from './AccessProvider';
import { sectionForPath, HR_ADMIN_SECTIONS } from '@/lib/access';

// Wraps the main content. For a restricted viewer, blocks pages they weren't
// granted and sends them to their first allowed section.
export default function AccessGate({ children }: { children: React.ReactNode }) {
  const { me, loading } = useAccess();
  const pathname = usePathname();
  const router = useRouter();

  const restricted = !!me?.restricted;
  const sec = sectionForPath(pathname);
  // HR-admin-only sections are blocked for anyone who isn't an HR admin.
  // The owner/access-admin always qualifies (never lock the owner out).
  const hrBlocked = HR_ADMIN_SECTIONS.includes(sec) && !(me?.isHrAdmin || me?.isAdmin);
  // The Onboarding Document is a sub-permission that lives inside /onboarding —
  // holding it grants access to the onboarding route too.
  const secs = me?.sections ?? [];
  const allowed = secs.includes(sec) || (sec === '/onboarding' && secs.includes('/onboarding-doc'));
  const denied = hrBlocked || (restricted && !allowed);
  // Never send anyone to the pseudo-route; map it to the real onboarding page.
  const firstReal = secs.map(s => s === '/onboarding-doc' ? '/onboarding' : s)[0];
  const target = restricted ? firstReal : (hrBlocked ? '/' : undefined);

  useEffect(() => {
    if (denied && target && sec !== target) router.replace(target);
  }, [denied, target, sec, router]);

  if (loading) return <div className="p-10 text-sm text-text-muted">Loading…</div>;
  if (denied) {
    return (
      <div className="p-10 max-w-lg">
        <h1 className="font-spectral text-[22px] font-semibold text-text-primary mb-2">No access to this page</h1>
        <p className="text-sm text-text-muted">
          {target ? 'Taking you to a section you can view…' : 'No sections have been shared with your account yet. Please contact your administrator.'}
        </p>
      </div>
    );
  }
  return <>{children}</>;
}

'use client';
import { useSession } from 'next-auth/react';

export function useRole(): 'hr' | 'admin' {
  const { data: session } = useSession();
  return ((session?.user as any)?.role ?? 'hr') as 'hr' | 'admin';
}

export function useCanEdit(): boolean {
  return useRole() === 'hr';
}

/** Renders children only if the current user has edit rights (role = 'hr'). */
export default function EditGate({ children, fallback = null }: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const canEdit = useCanEdit();
  return canEdit ? <>{children}</> : <>{fallback}</>;
}

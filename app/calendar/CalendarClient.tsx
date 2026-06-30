'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CalendarClient() {
  const router = useRouter();
  useEffect(() => { router.replace('/pto'); }, [router]);
  return (
    <div className="flex items-center justify-center h-full text-text-muted text-sm">
      Redirecting to PTO Reports…
    </div>
  );
}

'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import type { MyAccess } from '@/lib/access';

const Ctx = createContext<{ me: MyAccess | null; loading: boolean }>({ me: null, loading: true });
export const useAccess = () => useContext(Ctx);

const FULL: MyAccess = { isAdmin: false, restricted: false, sections: [], reportTabs: [] };

export default function AccessProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<MyAccess | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch('/api/access/me')
      .then(r => r.json())
      .then(d => setMe(d && typeof d === 'object' ? d : FULL))
      .catch(() => setMe(FULL))
      .finally(() => setLoading(false));
  }, []);
  return <Ctx.Provider value={{ me, loading }}>{children}</Ctx.Provider>;
}

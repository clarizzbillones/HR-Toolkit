import ModuleLayout from '@/components/ModuleLayout';
import AccessClient from './AccessClient';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function AccessPage() {
  let pending = 0;
  try { const [{ n }] = await sql`SELECT COUNT(*)::int as n FROM tasks WHERE status NOT IN ('done', 'archived')`; pending = n ?? 0; } catch { /* ignore */ }
  return (
    <ModuleLayout pendingTaskCount={pending}>
      <AccessClient />
    </ModuleLayout>
  );
}

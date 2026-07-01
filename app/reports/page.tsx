import { sql } from '@/lib/db';
import ModuleLayout from '@/components/ModuleLayout';
import ReportsClient from './ReportsClient';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const [{ n }] = await sql`SELECT COUNT(*)::int as n FROM tasks WHERE status NOT IN ('done', 'archived')`;
  return (
    <ModuleLayout pendingTaskCount={n ?? 0}>
      <ReportsClient />
    </ModuleLayout>
  );
}

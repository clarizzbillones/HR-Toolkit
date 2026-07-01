import { sql } from '@/lib/db';
import ModuleLayout from '@/components/ModuleLayout';
import PtoClient from './PtoClient';

export const dynamic = 'force-dynamic';

export default async function PtoPage() {
  const [{ n }] = await sql`SELECT COUNT(*)::int as n FROM tasks WHERE status NOT IN ('done', 'archived')`;
  const entries = await sql`SELECT * FROM pto_entries ORDER BY start_date ASC`;
  return (
    <ModuleLayout pendingTaskCount={n ?? 0}>
      <PtoClient initialEntries={entries as any[]} />
    </ModuleLayout>
  );
}

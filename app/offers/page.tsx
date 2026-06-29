import { sql } from '@/lib/db';
import ModuleLayout from '@/components/ModuleLayout';
import OffersClient from './OffersClient';

export const dynamic = 'force-dynamic';

export default async function OffersPage() {
  const [{ n }] = await sql`SELECT COUNT(*)::int as n FROM tasks WHERE status != 'done'`;
  const employees = await sql`SELECT name FROM employees ORDER BY name`;
  return (
    <ModuleLayout pendingTaskCount={n ?? 0}>
      <OffersClient employees={(employees as any[]).map((e: any) => e.name)} />
    </ModuleLayout>
  );
}

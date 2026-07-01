import { sql } from '@/lib/db';
import ModuleLayout from '@/components/ModuleLayout';
import OffersClient from './OffersClient';

export const dynamic = 'force-dynamic';

export default async function OffersPage() {
  const [{ n }] = await sql`SELECT COUNT(*)::int as n FROM tasks WHERE status NOT IN ('done', 'archived')`;
  return (
    <ModuleLayout pendingTaskCount={n ?? 0}>
      <OffersClient />
    </ModuleLayout>
  );
}

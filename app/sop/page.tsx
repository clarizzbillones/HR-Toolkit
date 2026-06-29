import { sql } from '@/lib/db';
import ModuleLayout from '@/components/ModuleLayout';
import SopClient from './SopClient';

export const dynamic = 'force-dynamic';

export default async function SopPage() {
  const [{ n }] = await sql`SELECT COUNT(*)::int as n FROM tasks WHERE status != 'done'`;
  return (
    <ModuleLayout pendingTaskCount={n ?? 0}>
      <SopClient />
    </ModuleLayout>
  );
}

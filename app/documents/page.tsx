import { sql } from '@/lib/db';
import ModuleLayout from '@/components/ModuleLayout';
import DocumentsClient from './DocumentsClient';

export const dynamic = 'force-dynamic';

export default async function DocumentsPage() {
  const [{ n }] = await sql`SELECT COUNT(*)::int as n FROM tasks WHERE status NOT IN ('done', 'archived')`;
  return (
    <ModuleLayout pendingTaskCount={n ?? 0}>
      <DocumentsClient />
    </ModuleLayout>
  );
}

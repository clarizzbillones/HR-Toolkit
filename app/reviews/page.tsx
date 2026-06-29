import { sql } from '@/lib/db';
import ModuleLayout from '@/components/ModuleLayout';
import ReviewsClient from './ReviewsClient';

export const dynamic = 'force-dynamic';

export default async function ReviewsPage() {
  const [{ n }] = await sql`SELECT COUNT(*)::int as n FROM tasks WHERE status != 'done'`;
  const employees = await sql`SELECT * FROM employees ORDER BY name`;
  return (
    <ModuleLayout pendingTaskCount={n ?? 0}>
      <ReviewsClient initialEmployees={employees as any[]} />
    </ModuleLayout>
  );
}

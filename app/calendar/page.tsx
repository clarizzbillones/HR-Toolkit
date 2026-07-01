import { sql } from '@/lib/db';
import ModuleLayout from '@/components/ModuleLayout';
import CalendarClient from './CalendarClient';

export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
  const [{ n }] = await sql`SELECT COUNT(*)::int as n FROM tasks WHERE status NOT IN ('done', 'archived')`;
  return (
    <ModuleLayout pendingTaskCount={n ?? 0}>
      <CalendarClient />
    </ModuleLayout>
  );
}

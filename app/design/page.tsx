import { sql } from '@/lib/db';
import ModuleLayout from '@/components/ModuleLayout';
import DesignClient from './DesignClient';

export const dynamic = 'force-dynamic';

export default async function DesignPage() {
  const [{ n }] = await sql`SELECT COUNT(*)::int as n FROM tasks WHERE status != 'done'`;
  const employees = await sql`SELECT name, birthday FROM employees ORDER BY name`;
  return (
    <ModuleLayout pendingTaskCount={n ?? 0}>
      <DesignClient employees={employees as any[]} />
    </ModuleLayout>
  );
}

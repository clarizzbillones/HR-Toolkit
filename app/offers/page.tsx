import { getDb } from '@/lib/db';
import ModuleLayout from '@/components/ModuleLayout';
import OffersClient from './OffersClient';

export const dynamic = 'force-dynamic';

export default function OffersPage() {
  const db = getDb();
  const tasks = db.prepare("SELECT COUNT(*) as n FROM tasks WHERE status != 'done'").get() as any;
  const employees = db.prepare('SELECT name FROM employees ORDER BY name').all() as any[];
  return (
    <ModuleLayout pendingTaskCount={tasks.n}>
      <OffersClient employees={employees.map((e: any) => e.name)} />
    </ModuleLayout>
  );
}

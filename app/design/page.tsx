import { getDb } from '@/lib/db';
import ModuleLayout from '@/components/ModuleLayout';
import DesignClient from './DesignClient';

export const dynamic = 'force-dynamic';

export default function DesignPage() {
  const db = getDb();
  const tasks = db.prepare("SELECT COUNT(*) as n FROM tasks WHERE status != 'done'").get() as any;
  const employees = db.prepare('SELECT name, birthday FROM employees ORDER BY name').all() as any[];
  return (
    <ModuleLayout pendingTaskCount={tasks.n}>
      <DesignClient employees={employees} />
    </ModuleLayout>
  );
}

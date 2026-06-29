import { getDb } from '@/lib/db';
import ModuleLayout from '@/components/ModuleLayout';
import ReportsClient from './ReportsClient';

export const dynamic = 'force-dynamic';

export default function ReportsPage() {
  const db = getDb();
  const tasks = db.prepare("SELECT COUNT(*) as n FROM tasks WHERE status != 'done'").get() as any;
  return (
    <ModuleLayout pendingTaskCount={tasks.n}>
      <ReportsClient />
    </ModuleLayout>
  );
}

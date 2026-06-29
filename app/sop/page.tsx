import { getDb } from '@/lib/db';
import ModuleLayout from '@/components/ModuleLayout';
import SopClient from './SopClient';

export const dynamic = 'force-dynamic';

export default function SopPage() {
  const db = getDb();
  const tasks = db.prepare("SELECT COUNT(*) as n FROM tasks WHERE status != 'done'").get() as any;
  return (
    <ModuleLayout pendingTaskCount={tasks.n}>
      <SopClient />
    </ModuleLayout>
  );
}

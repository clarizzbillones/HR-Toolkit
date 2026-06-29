import { getDb } from '@/lib/db';
import ModuleLayout from '@/components/ModuleLayout';
import PtoClient from './PtoClient';

export const dynamic = 'force-dynamic';

export default function PtoPage() {
  const db = getDb();
  const tasks = db.prepare("SELECT COUNT(*) as n FROM tasks WHERE status != 'done'").get() as any;
  const initialEntries = db.prepare('SELECT * FROM pto_entries ORDER BY start_date ASC').all();

  return (
    <ModuleLayout pendingTaskCount={tasks.n}>
      <PtoClient initialEntries={initialEntries as any[]} />
    </ModuleLayout>
  );
}

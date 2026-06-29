import { getDb } from '@/lib/db';
import ModuleLayout from '@/components/ModuleLayout';
import CalendarClient from './CalendarClient';

export const dynamic = 'force-dynamic';

export default function CalendarPage() {
  const db = getDb();
  const tasks = db.prepare("SELECT COUNT(*) as n FROM tasks WHERE status != 'done'").get() as any;
  return (
    <ModuleLayout pendingTaskCount={tasks.n}>
      <CalendarClient />
    </ModuleLayout>
  );
}

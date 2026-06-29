import { getDb } from '@/lib/db';
import ModuleLayout from '@/components/ModuleLayout';
import TasksClient from './TasksClient';

export const dynamic = 'force-dynamic';

export default function TasksPage() {
  const db = getDb();
  const tasks = db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all();
  const pendingCount = (tasks as any[]).filter(t => t.status !== 'done').length;

  return (
    <ModuleLayout pendingTaskCount={pendingCount}>
      <TasksClient initialTasks={tasks as any[]} />
    </ModuleLayout>
  );
}

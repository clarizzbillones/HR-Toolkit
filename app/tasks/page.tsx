import { sql } from '@/lib/db';
import ModuleLayout from '@/components/ModuleLayout';
import TasksClient from './TasksClient';

export const dynamic = 'force-dynamic';

export default async function TasksPage() {
  const tasks = await sql`SELECT * FROM tasks ORDER BY created_at DESC`;
  const pendingCount = (tasks as any[]).filter(t => t.status !== 'done' && t.status !== 'archived').length;
  return (
    <ModuleLayout pendingTaskCount={pendingCount}>
      <TasksClient initialTasks={tasks as any[]} />
    </ModuleLayout>
  );
}

import { getDb } from '@/lib/db';
import ModuleLayout from '@/components/ModuleLayout';
import ReviewsClient from './ReviewsClient';

export const dynamic = 'force-dynamic';

export default function ReviewsPage() {
  const db = getDb();
  const tasks = db.prepare("SELECT COUNT(*) as n FROM tasks WHERE status != 'done'").get() as any;
  const employees = db.prepare('SELECT * FROM employees ORDER BY name').all();
  return (
    <ModuleLayout pendingTaskCount={tasks.n}>
      <ReviewsClient initialEmployees={employees as any[]} />
    </ModuleLayout>
  );
}

import { getDb } from '@/lib/db';
import ModuleLayout from '@/components/ModuleLayout';
import TripsClient from './TripsClient';

export const dynamic = 'force-dynamic';

export default function TripsPage() {
  const db = getDb();
  const tasks = db.prepare("SELECT COUNT(*) as n FROM tasks WHERE status != 'done'").get() as any;
  const trips = db.prepare('SELECT * FROM trips ORDER BY created_at DESC').all();
  return (
    <ModuleLayout pendingTaskCount={tasks.n}>
      <TripsClient initialTrips={trips as any[]} />
    </ModuleLayout>
  );
}

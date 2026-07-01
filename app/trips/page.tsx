import { sql } from '@/lib/db';
import ModuleLayout from '@/components/ModuleLayout';
import TripsClient from './TripsClient';

export const dynamic = 'force-dynamic';

export default async function TripsPage() {
  const [{ n }] = await sql`SELECT COUNT(*)::int as n FROM tasks WHERE status NOT IN ('done', 'archived')`;
  const trips = await sql`SELECT * FROM trips ORDER BY created_at DESC`;
  return (
    <ModuleLayout pendingTaskCount={n ?? 0}>
      <TripsClient initialTrips={trips as any[]} />
    </ModuleLayout>
  );
}

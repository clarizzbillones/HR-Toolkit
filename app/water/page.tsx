import { sql } from '@/lib/db';
import ModuleLayout from '@/components/ModuleLayout';
import WaterClient from './WaterClient';

export const dynamic = 'force-dynamic';

export default async function WaterPage() {
  const [{ n }] = await sql`SELECT COUNT(*)::int as n FROM tasks WHERE status NOT IN ('done', 'archived')`;
  await sql`CREATE TABLE IF NOT EXISTS water_deliveries (
    id TEXT PRIMARY KEY, supplier TEXT, scheduled_date TEXT, delivered_date TEXT,
    status TEXT DEFAULT 'Scheduled', quantity TEXT, notes TEXT,
    sort_order INT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  const rows = await sql`SELECT * FROM water_deliveries ORDER BY scheduled_date ASC NULLS LAST, sort_order ASC, created_at ASC`;
  return (
    <ModuleLayout pendingTaskCount={n ?? 0}>
      <WaterClient initialRows={rows as any[]} />
    </ModuleLayout>
  );
}

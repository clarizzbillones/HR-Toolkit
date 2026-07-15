import { sql } from '@/lib/db';
import ModuleLayout from '@/components/ModuleLayout';
import DesignClient from './DesignClient';

export const dynamic = 'force-dynamic';

export default async function DesignPage() {
  const [{ n }] = await sql`SELECT COUNT(*)::int as n FROM tasks WHERE status NOT IN ('done', 'archived')`;
  // Names for the greeting dropdown come from the Staffing directory (the
  // accurate source of who's at the firm). Fall back to the employees table
  // only if Staffing has no rows yet.
  let staff: any[] = [];
  try { staff = await sql`SELECT name FROM staff_directory WHERE name IS NOT NULL AND name <> '' ORDER BY name`; } catch { staff = []; }
  if (!staff.length) {
    staff = await sql`SELECT name FROM employees WHERE name IS NOT NULL AND name <> '' ORDER BY name`.catch(() => [] as any[]);
  }
  const uniq = new Map<string, string>();
  for (const r of staff as any[]) {
    const nm = String(r.name ?? '').trim();
    if (nm) uniq.set(nm.toLowerCase(), nm);
  }
  const employees = [...uniq.values()].sort((a, b) => a.localeCompare(b)).map(name => ({ name }));
  return (
    <ModuleLayout pendingTaskCount={n ?? 0}>
      <DesignClient employees={employees} />
    </ModuleLayout>
  );
}

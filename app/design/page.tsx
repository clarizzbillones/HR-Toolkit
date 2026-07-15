import { sql } from '@/lib/db';
import ModuleLayout from '@/components/ModuleLayout';
import DesignClient from './DesignClient';

export const dynamic = 'force-dynamic';

export default async function DesignPage() {
  const [{ n }] = await sql`SELECT COUNT(*)::int as n FROM tasks WHERE status NOT IN ('done', 'archived')`;
  // Names for the greeting dropdown come from BOTH the employees table and the
  // staff directory, so everyone shows up in birthday and anniversary greetings.
  const emp = await sql`SELECT name FROM employees WHERE name IS NOT NULL AND name <> ''`.catch(() => [] as any[]);
  let staff: any[] = [];
  try { staff = await sql`SELECT name FROM staff_directory WHERE name IS NOT NULL AND name <> ''`; } catch { staff = []; }
  const uniq = new Map<string, string>();
  for (const r of [...(emp as any[]), ...staff]) {
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

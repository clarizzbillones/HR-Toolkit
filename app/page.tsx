import { sql } from '@/lib/db';
import ModuleLayout from '@/components/ModuleLayout';
import DashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';

async function getStats() {
  const today = new Date().toISOString().slice(0, 10);
  const [{ n: pendingCount }] = await sql`SELECT COUNT(*)::int as n FROM tasks WHERE status != 'done'`;
  const [{ n: doneCount }] = await sql`SELECT COUNT(*)::int as n FROM tasks WHERE status = 'done'`;
  const [{ n: dueToday }] = await sql`SELECT COUNT(*)::int as n FROM tasks WHERE due_tag = 'Today' AND status != 'done'`;
  // DB report entries: exclude WFH / Personal leave types
  const ptoDbRows = await sql`
    SELECT employee FROM pto_entries
    WHERE start_date <= ${today} AND end_date >= ${today}
      AND status = 'Approved'
      AND type NOT ILIKE '%wfh%'
      AND type NOT ILIKE '%work from home%'
      AND type NOT ILIKE '%personal%'
  `;

  // Calendar events stored in app_settings
  const settingsRows = await sql`SELECT calendar_events FROM app_settings WHERE id = 'singleton'`;
  const settingsRow = settingsRows[0];
  let calEventsRaw: { name: string; tag: string; start: string; end: string; title: string }[] = [];
  try { calEventsRaw = settingsRow?.calendar_events ? JSON.parse(settingsRow.calendar_events) : []; } catch { calEventsRaw = []; }

  const EXCLUDED_TYPES_RE = /wfh|work\s+from\s+home|personal\s+leave|personal/i;
  const EXCLUDED_TITLE_RE = /interview|in\s+office|\bwfh\b|work\s+from\s+home|meeting|call|doctor|dr\.|appointment|lunch|training|onboard|orientation|review|check[\s-]?in|1[\s-]?on[\s-]?1|one[\s-]?on[\s-]?one|\bin\s+\w+\s+for\b|[\w']+\s+in\s+\w+|fundraiser|conference|summit|trip\s+to|travel\s+to|visiting|event|gala|retreat/i;

  const names = new Set<string>(ptoDbRows.map(r => r.employee.trim().toLowerCase()));
  for (const c of calEventsRaw) {
    if (c.start > today || c.end < today) continue;
    if (EXCLUDED_TYPES_RE.test(c.tag)) continue;
    if (EXCLUDED_TITLE_RE.test(c.title)) continue;
    names.add(c.name.trim().toLowerCase());
  }
  const ptoToday = names.size;
  const [nextPayroll] = await sql`SELECT run_date, cutoff FROM payroll_periods WHERE run_date >= ${today} ORDER BY run_date ASC LIMIT 1`;
  const [{ n: empCount }] = await sql`SELECT COUNT(*)::int as n FROM employees`;
  const [{ n: reviewsDone }] = await sql`SELECT COUNT(*)::int as n FROM employees WHERE review_6mo_status = 'Complete'`;
  const payrollDaysLeft = nextPayroll
    ? Math.ceil((new Date(nextPayroll.run_date).getTime() - Date.now()) / 86400000)
    : null;
  return {
    pendingCount: pendingCount ?? 0,
    doneCount: doneCount ?? 0,
    dueToday: dueToday ?? 0,
    ptoToday: ptoToday ?? 0,
    payrollDaysLeft,
    cutoffToday: nextPayroll?.cutoff === today,
    nextPayrollDate: nextPayroll?.run_date ?? null,
    empCount: empCount ?? 0,
    reviewsDone: reviewsDone ?? 0,
  };
}

export default async function DashboardPage() {
  const stats = await getStats();
  return (
    <ModuleLayout pendingTaskCount={stats.pendingCount}>
      <DashboardClient {...stats} />
    </ModuleLayout>
  );
}

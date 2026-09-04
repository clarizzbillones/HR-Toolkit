import { sql } from '@/lib/db';
import ModuleLayout from '@/components/ModuleLayout';
import InsuranceClient from './InsuranceClient';
import { ensureInsurance, CATEGORIES } from '@/lib/insurance';

export const dynamic = 'force-dynamic';

export default async function InsurancePage() {
  const [{ n }] = await sql`SELECT COUNT(*)::int as n FROM tasks WHERE status NOT IN ('done', 'archived')`;
  await ensureInsurance();
  const policies = await sql`SELECT * FROM insurance_policies ORDER BY sort_order ASC, created_at ASC`;
  const followups = await sql`SELECT * FROM insurance_followups ORDER BY sort_order ASC, created_at ASC`;
  return (
    <ModuleLayout pendingTaskCount={n ?? 0}>
      <InsuranceClient initialPolicies={policies as any[]} initialFollowups={followups as any[]} categories={CATEGORIES} />
    </ModuleLayout>
  );
}

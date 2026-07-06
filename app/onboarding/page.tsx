import { sql } from '@/lib/db';
import ModuleLayout from '@/components/ModuleLayout';
import OnboardingClient from './OnboardingClient';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const [{ n }] = await sql`SELECT COUNT(*)::int as n FROM tasks WHERE status NOT IN ('done', 'archived')`;
  return (
    <ModuleLayout pendingTaskCount={n ?? 0}>
      <OnboardingClient />
    </ModuleLayout>
  );
}

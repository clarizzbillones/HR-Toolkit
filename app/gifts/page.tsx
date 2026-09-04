import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import ModuleLayout from '@/components/ModuleLayout';
import GiftsClient from './GiftsClient';
import { ensureGifts } from '@/lib/gifts';
import { canSeeGifts } from '@/lib/access';

export const dynamic = 'force-dynamic';

export default async function GiftsPage() {
  const session = await getServerSession(authOptions);
  // Private page — only people on the gift allowlist may open it.
  if (!canSeeGifts(session?.user?.email)) redirect('/');
  const [{ n }] = await sql`SELECT COUNT(*)::int as n FROM tasks WHERE status NOT IN ('done', 'archived')`;
  await ensureGifts();
  const rows = await sql`SELECT * FROM gift_recipients ORDER BY sort_order ASC, created_at ASC`;
  return (
    <ModuleLayout pendingTaskCount={n ?? 0}>
      <GiftsClient initialRows={rows as any[]} />
    </ModuleLayout>
  );
}

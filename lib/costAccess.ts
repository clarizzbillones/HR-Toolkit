import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// People allowed to see pay-related data (actual cost, 401(k) contributions). Default: Clarizz and Catie.
export function costViewers(): string[] {
  return (process.env.COST_VIEWERS ?? 'clarizz@litson.co,catie@litson.co')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}
export async function costViewerSession() {
  const session = await getServerSession(authOptions);
  const email = (session?.user?.email ?? '').toLowerCase();
  return email && costViewers().includes(email) ? { session, email } : null;
}

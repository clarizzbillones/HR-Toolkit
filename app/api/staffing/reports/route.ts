export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';

// Data for the Reports view (Staffing and Employee Files): headcount, start/offboard dates and
// benefits elections. No pay or cost here — cost comes from /api/staffing/cost, which only answers
// for the cost viewers.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const staff = await sql`SELECT id, name, worker_type, position, start_date, offboarded, offboarded_date FROM staff_directory ORDER BY name ASC` as any[];
  let enrollments: any[] = [], vendors = 0;
  try { enrollments = await sql`SELECT person_name, benefit, status, plan FROM benefit_enrollments` as any[]; } catch { /* no roster yet */ }
  try { [{ n: vendors }] = await sql`SELECT count(*)::int AS n FROM vendor_contacts` as any[]; } catch { /* none */ }
  return NextResponse.json({ staff, enrollments, vendors });
}

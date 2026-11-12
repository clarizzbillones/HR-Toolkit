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
  // Offboarded people live in their own table (Staffing's Offboarded tab); `offboarded` there holds the
  // last day as free text ("2026-08-07", "April 31, 2026", "Offboarded").
  try {
    const off = await sql`SELECT id, name, worker_type, position, start_date, offboarded FROM offboarded_staff ORDER BY name ASC` as any[];
    const active = new Set(staff.filter(s => !s.offboarded).map(s => String(s.name).trim().toLowerCase()));
    for (const o of off) if (!active.has(String(o.name).trim().toLowerCase()))
      staff.push({ id: o.id, name: o.name, worker_type: o.worker_type, position: o.position, start_date: o.start_date, offboarded: true, offboarded_date: o.offboarded });
  } catch { /* no offboarded table yet */ }
  let enrollments: any[] = [], vendors = 0;
  try { enrollments = await sql`SELECT person_name, benefit, status, plan FROM benefit_enrollments` as any[]; } catch { /* no roster yet */ }
  try { [{ n: vendors }] = await sql`SELECT count(*)::int AS n FROM vendor_contacts` as any[]; } catch { /* none */ }
  return NextResponse.json({ staff, enrollments, vendors });
}

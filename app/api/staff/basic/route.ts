export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';

// Lightweight roster for name pickers: name, position, DOB and hire date, merged
// from Staffing and Employee Files (whichever has the DOB).
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const byName = new Map<string, any>();
  const add = (r: any) => {
    const nm = String(r.name ?? '').trim(); if (!nm) return;
    const key = nm.toLowerCase();
    const cur = byName.get(key) ?? { name: nm, position: '', dob: '', start_date: '', salary: '' };
    byName.set(key, {
      name: nm,
      position: cur.position || r.position || '',
      dob: cur.dob || r.dob || '',
      start_date: cur.start_date || r.start_date || '',
      salary: cur.salary || r.salary || '',
    });
  };
  try { (await sql`SELECT name, position, dob, start_date FROM staff_directory` as any[]).forEach(add); } catch { /* no table */ }
  try { (await sql`SELECT name, position, dob, start_date, salary FROM employee_profiles` as any[]).forEach(add); } catch { /* no table */ }
  const employees = Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
  return NextResponse.json({ employees });
}

export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { staffToProfile } from '@/lib/employeeProfile';
import { upsertCoachingFile, syncReviewsToEmployeeFile } from '@/lib/employeeFiles';

// One-click pull of an employee's existing records into their Employee File,
// while the tab stays independent. source = staffing | coaching | reviews.
async function requireHrAdmin() {
  const session = await getServerSession(authOptions);
  return !!session?.user;
}

function lc(s: any) { return String(s ?? '').trim().toLowerCase(); }

export async function POST(req: Request) {
  if (!(await requireHrAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { profileId, source } = await req.json();
  if (!profileId || !source) return NextResponse.json({ error: 'Missing profileId/source' }, { status: 400 });
  const [profile] = await sql`SELECT * FROM employee_profiles WHERE id = ${profileId}` as any[];
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  const name = profile.name;

  // Give employee_files a source marker so re-imports don't duplicate.
  await sql`ALTER TABLE employee_files ADD COLUMN IF NOT EXISTS source_ref TEXT`;

  if (source === 'staffing') {
    let row: any;
    try { [row] = await sql`SELECT * FROM staff_directory WHERE lower(name) = ${lc(name)} LIMIT 1` as any[]; } catch { /* no table */ }
    if (!row) return NextResponse.json({ error: `No Staffing record found for “${name}”.` }, { status: 404 });
    // Fill any blank profile field from Staffing (existing values are kept).
    const src = staffToProfile(row);
    const updates: Record<string, any> = {};
    for (const [k, v] of Object.entries(src)) {
      const staffVal = v == null ? '' : String(v).trim();
      const cur = profile[k] == null ? '' : String(profile[k]).trim();
      if (staffVal && !cur) updates[k] = staffVal;
    }
    if (Object.keys(updates).length) await sql`UPDATE employee_profiles SET ${sql(updates)} WHERE id = ${profileId}`;
    const [updated] = await sql`SELECT * FROM employee_profiles WHERE id = ${profileId}`;
    return NextResponse.json({ profile: updated, imported: 1, message: 'Pulled details from Staffing.' });
  }

  if (source === 'coaching') {
    let list: any[] = [];
    try { list = await sql`SELECT * FROM coaching_notes WHERE lower(employee) = ${lc(name)} ORDER BY date DESC NULLS LAST` as any[]; } catch { /* no table */ }
    // Refresh every coaching form (attaching / updating the branded PDF).
    for (const c of list) await upsertCoachingFile(profileId, c);
    return NextResponse.json({ imported: list.length, message: list.length ? `Synced ${list.length} coaching form${list.length > 1 ? 's' : ''} (with PDF).` : 'No coaching forms to import.' });
  }

  if (source === 'reviews') {
    let emp: any;
    try { [emp] = await sql`SELECT id FROM employees WHERE lower(name) = ${lc(name)} LIMIT 1` as any[]; } catch { /* no table */ }
    if (!emp) return NextResponse.json({ error: `No Performance Review record found for “${name}”.` }, { status: 404 });
    const r = await syncReviewsToEmployeeFile(emp.id, profileId);
    return NextResponse.json({ imported: r.imported, message: r.message });
  }

  return NextResponse.json({ error: 'Unknown source' }, { status: 400 });
}

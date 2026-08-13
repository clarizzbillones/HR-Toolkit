export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { isAccessAdmin, isHrAdmin } from '@/lib/access';
import { portalAdminEmails } from '@/lib/adminGrants';

// Returns the caller's effective access. Not in access_grants → full access.
export async function GET() {
  const session = await getServerSession(authOptions);
  const email = (session?.user?.email ?? '').toLowerCase();
  const role = (session?.user as any)?.role ?? '';
  // Portal-added admins get full-access + HR-admin, same as env-var admins.
  const portalAdmin = !!email && (await portalAdminEmails().catch((): string[] => [])).includes(email);
  const isAdmin = isAccessAdmin(email, role) || portalAdmin;
  const hrAdmin = isHrAdmin(email, role) || portalAdmin;

  // Admins/owners are never restricted.
  if (isAdmin || !email) {
    return NextResponse.json({ isAdmin, isHrAdmin: hrAdmin, restricted: false, sections: [], reportTabs: [], editSections: [] });
  }
  let row: any;
  try {
    await sql`CREATE TABLE IF NOT EXISTS access_grants (email TEXT PRIMARY KEY, name TEXT, sections TEXT, report_tabs TEXT, updated_at TIMESTAMPTZ DEFAULT now())`;
    await sql`ALTER TABLE access_grants ADD COLUMN IF NOT EXISTS edit_sections TEXT`;
    [row] = await sql`SELECT sections, report_tabs, edit_sections FROM access_grants WHERE email = ${email}` as any[];
  } catch { /* table may not exist */ }
  if (!row) return NextResponse.json({ isAdmin: false, isHrAdmin: hrAdmin, restricted: false, sections: [], reportTabs: [], editSections: [] });
  const safe = (v: any) => { try { const a = JSON.parse(v ?? '[]'); return Array.isArray(a) ? a.map(String) : []; } catch { return []; } };
  return NextResponse.json({ isAdmin: false, isHrAdmin: hrAdmin, restricted: true, sections: safe(row.sections), reportTabs: safe(row.report_tabs), editSections: safe(row.edit_sections) });
}

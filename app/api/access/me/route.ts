export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { isAccessAdmin } from '@/lib/access';

// Returns the caller's effective access. Not in access_grants → full access.
export async function GET() {
  const session = await getServerSession(authOptions);
  const email = (session?.user?.email ?? '').toLowerCase();
  const role = (session?.user as any)?.role ?? '';
  const isAdmin = isAccessAdmin(email, role);

  // Admins/owners are never restricted.
  if (isAdmin || !email) {
    return NextResponse.json({ isAdmin, restricted: false, sections: [], reportTabs: [] });
  }
  let row: any;
  try {
    await sql`CREATE TABLE IF NOT EXISTS access_grants (email TEXT PRIMARY KEY, name TEXT, sections TEXT, report_tabs TEXT, updated_at TIMESTAMPTZ DEFAULT now())`;
    [row] = await sql`SELECT sections, report_tabs FROM access_grants WHERE email = ${email}` as any[];
  } catch { /* table may not exist */ }
  if (!row) return NextResponse.json({ isAdmin: false, restricted: false, sections: [], reportTabs: [] });
  const safe = (v: any) => { try { const a = JSON.parse(v ?? '[]'); return Array.isArray(a) ? a.map(String) : []; } catch { return []; } };
  return NextResponse.json({ isAdmin: false, restricted: true, sections: safe(row.sections), reportTabs: safe(row.report_tabs) });
}

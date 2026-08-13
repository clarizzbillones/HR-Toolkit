export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql, cuid } from '@/lib/db';
import { FIRM_SYSTEMS, SYSTEM_HINTS } from '@/lib/firmSystems';

// A running list of the firm accounts/systems each employee has access to, kept
// on their Employee File so offboarding can pull a complete list from one place.
async function ensure() {
  await sql`CREATE TABLE IF NOT EXISTS employee_accounts (
    id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, system TEXT, account TEXT,
    access_level TEXT, status TEXT, source TEXT, notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
}
const auth = async () => !!(await getServerSession(authOptions))?.user;

export async function GET(req: Request) {
  if (!(await auth())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const profileId = new URL(req.url).searchParams.get('profileId');
  if (!profileId) return NextResponse.json({ error: 'Missing profileId' }, { status: 400 });
  const rows = await sql`SELECT * FROM employee_accounts WHERE profile_id = ${profileId} ORDER BY lower(system) ASC, created_at ASC` as any[];
  return NextResponse.json({ accounts: rows });
}

export async function POST(req: Request) {
  if (!(await auth())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const b = await req.json();
  const profileId = String(b.profileId ?? '');
  if (!profileId) return NextResponse.json({ error: 'Missing profileId' }, { status: 400 });

  // Seed the standard firm systems that aren't already listed for this employee.
  if (b.action === 'seed-standard') {
    const existing = await sql`SELECT lower(system) AS s FROM employee_accounts WHERE profile_id = ${profileId}` as any[];
    const have = new Set(existing.map(r => r.s));
    let created = 0;
    for (const sys of FIRM_SYSTEMS) {
      if (have.has(sys.toLowerCase())) continue;
      await sql`INSERT INTO employee_accounts (id, profile_id, system, account, access_level, status, source, notes)
        VALUES (${cuid()}, ${profileId}, ${sys}, ${''}, ${''}, ${'Active'}, ${'Manual'}, ${SYSTEM_HINTS[sys] ?? ''})`;
      created++;
    }
    const accounts = await sql`SELECT * FROM employee_accounts WHERE profile_id = ${profileId} ORDER BY lower(system) ASC, created_at ASC`;
    return NextResponse.json({ accounts, created });
  }

  const id = cuid();
  await sql`INSERT INTO employee_accounts (id, profile_id, system, account, access_level, status, source, notes)
    VALUES (${id}, ${profileId}, ${b.system ?? ''}, ${b.account ?? ''}, ${b.access_level ?? ''}, ${b.status ?? 'Active'}, ${b.source ?? 'Manual'}, ${b.notes ?? ''})`;
  const [row] = await sql`SELECT * FROM employee_accounts WHERE id = ${id}`;
  return NextResponse.json({ account: row }, { status: 201 });
}

export async function PATCH(req: Request) {
  if (!(await auth())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const b = await req.json();
  if (!b.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const updates: Record<string, any> = {};
  for (const k of ['system', 'account', 'access_level', 'status', 'source', 'notes'] as const) {
    if (k in b) updates[k] = b[k] ?? '';
  }
  if (!Object.keys(updates).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  await sql`UPDATE employee_accounts SET ${sql(updates)} WHERE id = ${b.id}`;
  const [row] = await sql`SELECT * FROM employee_accounts WHERE id = ${b.id}` as any[];
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ account: row });
}

export async function DELETE(req: Request) {
  if (!(await auth())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  await sql`DELETE FROM employee_accounts WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}

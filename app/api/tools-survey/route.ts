export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql, cuid } from '@/lib/db';
import { findOrCreateProfileByName } from '@/lib/employeeFiles';
import { FIRM_SYSTEMS, SYSTEM_HINTS } from '@/lib/firmSystems';

// Tools & Access survey: a per-person tokenized link (no login) where an
// employee marks, for each firm tool, whether they use it, have access but
// don't use it, or have no access. On submit we file a summary to their
// Employee File and sync their Accounts & Access list.
async function ensure() {
  await sql`CREATE TABLE IF NOT EXISTS tools_surveys (
    id TEXT PRIMARY KEY, token TEXT UNIQUE, name TEXT, email TEXT, profile_id TEXT,
    status TEXT DEFAULT 'Sent', answers TEXT, created_by TEXT,
    submitted_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
}
async function ensureAccounts() {
  await sql`CREATE TABLE IF NOT EXISTS employee_accounts (
    id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, system TEXT, account TEXT,
    access_level TEXT, status TEXT, source TEXT, notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
}
const parseAns = (v: any): Record<string, string> => { try { const a = typeof v === 'string' ? JSON.parse(v) : v; return a && typeof a === 'object' ? a : {}; } catch { return {}; } };
const origin = (req: Request) => process.env.NEXTAUTH_URL || `${req.headers.get('x-forwarded-proto') ?? 'https'}://${req.headers.get('host')}`;
const tools = () => FIRM_SYSTEMS.map(s => ({ name: s, hint: SYSTEM_HINTS[s] ?? '' }));

export async function GET(req: Request) {
  await ensure();
  const u = new URL(req.url);
  const token = u.searchParams.get('token');
  if (token) {
    const [row] = await sql`SELECT name, status, answers FROM tools_surveys WHERE token = ${token}` as any[];
    if (!row) return NextResponse.json({ error: 'This link is invalid or has expired.' }, { status: 404 });
    return NextResponse.json({ row: { name: row.name ?? '', status: row.status, tools: tools(), answers: row.status === 'Completed' ? parseAns(row.answers) : {} } });
  }
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const profileId = u.searchParams.get('profileId');
  if (profileId) {
    const rows = await sql`SELECT id, token, name, email, status, submitted_at, created_at FROM tools_surveys WHERE profile_id = ${profileId} ORDER BY created_at DESC` as any[];
    return NextResponse.json({ rows });
  }
  const rows = await sql`SELECT id, token, name, email, status, profile_id, submitted_at, created_at FROM tools_surveys ORDER BY created_at DESC` as any[];
  return NextResponse.json({ rows });
}

export async function POST(req: Request) {
  await ensure();
  const b = await req.json();

  // Public submit — guarded by the token.
  if (b.action === 'submit') {
    const [row] = await sql`SELECT * FROM tools_surveys WHERE token = ${b.token}` as any[];
    if (!row) return NextResponse.json({ error: 'This link is invalid or has expired.' }, { status: 404 });
    if (row.status === 'Completed') return NextResponse.json({ error: 'This survey was already submitted.', done: true }, { status: 409 });
    const answers: Record<string, string> = (b.answers && typeof b.answers === 'object') ? b.answers : {};
    const name = String(row.name || '').trim();

    try {
      await ensureAccounts();
      const profile = row.profile_id
        ? (await sql`SELECT * FROM employee_profiles WHERE id = ${row.profile_id}` as any[])[0]
        : (name ? await findOrCreateProfileByName(name) : null);
      if (profile) {
        const email = String(profile.email ?? '').trim();
        // Sync each tool into Accounts & Access.
        for (const t of FIRM_SYSTEMS) {
          const ans = answers[t]; // 'use' | 'access' | 'no'
          if (!ans || ans === 'no') {
            // If they report no access, close any existing account for it.
            await sql`UPDATE employee_accounts SET status = 'Closed', notes = 'Reported no access (tools survey)' WHERE profile_id = ${profile.id} AND lower(system) = ${t.toLowerCase()} AND lower(coalesce(status,'')) <> 'closed'`;
            continue;
          }
          const status = ans === 'use' ? 'Active' : 'Needs review';
          const notes = ans === 'access' ? 'Has access — does not use (tools survey)' : 'Confirmed via tools survey';
          const [ex] = await sql`SELECT id FROM employee_accounts WHERE profile_id = ${profile.id} AND lower(system) = ${t.toLowerCase()} LIMIT 1` as any[];
          if (ex) await sql`UPDATE employee_accounts SET status = ${status}, source = 'Survey', notes = ${notes} WHERE id = ${ex.id}`;
          else await sql`INSERT INTO employee_accounts (id, profile_id, system, account, access_level, status, source, notes)
            VALUES (${cuid()}, ${profile.id}, ${t}, ${email}, ${'Standard user'}, ${status}, ${'Survey'}, ${notes})`;
        }
        // File a summary to the Employee File.
        const lines = FIRM_SYSTEMS.map(t => { const a = answers[t]; return a ? `${t}: ${a === 'use' ? 'Uses it' : a === 'access' ? 'Has access, does not use' : 'No access'}` : ''; }).filter(Boolean);
        const summary = ['Completed the Tools & Access survey.', ...lines].join('\n');
        await sql`ALTER TABLE employee_files ADD COLUMN IF NOT EXISTS source_ref TEXT`;
        const ref = `tools-survey:${row.id}`;
        const [exf] = await sql`SELECT id FROM employee_files WHERE profile_id = ${profile.id} AND source_ref = ${ref} LIMIT 1` as any[];
        if (exf) await sql`UPDATE employee_files SET summary = ${summary}, doc_date = ${new Date().toISOString().slice(0, 10)} WHERE id = ${exf.id}`;
        else await sql`INSERT INTO employee_files (id, profile_id, category, title, doc_date, summary, what_we_did, next_steps, author, attachment_name, attachment_data, source_ref)
          VALUES (${cuid()}, ${profile.id}, 'Tools & Access', 'Tools & Access survey', ${new Date().toISOString().slice(0, 10)}, ${summary}, ${''}, ${''}, ${name}, ${null}, ${null}, ${ref})`;
      }
    } catch { /* best-effort */ }

    await sql`UPDATE tools_surveys SET answers = ${JSON.stringify(answers)}, status = 'Completed', submitted_at = NOW() WHERE id = ${row.id}`;
    return NextResponse.json({ ok: true });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (b.action === 'create') {
    const name = String(b.name ?? '').trim();
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });
    const id = cuid(); const token = cuid() + cuid();
    await sql`INSERT INTO tools_surveys (id, token, name, email, profile_id, status, created_by)
      VALUES (${id}, ${token}, ${name}, ${String(b.email ?? '').trim() || null}, ${b.profileId ?? null}, 'Sent', ${(session.user as any).email ?? null})`;
    const url = `${origin(req)}/tools-survey/${token}`;
    const [row] = await sql`SELECT id, token, name, email, status, created_at FROM tools_surveys WHERE id = ${id}` as any[];
    return NextResponse.json({ row, url }, { status: 201 });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  await sql`DELETE FROM tools_surveys WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}

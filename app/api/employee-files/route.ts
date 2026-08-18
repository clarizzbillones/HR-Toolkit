export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql, cuid } from '@/lib/db';
import { EXTRA_COLS, staffToProfile } from '@/lib/employeeProfile';
import { syncAllForProfile, normName } from '@/lib/employeeFiles';

// Employee Files is HR-admin-only; enforce it on every request.
async function requireHrAdmin() {
  const session = await getServerSession(authOptions);
  return !!session?.user;
}
const FORBIDDEN = () => NextResponse.json({ error: 'Forbidden' }, { status: 403 });

// Standalone "Employee Files" module — independent of Staffing / Coaching /
// Reviews. Each profile has a photo + details; each has a list of documents
// (review summaries, coaching, dated remarks/timeline with what-we-did /
// next-steps). Photos/attachments are data URLs in TEXT columns.
async function ensure() {
  await sql`CREATE TABLE IF NOT EXISTS employee_profiles (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, photo TEXT, position TEXT, department TEXT,
    email TEXT, phone TEXT, start_date TEXT, details TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  for (const c of EXTRA_COLS) await sql.unsafe(`ALTER TABLE employee_profiles ADD COLUMN IF NOT EXISTS ${c} TEXT`);
  await sql`ALTER TABLE employee_profiles ADD COLUMN IF NOT EXISTS offboarded BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`ALTER TABLE employee_profiles ADD COLUMN IF NOT EXISTS offboarded_date TEXT`;
  await sql`ALTER TABLE employee_profiles ADD COLUMN IF NOT EXISTS accounts_locked BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`ALTER TABLE employee_profiles ADD COLUMN IF NOT EXISTS docs_locked BOOLEAN NOT NULL DEFAULT FALSE`;
  // Mirror of Staffing's custom columns (JSON map keyed by column name), so
  // fields like "Personal Email" carry into the Employee File.
  await sql`ALTER TABLE employee_profiles ADD COLUMN IF NOT EXISTS extra TEXT`;
  await sql`CREATE TABLE IF NOT EXISTS employee_files (
    id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, category TEXT, title TEXT, doc_date TEXT,
    summary TEXT, what_we_did TEXT, next_steps TEXT, author TEXT,
    attachment_name TEXT, attachment_data TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
}

const stripDoc = (d: any) => ({ ...d, attachment_data: undefined, has_attachment: !!d.attachment_data });

export async function GET(req: Request) {
  if (!(await requireHrAdmin())) return FORBIDDEN();
  await ensure();
  const id = new URL(req.url).searchParams.get('id');
  if (id) {
    const [exists] = await sql`SELECT id FROM employee_profiles WHERE id = ${id}` as any[];
    if (!exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    // Auto-refresh from every source (Staffing / Coaching / Reviews) on open, so
    // the file is always current without anyone clicking "Pull".
    try { await syncAllForProfile(id); } catch { /* best-effort */ }
    const [profile] = await sql`SELECT * FROM employee_profiles WHERE id = ${id}` as any[];
    const docs = await sql`SELECT * FROM employee_files WHERE profile_id = ${id} ORDER BY doc_date DESC NULLS LAST, created_at DESC`;
    return NextResponse.json({ profile, docs: (docs as any[]).map(stripDoc) });
  }
  // List: profiles with a doc count for the tiles. The Employees/Contractors
  // split follows Staffing's worker type, so overlay the current Staffing value
  // (matched by name) onto each profile.
  const rows = await sql`
    SELECT p.*, (SELECT COUNT(*)::int FROM employee_files f WHERE f.profile_id = p.id) AS doc_count,
      (SELECT s.worker_type FROM staff_directory s WHERE lower(s.name) = lower(p.name) AND COALESCE(NULLIF(TRIM(s.worker_type), ''), '') <> '' LIMIT 1) AS staff_worker_type
    FROM employee_profiles p ORDER BY p.name ASC` as any[];
  const profiles = rows.map(({ staff_worker_type, ...p }) => ({ ...p, worker_type: staff_worker_type ?? p.worker_type }));
  return NextResponse.json({ profiles });
}

export async function POST(req: Request) {
  if (!(await requireHrAdmin())) return FORBIDDEN();
  await ensure();
  const b = await req.json();

  // Create one profile per Staffing employee that doesn't have a file yet.
  if (b.action === 'sync-staffing') {
    let staff: any[] = [];
    try { staff = await sql`SELECT * FROM staff_directory ORDER BY name ASC` as any[]; } catch { /* no table */ }
    let created = 0;
    for (const s of staff) {
      const nm = String(s.name ?? '').trim();
      if (!nm) continue;
      const [exists] = await sql`SELECT id FROM employee_profiles WHERE lower(name) = ${nm.toLowerCase()} LIMIT 1` as any[];
      if (exists) continue;
      await sql`INSERT INTO employee_profiles ${sql({ id: cuid(), name: nm, ...staffToProfile(s) })}`;
      created++;
    }
    const profiles = await sql`
      SELECT p.*, (SELECT COUNT(*)::int FROM employee_files f WHERE f.profile_id = p.id) AS doc_count
      FROM employee_profiles p ORDER BY p.name ASC`;
    return NextResponse.json({ profiles, created });
  }

  // Lock / unlock the Accounts & Access list for a profile (prevents accidental
  // edits or deletions). Partial update — does not touch other profile fields.
  if (b.action === 'set-accounts-lock' && b.id) {
    await sql`UPDATE employee_profiles SET accounts_locked = ${!!b.locked} WHERE id = ${b.id}`;
    const [profile] = await sql`SELECT * FROM employee_profiles WHERE id = ${b.id}` as any[];
    return NextResponse.json({ profile });
  }
  if (b.action === 'set-docs-lock' && b.id) {
    await sql`UPDATE employee_profiles SET docs_locked = ${!!b.locked} WHERE id = ${b.id}`;
    const [profile] = await sql`SELECT * FROM employee_profiles WHERE id = ${b.id}` as any[];
    return NextResponse.json({ profile });
  }

  // Resync one profile from Staffing and report what matched — so a name
  // mismatch (why an edited Staffing email wouldn't flow through) is visible.
  // Pass `linkName` to first rename the profile to that Staffing name (fixing a
  // spelling mismatch), then sync.
  if (b.action === 'resync-report' && b.id) {
    if (b.linkName && String(b.linkName).trim()) {
      await sql`UPDATE employee_profiles SET name = ${String(b.linkName).trim()} WHERE id = ${b.id}`;
    }
    try { await syncAllForProfile(b.id); } catch { /* best-effort */ }
    const [profile] = await sql`SELECT * FROM employee_profiles WHERE id = ${b.id}` as any[];
    const key = normName(profile?.name);
    const staffAll = await sql`SELECT name, email FROM staff_directory` as any[];
    const srow = staffAll.find(r => normName(r.name) === key) ?? null;
    let offMatch: any = null;
    if (!srow) { try { const offAll = await sql`SELECT name, email FROM offboarded_staff` as any[]; offMatch = offAll.find(r => normName(r.name) === key) ?? null; } catch { /* ignore */ } }
    // No exact match — offer the closest Staffing names (typo-tolerant), so a
    // spelling difference like "Taffe" vs "Taaffe" can be linked in one click.
    let candidates: { name: string; email: string | null }[] = [];
    if (!srow) {
      const lev = (a: string, bb: string) => {
        const m = a.length, n = bb.length; if (!m) return n; if (!n) return m;
        const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
        for (let j = 1; j <= n; j++) d[0][j] = j;
        for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
          d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === bb[j - 1] ? 0 : 1));
        return d[m][n];
      };
      candidates = staffAll
        .map(r => ({ name: r.name as string, email: (r.email ?? null) as string | null, d: lev(key, normName(r.name)) }))
        .filter(r => r.d <= 3)
        .sort((a, b2) => a.d - b2.d)
        .slice(0, 3)
        .map(({ name, email }) => ({ name, email }));
    }
    return NextResponse.json({
      profile, matched: !!srow,
      staffingName: srow?.name ?? null, staffingEmail: srow?.email ?? null,
      offboardedMatch: offMatch ? { name: offMatch.name, email: offMatch.email } : null,
      candidates,
    });
  }

  if (!b.name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });
  const id = cuid();
  const row: Record<string, any> = {
    id, name: b.name.trim(), photo: b.photo ?? null, position: b.position ?? null, department: b.department ?? null,
    email: b.email ?? null, phone: b.phone ?? null, start_date: b.start_date ?? null, details: b.details ?? null,
  };
  for (const c of EXTRA_COLS) row[c] = b[c] ?? null;
  await sql`INSERT INTO employee_profiles ${sql(row)}`;
  const [profile] = await sql`SELECT * FROM employee_profiles WHERE id = ${id}`;
  return NextResponse.json({ profile }, { status: 201 });
}

export async function PATCH(req: Request) {
  if (!(await requireHrAdmin())) return FORBIDDEN();
  await ensure();
  const b = await req.json();
  if (!b.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const updates: Record<string, any> = {
    name: b.name ?? '', photo: b.photo ?? null, position: b.position ?? null, department: b.department ?? null,
    email: b.email ?? null, phone: b.phone ?? null, start_date: b.start_date ?? null, details: b.details ?? null,
  };
  for (const c of EXTRA_COLS) updates[c] = b[c] ?? null;
  await sql`UPDATE employee_profiles SET ${sql(updates)} WHERE id = ${b.id}`;
  const [profile] = await sql`SELECT * FROM employee_profiles WHERE id = ${b.id}` as any[];
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ profile });
}

export async function DELETE(req: Request) {
  if (!(await requireHrAdmin())) return FORBIDDEN();
  await ensure();
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  await sql`DELETE FROM employee_files WHERE profile_id = ${id}`;
  await sql`DELETE FROM employee_profiles WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}

export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql, cuid } from '@/lib/db';
import { defaultExcluded } from '@/lib/offboarding';
import { parseDoc, docSignedOff, emptyDoc } from '@/lib/offboardingDoc';
import { attachPdfToEmployeeFile, normName } from '@/lib/employeeFiles';
import { offboardingDocPdfDataUrl } from '@/lib/employeePdf';

// Offboarding tracker: one record per departing employee with a checklist state
// (item id -> boolean) drawn from lib/offboarding.ts.
async function ensure() {
  await sql`CREATE TABLE IF NOT EXISTS offboarding (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, position TEXT, manager TEXT,
    separation_date TEXT, separation_type TEXT, prepared_by TEXT,
    checklist TEXT, notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`ALTER TABLE offboarding ADD COLUMN IF NOT EXISTS dob TEXT`;
  await sql`ALTER TABLE offboarding ADD COLUMN IF NOT EXISTS hire_date TEXT`;
  await sql`ALTER TABLE offboarding ADD COLUMN IF NOT EXISTS offer_severance BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`ALTER TABLE offboarding ADD COLUMN IF NOT EXISTS excluded TEXT`;
  await sql`ALTER TABLE offboarding ADD COLUMN IF NOT EXISTS offboarded BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`ALTER TABLE offboarding ADD COLUMN IF NOT EXISTS doc TEXT`;
}
const lc = (s: any) => String(s ?? '').trim().toLowerCase();
async function ensureOffboardedStaff() {
  await sql`CREATE TABLE IF NOT EXISTS offboarded_staff (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, position TEXT, dialpad TEXT, personal_phone TEXT, email TEXT,
    start_date TEXT, dob TEXT, favorite_color TEXT, favorite_treat TEXT, note TEXT, ktn TEXT, marriott TEXT,
    delta TEXT, offboarded TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  for (const c of ['southwest', 'worker_type', 'american']) await sql.unsafe(`ALTER TABLE offboarded_staff ADD COLUMN IF NOT EXISTS ${c} TEXT`);
}
const gid = (p: string) => `${p}${Date.now()}${Math.random().toString(36).slice(2, 7)}`;

// Move the employee to (or back from) Staffing's Offboarded tab, and flag their
// Employee File so the tile shows under Offboarded there too.
async function setOffboarded(name: string, on: boolean, date: string | null) {
  const key = lc(name);
  try {
    await sql`ALTER TABLE employee_profiles ADD COLUMN IF NOT EXISTS offboarded BOOLEAN NOT NULL DEFAULT FALSE`;
    await sql`ALTER TABLE employee_profiles ADD COLUMN IF NOT EXISTS offboarded_date TEXT`;
    await sql`UPDATE employee_profiles SET offboarded = ${on}, offboarded_date = ${on ? date : null} WHERE lower(name) = ${key}`;
  } catch { /* no table */ }
  try {
    await ensureOffboardedStaff();
    if (on) {
      const [r] = await sql`SELECT * FROM staff_directory WHERE lower(name) = ${key} LIMIT 1` as any[];
      if (r) {
        const [ex] = await sql`SELECT id FROM offboarded_staff WHERE lower(name) = ${key} LIMIT 1` as any[];
        if (!ex) await sql`INSERT INTO offboarded_staff (id,name,worker_type,position,dialpad,personal_phone,email,start_date,dob,favorite_color,favorite_treat,note,ktn,marriott,delta,southwest,american,offboarded)
          VALUES (${gid('of')},${r.name},${r.worker_type ?? 'Employee'},${r.position ?? null},${r.dialpad ?? null},${r.personal_phone ?? null},${r.email ?? null},${r.start_date ?? null},${r.dob ?? null},${r.favorite_color ?? null},${r.favorite_treat ?? null},${r.note ?? null},${r.ktn ?? null},${r.marriott ?? null},${r.delta ?? null},${r.southwest ?? null},${r.american ?? null},${date ?? ''})`;
        await sql`DELETE FROM staff_directory WHERE lower(name) = ${key}`;
      }
    } else {
      const [r] = await sql`SELECT * FROM offboarded_staff WHERE lower(name) = ${key} LIMIT 1` as any[];
      if (r) {
        const [ex] = await sql`SELECT id FROM staff_directory WHERE lower(name) = ${key} LIMIT 1` as any[];
        if (!ex) await sql`INSERT INTO staff_directory (id,name,worker_type,position,dialpad,personal_phone,email,start_date,dob,favorite_color,favorite_treat,note,ktn,marriott,delta,southwest,american)
          VALUES (${gid('st')},${r.name},${r.worker_type ?? 'Employee'},${r.position ?? null},${r.dialpad ?? null},${r.personal_phone ?? null},${r.email ?? null},${r.start_date ?? null},${r.dob ?? null},${r.favorite_color ?? null},${r.favorite_treat ?? null},${r.note ?? null},${r.ktn ?? null},${r.marriott ?? null},${r.delta ?? null},${r.southwest ?? null},${r.american ?? null})`;
        await sql`DELETE FROM offboarded_staff WHERE lower(name) = ${key}`;
      }
    }
  } catch { /* best-effort */ }
}
function parseMap(v: any): Record<string, boolean> {
  try { const c = typeof v === 'string' ? JSON.parse(v) : v; if (c && typeof c === 'object') return c; } catch { /* ignore */ }
  return {};
}
function parse(row: any) {
  return { ...row, checklist: parseMap(row.checklist), excluded: parseMap(row.excluded), offer_severance: !!row.offer_severance, doc: parseDoc(row.doc) };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const rows = await sql`SELECT * FROM offboarding ORDER BY separation_date DESC NULLS LAST, created_at DESC` as any[];
  let employees: any[] = [];
  try { employees = await sql`SELECT name, position, dob, start_date, email FROM staff_directory ORDER BY name ASC` as any[]; } catch { /* no table */ }
  return NextResponse.json({ rows: rows.map(parse), employees });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const b = await req.json();

  // Move an employee to (or back from) the Offboarded list.
  if (b.action === 'mark-offboarded') {
    if (!b.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const on = b.offboarded !== false;
    const [rec] = await sql`SELECT * FROM offboarding WHERE id = ${b.id}` as any[];
    if (!rec) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    await sql`UPDATE offboarding SET offboarded = ${on} WHERE id = ${b.id}`;
    await setOffboarded(rec.name, on, rec.separation_date ?? null);
    const [row] = await sql`SELECT * FROM offboarding WHERE id = ${b.id}` as any[];
    return NextResponse.json({ row: parse(row) });
  }

  if (!b.name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });
  const id = cuid();
  // Pre-mark the age-40 steps N/A when the employee is under 40 at separation.
  const excluded = defaultExcluded(b.dob, b.separation_date);

  // Seed Catie's "Accounts to close" from the employee's maintained Accounts &
  // Access list (Employee File) when they have one, so offboarding starts with
  // their real systems. Falls back to the standard template otherwise.
  let docJson: string | null = null;
  try {
    // Match the profile with the same normalized-name logic used across the app,
    // so a stray space / hidden character in a stored name never breaks the
    // full-circle mirror (the old exact lower(name) match did).
    const key = normName(b.name);
    const profs = await sql`SELECT id, name FROM employee_profiles` as any[];
    const prof = profs.find(p => normName(p.name) === key);
    if (prof) {
      const accts = await sql`SELECT system, access_level FROM employee_accounts WHERE profile_id = ${prof.id} AND lower(coalesce(status,'')) <> 'closed' ORDER BY lower(system) ASC` as any[];
      if (accts.length) {
        const doc = emptyDoc();
        doc.accounts = accts.map(a => ({ id: gid('acct'), label: String(a.system || 'Account'), hint: a.access_level ? String(a.access_level) : undefined, cell: {} }));
        docJson = JSON.stringify(doc);
      }
    }
  } catch { /* best-effort — fall back to the default template */ }

  await sql`INSERT INTO offboarding (id, name, position, manager, separation_date, separation_type, prepared_by, checklist, notes, dob, hire_date, offer_severance, excluded, doc)
    VALUES (${id}, ${b.name.trim()}, ${b.position ?? null}, ${b.manager ?? null}, ${b.separation_date ?? null}, ${b.separation_type ?? null}, ${b.prepared_by ?? null}, ${'{}'}, ${b.notes ?? null}, ${b.dob ?? null}, ${b.hire_date ?? null}, ${!!b.offer_severance}, ${JSON.stringify(excluded)}, ${docJson})`;
  const [row] = await sql`SELECT * FROM offboarding WHERE id = ${id}`;
  return NextResponse.json({ row: parse(row) }, { status: 201 });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const b = await req.json();
  if (!b.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  // Re-pull the employee's current Accounts & Access into "Accounts to close",
  // for an offboarding created before their tools were listed. Keeps any
  // close-progress already entered (matched by tool name).
  if (b.action === 'resync-accounts') {
    const [rec] = await sql`SELECT * FROM offboarding WHERE id = ${b.id}` as any[];
    if (!rec) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const key = normName(rec.name);
    const profs = await sql`SELECT id, name FROM employee_profiles` as any[];
    const prof = profs.find(p => normName(p.name) === key);
    if (!prof) return NextResponse.json({ error: 'No Employee File found for this person yet.' }, { status: 404 });
    const accts = await sql`SELECT system, access_level FROM employee_accounts WHERE profile_id = ${prof.id} AND lower(coalesce(status,'')) <> 'closed' ORDER BY lower(system) ASC` as any[];
    const doc = parseDoc(rec.doc);
    const byLabel: Record<string, any> = {};
    for (const a of doc.accounts) { const k = String(a.label ?? '').trim().toLowerCase(); if (k && !(k in byLabel)) byLabel[k] = a.cell; }
    doc.accounts = accts.map(a => { const label = String(a.system || 'Account'); return { id: gid('acct'), label, hint: a.access_level ? String(a.access_level) : undefined, cell: byLabel[label.trim().toLowerCase()] ?? {} }; });
    await sql`UPDATE offboarding SET doc = ${JSON.stringify(doc)} WHERE id = ${b.id}`;
    const [row] = await sql`SELECT * FROM offboarding WHERE id = ${b.id}` as any[];
    return NextResponse.json({ row: parse(row), synced: accts.length });
  }

  const updates: Record<string, any> = {};
  for (const k of ['name', 'position', 'manager', 'separation_date', 'separation_type', 'prepared_by', 'notes', 'dob', 'hire_date'] as const) {
    if (k in b) updates[k] = b[k] ?? null;
  }
  if (typeof b.offer_severance === 'boolean') updates.offer_severance = b.offer_severance;
  if (b.checklist && typeof b.checklist === 'object') updates.checklist = JSON.stringify(b.checklist);
  if (b.excluded && typeof b.excluded === 'object') updates.excluded = JSON.stringify(b.excluded);
  // When Catie's document is provided, detect a full sign-off so we can
  // auto-complete: move the employee to Offboarded and file the signed PDF.
  const signed = b.doc && typeof b.doc === 'object' ? docSignedOff(parseDoc(b.doc)) : false;
  if (b.doc && typeof b.doc === 'object') updates.doc = JSON.stringify(b.doc);
  if (!Object.keys(updates).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const [prev] = await sql`SELECT offboarded, name, separation_date FROM offboarding WHERE id = ${b.id}` as any[];
  if (!prev) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  // Flag the record offboarded on the sign-off transition (idempotent).
  if (signed && !prev.offboarded) updates.offboarded = true;

  await sql`UPDATE offboarding SET ${sql(updates)} WHERE id = ${b.id}`;
  const [row] = await sql`SELECT * FROM offboarding WHERE id = ${b.id}` as any[];
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (signed) {
    // Move to the Offboarded lists once, then (re)file the signed PDF so the
    // employee's file always has the latest version.
    if (!prev.offboarded) await setOffboarded(prev.name, true, prev.separation_date ?? null);
    try {
      const parsed = parse(row);
      const dataUrl = await offboardingDocPdfDataUrl(parsed);
      await attachPdfToEmployeeFile({
        name: prev.name, category: 'Offboarding', title: 'Offboarding Checklist (signed)',
        docDate: prev.separation_date ?? null,
        attName: `Offboarding-${String(prev.name).replace(/[^\w]+/g, '-')}.pdf`,
        dataUrl, sourceRef: `offboarding:${b.id}`,
        summary: 'Signed offboarding document — HR, Ops, and IT complete and signed off by Catie.',
        author: 'Catie',
      });
    } catch { /* best-effort — never block the save */ }
  }
  return NextResponse.json({ row: parse(row) });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  await sql`DELETE FROM offboarding WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}

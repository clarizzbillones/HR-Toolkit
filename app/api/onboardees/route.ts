export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { sql, cuid } from '@/lib/db';
import { parseDoc, docSignedOff, emptyDoc } from '@/lib/onboardingDoc';
import { attachPdfToEmployeeFile } from '@/lib/employeeFiles';
import { onboardingDocPdfDataUrl } from '@/lib/employeePdf';

async function ensureTable() {
  await sql`CREATE TABLE IF NOT EXISTS onboardees (
    id text PRIMARY KEY,
    name text NOT NULL,
    email text, position text, worker_type text DEFAULT 'Employee',
    guide text DEFAULT 'General', start_date text, dob text, phone text,
    status text DEFAULT 'In Progress', progress text DEFAULT '{}',
    created_at timestamptz DEFAULT now()
  )`;
  // Journey stage (offer_sent → offer_viewed → offer_accepted → onboarding →
  // complete) and a scheduled onboarding date, both added after the fact.
  await sql`ALTER TABLE onboardees ADD COLUMN IF NOT EXISTS stage text DEFAULT 'onboarding'`;
  await sql`ALTER TABLE onboardees ADD COLUMN IF NOT EXISTS onboarding_date text`;
  // A category tag (New hire / Re-hire / Transfer …) and a personal plan/to-do
  // list, so people who skip the standard guide can still be tracked.
  await sql`ALTER TABLE onboardees ADD COLUMN IF NOT EXISTS tag text`;
  await sql`ALTER TABLE onboardees ADD COLUMN IF NOT EXISTS todos text DEFAULT '[]'`;
  // Free-text HR note, shown on the status report.
  await sql`ALTER TABLE onboardees ADD COLUMN IF NOT EXISTS note text`;
  // Original rehire date, for people coming back to the firm.
  await sql`ALTER TABLE onboardees ADD COLUMN IF NOT EXISTS rehire_date text`;
  // Catie's streamlined onboarding document (HR → Ops → IT, initials/dates),
  // parallel to the offboarding document. Stored as JSON.
  await sql`ALTER TABLE onboardees ADD COLUMN IF NOT EXISTS doc text`;
}
const lc = (s: any) => String(s ?? '').trim().toLowerCase();
const gid = (p: string) => `${p}${Date.now()}${Math.random().toString(36).slice(2, 7)}`;

// Make sure the Staffing directory can receive a completed onboardee
async function ensureStaff() {
  await sql`CREATE TABLE IF NOT EXISTS staff_directory (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, position TEXT, dialpad TEXT, personal_phone TEXT, email TEXT,
    start_date TEXT, dob TEXT, favorite_color TEXT, favorite_treat TEXT, note TEXT, ktn TEXT, marriott TEXT,
    delta TEXT, weight TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  for (const c of ['southwest', 'american', 'worker_type'])
    await sql`ALTER TABLE staff_directory ADD COLUMN IF NOT EXISTS ${sql(c)} TEXT`;
}

// Attach the parsed onboarding document to every returned row.
function parse(row: any) { return { ...row, doc: parseDoc(row.doc) }; }

export async function GET() {
  await ensureTable();
  const rows = await sql`SELECT * FROM onboardees ORDER BY created_at DESC` as any[];
  return NextResponse.json({ rows: rows.map(parse) });
}

export async function POST(req: Request) {
  await ensureTable();
  const b = await req.json();
  if (!b.name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });
  const id = cuid();

  // Seed Catie's "Accounts to open" from the hire's maintained Accounts &
  // Access list (Employee File) if they already have a profile (e.g. a re-hire),
  // so onboarding starts with their real systems. Falls back to the standard
  // template otherwise.
  let docJson: string | null = null;
  try {
    const [prof] = await sql`SELECT id FROM employee_profiles WHERE lower(name) = ${lc(b.name)} LIMIT 1` as any[];
    if (prof) {
      const accts = await sql`SELECT system, access_level FROM employee_accounts WHERE profile_id = ${prof.id} AND lower(coalesce(status,'')) <> 'closed' ORDER BY lower(system) ASC` as any[];
      if (accts.length) {
        const doc = emptyDoc();
        doc.accounts = accts.map(a => ({ id: gid('acct'), label: String(a.system || 'Account'), hint: a.access_level ? String(a.access_level) : undefined, cell: {} }));
        docJson = JSON.stringify(doc);
      }
    }
  } catch { /* best-effort — fall back to the default template */ }

  await sql`INSERT INTO onboardees (id, name, email, position, worker_type, guide, start_date, dob, phone, status, progress, stage, onboarding_date, tag, todos, doc)
    VALUES (${id}, ${b.name}, ${b.email ?? null}, ${b.position ?? null}, ${b.worker_type ?? 'Employee'}, ${b.guide ?? 'General'}, ${b.start_date ?? null}, ${b.dob ?? null}, ${b.phone ?? null}, 'In Progress', '{}', ${b.stage ?? null}, ${b.onboarding_date ?? null}, ${b.tag ?? null}, '[]', ${docJson})`;
  const [row] = await sql`SELECT * FROM onboardees WHERE id = ${id}`;
  return NextResponse.json({ row: parse(row) }, { status: 201 });
}

export async function PATCH(req: Request) {
  await ensureTable();
  const { id, complete, progress, todos, doc, ...f } = await req.json();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  if (progress !== undefined) await sql`UPDATE onboardees SET progress = ${JSON.stringify(progress)} WHERE id = ${id}`;
  if (todos !== undefined) await sql`UPDATE onboardees SET todos = ${JSON.stringify(todos)} WHERE id = ${id}`;
  for (const k of ['name', 'email', 'position', 'worker_type', 'guide', 'start_date', 'dob', 'phone', 'status', 'stage', 'onboarding_date', 'tag', 'note', 'rehire_date'] as const) {
    if (f[k] !== undefined) await sql`UPDATE onboardees SET ${sql(k)} = ${f[k]} WHERE id = ${id}`;
  }
  // Catie's onboarding document. Detect a full sign-off so we can auto-file the
  // signed PDF to the new hire's Employee File (creating the profile if needed).
  const signed = doc && typeof doc === 'object' ? docSignedOff(parseDoc(doc)) : false;
  if (doc !== undefined) await sql`UPDATE onboardees SET doc = ${doc ? JSON.stringify(doc) : null} WHERE id = ${id}`;

  // On completion, push the person into the Staffing directory
  if (complete) {
    const [p] = await sql`SELECT * FROM onboardees WHERE id = ${id}`;
    await sql`UPDATE onboardees SET status = 'Complete', stage = 'complete' WHERE id = ${id}`;
    if (p) {
      await ensureStaff();
      const exists = await sql`SELECT id FROM staff_directory WHERE lower(name) = lower(${p.name}) LIMIT 1`;
      if (!exists.length) {
        await sql`INSERT INTO staff_directory (id, name, position, email, personal_phone, start_date, dob, worker_type)
          VALUES (${cuid()}, ${p.name}, ${p.position ?? null}, ${p.email ?? null}, ${p.phone ?? null}, ${p.start_date ?? null}, ${p.dob ?? null}, ${p.worker_type ?? 'Employee'})`;
      }
    }
    const [row] = await sql`SELECT * FROM onboardees WHERE id = ${id}`;
    return NextResponse.json({ row: parse(row), staffed: true });
  }

  const [row] = await sql`SELECT * FROM onboardees WHERE id = ${id}` as any[];
  if (signed) {
    // (Re)file the signed onboarding PDF so the Employee File always has the
    // latest version. Best-effort — never block the save.
    try {
      const parsed = parse(row);
      const dataUrl = await onboardingDocPdfDataUrl(parsed);
      await attachPdfToEmployeeFile({
        name: row.name, category: 'Onboarding', title: 'Onboarding Checklist (signed)',
        docDate: row.start_date ?? null,
        attName: `Onboarding-${String(row.name).replace(/[^\w]+/g, '-')}.pdf`,
        dataUrl, sourceRef: `onboarding:${id}`,
        summary: 'Signed onboarding document — HR, Ops, and IT complete and signed off by Catie.',
        author: 'Catie',
      });
    } catch { /* best-effort */ }
  }
  return NextResponse.json({ row: parse(row) });
}

export async function DELETE(req: Request) {
  await ensureTable();
  const { id } = await req.json();
  await sql`DELETE FROM onboardees WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}

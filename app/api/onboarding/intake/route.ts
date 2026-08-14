export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql, cuid } from '@/lib/db';
import { attachPdfToEmployeeFile, findOrCreateProfileByName } from '@/lib/employeeFiles';
import { intakeFields, intakeUploads, isIntakeRole, roleLabel, roleMeta, fieldLabel, type IntakeRole } from '@/lib/onboardingIntake';

// Per-hire intake: HR creates a tokenized link (create/list/delete require a
// session); the fill-in page + submit are public, guarded by the token.
const MAX_FILE = 6 * 1024 * 1024; // ~6 MB per file (data URL in TEXT)

async function ensure() {
  await sql`CREATE TABLE IF NOT EXISTS onboarding_intakes (
    id TEXT PRIMARY KEY, token TEXT UNIQUE, role TEXT NOT NULL,
    name TEXT, email TEXT, status TEXT DEFAULT 'Sent', answers TEXT,
    onboardee_id TEXT, profile_id TEXT, created_by TEXT,
    submitted_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS onboarding_intake_files (
    id TEXT PRIMARY KEY, intake_id TEXT NOT NULL, name TEXT, kind TEXT,
    data TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`ALTER TABLE onboarding_intake_files ADD COLUMN IF NOT EXISTS label TEXT`;
}
async function ensureStaff() {
  await sql`CREATE TABLE IF NOT EXISTS staff_directory (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, position TEXT, dialpad TEXT, personal_phone TEXT, email TEXT,
    start_date TEXT, dob TEXT, favorite_color TEXT, favorite_treat TEXT, note TEXT, ktn TEXT, marriott TEXT,
    delta TEXT, weight TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  for (const c of ['southwest', 'american', 'worker_type']) await sql`ALTER TABLE staff_directory ADD COLUMN IF NOT EXISTS ${sql(c)} TEXT`;
}
async function ensureOnboardees() {
  await sql`CREATE TABLE IF NOT EXISTS onboardees (
    id text PRIMARY KEY, name text NOT NULL, email text, position text, worker_type text DEFAULT 'Employee',
    guide text DEFAULT 'General', start_date text, dob text, phone text, status text DEFAULT 'In Progress',
    progress text DEFAULT '{}', created_at timestamptz DEFAULT now()
  )`;
  for (const [c, d] of [['stage', `'onboarding'`], ['onboarding_date', 'NULL'], ['tag', 'NULL'], ['todos', `'[]'`], ['note', 'NULL'], ['rehire_date', 'NULL']] as const) {
    await sql.unsafe(`ALTER TABLE onboardees ADD COLUMN IF NOT EXISTS ${c} text DEFAULT ${d}`);
  }
}

const parseAns = (v: any): Record<string, any> => { try { const a = typeof v === 'string' ? JSON.parse(v) : v; return a && typeof a === 'object' ? a : {}; } catch { return {}; } };
const origin = (req: Request) => process.env.NEXTAUTH_URL || `${req.headers.get('x-forwarded-proto') ?? 'https'}://${req.headers.get('host')}`;
const publicRow = (r: any) => ({
  role: r.role, roleLabel: roleLabel(r.role), name: r.name ?? '', status: r.status,
  fields: intakeFields(r.role as IntakeRole), uploads: intakeUploads(r.role as IntakeRole),
});

export async function GET(req: Request) {
  await ensure();
  const u = new URL(req.url);
  const token = u.searchParams.get('token');
  // Public: load the form for a hire to fill in.
  if (token) {
    const [row] = await sql`SELECT * FROM onboarding_intakes WHERE token = ${token}` as any[];
    if (!row) return NextResponse.json({ error: 'This link is invalid or has expired.' }, { status: 404 });
    return NextResponse.json({ row: publicRow(row) });
  }
  // Admin: list every intake.
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const rows = await sql`SELECT id, token, role, name, email, status, onboardee_id, profile_id, submitted_at, created_at FROM onboarding_intakes ORDER BY created_at DESC` as any[];
  return NextResponse.json({ rows });
}

export async function POST(req: Request) {
  await ensure();
  const b = await req.json();

  // Public submit — guarded by the token.
  if (b.action === 'submit') {
    const [row] = await sql`SELECT * FROM onboarding_intakes WHERE token = ${b.token}` as any[];
    if (!row) return NextResponse.json({ error: 'This link is invalid or has expired.' }, { status: 404 });
    if (row.status === 'Completed') return NextResponse.json({ error: 'This form was already submitted.', done: true }, { status: 409 });
    const role = row.role as IntakeRole;
    const answers = (b.answers && typeof b.answers === 'object') ? b.answers : {};
    const files: { name: string; data: string; label?: string }[] = Array.isArray(b.files) ? b.files : [];

    const name = String(answers.full_legal_name || row.name || '').trim();
    if (!name) return NextResponse.json({ error: 'Please enter your full legal name.' }, { status: 400 });
    const email = String(answers.personal_email || row.email || '').trim() || null;
    const meta = roleMeta(role);
    const position = String(answers.role_title || answers.business_name || meta.titleHint || '').trim() || meta.titleHint;
    const startDate = answers.start_date || answers.services_start || null;

    // Store uploaded files (size-guarded).
    for (const f of files) {
      if (!f?.data || !/^data:/.test(f.data)) continue;
      if (f.data.length > MAX_FILE * 1.4) continue; // base64 overhead
      await sql`INSERT INTO onboarding_intake_files (id, intake_id, name, kind, label, data) VALUES (${cuid()}, ${row.id}, ${String(f.name ?? 'file').slice(0, 200)}, ${(f.name ?? '').split('.').pop() ?? ''}, ${String(f.label ?? '').slice(0, 120)}, ${f.data})`;
    }

    // 1) Onboarding dashboard record — update the one created with the link.
    let onboardeeId: string | null = row.onboardee_id || null;
    try {
      await ensureOnboardees();
      if (!onboardeeId) { const [ex] = await sql`SELECT id FROM onboardees WHERE lower(name) = lower(${name}) LIMIT 1` as any[]; if (ex) onboardeeId = ex.id; }
      if (onboardeeId) {
        await sql`UPDATE onboardees SET email = COALESCE(${email}, email), position = ${position}, worker_type = ${meta.workerType}, start_date = COALESCE(${startDate}, start_date), dob = COALESCE(${answers.dob ?? null}, dob), phone = COALESCE(${answers.phone ?? null}, phone), note = ${'Onboarding intake form submitted'} WHERE id = ${onboardeeId}`;
      } else {
        onboardeeId = cuid();
        await sql`INSERT INTO onboardees (id, name, email, position, worker_type, start_date, dob, phone, status, stage, tag)
          VALUES (${onboardeeId}, ${name}, ${email}, ${position}, ${meta.workerType}, ${startDate}, ${answers.dob ?? null}, ${answers.phone ?? null}, 'In Progress', 'onboarding', 'New hire')`;
      }
    } catch { /* best-effort */ }

    // 2) Staffing directory.
    try {
      await ensureStaff();
      const [ex] = await sql`SELECT id FROM staff_directory WHERE lower(name) = lower(${name}) LIMIT 1` as any[];
      if (!ex) await sql`INSERT INTO staff_directory (id, name, position, email, personal_phone, start_date, dob, worker_type, weight, ktn, favorite_color, favorite_treat)
        VALUES (${cuid()}, ${name}, ${position}, ${email}, ${answers.phone ?? null}, ${startDate}, ${answers.dob ?? null}, ${meta.workerType}, ${answers.weight ?? null}, ${answers.tsa_ktn ?? null}, ${answers.favorite_color ?? null}, ${answers.favorite_snack ?? null})`;
    } catch { /* best-effort */ }

    // 3) Employee File profile (fill blanks) + file the uploads and a summary.
    let profileId: string | null = null;
    try {
      const profile = await findOrCreateProfileByName(name);
      if (profile) {
        profileId = profile.id;
        const upd: Record<string, any> = {};
        const setBlank = (col: string, val: any) => { const v = val == null ? '' : String(val).trim(); if (v && !String(profile[col] ?? '').trim()) upd[col] = v; };
        setBlank('email', email); setBlank('phone', answers.phone); setBlank('position', position);
        setBlank('start_date', startDate); setBlank('dob', answers.dob); setBlank('address', answers.home_address);
        setBlank('worker_type', meta.workerType); setBlank('weight', answers.weight); setBlank('ktn', answers.tsa_ktn);
        setBlank('favorite_color', answers.favorite_color); setBlank('favorite_treat', answers.favorite_snack);
        setBlank('details', answers.additional_notes);
        if (Object.keys(upd).length) { try { await sql`UPDATE employee_profiles SET ${sql(upd)} WHERE id = ${profile.id}`; } catch { /* older schema */ } }

        // A summary remark of everything they entered (list fields joined).
        const lines = intakeFields(role).map(f => { const v = answers[f.id]; const val = Array.isArray(v) ? v.filter(Boolean).join('; ') : v; return val ? `${f.label}: ${val}` : ''; }).filter(Boolean);
        const emergency = [answers.emergency_name, answers.emergency_phone].filter(Boolean).join(' · ');
        const summary = [`Submitted the ${roleLabel(role)} onboarding intake form.`, ...lines].join('\n');
        await sql`INSERT INTO employee_files (id, profile_id, category, title, doc_date, summary, what_we_did, next_steps, author, attachment_name, attachment_data, source_ref)
          VALUES (${cuid()}, ${profile.id}, 'Onboarding', ${`Onboarding intake — ${roleLabel(role)}`}, ${new Date().toISOString().slice(0, 10)}, ${summary}, ${''}, ${emergency ? `Emergency contact: ${emergency}` : ''}, ${name}, ${null}, ${null}, ${`intake:${row.id}`})
          ON CONFLICT DO NOTHING`;

        // Each uploaded document as its own filed entry.
        const stored = await sql`SELECT id, name, label, data FROM onboarding_intake_files WHERE intake_id = ${row.id}` as any[];
        let i = 0;
        for (const f of stored) {
          const docType = String(f.label ?? '').trim();
          await attachPdfToEmployeeFile({
            name, category: 'Onboarding',
            title: docType ? `${docType}${f.name ? ` — ${f.name}` : ''}` : `Onboarding document — ${f.name}`,
            docDate: new Date().toISOString().slice(0, 10), attName: f.name || 'document',
            dataUrl: f.data, sourceRef: `intake-file:${row.id}:${i++}`,
            summary: `Uploaded during onboarding intake (${roleLabel(role)})${docType ? ` — ${docType}` : ''}.`, author: name,
          });
        }
      }
    } catch { /* best-effort */ }

    await sql`UPDATE onboarding_intakes SET answers = ${JSON.stringify(answers)}, status = 'Completed', submitted_at = NOW(), onboardee_id = ${onboardeeId}, profile_id = ${profileId} WHERE id = ${row.id}`;
    return NextResponse.json({ ok: true });
  }

  // Everything below requires a session.
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (b.action === 'create') {
    if (!isIntakeRole(b.role)) return NextResponse.json({ error: 'Pick a role' }, { status: 400 });
    const name = String(b.name ?? '').trim();
    if (!name) return NextResponse.json({ error: 'Enter the hire’s name' }, { status: 400 });
    const email = String(b.email ?? '').trim() || null;
    const meta = roleMeta(b.role);
    // Add them to the Onboarding dashboard right away (awaiting their submission).
    let onboardeeId: string | null = null;
    try {
      await ensureOnboardees();
      const [ex] = await sql`SELECT id FROM onboardees WHERE lower(name) = lower(${name}) LIMIT 1` as any[];
      if (ex) onboardeeId = ex.id;
      else {
        onboardeeId = cuid();
        await sql`INSERT INTO onboardees (id, name, email, position, worker_type, status, stage, tag, note)
          VALUES (${onboardeeId}, ${name}, ${email}, ${meta.titleHint}, ${meta.workerType}, 'In Progress', 'onboarding', 'New hire', ${'Awaiting onboarding intake form'})`;
      }
    } catch { /* best-effort */ }
    const id = cuid(); const token = cuid() + cuid();
    await sql`INSERT INTO onboarding_intakes (id, token, role, name, email, status, onboardee_id, created_by)
      VALUES (${id}, ${token}, ${b.role}, ${name}, ${email}, 'Sent', ${onboardeeId}, ${(session.user as any).email ?? null})`;
    const url = `${origin(req)}/onboarding/intake/${token}`;
    const [row] = await sql`SELECT id, token, role, name, email, status, onboardee_id, created_at FROM onboarding_intakes WHERE id = ${id}` as any[];
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
  await sql`DELETE FROM onboarding_intake_files WHERE intake_id = ${id}`;
  await sql`DELETE FROM onboarding_intakes WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}

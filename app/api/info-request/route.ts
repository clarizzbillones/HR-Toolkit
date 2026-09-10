export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql, cuid } from '@/lib/db';
import { normName } from '@/lib/employeeFiles';
import { sendMailAsApp } from '@/lib/graph';
import { FIELDS, DEFAULT_FIELD_IDS, fieldsByIds, infoRequestEmail, type InfoField } from '@/lib/infoRequest';

const SENDER = process.env.REVIEW_REMINDER_SENDER ?? 'clarizz@litson.co';
// Built-in staff_directory column -> employee_profiles column, for the fields
// that have a first-class home in both tables.
const PROFILE_COL: Record<string, string> = { personal_phone: 'phone', address: 'address', dob: 'dob' };

async function ensure() {
  await sql`CREATE TABLE IF NOT EXISTS info_requests (
    id TEXT PRIMARY KEY, token TEXT UNIQUE, name TEXT, email TEXT, profile_id TEXT,
    fields TEXT, answers TEXT, status TEXT DEFAULT 'Sent', created_by TEXT,
    submitted_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
}
const parse = (v: any, fb: any) => { try { const a = typeof v === 'string' ? JSON.parse(v) : v; return a ?? fb; } catch { return fb; } };
const origin = (req: Request) => process.env.NEXTAUTH_URL || `${req.headers.get('x-forwarded-proto') ?? 'https'}://${req.headers.get('host')}`;
const idsOf = (v: any): string[] => { const a = parse(v, DEFAULT_FIELD_IDS); return Array.isArray(a) && a.length ? a.map(String) : DEFAULT_FIELD_IDS; };
const mergeExtra = (raw: any, add: Record<string, string>): string => {
  let obj: any = {}; try { obj = parse(raw, {}) || {}; } catch { obj = {}; }
  return JSON.stringify({ ...obj, ...add });
};

// Make sure any custom (extra-stored) field labels show as Staffing columns.
async function registerStaffColumns(labels: string[]) {
  if (!labels.length) return;
  try {
    await sql`CREATE TABLE IF NOT EXISTS app_settings (id TEXT PRIMARY KEY)`;
    await sql`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS staff_columns TEXT`;
    await sql`INSERT INTO app_settings (id) VALUES ('singleton') ON CONFLICT (id) DO NOTHING`;
    const [row] = await sql`SELECT staff_columns FROM app_settings WHERE id = 'singleton'` as any[];
    const cur: string[] = parse(row?.staff_columns, []) || [];
    const merged = Array.from(new Set([...cur.map(String), ...labels]));
    if (merged.length !== cur.length) await sql`UPDATE app_settings SET staff_columns = ${JSON.stringify(merged)} WHERE id = 'singleton'`;
  } catch { /* best-effort */ }
}

// Write the submitted answers into Staffing + the Employee File.
async function applyAnswers(reqRow: any, answers: Record<string, string>) {
  const fields = fieldsByIds(idsOf(reqRow.fields));
  const name = String(reqRow.name || '').trim();
  const builtin: Record<string, string> = {};   // staff_directory built-in columns
  const extraAdd: Record<string, string> = {};   // custom columns, keyed by label
  const customLabels: string[] = [];
  const summaryLines: string[] = [];
  for (const f of fields) {
    const val = String(answers[f.id] ?? '').trim();
    if (!val) continue;
    if (f.staffCol) builtin[f.staffCol] = val; else { extraAdd[f.label] = val; customLabels.push(f.label); }
    summaryLines.push(`${f.label}: ${val}`);
  }
  if (!summaryLines.length) return;

  // 1) Staffing (staff_directory) — match by normalized name, then email.
  try {
    await sql`ALTER TABLE staff_directory ADD COLUMN IF NOT EXISTS extra TEXT`;
    const staff = await sql`SELECT * FROM staff_directory` as any[];
    const key = normName(name);
    const email = String(reqRow.email || '').trim().toLowerCase();
    const srow = staff.find(s => normName(s.name) === key)
      || (email ? staff.find(s => String(s.email || '').trim().toLowerCase() === email) : null);
    if (srow) {
      const updates: Record<string, any> = { ...builtin };
      if (Object.keys(extraAdd).length) updates.extra = mergeExtra(srow.extra, extraAdd);
      if (Object.keys(updates).length) await sql`UPDATE staff_directory SET ${sql(updates)} WHERE id = ${srow.id}`;
      await registerStaffColumns(customLabels);
    }
  } catch { /* best-effort */ }

  // 2) Employee File — match by linked profile, then name. Update the mapped
  //    columns + custom fields (extra), then file a dated note.
  try {
    await sql`ALTER TABLE employee_profiles ADD COLUMN IF NOT EXISTS extra TEXT`;
    let profile: any = null;
    if (reqRow.profile_id) [profile] = await sql`SELECT * FROM employee_profiles WHERE id = ${reqRow.profile_id}` as any[];
    if (!profile && name) {
      const profs = await sql`SELECT * FROM employee_profiles` as any[];
      profile = profs.find(p => normName(p.name) === normName(name)) || null;
    }
    if (profile) {
      const pUpd: Record<string, any> = {};
      for (const [staffCol, v] of Object.entries(builtin)) { const pc = PROFILE_COL[staffCol]; if (pc) pUpd[pc] = v; }
      if (Object.keys(extraAdd).length) pUpd.extra = mergeExtra(profile.extra, extraAdd);
      if (Object.keys(pUpd).length) await sql`UPDATE employee_profiles SET ${sql(pUpd)} WHERE id = ${profile.id}`;

      const summary = ['Provided personal information via HR info request.', ...summaryLines].join('\n');
      await sql`ALTER TABLE employee_files ADD COLUMN IF NOT EXISTS source_ref TEXT`;
      const ref = `info-request:${reqRow.id}`;
      const [exf] = await sql`SELECT id FROM employee_files WHERE profile_id = ${profile.id} AND source_ref = ${ref} LIMIT 1` as any[];
      const today = new Date().toISOString().slice(0, 10);
      if (exf) await sql`UPDATE employee_files SET summary = ${summary}, doc_date = ${today} WHERE id = ${exf.id}`;
      else await sql`INSERT INTO employee_files (id, profile_id, category, title, doc_date, summary, what_we_did, next_steps, author, attachment_name, attachment_data, source_ref)
        VALUES (${cuid()}, ${profile.id}, 'Personal Info', 'Personal info update', ${today}, ${summary}, ${''}, ${''}, ${name}, ${null}, ${null}, ${ref})`;
    }
  } catch { /* best-effort */ }
}

export async function GET(req: Request) {
  await ensure();
  const u = new URL(req.url);
  const token = u.searchParams.get('token');
  if (token) {
    const [row] = await sql`SELECT name, fields, answers, status FROM info_requests WHERE token = ${token}` as any[];
    if (!row) return NextResponse.json({ error: 'This link is invalid or has expired.' }, { status: 404 });
    const fields = fieldsByIds(idsOf(row.fields)).map((f: InfoField) => ({ id: f.id, label: f.label, type: f.type, hint: f.hint ?? '' }));
    return NextResponse.json({ row: { name: row.name ?? '', fields, status: row.status, answers: row.status === 'Completed' ? parse(row.answers, {}) : {} } });
  }
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const rows = await sql`SELECT id, token, name, email, status, profile_id, fields, submitted_at, created_at FROM info_requests ORDER BY created_at DESC` as any[];
  return NextResponse.json({ rows });
}

export async function POST(req: Request) {
  await ensure();
  const b = await req.json();

  // Public submit — guarded by the token.
  if (b.action === 'submit') {
    const [row] = await sql`SELECT * FROM info_requests WHERE token = ${b.token}` as any[];
    if (!row) return NextResponse.json({ error: 'This link is invalid or has expired.' }, { status: 404 });
    if (row.status === 'Completed') return NextResponse.json({ error: 'This form was already submitted.', done: true }, { status: 409 });
    const answers: Record<string, string> = (b.answers && typeof b.answers === 'object') ? b.answers : {};
    await applyAnswers(row, answers);
    await sql`UPDATE info_requests SET answers = ${JSON.stringify(answers)}, status = 'Completed', submitted_at = NOW() WHERE id = ${row.id}`;
    return NextResponse.json({ ok: true });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const by = (session.user as any).email ?? null;

  // Choose which fields this batch collects (defaults to personal email).
  const chosen = (Array.isArray(b.fieldIds) && b.fieldIds.length ? b.fieldIds.map(String) : DEFAULT_FIELD_IDS)
    .filter((id: string) => FIELDS.some(f => f.id === id));
  const fieldIds = chosen.length ? chosen : DEFAULT_FIELD_IDS;

  // Create/send one request.
  if (b.action === 'create' || b.action === 'send') {
    const name = String(b.name ?? '').trim();
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });
    const email = String(b.email ?? '').trim();
    const id = cuid(); const token = cuid() + cuid();
    await sql`INSERT INTO info_requests (id, token, name, email, profile_id, fields, status, created_by)
      VALUES (${id}, ${token}, ${name}, ${email || null}, ${b.profileId ?? null}, ${JSON.stringify(fieldIds)}, 'Sent', ${by})`;
    const url = `${origin(req)}/info/${token}`;
    let emailed = false;
    if (b.action === 'send') {
      if (!email) return NextResponse.json({ error: 'This employee has no email on file — copy the link instead.' }, { status: 400 });
      const r = await sendMailAsApp(SENDER, email, 'Litson PLLC — please update your info', infoRequestEmail(name, url, fieldsByIds(fieldIds)));
      emailed = !!r.ok;
      if (!emailed) return NextResponse.json({ error: r.error || 'Could not send the email', url }, { status: 502 });
    }
    const [row] = await sql`SELECT id, token, name, email, status, created_at FROM info_requests WHERE id = ${id}` as any[];
    return NextResponse.json({ row, url, emailed }, { status: 201 });
  }

  // Send a test to a chosen address (no employee record touched).
  if (b.action === 'send-test') {
    const email = String(b.email ?? '').trim();
    if (!email) return NextResponse.json({ error: 'Enter an email to send the test to' }, { status: 400 });
    const id = cuid(); const token = cuid() + cuid();
    await sql`INSERT INTO info_requests (id, token, name, email, profile_id, fields, status, created_by)
      VALUES (${id}, ${token}, ${'Info request (test)'}, ${email}, ${null}, ${JSON.stringify(fieldIds)}, 'Sent', ${by})`;
    const url = `${origin(req)}/info/${token}`;
    const r = await sendMailAsApp(SENDER, email, 'Litson PLLC — please update your info (test)', infoRequestEmail('there', url, fieldsByIds(fieldIds)));
    if (!r.ok) return NextResponse.json({ error: r.error || 'Could not send the test email', url }, { status: 502 });
    return NextResponse.json({ ok: true, emailed: true, url });
  }

  // Email the form to a chosen set of people (by profile).
  if (b.action === 'send-bulk') {
    const pick = Array.isArray(b.profileIds) ? new Set(b.profileIds.map(String)) : null;
    let profiles: any[] = [];
    try { profiles = await sql`SELECT id, name, email FROM employee_profiles WHERE coalesce(email, '') <> '' AND coalesce(offboarded, false) = false ORDER BY name ASC` as any[]; } catch { /* no table */ }
    if (pick) profiles = profiles.filter(p => pick.has(String(p.id)));
    let sent = 0; const failed: string[] = [];
    for (const p of profiles) {
      let [s] = await sql`SELECT id, token FROM info_requests WHERE profile_id = ${p.id} AND status <> 'Completed' ORDER BY created_at DESC LIMIT 1` as any[];
      if (!s) {
        const id = cuid(); const token = cuid() + cuid();
        await sql`INSERT INTO info_requests (id, token, name, email, profile_id, fields, status, created_by)
          VALUES (${id}, ${token}, ${p.name}, ${p.email}, ${p.id}, ${JSON.stringify(fieldIds)}, 'Sent', ${by})`;
        s = { id, token };
      } else {
        // Refresh the field set on the reused request so it matches this send.
        await sql`UPDATE info_requests SET fields = ${JSON.stringify(fieldIds)} WHERE id = ${s.id}`;
      }
      const url = `${origin(req)}/info/${s.token}`;
      const r = await sendMailAsApp(SENDER, p.email, 'Litson PLLC — please update your info', infoRequestEmail(p.name, url, fieldsByIds(fieldIds)));
      if (r.ok) sent++; else failed.push(p.name);
    }
    return NextResponse.json({ sent, total: profiles.length, failed });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  await sql`DELETE FROM info_requests WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}

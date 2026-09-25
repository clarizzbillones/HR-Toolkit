// Push a completed onboarding-intake submission into the Staffing directory and
// the hire's Employee File. Shared by the public intake-submit handler and the
// "Mark as hired" flow so the rich intake data (address, emergency contact,
// TSA/KTN, favorites, uploaded documents, …) always lands on the real records —
// even if the intake was submitted after the hire was already added, or the
// staffing row was created first by another step.
//
// Everything here is idempotent: staffing/profile updates only fill BLANK
// columns, the summary entry is keyed by source_ref, and uploads are re-filed
// via attachPdfToEmployeeFile (which dedupes on source_ref).
import { sql, cuid } from '@/lib/db';
import { attachPdfToEmployeeFile, findOrCreateProfileByName, normName } from '@/lib/employeeFiles';
import { intakeFields, roleLabel, roleMeta, type IntakeRole } from '@/lib/onboardingIntake';

const parseAns = (v: any): Record<string, any> => {
  try { const a = typeof v === 'string' ? JSON.parse(v) : v; return a && typeof a === 'object' ? a : {}; }
  catch { return {}; }
};

// Match a hire across records even when one copy carries a nickname. Strips
// quoted / parenthetical nickname segments — William "Bill" Abely, William
// (Bill) Abely, William 'Bill' Abely — then normalizes to a first+last key. So
// the Staffing display name matches the legal name on the intake form.
export function coreName(s: any): string {
  const stripped = String(s ?? '')
    .replace(/"[^"]*"/g, ' ')
    .replace(/'[^']*'/g, ' ')
    .replace(/[‘’“”][^‘’“”]*[‘’“”]/g, ' ')
    .replace(/\([^)]*\)/g, ' ');
  return normName(stripped);
}

async function ensureStaff() {
  await sql`CREATE TABLE IF NOT EXISTS staff_directory (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, position TEXT, dialpad TEXT, personal_phone TEXT, email TEXT,
    start_date TEXT, dob TEXT, favorite_color TEXT, favorite_treat TEXT, note TEXT, ktn TEXT, marriott TEXT,
    delta TEXT, weight TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  for (const c of ['southwest', 'american', 'worker_type', 'address'])
    await sql`ALTER TABLE staff_directory ADD COLUMN IF NOT EXISTS ${sql(c)} TEXT`;
}

// Find the most recent COMPLETED intake for a person, by explicit intake id,
// linked onboardee, or name (nickname-tolerant). Returns null when there is
// nothing to sync.
export async function findCompletedIntake(opts: { intakeId?: string | null; onboardeeId?: string | null; name?: string | null }) {
  try {
    if (opts.intakeId) {
      const [r] = await sql`SELECT * FROM onboarding_intakes WHERE id = ${opts.intakeId} AND status = 'Completed' LIMIT 1` as any[];
      if (r) return r;
    }
    if (opts.onboardeeId) {
      const [r] = await sql`SELECT * FROM onboarding_intakes WHERE onboardee_id = ${opts.onboardeeId} AND status = 'Completed' ORDER BY submitted_at DESC NULLS LAST LIMIT 1` as any[];
      if (r) return r;
    }
    const key = coreName(opts.name);
    if (key) {
      // Exact (fast path) then nickname-tolerant match over completed intakes.
      const [exact] = await sql`SELECT * FROM onboarding_intakes WHERE lower(name) = lower(${String(opts.name).trim()}) AND status = 'Completed' ORDER BY submitted_at DESC NULLS LAST LIMIT 1` as any[];
      if (exact) return exact;
      const all = await sql`SELECT * FROM onboarding_intakes WHERE status = 'Completed' ORDER BY submitted_at DESC NULLS LAST` as any[];
      for (const r of all) {
        const ans = parseAns(r.answers);
        if (coreName(ans.full_legal_name || r.name) === key) return r;
      }
    }
  } catch { /* table may not exist yet */ }
  return null;
}

// Apply one completed intake row's data to Staffing + the Employee File. Safe to
// call repeatedly. `targetName` is the display name the rest of the app uses for
// this hire (e.g. the Staffing / onboarding record's name, possibly with a
// nickname) — records are enriched under that name so we never fork a duplicate
// under the bare legal name. Returns a small summary of what it touched.
export async function applyIntakeToRecords(intake: any, targetName?: string | null): Promise<{ staffed: boolean; profileFilled: boolean; filesFiled: number; profileId: string | null }> {
  const role = intake.role as IntakeRole;
  const answers = parseAns(intake.answers);
  const meta = roleMeta(role);
  const legalName = String(answers.full_legal_name || intake.name || '').trim();
  const name = String(targetName ?? '').trim() || legalName;
  if (!name) return { staffed: false, profileFilled: false, filesFiled: 0, profileId: null };
  const key = coreName(name) || coreName(legalName);

  const email = String(answers.personal_email || intake.email || '').trim() || null;
  const position = String(answers.role_title || answers.business_name || meta.titleHint || '').trim() || meta.titleHint;
  const startDate = answers.start_date || answers.services_start || null;
  const address = answers.home_address ?? null;

  let staffed = false;
  let profileFilled = false;
  let filesFiled = 0;
  let profileId: string | null = null;

  // 1) Staffing directory — find the row (nickname-tolerant), fill blank columns;
  //    insert a fresh row only when the person isn't in the directory at all.
  try {
    await ensureStaff();
    const rows = await sql`SELECT * FROM staff_directory` as any[];
    const ex = rows.find(r => coreName(r.name) === key) || null;
    if (!ex) {
      await sql`INSERT INTO staff_directory (id, name, position, email, personal_phone, address, start_date, dob, worker_type, weight, ktn, favorite_color, favorite_treat)
        VALUES (${cuid()}, ${name}, ${position}, ${email}, ${answers.phone ?? null}, ${address}, ${startDate}, ${answers.dob ?? null}, ${meta.workerType}, ${answers.weight ?? null}, ${answers.tsa_ktn ?? null}, ${answers.favorite_color ?? null}, ${answers.favorite_snack ?? null})`;
      staffed = true;
    } else {
      const upd: Record<string, any> = {};
      const fill = (col: string, val: any) => { const v = val == null ? '' : String(val).trim(); if (v && !String(ex[col] ?? '').trim()) upd[col] = v; };
      fill('position', position); fill('email', email); fill('personal_phone', answers.phone); fill('address', address);
      fill('start_date', startDate); fill('dob', answers.dob); fill('worker_type', meta.workerType);
      fill('weight', answers.weight); fill('ktn', answers.tsa_ktn);
      fill('favorite_color', answers.favorite_color); fill('favorite_treat', answers.favorite_snack);
      if (Object.keys(upd).length) { await sql`UPDATE staff_directory SET ${sql(upd)} WHERE id = ${ex.id}`; staffed = true; }
    }
  } catch { /* best-effort */ }

  // 2) Employee File profile — fill blanks + summary + uploaded documents.
  try {
    const profile = await findOrCreateProfileByName(name);
    if (profile) {
      profileId = profile.id;
      const upd: Record<string, any> = {};
      const setBlank = (col: string, val: any) => { const v = val == null ? '' : String(val).trim(); if (v && !String(profile[col] ?? '').trim()) upd[col] = v; };
      setBlank('email', email); setBlank('phone', answers.phone); setBlank('position', position);
      setBlank('start_date', startDate); setBlank('dob', answers.dob); setBlank('address', address);
      setBlank('worker_type', meta.workerType); setBlank('weight', answers.weight); setBlank('ktn', answers.tsa_ktn);
      setBlank('favorite_color', answers.favorite_color); setBlank('favorite_treat', answers.favorite_snack);
      setBlank('details', answers.additional_notes);
      if (Object.keys(upd).length) { try { await sql`UPDATE employee_profiles SET ${sql(upd)} WHERE id = ${profile.id}`; profileFilled = true; } catch { /* older schema */ } }

      // Summary remark of everything they entered — keyed by source_ref so we
      // never duplicate it across re-syncs.
      const ref = `intake:${intake.id}`;
      const [already] = await sql`SELECT id FROM employee_files WHERE profile_id = ${profile.id} AND source_ref = ${ref} LIMIT 1` as any[];
      if (!already) {
        const lines = intakeFields(role).map(f => { const v = answers[f.id]; const val = Array.isArray(v) ? v.filter(Boolean).join('; ') : v; return val ? `${f.label}: ${val}` : ''; }).filter(Boolean);
        const emergency = [answers.emergency_name, answers.emergency_phone].filter(Boolean).join(' · ');
        const summary = [`Submitted the ${roleLabel(role)} onboarding intake form.`, ...lines].join('\n');
        await sql`INSERT INTO employee_files (id, profile_id, category, title, doc_date, summary, what_we_did, next_steps, author, attachment_name, attachment_data, source_ref)
          VALUES (${cuid()}, ${profile.id}, 'Onboarding', ${`Onboarding intake — ${roleLabel(role)}`}, ${new Date().toISOString().slice(0, 10)}, ${summary}, ${''}, ${emergency ? `Emergency contact: ${emergency}` : ''}, ${name}, ${null}, ${null}, ${ref})`;
      }

      // Each uploaded document as its own filed entry (idempotent on source_ref).
      const stored = await sql`SELECT id, name, label, data FROM onboarding_intake_files WHERE intake_id = ${intake.id} ORDER BY created_at ASC` as any[];
      let i = 0;
      for (const f of stored) {
        const docType = String(f.label ?? '').trim();
        await attachPdfToEmployeeFile({
          name, category: 'Onboarding',
          title: docType ? `${docType}${f.name ? ` — ${f.name}` : ''}` : `Onboarding document — ${f.name}`,
          docDate: new Date().toISOString().slice(0, 10), attName: f.name || 'document',
          dataUrl: f.data, sourceRef: `intake-file:${intake.id}:${i++}`,
          summary: `Uploaded during onboarding intake (${roleLabel(role)})${docType ? ` — ${docType}` : ''}.`, author: name,
        });
        filesFiled++;
      }
    }
  } catch { /* best-effort */ }

  return { staffed, profileFilled, filesFiled, profileId };
}

// Convenience: look up a person's completed intake and sync it. No-op when the
// person never submitted one. `name` is the display name to enrich under.
export async function syncCompletedIntakeToRecords(opts: { intakeId?: string | null; onboardeeId?: string | null; name?: string | null }) {
  const intake = await findCompletedIntake(opts);
  if (!intake) return null;
  return applyIntakeToRecords(intake, opts.name ?? null);
}

// Lightweight, Staffing-only self-heal: fill blank Staffing columns from every
// completed intake (home address → Address, phone, DOB, favorites, TSA/KTN,
// email, position, start date). Cheap enough to run on each Staffing load, so a
// hire's intake data — especially the mailing address — shows up automatically
// without anyone clicking "Sync intake info". Only fills blanks; never
// overwrites; matches names nickname-tolerantly.
export async function backfillStaffFromCompletedIntakes(): Promise<void> {
  try {
    const intakes = await sql`SELECT role, name, answers FROM onboarding_intakes WHERE status = 'Completed'` as any[];
    if (!intakes.length) return;
    await sql`ALTER TABLE staff_directory ADD COLUMN IF NOT EXISTS address TEXT`;
    const staff = await sql`SELECT * FROM staff_directory` as any[];
    if (!staff.length) return;
    for (const intake of intakes) {
      const answers = parseAns(intake.answers);
      const meta = roleMeta(intake.role as IntakeRole);
      const key = coreName(answers.full_legal_name || intake.name);
      if (!key) continue;
      const row = staff.find(r => coreName(r.name) === key);
      if (!row) continue;
      const map: Record<string, any> = {
        address: answers.home_address,
        personal_phone: answers.phone,
        dob: answers.dob,
        weight: answers.weight,
        ktn: answers.tsa_ktn,
        favorite_color: answers.favorite_color,
        favorite_treat: answers.favorite_snack,
        email: answers.personal_email,
        position: answers.role_title || answers.business_name || meta.titleHint,
        start_date: answers.start_date || answers.services_start,
        worker_type: meta.workerType,
      };
      const upd: Record<string, any> = {};
      for (const [c, v] of Object.entries(map)) {
        const val = v == null ? '' : String(v).trim();
        if (val && !String(row[c] ?? '').trim()) upd[c] = val;
      }
      if (Object.keys(upd).length) {
        await sql`UPDATE staff_directory SET ${sql(upd)} WHERE id = ${row.id}`;
        Object.assign(row, upd); // keep local copy current for this pass
      }
    }
  } catch { /* best-effort */ }
}

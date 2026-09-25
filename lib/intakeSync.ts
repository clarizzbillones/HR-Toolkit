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
import { attachPdfToEmployeeFile, findOrCreateProfileByName } from '@/lib/employeeFiles';
import { intakeFields, roleLabel, roleMeta, type IntakeRole } from '@/lib/onboardingIntake';

const parseAns = (v: any): Record<string, any> => {
  try { const a = typeof v === 'string' ? JSON.parse(v) : v; return a && typeof a === 'object' ? a : {}; }
  catch { return {}; }
};

async function ensureStaff() {
  await sql`CREATE TABLE IF NOT EXISTS staff_directory (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, position TEXT, dialpad TEXT, personal_phone TEXT, email TEXT,
    start_date TEXT, dob TEXT, favorite_color TEXT, favorite_treat TEXT, note TEXT, ktn TEXT, marriott TEXT,
    delta TEXT, weight TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  for (const c of ['southwest', 'american', 'worker_type'])
    await sql`ALTER TABLE staff_directory ADD COLUMN IF NOT EXISTS ${sql(c)} TEXT`;
}

// Find the most recent COMPLETED intake for a person, by explicit intake id,
// linked onboardee, or name. Returns null when there is nothing to sync.
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
    const nm = String(opts.name ?? '').trim();
    if (nm) {
      const [r] = await sql`SELECT * FROM onboarding_intakes WHERE lower(name) = lower(${nm}) AND status = 'Completed' ORDER BY submitted_at DESC NULLS LAST LIMIT 1` as any[];
      if (r) return r;
    }
  } catch { /* table may not exist yet */ }
  return null;
}

// Apply one completed intake row's data to Staffing + the Employee File. Safe to
// call repeatedly. Returns a small summary of what it touched.
export async function applyIntakeToRecords(intake: any): Promise<{ staffed: boolean; profileFilled: boolean; filesFiled: number }> {
  const role = intake.role as IntakeRole;
  const answers = parseAns(intake.answers);
  const meta = roleMeta(role);
  const name = String(answers.full_legal_name || intake.name || '').trim();
  if (!name) return { staffed: false, profileFilled: false, filesFiled: 0 };

  const email = String(answers.personal_email || intake.email || '').trim() || null;
  const position = String(answers.role_title || answers.business_name || meta.titleHint || '').trim() || meta.titleHint;
  const startDate = answers.start_date || answers.services_start || null;

  let staffed = false;
  let profileFilled = false;
  let filesFiled = 0;

  // 1) Staffing directory — insert if missing, otherwise fill only blank columns.
  try {
    await ensureStaff();
    const [ex] = await sql`SELECT * FROM staff_directory WHERE lower(name) = lower(${name}) LIMIT 1` as any[];
    if (!ex) {
      await sql`INSERT INTO staff_directory (id, name, position, email, personal_phone, start_date, dob, worker_type, weight, ktn, favorite_color, favorite_treat)
        VALUES (${cuid()}, ${name}, ${position}, ${email}, ${answers.phone ?? null}, ${startDate}, ${answers.dob ?? null}, ${meta.workerType}, ${answers.weight ?? null}, ${answers.tsa_ktn ?? null}, ${answers.favorite_color ?? null}, ${answers.favorite_snack ?? null})`;
      staffed = true;
    } else {
      const upd: Record<string, any> = {};
      const fill = (col: string, val: any) => { const v = val == null ? '' : String(val).trim(); if (v && !String(ex[col] ?? '').trim()) upd[col] = v; };
      fill('position', position); fill('email', email); fill('personal_phone', answers.phone);
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
      const upd: Record<string, any> = {};
      const setBlank = (col: string, val: any) => { const v = val == null ? '' : String(val).trim(); if (v && !String(profile[col] ?? '').trim()) upd[col] = v; };
      setBlank('email', email); setBlank('phone', answers.phone); setBlank('position', position);
      setBlank('start_date', startDate); setBlank('dob', answers.dob); setBlank('address', answers.home_address);
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

  return { staffed, profileFilled, filesFiled };
}

// Convenience: look up a person's completed intake and sync it. No-op when the
// person never submitted one.
export async function syncCompletedIntakeToRecords(opts: { intakeId?: string | null; onboardeeId?: string | null; name?: string | null }) {
  const intake = await findCompletedIntake(opts);
  if (!intake) return null;
  return applyIntakeToRecords(intake);
}

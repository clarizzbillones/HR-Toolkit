// Server-side helpers for writing coaching / review records into an employee's
// Employee File. Shared by the manual "Pull" import and the automatic attach
// that fires when a coaching form becomes fully signed.

import { sql, cuid } from '@/lib/db';
import { coachingPdfDataUrl, reviewSummaryPdfDataUrl } from '@/lib/employeePdf';
import { staffToProfile } from '@/lib/employeeProfile';

// Drop the light inline markdown we use in notes so the summary text reads
// cleanly in the Employee File card (which renders plain text).
export function stripMd(s: any): string {
  return String(s ?? '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/(^|[^a-zA-Z0-9])_(.+?)_(?![a-zA-Z0-9])/g, '$1$2');
}

async function ensureFiles() {
  await sql`CREATE TABLE IF NOT EXISTS employee_profiles (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, photo TEXT, position TEXT, department TEXT,
    email TEXT, phone TEXT, start_date TEXT, details TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS employee_files (
    id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, category TEXT, title TEXT, doc_date TEXT,
    summary TEXT, what_we_did TEXT, next_steps TEXT, author TEXT,
    attachment_name TEXT, attachment_data TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`ALTER TABLE employee_files ADD COLUMN IF NOT EXISTS source_ref TEXT`;
}

// Find an employee profile by name; create a bare one if none exists yet.
export async function findOrCreateProfileByName(name: any): Promise<any | null> {
  const nm = String(name ?? '').trim();
  if (!nm) return null;
  const [ex] = await sql`SELECT * FROM employee_profiles WHERE lower(name) = ${nm.toLowerCase()} LIMIT 1` as any[];
  if (ex) return ex;
  const id = cuid();
  await sql`INSERT INTO employee_profiles (id, name) VALUES (${id}, ${nm})`;
  const [p] = await sql`SELECT * FROM employee_profiles WHERE id = ${id}` as any[];
  return p;
}

// Insert or refresh the Coaching entry (with the branded PDF) for a profile.
// Returns true if a new entry was created, false if an existing one was updated.
export async function upsertCoachingFile(profileId: string, c: any): Promise<boolean> {
  const ref = `coaching:${c.id}`;
  const title = `${c.coaching_type || 'Coaching'}${c.signed_at ? ' (signed)' : ''}`;
  const summary = [c.topic ? `Topic: ${c.topic}` : '', stripMd(c.notes || '')].filter(Boolean).join('\n\n');
  const pdfUrl = await coachingPdfDataUrl(c);
  const attName = `Coaching-${String(c.coaching_type || 'form').replace(/[^\w]+/g, '-')}-${String(c.date ?? '').slice(0, 10) || 'form'}.pdf`;
  const [exists] = await sql`SELECT id FROM employee_files WHERE profile_id = ${profileId} AND source_ref = ${ref} LIMIT 1` as any[];
  if (exists) {
    await sql`UPDATE employee_files SET title = ${title}, doc_date = ${c.date ?? null}, summary = ${summary},
      next_steps = ${c.action_items ?? ''}, author = ${c.coach_name ?? ''}, attachment_name = ${attName}, attachment_data = ${pdfUrl}
      WHERE id = ${exists.id}`;
    return false;
  }
  await sql`INSERT INTO employee_files (id, profile_id, category, title, doc_date, summary, what_we_did, next_steps, author, attachment_name, attachment_data, source_ref)
    VALUES (${cuid()}, ${profileId}, 'Coaching', ${title}, ${c.date ?? null}, ${summary}, ${''}, ${c.action_items ?? ''}, ${c.coach_name ?? ''}, ${attName}, ${pdfUrl}, ${ref})`;
  return true;
}

// Attach an arbitrary PDF (data URL) to an employee's file, keyed by source_ref
// so re-attaching updates rather than duplicates. Creates the profile if needed.
export async function attachPdfToEmployeeFile(opts: { name: string; category: string; title: string; docDate?: string | null; attName: string; dataUrl: string; sourceRef: string; summary?: string; author?: string }): Promise<void> {
  try {
    await ensureFiles();
    const profile = await findOrCreateProfileByName(opts.name);
    if (!profile) return;
    const [exists] = await sql`SELECT id FROM employee_files WHERE profile_id = ${profile.id} AND source_ref = ${opts.sourceRef} LIMIT 1` as any[];
    if (exists) {
      await sql`UPDATE employee_files SET title = ${opts.title}, doc_date = ${opts.docDate ?? null}, summary = ${opts.summary ?? ''}, author = ${opts.author ?? ''}, attachment_name = ${opts.attName}, attachment_data = ${opts.dataUrl} WHERE id = ${exists.id}`;
    } else {
      await sql`INSERT INTO employee_files (id, profile_id, category, title, doc_date, summary, what_we_did, next_steps, author, attachment_name, attachment_data, source_ref)
        VALUES (${cuid()}, ${profile.id}, ${opts.category}, ${opts.title}, ${opts.docDate ?? null}, ${opts.summary ?? ''}, ${''}, ${''}, ${opts.author ?? ''}, ${opts.attName}, ${opts.dataUrl}, ${opts.sourceRef})`;
    }
  } catch { /* best-effort */ }
}

// Build (or refresh) the Performance Review entry in an employee's file from
// their Reviews record + uploaded review PDFs. Shared by the manual "Pull"
// import and the automatic sync that fires when a review is completed or a
// review document is uploaded. Skips silently when there's nothing on file yet.
// Pass profileId to target a known Employee File; otherwise it's resolved (and
// created if needed) by the employee's name.
export async function syncReviewsToEmployeeFile(employeeId: string, profileId?: string): Promise<{ imported: number; message: string }> {
  try {
    await ensureFiles();
    let emp: any;
    try { [emp] = await sql`SELECT id, name, hire_date, last_review_date, review_history, review_6mo_date, review_6mo_status, review_1yr_date, review_1yr_status FROM employees WHERE id = ${employeeId} LIMIT 1` as any[]; } catch { /* no table */ }
    if (!emp) return { imported: 0, message: 'No Performance Review record found.' };

    let history: any[] = [];
    try { const h = typeof emp.review_history === 'string' ? JSON.parse(emp.review_history) : emp.review_history; if (Array.isArray(h)) history = h; } catch { /* ignore */ }
    const lines: string[] = [];
    if (emp.hire_date) lines.push(`Hired: ${emp.hire_date}`);
    if (emp.last_review_date) lines.push(`Last review: ${emp.last_review_date}`);
    if (emp.review_6mo_date) lines.push(`6-month: ${emp.review_6mo_date}${emp.review_6mo_status ? ` (${emp.review_6mo_status})` : ''}`);
    if (emp.review_1yr_date) lines.push(`1-year: ${emp.review_1yr_date}${emp.review_1yr_status ? ` (${emp.review_1yr_status})` : ''}`);
    for (const h of history) if (h?.date) lines.push(`Reviewed ${String(h.date).slice(0, 10)}${h.notes ? ` — ${h.notes}` : ''}`);

    let rdocs: any[] = [];
    try { rdocs = await sql`SELECT which, name, data, doc_date FROM review_docs WHERE employee_id = ${emp.id}` as any[]; } catch { /* no table */ }
    rdocs = rdocs.filter(rd => rd.data);

    // Nothing to file yet — don't create an empty entry.
    if (!lines.length && !rdocs.length) return { imported: 0, message: 'No review dates on file yet.' };

    const profId = profileId ?? (await findOrCreateProfileByName(emp.name))?.id;
    if (!profId) return { imported: 0, message: 'No employee profile.' };

    const name = emp.name;
    const summary = lines.length ? lines.join('\n') : 'No review dates on file yet.';
    const ref = `reviews:${emp.id}`;
    const summaryDate = emp.last_review_date ?? emp.review_1yr_date ?? emp.review_6mo_date ?? null;
    const primary = rdocs.find(r => r.which === '1yr') ?? rdocs.find(r => r.which === '6mo') ?? rdocs[0] ?? null;
    const summaryAtt = primary ? (primary.name ?? 'review.pdf') : `Review-summary-${String(name).replace(/[^\w]+/g, '-')}.pdf`;
    const summaryData = primary ? primary.data : await reviewSummaryPdfDataUrl(name, lines);

    const [exists] = await sql`SELECT id FROM employee_files WHERE profile_id = ${profId} AND source_ref = ${ref} LIMIT 1` as any[];
    if (exists) {
      await sql`UPDATE employee_files SET summary = ${summary}, doc_date = ${summaryDate}, attachment_name = ${summaryAtt}, attachment_data = ${summaryData} WHERE id = ${exists.id}`;
    } else {
      await sql`INSERT INTO employee_files (id, profile_id, category, title, doc_date, summary, what_we_did, next_steps, author, attachment_name, attachment_data, source_ref)
        VALUES (${cuid()}, ${profId}, 'Performance Review', ${'Performance review summary'}, ${summaryDate}, ${summary}, ${''}, ${''}, ${''}, ${summaryAtt}, ${summaryData}, ${ref})`;
    }
    // Older imports created a standalone entry for the primary doc — collapse it in.
    if (primary) await sql`DELETE FROM employee_files WHERE profile_id = ${profId} AND source_ref = ${`reviews-doc:${emp.id}:${primary.which}`}`;

    let attached = 0;
    for (const rd of rdocs) {
      if (primary && rd.which === primary.which) continue;
      const dref = `reviews-doc:${emp.id}:${rd.which}`;
      const [ex] = await sql`SELECT id FROM employee_files WHERE profile_id = ${profId} AND source_ref = ${dref} LIMIT 1` as any[];
      if (ex) continue;
      const label = rd.which === '6mo' ? '6-month review document' : rd.which === '1yr' ? '1-year review document' : (rd.name ? `Review document — ${rd.name}` : 'Review document');
      await sql`INSERT INTO employee_files (id, profile_id, category, title, doc_date, summary, what_we_did, next_steps, author, attachment_name, attachment_data, source_ref)
        VALUES (${cuid()}, ${profId}, 'Performance Review', ${label}, ${rd.doc_date ?? summaryDate}, ${''}, ${''}, ${''}, ${''}, ${rd.name ?? 'review.pdf'}, ${rd.data}, ${dref})`;
      attached++;
    }
    const message = attached
      ? `Imported the review summary (with signed PDF) + ${attached} more document${attached > 1 ? 's' : ''}.`
      : (exists ? 'Updated the review summary — dates and signed PDF combined into one entry.' : 'Imported the review summary with the signed PDF attached.');
    return { imported: 1 + attached, message };
  } catch { return { imported: 0, message: 'Could not sync reviews.' }; }
}

// Bring an Employee File fully up to date from every source in one shot —
// Staffing details, all Coaching forms, and Performance Reviews — so the tab is
// current without anyone clicking "Pull". Runs when the file is opened; every
// step is best-effort and never throws. Returns what changed (for messaging).
export async function syncAllForProfile(profileId: string): Promise<{ coaching: number; reviews: number; staffingFilled: boolean }> {
  const out = { coaching: 0, reviews: 0, staffingFilled: false };
  try {
    await ensureFiles();
    const [profile] = await sql`SELECT * FROM employee_profiles WHERE id = ${profileId}` as any[];
    if (!profile) return out;
    const key = String(profile.name ?? '').trim().toLowerCase();
    if (!key) return out;

    // 1) Staffing — fill any blank profile field (never overwrites existing).
    try {
      const [srow] = await sql`SELECT * FROM staff_directory WHERE lower(name) = ${key} LIMIT 1` as any[];
      if (srow) {
        const src = staffToProfile(srow);
        const updates: Record<string, any> = {};
        for (const [k, v] of Object.entries(src)) {
          const sv = v == null ? '' : String(v).trim();
          const cur = profile[k] == null ? '' : String(profile[k]).trim();
          if (sv && !cur) updates[k] = sv;
        }
        if (Object.keys(updates).length) { await sql`UPDATE employee_profiles SET ${sql(updates)} WHERE id = ${profileId}`; out.staffingFilled = true; }
      }
    } catch { /* best-effort */ }

    // 2) Coaching — attach / refresh every form's branded PDF.
    try {
      const list = await sql`SELECT * FROM coaching_notes WHERE lower(employee) = ${key} ORDER BY date DESC NULLS LAST` as any[];
      for (const c of list) await upsertCoachingFile(profileId, c);
      out.coaching = list.length;
    } catch { /* best-effort */ }

    // 3) Performance Reviews — summary + signed PDFs.
    try {
      const [emp] = await sql`SELECT id FROM employees WHERE lower(name) = ${key} LIMIT 1` as any[];
      if (emp) { const r = await syncReviewsToEmployeeFile(emp.id, profileId); out.reviews = r.imported; }
    } catch { /* best-effort */ }
  } catch { /* best-effort */ }
  return out;
}

// Best-effort: when a coaching form is signed, make sure the signed PDF is on
// file for that employee (creating the profile if needed).
export async function syncCoachingToEmployeeFile(c: any): Promise<void> {
  try {
    await ensureFiles();
    const profile = await findOrCreateProfileByName(c.employee);
    if (!profile) return;
    await upsertCoachingFile(profile.id, c);
  } catch { /* best-effort — never block signing */ }
}

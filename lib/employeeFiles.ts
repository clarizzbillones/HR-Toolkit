// Server-side helpers for writing coaching / review records into an employee's
// Employee File. Shared by the manual "Pull" import and the automatic attach
// that fires when a coaching form becomes fully signed.

import { sql, cuid } from '@/lib/db';
import { coachingPdfDataUrl } from '@/lib/employeePdf';

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

export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql, cuid } from '@/lib/db';
import { reviewSummaryPdfDataUrl } from '@/lib/employeePdf';
import { staffToProfile } from '@/lib/employeeProfile';
import { upsertCoachingFile } from '@/lib/employeeFiles';

// One-click pull of an employee's existing records into their Employee File,
// while the tab stays independent. source = staffing | coaching | reviews.
async function requireHrAdmin() {
  const session = await getServerSession(authOptions);
  return !!session?.user;
}

function lc(s: any) { return String(s ?? '').trim().toLowerCase(); }

export async function POST(req: Request) {
  if (!(await requireHrAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { profileId, source } = await req.json();
  if (!profileId || !source) return NextResponse.json({ error: 'Missing profileId/source' }, { status: 400 });
  const [profile] = await sql`SELECT * FROM employee_profiles WHERE id = ${profileId}` as any[];
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  const name = profile.name;

  // Give employee_files a source marker so re-imports don't duplicate.
  await sql`ALTER TABLE employee_files ADD COLUMN IF NOT EXISTS source_ref TEXT`;

  if (source === 'staffing') {
    let row: any;
    try { [row] = await sql`SELECT * FROM staff_directory WHERE lower(name) = ${lc(name)} LIMIT 1` as any[]; } catch { /* no table */ }
    if (!row) return NextResponse.json({ error: `No Staffing record found for “${name}”.` }, { status: 404 });
    // Fill any blank profile field from Staffing (existing values are kept).
    const src = staffToProfile(row);
    const updates: Record<string, any> = {};
    for (const [k, v] of Object.entries(src)) {
      const staffVal = v == null ? '' : String(v).trim();
      const cur = profile[k] == null ? '' : String(profile[k]).trim();
      if (staffVal && !cur) updates[k] = staffVal;
    }
    if (Object.keys(updates).length) await sql`UPDATE employee_profiles SET ${sql(updates)} WHERE id = ${profileId}`;
    const [updated] = await sql`SELECT * FROM employee_profiles WHERE id = ${profileId}`;
    return NextResponse.json({ profile: updated, imported: 1, message: 'Pulled details from Staffing.' });
  }

  if (source === 'coaching') {
    let list: any[] = [];
    try { list = await sql`SELECT * FROM coaching_notes WHERE lower(employee) = ${lc(name)} ORDER BY date DESC NULLS LAST` as any[]; } catch { /* no table */ }
    // Refresh every coaching form (attaching / updating the branded PDF).
    for (const c of list) await upsertCoachingFile(profileId, c);
    return NextResponse.json({ imported: list.length, message: list.length ? `Synced ${list.length} coaching form${list.length > 1 ? 's' : ''} (with PDF).` : 'No coaching forms to import.' });
  }

  if (source === 'reviews') {
    let emp: any;
    try { [emp] = await sql`SELECT id, name, role, hire_date, last_review_date, review_history, review_6mo_date, review_6mo_status, review_1yr_date, review_1yr_status FROM employees WHERE lower(name) = ${lc(name)} LIMIT 1` as any[]; } catch { /* no table */ }
    if (!emp) return NextResponse.json({ error: `No Performance Review record found for “${name}”.` }, { status: 404 });
    let history: any[] = [];
    try { const h = typeof emp.review_history === 'string' ? JSON.parse(emp.review_history) : emp.review_history; if (Array.isArray(h)) history = h; } catch { /* ignore */ }
    const lines: string[] = [];
    if (emp.hire_date) lines.push(`Hired: ${emp.hire_date}`);
    if (emp.last_review_date) lines.push(`Last review: ${emp.last_review_date}`);
    if (emp.review_6mo_date) lines.push(`6-month: ${emp.review_6mo_date}${emp.review_6mo_status ? ` (${emp.review_6mo_status})` : ''}`);
    if (emp.review_1yr_date) lines.push(`1-year: ${emp.review_1yr_date}${emp.review_1yr_status ? ` (${emp.review_1yr_status})` : ''}`);
    for (const h of history) if (h?.date) lines.push(`Reviewed ${String(h.date).slice(0, 10)}${h.notes ? ` — ${h.notes}` : ''}`);
    const summary = lines.length ? lines.join('\n') : 'No review dates on file yet.';
    const ref = `reviews:${emp.id}`;
    const summaryDate = emp.last_review_date ?? emp.review_1yr_date ?? emp.review_6mo_date ?? null;

    // Uploaded review documents (PDFs). The primary one is folded into the
    // single summary entry so the dates and the signed PDF live together.
    let rdocs: any[] = [];
    try { rdocs = await sql`SELECT which, name, data FROM review_docs WHERE employee_id = ${emp.id}` as any[]; } catch { /* no table */ }
    rdocs = rdocs.filter(rd => rd.data);
    const primary = rdocs.find(r => r.which === '1yr') ?? rdocs.find(r => r.which === '6mo') ?? rdocs[0] ?? null;

    // Combined entry attachment: the real signed review PDF if we have one,
    // otherwise a branded PDF generated from the summary.
    const summaryAtt = primary ? (primary.name ?? 'review.pdf') : `Review-summary-${String(name).replace(/[^\w]+/g, '-')}.pdf`;
    const summaryData = primary ? primary.data : await reviewSummaryPdfDataUrl(name, lines);

    const [exists] = await sql`SELECT id FROM employee_files WHERE profile_id = ${profileId} AND source_ref = ${ref} LIMIT 1` as any[];
    if (exists) {
      await sql`UPDATE employee_files SET summary = ${summary}, doc_date = ${summaryDate}, attachment_name = ${summaryAtt}, attachment_data = ${summaryData} WHERE id = ${exists.id}`;
    } else {
      await sql`INSERT INTO employee_files (id, profile_id, category, title, doc_date, summary, what_we_did, next_steps, author, attachment_name, attachment_data, source_ref)
        VALUES (${cuid()}, ${profileId}, 'Performance Review', ${'Performance review summary'}, ${summaryDate}, ${summary}, ${''}, ${''}, ${''}, ${summaryAtt}, ${summaryData}, ${ref})`;
    }

    // Remove any previously-imported standalone entry for the primary document
    // (older imports created a separate row) so the two collapse into one.
    if (primary) {
      await sql`DELETE FROM employee_files WHERE profile_id = ${profileId} AND source_ref = ${`reviews-doc:${emp.id}:${primary.which}`}`;
    }

    // Any additional review documents beyond the primary stay as their own entries.
    let attached = 0;
    for (const rd of rdocs) {
      if (primary && rd.which === primary.which) continue;
      const dref = `reviews-doc:${emp.id}:${rd.which}`;
      const [ex] = await sql`SELECT id FROM employee_files WHERE profile_id = ${profileId} AND source_ref = ${dref} LIMIT 1` as any[];
      if (ex) continue;
      const label = rd.which === '6mo' ? '6-month review document' : rd.which === '1yr' ? '1-year review document' : `Review document (${rd.which})`;
      await sql`INSERT INTO employee_files (id, profile_id, category, title, doc_date, summary, what_we_did, next_steps, author, attachment_name, attachment_data, source_ref)
        VALUES (${cuid()}, ${profileId}, 'Performance Review', ${label}, ${summaryDate}, ${''}, ${''}, ${''}, ${''}, ${rd.name ?? 'review.pdf'}, ${rd.data}, ${dref})`;
      attached++;
    }
    const msg = attached
      ? `Imported the review summary (with signed PDF) + ${attached} more document${attached > 1 ? 's' : ''}.`
      : (exists ? 'Updated the review summary — dates and signed PDF combined into one entry.' : 'Imported the review summary with the signed PDF attached.');
    return NextResponse.json({ imported: 1 + attached, message: msg });
  }

  return NextResponse.json({ error: 'Unknown source' }, { status: 400 });
}

export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql, cuid } from '@/lib/db';
import { coachingPdfDataUrl, reviewSummaryPdfDataUrl } from '@/lib/employeePdf';

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
    await sql`UPDATE employee_profiles SET
      position = COALESCE(NULLIF(${row.position ?? ''}, ''), position),
      email = COALESCE(NULLIF(${row.email ?? ''}, ''), email),
      phone = COALESCE(NULLIF(${row.personal_phone ?? row.dialpad ?? ''}, ''), phone),
      start_date = COALESCE(NULLIF(${row.start_date ?? ''}, ''), start_date)
      WHERE id = ${profileId}`;
    const [updated] = await sql`SELECT * FROM employee_profiles WHERE id = ${profileId}`;
    return NextResponse.json({ profile: updated, imported: 1, message: 'Pulled details from Staffing.' });
  }

  if (source === 'coaching') {
    let list: any[] = [];
    try { list = await sql`SELECT * FROM coaching_notes WHERE lower(employee) = ${lc(name)} ORDER BY date DESC NULLS LAST` as any[]; } catch { /* no table */ }
    let added = 0;
    for (const c of list) {
      const ref = `coaching:${c.id}`;
      const [exists] = await sql`SELECT id FROM employee_files WHERE profile_id = ${profileId} AND source_ref = ${ref} LIMIT 1` as any[];
      if (exists) continue;
      const title = `${c.coaching_type || 'Coaching'}${c.signed_at ? ' (signed)' : ''}`;
      const summary = [c.topic ? `Topic: ${c.topic}` : '', c.notes || ''].filter(Boolean).join('\n\n');
      // Attach the branded coaching document as a PDF so it can be viewed / printed.
      const pdfUrl = await coachingPdfDataUrl(c);
      const attName = `Coaching-${String(c.coaching_type || 'form').replace(/[^\w]+/g, '-')}-${String(c.date ?? '').slice(0, 10) || 'form'}.pdf`;
      await sql`INSERT INTO employee_files (id, profile_id, category, title, doc_date, summary, what_we_did, next_steps, author, attachment_name, attachment_data, source_ref)
        VALUES (${cuid()}, ${profileId}, 'Coaching', ${title}, ${c.date ?? null}, ${summary}, ${''}, ${c.action_items ?? ''}, ${c.coach_name ?? ''}, ${attName}, ${pdfUrl}, ${ref})`;
      added++;
    }
    return NextResponse.json({ imported: added, message: added ? `Imported ${added} coaching form${added > 1 ? 's' : ''}.` : 'No new coaching forms to import.' });
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
    // Attach a branded PDF of the review summary alongside the text.
    const summaryPdf = await reviewSummaryPdfDataUrl(name, lines);
    const summaryAtt = `Review-summary-${String(name).replace(/[^\w]+/g, '-')}.pdf`;
    const [exists] = await sql`SELECT id FROM employee_files WHERE profile_id = ${profileId} AND source_ref = ${ref} LIMIT 1` as any[];
    if (exists) {
      await sql`UPDATE employee_files SET summary = ${summary}, doc_date = ${summaryDate}, attachment_name = ${summaryAtt}, attachment_data = ${summaryPdf} WHERE id = ${exists.id}`;
    } else {
      await sql`INSERT INTO employee_files (id, profile_id, category, title, doc_date, summary, what_we_did, next_steps, author, attachment_name, attachment_data, source_ref)
        VALUES (${cuid()}, ${profileId}, 'Performance Review', ${'Performance review summary'}, ${summaryDate}, ${summary}, ${''}, ${''}, ${''}, ${summaryAtt}, ${summaryPdf}, ${ref})`;
    }

    // Attach the actual uploaded review documents (PDFs) as separate entries.
    let rdocs: any[] = [];
    try { rdocs = await sql`SELECT which, name, data FROM review_docs WHERE employee_id = ${emp.id}` as any[]; } catch { /* no table */ }
    let attached = 0;
    for (const rd of rdocs) {
      if (!rd.data) continue;
      const dref = `reviews-doc:${emp.id}:${rd.which}`;
      const [ex] = await sql`SELECT id FROM employee_files WHERE profile_id = ${profileId} AND source_ref = ${dref} LIMIT 1` as any[];
      if (ex) continue;
      const label = rd.which === '6mo' ? '6-month review document' : rd.which === '1yr' ? '1-year review document' : `Review document (${rd.which})`;
      await sql`INSERT INTO employee_files (id, profile_id, category, title, doc_date, summary, what_we_did, next_steps, author, attachment_name, attachment_data, source_ref)
        VALUES (${cuid()}, ${profileId}, 'Performance Review', ${label}, ${emp.last_review_date ?? emp.review_1yr_date ?? emp.review_6mo_date ?? null}, ${''}, ${''}, ${''}, ${''}, ${rd.name ?? 'review.pdf'}, ${rd.data}, ${dref})`;
      attached++;
    }
    const msg = attached ? `Imported the review summary + ${attached} document${attached > 1 ? 's' : ''}.` : (exists ? 'Updated the performance-review summary.' : 'Imported the performance-review summary.');
    return NextResponse.json({ imported: 1 + attached, message: msg });
  }

  return NextResponse.json({ error: 'Unknown source' }, { status: 400 });
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { sql, cuid } from '@/lib/db';
import { syncReviewsToEmployeeFile } from '@/lib/employeeFiles';

async function ensureTable() {
  await sql`CREATE TABLE IF NOT EXISTS review_docs (
    id text PRIMARY KEY,
    employee_id text NOT NULL,
    which text NOT NULL,
    name text,
    data text,
    created_at timestamptz DEFAULT now(),
    UNIQUE (employee_id, which)
  )`;
  await sql`ALTER TABLE review_docs ADD COLUMN IF NOT EXISTS doc_date text`;
}

// GET ?id=&list=1  -> { docs: [{ which, name, doc_date }] } (newest first)
// GET ?id=&meta=1  -> { '6mo': name|null, '1yr': name|null } (legacy)
// GET ?id=&which=  -> streams the stored file inline
export async function GET(req: Request) {
  await ensureTable();
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  if (url.searchParams.get('list')) {
    const rows = await sql`SELECT which, name, doc_date FROM review_docs WHERE employee_id = ${id} ORDER BY doc_date DESC NULLS LAST, created_at DESC`;
    return NextResponse.json({ docs: rows });
  }
  if (url.searchParams.get('meta')) {
    const rows = await sql`SELECT which, name FROM review_docs WHERE employee_id = ${id}`;
    const meta: Record<string, string | null> = { '6mo': null, '1yr': null };
    for (const r of rows as any[]) meta[r.which] = r.name;
    return NextResponse.json({ meta });
  }

  const which = url.searchParams.get('which');
  const [row] = await sql`SELECT name, data FROM review_docs WHERE employee_id = ${id} AND which = ${which}`;
  if (!row?.data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const m = String(row.data).match(/^data:([^;]+);base64,(.*)$/);
  if (!m) return NextResponse.json({ error: 'Bad data' }, { status: 500 });
  const buf = Buffer.from(m[2], 'base64');
  return new NextResponse(new Uint8Array(buf), {
    headers: { 'Content-Type': m[1], 'Content-Disposition': `inline; filename="${row.name ?? 'review'}"` },
  });
}

export async function POST(req: Request) {
  await ensureTable();
  const form = await req.formData();
  const id = form.get('id') as string;
  // `which` optional — a fresh unique id per upload lets an employee have many
  // dated review documents (not just one 6-month / 1-year slot).
  const which = (form.get('which') as string) || `doc-${cuid()}`;
  const docDate = (form.get('doc_date') as string) || null;
  const file = form.get('file') as File | null;
  if (!id || !file) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  const dataUrl = `data:${file.type || 'application/octet-stream'};base64,${buf.toString('base64')}`;
  await sql`INSERT INTO review_docs (id, employee_id, which, name, data, doc_date)
    VALUES (${cuid()}, ${id}, ${which}, ${file.name}, ${dataUrl}, ${docDate})
    ON CONFLICT (employee_id, which) DO UPDATE SET name = ${file.name}, data = ${dataUrl}, doc_date = ${docDate}, created_at = now()`;
  // A past/today-dated document logs a completed review: advance the last review
  // date (forward only), clearing overrides so the next review auto-plans +6mo.
  // A FUTURE-dated document instead schedules the next review on that date —
  // the review isn't done, so it reads "Not started" until then.
  if (docDate) {
    const today = new Date().toISOString().slice(0, 10);
    try {
      if (docDate <= today) {
        await sql`UPDATE employees SET last_review_date = ${docDate}, next_review_override = NULL, review_status_override = NULL WHERE id = ${id} AND (last_review_date IS NULL OR last_review_date <= ${docDate})`;
      } else {
        await sql`UPDATE employees SET next_review_override = ${docDate}, review_status_override = NULL WHERE id = ${id}`;
      }
    } catch { /* older schema */ }
  }
  // Auto-attach the uploaded review document to the employee's Employee File.
  try { await syncReviewsToEmployeeFile(id); } catch { /* best-effort */ }
  return NextResponse.json({ which, name: file.name, doc_date: docDate });
}

export async function DELETE(req: Request) {
  await ensureTable();
  const { id, which } = await req.json();
  await sql`DELETE FROM review_docs WHERE employee_id = ${id} AND which = ${which}`;
  // Drop any standalone Employee-File entry for this doc, then re-sync so the
  // combined summary reflects the remaining documents.
  try {
    await sql`DELETE FROM employee_files WHERE source_ref = ${`reviews-doc:${id}:${which}`}`;
    await syncReviewsToEmployeeFile(id);
  } catch { /* best-effort */ }
  return NextResponse.json({ ok: true });
}

export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

// Streams a record's attached file (stored as a data URL) back to the browser.
// GET /api/reports/attachment?tab=insurance|reimbursements|cashout&id=<id>
const TABLES: Record<string, string> = {
  insurance: 'insurance_invoices',
  reimbursements: 'reimbursements',
  cashout: 'cashout_ledger',
};

// Attach (or replace) a file on an existing record. Multipart upload — raw
// bytes, so a larger file fits under the serverless request limit than the
// base64-in-JSON path used when creating a record.
export async function POST(req: Request) {
  const form = await req.formData();
  const tab = String(form.get('tab') ?? '');
  const id = String(form.get('id') ?? '');
  const file = form.get('file') as File | null;
  const table = TABLES[tab];
  if (!table || !id || !file) return NextResponse.json({ error: 'Missing tab/id/file' }, { status: 400 });
  if (file.size > 4.3 * 1024 * 1024) return NextResponse.json({ error: 'File too large (max ~4 MB)' }, { status: 413 });

  const b64 = Buffer.from(await file.arrayBuffer()).toString('base64');
  const dataUrl = `data:${file.type || 'application/octet-stream'};base64,${b64}`;
  const name = file.name.slice(0, 200);
  try {
    await sql`ALTER TABLE ${sql(table)} ADD COLUMN IF NOT EXISTS attachment_name TEXT`;
    await sql`ALTER TABLE ${sql(table)} ADD COLUMN IF NOT EXISTS attachment_data TEXT`;
    const res = await sql`UPDATE ${sql(table)} SET attachment_name = ${name}, attachment_data = ${dataUrl} WHERE id = ${id} RETURNING id`;
    if (!res.length) return NextResponse.json({ error: 'Record not found' }, { status: 404 });
  } catch (e) {
    return NextResponse.json({ error: `Could not save attachment (${String(e).slice(0, 100)})` }, { status: 500 });
  }
  return NextResponse.json({ ok: true, name });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tab = url.searchParams.get('tab') ?? '';
  const id = url.searchParams.get('id') ?? '';
  const table = TABLES[tab];
  if (!table || !id) return NextResponse.json({ error: 'Bad tab/id' }, { status: 400 });

  let row: any;
  try {
    // Table name is whitelisted above; id is parameterized.
    [row] = await sql`SELECT attachment_name, attachment_data FROM ${sql(table)} WHERE id = ${id}`;
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!row?.attachment_data) return NextResponse.json({ error: 'No attachment' }, { status: 404 });

  // Parse the data URL: data:<mime>;base64,<payload>
  const dataUrl = String(row.attachment_data);
  const comma = dataUrl.indexOf(',');
  if (!dataUrl.startsWith('data:') || comma < 0) return NextResponse.json({ error: 'Bad attachment' }, { status: 500 });
  const header = dataUrl.slice(5, comma); // between "data:" and ","
  const payload = dataUrl.slice(comma + 1);
  const isB64 = /;base64/i.test(header);
  const mime = header.replace(/;base64/i, '').split(';')[0] || 'application/octet-stream';
  const buf = isB64 ? Buffer.from(payload, 'base64') : Buffer.from(decodeURIComponent(payload), 'utf8');
  const name = (row.attachment_name || 'attachment').replace(/[^\w.\-]+/g, '_');

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': mime,
      // inline so PDFs/images preview in a new tab; filename set for downloads
      'Content-Disposition': `inline; filename="${name}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

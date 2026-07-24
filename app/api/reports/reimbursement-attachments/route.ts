export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { sql, cuid } from '@/lib/db';

// Multiple receipts per reimbursement. Each receipt is stored as a data URL in
// its own row. The reimbursements table keeps a single legacy attachment_name/
// attachment_data column pointing at one of the receipts, so the Monthly Pack's
// "has attachment" detection and the existing single-file stream keep working.

async function ensure() {
  await sql`CREATE TABLE IF NOT EXISTS reimbursement_attachments (
    id TEXT PRIMARY KEY,
    reimbursement_id TEXT NOT NULL,
    name TEXT,
    data TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
  )`;
}

// Copy the reimbursement's legacy single attachment into the multi table once,
// so receipts uploaded before this feature still show up.
async function migrateLegacy(reimbursementId: string) {
  const [r] = await sql`SELECT attachment_name, attachment_data FROM reimbursements WHERE id = ${reimbursementId}` as any[];
  if (r?.attachment_data) {
    const existing = await sql`SELECT id FROM reimbursement_attachments WHERE reimbursement_id = ${reimbursementId} AND data = ${r.attachment_data} LIMIT 1`;
    if (!existing.length) {
      await sql`INSERT INTO reimbursement_attachments (id, reimbursement_id, name, data) VALUES (${cuid()}, ${reimbursementId}, ${r.attachment_name}, ${r.attachment_data})`;
    }
  }
}

// Repoint the legacy column at the most recent remaining receipt (or clear it).
async function syncLegacy(reimbursementId: string) {
  const [latest] = await sql`SELECT name, data FROM reimbursement_attachments WHERE reimbursement_id = ${reimbursementId} ORDER BY created_at DESC LIMIT 1` as any[];
  await sql`UPDATE reimbursements SET attachment_name = ${latest?.name ?? null}, attachment_data = ${latest?.data ?? null} WHERE id = ${reimbursementId}`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const attId = url.searchParams.get('attId');
  const id = url.searchParams.get('id');
  await ensure();

  // Stream one receipt file.
  if (attId) {
    const [row] = await sql`SELECT name, data FROM reimbursement_attachments WHERE id = ${attId}` as any[];
    if (!row?.data) return NextResponse.json({ error: 'No attachment' }, { status: 404 });
    const dataUrl = String(row.data);
    const comma = dataUrl.indexOf(',');
    if (!dataUrl.startsWith('data:') || comma < 0) return NextResponse.json({ error: 'Bad attachment' }, { status: 500 });
    const header = dataUrl.slice(5, comma);
    const payload = dataUrl.slice(comma + 1);
    const isB64 = /;base64/i.test(header);
    const mime = header.replace(/;base64/i, '').split(';')[0] || 'application/octet-stream';
    const buf = isB64 ? Buffer.from(payload, 'base64') : Buffer.from(decodeURIComponent(payload), 'utf8');
    const name = (row.name || 'receipt').replace(/[^\w.\-]+/g, '_');
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': mime,
        'Content-Disposition': `inline; filename="${name}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  }

  // List a reimbursement's receipts (names only, no data).
  if (id) {
    await migrateLegacy(id);
    const rows = await sql`SELECT id, name FROM reimbursement_attachments WHERE reimbursement_id = ${id} ORDER BY created_at ASC`;
    return NextResponse.json({ attachments: rows });
  }
  return NextResponse.json({ error: 'Missing id/attId' }, { status: 400 });
}

export async function POST(req: Request) {
  const form = await req.formData();
  const reimbursementId = String(form.get('id') ?? '');
  const file = form.get('file') as File | null;
  if (!reimbursementId || !file) return NextResponse.json({ error: 'Missing id/file' }, { status: 400 });
  if (file.size > 4.3 * 1024 * 1024) return NextResponse.json({ error: 'File too large (max ~4 MB)' }, { status: 413 });

  await ensure();
  await migrateLegacy(reimbursementId);
  const b64 = Buffer.from(await file.arrayBuffer()).toString('base64');
  const dataUrl = `data:${file.type || 'application/octet-stream'};base64,${b64}`;
  const name = file.name.slice(0, 200);
  const attId = cuid();
  try {
    await sql`INSERT INTO reimbursement_attachments (id, reimbursement_id, name, data) VALUES (${attId}, ${reimbursementId}, ${name}, ${dataUrl})`;
    await syncLegacy(reimbursementId);
  } catch (e) {
    return NextResponse.json({ error: `Could not save receipt (${String(e).slice(0, 100)})` }, { status: 500 });
  }
  return NextResponse.json({ id: attId, name });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const attId = url.searchParams.get('attId');
  if (!attId) return NextResponse.json({ error: 'Missing attId' }, { status: 400 });
  await ensure();
  const [row] = await sql`SELECT reimbursement_id FROM reimbursement_attachments WHERE id = ${attId}` as any[];
  await sql`DELETE FROM reimbursement_attachments WHERE id = ${attId}`;
  if (row) await syncLegacy(row.reimbursement_id);
  return NextResponse.json({ ok: true });
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql, cuid } from '@/lib/db';
import { isBlobRef, parseBlobRef, makeBlobRef, signedDownloadUrl, deleteBlobQuietly, BLOB_MAX_BYTES } from '@/lib/blob';

// Shared company document library. Small files are stored as base64 in the DB;
// larger ones live in Vercel Blob with just a reference in the `data` column.
async function ensure() {
  await sql`CREATE TABLE IF NOT EXISTS company_documents (
    id TEXT PRIMARY KEY, name TEXT, category TEXT, file_name TEXT, mime TEXT,
    size INT, data TEXT, uploaded_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  try { await sql`ALTER TABLE company_documents ALTER COLUMN size TYPE BIGINT`; } catch { /* already bigint */ }
}
const MAX = 15 * 1024 * 1024; // ~15 MB per file (base64 path only)

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const u = new URL(req.url);
  const download = u.searchParams.get('download');
  if (download) {
    const [row] = await sql`SELECT data, mime, file_name, name FROM company_documents WHERE id = ${download}` as any[];
    if (!row?.data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    // Blob-stored file → redirect to a short-lived signed URL.
    if (isBlobRef(row.data)) {
      const ref = parseBlobRef(row.data);
      if (!ref) return NextResponse.json({ error: 'Bad file reference' }, { status: 500 });
      try { return NextResponse.redirect(await signedDownloadUrl(ref.p), { status: 302 }); }
      catch { return NextResponse.json({ error: 'Storage unavailable' }, { status: 503 }); }
    }
    const buf = Buffer.from(row.data, 'base64');
    const fname = (row.file_name || row.name || 'document').replace(/[\r\n"]/g, '');
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': row.mime || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${fname}"`,
        'Content-Length': String(buf.length),
        'Cache-Control': 'no-store',
      },
    });
  }
  const rows = await sql`SELECT id, name, category, file_name, mime, size, uploaded_by, created_at FROM company_documents ORDER BY created_at DESC`;
  return NextResponse.json({ rows });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const b = await req.json();
  const id = cuid();
  const fileName = String(b.file_name ?? 'document').slice(0, 300);
  const name = String(b.name ?? fileName).slice(0, 300) || fileName;
  const category = String(b.category ?? '').slice(0, 120);
  const uploadedBy = (session.user as any).email ?? null;

  // New path: the browser already uploaded the file straight to Blob and sends
  // only a reference. No size worry here — the token enforced the cap.
  if (b.blob_pathname) {
    const mime = String(b.mime ?? 'application/octet-stream').slice(0, 160);
    const size = Math.min(Number(b.size) || 0, BLOB_MAX_BYTES);
    const ref = makeBlobRef(String(b.blob_pathname), mime, fileName);
    await sql`INSERT INTO company_documents (id, name, category, file_name, mime, size, data, uploaded_by)
      VALUES (${id}, ${name}, ${category}, ${fileName}, ${mime}, ${size}, ${ref}, ${uploadedBy})`;
    const [row] = await sql`SELECT id, name, category, file_name, mime, size, uploaded_by, created_at FROM company_documents WHERE id = ${id}` as any[];
    return NextResponse.json({ row }, { status: 201 });
  }

  // Legacy path: small files still come through as base64 in the body.
  const dataUrl = String(b.data ?? '');
  const m = dataUrl.match(/^data:([^;]*);base64,(.*)$/);
  if (!m) return NextResponse.json({ error: 'Invalid file' }, { status: 400 });
  const mime = m[1] || 'application/octet-stream';
  const base64 = m[2];
  const size = Math.round((base64.length * 3) / 4);
  if (size > MAX) return NextResponse.json({ error: 'File too large (max 15 MB)' }, { status: 413 });
  await sql`INSERT INTO company_documents (id, name, category, file_name, mime, size, data, uploaded_by)
    VALUES (${id}, ${name}, ${category}, ${fileName}, ${mime}, ${size}, ${base64}, ${uploadedBy})`;
  const [row] = await sql`SELECT id, name, category, file_name, mime, size, uploaded_by, created_at FROM company_documents WHERE id = ${id}` as any[];
  return NextResponse.json({ row }, { status: 201 });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const { id, name, category } = await req.json();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  if (name !== undefined) await sql`UPDATE company_documents SET name = ${String(name).slice(0, 300)} WHERE id = ${id}`;
  if (category !== undefined) await sql`UPDATE company_documents SET category = ${String(category).slice(0, 120)} WHERE id = ${id}`;
  const [row] = await sql`SELECT id, name, category, file_name, mime, size, uploaded_by, created_at FROM company_documents WHERE id = ${id}` as any[];
  return NextResponse.json({ row });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const [row] = await sql`SELECT data FROM company_documents WHERE id = ${id}` as any[];
  if (row && isBlobRef(row.data)) { const ref = parseBlobRef(row.data); if (ref) await deleteBlobQuietly(ref.p); }
  await sql`DELETE FROM company_documents WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}

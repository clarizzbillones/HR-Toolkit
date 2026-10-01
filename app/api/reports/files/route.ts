export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql, cuid } from '@/lib/db';

// Archive of saved report files (e.g. a downloaded Monthly Pack re-uploaded to
// keep a record in the Reports tab). Files are stored as base64 in the DB.
async function ensure() {
  await sql`CREATE TABLE IF NOT EXISTS report_files (
    id TEXT PRIMARY KEY, tab TEXT, label TEXT, file_name TEXT, mime TEXT,
    size INT, data TEXT, uploaded_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
}
const MAX = 15 * 1024 * 1024; // 15 MB

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const u = new URL(req.url);
  const download = u.searchParams.get('download');
  if (download) {
    const [row] = await sql`SELECT data, mime, file_name, label FROM report_files WHERE id = ${download}` as any[];
    if (!row?.data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const buf = Buffer.from(row.data, 'base64');
    const fname = (row.file_name || row.label || 'report').replace(/[\r\n"]/g, '');
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
  const tab = u.searchParams.get('tab');
  const rows = tab
    ? await sql`SELECT id, tab, label, file_name, mime, size, uploaded_by, created_at FROM report_files WHERE tab = ${tab} ORDER BY created_at DESC`
    : await sql`SELECT id, tab, label, file_name, mime, size, uploaded_by, created_at FROM report_files ORDER BY created_at DESC`;
  return NextResponse.json({ rows });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const b = await req.json();
  const m = String(b.data ?? '').match(/^data:([^;]*);base64,(.*)$/);
  if (!m) return NextResponse.json({ error: 'Invalid file' }, { status: 400 });
  const mime = m[1] || 'application/octet-stream';
  const base64 = m[2];
  const size = Math.round((base64.length * 3) / 4);
  if (size > MAX) return NextResponse.json({ error: 'File too large (max 15 MB)' }, { status: 413 });
  const id = cuid();
  const fileName = String(b.file_name ?? 'report').slice(0, 300);
  const label = String(b.label ?? fileName).slice(0, 300) || fileName;
  await sql`INSERT INTO report_files (id, tab, label, file_name, mime, size, data, uploaded_by)
    VALUES (${id}, ${String(b.tab ?? 'monthly').slice(0, 40)}, ${label}, ${fileName}, ${mime}, ${size}, ${base64}, ${(session.user as any).email ?? null})`;
  const [row] = await sql`SELECT id, tab, label, file_name, mime, size, uploaded_by, created_at FROM report_files WHERE id = ${id}` as any[];
  return NextResponse.json({ row }, { status: 201 });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  await sql`DELETE FROM report_files WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}

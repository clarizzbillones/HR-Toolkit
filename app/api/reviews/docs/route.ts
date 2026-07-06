export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { sql, cuid } from '@/lib/db';

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
}

// GET ?id=&meta=1  -> { '6mo': name|null, '1yr': name|null }
// GET ?id=&which=  -> streams the stored file inline
export async function GET(req: Request) {
  await ensureTable();
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

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
  const which = form.get('which') as string;
  const file = form.get('file') as File | null;
  if (!id || !which || !file) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  const dataUrl = `data:${file.type || 'application/octet-stream'};base64,${buf.toString('base64')}`;
  await sql`INSERT INTO review_docs (id, employee_id, which, name, data)
    VALUES (${cuid()}, ${id}, ${which}, ${file.name}, ${dataUrl})
    ON CONFLICT (employee_id, which) DO UPDATE SET name = ${file.name}, data = ${dataUrl}, created_at = now()`;
  return NextResponse.json({ name: file.name });
}

export async function DELETE(req: Request) {
  await ensureTable();
  const { id, which } = await req.json();
  await sql`DELETE FROM review_docs WHERE employee_id = ${id} AND which = ${which}`;
  return NextResponse.json({ ok: true });
}

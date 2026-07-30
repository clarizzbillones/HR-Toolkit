export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql, cuid } from '@/lib/db';

async function requireHrAdmin() {
  const session = await getServerSession(authOptions);
  return !!session?.user;
}
const FORBIDDEN = () => NextResponse.json({ error: 'Forbidden' }, { status: 403 });

// Documents attached to an employee profile: performance-review summaries,
// coaching entries, and dated remarks/timeline items (with what-we-did and
// next-steps). Optional file attachment stored as a data URL.
const stripDoc = (d: any) => ({ ...d, attachment_data: undefined, has_attachment: !!d.attachment_data });

export async function GET(req: Request) {
  if (!(await requireHrAdmin())) return FORBIDDEN();
  // Stream a document's attached file.
  const id = new URL(req.url).searchParams.get('file');
  if (!id) return NextResponse.json({ error: 'Missing file id' }, { status: 400 });
  const [row] = await sql`SELECT attachment_name, attachment_data FROM employee_files WHERE id = ${id}` as any[];
  if (!row?.attachment_data) return NextResponse.json({ error: 'No attachment' }, { status: 404 });
  const dataUrl = String(row.attachment_data);
  const comma = dataUrl.indexOf(',');
  if (!dataUrl.startsWith('data:') || comma < 0) return NextResponse.json({ error: 'Bad attachment' }, { status: 500 });
  const header = dataUrl.slice(5, comma);
  const payload = dataUrl.slice(comma + 1);
  const isB64 = /;base64/i.test(header);
  const mime = header.replace(/;base64/i, '').split(';')[0] || 'application/octet-stream';
  const buf = isB64 ? Buffer.from(payload, 'base64') : Buffer.from(decodeURIComponent(payload), 'utf8');
  const name = (row.attachment_name || 'document').replace(/[^\w.\-]+/g, '_');
  return new NextResponse(new Uint8Array(buf), {
    headers: { 'Content-Type': mime, 'Content-Disposition': `inline; filename="${name}"`, 'Cache-Control': 'private, no-store' },
  });
}

export async function POST(req: Request) {
  if (!(await requireHrAdmin())) return FORBIDDEN();
  const b = await req.json();
  if (!b.profile_id) return NextResponse.json({ error: 'Missing profile_id' }, { status: 400 });
  const attData = typeof b.attachment_data === 'string' && b.attachment_data.startsWith('data:') ? b.attachment_data : null;
  const attName = attData ? String(b.attachment_name ?? 'document').slice(0, 200) : null;
  const id = cuid();
  await sql`INSERT INTO employee_files (id, profile_id, category, title, doc_date, summary, what_we_did, next_steps, author, attachment_name, attachment_data)
    VALUES (${id}, ${b.profile_id}, ${b.category ?? 'Remark'}, ${b.title ?? ''}, ${b.doc_date ?? null}, ${b.summary ?? ''}, ${b.what_we_did ?? ''}, ${b.next_steps ?? ''}, ${b.author ?? ''}, ${attName}, ${attData})`;
  const [row] = await sql`SELECT * FROM employee_files WHERE id = ${id}` as any[];
  return NextResponse.json({ doc: stripDoc(row) }, { status: 201 });
}

export async function PATCH(req: Request) {
  if (!(await requireHrAdmin())) return FORBIDDEN();
  const b = await req.json();
  if (!b.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  // Only replace the attachment when a new data URL is supplied.
  const newAtt = typeof b.attachment_data === 'string' && b.attachment_data.startsWith('data:');
  await sql`UPDATE employee_files SET
    category = ${b.category ?? 'Remark'}, title = ${b.title ?? ''}, doc_date = ${b.doc_date ?? null},
    summary = ${b.summary ?? ''}, what_we_did = ${b.what_we_did ?? ''}, next_steps = ${b.next_steps ?? ''}, author = ${b.author ?? ''}
    WHERE id = ${b.id}`;
  if (newAtt) {
    await sql`UPDATE employee_files SET attachment_name = ${String(b.attachment_name ?? 'document').slice(0, 200)}, attachment_data = ${b.attachment_data} WHERE id = ${b.id}`;
  } else if (b.remove_attachment) {
    await sql`UPDATE employee_files SET attachment_name = NULL, attachment_data = NULL WHERE id = ${b.id}`;
  }
  const [row] = await sql`SELECT * FROM employee_files WHERE id = ${b.id}` as any[];
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ doc: stripDoc(row) });
}

export async function DELETE(req: Request) {
  if (!(await requireHrAdmin())) return FORBIDDEN();
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  await sql`DELETE FROM employee_files WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}

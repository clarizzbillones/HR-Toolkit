export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql, cuid } from '@/lib/db';
import { sendMailAsApp } from '@/lib/graph';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { readFile } from 'fs/promises';
import path from 'path';

const SENDER = process.env.REVIEW_REMINDER_SENDER ?? 'clarizz@litson.co';
const HR_CC = process.env.COACHING_HR_CC ?? 'clarizz@litson.co';
const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const mmdd = (iso: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? `${m[2]}-${m[3]}-${m[1]}` : (iso || ''); };

async function ensure() {
  await sql`CREATE TABLE IF NOT EXISTS w8ben_requests (
    id TEXT PRIMARY KEY, onboardee_id TEXT, contractor_name TEXT, contractor_email TEXT,
    token TEXT UNIQUE, status TEXT DEFAULT 'Sent', data TEXT, pdf_data TEXT,
    submitted_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
}
function origin(req: Request) { const h = req.headers; return process.env.NEXTAUTH_URL || `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host')}`; }

async function templateBytes(): Promise<Buffer> {
  for (const p of [path.join(process.cwd(), 'public', 'forms', 'w8ben.pdf')]) {
    try { return await readFile(p); } catch { /* try fetch */ }
  }
  throw new Error('template missing');
}

// Overlay the contractor's values onto the official flat W-8BEN and return bytes.
async function fillW8ben(d: any): Promise<Uint8Array> {
  const doc = await PDFDocument.load(await templateBytes());
  const page = doc.getPages()[0];
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const ink = rgb(0.05, 0.05, 0.05);
  const put = (t: any, x: number, y: number, size = 9) => { if (t == null || t === '') return; page.drawText(String(t), { x, y, size, font, color: ink }); };
  put(d.name, 52, 543); put(d.country, 384, 543);
  put(d.address, 52, 519);
  put(d.city3, 68, 496); put(d.country3, 449, 496);
  put(d.mailing, 52, 471);
  put(d.city4, 68, 448); put(d.country4, 449, 448);
  put(d.usTin, 52, 423);
  put(d.foreignTin, 48, 397);
  if (d.ftinNotReq) put('X', 279, 406, 10);
  put(d.reference, 52, 373);
  put(mmdd(d.dob), 360, 373);
  // Part III — signature line
  if (typeof d.signatureImage === 'string' && d.signatureImage.startsWith('data:image')) {
    try {
      const png = await doc.embedPng(Buffer.from(d.signatureImage.split(',')[1] ?? '', 'base64'));
      const w = Math.min(150, png.width); const h = Math.min((png.height / png.width) * w, 26);
      page.drawImage(png, { x: 120, y: 70, width: w, height: h });
    } catch { /* skip */ }
  } else if (d.printName) {
    page.drawText(String(d.printName), { x: 130, y: 74, size: 13, font: await doc.embedFont(StandardFonts.HelveticaOblique), color: ink });
  }
  put(mmdd(d.signDate), 470, 74, 9);
  put(d.printName, 130, 44);
  // Flatten is a no-op (flat PDF), but the drawn text is permanent / non-editable.
  return doc.save();
}

export async function GET(req: Request) {
  await ensure();
  const u = new URL(req.url);
  const token = u.searchParams.get('token');
  if (token) {
    const [row] = await sql`SELECT contractor_name, status, data FROM w8ben_requests WHERE token = ${token}` as any[];
    if (!row) return NextResponse.json({ error: 'This link is invalid or has expired.' }, { status: 404 });
    let data = {}; try { data = row.data ? JSON.parse(row.data) : {}; } catch { /* ignore */ }
    return NextResponse.json({ row: { contractor_name: row.contractor_name, status: row.status, data: row.status === 'Completed' ? data : { name: row.contractor_name } } });
  }
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const download = u.searchParams.get('download');
  if (download) {
    const [row] = await sql`SELECT * FROM w8ben_requests WHERE id = ${download}` as any[];
    if (!row?.pdf_data) return NextResponse.json({ error: 'Not available' }, { status: 404 });
    const bytes = Buffer.from(String(row.pdf_data).split(',')[1] ?? '', 'base64');
    return new NextResponse(bytes, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="W-8BEN-${String(row.contractor_name || 'form').replace(/[^\w]+/g, '-')}.pdf"` } });
  }
  const onboardeeId = u.searchParams.get('onboardeeId');
  if (onboardeeId) {
    const [row] = await sql`SELECT id, contractor_name, contractor_email, token, status, created_at, submitted_at FROM w8ben_requests WHERE onboardee_id = ${onboardeeId} ORDER BY created_at DESC LIMIT 1` as any[];
    return NextResponse.json({ row: row ?? null });
  }
  return NextResponse.json({ error: 'Missing token/onboardeeId' }, { status: 400 });
}

export async function POST(req: Request) {
  await ensure();
  const b = await req.json();

  if (b.action === 'submit') {
    const [row] = await sql`SELECT * FROM w8ben_requests WHERE token = ${b.token}` as any[];
    if (!row) return NextResponse.json({ error: 'This link is invalid or has expired.' }, { status: 404 });
    if (row.status === 'Completed') return NextResponse.json({ error: 'This form was already submitted.', done: true }, { status: 409 });
    const data = (b.data && typeof b.data === 'object') ? b.data : {};
    let pdfBytes: Uint8Array;
    try { pdfBytes = await fillW8ben(data); } catch (e) { return NextResponse.json({ error: `Could not build the PDF (${String(e).slice(0, 80)}).` }, { status: 500 }); }
    const b64 = Buffer.from(pdfBytes).toString('base64');
    await sql`UPDATE w8ben_requests SET data = ${JSON.stringify(data)}, pdf_data = ${`data:application/pdf;base64,${b64}`}, status = 'Completed', submitted_at = NOW() WHERE id = ${row.id}`;
    const fname = `W-8BEN-${String(row.contractor_name || 'form').replace(/[^\w]+/g, '-')}.pdf`;
    try {
      const to = row.contractor_email && row.contractor_email !== HR_CC ? HR_CC : HR_CC;
      const cc = row.contractor_email ? [row.contractor_email] : [];
      await sendMailAsApp(SENDER, to, `Completed W-8BEN — ${row.contractor_name}`,
        `<div style="font-family:Arial,sans-serif;color:#1b2a3d;max-width:560px"><p><b>${esc(row.contractor_name)}</b> has completed and submitted their Form W-8BEN. The finalized PDF is attached (non-editable).</p></div>`,
        cc, [{ name: fname, contentBytes: b64, contentType: 'application/pdf' }]);
    } catch { /* best-effort */ }
    return NextResponse.json({ ok: true });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (b.action === 'send') {
    const name = String(b.contractor_name ?? '').trim();
    const email = String(b.contractor_email ?? '').trim();
    if (!name) return NextResponse.json({ error: 'Contractor name required' }, { status: 400 });
    const id = cuid(); const token = cuid() + cuid();
    await sql`INSERT INTO w8ben_requests (id, onboardee_id, contractor_name, contractor_email, token, status)
      VALUES (${id}, ${b.onboardee_id ?? null}, ${name}, ${email || null}, ${token}, 'Sent')`;
    const url = `${origin(req)}/onboarding/w8ben/${token}`;
    let blankB64 = '';
    try { blankB64 = (await templateBytes()).toString('base64'); } catch { /* ignore */ }
    let mail: any = { ok: false, error: email ? '' : 'No recipient email' };
    if (email) {
      try {
        mail = await sendMailAsApp(SENDER, email, 'Litson PLLC — Please complete Form W-8BEN',
          `<div style="font-family:Arial,sans-serif;color:#1b2a3d;max-width:560px"><div style="background:#1b2a3d;border-top:3px solid #c9a24a;border-radius:10px;padding:14px 16px;margin-bottom:16px"><div style="font-size:14px;font-weight:700;letter-spacing:4px;color:#c9a24a">LITSON</div><div style="font-size:7.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#9fb0c4;margin-top:2px">PLLC &middot; Human Resources</div></div><p>Hi ${esc(name.split(' ')[0])},</p><p>As part of your onboarding as an international contractor, please complete IRS <b>Form W-8BEN</b> (Certificate of Foreign Status). A blank copy is attached for reference.</p><p style="margin:18px 0"><a href="${esc(url)}" style="display:inline-block;background:#1b2a3d;color:#fff;text-decoration:none;font-weight:bold;padding:11px 22px;border-radius:8px">Fill out &amp; submit the W-8BEN</a></p><p style="font-size:12px;color:#666">Fill it in online and submit — a finalized, non-editable PDF is sent to us and to you automatically. Or paste this link:<br>${esc(url)}</p></div>`,
          HR_CC, blankB64 ? [{ name: 'Form-W-8BEN-blank.pdf', contentBytes: blankB64, contentType: 'application/pdf' }] : undefined);
      } catch (e) { mail = { ok: false, error: String(e).slice(0, 200) }; }
    }
    return NextResponse.json({ ok: true, id, url, token, emailed: !!(email && mail.ok), mail });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  await sql`DELETE FROM w8ben_requests WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql, cuid } from '@/lib/db';
import { sendMailAsApp } from '@/lib/graph';

// E-signature for HR Forms. Public by token (the sign page + the sign action);
// send / remind / list require an HR session. Signatories carry a role
// (HR / Manager / Employee / Witness); the witness signs only if the employee
// declines. Modeled on the coaching e-sign flow.
const SENDER = process.env.REVIEW_REMINDER_SENDER ?? 'clarizz@litson.co';
const HR_CC = process.env.COACHING_HR_CC ?? 'clarizz@litson.co';
const lc = (s: any) => String(s ?? '').trim().toLowerCase();
const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

interface Sig { role: string; name: string; email?: string; signed_at?: string | null; signature_name?: string | null; signature_image?: string | null }
function parseSigs(raw: any): Sig[] {
  try { const a = typeof raw === 'string' ? JSON.parse(raw) : raw; return Array.isArray(a) ? a : []; } catch { return []; }
}

async function ensure() {
  await sql`CREATE TABLE IF NOT EXISTS hr_form_signatures (
    id TEXT PRIMARY KEY, title TEXT, body_html TEXT, note TEXT,
    signatories TEXT, sign_token TEXT UNIQUE, status TEXT DEFAULT 'Sent',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`ALTER TABLE hr_form_signatures ADD COLUMN IF NOT EXISTS attach_to_file BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`ALTER TABLE hr_form_signatures ADD COLUMN IF NOT EXISTS employee_name TEXT`;
  await sql`ALTER TABLE hr_form_signatures ADD COLUMN IF NOT EXISTS category TEXT`;
  await sql`ALTER TABLE hr_form_signatures ADD COLUMN IF NOT EXISTS pdf_payload TEXT`;
}

// On full approval, build a branded PDF and file it under the employee.
async function attachIfNeeded(row: any) {
  if (!row.attach_to_file) return;
  try {
    const { severancePdfDataUrl } = await import('@/lib/employeePdf');
    const { attachPdfToEmployeeFile } = await import('@/lib/employeeFiles');
    const payload = typeof row.pdf_payload === 'string' ? JSON.parse(row.pdf_payload) : row.pdf_payload;
    const sigs = parseSigs(row.signatories);
    const approver = sigs.find(s => /approver/i.test(s.role) && s.signed_at) ?? sigs.find(s => s.signed_at);
    const dataUrl = await severancePdfDataUrl(payload, approver);
    await attachPdfToEmployeeFile({
      name: row.employee_name || payload?.employee || '',
      category: row.category || 'Severance',
      title: `${row.title || 'Severance Worksheet'} (approved)`,
      docDate: payload?.sepDate || null,
      attName: `${String(row.title || 'Severance-Worksheet').replace(/[^\w]+/g, '-')}.pdf`,
      dataUrl,
      sourceRef: `hrsign:${row.id}`,
      summary: `Approved by ${approver?.signature_name || approver?.name || 'approver'}.`,
      author: payload?.preparerName || '',
    });
  } catch { /* best-effort */ }
}
function publicRow(row: any) {
  // Strip emails from what the public sign page sees.
  const sigs = parseSigs(row.signatories).map(s => ({ ...s, email: undefined }));
  return { id: row.id, title: row.title, body_html: row.body_html, note: row.note, status: row.status, created_at: row.created_at, signatories: sigs };
}

function origin(req: Request) {
  const h = req.headers;
  return process.env.NEXTAUTH_URL || `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host')}`;
}
function emailHtml(title: string, note: string, signUrl: string, role: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#1b2a3d;max-width:560px">
    <div style="background:#1b2a3d;border-top:3px solid #c9a24a;border-radius:10px;padding:14px 16px;margin-bottom:16px">
      <div style="font-size:14px;font-weight:700;letter-spacing:4px;color:#c9a24a">LITSON</div>
      <div style="font-size:7.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#9fb0c4;margin-top:2px">PLLC &middot; Human Resources</div>
    </div>
    <p>You have a document to review and sign as the <b>${esc(role)}</b>:</p>
    <p style="font-size:15px;font-weight:700;margin:4px 0 0">${esc(title)}</p>
    <div style="background:#f7efe1;border:1px solid #ecd9b6;border-radius:8px;padding:10px 14px;margin:14px 0;color:#8a6d2a;font-weight:600">⏱ Please review and sign within 24 hours.</div>
    ${note ? `<p style="font-size:13px;color:#555">${esc(note)}</p>` : ''}
    <p style="margin:18px 0"><a href="${esc(signUrl)}" style="display:inline-block;background:#1b2a3d;color:#fff;text-decoration:none;font-weight:bold;padding:11px 22px;border-radius:8px">Review &amp; sign</a></p>
    <p style="font-size:12px;color:#666">Or paste this link into your browser:<br>${esc(signUrl)}</p>
  </div>`;
}

async function emailSigners(req: Request, row: any, onlyUnsigned: boolean, reminder: boolean) {
  const sigs = parseSigs(row.signatories);
  const url = `${origin(req)}/hr-forms/sign/${row.sign_token}`;
  for (const s of sigs) {
    if (!s.email) continue;
    if (onlyUnsigned && s.signed_at) continue;
    if (s.role === 'Witness') continue; // witness only signs if employee declines; don't chase them
    const subj = `${reminder ? 'Reminder: ' : ''}Please sign — ${row.title}`;
    try { await sendMailAsApp(SENDER, s.email, subj, emailHtml(row.title, row.note, url, s.role)); } catch { /* best-effort */ }
  }
}

export async function GET(req: Request) {
  await ensure();
  const token = new URL(req.url).searchParams.get('token');
  if (token) {
    const [row] = await sql`SELECT * FROM hr_form_signatures WHERE sign_token = ${token}` as any[];
    if (!row) return NextResponse.json({ error: 'This link is invalid or has expired.' }, { status: 404 });
    return NextResponse.json({ row: publicRow(row) });
  }
  // List (requires session).
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const rows = await sql`SELECT id, title, note, signatories, status, sign_token, created_at FROM hr_form_signatures ORDER BY created_at DESC LIMIT 100` as any[];
  return NextResponse.json({ rows: rows.map(r => ({ ...r, signatories: parseSigs(r.signatories) })) });
}

export async function POST(req: Request) {
  await ensure();
  const b = await req.json();
  const action = b.action;

  if (action === 'sign') {
    // Public — guarded by the token.
    const { token, role, name: who, signature_name, signature_image } = b;
    if (!token || (!signature_name && !signature_image)) return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    const [row] = await sql`SELECT * FROM hr_form_signatures WHERE sign_token = ${token}` as any[];
    if (!row) return NextResponse.json({ error: 'This link is invalid or has expired.' }, { status: 404 });
    const sigs = parseSigs(row.signatories);
    const idx = sigs.findIndex(s => (role ? lc(s.role) === lc(role) : false) && (who ? lc(s.name) === lc(who) : true) && !s.signed_at) ;
    const i = idx >= 0 ? idx : sigs.findIndex(s => !s.signed_at && (role ? lc(s.role) === lc(role) : true));
    if (i < 0) return NextResponse.json({ error: 'No matching unsigned signatory.' }, { status: 404 });
    sigs[i] = { ...sigs[i], signed_at: new Date().toISOString(), signature_name: signature_name || sigs[i].name, signature_image: signature_image || null };
    // Complete when everyone except an unused witness has signed.
    const outstanding = sigs.filter(s => !s.signed_at && s.role !== 'Witness');
    const done = outstanding.length === 0;
    await sql`UPDATE hr_form_signatures SET signatories = ${JSON.stringify(sigs)}, status = ${done ? 'Signed' : 'Sent'} WHERE id = ${row.id}`;
    if (done) {
      const [updated] = await sql`SELECT * FROM hr_form_signatures WHERE id = ${row.id}` as any[];
      try {
        const emails = [...parseSigs(updated.signatories).map(s => s.email), HR_CC].filter(Boolean).filter((v, ix, a) => a.indexOf(v) === ix) as string[];
        if (emails.length) await sendMailAsApp(SENDER, emails[0], `Signed — ${updated.title}`, `<p>The form <b>${esc(updated.title)}</b> has been signed by all required signatories and is on file in the HR Toolkit.</p>`, emails.slice(1));
      } catch { /* best-effort */ }
      await attachIfNeeded(updated);
    }
    return NextResponse.json({ ok: true, allSigned: done });
  }

  // Everything below requires a session.
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (action === 'send') {
    const title = String(b.title ?? '').trim() || 'HR Form';
    const signatories: Sig[] = (Array.isArray(b.signatories) ? b.signatories : [])
      .map((s: any) => ({ role: String(s.role ?? '').trim(), name: String(s.name ?? '').trim(), email: String(s.email ?? '').trim() || undefined, signed_at: null, signature_name: null, signature_image: null }))
      .filter((s: Sig) => s.name);
    if (!signatories.length) return NextResponse.json({ error: 'Add at least one signatory' }, { status: 400 });
    const id = cuid();
    const token = cuid() + cuid();
    const note = String(b.note ?? '').trim() || 'Please review and sign within 24 hours of receipt.';
    await sql`INSERT INTO hr_form_signatures (id, title, body_html, note, signatories, sign_token, status, attach_to_file, employee_name, category, pdf_payload)
      VALUES (${id}, ${title}, ${b.body_html ?? ''}, ${note}, ${JSON.stringify(signatories)}, ${token}, 'Sent',
        ${!!b.attach_to_file}, ${b.employee_name ?? null}, ${b.category ?? null}, ${b.pdf_payload ? JSON.stringify(b.pdf_payload) : null})`;
    const [row] = await sql`SELECT * FROM hr_form_signatures WHERE id = ${id}` as any[];
    await emailSigners(req, row, false, false);
    const url = `${origin(req)}/hr-forms/sign/${token}`;
    return NextResponse.json({ ok: true, id, url, sent: signatories.filter(s => s.email && s.role !== 'Witness').length });
  }

  if (action === 'remind') {
    const [row] = await sql`SELECT * FROM hr_form_signatures WHERE id = ${b.id}` as any[];
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    await emailSigners(req, row, true, true);
    const n = parseSigs(row.signatories).filter(s => s.email && !s.signed_at && s.role !== 'Witness').length;
    return NextResponse.json({ ok: true, reminded: n });
  }

  if (action === 'delete') {
    await sql`DELETE FROM hr_form_signatures WHERE id = ${b.id}`;
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql, cuid } from '@/lib/db';
import { sendMailAsApp } from '@/lib/graph';
import { EXIT_QUESTIONS, exitAnswerLabel } from '@/lib/exitInterview';

// Exit-interview form. Sending / viewing requires an HR session; the fill-in
// page + submit are public, guarded by the random token.
const SENDER = process.env.REVIEW_REMINDER_SENDER ?? 'clarizz@litson.co';
const HR_CC = process.env.COACHING_HR_CC ?? 'clarizz@litson.co';
const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function ensure() {
  await sql`CREATE TABLE IF NOT EXISTS exit_interviews (
    id TEXT PRIMARY KEY, offboarding_id TEXT, employee_name TEXT, employee_email TEXT,
    token TEXT UNIQUE, status TEXT DEFAULT 'Sent', answers TEXT, submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
}
function parseAns(v: any): Record<string, any> {
  try { const a = typeof v === 'string' ? JSON.parse(v) : v; return a && typeof a === 'object' ? a : {}; } catch { return {}; }
}
function origin(req: Request) { const h = req.headers; return process.env.NEXTAUTH_URL || `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host')}`; }

export async function GET(req: Request) {
  await ensure();
  const u = new URL(req.url);
  const token = u.searchParams.get('token');
  if (token) {
    const [row] = await sql`SELECT * FROM exit_interviews WHERE token = ${token}` as any[];
    if (!row) return NextResponse.json({ error: 'This link is invalid or has expired.' }, { status: 404 });
    return NextResponse.json({ row: { employee_name: row.employee_name, status: row.status, questions: EXIT_QUESTIONS, answers: row.status === 'Completed' ? parseAns(row.answers) : {} } });
  }
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const offboardingId = u.searchParams.get('offboardingId');
  if (offboardingId) {
    const [row] = await sql`SELECT * FROM exit_interviews WHERE offboarding_id = ${offboardingId} ORDER BY created_at DESC LIMIT 1` as any[];
    return NextResponse.json({ row: row ? { ...row, answers: parseAns(row.answers) } : null, questions: EXIT_QUESTIONS });
  }
  return NextResponse.json({ error: 'Missing token/offboardingId' }, { status: 400 });
}

export async function POST(req: Request) {
  await ensure();
  const b = await req.json();

  if (b.action === 'submit') {
    const [row] = await sql`SELECT * FROM exit_interviews WHERE token = ${b.token}` as any[];
    if (!row) return NextResponse.json({ error: 'This link is invalid or has expired.' }, { status: 404 });
    if (row.status === 'Completed') return NextResponse.json({ error: 'This exit interview was already submitted.', done: true }, { status: 409 });
    const answers = (b.answers && typeof b.answers === 'object') ? b.answers : {};
    await sql`UPDATE exit_interviews SET answers = ${JSON.stringify(answers)}, status = 'Completed', submitted_at = NOW() WHERE id = ${row.id}`;
    // Notify HR + file a branded PDF under the employee.
    try {
      const summary = EXIT_QUESTIONS.map(q => `<div style="margin:8px 0"><div style="font-weight:700;color:#1b2a3d">${esc(q.label)}</div><div>${esc(exitAnswerLabel(q, answers[q.id]))}</div></div>`).join('');
      await sendMailAsApp(SENDER, HR_CC, `Exit interview completed — ${row.employee_name}`, `<div style="font-family:Arial,sans-serif;color:#1b2a3d;max-width:600px"><p><b>${esc(row.employee_name)}</b> has completed their exit interview.</p>${summary}</div>`);
    } catch { /* best-effort */ }
    try {
      const { exitInterviewPdfDataUrl } = await import('@/lib/employeePdf');
      const { attachPdfToEmployeeFile } = await import('@/lib/employeeFiles');
      const dataUrl = await exitInterviewPdfDataUrl(row.employee_name, EXIT_QUESTIONS.map(q => ({ q: q.label, a: exitAnswerLabel(q, answers[q.id]) })));
      await attachPdfToEmployeeFile({ name: row.employee_name, category: 'Remark / Timeline', title: 'Exit interview', attName: `Exit-interview-${String(row.employee_name).replace(/[^\w]+/g, '-')}.pdf`, dataUrl, sourceRef: `exit:${row.id}`, summary: 'Completed exit interview.' });
    } catch { /* best-effort */ }
    return NextResponse.json({ ok: true });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (b.action === 'send') {
    const name = String(b.employee_name ?? '').trim();
    const email = String(b.employee_email ?? '').trim();
    if (!name) return NextResponse.json({ error: 'Employee name required' }, { status: 400 });
    const id = cuid(); const token = cuid() + cuid();
    await sql`INSERT INTO exit_interviews (id, offboarding_id, employee_name, employee_email, token, status)
      VALUES (${id}, ${b.offboarding_id ?? null}, ${name}, ${email || null}, ${token}, 'Sent')`;
    const url = `${origin(req)}/offboarding/exit/${token}`;
    if (email) {
      try {
        await sendMailAsApp(SENDER, email, 'Litson PLLC — Exit interview', `<div style="font-family:Arial,sans-serif;color:#1b2a3d;max-width:560px"><div style="background:#1b2a3d;border-top:3px solid #c9a24a;border-radius:10px;padding:14px 16px;margin-bottom:16px"><div style="font-size:14px;font-weight:700;letter-spacing:4px;color:#c9a24a">LITSON</div><div style="font-size:7.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#9fb0c4;margin-top:2px">PLLC &middot; Human Resources</div></div><p>Hi ${esc(name.split(' ')[0])},</p><p>As part of your departure, we'd be grateful if you would complete a short, confidential exit interview. Your feedback helps us improve.</p><p style="margin:18px 0"><a href="${esc(url)}" style="display:inline-block;background:#1b2a3d;color:#fff;text-decoration:none;font-weight:bold;padding:11px 22px;border-radius:8px">Complete the exit interview</a></p><p style="font-size:12px;color:#666">Or paste this link into your browser:<br>${esc(url)}</p></div>`);
      } catch { /* best-effort */ }
    }
    return NextResponse.json({ ok: true, id, url, emailed: !!email });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  // Also remove the PDF filed under the employee, so a re-test starts clean.
  try { await sql`DELETE FROM employee_files WHERE source_ref = ${`exit:${id}`}`; } catch { /* table may not exist */ }
  await sql`DELETE FROM exit_interviews WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}

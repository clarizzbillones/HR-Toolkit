export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { sendMailAsApp } from '@/lib/graph';
import { coachingReceiptHtml } from '@/lib/coachingDoc';

// Public (no-auth) endpoint used by the e-sign page. Guarded by the random
// sign token, not a session, so an employee without a login can sign.
const SENDER = process.env.REVIEW_REMINDER_SENDER ?? 'clarizz@litson.co';
const HR_CC = process.env.COACHING_HR_CC ?? 'clarizz@litson.co';

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  const [row] = await sql`SELECT * FROM coaching_notes WHERE sign_token = ${token}` as any[];
  if (!row) return NextResponse.json({ error: 'This link is invalid or has expired.' }, { status: 404 });
  // Strip the token from the payload we hand back to the browser.
  return NextResponse.json({ row: { ...row, sign_token: undefined } });
}

export async function POST(req: Request) {
  const b = await req.json();
  const token = b.token;
  const name = String(b.signature_name ?? '').trim();
  if (!token || !name) return NextResponse.json({ error: 'Missing token or name' }, { status: 400 });

  const [row] = await sql`SELECT * FROM coaching_notes WHERE sign_token = ${token}` as any[];
  if (!row) return NextResponse.json({ error: 'This link is invalid or has expired.' }, { status: 404 });
  if (row.signed_at) return NextResponse.json({ error: 'This form has already been signed.', alreadySigned: true }, { status: 409 });

  await sql`UPDATE coaching_notes SET status = 'Signed', signed_at = NOW(), signature_name = ${name} WHERE id = ${row.id}`;
  const [signed] = await sql`SELECT * FROM coaching_notes WHERE id = ${row.id}` as any[];

  // Receipt copies to the employee, the coach, and HR.
  try {
    const recipients = [signed.employee_email, signed.coach_email, HR_CC]
      .filter(Boolean).filter((v: string, i: number, a: string[]) => a.indexOf(v) === i) as string[];
    if (recipients.length) {
      const html = coachingReceiptHtml(signed);
      await sendMailAsApp(SENDER, recipients[0], `Signed coaching form — ${signed.employee}`, html, recipients.slice(1));
    }
  } catch { /* email is best-effort; the signature is already recorded */ }

  return NextResponse.json({ ok: true });
}

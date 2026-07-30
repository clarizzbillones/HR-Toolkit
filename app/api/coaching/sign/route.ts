export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { sendMailAsApp } from '@/lib/graph';
import { coachingReceiptHtml, parseSignatories, type Signatory } from '@/lib/coachingDoc';
import { syncCoachingToEmployeeFile } from '@/lib/employeeFiles';

// Public (no-auth) endpoint used by the e-sign page. Guarded by the random
// sign token, not a session. Supports multiple signatories, each signing
// their own slot with their own name + date.
const SENDER = process.env.REVIEW_REMINDER_SENDER ?? 'clarizz@litson.co';
const HR_CC = process.env.COACHING_HR_CC ?? 'clarizz@litson.co';
const lc = (s: any) => String(s ?? '').trim().toLowerCase();

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  const [row] = await sql`SELECT * FROM coaching_notes WHERE sign_token = ${token}` as any[];
  if (!row) return NextResponse.json({ error: 'This link is invalid or has expired.' }, { status: 404 });
  return NextResponse.json({ row: { ...row, sign_token: undefined, employee_email: undefined, coach_email: undefined } });
}

export async function POST(req: Request) {
  const b = await req.json();
  const token = b.token;
  const who = String(b.signatory ?? '').trim();          // which signatory (by name)
  const name = String(b.signature_name ?? '').trim();     // typed signature
  if (!token || !name) return NextResponse.json({ error: 'Missing token or name' }, { status: 400 });

  const [row] = await sql`SELECT * FROM coaching_notes WHERE sign_token = ${token}` as any[];
  if (!row) return NextResponse.json({ error: 'This link is invalid or has expired.' }, { status: 404 });

  const sigs: Signatory[] = parseSignatories(row.signatories);

  if (sigs.length) {
    const idx = who
      ? sigs.findIndex(s => lc(s.name) === lc(who))
      : sigs.findIndex(s => !s.signed_at);
    if (idx < 0) return NextResponse.json({ error: 'Signatory not found for this form.' }, { status: 404 });
    if (sigs[idx].signed_at) return NextResponse.json({ error: `${sigs[idx].name} has already signed.`, alreadySigned: true }, { status: 409 });
    sigs[idx] = { ...sigs[idx], signed_at: new Date().toISOString(), signature_name: name };
    const allSigned = sigs.every(s => s.signed_at);
    if (allSigned) {
      await sql`UPDATE coaching_notes SET signatories = ${JSON.stringify(sigs)}, status = 'Signed', signed_at = NOW(), signature_name = ${name} WHERE id = ${row.id}`;
    } else {
      await sql`UPDATE coaching_notes SET signatories = ${JSON.stringify(sigs)} WHERE id = ${row.id}`;
    }
    const [updated] = await sql`SELECT * FROM coaching_notes WHERE id = ${row.id}` as any[];
    if (allSigned) { await sendReceipt(updated, sigs); await syncCoachingToEmployeeFile(updated); }
    return NextResponse.json({ ok: true, allSigned });
  }

  // Legacy single-signature fallback.
  if (row.signed_at) return NextResponse.json({ error: 'This form has already been signed.', alreadySigned: true }, { status: 409 });
  await sql`UPDATE coaching_notes SET status = 'Signed', signed_at = NOW(), signature_name = ${name} WHERE id = ${row.id}`;
  const [updated] = await sql`SELECT * FROM coaching_notes WHERE id = ${row.id}` as any[];
  await sendReceipt(updated, []);
  await syncCoachingToEmployeeFile(updated);
  return NextResponse.json({ ok: true, allSigned: true });
}

async function sendReceipt(signed: any, sigs: Signatory[]) {
  try {
    const emails = [signed.employee_email, signed.coach_email, ...sigs.map(s => s.email), HR_CC]
      .filter(Boolean).filter((v: string, i: number, a: string[]) => a.indexOf(v) === i) as string[];
    if (emails.length) {
      const html = coachingReceiptHtml(signed);
      await sendMailAsApp(SENDER, emails[0], `Signed coaching form — ${signed.employee}`, html, emails.slice(1));
    }
  } catch { /* best-effort */ }
}

export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { sql, cuid } from '@/lib/db';
import { sendMailAsApp } from '@/lib/graph';
import { coachingEmailHtml, parseSignatories, type Signatory } from '@/lib/coachingDoc';

const lc = (s: any) => String(s ?? '').trim().toLowerCase();

const SENDER = process.env.REVIEW_REMINDER_SENDER ?? 'clarizz@litson.co';
const HR_CC = process.env.COACHING_HR_CC ?? 'clarizz@litson.co';

// Coaching / 1-on-1 forms per employee: type (weekly/30/60/90), an editable
// coaching draft, action items, signatories, and an e-sign workflow
// (Draft -> Sent -> Signed) with emailed copies to the employee, coach and HR.
async function ensure() {
  await sql`CREATE TABLE IF NOT EXISTS coaching_notes (
    id TEXT PRIMARY KEY, employee TEXT, date TEXT, topic TEXT, notes TEXT,
    action_items TEXT, follow_up_date TEXT, status TEXT DEFAULT 'Draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  for (const c of [
    'coach_name TEXT', 'coach_position TEXT', 'coach_email TEXT', 'coaching_type TEXT',
    'signatories TEXT', 'submitted_at TIMESTAMPTZ', 'sign_token TEXT',
    'signed_at TIMESTAMPTZ', 'signature_name TEXT', 'employee_email TEXT',
  ]) {
    await sql.unsafe(`ALTER TABLE coaching_notes ADD COLUMN IF NOT EXISTS ${c}`);
  }
}

function baseUrl(req: Request) {
  return process.env.NEXTAUTH_URL || new URL(req.url).origin;
}

export async function GET() {
  await ensure();
  const rows = await sql`SELECT * FROM coaching_notes ORDER BY date DESC NULLS LAST, created_at DESC`;
  // Never leak the raw sign token to the dashboard payload.
  return NextResponse.json({ rows: (rows as any[]).map(r => ({ ...r, sign_token: r.sign_token ? true : null })) });
}

export async function POST(req: Request) {
  await ensure();
  const b = await req.json();
  const id = cuid();
  await sql`INSERT INTO coaching_notes
    (id, employee, employee_email, coach_name, coach_position, coach_email, coaching_type, date, topic, notes, action_items, signatories, follow_up_date, status)
    VALUES (${id}, ${b.employee ?? ''}, ${b.employee_email ?? null}, ${b.coach_name ?? ''}, ${b.coach_position ?? ''}, ${b.coach_email ?? null},
      ${b.coaching_type ?? 'Weekly'}, ${b.date ?? null}, ${b.topic ?? ''}, ${b.notes ?? ''}, ${b.action_items ?? ''},
      ${JSON.stringify(b.signatories ?? [])}, ${b.follow_up_date ?? null}, ${b.status ?? 'Draft'})`;
  const [row] = await sql`SELECT * FROM coaching_notes WHERE id = ${id}`;
  return NextResponse.json({ row }, { status: 201 });
}

export async function PATCH(req: Request) {
  await ensure();
  const b = await req.json();
  if (!b.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  // "send": build the signatory list (employee always included), resolve each
  // email, lock a timestamp + token, and email ALL signatories to sign.
  if (b.action === 'send') {
    const [cur] = await sql`SELECT * FROM coaching_notes WHERE id = ${b.id}` as any[];
    if (!cur) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const sigs: Signatory[] = parseSignatories(cur.signatories).filter(s => (s.name ?? '').trim());
    // Always ensure both the employee (Reviewee) and the coach (Reviewer) can
    // sign, even if the signatory rows were left blank.
    if (cur.employee && !sigs.some(s => lc(s.name) === lc(cur.employee))) {
      sigs.unshift({ name: cur.employee, position: 'Employee', role: 'Reviewee', email: cur.employee_email || undefined });
    }
    if (cur.coach_name && !sigs.some(s => lc(s.name) === lc(cur.coach_name))) {
      sigs.push({ name: cur.coach_name, position: cur.coach_position || '', role: 'Reviewer', email: cur.coach_email || undefined });
    }
    for (const s of sigs) {
      if (!s.email) {
        if (lc(s.name) === lc(cur.employee) && cur.employee_email) s.email = cur.employee_email;
        else if (lc(s.name) === lc(cur.coach_name) && cur.coach_email) s.email = cur.coach_email;
        else { try { const [st] = await sql`SELECT email FROM staff_directory WHERE lower(name) = ${lc(s.name)} LIMIT 1` as any[]; if (st?.email) s.email = st.email; } catch { /* ignore */ } }
      }
    }
    const token = cur.sign_token || cuid() + cuid();
    await sql`UPDATE coaching_notes SET status = 'Sent', submitted_at = NOW(), sign_token = ${token}, signatories = ${JSON.stringify(sigs)} WHERE id = ${b.id}`;
    const [row] = await sql`SELECT * FROM coaching_notes WHERE id = ${b.id}` as any[];
    const signUrl = `${baseUrl(req)}/coaching/sign/${token}`;

    const emails = Array.from(new Set([...sigs.map(s => s.email), cur.employee_email].filter(Boolean))) as string[];
    let emailed = false, emailError: string | null = null;
    if (emails.length) {
      try {
        const html = coachingEmailHtml(row, signUrl);
        const cc = Array.from(new Set([...emails.slice(1), HR_CC].filter(Boolean))) as string[];
        const res: any = await sendMailAsApp(SENDER, emails[0], `Coaching form to review & sign — ${row.employee}`, html, cc);
        emailed = !res?.error;
        if (res?.error) emailError = String(res.error).slice(0, 140);
      } catch (e) { emailError = String(e).slice(0, 140); }
    } else {
      emailError = 'No signatory emails on file — copy the link and send it manually.';
    }
    return NextResponse.json({ row: { ...row, sign_token: true }, signUrl, emailed, emailError, recipients: emails.length });
  }

  // Regular edit (draft).
  await sql`
    UPDATE coaching_notes SET
      employee = ${b.employee ?? ''}, employee_email = ${b.employee_email ?? null},
      coach_name = ${b.coach_name ?? ''}, coach_position = ${b.coach_position ?? ''}, coach_email = ${b.coach_email ?? null},
      coaching_type = ${b.coaching_type ?? 'Weekly'}, date = ${b.date ?? null}, topic = ${b.topic ?? ''},
      notes = ${b.notes ?? ''}, action_items = ${b.action_items ?? ''}, signatories = ${JSON.stringify(b.signatories ?? [])},
      follow_up_date = ${b.follow_up_date ?? null}, status = ${b.status ?? 'Draft'}
    WHERE id = ${b.id}`;
  const [row] = await sql`SELECT * FROM coaching_notes WHERE id = ${b.id}` as any[];
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ row: { ...row, sign_token: row.sign_token ? true : null } });
}

export async function DELETE(req: Request) {
  await ensure();
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  await sql`DELETE FROM coaching_notes WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}

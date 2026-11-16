export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { sql, cuid } from '@/lib/db';
import { BENEFIT_STATUSES } from '@/lib/benefits';
import { costViewerSession } from '@/lib/costAccess';
import { sendMail, sendMailAsApp } from '@/lib/graph';
import { K401_ELIGIBLE, K401_PLANS, K401_STATUSES, money, fmtDay, type K401Row } from '@/lib/k401';
import { normName } from '@/lib/employeeFiles';

// 401(k) contributions per employee, entered by hand from payroll. Only the cost viewers (Clarizz and
// Catie) can read, change or email these; everyone else gets 403.
async function ensure() {
  await sql`CREATE TABLE IF NOT EXISTS retirement_401k (
    staff_id TEXT PRIMARY KEY,
    eligible TEXT, eligible_date TEXT, plan TEXT,
    emp_pct NUMERIC, emp_check NUMERIC, er_check NUMERIC, as_of TEXT,
    status TEXT, note TEXT, sent_at TIMESTAMPTZ,
    updated_by TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`ALTER TABLE retirement_401k ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ`; // employee confirmed it's all correct
  await sql`ALTER TABLE retirement_401k ADD COLUMN IF NOT EXISTS verified_by TEXT`;
}

// Shared mailbox the 401(k) emails come from (shows as its name, e.g. "Litson HR"). Unset = your own mailbox.
const HR_SENDER = (process.env.HR_SENDER ?? '').trim();

const num = (v: any) => (v === null || v === undefined || String(v).trim() === '' ? null : Number(String(v).replace(/[$,%\s]/g, '')));
const day = (v: any) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? '')) ? String(v) : null);

async function rows(): Promise<K401Row[]> {
  const staff = await sql`SELECT id, name, position, email, worker_type FROM staff_directory
    WHERE NOT COALESCE(offboarded, false) AND COALESCE(worker_type, 'Employee') <> 'Contractor' ORDER BY name ASC` as any[];
  const saved = await sql`SELECT * FROM retirement_401k` as any[];
  const by = new Map(saved.map(r => [r.staff_id, r]));
  // The 401(k) line on the Benefits roster, matched by name, to compare against.
  let roster: any[] = [];
  try { roster = await sql`SELECT person_name, status FROM benefit_enrollments WHERE benefit = '401(k)'` as any[]; } catch { /* no roster yet */ }
  const rosterBy = new Map(roster.map(x => [normName(x.person_name), x.status || null]));
  return staff.map(s => {
    const r = by.get(s.id) ?? {};
    return { staff_id: s.id, name: s.name, position: s.position, email: s.email,
      eligible: r.eligible ?? null, eligible_date: r.eligible_date ?? null, plan: r.plan ?? null,
      emp_pct: num(r.emp_pct), emp_check: num(r.emp_check), er_check: num(r.er_check), as_of: r.as_of ?? null,
      status: r.status ?? null, note: r.note ?? null, sent_at: r.sent_at ? new Date(r.sent_at).toISOString() : null,
      verified_at: r.verified_at ? new Date(r.verified_at).toISOString() : null,
      updated_by: r.updated_by ?? null, updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : null,
      roster: rosterBy.get(normName(s.name)) ?? null };
  });
}

export async function GET() {
  if (!(await costViewerSession())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  return NextResponse.json({ rows: await rows() });
}

// PATCH: save one person's row (whatever fields are sent).
export async function PATCH(req: Request) {
  const who = await costViewerSession();
  if (!who) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const b = await req.json().catch(() => ({}));
  const id = String(b.staff_id ?? '');
  if (!id) return NextResponse.json({ error: 'Missing staff_id' }, { status: 400 });
  const pick = (k: string, list: readonly string[]) => (k in b ? (list.includes(b[k]) ? b[k] : null) : undefined);
  const vals: Record<string, any> = {};
  const e = pick('eligible', K401_ELIGIBLE); if (e !== undefined) vals.eligible = e;
  const p = pick('plan', K401_PLANS); if (p !== undefined) vals.plan = p;
  const st = pick('status', K401_STATUSES); if (st !== undefined) vals.status = st;
  // Verified = the employee confirmed everything is correct. Stamped with the date and who marked it.
  if ('verified' in b) Object.assign(vals, b.verified
    ? { verified_at: new Date(), verified_by: who.email, status: 'Confirmed' }
    : { verified_at: null, verified_by: null, status: null });
  for (const k of ['emp_pct', 'emp_check', 'er_check']) if (k in b) {
    const n = num(b[k]);
    if (n != null && (!Number.isFinite(n) || n < 0)) return NextResponse.json({ error: 'Amounts must be zero or more.' }, { status: 400 });
    vals[k] = n;
  }
  for (const k of ['eligible_date', 'as_of']) if (k in b) vals[k] = day(b[k]);
  if ('note' in b) vals.note = String(b.note ?? '').slice(0, 1000) || null;
  // Eligibility = the 401(k) status on the Benefits roster. Change only the status there (keeps its plan/notes).
  if ('roster' in b) {
    const st = BENEFIT_STATUSES.includes(b.roster) ? String(b.roster) : '';
    const [person] = await sql`SELECT name FROM staff_directory WHERE id = ${id}` as any[];
    if (person?.name) {
      const key = String(person.name).trim().toLowerCase();
      const [ex] = await sql`SELECT id FROM benefit_enrollments WHERE lower(btrim(person_name)) = ${key} AND benefit = '401(k)'` as any[];
      if (ex) await sql`UPDATE benefit_enrollments SET status = ${st} WHERE id = ${ex.id}`;
      else if (st) await sql`INSERT INTO benefit_enrollments (id, person_name, benefit, status, enrolled_date, plan, notes) VALUES (${cuid()}, ${person.name}, '401(k)', ${st}, '', '', '')`;
    }
  }
  await sql`INSERT INTO retirement_401k (staff_id) VALUES (${id}) ON CONFLICT (staff_id) DO NOTHING`;
  if (Object.keys(vals).length) await sql`UPDATE retirement_401k SET ${sql({ ...vals, updated_by: who.email, updated_at: new Date() })} WHERE staff_id = ${id}`;
  const [row] = (await rows()).filter(r => r.staff_id === id);
  return NextResponse.json({ row });
}

// The email each person gets: only their own numbers.
function emailHtml(r: K401Row) {
  const first = (r.name || '').split(' ')[0] || 'there';
  const line = (k: string, v: string) => `<tr><td style="padding:9px 0;color:#6B7280;width:190px;border-top:1px solid #E4E7EC">${k}</td><td style="padding:9px 0;color:#111827;font-weight:600;border-top:1px solid #E4E7EC">${v}</td></tr>`;
  const enrolled = r.plan && r.plan !== 'Not enrolled';
  const lines = [
    line('Eligibility', r.roster === 'Not eligible' ? 'Not eligible yet' : r.roster || '—'),
    line('Plan', r.plan || '—'),
    ...(enrolled ? [
      line('Your contribution', [r.emp_pct != null ? `${r.emp_pct}% of pay` : '', r.emp_check != null ? `${money(r.emp_check)} per paycheck` : ''].filter(Boolean).join(' · ') || '—'),
      line('Litson’s contribution', r.er_check != null ? `${money(r.er_check)} per paycheck` : '—'),
    ] : []),
    ...(r.as_of ? [line('As of paycheck', fmtDay(r.as_of))] : []),
  ].join('');
  return `<div style="font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.55;color:#111827;max-width:560px">
<p>Hi ${first},</p>
<p>We’re double-checking everyone’s 401(k) details. Please look over yours below and let me know if anything isn’t right.</p>
<table cellpadding="0" cellspacing="0" style="width:100%;border-bottom:1px solid #E4E7EC;margin:14px 0">${lines}</table>
<p style="color:#4B5563">These amounts come from your payroll deductions, which take priority over the election in Guideline. If something doesn’t match what you expect, just reply to this email.</p>
<div style="margin:16px 0;padding:12px 14px;border-left:4px solid #C2410C;background:#FFF4E8;border-radius:6px;color:#111827">
<b>Changing your 401(k)?</b> Admins can’t see the deductions/contributions you elect in Guideline, so if you make any changes, please email HR immediately.</div>
<p>Thank you!</p></div>`;
}

// POST { action: 'preview' | 'send', staff_ids }
export async function POST(req: Request) {
  const who = await costViewerSession();
  if (!who) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const b = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(b.staff_ids) ? b.staff_ids.map(String) : [];
  const list = (await rows()).filter(r => ids.includes(r.staff_id));
  const subject = 'Please confirm your 401(k) details';
  if (b.action === 'preview') return NextResponse.json({ subject, previews: list.map(r => ({ staff_id: r.staff_id, name: r.name, email: r.email, html: emailHtml(r) })) });
  if (b.action !== 'send') return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  const token = (who.session as any)?.accessToken as string | undefined;
  const results: { staff_id: string; name: string; ok: boolean; error?: string }[] = [];
  for (const r of list) {
    if (!r.email) { results.push({ staff_id: r.staff_id, name: r.name, ok: false, error: 'No email on file in Staffing' }); continue; }
    // From the "Litson HR" shared mailbox when HR_SENDER is set (replies still go to whoever sent);
    // otherwise from the signed-in person's own mailbox.
    let res: any = HR_SENDER ? await sendMailAsApp(HR_SENDER, r.email, subject, emailHtml(r), undefined, undefined, who.email) : { ok: false };
    if (!res.ok && token) res = await sendMail(token, r.email, subject, emailHtml(r));
    if (!res.ok) res = await sendMailAsApp(who.email, r.email, subject, emailHtml(r));
    if (res.ok) await sql`INSERT INTO retirement_401k (staff_id, status, sent_at, updated_by) VALUES (${r.staff_id}, 'Emailed', NOW(), ${who.email})
      ON CONFLICT (staff_id) DO UPDATE SET status = 'Emailed', sent_at = NOW(), updated_by = EXCLUDED.updated_by, updated_at = NOW()`;
    results.push({ staff_id: r.staff_id, name: r.name, ok: !!res.ok, error: res.ok ? undefined : String(res.error ?? 'Send failed').slice(0, 200) });
  }
  return NextResponse.json({ results, rows: await rows() });
}

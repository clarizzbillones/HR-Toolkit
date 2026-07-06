export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { sendMail, sendMailAsApp } from '@/lib/graph';

const RECIPIENT = process.env.REVIEW_REMINDER_EMAIL ?? 'clarizz@litson.co';
// Mailbox the app-only cron sends *from* (defaults to the recipient's own mailbox)
const SENDER = process.env.REVIEW_REMINDER_SENDER ?? RECIPIENT;
const TARGET_DAYS = [30, 15, 10];

function daysUntil(dateStr: string): number {
  const t = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  t.setHours(0, 0, 0, 0);
  const d = new Date(dateStr.slice(0, 10) + 'T00:00:00');
  return Math.round((d.getTime() - t.getTime()) / 86400000);
}

async function handle(req: Request) {
  const test = new URL(req.url).searchParams.get('test');

  let subject: string, body: string, count = 0;
  if (test) {
    subject = 'Test — LITSON performance review reminder';
    body = `<p>✅ This is a test.</p><p>Automated performance-review reminders are set to email <b>${RECIPIENT}</b> at <b>30, 15, and 10 days</b> before each employee's 6-month or 1-year review.</p><p>— LITSON HR Toolkit</p>`;
  } else {
    const emps = await sql`SELECT name, role, review_6mo_date, review_6mo_status, review_1yr_date, review_1yr_status FROM employees` as any[];
    const due: { name: string; role: string; type: string; date: string; days: number }[] = [];
    for (const e of emps) {
      const checks: [string | null, string | null, string][] = [
        [e.review_6mo_date, e.review_6mo_status, '6-month review'],
        [e.review_1yr_date, e.review_1yr_status, '1-year review'],
      ];
      for (const [date, status, type] of checks) {
        if (!date || status === 'Complete') continue;
        const days = daysUntil(date);
        if (TARGET_DAYS.includes(days)) due.push({ name: e.name, role: e.role, type, date: date.slice(0, 10), days });
      }
    }
    if (!due.length) return NextResponse.json({ ok: true, sent: 0, message: 'No reviews at 30/15/10 days out' });
    count = due.length;
    due.sort((a, b) => a.days - b.days);
    subject = `Performance reviews coming up — ${due.length} at 30/15/10 days`;
    body = `<p>Hi,</p><p>These performance reviews are approaching:</p><ul>${due.map(d => `<li><b>${d.name}</b> (${d.role}) — ${d.type} in <b>${d.days} days</b> · due ${d.date}</li>`).join('')}</ul><p>— LITSON HR Toolkit</p>`;
  }

  // Prefer the signed-in user's token (manual test); fall back to app-only (cron)
  const session = await getServerSession(authOptions);
  const userToken = (session as any)?.accessToken as string | undefined;
  if (userToken) {
    const r = await sendMail(userToken, RECIPIENT, subject, body);
    if (r.ok) return NextResponse.json({ ok: true, sent: count || 1, via: 'session', to: RECIPIENT });
  }
  const r2 = await sendMailAsApp(SENDER, RECIPIENT, subject, body);
  if (r2.ok) return NextResponse.json({ ok: true, sent: count || 1, via: 'app', to: RECIPIENT });

  return NextResponse.json({ error: `Couldn't send email. ${r2.error ?? ''} Sign in with Microsoft 365, or configure app-only Mail.Send.` }, { status: 502 });
}

export async function GET(req: Request) { return handle(req); }  // Vercel cron uses GET
export async function POST(req: Request) { return handle(req); } // manual test button

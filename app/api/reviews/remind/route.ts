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

const SANS = "'Helvetica Neue',Helvetica,Arial,sans-serif";
function fmtDate(iso: string) {
  const d = new Date(iso.slice(0, 10) + 'T12:00:00');
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
function emailBody(rows: { name: string; role: string; type: string; date: string; days: number }[]) {
  return `<div style="font-family:${SANS};font-size:14px;line-height:1.65;color:#2a2a2a">
    <p>Hi Clarizz,</p>
    <p>Here's a friendly heads-up on the performance reviews coming due. Please set aside time to prepare and complete each one before its due date.</p>
    <table style="border-collapse:collapse;margin:14px 0">
      ${rows.map(d => `<tr>
        <td style="padding:7px 16px 7px 0;font-weight:600;color:#1b2a3d;font-family:${SANS};font-size:14px">${d.name}</td>
        <td style="padding:7px 16px 7px 0;color:#555;font-family:${SANS};font-size:14px">${d.type}</td>
        <td style="padding:7px 0;color:#555;font-family:${SANS};font-size:14px">due ${fmtDate(d.date)} &middot; in ${d.days} days</td>
      </tr>`).join('')}
    </table>
    <p>You can review and update any of these anytime in the LITSON HR Toolkit.</p>
    <p style="margin-top:20px">Warm regards,<br>LITSON HR</p>
  </div>`;
}

async function handle(req: Request) {
  const params = new URL(req.url).searchParams;
  const test = params.get('test');
  const preview = params.get('preview');

  let subject: string, body: string, count = 0;
  if (test) {
    subject = 'Performance review reminders — test message';
    body = `<div style="font-family:${SANS};font-size:14px;line-height:1.65;color:#2a2a2a">
      <p>Hi Clarizz,</p>
      <p>This is a quick test of the automated performance-review reminders. Going forward, you'll receive a note like this at <b>30, 15, and 10 days</b> before each employee's 6-month or 1-year review.</p>
      <p>No action is needed for this test message.</p>
      <p style="margin-top:20px">Warm regards,<br>LITSON HR</p>
    </div>`;
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
    if (!due.length && !preview) return NextResponse.json({ ok: true, sent: 0, message: 'No reviews at 30/15/10 days out' });
    // Preview with nothing due → show a sample so you can see the layout
    const rows = due.length ? due : [
      { name: 'Caitlin Giuliano', role: 'Attorney', type: '1-year review', date: '2026-12-15', days: 30 },
      { name: 'Sample Employee', role: 'Paralegal', type: '6-month review', date: '2026-12-30', days: 15 },
    ];
    count = due.length;
    rows.sort((a, b) => a.days - b.days);
    subject = `Performance review reminder — ${rows.length} coming up`;
    body = emailBody(rows);
  }

  // Preview mode — render the email in the browser instead of sending
  if (preview) {
    const page = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${subject}</title></head>
      <body style="margin:0;background:#f1ece3;font-family:${SANS}">
        <div style="max-width:620px;margin:30px auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e6ddcd">
          <div style="background:linear-gradient(120deg,#1b2a3d,#26405c);padding:18px 24px;border-bottom:4px solid #c9a24a;color:#fff;font-family:${SANS}">
            <div style="font-size:18px;font-weight:800;letter-spacing:.15em">LITSON</div>
            <div style="font-size:10px;color:#c9a24a;letter-spacing:.1em;font-weight:600">HR TOOLKIT · REVIEW REMINDER</div>
          </div>
          <div style="padding:10px 24px 4px;color:#8a7f6d;font-size:12px;font-family:${SANS}">To: ${RECIPIENT}</div>
          <div style="padding:0 24px 8px;font-size:15px;font-weight:700;color:#1b2a3d;font-family:${SANS}">${subject}</div>
          <div style="padding:4px 24px 22px">${body}</div>
        </div>
        <div style="text-align:center;color:#8a7f6d;font-size:11px;font-family:${SANS}">Preview only — this is what the reminder email will look like.</div>
      </body></html>`;
    return new NextResponse(page, { headers: { 'Content-Type': 'text/html' } });
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

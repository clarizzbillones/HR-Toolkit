export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { SANS } from '@/lib/reviewEmail';
import { previewInviteReminders, sendDueInviteReminders, sendRemindersForEmployee } from '@/lib/inviteReminders';

const SENDER = process.env.REVIEW_REMINDER_SENDER ?? 'clarizz@litson.co';
const CC = process.env.REVIEW_REMINDER_EMAIL ?? 'clarizz@litson.co';

async function handle(req: Request) {
  const preview = new URL(req.url).searchParams.get('preview');

  // Preview — render the reminder emails that would go out (or a sample) as a page.
  if (preview) {
    const msgs = await previewInviteReminders();
    const note = (msgs as any[]).some(m => m.sample)
      ? '<p style="text-align:center;color:#8a7f6d;font-size:12px;font-family:sans-serif">No reminders are due right now — showing a sample so you can see the layout &amp; countdown.</p>'
      : '';
    const blocks = msgs.map(m =>
      `<div style="max-width:640px;margin:0 auto 24px"><div style="font-size:12px;color:#8a7f6d;font-family:sans-serif;padding:8px 4px">To: ${m.to || '(participant)'} · CC: ${CC} · <b>${m.subject}</b></div>${m.html}</div>`).join('');
    const page = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reminder preview</title></head>
      <body style="margin:0;background:#f1ece3;padding:20px 0;font-family:${SANS}">${note}${blocks}</body></html>`;
    return new NextResponse(page, { headers: { 'Content-Type': 'text/html' } });
  }

  // Send — prefer the signed-in user's token (manual button), else app-only (cron).
  const session = await getServerSession(authOptions);
  const userToken = (session as any)?.accessToken as string | undefined;
  const res = await sendDueInviteReminders({ userToken, sender: SENDER, cc: CC });
  return NextResponse.json({ ok: true, ...res });
}

export async function GET(req: Request) { return handle(req); }  // cron + preview

// POST { employee } sends an on-demand reminder to that reviewee's pending
// participants now. Without a body it behaves like GET (send all due today).
export async function POST(req: Request) {
  let body: any = {};
  try { body = await req.json(); } catch { /* no body */ }
  if (body?.employee) {
    const session = await getServerSession(authOptions);
    const userToken = (session as any)?.accessToken as string | undefined;
    const res = await sendRemindersForEmployee(body.employee, { userToken, sender: SENDER, cc: CC });
    return NextResponse.json({ ok: true, ...res });
  }
  return handle(req);
}

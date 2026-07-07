export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendMail, sendMailAsApp } from '@/lib/graph';
import { buildMessage } from '@/lib/reviewEmail';
import { recordInvites } from '@/lib/inviteReminders';

const SENDER = process.env.REVIEW_REMINDER_SENDER ?? 'clarizz@litson.co';
const CC = process.env.REVIEW_REMINDER_EMAIL ?? 'clarizz@litson.co';

export async function POST(req: Request) {
  const { employee, link, deadline, reviewType, participants, preview, scheduleOnly } = await req.json();
  if (!employee?.trim()) return NextResponse.json({ error: 'Employee name required' }, { status: 400 });
  if (!Array.isArray(participants) || !participants.length) return NextResponse.json({ error: 'Add at least one participant' }, { status: 400 });

  // Schedule-only: record participants for reminders WITHOUT sending any email.
  // Use this when the initial invite was already sent manually.
  if (scheduleOnly) {
    if (!deadline?.trim()) return NextResponse.json({ error: 'Set a deadline so reminders can be scheduled' }, { status: 400 });
    const withEmail = participants.filter((p: any) => (p.email ?? '').trim());
    if (!withEmail.length) return NextResponse.json({ error: 'Add at least one participant email' }, { status: 400 });
    try {
      await recordInvites({ employee, link, deadline, reviewType, participants: withEmail });
    } catch {
      return NextResponse.json({ error: 'Could not save participants for reminders' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, scheduled: withEmail.length, sent: 0 });
  }

  // Preview mode — render every participant with an email (regardless of status)
  if (preview) {
    const messages = participants.filter((p: any) => (p.email ?? '').trim())
      .map((p: any) => buildMessage(employee, link, deadline, reviewType, p));
    return NextResponse.json({ preview: true, cc: CC, messages: messages.map(m => ({ to: m.to || '(participant)', type: m.type, subject: m.subject, html: m.html })) });
  }

  // Only email participants who aren't already marked complete.
  const emailable = participants.filter((p: any) => (p.email ?? '').trim() && !p.completed);

  const session = await getServerSession(authOptions);
  const userToken = (session as any)?.accessToken as string | undefined;
  const send = async (to: string, subject: string, html: string) => {
    if (userToken) { const r = await sendMail(userToken, to, subject, html, CC); if (r.ok) return { ok: true }; }
    return await sendMailAsApp(SENDER, to, subject, html, CC);
  };

  const results: { email: string; ok: boolean; error?: string }[] = [];
  for (const p of emailable) {
    const m = buildMessage(employee, link, deadline, reviewType, p);
    if (!m.to) continue;
    const r = await send(m.to, m.subject, m.html);
    results.push({ email: m.to, ok: r.ok, error: (r as any).error });
  }

  const sent = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  if (emailable.length && sent === 0) return NextResponse.json({ error: `Could not send. ${failed[0]?.error ?? ''}`, results }, { status: 502 });

  // Remember everyone with an email (including those marked complete) so
  // reminders fire for the pending ones and skip the completed ones.
  try {
    await recordInvites({
      employee, link, deadline, reviewType,
      participants: participants.filter((p: any) => (p.email ?? '').trim()),
    });
  } catch { /* reminders are best-effort; don't fail the send */ }

  return NextResponse.json({ ok: true, sent, failed: failed.length, cc: CC, results });
}

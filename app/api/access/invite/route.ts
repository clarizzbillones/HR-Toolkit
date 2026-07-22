export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendMail, sendMailAsApp } from '@/lib/graph';
import { isAccessAdmin } from '@/lib/access';
import { buildAccessInvite } from '@/lib/accessEmail';

const SENDER = process.env.REVIEW_REMINDER_SENDER ?? 'clarizz@litson.co';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email ?? '';
  const role = (session?.user as any)?.role ?? '';
  if (!isAccessAdmin(email, role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const to = String(body.email ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return NextResponse.json({ error: 'Valid email required' }, { status: 400 });

  const msg = buildAccessInvite({
    name: String(body.name ?? ''),
    email: to,
    sections: Array.isArray(body.sections) ? body.sections.map(String) : [],
    reportTabs: Array.isArray(body.reportTabs) ? body.reportTabs.map(String) : [],
    appUrl: String(body.appUrl ?? ''),
    password: process.env.APP_PASSWORD ?? 'litson2026',
  });

  // Preview mode: render the email without sending.
  if (body.preview) return NextResponse.json({ preview: true, to, subject: msg.subject, html: msg.html });

  // Send via the signed-in admin's mailbox, falling back to app credentials.
  const userToken = (session as any)?.accessToken as string | undefined;
  let result: { ok: boolean; error?: string } = { ok: false, error: 'Email is not configured' };
  if (userToken) { const r = await sendMail(userToken, to, msg.subject, msg.html); if (r.ok) result = { ok: true }; }
  if (!result.ok) result = await sendMailAsApp(SENDER, to, msg.subject, msg.html);
  if (!result.ok) return NextResponse.json({ error: result.error ?? 'Could not send email' }, { status: 502 });
  return NextResponse.json({ ok: true, to });
}

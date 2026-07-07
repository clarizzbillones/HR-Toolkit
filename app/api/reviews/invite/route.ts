export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendMail, sendMailAsApp } from '@/lib/graph';

const SANS = "'Helvetica Neue',Helvetica,Arial,sans-serif";
const SENDER = process.env.REVIEW_REMINDER_SENDER ?? 'clarizz@litson.co';

function fmtDate(iso: string) {
  if (!iso) return '';
  const d = new Date(iso.slice(0, 10) + 'T12:00:00');
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function wrap(subject: string, inner: string) {
  return `<body style="margin:0;background:#f1ece3;font-family:${SANS}">
    <div style="max-width:600px;margin:24px auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e6ddcd">
      <div style="background:linear-gradient(120deg,#1b2a3d,#26405c);padding:16px 24px;border-bottom:4px solid #c9a24a;color:#fff">
        <div style="font-size:17px;font-weight:800;letter-spacing:.15em">LITSON</div>
        <div style="font-size:10px;color:#c9a24a;letter-spacing:.1em;font-weight:600">HR TOOLKIT · PERFORMANCE REVIEW</div>
      </div>
      <div style="padding:18px 24px;font-size:14px;line-height:1.65;color:#2a2a2a;font-family:${SANS}">${inner}</div>
    </div>
  </body>`;
}

function button(link: string, label: string) {
  if (!link) return '';
  return `<p style="margin:18px 0"><a href="${link}" style="background:#1b2a3d;color:#fff;text-decoration:none;font-weight:600;padding:10px 18px;border-radius:8px;font-family:${SANS};font-size:14px">${label}</a></p>
    <p style="font-size:12px;color:#888">Or paste this link: <a href="${link}" style="color:#3f6b8a">${link}</a></p>`;
}

export async function POST(req: Request) {
  const { employee, link, deadline, reviewType, participants } = await req.json();
  if (!employee?.trim()) return NextResponse.json({ error: 'Employee name required' }, { status: 400 });
  if (!Array.isArray(participants) || !participants.length) return NextResponse.json({ error: 'Add at least one participant' }, { status: 400 });

  const session = await getServerSession(authOptions);
  const userToken = (session as any)?.accessToken as string | undefined;
  const send = async (to: string, subject: string, html: string) => {
    if (userToken) { const r = await sendMail(userToken, to, subject, html); if (r.ok) return { ok: true }; }
    return await sendMailAsApp(SENDER, to, subject, html);
  };

  const due = deadline ? ` by <b>${fmtDate(deadline)}</b>` : '';
  const label = reviewType ? `${reviewType} ` : '';
  const results: { email: string; ok: boolean; error?: string }[] = [];

  for (const p of participants) {
    const to = (p.email ?? '').trim();
    if (!to) continue;
    const name = (p.name ?? '').trim() || 'there';
    let subject: string, inner: string;
    if (p.type === 'Self-assessment') {
      subject = `Your self-assessment${deadline ? ` — due ${fmtDate(deadline)}` : ''}`;
      inner = `<p>Hi ${name},</p><p>As part of your ${label}performance review, please complete your <b>self-assessment</b>${due}.</p>${button(link, 'Open the self-assessment form')}<p>Thank you!</p><p style="margin-top:18px">Warm regards,<br>LITSON HR</p>`;
    } else {
      const roleWord = p.type === 'Manager' ? 'manager review' : 'peer review';
      subject = `${p.type === 'Manager' ? 'Manager' : 'Peer'} review request: ${employee}${deadline ? ` — due ${fmtDate(deadline)}` : ''}`;
      inner = `<p>Hi ${name},</p><p>You've been asked to complete a <b>${roleWord}</b> for <b>${employee}</b> as part of their ${label}performance review. Please complete it${due}.</p>${button(link, `Open the review form`)}<p>Thank you for taking the time.</p><p style="margin-top:18px">Warm regards,<br>LITSON HR</p>`;
    }
    const r = await send(to, subject, wrap(subject, inner));
    results.push({ email: to, ok: r.ok, error: (r as any).error });
  }

  const sent = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  if (sent === 0) return NextResponse.json({ error: `Could not send. ${failed[0]?.error ?? ''}`, results }, { status: 502 });
  return NextResponse.json({ ok: true, sent, failed: failed.length, results });
}

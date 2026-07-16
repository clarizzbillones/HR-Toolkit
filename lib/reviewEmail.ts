// Shared email building for review invitations and their reminders.

export const SANS = "'Helvetica Neue',Helvetica,Arial,sans-serif";

// Ask participants to finish this many days before the actual review date,
// so there is prep time before the review itself.
export const PREP_BUFFER_DAYS = 2;

export function fmtDate(iso: string) {
  if (!iso) return '';
  const d = new Date(iso.slice(0, 10) + 'T12:00:00');
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

// Shift a YYYY-MM-DD date by n days, returning a YYYY-MM-DD string.
export function shiftDays(iso: string, n: number): string {
  if (!iso) return iso;
  const d = new Date(iso.slice(0, 10) + 'T12:00:00');
  if (isNaN(d.getTime())) return iso;
  d.setDate(d.getDate() + n);
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function wrap(subject: string, inner: string) {
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

export function button(link: string, label: string) {
  if (!link) return '';
  return `<p style="margin:18px 0"><a href="${link}" style="background:#1b2a3d;color:#fff;text-decoration:none;font-weight:600;padding:10px 18px;border-radius:8px;font-family:${SANS};font-size:14px">${label}</a></p>
    <p style="font-size:12px;color:#888">Or paste this link: <a href="${link}" style="color:#3f6b8a">${link}</a></p>`;
}

// A pill showing how many days remain until the "complete by" date.
export function countdownBadge(days: number) {
  const txt = days <= 0 ? 'Due today' : days === 1 ? '1 day left' : `${days} days left`;
  const bg = days <= 1 ? '#b23b3b' : days <= 3 ? '#b07d2a' : '#2f7d5b';
  return `<div style="display:inline-block;background:${bg};color:#fff;font-weight:700;font-size:13px;padding:6px 14px;border-radius:999px;font-family:${SANS};margin:2px 0 12px">⏳ ${txt} to complete</div>`;
}

export interface Participant { name?: string; email?: string; type?: string }

// Build the { to, type, subject, html } message for one participant.
// When isReminder is true, the copy is phrased as a reminder and a countdown
// pill (days left until the "complete by" date) is shown.
export function buildMessage(
  employee: string,
  link: string,
  deadline: string,
  reviewType: string,
  p: Participant,
  opts?: { isReminder?: boolean; countdownDays?: number },
) {
  const isReminder = opts?.isReminder ?? false;
  // Participants are asked to complete a couple of days before the review date.
  const completeBy = deadline ? shiftDays(deadline, -PREP_BUFFER_DAYS) : '';
  const due = completeBy ? ` by <b>${fmtDate(completeBy)}</b>` : '';
  // Staff-facing copy never names the milestone (6-month / 1-year / 1.5-year).
  // Reviews are one repeating cycle; everyone is only ever told "Performance
  // Review". reviewType is accepted for back-compat but not shown to staff.
  void reviewType;
  const name = (p.name ?? '').trim() || 'there';
  const countdown = isReminder && opts?.countdownDays != null ? countdownBadge(opts.countdownDays) : '';
  let subject: string, inner: string;
  if (p.type === 'Self-assessment') {
    subject = `${isReminder ? 'Reminder: ' : ''}Your self-assessment${completeBy ? ` — due ${fmtDate(completeBy)}` : ''}`;
    const lead = isReminder
      ? `<p>Hi ${name},</p>${countdown}<p>Just a friendly reminder to complete your <b>self-assessment</b>${due} as part of your Performance Review.</p>`
      : `<p>Hi ${name},</p><p>As part of your Performance Review, please complete your <b>self-assessment</b>${due}.</p>`;
    inner = `${lead}${button(link, 'Open the self-assessment form')}<p>Thank you!</p><p style="margin-top:18px">Warm regards,<br>LITSON HR</p>`;
  } else {
    const roleWord = p.type === 'Manager' ? 'manager review' : 'peer review';
    subject = `${isReminder ? 'Reminder: ' : ''}${p.type === 'Manager' ? 'Manager' : 'Peer'} review request: ${employee}${completeBy ? ` — due ${fmtDate(completeBy)}` : ''}`;
    const lead = isReminder
      ? `<p>Hi ${name},</p>${countdown}<p>A friendly reminder to complete your <b>${roleWord}</b> for <b>${employee}</b>${due}, as part of their Performance Review.</p>`
      : `<p>Hi ${name},</p><p>You've been asked to complete a <b>${roleWord}</b> for <b>${employee}</b> as part of their Performance Review. Please complete it${due}.</p>`;
    inner = `${lead}${button(link, 'Open the review form')}<p>Thank you for taking the time.</p><p style="margin-top:18px">Warm regards,<br>LITSON HR</p>`;
  }
  return { to: (p.email ?? '').trim(), type: p.type, subject, html: wrap(subject, inner) };
}

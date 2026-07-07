// Persist sent review invites and send reminders as their "complete by"
// date approaches. Reminders go out at REMINDER_MARKS days before the
// complete-by date (which is itself PREP_BUFFER_DAYS before the review date).

import { sql, cuid } from '@/lib/db';
import { sendMail, sendMailAsApp } from '@/lib/graph';
import { buildMessage, shiftDays, PREP_BUFFER_DAYS } from '@/lib/reviewEmail';

// Days before the "complete by" date to send a reminder.
export const REMINDER_MARKS = [3, 1];

export async function ensureInviteTable() {
  await sql`CREATE TABLE IF NOT EXISTS review_invites (
    id TEXT PRIMARY KEY,
    employee TEXT NOT NULL,
    participant_name TEXT,
    participant_email TEXT NOT NULL,
    participant_type TEXT,
    review_type TEXT,
    link TEXT,
    deadline TEXT,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    last_reminded_on TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
}

function todayCst(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
}

function daysUntil(dateStr: string): number {
  const a = Date.parse(todayCst() + 'T00:00:00Z');
  const b = Date.parse(dateStr.slice(0, 10) + 'T00:00:00Z');
  return Math.round((b - a) / 86400000);
}

interface InviteInput {
  employee: string;
  link?: string;
  deadline?: string;
  reviewType?: string;
  participants: { name?: string; email?: string; type?: string }[];
}

// Save the invites just sent so they can be reminded later. Re-sending the
// same person for the same review replaces the earlier (uncompleted) row so
// reminders aren't duplicated.
export async function recordInvites(invite: InviteInput) {
  await ensureInviteTable();
  const parts = (invite.participants ?? []).filter(p => (p.email ?? '').trim() && (invite.deadline ?? '').trim());
  for (const p of parts) {
    const email = (p.email ?? '').trim();
    await sql`DELETE FROM review_invites
      WHERE completed = FALSE
        AND lower(participant_email) = ${email.toLowerCase()}
        AND employee = ${invite.employee}
        AND coalesce(review_type,'') = ${invite.reviewType ?? ''}`;
    await sql`INSERT INTO review_invites
      (id, employee, participant_name, participant_email, participant_type, review_type, link, deadline)
      VALUES (${cuid()}, ${invite.employee}, ${(p.name ?? '').trim() || null}, ${email},
              ${p.type ?? null}, ${invite.reviewType ?? null}, ${invite.link ?? null}, ${invite.deadline ?? null})`;
  }
}

// Reminders that are due to go out today (at a REMINDER_MARKS boundary and not
// already reminded today).
async function dueReminders() {
  await ensureInviteTable();
  const today = todayCst();
  const rows = await sql`SELECT * FROM review_invites
    WHERE completed = FALSE AND participant_email IS NOT NULL AND deadline IS NOT NULL` as any[];
  return rows
    .map(r => {
      const completeBy = shiftDays(r.deadline, -PREP_BUFFER_DAYS);
      return { r, completeBy, countdownDays: daysUntil(completeBy), today };
    })
    .filter(x => x.r.last_reminded_on !== x.today && REMINDER_MARKS.includes(x.countdownDays));
}

// Render the reminder emails that would go out right now (for the preview page).
// If nothing is due, returns a single sample so the layout is visible.
export async function previewInviteReminders() {
  const due = await dueReminders();
  if (due.length) {
    return due.map(({ r, countdownDays }) => {
      const m = buildMessage(r.employee, r.link ?? '', r.deadline, r.review_type ?? '',
        { name: r.participant_name, email: r.participant_email, type: r.participant_type },
        { isReminder: true, countdownDays });
      return { to: m.to, subject: m.subject, html: m.html };
    });
  }
  // Sample: a review 5 days out (so complete-by is 3 days out → a live reminder mark)
  const sampleDeadline = shiftDays(todayCst(), 5);
  const sample = buildMessage('Isabella Ardila', 'https://firm-evaluator.lovable.app/', sampleDeadline, '6-month',
    { name: 'Jordan Lee', email: 'jordan@litson.co', type: 'Peer reviewer' },
    { isReminder: true, countdownDays: 3 });
  return [{ to: sample.to, subject: sample.subject, html: sample.html, sample: true }];
}

// Send any reminders due today. Prefers the signed-in user's token, falling
// back to app-only sending (used by the daily cron).
export async function sendDueInviteReminders(opts: { userToken?: string; sender: string; cc?: string }) {
  const due = await dueReminders();
  const send = async (to: string, subject: string, html: string) => {
    if (opts.userToken) { const r = await sendMail(opts.userToken, to, subject, html, opts.cc); if (r.ok) return { ok: true }; }
    return await sendMailAsApp(opts.sender, to, subject, html, opts.cc);
  };
  let sent = 0, failed = 0;
  for (const { r, countdownDays, today } of due) {
    const m = buildMessage(r.employee, r.link ?? '', r.deadline, r.review_type ?? '',
      { name: r.participant_name, email: r.participant_email, type: r.participant_type },
      { isReminder: true, countdownDays });
    if (!m.to) continue;
    const res = await send(m.to, m.subject, m.html);
    if (res.ok) { sent++; await sql`UPDATE review_invites SET last_reminded_on = ${today} WHERE id = ${r.id}`; }
    else failed++;
  }
  return { due: due.length, sent, failed };
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql, cuid } from '@/lib/db';
import { sendMailAsApp } from '@/lib/graph';
import { EVENTS, eventById, rsvpEmail } from '@/lib/rsvp';

const SENDER = process.env.REVIEW_REMINDER_SENDER ?? 'clarizz@litson.co';
const DEFAULT_EVENT = EVENTS[0]?.id ?? '';
const parse = (v: any) => { try { const a = typeof v === 'string' ? JSON.parse(v) : v; return a && typeof a === 'object' ? a : {}; } catch { return {}; } };
const origin = (req: Request) => process.env.NEXTAUTH_URL || `${req.headers.get('x-forwarded-proto') ?? 'https'}://${req.headers.get('host')}`;

async function ensure() {
  await sql`CREATE TABLE IF NOT EXISTS event_rsvps (
    id TEXT PRIMARY KEY, event_id TEXT, token TEXT UNIQUE, name TEXT, email TEXT, profile_id TEXT,
    status TEXT DEFAULT 'Sent', answers TEXT, created_by TEXT,
    submitted_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
}

export async function GET(req: Request) {
  await ensure();
  const u = new URL(req.url);
  const token = u.searchParams.get('token');
  // Public: load the form for an employee to fill in.
  if (token) {
    const [row] = await sql`SELECT event_id, name, status, answers FROM event_rsvps WHERE token = ${token}` as any[];
    if (!row) return NextResponse.json({ error: 'This link is invalid or has expired.' }, { status: 404 });
    const ev = eventById(row.event_id);
    if (!ev) return NextResponse.json({ error: 'This event is no longer available.' }, { status: 404 });
    return NextResponse.json({ row: { name: row.name ?? '', status: row.status, event: ev, answers: row.status === 'Completed' ? parse(row.answers) : {} } });
  }
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const eventId = u.searchParams.get('eventId') ?? DEFAULT_EVENT;
  const rows = await sql`SELECT id, token, name, email, profile_id, status, answers, submitted_at, created_at
    FROM event_rsvps WHERE event_id = ${eventId} ORDER BY created_at DESC` as any[];
  return NextResponse.json({ events: EVENTS, rows: rows.map(r => ({ ...r, answers: parse(r.answers) })) });
}

export async function POST(req: Request) {
  await ensure();
  const b = await req.json();

  // Public submit — guarded by the token.
  if (b.action === 'submit') {
    const [row] = await sql`SELECT * FROM event_rsvps WHERE token = ${b.token}` as any[];
    if (!row) return NextResponse.json({ error: 'This link is invalid or has expired.' }, { status: 404 });
    if (row.status === 'Completed') return NextResponse.json({ error: 'You already responded — thank you!', done: true }, { status: 409 });
    const answers = (b.answers && typeof b.answers === 'object') ? b.answers : {};
    await sql`UPDATE event_rsvps SET answers = ${JSON.stringify(answers)}, status = 'Completed', submitted_at = NOW() WHERE id = ${row.id}`;
    return NextResponse.json({ ok: true });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const by = (session.user as any).email ?? null;
  const eventId = String(b.eventId ?? DEFAULT_EVENT);
  const ev = eventById(eventId);
  if (!ev) return NextResponse.json({ error: 'Unknown event' }, { status: 400 });

  // Send a test to a chosen address.
  if (b.action === 'send-test') {
    const email = String(b.email ?? '').trim();
    if (!email) return NextResponse.json({ error: 'Enter an email to send the test to' }, { status: 400 });
    const id = cuid(); const token = cuid() + cuid();
    await sql`INSERT INTO event_rsvps (id, event_id, token, name, email, status, created_by) VALUES (${id}, ${eventId}, ${token}, ${'RSVP (test)'}, ${email}, 'Sent', ${by})`;
    const url = `${origin(req)}/rsvp/${token}`;
    const r = await sendMailAsApp(SENDER, email, `Litson PLLC — ${ev.title}`, rsvpEmail('there', url, ev));
    if (!r.ok) return NextResponse.json({ error: r.error || 'Could not send the test email', url }, { status: 502 });
    return NextResponse.json({ ok: true, emailed: true, url });
  }

  // Email the RSVP to a chosen set of people (by profile).
  if (b.action === 'send-bulk') {
    const pick = Array.isArray(b.profileIds) ? new Set(b.profileIds.map(String)) : null;
    let profiles: any[] = [];
    try { profiles = await sql`SELECT id, name, email FROM employee_profiles WHERE coalesce(email, '') <> '' AND coalesce(offboarded, false) = false ORDER BY name ASC` as any[]; } catch { /* no table */ }
    if (pick) profiles = profiles.filter(p => pick.has(String(p.id)));
    let sent = 0; const failed: string[] = [];
    for (const p of profiles) {
      let [s] = await sql`SELECT id, token FROM event_rsvps WHERE event_id = ${eventId} AND profile_id = ${p.id} AND status <> 'Completed' ORDER BY created_at DESC LIMIT 1` as any[];
      if (!s) { const id = cuid(); const token = cuid() + cuid(); await sql`INSERT INTO event_rsvps (id, event_id, token, name, email, profile_id, status, created_by) VALUES (${id}, ${eventId}, ${token}, ${p.name}, ${p.email}, ${p.id}, 'Sent', ${by})`; s = { id, token }; }
      const url = `${origin(req)}/rsvp/${s.token}`;
      const r = await sendMailAsApp(SENDER, p.email, `Litson PLLC — ${ev.title}`, rsvpEmail(p.name, url, ev, true));
      if (r.ok) sent++; else failed.push(p.name);
    }
    return NextResponse.json({ sent, total: profiles.length, failed });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  await sql`DELETE FROM event_rsvps WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}

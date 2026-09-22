export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql, cuid } from '@/lib/db';
import { sendMailAsApp } from '@/lib/graph';
import { EVENTS, eventById as builtinEvent, rsvpEmail, type EventDef, type RsvpQuestion } from '@/lib/rsvp';

const SENDER = process.env.REVIEW_REMINDER_SENDER ?? 'clarizz@litson.co';
const parse = (v: any) => { try { const a = typeof v === 'string' ? JSON.parse(v) : v; return a && typeof a === 'object' ? a : {}; } catch { return {}; } };
const parseArr = (v: any): any[] => { try { const a = typeof v === 'string' ? JSON.parse(v) : v; return Array.isArray(a) ? a : []; } catch { return []; } };
const origin = (req: Request) => process.env.NEXTAUTH_URL || `${req.headers.get('x-forwarded-proto') ?? 'https'}://${req.headers.get('host')}`;

async function ensure() {
  await sql`CREATE TABLE IF NOT EXISTS event_rsvps (
    id TEXT PRIMARY KEY, event_id TEXT, token TEXT UNIQUE, name TEXT, email TEXT, profile_id TEXT,
    status TEXT DEFAULT 'Sent', answers TEXT, created_by TEXT,
    submitted_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  // Custom, user-created RSVP/survey forms (built-ins live in code).
  await sql`CREATE TABLE IF NOT EXISTS rsvp_events (
    id TEXT PRIMARY KEY, title TEXT, description TEXT, questions TEXT, created_by TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`ALTER TABLE rsvp_events ADD COLUMN IF NOT EXISTS thank_you TEXT`;
}

const rowToEvent = (r: any): EventDef => ({ id: r.id, title: r.title ?? '', description: r.description ?? '', questions: parseArr(r.questions) as RsvpQuestion[], thankYou: r.thank_you ?? '', custom: true } as any);

async function allEvents(): Promise<EventDef[]> {
  const rows = await sql`SELECT id, title, description, questions, thank_you FROM rsvp_events WHERE active ORDER BY created_at DESC` as any[];
  return [...EVENTS, ...rows.map(rowToEvent)];
}
async function resolveEvent(id: string): Promise<EventDef | undefined> {
  const b = builtinEvent(id); if (b) return b;
  const [r] = await sql`SELECT id, title, description, questions, thank_you FROM rsvp_events WHERE id = ${id}` as any[];
  return r ? rowToEvent(r) : undefined;
}

// Normalize builder-submitted questions: ensure ids, valid types, options.
function cleanQuestions(input: any): RsvpQuestion[] {
  if (!Array.isArray(input)) return [];
  return input.map((q: any, i: number) => {
    const type = q?.type === 'text' ? 'text' : 'choice';
    const out: RsvpQuestion = { id: String(q?.id || `q${i + 1}`).replace(/[^\w]/g, '').slice(0, 40) || `q${i + 1}`, label: String(q?.label ?? '').slice(0, 300), type };
    if (type === 'choice') out.options = (Array.isArray(q?.options) ? q.options : ['Yes', 'No']).map((o: any) => String(o).slice(0, 80)).filter(Boolean).slice(0, 8);
    if (q?.showIf?.q && q?.showIf?.value != null) out.showIf = { q: String(q.showIf.q), value: String(q.showIf.value) };
    return out;
  }).filter(q => q.label);
}

export async function GET(req: Request) {
  await ensure();
  const u = new URL(req.url);
  const token = u.searchParams.get('token');
  if (token) {
    const [row] = await sql`SELECT event_id, name, status, answers FROM event_rsvps WHERE token = ${token}` as any[];
    if (!row) return NextResponse.json({ error: 'This link is invalid or has expired.' }, { status: 404 });
    const ev = await resolveEvent(row.event_id);
    if (!ev) return NextResponse.json({ error: 'This event is no longer available.' }, { status: 404 });
    return NextResponse.json({ row: { name: row.name ?? '', status: row.status, event: ev, answers: row.status === 'Completed' ? parse(row.answers) : {} } });
  }
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  // Clean up any test responses that were recorded before (test = no employee).
  await sql`DELETE FROM event_rsvps WHERE profile_id IS NULL AND status = 'Completed'`;
  const events = await allEvents();
  const eventId = u.searchParams.get('eventId') ?? events[0]?.id ?? '';
  const rows = await sql`SELECT id, token, name, email, profile_id, status, answers, submitted_at, created_at
    FROM event_rsvps WHERE event_id = ${eventId} ORDER BY created_at DESC` as any[];
  return NextResponse.json({ events, rows: rows.map(r => ({ ...r, answers: parse(r.answers) })) });
}

export async function POST(req: Request) {
  await ensure();
  const b = await req.json();

  // Public submit — guarded by the token.
  if (b.action === 'submit') {
    const [row] = await sql`SELECT * FROM event_rsvps WHERE token = ${b.token}` as any[];
    if (!row) return NextResponse.json({ error: 'This link is invalid or has expired.' }, { status: 404 });
    if (row.status === 'Completed') return NextResponse.json({ error: 'You already responded — thank you!', done: true }, { status: 409 });
    // Test sends (no employee attached) are never recorded — the tester still
    // sees the thank-you page, but nothing is counted or stored.
    if (!row.profile_id) { await sql`DELETE FROM event_rsvps WHERE id = ${row.id}`; return NextResponse.json({ ok: true }); }
    const answers = (b.answers && typeof b.answers === 'object') ? b.answers : {};
    await sql`UPDATE event_rsvps SET answers = ${JSON.stringify(answers)}, status = 'Completed', submitted_at = NOW() WHERE id = ${row.id}`;
    return NextResponse.json({ ok: true });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const by = (session.user as any).email ?? null;

  // ---- Form builder: create / update / delete custom forms ----
  if (b.action === 'create-event') {
    const title = String(b.title ?? '').trim();
    if (!title) return NextResponse.json({ error: 'Enter a form title' }, { status: 400 });
    const qs = cleanQuestions(b.questions);
    if (!qs.length) return NextResponse.json({ error: 'Add at least one question' }, { status: 400 });
    const id = 'ev-' + cuid();
    await sql`INSERT INTO rsvp_events (id, title, description, questions, thank_you, created_by) VALUES (${id}, ${title}, ${String(b.description ?? '')}, ${JSON.stringify(qs)}, ${String(b.thankYou ?? '')}, ${by})`;
    const ev = await resolveEvent(id);
    return NextResponse.json({ event: ev }, { status: 201 });
  }
  if (b.action === 'update-event') {
    const id = String(b.id ?? '');
    if (builtinEvent(id)) return NextResponse.json({ error: 'Built-in forms can’t be edited' }, { status: 400 });
    const qs = cleanQuestions(b.questions);
    await sql`UPDATE rsvp_events SET title = ${String(b.title ?? '').trim()}, description = ${String(b.description ?? '')}, questions = ${JSON.stringify(qs)}, thank_you = ${String(b.thankYou ?? '')}, updated_at = NOW() WHERE id = ${id}`;
    const ev = await resolveEvent(id);
    return NextResponse.json({ event: ev });
  }
  if (b.action === 'delete-event') {
    const id = String(b.id ?? '');
    if (builtinEvent(id)) return NextResponse.json({ error: 'Built-in forms can’t be deleted' }, { status: 400 });
    await sql`DELETE FROM rsvp_events WHERE id = ${id}`;
    await sql`DELETE FROM event_rsvps WHERE event_id = ${id}`;
    return NextResponse.json({ ok: true });
  }

  const eventId = String(b.eventId ?? '');
  const ev = await resolveEvent(eventId);
  if (!ev) return NextResponse.json({ error: 'Unknown event' }, { status: 400 });

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

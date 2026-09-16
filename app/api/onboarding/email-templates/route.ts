export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql, cuid } from '@/lib/db';

// Shared, saved new-hire email templates (visible to all HR admins).
async function ensure() {
  await sql`CREATE TABLE IF NOT EXISTS email_templates (
    id TEXT PRIMARY KEY, name TEXT, subject TEXT, body TEXT,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM email_templates` as any[];
  const seeded = await sql`SELECT 1 FROM email_templates WHERE id = 'welcome-onboarding-benefits' LIMIT 1` as any[];
  if (n === 0 && seeded.length === 0) {
    const body = `Hi [First name],

Welcome to Litson!

Attached is your Onboarding Guide and Benefits Guide, which includes important information to help you get started, including your Litson email credentials and links to the relevant SOPs.

Your Litson email and all required tools have been set up. I'll also send invitations to your Litson email for the tools you need, as well as any scheduled meetings. All necessary calls have also been scheduled and added to your calendar.

Once you log in, please change your temporary passwords and save your updated login credentials in Dashlane for secure access going forward.

The onboarding guide also includes the SOP links you'll need to reference as you get familiar with our processes.

Please let me know if you have any trouble accessing your email, tools, calendar, or any of the information in the onboarding guide.

Welcome again, and we're excited to have you join the team!`;
    await sql`INSERT INTO email_templates (id, name, subject, body, sort_order)
      VALUES ('welcome-onboarding-benefits', 'Welcome — Onboarding & Benefits Guide', 'Welcome to Litson — Your Onboarding & Benefits Guide', ${body}, 0)`;
  }
}

const COLS = ['name', 'subject', 'body', 'sort_order'] as const;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const rows = await sql`SELECT * FROM email_templates ORDER BY sort_order ASC, created_at ASC`;
  return NextResponse.json({ rows });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const b = await req.json().catch(() => ({}));
  const id = cuid();
  const [{ mx }] = await sql`SELECT COALESCE(MAX(sort_order), -1)::int AS mx FROM email_templates` as any[];
  await sql`INSERT INTO email_templates (id, name, subject, body, sort_order)
    VALUES (${id}, ${b.name ?? 'New email template'}, ${b.subject ?? ''}, ${b.body ?? ''}, ${(mx ?? -1) + 1})`;
  const [row] = await sql`SELECT * FROM email_templates WHERE id = ${id}` as any[];
  return NextResponse.json({ row }, { status: 201 });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const { id, ...f } = await req.json();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  for (const c of COLS) if (c in f) await sql`UPDATE email_templates SET ${sql(c)} = ${f[c] ?? ''} WHERE id = ${id}`;
  await sql`UPDATE email_templates SET updated_at = NOW() WHERE id = ${id}`;
  const [row] = await sql`SELECT * FROM email_templates WHERE id = ${id}` as any[];
  return NextResponse.json({ row });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  await sql`DELETE FROM email_templates WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}

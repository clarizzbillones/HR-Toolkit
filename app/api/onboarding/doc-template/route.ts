export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { parseTemplate } from '@/lib/onboardingDoc';

// The shared onboarding-document template (row structure + custom assignee
// names), stored once on the app_settings singleton and used by every hire's
// document so they all stay in sync.
async function ensure() {
  await sql`CREATE TABLE IF NOT EXISTS app_settings (id TEXT PRIMARY KEY)`;
  await sql`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS onboarding_doc_template TEXT`;
  await sql`INSERT INTO app_settings (id) VALUES ('singleton') ON CONFLICT (id) DO NOTHING`;
}

export async function GET() {
  await ensure();
  const [row] = await sql`SELECT onboarding_doc_template FROM app_settings WHERE id = 'singleton'` as any[];
  return NextResponse.json({ template: parseTemplate(row?.onboarding_doc_template) });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const b = await req.json();
  const template = parseTemplate(b.template);
  await sql`UPDATE app_settings SET onboarding_doc_template = ${JSON.stringify(template)} WHERE id = 'singleton'`;
  return NextResponse.json({ template });
}

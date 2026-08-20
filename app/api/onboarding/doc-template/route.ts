export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { parseTemplate, ensureTemplateAccounts } from '@/lib/onboardingDoc';

// The shared onboarding-document template (row structure + custom assignee
// names), stored once on the app_settings singleton and used by every hire's
// document so they all stay in sync.
async function ensure() {
  await sql`CREATE TABLE IF NOT EXISTS app_settings (id TEXT PRIMARY KEY)`;
  await sql`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS onboarding_doc_template TEXT`;
  await sql`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS doc_template_migrations TEXT`;
  await sql`INSERT INTO app_settings (id) VALUES ('singleton') ON CONFLICT (id) DO NOTHING`;
}

// Accounts to roll out to any already-saved template (see migration below).
// Adding a firm tool to ONB_DEFAULT_ACCOUNTS only reaches installs with no
// saved template; this makes it reach the ones that do, exactly once, so the
// firm can still remove a row later without it reappearing.
const ROLLOUT_ACCOUNTS = [
  { label: 'Westlaw', hint: 'Legal research' },
  { label: 'Tybera', hint: 'Court e-filing' },
  { label: 'Davidson County Court e-filing', hint: 'Court e-filing (Davidson County, TN) — if they have one, get access and update their info' },
];
const ROLLOUT_KEY = 'accounts-westlaw-tybera-davidson';

async function runMigrations() {
  const [row] = await sql`SELECT onboarding_doc_template, doc_template_migrations FROM app_settings WHERE id = 'singleton'` as any[];
  let done: string[] = [];
  try { done = JSON.parse(row?.doc_template_migrations ?? '[]'); } catch { done = []; }
  if (done.includes(ROLLOUT_KEY)) return;
  // Only a template the firm has actually saved needs patching — with none
  // saved, the defaults already include these accounts.
  if (row?.onboarding_doc_template) {
    const { tpl, changed } = ensureTemplateAccounts(parseTemplate(row.onboarding_doc_template), ROLLOUT_ACCOUNTS);
    if (changed) await sql`UPDATE app_settings SET onboarding_doc_template = ${JSON.stringify(tpl)} WHERE id = 'singleton'`;
  }
  await sql`UPDATE app_settings SET doc_template_migrations = ${JSON.stringify([...done, ROLLOUT_KEY])} WHERE id = 'singleton'`;
}

export async function GET() {
  await ensure();
  await runMigrations();
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

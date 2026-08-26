export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { parseTemplate, ensureTemplateAccounts, defaultTemplate } from '@/lib/onboardingDoc';

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
// One-time replacement of Section 2 — Ops with the firm's tools list (from the
// guide). Only the accounts list is touched; HR (Section 1), IT (Section 3),
// and assignee names are left exactly as saved. Runs once so the firm can still
// edit/remove tools afterward without them snapping back.
const OPS_TOOLS_KEY = 'ops-tools-list-2026';
// Re-key the Ops accounts to stable, name-derived ids. The first pass used
// index-based ids that collided with hires' existing rows and shifted their
// cells onto the wrong tools; this rebuilds the list with stable ids so cells
// match by tool, not position.
const OPS_STABLE_IDS_KEY = 'ops-tools-stable-ids-2026';
// Restore the original Ops rows (keeping hires' entered cells attached) and
// append the extra guide tools — replacing the earlier version that renamed
// rows (e.g. dropped "Microsoft 365 mailbox created").
const OPS_RESTORE_ORIGINALS_KEY = 'ops-tools-restore-originals-2026';
// Add the Malpractice insurance HR row to already-saved templates (idempotent
// by label), so it appears on every hire's Pre-Onboarding section.
const HR_MALPRACTICE_KEY = 'hr-malpractice-2026';
const HR_MALPRACTICE_ROW = { id: 'hr-malpractice', label: 'Malpractice insurance — add to policy', hint: 'Email Derek Smith to add the new hire to the firm malpractice policy (attorneys / timekeepers).' };

async function runMigrations() {
  const [row] = await sql`SELECT onboarding_doc_template, doc_template_migrations FROM app_settings WHERE id = 'singleton'` as any[];
  let done: string[] = [];
  try { done = JSON.parse(row?.doc_template_migrations ?? '[]'); } catch { done = []; }
  const saved = row?.onboarding_doc_template ? parseTemplate(row.onboarding_doc_template) : null;
  let tpl = saved;
  let changed = false;

  // Legacy rollout: ensure the three e-filing tools exist (kept for installs
  // that predate the full tools list below).
  if (!done.includes(ROLLOUT_KEY)) {
    if (tpl) { const r = ensureTemplateAccounts(tpl, ROLLOUT_ACCOUNTS); tpl = r.tpl; changed = changed || r.changed; }
    done = [...done, ROLLOUT_KEY];
  }
  // Replace Section 2 — Ops with the firm tools list, leaving other sections and
  // assignee names untouched.
  if (!done.includes(OPS_TOOLS_KEY)) {
    if (tpl) { tpl = { ...tpl, accounts: defaultTemplate().accounts }; changed = true; }
    done = [...done, OPS_TOOLS_KEY];
  }
  // Rebuild the Ops list with stable, name-derived ids (fixes the id collision
  // that shifted hires' cells onto the wrong tools).
  if (!done.includes(OPS_STABLE_IDS_KEY)) {
    if (tpl) { tpl = { ...tpl, accounts: defaultTemplate().accounts }; changed = true; }
    done = [...done, OPS_STABLE_IDS_KEY];
  }
  // Restore the original row labels and append the extra tools.
  if (!done.includes(OPS_RESTORE_ORIGINALS_KEY)) {
    if (tpl) { tpl = { ...tpl, accounts: defaultTemplate().accounts }; changed = true; }
    done = [...done, OPS_RESTORE_ORIGINALS_KEY];
  }
  // Add the Malpractice insurance HR row if it isn't already there.
  if (!done.includes(HR_MALPRACTICE_KEY)) {
    if (tpl && !tpl.hr.some(r => r.label.trim().toLowerCase() === HR_MALPRACTICE_ROW.label.toLowerCase())) {
      tpl = { ...tpl, hr: [...tpl.hr, HR_MALPRACTICE_ROW] }; changed = true;
    }
    done = [...done, HR_MALPRACTICE_KEY];
  }

  if (changed && tpl) await sql`UPDATE app_settings SET onboarding_doc_template = ${JSON.stringify(tpl)} WHERE id = 'singleton'`;
  await sql`UPDATE app_settings SET doc_template_migrations = ${JSON.stringify(done)} WHERE id = 'singleton'`;
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

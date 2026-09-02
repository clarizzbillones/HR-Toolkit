export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';

// Named sections for the shared onboarding checklist: [{ id, name, note }].
// Stored once on the app_settings singleton so every hire's checklist groups
// the same way.
// Seeded once (idempotent via a flag) so the firm starts with the agreed
// sections and the meetings note, then can rename/reorder/delete freely.
const SEED: { id: string; name: string; note: string }[] = [
  { id: 'sec-pre-onboarding', name: 'Pre-onboarding tasks', note: '' },
  { id: 'sec-hr-tasks', name: 'HR tasks', note: '' },
  { id: 'sec-meetings', name: 'Meetings scheduled', note: 'Schedule these meetings for 45 minutes to an hour to give leeway in case we hit a snag.' },
  { id: 'sec-new-hire', name: 'New hire tasks', note: '' },
];

async function ensure() {
  await sql`CREATE TABLE IF NOT EXISTS app_settings (id TEXT PRIMARY KEY)`;
  await sql`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS onboarding_checklist_sections TEXT`;
  await sql`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS onboarding_checklist_sections_seeded BOOLEAN DEFAULT false`;
  await sql`INSERT INTO app_settings (id) VALUES ('singleton') ON CONFLICT (id) DO NOTHING`;
  const [row] = await sql`SELECT onboarding_checklist_sections_seeded FROM app_settings WHERE id = 'singleton'` as any[];
  if (!row?.onboarding_checklist_sections_seeded) {
    await sql`UPDATE app_settings SET onboarding_checklist_sections = ${JSON.stringify(SEED)}, onboarding_checklist_sections_seeded = true WHERE id = 'singleton'`;
  }
}
function parse(raw: any): { id: string; name: string; note: string }[] {
  try {
    const a = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(a) ? a.map((s: any) => ({ id: String(s?.id ?? ''), name: String(s?.name ?? ''), note: String(s?.note ?? '') })).filter(s => s.id) : [];
  } catch { return []; }
}

export async function GET() {
  await ensure();
  const [row] = await sql`SELECT onboarding_checklist_sections FROM app_settings WHERE id = 'singleton'` as any[];
  return NextResponse.json({ sections: parse(row?.onboarding_checklist_sections) });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const b = await req.json();
  const sections = parse(b.sections);
  await sql`UPDATE app_settings SET onboarding_checklist_sections = ${JSON.stringify(sections)} WHERE id = 'singleton'`;
  return NextResponse.json({ sections });
}

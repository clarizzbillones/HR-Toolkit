export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';

// Extra assignee names for the offboarding document (beyond the built-in team),
// shared across all offboarding records. Stored on the app_settings singleton.
async function ensure() {
  await sql`CREATE TABLE IF NOT EXISTS app_settings (id TEXT PRIMARY KEY)`;
  await sql`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS offboarding_assignees TEXT`;
  await sql`INSERT INTO app_settings (id) VALUES ('singleton') ON CONFLICT (id) DO NOTHING`;
}
const parseArr = (s: any): string[] => { try { const p = JSON.parse(s ?? '[]'); return Array.isArray(p) ? Array.from(new Set(p.map((x: any) => String(x).trim()).filter(Boolean))) as string[] : []; } catch { return []; } };

export async function GET() {
  await ensure();
  const [row] = await sql`SELECT offboarding_assignees FROM app_settings WHERE id = 'singleton'` as any[];
  return NextResponse.json({ assignees: parseArr(row?.offboarding_assignees) });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const b = await req.json();
  const list = Array.isArray(b.assignees) ? Array.from(new Set(b.assignees.map((x: any) => String(x).trim()).filter(Boolean))) : [];
  await sql`UPDATE app_settings SET offboarding_assignees = ${JSON.stringify(list)} WHERE id = 'singleton'`;
  return NextResponse.json({ assignees: list });
}

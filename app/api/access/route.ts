export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { isAccessAdmin, SECTIONS, REPORT_TABS } from '@/lib/access';

async function ensureTable() {
  await sql`CREATE TABLE IF NOT EXISTS access_grants (
    email TEXT PRIMARY KEY,
    name TEXT,
    sections TEXT,
    report_tabs TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
  )`;
}

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email ?? '';
  const role = (session?.user as any)?.role ?? '';
  return isAccessAdmin(email, role) ? { email, role } : null;
}

const SECTION_KEYS = new Set(SECTIONS.map(s => s.key));
const TAB_KEYS = new Set(REPORT_TABS.map(t => t.key));

function parseRow(r: any) {
  const safe = (v: any) => { try { const a = JSON.parse(v ?? '[]'); return Array.isArray(a) ? a.map(String) : []; } catch { return []; } };
  return { email: r.email, name: r.name ?? '', sections: safe(r.sections), reportTabs: safe(r.report_tabs) };
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensureTable();
  const rows = await sql`SELECT * FROM access_grants ORDER BY name ASC, email ASC` as any[];
  return NextResponse.json({ grants: rows.map(parseRow) });
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensureTable();
  const body = await req.json();
  const email = String(body.email ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
  const name = String(body.name ?? '').slice(0, 120) || email.split('@')[0];
  let sections: string[] = Array.isArray(body.sections) ? body.sections.map(String).filter((s: string) => SECTION_KEYS.has(s)) : [];
  const reportTabs: string[] = Array.isArray(body.reportTabs) ? body.reportTabs.map(String).filter((s: string) => TAB_KEYS.has(s)) : [];
  // Granting any report tab implies access to the Reports section.
  if (reportTabs.length && !sections.includes('/reports')) sections = [...sections, '/reports'];
  await sql`INSERT INTO access_grants (email, name, sections, report_tabs, updated_at)
    VALUES (${email}, ${name}, ${JSON.stringify(sections)}, ${JSON.stringify(reportTabs)}, now())
    ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, sections = EXCLUDED.sections, report_tabs = EXCLUDED.report_tabs, updated_at = now()`;
  const [row] = await sql`SELECT * FROM access_grants WHERE email = ${email}` as any[];
  return NextResponse.json({ grant: parseRow(row) });
}

export async function DELETE(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensureTable();
  const { email } = await req.json();
  await sql`DELETE FROM access_grants WHERE email = ${String(email ?? '').trim().toLowerCase()}`;
  return NextResponse.json({ ok: true });
}

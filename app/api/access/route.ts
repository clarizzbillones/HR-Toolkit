export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { isAccessAdmin, accessAdminList, hrAdminList, SECTIONS, REPORT_TABS } from '@/lib/access';
import { listPortalAdmins, portalAdminEmails, addPortalAdmin, removePortalAdmin } from '@/lib/adminGrants';

async function ensureTable() {
  await sql`CREATE TABLE IF NOT EXISTS access_grants (
    email TEXT PRIMARY KEY,
    name TEXT,
    sections TEXT,
    report_tabs TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
  )`;
  await sql`ALTER TABLE access_grants ADD COLUMN IF NOT EXISTS edit_sections TEXT`;
}

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const email = (session?.user?.email ?? '').toLowerCase();
  const role = (session?.user as any)?.role ?? '';
  if (isAccessAdmin(email, role)) return { email, role };
  if (email && (await portalAdminEmails()).includes(email)) return { email, role };
  return null;
}
// Env-var admins are permanent and can't be removed from the portal.
function isEnvAdmin(email: string) {
  const e = email.toLowerCase();
  return accessAdminList().includes(e) || hrAdminList().includes(e);
}

const SECTION_KEYS = new Set(SECTIONS.map(s => s.key));
const TAB_KEYS = new Set(REPORT_TABS.map(t => t.key));

function parseRow(r: any) {
  const safe = (v: any) => { try { const a = JSON.parse(v ?? '[]'); return Array.isArray(a) ? a.map(String) : []; } catch { return []; } };
  return { email: r.email, name: r.name ?? '', sections: safe(r.sections), reportTabs: safe(r.report_tabs), editSections: safe(r.edit_sections) };
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensureTable();
  const rows = await sql`SELECT * FROM access_grants ORDER BY name ASC, email ASC` as any[];
  // Full-access admins (manage access + see every tab, incl. Employee Files).
  // Permanent env-var admins + portal-added admins (the latter are removable).
  const envAdmins = Array.from(new Set([...accessAdminList(), ...hrAdminList()])).sort();
  const portalAdmins = (await listPortalAdmins()).filter(a => !envAdmins.includes(a.email));
  const admins = Array.from(new Set([...envAdmins, ...portalAdmins.map(a => a.email)])).sort();
  return NextResponse.json({ grants: rows.map(parseRow), admins, envAdmins, portalAdmins });
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensureTable();
  const body = await req.json();
  const email = String(body.email ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Valid email required' }, { status: 400 });

  // Promote someone to a full-access admin (portal-managed). Admins can't be
  // restricted, so also drop any viewer grant they had.
  if (body.action === 'add-admin') {
    const nm = String(body.name ?? '').slice(0, 120) || email.split('@')[0];
    await addPortalAdmin(email, nm);
    await sql`DELETE FROM access_grants WHERE email = ${email}`;
    const envAdmins = Array.from(new Set([...accessAdminList(), ...hrAdminList()])).sort();
    const portalAdmins = (await listPortalAdmins()).filter(a => !envAdmins.includes(a.email));
    return NextResponse.json({ portalAdmins, removedGrant: email });
  }

  const name = String(body.name ?? '').slice(0, 120) || email.split('@')[0];
  let sections: string[] = Array.isArray(body.sections) ? body.sections.map(String).filter((s: string) => SECTION_KEYS.has(s)) : [];
  const reportTabs: string[] = Array.isArray(body.reportTabs) ? body.reportTabs.map(String).filter((s: string) => TAB_KEYS.has(s)) : [];
  // Granting any report tab implies access to the Reports section.
  if (reportTabs.length && !sections.includes('/reports')) sections = [...sections, '/reports'];
  // Edit rights are only meaningful for sections they can also view.
  const editSections: string[] = (Array.isArray(body.editSections) ? body.editSections.map(String) : [])
    .filter((s: string) => SECTION_KEYS.has(s) && sections.includes(s));
  await sql`INSERT INTO access_grants (email, name, sections, report_tabs, edit_sections, updated_at)
    VALUES (${email}, ${name}, ${JSON.stringify(sections)}, ${JSON.stringify(reportTabs)}, ${JSON.stringify(editSections)}, now())
    ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, sections = EXCLUDED.sections, report_tabs = EXCLUDED.report_tabs, edit_sections = EXCLUDED.edit_sections, updated_at = now()`;
  const [row] = await sql`SELECT * FROM access_grants WHERE email = ${email}` as any[];
  return NextResponse.json({ grant: parseRow(row) });
}

export async function DELETE(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensureTable();
  const body = await req.json();
  const email = String(body.email ?? '').trim().toLowerCase();

  // Remove a portal-added admin (env-var admins are permanent — reject those).
  if (body.action === 'remove-admin') {
    if (isEnvAdmin(email)) return NextResponse.json({ error: 'This admin is set in the environment and can’t be removed here.' }, { status: 400 });
    await removePortalAdmin(email);
    const envAdmins = Array.from(new Set([...accessAdminList(), ...hrAdminList()])).sort();
    const portalAdmins = (await listPortalAdmins()).filter(a => !envAdmins.includes(a.email));
    return NextResponse.json({ ok: true, portalAdmins });
  }

  await sql`DELETE FROM access_grants WHERE email = ${email}`;
  return NextResponse.json({ ok: true });
}

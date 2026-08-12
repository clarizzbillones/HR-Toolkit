// Portal-managed full-access admins — added from the Access page (in addition
// to the permanent env-var admins in ACCESS_ADMINS / HR_ADMINS). A portal admin
// has full access, may manage access control, and sees every tab including
// Employee Files, and can never be restricted. Server-only (imports the DB).
import { sql } from '@/lib/db';

export async function ensureAdminTable() {
  await sql`CREATE TABLE IF NOT EXISTS admin_grants (
    email TEXT PRIMARY KEY,
    name TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
  )`;
}

export async function listPortalAdmins(): Promise<{ email: string; name: string }[]> {
  try {
    await ensureAdminTable();
    const rows = await sql`SELECT email, name FROM admin_grants ORDER BY name ASC, email ASC` as any[];
    return rows.map(r => ({ email: String(r.email).toLowerCase(), name: r.name ?? '' }));
  } catch { return []; }
}

export async function portalAdminEmails(): Promise<string[]> {
  return (await listPortalAdmins()).map(a => a.email);
}

export async function addPortalAdmin(email: string, name: string) {
  await ensureAdminTable();
  await sql`INSERT INTO admin_grants (email, name) VALUES (${email}, ${name})
    ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name`;
}

export async function removePortalAdmin(email: string) {
  await ensureAdminTable();
  await sql`DELETE FROM admin_grants WHERE email = ${email}`;
}

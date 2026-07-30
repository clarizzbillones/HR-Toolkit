export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';

// A small shared store of saved signatures (e.g. Alex Little), so they can be
// reused across forms and devices — not just from a single browser's storage.
async function ensure() {
  await sql`CREATE TABLE IF NOT EXISTS saved_signatures (
    name TEXT PRIMARY KEY, image TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const rows = await sql`SELECT name, image FROM saved_signatures ORDER BY name ASC` as any[];
  return NextResponse.json({ signatures: rows });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const b = await req.json();
  const name = String(b.name ?? '').trim();
  const image = String(b.image ?? '');
  if (!name || !image.startsWith('data:image')) return NextResponse.json({ error: 'Missing name or signature' }, { status: 400 });
  await sql`INSERT INTO saved_signatures (name, image) VALUES (${name}, ${image})
    ON CONFLICT (name) DO UPDATE SET image = ${image}, created_at = NOW()`;
  const rows = await sql`SELECT name, image FROM saved_signatures ORDER BY name ASC` as any[];
  return NextResponse.json({ signatures: rows });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const name = new URL(req.url).searchParams.get('name');
  if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 });
  await sql`DELETE FROM saved_signatures WHERE name = ${name}`;
  return NextResponse.json({ ok: true });
}

export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql, cuid } from '@/lib/db';
import { ensureGifts } from '@/lib/gifts';
import { canSeeGifts } from '@/lib/access';

// Only people on the gift allowlist may read or write this list.
async function guard() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email ?? '';
  return canSeeGifts(email) ? null : NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

const COLS = ['name', 'relationship', 'address', 'phone', 'tier', 'ordered', 'ordered_note', 'mailed', 'sort_order'] as const;

export async function GET() {
  const denied = await guard(); if (denied) return denied;
  await ensureGifts();
  const rows = await sql`SELECT * FROM gift_recipients ORDER BY sort_order ASC, created_at ASC`;
  return NextResponse.json({ rows });
}

export async function POST(req: Request) {
  const denied = await guard(); if (denied) return denied;
  await ensureGifts();
  const b = await req.json();
  const id = cuid();
  const [{ mx }] = await sql`SELECT COALESCE(MAX(sort_order), -1)::int AS mx FROM gift_recipients` as any[];
  await sql`INSERT INTO gift_recipients (id, name, relationship, address, phone, tier, ordered, ordered_note, mailed, sort_order)
    VALUES (${id}, ${b.name ?? ''}, ${b.relationship ?? ''}, ${b.address ?? ''}, ${b.phone ?? ''}, ${b.tier ?? ''}, ${!!b.ordered}, ${b.ordered_note ?? ''}, ${!!b.mailed}, ${(mx ?? -1) + 1})`;
  const [row] = await sql`SELECT * FROM gift_recipients WHERE id = ${id}` as any[];
  return NextResponse.json({ row }, { status: 201 });
}

export async function PATCH(req: Request) {
  const denied = await guard(); if (denied) return denied;
  await ensureGifts();
  const { id, ...f } = await req.json();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  for (const c of COLS) if (c in f) await sql`UPDATE gift_recipients SET ${sql(c)} = ${f[c] ?? (c === 'ordered' || c === 'mailed' ? false : '')} WHERE id = ${id}`;
  const [row] = await sql`SELECT * FROM gift_recipients WHERE id = ${id}` as any[];
  return NextResponse.json({ row });
}

export async function DELETE(req: Request) {
  const denied = await guard(); if (denied) return denied;
  await ensureGifts();
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  await sql`DELETE FROM gift_recipients WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}

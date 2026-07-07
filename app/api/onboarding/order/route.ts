export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { sql, cuid } from '@/lib/db';

// Per-guide order of the onboarding content blocks, stored as a `meta` item
// (kind='meta', title='block_order') so it's ignored by the normal item fetch.

export async function GET() {
  try {
    const rows = await sql`SELECT guide, body FROM onboarding_items WHERE kind = 'meta' AND title = 'block_order'` as any[];
    const orders: Record<string, string[]> = {};
    for (const r of rows) {
      if (!r.guide) continue;
      try { const arr = JSON.parse(r.body); if (Array.isArray(arr)) orders[r.guide] = arr.map(String); } catch { /* skip */ }
    }
    return NextResponse.json({ orders });
  } catch {
    return NextResponse.json({ orders: {} });
  }
}

export async function POST(req: Request) {
  const { guide, order } = await req.json();
  if (!guide || !Array.isArray(order)) return NextResponse.json({ error: 'guide and order required' }, { status: 400 });
  const body = JSON.stringify(order.map(String));
  await sql`DELETE FROM onboarding_items WHERE kind = 'meta' AND title = 'block_order' AND guide = ${guide}`;
  await sql`INSERT INTO onboarding_items (id, guide, kind, title, body) VALUES (${cuid()}, ${guide}, 'meta', 'block_order', ${body})`;
  return NextResponse.json({ ok: true });
}

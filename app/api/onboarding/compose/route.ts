export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { sql, cuid } from '@/lib/db';

// "Composed" (new-hire) guides: a name plus the building-block guides it merges.
// Stored as a meta item (kind='meta', title='composed', guide=<name>, body=JSON sources).

export async function GET() {
  try {
    const rows = await sql`SELECT guide, body FROM onboarding_items WHERE kind = 'meta' AND title = 'composed'` as any[];
    const composed: { name: string; sources: string[]; exclude: string[] }[] = [];
    for (const r of rows) {
      if (!r.guide) continue;
      try {
        const parsed = JSON.parse(r.body);
        // Legacy format was a bare array of source names.
        const sources = (Array.isArray(parsed) ? parsed : parsed.sources ?? []).map(String);
        const exclude = (Array.isArray(parsed) ? [] : parsed.exclude ?? []).map(String);
        composed.push({ name: r.guide, sources, exclude });
      } catch { /* skip */ }
    }
    return NextResponse.json({ composed });
  } catch {
    return NextResponse.json({ composed: [] });
  }
}

export async function POST(req: Request) {
  const { name, sources, exclude } = await req.json();
  if (!name?.trim() || !Array.isArray(sources) || !sources.length) {
    return NextResponse.json({ error: 'name and at least one source guide are required' }, { status: 400 });
  }
  const body = JSON.stringify({ sources: sources.map(String), exclude: Array.isArray(exclude) ? exclude.map(String) : [] });
  await sql`DELETE FROM onboarding_items WHERE kind = 'meta' AND title = 'composed' AND guide = ${name.trim()}`;
  await sql`INSERT INTO onboarding_items (id, guide, kind, title, body) VALUES (${cuid()}, ${name.trim()}, 'meta', 'composed', ${body})`;
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { name } = await req.json();
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  await sql`DELETE FROM onboarding_items WHERE kind = 'meta' AND title = 'composed' AND guide = ${name}`;
  return NextResponse.json({ ok: true });
}

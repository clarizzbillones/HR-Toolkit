export const runtime = 'nodejs';
export const maxDuration = 60;
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url') ?? '';
  if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 });

  const allowed = /^https?:\/\/(outlook\.|calendar\.|webcal\.|[a-z0-9-]+\.office\.com|[a-z0-9-]+\.office365\.com|outlook\.live\.com|outlook\.cloud\.microsoft)/i;
  const safeUrl = url.replace(/^webcal:/, 'https:');
  if (!allowed.test(safeUrl)) return NextResponse.json({ error: 'URL not allowed' }, { status: 400 });

  try {
    const res = await fetch(safeUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'text/calendar, text/html, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
      signal: AbortSignal.timeout(55000),
      redirect: 'follow',
    });
    if (!res.ok) return NextResponse.json({ error: `Upstream ${res.status}` }, { status: 502 });
    const text = await res.text();
    return new Response(text, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Failed' }, { status: 502 });
  }
}

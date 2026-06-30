export const runtime = 'nodejs';
export const maxDuration = 60;
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

function parseDate(val: string): string {
  const d = val.replace(/[TZ]/g, '').slice(0, 8);
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}
function detectTag(summary: string): string {
  const t = summary.toUpperCase();
  if (t.includes('OOO') || t.includes('OUT OF OFFICE')) return 'OOO';
  if (t.includes('PTO') || t.includes('VACATION') || t.includes('LEAVE')) return 'PTO';
  if (t.includes('WFH') || t.includes('WORK FROM HOME') || t.includes('REMOTE')) return 'WFH';
  return 'Other';
}
function extractName(summary: string): string {
  return summary
    .replace(/\b(OOO|PTO|WFH|OUT OF OFFICE|VACATION|LEAVE|REMOTE|WORK FROM HOME)\b/gi, '')
    .replace(/[-–—]/g, ' ').replace(/\s+/g, ' ').trim().split(' ')[0] || summary.trim();
}
function parseIcs(text: string) {
  const events: { id: string; name: string; tag: string; start: string; end: string; title: string }[] = [];
  const blocks = text.split('BEGIN:VEVENT');
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    const get = (key: string) => block.match(new RegExp(`${key}[^:]*:([^\r\n]+)`))?.[1]?.trim() ?? '';
    const summary = get('SUMMARY');
    const dtstart = get('DTSTART');
    const dtend = get('DTEND');
    const uid = get('UID');
    if (!summary || !dtstart) continue;
    const start = parseDate(dtstart);
    let end = dtend ? parseDate(dtend) : start;
    if (dtend && !dtend.includes('T')) {
      const d = new Date(end + 'T12:00:00');
      d.setDate(d.getDate() - 1);
      end = d.toISOString().slice(0, 10);
    }
    if (end < '2026-06-01') continue;
    events.push({ id: uid || `${i}`, name: extractName(summary), tag: detectTag(summary), start, end, title: summary });
  }
  return events;
}

// Called by Vercel Cron and also by the "Refresh" button in the UI
export async function GET(req: Request) {
  // Verify cron secret to prevent public abuse
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get the saved calendar URL
  const rows = await sql`SELECT calendar_url FROM app_settings WHERE id = 'singleton'`;
  const calUrl = (rows as any[])[0]?.calendar_url;
  if (!calUrl) return NextResponse.json({ skipped: 'no calendar_url configured' });

  const icsUrl = calUrl.replace(/^webcal:/, 'https:');
  try {
    const res = await fetch(icsUrl, {
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
    if (!text.includes('BEGIN:VCALENDAR')) return NextResponse.json({ error: 'Not a valid ICS feed' }, { status: 422 });
    const events = parseIcs(text);
    await sql`UPDATE app_settings SET calendar_events = ${JSON.stringify(events)} WHERE id = 'singleton'`;
    return NextResponse.json({ ok: true, events: events.length, refreshed: new Date().toISOString() });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Fetch failed' }, { status: 502 });
  }
}

export const runtime = 'edge';
export const maxDuration = 30;
import { NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';

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

async function fetchAndSave(icsUrl: string, origin: string) {
  const res = await fetch(icsUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Accept': 'text/calendar, text/html, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
    },
    redirect: 'follow',
  });
  if (!res.ok) return;
  const text = await res.text();
  if (!text.includes('BEGIN:VCALENDAR')) return;
  const events = parseIcs(text);
  await fetch(`${origin}/api/connections`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ calendar_events: events }),
  });
}

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const urlParam = searchParams.get('url') ?? '';
  if (!urlParam) return NextResponse.json({ error: 'Missing url' }, { status: 400 });

  const allowed = /^https?:\/\/(outlook\.|calendar\.|webcal\.|[a-z0-9-]+\.office\.com|[a-z0-9-]+\.office365\.com|outlook\.live\.com|outlook\.cloud\.microsoft)/i;
  const icsUrl = urlParam.replace(/^webcal:/, 'https:');
  if (!allowed.test(icsUrl)) return NextResponse.json({ error: 'URL not allowed' }, { status: 400 });

  // Respond immediately — waitUntil keeps the fetch running after response is sent
  waitUntil(fetchAndSave(icsUrl, origin));
  return NextResponse.json({ started: true });
}

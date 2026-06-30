export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

interface IcsEvent {
  id: string;
  name: string;
  tag: string;
  start: string;
  end: string;
  title: string;
}

function parseDate(val: string): string {
  // DTSTART;VALUE=DATE:20260630  or  DTSTART:20260630T000000Z
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
  // Patterns: "Amy WFH", "JRG - WFH", "Paula OOO", "Ted OOO - Sea Island"
  return summary
    .replace(/\b(OOO|PTO|WFH|OUT OF OFFICE|VACATION|LEAVE|REMOTE|WORK FROM HOME)\b/gi, '')
    .replace(/[-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')[0] // first word = first name / initials
    || summary.trim();
}

function parseIcs(text: string): IcsEvent[] {
  const events: IcsEvent[] = [];
  const blocks = text.split('BEGIN:VEVENT');
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    const get = (key: string) => {
      const match = block.match(new RegExp(`${key}[^:]*:([^\r\n]+)`));
      return match?.[1]?.trim() ?? '';
    };
    const summary = get('SUMMARY');
    const dtstart = get('DTSTART');
    const dtend = get('DTEND');
    const uid = get('UID');
    if (!summary || !dtstart) continue;
    const start = parseDate(dtstart);
    // DTEND for all-day events is exclusive (next day), subtract 1
    let end = dtend ? parseDate(dtend) : start;
    if (dtend && !dtend.includes('T')) {
      // All-day: DTEND is exclusive, move back 1 day
      const d = new Date(end + 'T12:00:00');
      d.setDate(d.getDate() - 1);
      end = d.toISOString().slice(0, 10);
    }
    events.push({
      id: uid || `${i}`,
      name: extractName(summary),
      tag: detectTag(summary),
      start,
      end,
      title: summary,
    });
  }
  return events;
}

export async function POST(req: Request) {
  const { url } = await req.json();
  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 });
  }
  // Only allow .ics / webcal / outlook URLs
  const allowed = /^https?:\/\/(outlook\.|calendar\.|webcal\.|[a-z0-9-]+\.office\.com|[a-z0-9-]+\.office365\.com|outlook\.live\.com|outlook\.cloud\.microsoft)/i;
  if (!allowed.test(url.replace(/^webcal:/, 'https:'))) {
    return NextResponse.json({ error: 'URL not allowed' }, { status: 400 });
  }
  try {
    const icsUrl = url.replace(/^webcal:/, 'https:');
    const res = await fetch(icsUrl, {
      headers: { 'User-Agent': 'LitsonHRToolkit/1.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return NextResponse.json({ error: `Fetch failed: ${res.status}` }, { status: 502 });
    const text = await res.text();
    if (!text.includes('BEGIN:VCALENDAR')) {
      return NextResponse.json({ error: 'Not a valid ICS feed' }, { status: 422 });
    }
    const events = parseIcs(text);
    return NextResponse.json({ events });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Failed to fetch calendar' }, { status: 502 });
  }
}

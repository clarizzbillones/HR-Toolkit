import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getCalendarEvents, sendMail } from '@/lib/graph';
import { sql } from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  const accessToken = (session as any)?.accessToken as string | undefined;
  const employees = await sql`SELECT * FROM employees ORDER BY name`;
  const ptoEntries = await sql`SELECT * FROM pto_entries WHERE status = 'Approved'`;

  let calEvents: any[] = [];
  if (accessToken) {
    const today = new Date().toISOString();
    const end = new Date(Date.now() + 90 * 86400000).toISOString();
    calEvents = await getCalendarEvents(accessToken, today, end);
  }

  const today = new Date().toISOString().slice(0, 10);
  const outToday = (ptoEntries as any[]).filter(e => e.start_date <= today && e.end_date >= today);
  const ptoNames = new Set((ptoEntries as any[]).map(e => e.employee));
  const calNames = new Set(calEvents.map(e => e.organizer?.emailAddress?.name ?? '').filter(Boolean));
  const updatedNames = new Set([...ptoNames, ...calNames]);

  const rows = (employees as any[]).map(emp => ({
    id: emp.id,
    name: emp.name,
    role: emp.role,
    dept: emp.dept,
    updated: updatedNames.has(emp.name),
    window: (ptoEntries as any[]).filter(e => e.employee === emp.name).map(e => `${e.start_date ?? ''} – ${e.end_date ?? ''}`).join(', ') || null,
  }));

  return NextResponse.json({
    connected: Boolean(accessToken),
    updatedCount: rows.filter(r => r.updated).length,
    totalCount: employees.length,
    outTodayCount: outToday.length,
    missingCount: rows.filter(r => !r.updated).length,
    rows,
  });
}

export async function POST(req: Request) {
  const { action } = await req.json();
  const session = await getServerSession(authOptions);
  const accessToken = (session as any)?.accessToken as string | undefined;
  if (action === 'nudge') {
    if (!accessToken) return NextResponse.json({ message: 'Nudge would be sent (connect Microsoft 365 first)' });
    const employees = await sql`SELECT * FROM employees`;
    const ptoEntries = await sql`SELECT DISTINCT employee FROM pto_entries`;
    const ptoNames = new Set((ptoEntries as any[]).map((e: any) => e.employee));
    const missing = (employees as any[]).filter(emp => !ptoNames.has(emp.name));
    for (const emp of missing.slice(0, 5)) {
      await sendMail(accessToken, `${emp.name.toLowerCase().replace(/\s/, '.')}@litson.com`, 'Action Required: Log your PTO in the firm calendar', `<p>Hi ${emp.name.split(' ')[0]},</p><p>Please log any upcoming PTO in the shared Outlook calendar so Renee can sync your time off. Thank you!</p><p>— HR</p>`);
    }
    return NextResponse.json({ message: `Nudge sent to ${missing.length} employees` });
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

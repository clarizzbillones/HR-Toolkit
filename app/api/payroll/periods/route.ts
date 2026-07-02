export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

// Ensure extra columns exist
async function ensureColumns() {
  try {
    await sql`ALTER TABLE payroll_periods ADD COLUMN IF NOT EXISTS check_date text`;
    await sql`ALTER TABLE payroll_periods ADD COLUMN IF NOT EXISTS report_name text`;
    await sql`ALTER TABLE payroll_periods ADD COLUMN IF NOT EXISTS report_data text`;
    await sql`ALTER TABLE payroll_periods ADD COLUMN IF NOT EXISTS report_summary text`;
    await sql`ALTER TABLE payroll_periods ADD COLUMN IF NOT EXISTS schedule text`;
  } catch { /* ignore */ }
}

// ---- Regular payroll schedule generation ----
function iso(d: Date) { return d.toLocaleDateString('en-CA'); }
function label(a: Date, b: Date) {
  const m = (x: Date) => x.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${m(a)}–${m(b)}`;
}
function endOfMonth(y: number, m: number) { return new Date(y, m + 1, 0); }

// Build upcoming periods for the next ~6 months based on cadence.
function buildSchedule(cadence: string): { period: string; pay_start: string; pay_end: string; check_date: string; due_date: string }[] {
  const out: { period: string; pay_start: string; pay_end: string; check_date: string; due_date: string }[] = [];
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

  if (cadence === 'Weekly' || cadence === 'Bi-weekly') {
    const step = cadence === 'Weekly' ? 7 : 14;
    // Anchor on the next Friday
    let end = new Date(today);
    while (end.getDay() !== 5) end = addDays(end, 1);
    for (let i = 0; i < (cadence === 'Weekly' ? 26 : 13); i++) {
      const payEnd = end;
      const payStart = addDays(payEnd, -(step - 1));
      const check = addDays(payEnd, 7);
      const due = addDays(check, -1);
      out.push({ period: label(payStart, payEnd), pay_start: iso(payStart), pay_end: iso(payEnd), check_date: iso(check), due_date: iso(due) });
      end = addDays(end, step);
    }
  } else if (cadence === 'Monthly' || cadence === 'Contractor') {
    for (let i = 0; i < 6; i++) {
      const base = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const start = base;
      const end = endOfMonth(base.getFullYear(), base.getMonth());
      const check = addDays(end, -2);
      const due = addDays(check, -1);
      out.push({ period: label(start, end), pay_start: iso(start), pay_end: iso(end), check_date: iso(check), due_date: iso(due) });
    }
  } else {
    // Semi-monthly (default): 1–15 and 16–EOM
    for (let i = 0; i < 6; i++) {
      const y = today.getFullYear(), m = today.getMonth() + i;
      const s1 = new Date(y, m, 1), e1 = new Date(y, m, 15);
      const c1 = new Date(y, m, 13), d1 = addDays(c1, -3);
      out.push({ period: label(s1, e1), pay_start: iso(s1), pay_end: iso(e1), check_date: iso(c1), due_date: iso(d1) });
      const s2 = new Date(y, m, 16), e2 = endOfMonth(y, m);
      const c2 = addDays(e2, -3), d2 = addDays(c2, -3);
      out.push({ period: label(s2, e2), pay_start: iso(s2), pay_end: iso(e2), check_date: iso(c2), due_date: iso(d2) });
    }
  }
  // Only keep periods whose check date is today or later
  const todayIso = iso(today);
  return out.filter(p => p.check_date >= todayIso);
}

export async function POST(req: Request) {
  await ensureColumns();
  const { action, cadence } = await req.json();
  if (action !== 'generate') return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  const sched = buildSchedule(cadence ?? 'Semi-monthly');
  // Replace future (Upcoming) periods; keep any Processing/Processed history
  await sql`DELETE FROM payroll_periods WHERE status NOT IN ('Processing','Processed')`;
  const scheduleLabel = cadence === 'Semi-monthly' ? 'Semimonthly' : (cadence ?? 'Semi-monthly');
  for (const p of sched) {
    const id = `pp${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
    await sql`INSERT INTO payroll_periods (id, period, run_date, cutoff, check_date, status, schedule)
      VALUES (${id}, ${p.period}, ${p.check_date}, ${p.due_date}, ${p.check_date}, 'Upcoming', ${scheduleLabel})`;
  }
  const periods = await sql`SELECT * FROM payroll_periods ORDER BY run_date ASC`;
  return NextResponse.json({ periods });
}

export async function PATCH(req: Request) {
  await ensureColumns();
  const { id, run_date, cutoff, check_date, status } = await req.json();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  if (run_date) await sql`UPDATE payroll_periods SET run_date = ${run_date} WHERE id = ${id}`;
  if (cutoff) await sql`UPDATE payroll_periods SET cutoff = ${cutoff} WHERE id = ${id}`;
  if (check_date !== undefined) await sql`UPDATE payroll_periods SET check_date = ${check_date || null} WHERE id = ${id}`;
  if (status) await sql`UPDATE payroll_periods SET status = ${status} WHERE id = ${id}`;
  const [period] = await sql`SELECT * FROM payroll_periods WHERE id = ${id}`;
  return NextResponse.json({ period });
}

export async function PUT(req: Request) {
  await ensureColumns();
  const formData = await req.formData();
  const id = formData.get('id') as string;
  const file = formData.get('file') as File | null;
  if (!id || !file) return NextResponse.json({ error: 'Missing id or file' }, { status: 400 });
  const summary = formData.get('summary') as string | null;
  const buf = await file.arrayBuffer();
  const b64 = Buffer.from(buf).toString('base64');
  const dataUrl = `data:${file.type};base64,${b64}`;
  await sql`UPDATE payroll_periods SET report_name = ${file.name}, report_data = ${dataUrl}, report_summary = ${summary ?? null} WHERE id = ${id}`;
  const [period] = await sql`SELECT id, report_name, report_summary FROM payroll_periods WHERE id = ${id}`;
  return NextResponse.json({ period });
}

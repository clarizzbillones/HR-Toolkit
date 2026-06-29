import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET() {
  const periods = await sql`SELECT * FROM payroll_periods ORDER BY run_date ASC`;
  const [settings] = await sql`SELECT * FROM payroll_settings WHERE id = 'singleton'`;
  return NextResponse.json({ periods, settings: settings ?? { id: 'singleton', cadence: 'Semi-monthly', reminder_toggles: '{"cutoff":true,"payrun":true,"timesheet":false}' } });
}

export async function PATCH(req: Request) {
  const { cadence, reminderToggles } = await req.json();
  const [cur] = await sql`SELECT * FROM payroll_settings WHERE id = 'singleton'`;
  if (!cur) {
    await sql`INSERT INTO payroll_settings (id,cadence,reminder_toggles) VALUES ('singleton',${cadence ?? 'Semi-monthly'},${JSON.stringify(reminderToggles ?? { cutoff: true, payrun: true, timesheet: false })})`;
  } else {
    if (cadence) await sql`UPDATE payroll_settings SET cadence = ${cadence} WHERE id = 'singleton'`;
    if (reminderToggles) await sql`UPDATE payroll_settings SET reminder_toggles = ${JSON.stringify(reminderToggles)} WHERE id = 'singleton'`;
  }
  const [settings] = await sql`SELECT * FROM payroll_settings WHERE id = 'singleton'`;
  return NextResponse.json({ settings });
}

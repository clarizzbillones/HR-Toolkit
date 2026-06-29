import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const periods = db.prepare('SELECT * FROM payroll_periods ORDER BY run_date ASC').all();
  const settings = db.prepare("SELECT * FROM payroll_settings WHERE id='singleton'").get() ?? {
    id: 'singleton', cadence: 'Semi-monthly', reminder_toggles: '{"cutoff":true,"payrun":true,"timesheet":false}',
  };
  return NextResponse.json({ periods, settings });
}

export async function PATCH(req: Request) {
  const db = getDb();
  const { cadence, reminderToggles } = await req.json();
  const cur = db.prepare("SELECT * FROM payroll_settings WHERE id='singleton'").get() as any;
  if (!cur) {
    db.prepare("INSERT INTO payroll_settings (id,cadence,reminder_toggles) VALUES ('singleton',?,?)")
      .run(cadence ?? 'Semi-monthly', JSON.stringify(reminderToggles ?? { cutoff: true, payrun: true, timesheet: false }));
  } else {
    if (cadence) db.prepare("UPDATE payroll_settings SET cadence=? WHERE id='singleton'").run(cadence);
    if (reminderToggles) db.prepare("UPDATE payroll_settings SET reminder_toggles=? WHERE id='singleton'").run(JSON.stringify(reminderToggles));
  }
  const settings = db.prepare("SELECT * FROM payroll_settings WHERE id='singleton'").get();
  return NextResponse.json({ settings });
}

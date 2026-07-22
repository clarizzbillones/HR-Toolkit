export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { sql, cuid } from '@/lib/db';

// Drop the heavy base64 blob from list payloads; expose only whether a file is
// attached and its name. The blob itself is fetched on demand from
// /api/reports/attachment.
function stripAttachment(rows: any[]): any[] {
  return (rows ?? []).map(({ attachment_data, ...r }: any) => ({ ...r, has_attachment: !!attachment_data }));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tab = url.searchParams.get('tab') ?? 'monthly';

  if (tab === 'insurance') {
    const invoices = await sql`SELECT * FROM insurance_invoices ORDER BY deadline ASC`;
    return NextResponse.json({ invoices: stripAttachment(invoices) });
  }
  if (tab === 'reimbursements') {
    const rows = await sql`SELECT * FROM reimbursements ORDER BY created_at DESC`;
    return NextResponse.json({ rows: stripAttachment(rows) });
  }
  if (tab === 'cashout') {
    const month = url.searchParams.get('month');
    const category = url.searchParams.get('category');
    const rows = await sql`
      SELECT * FROM cashout_ledger
      WHERE 1=1
      ${month ? sql`AND TO_CHAR(date::date, 'YYYY-MM') = ${month}` : sql``}
      ${category && category !== 'All' ? sql`AND category = ${category}` : sql``}
      ORDER BY date DESC
    `;
    return NextResponse.json({ rows: stripAttachment(rows) });
  }

  const pto = await sql`SELECT * FROM pto_entries ORDER BY start_date ASC`;
  const trips = await sql`SELECT * FROM trips ORDER BY created_at DESC`;
  const contractors = await sql`SELECT * FROM contractor_payments ORDER BY due_date ASC`;
  const overtime = await sql`SELECT * FROM overtime ORDER BY created_at DESC`;
  const employees = await sql`SELECT * FROM employees WHERE birthday IS NOT NULL ORDER BY birthday ASC`;
  const reviews = await sql`SELECT id, name, role, dept, hire_date, review_6mo_date, review_6mo_status, review_1yr_date, review_1yr_status FROM employees ORDER BY name ASC`;
  const cashout = await sql`SELECT * FROM cashout_ledger ORDER BY date ASC`;
  // Birthdays come from the Staffing directory (dob column, MM/DD/YYYY)
  let staff: any[] = [];
  try { staff = await sql`SELECT id, name, dob, start_date FROM staff_directory ORDER BY name ASC`; } catch { /* table may not exist yet */ }
  // Supporting documents across the money tabs, for the Monthly Pack.
  const attachments: { tab: string; id: string; name: string; label: string; date: string | null }[] = [];
  try {
    for (const r of await sql`SELECT id, carrier, deadline, attachment_name FROM insurance_invoices WHERE attachment_name IS NOT NULL` as any[])
      attachments.push({ tab: 'insurance', id: r.id, name: r.attachment_name, label: `Insurance — ${r.carrier}`, date: r.deadline });
  } catch { /* column may not exist yet */ }
  try {
    for (const r of await sql`SELECT id, employee, purpose, payout_date, attachment_name FROM reimbursements WHERE attachment_name IS NOT NULL` as any[])
      attachments.push({ tab: 'reimbursements', id: r.id, name: r.attachment_name, label: `Reimbursement — ${r.employee} (${r.purpose})`, date: r.payout_date });
  } catch { /* column may not exist yet */ }
  try {
    for (const r of await sql`SELECT id, payee, category, date, attachment_name FROM cashout_ledger WHERE attachment_name IS NOT NULL` as any[])
      attachments.push({ tab: 'cashout', id: r.id, name: r.attachment_name, label: `Cash Out — ${r.payee} (${r.category})`, date: r.date });
  } catch { /* column may not exist yet */ }
  return NextResponse.json({ pto, trips, contractors, overtime, employees, reviews, cashout: stripAttachment(cashout), staff, attachments });
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const tab = url.searchParams.get('tab') ?? 'insurance';
  const body = await req.json();

  // Optional file attachment (stored as a data URL). Capped server-side too.
  const attName = typeof body.attachmentName === 'string' ? body.attachmentName.slice(0, 200) : null;
  const attData = typeof body.attachmentData === 'string' && body.attachmentData.startsWith('data:') ? body.attachmentData : null;

  if (tab === 'insurance') {
    const { carrier, invoiceType, amount, deadline, coveragePeriod, enrolledCount } = body;
    await sql`ALTER TABLE insurance_invoices ADD COLUMN IF NOT EXISTS attachment_name TEXT`;
    await sql`ALTER TABLE insurance_invoices ADD COLUMN IF NOT EXISTS attachment_data TEXT`;
    const id = cuid();
    await sql`INSERT INTO insurance_invoices (id,carrier,invoice_type,amount,deadline,coverage_period,enrolled_count,attachment_name,attachment_data) VALUES (${id},${carrier},${invoiceType ?? null},${amount},${deadline},${coveragePeriod ?? null},${enrolledCount ?? null},${attName},${attData})`;
    const [invoice] = await sql`SELECT * FROM insurance_invoices WHERE id = ${id}`;
    return NextResponse.json({ invoice: { ...invoice, attachment_data: undefined, has_attachment: !!invoice.attachment_data } }, { status: 201 });
  }
  if (tab === 'reimbursements') {
    const { employee, purpose, amount, payoutDate } = body;
    await sql`ALTER TABLE reimbursements ADD COLUMN IF NOT EXISTS attachment_name TEXT`;
    await sql`ALTER TABLE reimbursements ADD COLUMN IF NOT EXISTS attachment_data TEXT`;
    const id = cuid();
    await sql`INSERT INTO reimbursements (id,employee,purpose,amount,payout_date,attachment_name,attachment_data) VALUES (${id},${employee},${purpose},${amount},${payoutDate ?? null},${attName},${attData})`;
    const [row] = await sql`SELECT * FROM reimbursements WHERE id = ${id}`;
    return NextResponse.json({ row: { ...row, attachment_data: undefined, has_attachment: !!row.attachment_data } }, { status: 201 });
  }
  if (tab === 'cashout') {
    const { date, payee, category, amount, status, note, method } = body;
    await sql`ALTER TABLE cashout_ledger ADD COLUMN IF NOT EXISTS note TEXT`;
    await sql`ALTER TABLE cashout_ledger ADD COLUMN IF NOT EXISTS method TEXT`;
    await sql`ALTER TABLE cashout_ledger ADD COLUMN IF NOT EXISTS attachment_name TEXT`;
    await sql`ALTER TABLE cashout_ledger ADD COLUMN IF NOT EXISTS attachment_data TEXT`;
    const id = cuid();
    await sql`INSERT INTO cashout_ledger (id,date,payee,category,amount,status,note,method,attachment_name,attachment_data) VALUES (${id},${date},${payee},${category},${amount},${status ?? 'Pending'},${note ?? null},${method ?? 'ACH'},${attName},${attData})`;
    const [row] = await sql`SELECT * FROM cashout_ledger WHERE id = ${id}`;
    return NextResponse.json({ row: { ...row, attachment_data: undefined, has_attachment: !!row.attachment_data } }, { status: 201 });
  }

  return NextResponse.json({ error: 'Unknown tab' }, { status: 400 });
}

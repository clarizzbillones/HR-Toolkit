export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { sql, cuid } from '@/lib/db';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tab = url.searchParams.get('tab') ?? 'monthly';

  if (tab === 'insurance') {
    const invoices = await sql`SELECT * FROM insurance_invoices ORDER BY deadline ASC`;
    return NextResponse.json({ invoices });
  }
  if (tab === 'reimbursements') {
    const rows = await sql`SELECT * FROM reimbursements ORDER BY created_at DESC`;
    return NextResponse.json({ rows });
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
    return NextResponse.json({ rows });
  }

  const pto = await sql`SELECT * FROM pto_entries ORDER BY start_date ASC`;
  const trips = await sql`SELECT * FROM trips ORDER BY created_at DESC`;
  const contractors = await sql`SELECT * FROM contractor_payments ORDER BY due_date ASC`;
  const overtime = await sql`SELECT * FROM overtime ORDER BY created_at DESC`;
  const employees = await sql`SELECT * FROM employees WHERE birthday IS NOT NULL ORDER BY birthday ASC`;
  return NextResponse.json({ pto, trips, contractors, overtime, employees });
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const tab = url.searchParams.get('tab') ?? 'insurance';
  const body = await req.json();

  if (tab === 'insurance') {
    const { carrier, invoiceType, amount, deadline, coveragePeriod, enrolledCount } = body;
    const id = cuid();
    await sql`INSERT INTO insurance_invoices (id,carrier,invoice_type,amount,deadline,coverage_period,enrolled_count) VALUES (${id},${carrier},${invoiceType ?? null},${amount},${deadline},${coveragePeriod ?? null},${enrolledCount ?? null})`;
    const [invoice] = await sql`SELECT * FROM insurance_invoices WHERE id = ${id}`;
    return NextResponse.json({ invoice }, { status: 201 });
  }
  if (tab === 'reimbursements') {
    const { employee, purpose, amount, payoutDate } = body;
    const id = cuid();
    await sql`INSERT INTO reimbursements (id,employee,purpose,amount,payout_date) VALUES (${id},${employee},${purpose},${amount},${payoutDate ?? null})`;
    const [row] = await sql`SELECT * FROM reimbursements WHERE id = ${id}`;
    return NextResponse.json({ row }, { status: 201 });
  }
  if (tab === 'cashout') {
    const { date, payee, category, amount, status } = body;
    const id = cuid();
    await sql`INSERT INTO cashout_ledger (id,date,payee,category,amount,status) VALUES (${id},${date},${payee},${category},${amount},${status ?? 'Pending'})`;
    const [row] = await sql`SELECT * FROM cashout_ledger WHERE id = ${id}`;
    return NextResponse.json({ row }, { status: 201 });
  }

  return NextResponse.json({ error: 'Unknown tab' }, { status: 400 });
}

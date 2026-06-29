import { NextResponse } from 'next/server';
import { getDb, cuid } from '@/lib/db';

export async function GET(req: Request) {
  const db = getDb();
  const url = new URL(req.url);
  const tab = url.searchParams.get('tab') ?? 'monthly';

  if (tab === 'insurance') {
    const invoices = db.prepare('SELECT * FROM insurance_invoices ORDER BY deadline ASC').all();
    return NextResponse.json({ invoices });
  }
  if (tab === 'reimbursements') {
    const rows = db.prepare('SELECT * FROM reimbursements ORDER BY created_at DESC').all();
    return NextResponse.json({ rows });
  }
  if (tab === 'cashout') {
    const month = url.searchParams.get('month');
    const category = url.searchParams.get('category');
    let q = 'SELECT * FROM cashout_ledger WHERE 1=1';
    const args: string[] = [];
    if (month) { q += " AND strftime('%Y-%m', date) = ?"; args.push(month); }
    if (category && category !== 'All') { q += ' AND category = ?'; args.push(category); }
    q += ' ORDER BY date DESC';
    const rows = db.prepare(q).all(...args);
    return NextResponse.json({ rows });
  }

  // monthly
  const pto = db.prepare('SELECT * FROM pto_entries ORDER BY start_date ASC').all();
  const trips = db.prepare('SELECT * FROM trips ORDER BY created_at DESC').all();
  const contractors = db.prepare('SELECT * FROM contractor_payments ORDER BY due_date ASC').all();
  const overtime = db.prepare('SELECT * FROM overtime ORDER BY created_at DESC').all();
  const employees = db.prepare("SELECT * FROM employees WHERE birthday IS NOT NULL ORDER BY birthday ASC").all();
  return NextResponse.json({ pto, trips, contractors, overtime, employees });
}

export async function POST(req: Request) {
  const db = getDb();
  const url = new URL(req.url);
  const tab = url.searchParams.get('tab') ?? 'insurance';
  const body = await req.json();

  if (tab === 'insurance') {
    const { carrier, invoiceType, amount, deadline, coveragePeriod, enrolledCount } = body;
    const id = cuid();
    db.prepare('INSERT INTO insurance_invoices (id,carrier,invoice_type,amount,deadline,coverage_period,enrolled_count) VALUES (?,?,?,?,?,?,?)')
      .run(id, carrier, invoiceType ?? null, amount, deadline, coveragePeriod ?? null, enrolledCount ?? null);
    return NextResponse.json({ invoice: db.prepare('SELECT * FROM insurance_invoices WHERE id=?').get(id) }, { status: 201 });
  }

  if (tab === 'reimbursements') {
    const { employee, purpose, amount, payoutDate } = body;
    const id = cuid();
    db.prepare('INSERT INTO reimbursements (id,employee,purpose,amount,payout_date) VALUES (?,?,?,?,?)')
      .run(id, employee, purpose, amount, payoutDate ?? null);
    return NextResponse.json({ row: db.prepare('SELECT * FROM reimbursements WHERE id=?').get(id) }, { status: 201 });
  }

  if (tab === 'cashout') {
    const { date, payee, category, amount, status } = body;
    const id = cuid();
    db.prepare('INSERT INTO cashout_ledger (id,date,payee,category,amount,status) VALUES (?,?,?,?,?,?)')
      .run(id, date, payee, category, amount, status ?? 'Pending');
    return NextResponse.json({ row: db.prepare('SELECT * FROM cashout_ledger WHERE id=?').get(id) }, { status: 201 });
  }

  return NextResponse.json({ error: 'Unknown tab' }, { status: 400 });
}

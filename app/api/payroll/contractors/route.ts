export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { sql, cuid } from '@/lib/db';

async function ensureTable() {
  await sql`CREATE TABLE IF NOT EXISTS contractor_payments (
    id text PRIMARY KEY,
    contractor text,
    amount text,
    pay_date text,
    method text DEFAULT 'ACH',
    status text DEFAULT 'Pending',
    notes text,
    created_at timestamptz DEFAULT now()
  )`;
  // Reconcile with any legacy schema (name/due_date/note columns, NOT NULL constraints)
  await sql`ALTER TABLE contractor_payments ADD COLUMN IF NOT EXISTS contractor text`;
  await sql`ALTER TABLE contractor_payments ADD COLUMN IF NOT EXISTS pay_date text`;
  await sql`ALTER TABLE contractor_payments ADD COLUMN IF NOT EXISTS method text`;
  await sql`ALTER TABLE contractor_payments ADD COLUMN IF NOT EXISTS status text`;
  await sql`ALTER TABLE contractor_payments ADD COLUMN IF NOT EXISTS notes text`;
  try { await sql`ALTER TABLE contractor_payments ALTER COLUMN name DROP NOT NULL`; } catch { /* no such column */ }
  try { await sql`ALTER TABLE contractor_payments ALTER COLUMN due_date DROP NOT NULL`; } catch { /* no such column */ }
  try { await sql`ALTER TABLE contractor_payments ALTER COLUMN amount DROP NOT NULL`; } catch { /* no such column */ }
  // Legacy amount was numeric — store as text so values like "1,706.66" save as entered
  try { await sql`ALTER TABLE contractor_payments ALTER COLUMN amount TYPE text USING amount::text`; } catch { /* already text */ }
}

export async function GET() {
  await ensureTable();
  const rows = await sql`SELECT * FROM contractor_payments ORDER BY pay_date DESC`;
  return NextResponse.json({ rows });
}

// Contractors paid on the 6th of each month
const SIXTH_OF_MONTH = ['Amy Nelson', 'Kelley Hess'];

export async function POST(req: Request) {
  await ensureTable();
  const body = await req.json();

  // Generate a recurring monthly contractor schedule for the next 6 months.
  // Rule: pay on the 6th, covering the WHOLE PREVIOUS month, run by the 2nd.
  if (body.action === 'generate') {
    const today = new Date(); today.setHours(12, 0, 0, 0);
    const iso = (d: Date) => d.toLocaleDateString('en-CA');
    const monthName = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const existing = await sql`SELECT contractor, pay_date FROM contractor_payments`;
    const seen = new Set((existing as any[]).map(r => `${r.contractor}|${r.pay_date}`));
    let created = 0;
    for (let i = 0; i < 6; i++) {
      const y = today.getFullYear(), m = today.getMonth() + i;
      const payDate = iso(new Date(y, m, 6));          // pay day: 6th
      const runBy = iso(new Date(y, m, 2));            // deadline to run: 2nd
      const coverage = monthName(new Date(y, m - 1, 1)); // covers previous whole month
      if (payDate < iso(today)) continue;
      const note = `Covers ${coverage} · run by ${runBy} · pay 6th`;
      for (const name of SIXTH_OF_MONTH) {
        if (seen.has(`${name}|${payDate}`)) continue;
        await sql`INSERT INTO contractor_payments (id, contractor, amount, pay_date, method, status, notes)
          VALUES (${cuid()}, ${name}, 'TBD', ${payDate}, 'ACH', 'Pending', ${note})`;
        created++;
      }
    }
    const rows = await sql`SELECT * FROM contractor_payments ORDER BY pay_date DESC`;
    return NextResponse.json({ rows, created });
  }

  const { contractor, amount, pay_date, method, notes } = body;
  if (!contractor || !amount || !pay_date) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  const id = cuid();
  try {
    await sql`INSERT INTO contractor_payments (id, contractor, amount, pay_date, method, status, notes)
      VALUES (${id}, ${contractor}, ${String(amount)}, ${pay_date}, ${method ?? 'ACH'}, 'Pending', ${notes ?? null})`;
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message ?? e) }, { status: 500 });
  }
  const [row] = await sql`SELECT * FROM contractor_payments WHERE id = ${id}`;
  return NextResponse.json({ row }, { status: 201 });
}

export async function PATCH(req: Request) {
  await ensureTable();
  const { id, status, contractor, amount, pay_date, method, notes } = await req.json();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  if (status) await sql`UPDATE contractor_payments SET status = ${status} WHERE id = ${id}`;
  if (contractor) await sql`UPDATE contractor_payments SET contractor = ${contractor} WHERE id = ${id}`;
  if (amount) await sql`UPDATE contractor_payments SET amount = ${amount} WHERE id = ${id}`;
  if (pay_date) await sql`UPDATE contractor_payments SET pay_date = ${pay_date} WHERE id = ${id}`;
  if (method) await sql`UPDATE contractor_payments SET method = ${method} WHERE id = ${id}`;
  if (notes !== undefined) await sql`UPDATE contractor_payments SET notes = ${notes} WHERE id = ${id}`;
  const [row] = await sql`SELECT * FROM contractor_payments WHERE id = ${id}`;
  return NextResponse.json({ row });
}

export async function DELETE(req: Request) {
  await ensureTable();
  const { id } = await req.json();
  await sql`DELETE FROM contractor_payments WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}

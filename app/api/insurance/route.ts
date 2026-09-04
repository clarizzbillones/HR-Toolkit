export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql, cuid } from '@/lib/db';
import { ensureInsurance, getInsuranceLocked, setInsuranceLocked } from '@/lib/insurance';

const auth = async () => !!(await getServerSession(authOptions))?.user;
const LOCKED = () => NextResponse.json({ error: 'The insurance list is locked. Unlock it first.' }, { status: 423 });

export async function GET() {
  if (!(await auth())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensureInsurance();
  const policies = await sql`SELECT * FROM insurance_policies ORDER BY sort_order ASC, created_at ASC`;
  const followups = await sql`SELECT * FROM insurance_followups ORDER BY sort_order ASC, created_at ASC`;
  const locked = await getInsuranceLocked();
  return NextResponse.json({ policies, followups, locked });
}

const POLICY_COLS = ['category', 'ins_type', 'carrier', 'policy_number', 'broker', 'broker_contact', 'contact_info', 'effective_date', 'renews', 'annual_premium', 'notes', 'sort_order'] as const;
const FOLLOWUP_COLS = ['kind', 'item', 'detail', 'sort_order'] as const;

export async function POST(req: Request) {
  if (!(await auth())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensureInsurance();
  const b = await req.json();
  if (await getInsuranceLocked()) return LOCKED();
  const id = cuid();
  if (b.type === 'followup') {
    await sql`INSERT INTO insurance_followups (id, kind, item, detail, sort_order) VALUES (${id}, ${b.kind ?? 'open'}, ${b.item ?? ''}, ${b.detail ?? ''}, ${b.sort_order ?? 999})`;
    const [row] = await sql`SELECT * FROM insurance_followups WHERE id = ${id}` as any[];
    return NextResponse.json({ row }, { status: 201 });
  }
  await sql`INSERT INTO insurance_policies (id, category, ins_type, carrier, policy_number, broker, broker_contact, contact_info, effective_date, renews, annual_premium, notes, sort_order)
    VALUES (${id}, ${b.category ?? ''}, ${b.ins_type ?? ''}, ${b.carrier ?? ''}, ${b.policy_number ?? ''}, ${b.broker ?? ''}, ${b.broker_contact ?? ''}, ${b.contact_info ?? ''}, ${b.effective_date ?? ''}, ${b.renews ?? ''}, ${b.annual_premium ?? ''}, ${b.notes ?? ''}, ${b.sort_order ?? 999})`;
  const [row] = await sql`SELECT * FROM insurance_policies WHERE id = ${id}` as any[];
  return NextResponse.json({ row }, { status: 201 });
}

export async function PATCH(req: Request) {
  if (!(await auth())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensureInsurance();
  const { id, type, locked, ...f } = await req.json();
  // Lock toggle is always allowed (it's the way out of a locked list).
  if (type === 'lock') { await setInsuranceLocked(!!locked); return NextResponse.json({ locked: !!locked }); }
  if (await getInsuranceLocked()) return LOCKED();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const table = type === 'followup' ? 'insurance_followups' : 'insurance_policies';
  const cols = type === 'followup' ? FOLLOWUP_COLS : POLICY_COLS;
  for (const c of cols) if (c in f) await sql`UPDATE ${sql(table)} SET ${sql(c)} = ${f[c] ?? ''} WHERE id = ${id}`;
  const [row] = await sql`SELECT * FROM ${sql(table)} WHERE id = ${id}` as any[];
  return NextResponse.json({ row });
}

export async function DELETE(req: Request) {
  if (!(await auth())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensureInsurance();
  if (await getInsuranceLocked()) return LOCKED();
  const u = new URL(req.url);
  const id = u.searchParams.get('id');
  const type = u.searchParams.get('type');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  if (type === 'followup') await sql`DELETE FROM insurance_followups WHERE id = ${id}`;
  else await sql`DELETE FROM insurance_policies WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}

export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { normName } from '@/lib/employeeFiles';
import { actualCost, DEFAULT_COST_SETTINGS, RETIREMENT_PLANS, US_STATES, LEDGER_LINES, LEDGER_COLUMNS, type CostSettings, type RetirementPlan, type Ledger } from '@/lib/actualCost';

// Actual (fully loaded) employee cost. Visible ONLY to the people in COST_VIEWERS (default:
// Clarizz and Catie) — stricter than HR admin, so portal admins don't see it. Everyone else gets
// 403 and never receives the numbers.
function costViewers(): string[] {
  return (process.env.COST_VIEWERS ?? 'clarizz@litson.co,catie@litson.co')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}
async function allowed() {
  const session = await getServerSession(authOptions);
  const email = (session?.user?.email ?? '').toLowerCase();
  return !!email && costViewers().includes(email);
}

async function ensure() {
  await sql`CREATE TABLE IF NOT EXISTS staff_costs (
    staff_id TEXT PRIMARY KEY,
    updated_by TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`ALTER TABLE staff_costs ADD COLUMN IF NOT EXISTS retirement_plan TEXT`;
  await sql`ALTER TABLE staff_costs ADD COLUMN IF NOT EXISTS work_state TEXT`;
  await sql`ALTER TABLE staff_costs ADD COLUMN IF NOT EXISTS work_state2 TEXT`; // second SUI state (moved mid-year) // state for unemployment (SUI); null = Tennessee
  await sql`ALTER TABLE staff_costs ADD COLUMN IF NOT EXISTS ledger TEXT`; // typed-in amounts (JSON)
  await sql`CREATE TABLE IF NOT EXISTS app_settings (id TEXT PRIMARY KEY)`;
  await sql`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS cost_settings TEXT`;
  await sql`INSERT INTO app_settings (id) VALUES ('singleton') ON CONFLICT (id) DO NOTHING`;
}

async function loadSettings(): Promise<CostSettings> {
  const [row] = await sql`SELECT cost_settings FROM app_settings WHERE id = 'singleton'` as any[];
  try { const o = JSON.parse(row?.cost_settings ?? '{}') || {}; return { year: Number(o.year) || DEFAULT_COST_SETTINGS.year }; }
  catch { return { ...DEFAULT_COST_SETTINGS }; }
}

const num = (v: any) => (v === null || v === undefined || v === '' ? null : Number(String(v).replace(/[$,\s]/g, '')));
function parseJson(raw: any): any {
  try { const o = typeof raw === 'string' ? JSON.parse(raw) : raw; return o && typeof o === 'object' ? o : null; } catch { return null; }
}

async function rowsWithCost(name?: string | null) {
  const staff = await sql`SELECT id, name, worker_type, position, salary, offboarded FROM staff_directory ORDER BY name ASC` as any[];
  const inputs = await sql`SELECT staff_id, retirement_plan, work_state, work_state2, ledger FROM staff_costs` as any[];
  const byId = new Map(inputs.map(i => [i.staff_id, i]));
  const key = name ? normName(name) : null;
  return staff
    .filter(s => (key ? normName(s.name) === key : true))
    .map(s => {
      const i = byId.get(s.id);
      const inp = { retirementPlan: (i?.retirement_plan as RetirementPlan) ?? null, workState: (i?.work_state as string) ?? null, workState2: (i?.work_state2 as string) ?? null, ledger: parseJson(i?.ledger) as Ledger | null };
      return { id: s.id, name: s.name, worker_type: s.worker_type, position: s.position, offboarded: !!s.offboarded, inputs: inp, cost: actualCost(s, inp) };
    });
}

// GET: settings + every person's cost (or one person with ?name=).
export async function GET(req: Request) {
  if (!(await allowed())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  return NextResponse.json({ settings: await loadSettings(), rows: await rowsWithCost(new URL(req.url).searchParams.get('name')) });
}

// PUT: the year shown.
export async function PUT(req: Request) {
  if (!(await allowed())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const body = await req.json().catch(() => ({}));
  const year = Math.round(Number(body.year));
  if (!Number.isFinite(year) || year < 2000 || year > 2100) return NextResponse.json({ error: 'Enter a valid year.' }, { status: 400 });
  const next: CostSettings = { year };
  await sql`UPDATE app_settings SET cost_settings = ${JSON.stringify(next)} WHERE id = 'singleton'`;
  return NextResponse.json({ settings: next, rows: await rowsWithCost() });
}

// PATCH: one person's retirement plan and typed-in amounts.
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!(await allowed())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const b = await req.json().catch(() => ({}));
  const id = String(b.staff_id ?? '');
  if (!id) return NextResponse.json({ error: 'Missing staff_id' }, { status: 400 });
  const workState = US_STATES.some(([c]) => c === b.work_state) ? String(b.work_state) : null;
  const workState2 = US_STATES.some(([c]) => c === b.work_state2) ? String(b.work_state2) : null;
  const plan = RETIREMENT_PLANS.some(p => p.key === b.retirement_plan) ? String(b.retirement_plan) : null;
  // Keep only known lines and columns, numbers ≥ 0.
  const ledger: Ledger = {};
  const checks = num(b.ledger?.checks);
  if (checks != null) { if (!Number.isFinite(checks) || checks < 0) return NextResponse.json({ error: 'Paychecks must be zero or more.' }, { status: 400 }); ledger.checks = Math.round(checks); }
  for (const c of LEDGER_COLUMNS) for (const line of LEDGER_LINES) {
    const n = num(b.ledger?.[c]?.[line.key]);
    if (n == null) continue;
    if (!Number.isFinite(n) || n < 0) return NextResponse.json({ error: 'Amounts must be zero or more.' }, { status: 400 });
    (ledger[c] ??= {})[line.key] = Math.round(n * 100) / 100;
  }
  await sql`INSERT INTO staff_costs (staff_id, retirement_plan, work_state, work_state2, ledger, updated_by, updated_at)
    VALUES (${id}, ${plan}, ${workState}, ${workState2}, ${JSON.stringify(ledger)}, ${session?.user?.email ?? null}, NOW())
    ON CONFLICT (staff_id) DO UPDATE SET retirement_plan = EXCLUDED.retirement_plan, work_state = EXCLUDED.work_state, work_state2 = EXCLUDED.work_state2, ledger = EXCLUDED.ledger,
      updated_by = EXCLUDED.updated_by, updated_at = NOW()`;
  const [row] = (await rowsWithCost()).filter(r => r.id === id);
  return NextResponse.json({ row });
}

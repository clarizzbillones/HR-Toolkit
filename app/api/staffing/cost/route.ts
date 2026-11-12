export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { normName } from '@/lib/employeeFiles';
import { actualCost, DEFAULT_COST_SETTINGS, RETIREMENT_PLANS, type CostSettings, type CostInputs, type RetirementPlan } from '@/lib/actualCost';

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
    insurance_monthly NUMERIC,
    match_401k_pct NUMERIC,
    other_annual NUMERIC,
    updated_by TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS app_settings (id TEXT PRIMARY KEY)`;
  await sql`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS cost_settings TEXT`;
  await sql`INSERT INTO app_settings (id) VALUES ('singleton') ON CONFLICT (id) DO NOTHING`;
  await sql`ALTER TABLE staff_directory ADD COLUMN IF NOT EXISTS offboarded_date TEXT`;
  await sql`ALTER TABLE staff_costs ADD COLUMN IF NOT EXISTS medical_monthly NUMERIC`;
  await sql`ALTER TABLE staff_costs ADD COLUMN IF NOT EXISTS dental_monthly NUMERIC`;
  await sql`ALTER TABLE staff_costs ADD COLUMN IF NOT EXISTS vision_monthly NUMERIC`;
  await sql`ALTER TABLE staff_costs ADD COLUMN IF NOT EXISTS retirement_plan TEXT`;
  await sql`ALTER TABLE staff_costs ADD COLUMN IF NOT EXISTS catchup_annual NUMERIC`;
}

async function loadSettings(): Promise<CostSettings> {
  const [row] = await sql`SELECT cost_settings FROM app_settings WHERE id = 'singleton'` as any[];
  try { return { ...DEFAULT_COST_SETTINGS, ...(JSON.parse(row?.cost_settings ?? '{}') || {}) }; }
  catch { return { ...DEFAULT_COST_SETTINGS }; }
}

const num = (v: any) => (v === null || v === undefined || v === '' ? null : Number(v));

async function rowsWithCost(settings: CostSettings, name?: string | null) {
  const staff = await sql`SELECT id, name, worker_type, position, salary, start_date, offboarded, offboarded_date FROM staff_directory ORDER BY name ASC` as any[];
  const inputs = await sql`SELECT staff_id, medical_monthly, dental_monthly, vision_monthly, retirement_plan, match_401k_pct, catchup_annual, other_annual FROM staff_costs` as any[];
  const byId = new Map(inputs.map(i => [i.staff_id, i]));
  const key = name ? normName(name) : null;
  return staff
    .filter(s => (key ? normName(s.name) === key : true))
    .map(s => {
      const i = byId.get(s.id);
      const inp: CostInputs = { medicalMonthly: num(i?.medical_monthly), dentalMonthly: num(i?.dental_monthly), visionMonthly: num(i?.vision_monthly),
        retirementPlan: (i?.retirement_plan as RetirementPlan) ?? null, match401kPct: num(i?.match_401k_pct), catchupAnnual: num(i?.catchup_annual), otherAnnual: num(i?.other_annual) };
      return { id: s.id, name: s.name, worker_type: s.worker_type, position: s.position, offboarded: !!s.offboarded, inputs: inp, cost: actualCost(s, inp, settings) };
    });
}

// GET: settings + every person's cost (or one person with ?name=).
export async function GET(req: Request) {
  if (!(await allowed())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const settings = await loadSettings();
  const rows = await rowsWithCost(settings, new URL(req.url).searchParams.get('name'));
  return NextResponse.json({ settings, rows });
}

// PUT: firm-wide rates (tax rates, wage bases, 401(k) %, other %, hours per year, year).
export async function PUT(req: Request) {
  if (!(await allowed())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const body = await req.json().catch(() => ({}));
  const current = await loadSettings();
  const next: CostSettings = { ...current };
  for (const k of Object.keys(DEFAULT_COST_SETTINGS) as (keyof CostSettings)[]) {
    if (k in body) {
      const n = Number(body[k]);
      if (!Number.isFinite(n) || n < 0) return NextResponse.json({ error: `Enter a valid number for ${k}.` }, { status: 400 });
      (next as any)[k] = k === 'year' ? Math.round(n) : n;
    }
  }
  await sql`UPDATE app_settings SET cost_settings = ${JSON.stringify(next)} WHERE id = 'singleton'`;
  return NextResponse.json({ settings: next, rows: await rowsWithCost(next) });
}

// PATCH: one person's inputs (firm's monthly medical, dental and vision share, 401(k) % override, other yearly cost).
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!(await allowed())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensure();
  const b = await req.json().catch(() => ({}));
  const id = String(b.staff_id ?? '');
  if (!id) return NextResponse.json({ error: 'Missing staff_id' }, { status: 400 });
  const vals = { medical_monthly: num(b.medical_monthly), dental_monthly: num(b.dental_monthly), vision_monthly: num(b.vision_monthly),
    match_401k_pct: num(b.match_401k_pct), catchup_annual: num(b.catchup_annual), other_annual: num(b.other_annual) };
  const plan = RETIREMENT_PLANS.some(p => p.key === b.retirement_plan) ? String(b.retirement_plan) : null;
  if (Object.values(vals).some(v => v != null && (!Number.isFinite(v) || v < 0))) return NextResponse.json({ error: 'Amounts must be zero or more.' }, { status: 400 });
  await sql`INSERT INTO staff_costs (staff_id, medical_monthly, dental_monthly, vision_monthly, retirement_plan, match_401k_pct, catchup_annual, other_annual, updated_by, updated_at)
    VALUES (${id}, ${vals.medical_monthly}, ${vals.dental_monthly}, ${vals.vision_monthly}, ${plan}, ${vals.match_401k_pct}, ${vals.catchup_annual}, ${vals.other_annual}, ${session?.user?.email ?? null}, NOW())
    ON CONFLICT (staff_id) DO UPDATE SET medical_monthly = EXCLUDED.medical_monthly, dental_monthly = EXCLUDED.dental_monthly,
      vision_monthly = EXCLUDED.vision_monthly, retirement_plan = EXCLUDED.retirement_plan, match_401k_pct = EXCLUDED.match_401k_pct,
      catchup_annual = EXCLUDED.catchup_annual,
      other_annual = EXCLUDED.other_annual, updated_by = EXCLUDED.updated_by, updated_at = NOW()`;
  const settings = await loadSettings();
  const [row] = (await rowsWithCost(settings)).filter(r => r.id === id);
  return NextResponse.json({ row });
}

export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { sql, cuid } from '@/lib/db';

async function ensureTable() {
  await sql`CREATE TABLE IF NOT EXISTS onboarding_items (
    id text PRIMARY KEY,
    kind text NOT NULL DEFAULT 'section',
    title text,
    body text,
    done boolean DEFAULT false,
    sort_order int DEFAULT 0,
    created_at timestamptz DEFAULT now()
  )`;
}

// Sensible starter content for a law-firm new-hire guide (fully editable in the UI)
const DEFAULT_SECTIONS: { title: string; body: string }[] = [
  { title: 'Welcome to LITSON', body: `We're thrilled to have you on the team. This guide walks you through everything you need for a smooth first few weeks — what to expect, who to reach out to, and how we work.\n\nTake your time, and don't hesitate to ask questions. We're here to help you succeed.` },
  { title: 'Before Your First Day', body: `• Complete and return your new-hire paperwork (offer letter, I-9, W-4, direct deposit).\n• Send a photo of your government ID for building access and travel profiles.\n• Confirm your start date, work location, and arrival time with HR.\n• Let us know your t-shirt size and any dietary restrictions for team events.` },
  { title: 'Your First Day', body: `• Arrive at 9:00 AM — ask for HR at the front desk.\n• Office tour, workstation setup, and building/parking access.\n• Account setup: email, Dialpad, and any case-management tools.\n• Lunch with your team.\n• Review this guide and the employee handbook.` },
  { title: 'Your First Week', body: `• 1:1 with your manager to review your role, goals, and expectations.\n• Meet your team and key points of contact.\n• Shadow ongoing matters relevant to your role.\n• Set up travel profiles (Delta, Marriott, Southwest, American, KTN).\n• Confirm payroll and benefits enrollment.` },
  { title: 'Tools & Accounts', body: `• Email (Microsoft 365) — your primary inbox and calendar.\n• Dialpad — phone and messaging.\n• Case / matter management — access provided on day one.\n• Trip Help Desk — submit travel requests here.\n• Ask HR if you're missing access to anything.` },
  { title: 'Key Contacts', body: `• HR — questions about payroll, benefits, PTO, and policies.\n• Your Manager — day-to-day work, priorities, and approvals.\n• IT / Accounts — logins, hardware, and software access.\n• Office Manager — supplies, building, and facilities.` },
  { title: 'Policies & Benefits', body: `• PTO: request time off through HR; it appears on the shared calendar.\n• Health, dental, and vision benefits — enrollment details from HR.\n• 401(k) / retirement contributions.\n• Reimbursements: submit receipts for approved business expenses.\n• Review the full employee handbook for details.` },
  { title: 'Helpful Resources', body: `• Employee handbook (ask HR for the latest copy).\n• Org chart and team directory.\n• Travel booking and expense guidelines.\n• This onboarding guide — bookmark it and revisit anytime.` },
];

const DEFAULT_TASKS = [
  'Sign and return offer letter',
  'Complete I-9 and W-4',
  'Set up direct deposit',
  'Provide government ID photo',
  'Email account created',
  'Dialpad account created',
  'Case/matter system access granted',
  'Building & parking access',
  'Add to team calendar & directory',
  'Benefits enrollment completed',
  'Travel profiles set up (Delta/Marriott/Southwest/American/KTN)',
  '1:1 with manager scheduled',
];

async function seedIfEmpty() {
  const [{ n }] = await sql`SELECT COUNT(*)::int as n FROM onboarding_items`;
  if (n > 0) return;
  let i = 0;
  for (const s of DEFAULT_SECTIONS) {
    await sql`INSERT INTO onboarding_items (id, kind, title, body, sort_order) VALUES (${cuid()}, 'section', ${s.title}, ${s.body}, ${i++})`;
  }
  let j = 0;
  for (const t of DEFAULT_TASKS) {
    await sql`INSERT INTO onboarding_items (id, kind, title, body, sort_order) VALUES (${cuid()}, 'task', ${t}, null, ${j++})`;
  }
}

export async function GET() {
  await ensureTable();
  await seedIfEmpty();
  const items = await sql`SELECT * FROM onboarding_items ORDER BY kind DESC, sort_order ASC`;
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  await ensureTable();
  const body = await req.json();
  const kind = body.kind === 'task' ? 'task' : 'section';
  const [{ mx }] = await sql`SELECT COALESCE(MAX(sort_order), -1)::int as mx FROM onboarding_items WHERE kind = ${kind}`;
  const id = cuid();
  await sql`INSERT INTO onboarding_items (id, kind, title, body, sort_order)
    VALUES (${id}, ${kind}, ${body.title ?? ''}, ${body.body ?? null}, ${(mx ?? -1) + 1})`;
  const [item] = await sql`SELECT * FROM onboarding_items WHERE id = ${id}`;
  return NextResponse.json({ item }, { status: 201 });
}

export async function PATCH(req: Request) {
  await ensureTable();
  const { id, title, body, done } = await req.json();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  if (title !== undefined) await sql`UPDATE onboarding_items SET title = ${title} WHERE id = ${id}`;
  if (body !== undefined) await sql`UPDATE onboarding_items SET body = ${body} WHERE id = ${id}`;
  if (done !== undefined) await sql`UPDATE onboarding_items SET done = ${done} WHERE id = ${id}`;
  const [item] = await sql`SELECT * FROM onboarding_items WHERE id = ${id}`;
  return NextResponse.json({ item });
}

export async function DELETE(req: Request) {
  await ensureTable();
  const { id } = await req.json();
  await sql`DELETE FROM onboarding_items WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}

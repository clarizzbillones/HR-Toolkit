export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { parseDoc, DOC_SECTIONS } from '@/lib/offboardingDoc';
import { notifyAssignees, type NotifyGroup } from '@/lib/assigneeNotify';

const cellDone = (c: any) => !!(c && String(c.initial ?? '').trim() && String(c.date ?? '').trim());
const origin = (req: Request) => process.env.NEXTAUTH_URL || `${req.headers.get('x-forwarded-proto') ?? 'https'}://${req.headers.get('host')}`;

// Email each assignee the incomplete offboarding-document tasks assigned to them.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const [row] = await sql`SELECT name, doc FROM offboarding WHERE id = ${id}` as any[];
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const doc = parseDoc(row.doc);
  const rows: { label: string; cell: any }[] = [];
  for (const s of DOC_SECTIONS) for (const it of s.items) rows.push({ label: it.label, cell: doc.items[it.id] });
  for (const a of doc.accounts) rows.push({ label: a.label, cell: a.cell });
  const byAssignee = new Map<string, { label: string; deadline?: string }[]>();
  for (const r of rows) {
    const a = String(r.cell?.assignee ?? '').trim();
    if (!a || cellDone(r.cell)) continue;
    if (!byAssignee.has(a)) byAssignee.set(a, []);
    byAssignee.get(a)!.push({ label: r.label });
  }
  const groups: NotifyGroup[] = [...byAssignee.entries()].map(([assignee, tasks]) => ({ assignee, tasks }));
  if (!groups.length) return NextResponse.json({ sent: [], skipped: [], message: 'No open assigned tasks to notify.' });
  const { sent, skipped } = await notifyAssignees({ employeeName: row.name, kindLabel: 'Offboarding', groups, appUrl: origin(req) });
  return NextResponse.json({ sent, skipped });
}

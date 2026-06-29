export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { status, note } = await req.json();
  const [task] = await sql`SELECT * FROM tasks WHERE id = ${params.id}`;
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (status) {
    const history = JSON.parse(task.status_history || '[]');
    history.push({ status, timestamp: new Date().toISOString() });
    await sql`UPDATE tasks SET status = ${status}, status_history = ${JSON.stringify(history)} WHERE id = ${params.id}`;
  }

  if (note) {
    const notes = JSON.parse(task.notes || '[]');
    notes.push({ date: new Date().toLocaleDateString('en-US'), text: note });
    await sql`UPDATE tasks SET notes = ${JSON.stringify(notes)} WHERE id = ${params.id}`;
  }

  const [updated] = await sql`SELECT * FROM tasks WHERE id = ${params.id}`;
  return NextResponse.json({ task: updated });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  await sql`DELETE FROM tasks WHERE id = ${params.id}`;
  return NextResponse.json({ ok: true });
}

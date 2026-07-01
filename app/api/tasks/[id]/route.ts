export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { status, note, due_tag } = await req.json();
  const [task] = await sql`SELECT * FROM tasks WHERE id = ${params.id}`;
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (status) {
    const history = JSON.parse(task.status_history || '[]');
    history.push({ status, timestamp: new Date().toISOString() });
    if (status === 'done' || status === 'archived') {
      const completedDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
      await sql`UPDATE tasks SET status = ${status}, status_history = ${JSON.stringify(history)}, completed_date = ${completedDate} WHERE id = ${params.id}`;
    } else {
      await sql`UPDATE tasks SET status = ${status}, status_history = ${JSON.stringify(history)}, completed_date = NULL WHERE id = ${params.id}`;
    }
  }

  if (note) {
    const notes = JSON.parse(task.notes || '[]');
    notes.push({ date: new Date().toLocaleDateString('en-US'), text: note });
    await sql`UPDATE tasks SET notes = ${JSON.stringify(notes)} WHERE id = ${params.id}`;
  }

  if (due_tag !== undefined) {
    await sql`UPDATE tasks SET due_tag = ${due_tag || null} WHERE id = ${params.id}`;
  }

  const [updated] = await sql`SELECT * FROM tasks WHERE id = ${params.id}`;
  return NextResponse.json({ task: updated });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  await sql`DELETE FROM tasks WHERE id = ${params.id}`;
  return NextResponse.json({ ok: true });
}

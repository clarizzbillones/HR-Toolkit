import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const db = getDb();
  const { status, note } = await req.json();
  const task = db.prepare('SELECT * FROM tasks WHERE id=?').get(params.id) as any;
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (status) {
    const history = JSON.parse(task.status_history || '[]');
    history.push({ status, timestamp: new Date().toISOString() });
    db.prepare('UPDATE tasks SET status=?, status_history=? WHERE id=?').run(status, JSON.stringify(history), params.id);
  }

  if (note) {
    const notes = JSON.parse(task.notes || '[]');
    notes.push({ date: new Date().toLocaleDateString('en-US'), text: note });
    db.prepare('UPDATE tasks SET notes=? WHERE id=?').run(JSON.stringify(notes), params.id);
  }

  const updated = db.prepare('SELECT * FROM tasks WHERE id=?').get(params.id);
  return NextResponse.json({ task: updated });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const db = getDb();
  db.prepare('DELETE FROM tasks WHERE id=?').run(params.id);
  return NextResponse.json({ ok: true });
}

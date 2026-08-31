export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { status, note, noteEdit, noteDelete, due_tag, title, urgent } = await req.json();
  const [task] = await sql`SELECT * FROM tasks WHERE id = ${params.id}`;
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (urgent !== undefined) {
    await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS urgent BOOLEAN DEFAULT false`;
    await sql`UPDATE tasks SET urgent = ${!!urgent} WHERE id = ${params.id}`;
  }

  if (title !== undefined && String(title).trim()) await sql`UPDATE tasks SET title = ${String(title).trim()} WHERE id = ${params.id}`;

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
    // `date` (date-only) kept for older notes; `ts` is the full timestamp so
    // the EOD report and note list can show the time a note was added.
    notes.push({ date: new Date().toLocaleDateString('en-US'), ts: new Date().toISOString(), text: note });
    await sql`UPDATE tasks SET notes = ${JSON.stringify(notes)} WHERE id = ${params.id}`;
  }

  // Edit an existing note's text by index (keeps its original date; stamps an
  // edited time so the UI can show "(edited)").
  if (noteEdit && typeof noteEdit.index === 'number') {
    const notes = JSON.parse(task.notes || '[]');
    if (noteEdit.index >= 0 && noteEdit.index < notes.length) {
      const text = String(noteEdit.text ?? '').trim();
      if (text) {
        notes[noteEdit.index] = { ...notes[noteEdit.index], text, edited_ts: new Date().toISOString() };
        await sql`UPDATE tasks SET notes = ${JSON.stringify(notes)} WHERE id = ${params.id}`;
      }
    }
  }

  // Delete a note by index.
  if (noteDelete !== undefined && noteDelete !== null) {
    const notes = JSON.parse(task.notes || '[]');
    const idx = Number(noteDelete);
    if (Number.isInteger(idx) && idx >= 0 && idx < notes.length) {
      notes.splice(idx, 1);
      await sql`UPDATE tasks SET notes = ${JSON.stringify(notes)} WHERE id = ${params.id}`;
    }
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

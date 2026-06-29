import { NextResponse } from 'next/server';
import { getDb, cuid } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const tasks = db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all();
  return NextResponse.json({ tasks });
}

export async function POST(req: Request) {
  const db = getDb();
  const { title, sub, dueTag } = await req.json();
  if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 });
  const id = cuid();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO tasks (id,title,sub,due_tag,status,status_history,notes) VALUES (?,?,?,?,?,?,?)'
  ).run(id, title.trim(), sub ?? null, dueTag ?? null, 'todo', JSON.stringify([{ status: 'todo', timestamp: now }]), '[]');
  const task = db.prepare('SELECT * FROM tasks WHERE id=?').get(id);
  return NextResponse.json({ task }, { status: 201 });
}

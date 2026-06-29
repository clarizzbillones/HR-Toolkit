import { NextResponse } from 'next/server';
import { sql, cuid } from '@/lib/db';

export async function GET() {
  const tasks = await sql`SELECT * FROM tasks ORDER BY created_at DESC`;
  return NextResponse.json({ tasks });
}

export async function POST(req: Request) {
  const { title, sub, dueTag } = await req.json();
  if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 });
  const id = cuid();
  const now = new Date().toISOString();
  await sql`INSERT INTO tasks (id,title,sub,due_tag,status,status_history,notes) VALUES (${id},${title.trim()},${sub ?? null},${dueTag ?? null},'todo',${JSON.stringify([{ status: 'todo', timestamp: now }])},'[]')`;
  const [task] = await sql`SELECT * FROM tasks WHERE id = ${id}`;
  return NextResponse.json({ task }, { status: 201 });
}

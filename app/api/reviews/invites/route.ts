export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { listInvites, setInviteCompleted, deleteInvite } from '@/lib/inviteReminders';

// List tracked review invites (participants) for the reminders manager.
export async function GET() {
  const rows = await listInvites();
  return NextResponse.json({ rows });
}

// Toggle a participant's completed state (completed = reminders stop).
export async function PATCH(req: Request) {
  const { id, completed } = await req.json();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  await setInviteCompleted(id, !!completed);
  return NextResponse.json({ ok: true });
}

// Remove a tracked invite entirely.
export async function DELETE(req: Request) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  await deleteInvite(id);
  return NextResponse.json({ ok: true });
}

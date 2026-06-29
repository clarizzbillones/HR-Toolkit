import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendMail } from '@/lib/graph';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const { notes } = await req.json();
  const accessToken = (session as any)?.accessToken as string | undefined;

  if (!accessToken) {
    return NextResponse.json({ message: 'Email would be sent (connect Microsoft 365 first)' });
  }

  const subject = `End-of-Day HR Report — ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
  const body = `<p>Hi Catie & Ryan,</p><p>Here is today's HR summary.</p>${notes ? `<p><b>Notes:</b> ${notes}</p>` : ''}<p>— Renee</p>`;

  await sendMail(accessToken, 'catie@litson.com', subject, body);
  return NextResponse.json({ message: 'Report sent to partners' });
}

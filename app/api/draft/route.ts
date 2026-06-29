import { NextResponse } from 'next/server';
import { generateDraft } from '@/lib/ai';
import { getDb } from '@/lib/db';

export async function POST(req: Request) {
  const body = await req.json();
  const { kind, ...params } = body;

  const db = getDb();
  const settings = db.prepare('SELECT * FROM app_settings WHERE id="singleton"').get() as any;
  const firm = settings?.firm_name ?? 'Litson';
  const cadence = settings?.payroll_cadence ?? 'Semi-monthly';

  try {
    if (kind === 'offer') {
      const text = await generateDraft('offer', { ...params, firm, cadence });
      return NextResponse.json({ text });
    }
    if (kind === 'sop') {
      const text = await generateDraft('sop', { ...params, firm });
      return NextResponse.json({ text });
    }
    return NextResponse.json({ error: 'Unknown kind' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

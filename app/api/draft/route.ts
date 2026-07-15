export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { generateDraft } from '@/lib/ai';
import { sql } from '@/lib/db';

export async function POST(req: Request) {
  const body = await req.json();
  const { kind, ...params } = body;
  const [settings] = await sql`SELECT * FROM app_settings WHERE id = 'singleton'`;
  const firm = settings?.firm_name ?? 'Litson';
  const cadence = settings?.payroll_cadence ?? 'Semi-monthly';
  try {
    if (kind === 'offer') {
      const text = await generateDraft('offer', {
        employeeType: params.employeeType ?? 'employee',
        name: params.name ?? '',
        email: params.email ?? '',
        role: params.role ?? '',
        dept: params.dept ?? '',
        salary: params.salary ?? '',
        startDate: params.startDate ?? '',
        location: params.location ?? '',
        notes: params.notes ?? '',
        firm,
        cadence,
        rateBasis: params.rateBasis === 'hourly' ? 'hourly' : 'monthly',
        payBasis: ['monthly', 'weekly', 'biweekly'].includes(params.payBasis) ? params.payBasis : 'monthly',
        salutationTitle: params.salutationTitle ?? '',
      });
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

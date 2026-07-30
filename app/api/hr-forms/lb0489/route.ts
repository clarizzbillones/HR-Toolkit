export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';

// Fill the OFFICIAL Tennessee LB-0489 PDF (kept at /public/forms/lb0489.pdf)
// with the submitted values, preserving the exact government layout.
export async function POST(req: Request) {
  const b = await req.json();
  const origin = process.env.NEXTAUTH_URL || new URL(req.url).origin;
  let bytes: ArrayBuffer;
  try {
    const res = await fetch(`${origin}/forms/lb0489.pdf`);
    if (!res.ok) throw new Error(String(res.status));
    bytes = await res.arrayBuffer();
  } catch {
    return NextResponse.json({ error: 'Could not load the LB-0489 template.' }, { status: 500 });
  }

  const doc = await PDFDocument.load(bytes);
  const form = doc.getForm();
  const setText = (name: string, val: any) => { try { form.getTextField(name).setText(String(val ?? '')); } catch { /* field missing */ } };
  const setRadio = (name: string, val: string) => { if (!val) return; try { form.getRadioGroup(name).select(val); } catch { /* option missing */ } };

  setText('name.employee', b.name);
  setText('ssn.employee', b.ssn);
  setText('date.empfrom', b.empFrom);
  setText('date.empto', b.empTo);
  setText('occupation.employee', b.occupation);
  setText('location.worked.performed', b.location);
  setText('explain', b.explain);
  setText('EmpName', b.employerName || 'Litson PLLC');
  setText('Emp.Address', b.employerAddress || '54 Music Square E Ste 300, Nashville, TN 37203');
  setText('Emp.EMail', b.employerEmail);
  setText('EMP.telephone', b.employerPhone || '(615) 985-8205');
  setText('accountnumber.employer', b.accountNumber);
  setText('title.employer', b.signerTitle);
  setText('Completed', b.dateCompleted);
  setText('pay', b.item6Amount);
  setText('from.date', b.item6From);
  setText('to.date', b.item6To);
  setText('RecallDate', b.recallDate);
  setText('WeekEndingDate', b.weekEnding);
  setText('VacationPay', b.vacationPay);

  if (b.reason === 'Lack of Work') setRadio('RadioButton1', 'Lack of Work');
  if (b.reason === 'Discharge') setRadio('RadioButton2', 'Discharge');
  if (b.reason === 'Quit') setRadio('RadioButton3', 'Quit');
  if (b.layoff === 'Permanent') setRadio('RadioButton4', 'Permanent');
  if (b.layoff === 'Temporary') setRadio('RadioButton5', 'Temporary');
  if (b.received === 'Wages in Lieu of Notice') setRadio('RadioButton6', 'Wages in Lieu of Notice');
  if (b.received === 'Severance Pay') setRadio('RadioButton7', 'Severance Pay');

  try { form.updateFieldAppearances(); } catch { /* ignore */ }
  const out = await doc.save();
  const name = String(b.name ?? 'form').replace(/[^\w]+/g, '-');
  return new NextResponse(Buffer.from(out), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="LB-0489-${name}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

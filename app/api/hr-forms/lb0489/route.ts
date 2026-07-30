export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { readFile } from 'fs/promises';
import path from 'path';

// Load the official template from the filesystem first (reliable on Vercel),
// falling back to an HTTP fetch of the public asset.
async function loadTemplate(req: Request): Promise<Buffer> {
  for (const p of [path.join(process.cwd(), 'public', 'forms', 'lb0489.pdf'), path.join(process.cwd(), 'public/forms/lb0489.pdf')]) {
    try { return await readFile(p); } catch { /* try next */ }
  }
  const origin = process.env.NEXTAUTH_URL || new URL(req.url).origin;
  const res = await fetch(`${origin}/forms/lb0489.pdf`);
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  const ct = res.headers.get('content-type') || '';
  if (!/pdf|octet-stream/i.test(ct)) throw new Error(`unexpected content-type ${ct}`);
  return Buffer.from(await res.arrayBuffer());
}

// Fill the OFFICIAL Tennessee LB-0489 PDF (kept at /public/forms/lb0489.pdf)
// with the submitted values, preserving the exact government layout.
export async function POST(req: Request) {
  const b = await req.json();
  let bytes: Buffer;
  try {
    bytes = await loadTemplate(req);
  } catch (e) {
    return NextResponse.json({ error: `Could not load the LB-0489 template (${String(e).slice(0, 80)}).` }, { status: 500 });
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

  // Stamp a signature image (drawn or typed) onto the signature line, page 2.
  if (typeof b.signatureImage === 'string' && b.signatureImage.startsWith('data:image')) {
    try {
      const b64 = b.signatureImage.split(',')[1] ?? '';
      const png = await doc.embedPng(Buffer.from(b64, 'base64'));
      const page = doc.getPages()[1]; // the signature field sits on the 2nd page
      if (page) {
        const maxW = 190;
        const w = Math.min(maxW, png.width);
        const h = Math.min((png.height / png.width) * w, 38);
        page.drawImage(png, { x: 50, y: 137, width: w, height: h });
      }
    } catch { /* skip signature if it can't be embedded */ }
  }

  try { form.updateFieldAppearances(); } catch { /* ignore */ }
  // Flatten so the downloaded copy is final and not editable outside the toolkit.
  try { form.flatten(); } catch { /* some viewers/fields may not flatten */ }
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

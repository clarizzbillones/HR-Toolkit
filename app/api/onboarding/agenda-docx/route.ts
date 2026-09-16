export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import JSZip from 'jszip';
import { AGENDA_TEMPLATE_B64 } from '@/lib/agendaTemplateB64';

// Fill the firm's master onboarding-call-agendas .docx with the new hire's name
// and start date, and return it — so the Word download is byte-for-byte the
// firm's own format.
const xmlEsc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const u = new URL(req.url);
  const name = (u.searchParams.get('name') ?? '').trim();
  const date = (u.searchParams.get('date') ?? '').trim();

  const zip = await JSZip.loadAsync(Buffer.from(AGENDA_TEMPLATE_B64, 'base64'));
  const docXmlFile = zip.file('word/document.xml');
  if (!docXmlFile) return NextResponse.json({ error: 'Template missing document.xml' }, { status: 500 });
  let xml = await docXmlFile.async('string');

  // Leave the bracketed placeholder when a field is blank, so the doc still
  // reads clearly and shows where to fill in.
  xml = xml.replace(/\[New hire name\]/g, name ? xmlEsc(name) : '[New hire name]');
  xml = xml.replace(/\[START DATE\]/g, date ? xmlEsc(date) : '[Start date]');

  zip.file('word/document.xml', xml);
  const out = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

  const safe = (name || 'template').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-');
  return new NextResponse(out, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="Litson-Onboarding-Call-Agendas-${safe}.docx"`,
      'Cache-Control': 'no-store',
    },
  });
}

export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { sendMailAsApp } from '@/lib/graph';
import { ensureInsurance, renewalDate, daysUntilRenewal } from '@/lib/insurance';

const RECIPIENT = process.env.INSURANCE_REMINDER_EMAIL ?? 'clarizz@litson.co';
const SENDER = process.env.REVIEW_REMINDER_SENDER ?? RECIPIENT;
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
// Days-out marks that trigger an email so it isn't a daily nag.
const TARGET_DAYS = [60, 30, 14, 7, 3, 1];
const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function emailBody(rows: { p: any; days: number; date: Date }[], sample = false): string {
  const items = rows.map(({ p, days, date }, i) => {
    const chip = days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'due today' : `in ${days} days`;
    const color = days <= 30 ? '#b0412f' : '#b07d2a';
    const bg = i % 2 ? '#faf8f4' : '#ffffff';
    return `<tr>
      <td style="background:${bg};padding:9px 12px;border-bottom:1px solid #eee;font-weight:600;color:#1b2a3d">${esc(p.ins_type)}<div style="font-weight:400;color:#8a7f6d;font-size:12px">${esc(p.carrier)}</div></td>
      <td style="background:${bg};padding:9px 12px;border-bottom:1px solid #eee;color:#333;white-space:nowrap">${date ? esc(fmt(date)) : ''}</td>
      <td style="background:${bg};padding:9px 12px;border-bottom:1px solid #eee;white-space:nowrap"><span style="font-weight:700;color:${color}">${chip}</span></td>
      <td style="background:${bg};padding:9px 12px;border-bottom:1px solid #eee;color:#8a7f6d;font-size:12px">${esc(p.broker)}${p.broker_contact ? ` · ${esc(p.broker_contact)}` : ''}${p.contact_info ? `<br>${esc(p.contact_info)}` : ''}</td>
    </tr>`;
  }).join('');
  // Table-based, solid-color layout so Outlook renders the navy banner + gold
  // rule (it ignores CSS gradients and drops background on <div>).
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1ece3">
   <tr><td align="center" style="padding:22px 12px">
    <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;font-family:${SANS};color:#2a2a2a">
      <tr><td bgcolor="#1b2a3d" style="background:#1b2a3d;padding:16px 22px;border-radius:10px 10px 0 0">
        <div style="font-size:18px;font-weight:800;letter-spacing:.18em;color:#c9a24a">LITSON</div>
        <div style="font-size:10px;letter-spacing:.14em;color:#9fb0c4;margin-top:3px">PLLC &middot; HUMAN RESOURCES</div>
      </td></tr>
      <tr><td bgcolor="#c9a24a" style="background:#c9a24a;height:4px;line-height:4px;font-size:0">&nbsp;</td></tr>
      <tr><td style="background:#ffffff;border:1px solid #e6ddcd;border-top:0;border-radius:0 0 10px 10px;padding:22px">
        <div style="font-size:17px;font-weight:700;color:#1b2a3d;margin-bottom:12px">Insurance renewals coming up</div>
        <p style="margin:0 0 12px;font-size:14px;line-height:1.6">Hi Clarizz,</p>
        ${sample
          ? `<p style="margin:0 0 14px;font-size:13px;line-height:1.6;color:#8a7f6d">This is a <b>sample</b> of the renewal reminder — no policies are within 60 days right now. When one gets close, you'll get a note like this.</p>`
          : `<p style="margin:0 0 14px;font-size:14px;line-height:1.6">The following insurance ${rows.length === 1 ? 'policy is' : 'policies are'} coming up for renewal:</p>`}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px">
          <tr>${['Policy', 'Renews', 'Due', 'Broker'].map(h => `<td bgcolor="#1b2a3d" style="background:#1b2a3d;color:#ffffff;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.05em;padding:8px 12px">${h}</td>`).join('')}</tr>
          ${items}
        </table>
        <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#8a7f6d">Open the HR Toolkit → Insurance for full details. You'll get this note at 60, 30, 14, 7, 3 and 1 day before each renewal.</p>
      </td></tr>
      <tr><td align="center" style="padding:12px 4px;color:#8a7f6d;font-size:11px">Litson PLLC &middot; Human Resources</td></tr>
    </table>
   </td></tr>
  </table>`;
}

async function handle(req: Request) {
  await ensureInsurance();
  const u = new URL(req.url);
  const preview = u.searchParams.get('preview') === '1';
  const test = u.searchParams.get('test') === '1';
  const policies = await sql`SELECT * FROM insurance_policies` as any[];

  const within60 = policies
    .map(p => ({ p, days: daysUntilRenewal(p.renews), date: renewalDate(p.renews) }))
    .filter(x => x.days != null && x.date && x.days <= 60 && x.days >= -30)
    .sort((a, b) => (a.days! - b.days!)) as { p: any; days: number; date: Date }[];

  // Only actually send when at least one policy hits a threshold day (so it's
  // not a daily nag) — but preview/test always render/send.
  const atThreshold = within60.some(x => TARGET_DAYS.includes(x.days) || x.days < 0);
  const rows = within60;

  const SAMPLE = [{ p: { ins_type: 'Business Owners Policy (BOP)', carrier: 'Hiscox', broker: 'Cover My Assets', broker_contact: 'Katie Ellis' }, days: 30, date: new Date() }] as any;

  if (preview) {
    const isSample = rows.length === 0;
    return new NextResponse(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Insurance renewal reminder</title></head><body style="margin:0;background:#f1ece3;font-family:${SANS}">${emailBody(isSample ? SAMPLE : rows, isSample)}</body></html>`, { headers: { 'Content-Type': 'text/html' } });
  }

  if (!test && (!atThreshold || rows.length === 0)) {
    return NextResponse.json({ ok: true, sent: 0, message: 'No insurance renewals at a threshold day right now' });
  }
  const isSample = rows.length === 0; // test email with nothing actually due
  const subject = isSample
    ? 'Insurance renewal reminder (sample — nothing due yet)'
    : `Insurance renewals coming up — ${rows.length} ${rows.length === 1 ? 'policy' : 'policies'}`;
  const r: any = await sendMailAsApp(SENDER, RECIPIENT, subject, emailBody(isSample ? SAMPLE : rows, isSample));
  if (r?.error) return NextResponse.json({ error: r.error }, { status: 500 });
  return NextResponse.json({ ok: true, sent: rows.length, to: RECIPIENT });
}

export async function GET(req: Request) { return handle(req); }  // Vercel cron uses GET
export async function POST(req: Request) { return handle(req); } // manual test / preview

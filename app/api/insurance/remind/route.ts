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

function emailBody(rows: { p: any; days: number; date: Date }[]): string {
  const items = rows.map(({ p, days, date }) => {
    const chip = days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'due today' : `in ${days} days`;
    const color = days <= 30 ? '#b0412f' : '#b07d2a';
    return `<tr>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;font-weight:600;color:#1b2a3d">${esc(p.ins_type)}<div style="font-weight:400;color:#8a7f6d;font-size:12px">${esc(p.carrier)}</div></td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;color:#333;white-space:nowrap">${esc(fmt(date))}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;white-space:nowrap"><span style="font-weight:700;color:${color}">${chip}</span></td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;color:#8a7f6d;font-size:12px">${esc(p.broker)}${p.broker_contact ? ` · ${esc(p.broker_contact)}` : ''}${p.contact_info ? `<br>${esc(p.contact_info)}` : ''}</td>
    </tr>`;
  }).join('');
  return `<div style="font-family:${SANS};font-size:14px;line-height:1.6;color:#2a2a2a;max-width:640px">
    <div style="background:linear-gradient(120deg,#1b2a3d,#26405c);padding:16px 22px;border-bottom:4px solid #c9a24a;color:#fff;border-radius:10px 10px 0 0">
      <div style="font-size:16px;font-weight:800;letter-spacing:.15em">LITSON</div>
      <div style="font-size:10px;letter-spacing:.12em;color:#9fb0c4">PLLC · HUMAN RESOURCES</div>
    </div>
    <div style="border:1px solid #e6ddcd;border-top:0;border-radius:0 0 10px 10px;padding:20px 22px">
      <p style="margin:0 0 12px">Hi Clarizz,</p>
      <p style="margin:0 0 14px">The following insurance ${rows.length === 1 ? 'policy is' : 'policies are'} coming up for renewal:</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <tr style="text-align:left;color:#8a7f6d;font-size:11px;text-transform:uppercase;letter-spacing:.05em">
          <th style="padding:6px 10px">Policy</th><th style="padding:6px 10px">Renews</th><th style="padding:6px 10px">Due</th><th style="padding:6px 10px">Broker</th>
        </tr>
        ${items}
      </table>
      <p style="margin:16px 0 0;font-size:12px;color:#8a7f6d">Open the HR Toolkit → Insurance for full details. You'll get this note at 60, 30, 14, 7, 3 and 1 day before each renewal.</p>
    </div>
  </div>`;
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

  if (preview) {
    const sample = rows.length ? rows : [{ p: { ins_type: 'Business Owners Policy (BOP)', carrier: 'Hiscox', broker: 'Cover My Assets', broker_contact: 'Katie Ellis', contact_info: '615-345-0411' }, days: 30, date: new Date() }];
    return new NextResponse(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Insurance renewal reminder</title></head><body style="margin:0;background:#f1ece3;padding:24px;font-family:${SANS}">${emailBody(sample as any)}</body></html>`, { headers: { 'Content-Type': 'text/html' } });
  }

  if (!test && (!atThreshold || rows.length === 0)) {
    return NextResponse.json({ ok: true, sent: 0, message: 'No insurance renewals at a threshold day right now' });
  }
  const subject = `Insurance renewals coming up — ${rows.length} ${rows.length === 1 ? 'policy' : 'policies'}`;
  const r: any = await sendMailAsApp(SENDER, RECIPIENT, subject, emailBody(rows.length ? rows : [{ p: { ins_type: 'Sample policy', carrier: 'Carrier' }, days: 30, date: new Date() }] as any));
  if (r?.error) return NextResponse.json({ error: r.error }, { status: 500 });
  return NextResponse.json({ ok: true, sent: rows.length, to: RECIPIENT });
}

export async function GET(req: Request) { return handle(req); }  // Vercel cron uses GET
export async function POST(req: Request) { return handle(req); } // manual test / preview

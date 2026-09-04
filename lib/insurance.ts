// Litson insurance master list — server-side schema, seed, and helpers.
// Compiled from Catie & Alex's mailboxes; editable in the Insurance module.
import { sql, cuid } from '@/lib/db';

export const CATEGORIES = [
  "PROPERTY, LIABILITY & WORKERS' COMP (brokered by Cover My Assets Insurance Group)",
  'PROFESSIONAL LIABILITY (brokered by TBA Member Insurance Solutions)',
  'LIFE INSURANCE (brokered by Cover My Assets Insurance Group)',
  'EMPLOYEE HEALTH & WELFARE BENEFITS (effective 9/1/2026 plan year — managed via Ease employee portal)',
];

type P = { category: string; ins_type: string; carrier: string; policy_number: string; broker: string; broker_contact: string; contact_info: string; effective_date: string; renews: string; annual_premium: string; notes: string };
const CMA = { broker: 'Cover My Assets Insurance Group', broker_contact: 'Katie Ellis', contact_info: '615-345-0411 · katie@covermyassets.com' };

const SEED_POLICIES: P[] = [
  // Property, Liability & Workers' Comp
  { category: CATEGORIES[0], ins_type: 'Business Owners Policy (BOP)', carrier: 'Hiscox', policy_number: 'P103.533.338.2', ...CMA, effective_date: '6/18/25', renews: '6/18/26 (annual)', annual_premium: '$4,524.00', notes: '2026–27 premium confirmed 5/13/26; auto-renews unless changes requested.' },
  { category: CATEGORIES[0], ins_type: "Workers' Compensation (primary)", carrier: 'Attune', policy_number: 'WCV 0661085 02', ...CMA, effective_date: '6/18/25', renews: '6/18/26 (annual)', annual_premium: '$1,123.00', notes: '2026–27 premium confirmed 5/13/26. See flag below re: second WC policy through ADP/Chubb.' },
  { category: CATEGORIES[0], ins_type: 'Commercial Umbrella', carrier: 'CNA', policy_number: '7039328511', ...CMA, effective_date: '6/18/25', renews: '6/18/26 (annual)', annual_premium: '$1,212.00', notes: '2026–27 premium confirmed 5/13/26; new endorsements (E&O exclusion, aircraft limitation, liquor liability exclusion) are standard, no action needed.' },
  { category: CATEGORIES[0], ins_type: "Workers' Compensation (pay-as-you-go, via ADP)", carrier: 'Chubb National Insurance Company', policy_number: '(27) 7182-40-61', broker: 'ADP Insurance Agency, Inc. (producer)', broker_contact: 'ADP TotalSource / Chubb CSC', contact_info: '866-972-2727 · ChubbCSC@Chubb.com', effective_date: '1/15/26', renews: '1/15/27 (annual)', annual_premium: '~$3,325.00 (est.)', notes: 'FLAG: Enrolled Jan 2026 through ADP payroll — runs concurrently with the Attune WC policy above for the same TN employees. Confirm with Alex/Katie Ellis whether this duplicates coverage or was meant to replace it.' },
  // Professional Liability
  { category: CATEGORIES[1], ins_type: 'Lawyers Professional Liability / Malpractice (E&O)', carrier: 'Hanover', policy_number: 'J752144 (LH5 J752144)', broker: 'TBA Member Insurance Solutions', broker_contact: 'Derek', contact_info: '423-629-2491 · Derek@assoc-admin.com', effective_date: '6/13/25', renews: '6/13 (annual)', annual_premium: 'Varies by attorney headcount', notes: 'Premium increases with attorneys added at renewal (roster-rated). New-attorney add forms required whenever headcount changes. Does NOT cover E&O — that exclusion sits with the BOP/Attune carrier; malpractice/defamation claims route here.' },
  // Life Insurance
  { category: CATEGORIES[2], ins_type: 'Group Life — Split Dollar Arrangement', carrier: 'Principal', policy_number: 'Pending (Guarantee Issue on file)', broker: CMA.broker, broker_contact: 'Katie Ellis / Leanne', contact_info: CMA.contact_info, effective_date: '3/1/26', renews: 'Active until cancelled', annual_premium: '$12,416.40/yr', notes: 'Covers 17 members as of 4/14/26; premium increases as employees are added. Full policy number not yet issued — only the Guarantee Issue letter is on file.' },
  { category: CATEGORIES[2], ins_type: 'Individual Key-Person Life — Zachary Lawson', carrier: 'Banner', policy_number: '5000852730', ...CMA, effective_date: '10/29/24', renews: 'Active until cancelled', annual_premium: '$369.99/yr', notes: '' },
  { category: CATEGORIES[2], ins_type: 'Individual Key-Person Life — John Glover', carrier: 'Banner', policy_number: '5000817380', ...CMA, effective_date: '11/2/24', renews: 'Active until cancelled', annual_premium: '$359.99/yr', notes: '' },
  { category: CATEGORIES[2], ins_type: 'Individual Key-Person Life — Joseph Little', carrier: 'Banner', policy_number: '5000855977', ...CMA, effective_date: '11/8/24', renews: 'Active until cancelled', annual_premium: '$2,034.06/yr', notes: '' },
  { category: CATEGORIES[2], ins_type: 'Business Continuity Life Policy — Alex Little ($3M)', carrier: 'North American', policy_number: 'Not on file (request dec page)', broker: CMA.broker, broker_contact: 'Katie Ellis / Leanne', contact_info: CMA.contact_info, effective_date: '~7/26', renews: 'Active until cancelled', annual_premium: 'TBD', notes: 'Added mid-2026; underwriting/signature process completed ~7/1/26. Ask Cover My Assets for the policy number and dec page for this file.' },
  { category: CATEGORIES[2], ins_type: 'Personal Life Policy — Zack Lawson ($1M)', carrier: 'North American', policy_number: 'Not on file (request dec page)', broker: CMA.broker, broker_contact: 'Katie Ellis / Leanne', contact_info: CMA.contact_info, effective_date: '~7/26', renews: 'Active until cancelled', annual_premium: 'TBD', notes: "Added mid-2026 alongside Alex's two new policies. Ask Cover My Assets for the policy number and dec page for this file." },
  { category: CATEGORIES[2], ins_type: 'Personal Life Policy — Alex Little ($2M)', carrier: 'North American', policy_number: 'Not on file (request dec page)', broker: CMA.broker, broker_contact: 'Katie Ellis / Leanne', contact_info: CMA.contact_info, effective_date: '6/15/26 (conditionally approved)', renews: 'Active until cancelled', annual_premium: 'TBD', notes: 'Added mid-2026. Ask Cover My Assets for the policy number and dec page for this file.' },
  // Employee Health & Welfare Benefits
  { category: CATEGORIES[3], ins_type: 'Group Medical', carrier: 'Blue Cross Blue Shield of TN', policy_number: 'Group plan (policy # not on file)', broker: 'Broker of record unconfirmed', broker_contact: 'Clarizz Alon (internal HR contact)', contact_info: 'Clarizz@litson.co · BCBS member svc 800-565-9140', effective_date: '9/1/26', renews: 'Annual (plan year)', annual_premium: 'N/A — employee/employer split not on file', notes: 'Two plan options: BlueCross SG Silver 147P and SG Gold 117P (Blue Network P). Firm moved off Gusto as broker-of-record around Jan 2026 — confirm who the current broker of record is.' },
  { category: CATEGORIES[3], ins_type: 'Group Dental', carrier: 'Guardian', policy_number: 'Group plan (policy # not on file)', broker: 'Broker of record unconfirmed', broker_contact: 'Clarizz Alon (internal HR contact)', contact_info: 'Clarizz@litson.co · Guardian dental 800-541-7846 · employer svc 800-627-4200', effective_date: '9/1/26', renews: 'Annual (plan year)', annual_premium: 'N/A', notes: 'Plan: Guardian 1500 with Child Ortho (UCR).' },
  { category: CATEGORIES[3], ins_type: 'Group Vision', carrier: 'Guardian (VSP network)', policy_number: 'Group plan (policy # not on file)', broker: 'Broker of record unconfirmed', broker_contact: 'Clarizz Alon (internal HR contact)', contact_info: 'Clarizz@litson.co · Guardian vision/VSP 800-877-7195', effective_date: '9/1/26', renews: 'Annual (plan year)', annual_premium: 'N/A', notes: 'Plan: Guardian 10/20/150, 12/12.' },
];

const SEED_FOLLOWUPS: { kind: string; item: string; detail: string }[] = [
  { kind: 'open', item: "Two active Workers' Comp policies", detail: 'Attune (via Cover My Assets, WCV 0661085 02, renews 6/18) and Chubb via ADP TotalSource (policy (27) 7182-40-61, term 1/15/26–1/15/27) both appear active for the same TN law-office employees. Worth confirming with Alex and Katie Ellis whether one should be cancelled.' },
  { kind: 'open', item: 'Health insurance broker of record', detail: 'Emails show Gusto acting as benefits broker/renewals contact through late 2025, with a transition away from Gusto flagged around Jan 2026. Current medical/dental/vision plans run through the Ease employee portal, but no broker-of-record name turned up in the mailboxes searched — worth confirming with Clarizz or Ease directly.' },
  { kind: 'open', item: 'North American life policies — missing policy numbers', detail: 'Three life policies placed with North American in mid-2026 (Alex $3M business continuity, Alex $2M personal, Zack $1M personal) were tracked through underwriting/signature in the email threads, but no dec page or policy number email was found. Cover My Assets (Katie Ellis / Leanne) should have these on file.' },
  { kind: 'open', item: 'Split-Dollar group life policy number', detail: "The Principal split-dollar arrangement (effective 3/1/26, 17 members) only had a Guarantee Issue letter on file as of 4/14/26 — the formal policy number was still pending. Confirm it's been issued." },
  { kind: 'open', item: 'Victoria Seeley life insurance — cancellation in progress', detail: 'A Principal life policy (contract 9826853) tied to Victoria Seeley was in the process of being cancelled as of late Aug 2026 (Alex signing as owner, Victoria as assignee). Not included above since it’s being cancelled rather than active — flagging in case it needs to stay on the record until fully processed.' },
  { kind: 'excluded', item: 'HOSP-related insurance references — HOSP is a client-facing hospitality-tech product, not a Litson policy.', detail: '' },
  { kind: 'excluded', item: 'Costa Rica retreat travel insurance — one-off event coverage, not an ongoing business policy.', detail: '' },
  { kind: 'excluded', item: 'SquareTrade/Allstate Protection Plan — a personal device protection plan, not a business policy.', detail: '' },
  { kind: 'excluded', item: "General liability line-item on a Moffitt Builders LLC invoice — that's the contractor's own coverage on a client build-out, not a Litson policy.", detail: '' },
];

export async function ensureInsurance(): Promise<void> {
  await sql`CREATE TABLE IF NOT EXISTS insurance_policies (
    id TEXT PRIMARY KEY, category TEXT, ins_type TEXT, carrier TEXT, policy_number TEXT,
    broker TEXT, broker_contact TEXT, contact_info TEXT, effective_date TEXT, renews TEXT,
    annual_premium TEXT, notes TEXT, sort_order INT DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS insurance_followups (
    id TEXT PRIMARY KEY, kind TEXT DEFAULT 'open', item TEXT, detail TEXT,
    sort_order INT DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM insurance_policies` as any[];
  if (n === 0) {
    let i = 0;
    for (const p of SEED_POLICIES) {
      await sql`INSERT INTO insurance_policies (id, category, ins_type, carrier, policy_number, broker, broker_contact, contact_info, effective_date, renews, annual_premium, notes, sort_order)
        VALUES (${cuid()}, ${p.category}, ${p.ins_type}, ${p.carrier}, ${p.policy_number}, ${p.broker}, ${p.broker_contact}, ${p.contact_info}, ${p.effective_date}, ${p.renews}, ${p.annual_premium}, ${p.notes}, ${i++})`;
    }
  }
  const [{ m }] = await sql`SELECT COUNT(*)::int AS m FROM insurance_followups` as any[];
  if (m === 0) {
    let i = 0;
    for (const f of SEED_FOLLOWUPS) {
      await sql`INSERT INTO insurance_followups (id, kind, item, detail, sort_order) VALUES (${cuid()}, ${f.kind}, ${f.item}, ${f.detail}, ${i++})`;
    }
  }
}

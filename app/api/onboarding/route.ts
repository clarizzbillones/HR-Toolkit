export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { sql, cuid } from '@/lib/db';

const SEED_VERSION = 6; // bump to force a one-time reseed of the templates

async function ensureTable() {
  await sql`CREATE TABLE IF NOT EXISTS onboarding_items (
    id text PRIMARY KEY,
    guide text NOT NULL DEFAULT 'General',
    kind text NOT NULL DEFAULT 'section',
    title text, body text, day text, assignee text, location text, url text,
    owner text, done boolean DEFAULT false, sort_order int DEFAULT 0,
    created_at timestamptz DEFAULT now()
  )`;
  for (const c of ['guide', 'day', 'assignee', 'location', 'url', 'owner'])
    await sql`ALTER TABLE onboarding_items ADD COLUMN IF NOT EXISTS ${sql(c)} text`;
  await sql`UPDATE onboarding_items SET guide = 'General' WHERE guide IS NULL`;
}

// ---------- GENERAL new-hire guide ----------
const G_SECTIONS: [number, string, string][] = [
  [0, 'Welcome to Litson', `Welcome to the team! This packet has everything you need to get set up with Litson systems, payroll, communication tools, and your first two weeks of onboarding.\n\nPlease review it carefully and reach out to HR with any questions.`],
  [1, 'Purpose', `This is a general onboarding template for every new hire. Edit, add, or remove any section, schedule row, tool link, or checklist item so it fits the specific role and responsibilities.`],
  [2, 'Email & Accounts Setup', `• You'll be assigned a firm email (format: firstname@litson.co).\n• Log in as soon as you receive access.\n• The company handbook is accessible through ADP once logged in.`],
  [3, 'Payroll & HR (ADP)', `• You'll receive an invitation to your personal email to set up your ADP account.\n• Follow the instructions to complete your employee profile.\n• Through ADP you'll access: employee handbook, payroll setup, and benefits enrollment.`],
  [4, 'Timekeeping (Ajax)', `• We use Ajax for automated time tracking.\n• Set up your Ajax account and book the required onboarding call.`],
  [5, 'Documentation (I-9)', `• Email a copy of your ID / passport to HR for I-9 verification.`],
  [50, '2-Week Onboarding Overview', `Week 1 — Foundations & Introductions\nFocus: Systems, expectations, workflow structure, and foundational shadowing.\n\nWeek 2 — Application & Integration\nFocus: Deeper shadowing, workflow integration, assigned tasks, and gradual independence.`],
  [51, 'Check-Ins', `• End of Week 1: comfort level, systems understanding, communication clarity, early concerns.\n• End of Week 2: review assigned work, clarify expectations, provide feedback, adjust workflow.\n• Ongoing: weekly check-in for communication alignment and performance tracking.`],
  [52, 'Completion Goals (dependent on the role)', `By the end of Week 2, the new hire should:\n• Understand firm expectations\n• Be comfortable with the systems\n• Know the relevant processes\n• Manage deadlines accurately\n• Track time / bill properly (if applicable)\n• Handle assigned work under supervision\n• Know who to ask for guidance`],
  [60, 'Employee Benefits (employees only — not for contractors)', `Effective coverage: September 1, 2025. These benefits apply to employees only and are not available to contractors.\n\nView and manage your benefits in your Gusto employee portal.\nHR contact for benefits: Clarizz – clarizz@litson.co`],
  [61, 'Medical Insurance', `Provider: Blue Cross Blue Shield\n• Plan Option 1: BlueCross SG Silver 147P — Blue Network P\n• Plan Option 2: BlueCross SG Gold 117P — Blue Network P\nEmployee customer service: (800) 565-9140\nID cards: mailed within 10–14 business days from the effective date. If not received, call customer service.`],
  [62, 'Dental Insurance', `Provider: Guardian\nPlan: Guardian 1500 with Child Ortho (UCR)\nEmployee customer service (dental): (800) 541-7846\nEmployer customer service team: (800) 627-4200`],
  [63, 'Vision Insurance', `Provider: Guardian (VSP)\nPlan: Guardian 10/20/150, 12/12\nEmployee customer service (vision): (800) 877-7195`],
  [64, '401(k) Retirement Plan', `Provider: Guideline\nEligibility: after one year of continuous full-time employment.\nEmployer match: up to 6% of salary.\nCustomer service: (888) 344-5188`],
  [65, 'Benefits — Important Contacts & FAQ', `Important contacts:\n• Guideline (401k): (888) 344-5188\n• Guardian employer team: (800) 627-4200\n• Guardian dental (employee): (800) 541-7846\n• Guardian vision / VSP (employee): (800) 877-7195\n• BCBS (employee): (800) 565-9140\n\nFAQ\nQ: What if I don't get my ID cards? — Call your plan's customer service number above.\nQ: Where do I see my coverage details? — Your Gusto employee portal has your full benefits info.\n\nHR contact for benefits: Clarizz – clarizz@litson.co`],
];
const G_SCHEDULE: [string, string, string, string, string][] = [
  ['Day 1', 'Onboarding call — tools & accounts setup', 'HR & Manager', 'Set up email, Dialpad, systems', 'Zoom & Office'],
  ['Day 1', 'Formal introductions (short intro meetings)', 'Manager & team', '', 'Zoom & Office'],
  ['Day 1', 'HR & benefits meeting', 'HR', '', 'Zoom'],
  ['Day 1', 'Payroll & billing training', 'Finance', '', 'Zoom'],
  ['Day 2', 'SOP & systems review (see Tools & SOP Links)', 'Trainer', '', ''],
  ['Day 2', 'Team introductions / catch-ups', 'Trainer & team', '', 'Office'],
  ['Day 3', 'Shadow admin duties', 'Trainer', 'Part of the day', 'Office'],
  ['Day 3', 'Shadow role workflow', 'Trainer', 'Part of the day', 'Office'],
  ['Day 4–5', 'Guided work with supervision', 'Manager', '', ''],
  ['Day 5', 'End of Week 1 check-in', 'Manager & HR', '', 'Zoom'],
  ['Day 6–9', 'Deeper shadowing & assigned tasks', 'Manager', '', ''],
  ['Day 10', 'End of Week 2 review', 'Manager & HR', '', 'Zoom'],
  ['Weekly', 'Ongoing weekly check-in', 'Manager', '', 'Zoom'],
];
const G_TOOLS = [
  'Dialpad (phone system)', 'Dashlane (password manager)', 'Clio (case management)', 'Dropbox (documents & files)',
  'Zoom', 'Ajax (timekeeping)', 'Donna (internal AI assistant)', 'Westlaw', 'PACER',
];
const G_LINKS = [
  'Employee Forms Website', 'Company SOPs', 'Company Directory', 'Company Handbook (via ADP)',
  'Litson Availability Calendar', 'PTO and Leave Request Procedure', 'IT Ticket Request Procedure',
  'Reporting Phishing Emails in Outlook',
];
const G_TASKS: [string, string][] = [
  ['Send NDA to new hire', 'HR'], ['Sign and return the NDA', 'New Hire'],
  ['Accepted invites (Dashlane, Clio, Dropbox, Dialpad)', 'New Hire'], ['Set up Zoom with Litson email', 'New Hire'],
  ['Accepted shared passwords in Dashlane', 'New Hire'], ['Completed ADP setup via personal email invite', 'New Hire'],
  ['Completed Ajax account setup & booked onboarding call', 'New Hire'], ['Provided ID / passport for I-9', 'New Hire'],
  ['Confirmed access to internal resources (SOPs, directory, Donna)', 'New Hire'],
  ['Provision email, accounts & system access', 'HR'], ['HR & benefits enrollment', 'HR'], ['Payroll setup', 'HR'],
  ['Schedule weekly check-ins', 'HR'],
];

// ---------- ATTORNEY guide ----------
const A_SECTIONS: [number, string, string][] = [
  [0, 'Purpose', `This guide applies to all attorneys joining the firm — whether newly hired, transitioning from a law clerk or other role, or joining after graduation and bar admission.\n\nAs a licensed attorney, additional credentials, compliance requirements, and public-facing updates are required. This document explains what we request, who has access, and why.`],
  [1, 'Why We Collect This Information', `Attorneys have unique responsibilities tied to court filings, ethical rules, billing, and public representation of the firm. Collecting this early helps us:\n• Meet court and bar compliance requirements\n• Ensure access to required legal tools and systems\n• Maintain business continuity and shared institutional knowledge\n• Update public firm materials (website, business cards, directories)\n• Prevent repeated requests for sensitive information`],
  [2, 'Information We Will Request — Professional & Licensing', `Required for filings, compliance, and court access:\n• Full legal name (as registered with the Bar)\n• State Bar number(s) and jurisdictions admitted\n• Admission dates and registration status (active/inactive)\n• Professional liability insurance info (if applicable)\n• Law school and graduation year (undergrad optional)\n• Practice areas / specialties\n• Date of birth (held by legal team; court identity verification)\n• Home address (held by legal team; courthouse certificate pickup)`],
  [3, 'Information We Will Request — Biography & Public Profile', `Used for the firm website, marketing, and business materials:\n• Professional headshot\n• Short attorney bio\n• Practice area focus\n• LinkedIn profile (optional but recommended)\n• Name pronunciation (optional)`],
  [4, 'Information We Will Request — Systems & Account Access', `Attorneys must be granted access to firm and legal systems (a centralized internal list is maintained for continuity and security):\n• Case management systems\n• Document management platforms\n• Court e-filing systems\n• Timekeeping and billing tools\n• Password manager access\n• Communication and collaboration tools\n\nYou'll receive onboarding and credentials from Operations/IT.`],
  [50, 'Who Will Have Access to This Information', `Shared internally on a need-to-know basis only (see the access table below).`],
  [51, 'What the Firm Will Do With This Information', `Once submitted, we will:\n• Set up required systems and accounts\n• Add you to password manager access\n• Update the firm website and directories\n• Order business cards\n• Update your title across all platforms\n• Ensure you have the tools needed to practice`],
  [52, 'Court Admissions', `As firm policy, all attorneys are admitted to the courts we most frequently practice in: the State Bar of Tennessee, all three federal Tennessee districts (Western, Middle, Eastern), and the 6th Circuit Court of Appeals. Additional districts are added case-by-case.\n\nDifferent courts have varying requirements; the firm collects only what each admission requires. Sensitive items are handled on a need-to-know basis and not retained beyond the admission process. If you prefer to gather and submit certain sensitive items yourself (e.g., bar scores or credit reports), just let us know and we'll coordinate.`],
  [53, 'Your Privacy: What We Do Not Publish', `We do not publish, share externally, or provide to third-party directories your home address, personal email, date of birth, or personal cell number.\n\nFor all public-facing contact info (website, directories, business cards, court filings) the firm uses only your office/Dialpad number and your Litson firm email.`],
  [54, 'Our Goal', `We want every attorney to start with clarity, proper access, and the tools needed to succeed. Providing this information early avoids confusion and repeated requests later.`],
];
const A_TOOLS = [
  'Case management system', 'Document management platform', 'Court e-filing (PACER / ECF)',
  'Timekeeping & billing', 'Password manager (Dashlane)', 'Westlaw', 'Firm directory & website profile',
];
const A_LINKS: string[] = [];
const A_TABLES: { title: string; headers: string[]; rows: string[][] }[] = [
  { title: 'Who Will Have Access to This Information', headers: ['Team', 'Access'], rows: [
    ['HR', 'Full onboarding records'],
    ['Legal Team', 'Licensing + system access; date of birth; home address (court identity verification)'],
    ['Operations / Legal Operations', 'Licensing + system access'],
    ['Marketing', 'Bio, headshot, website updates, business cards'],
    ['Finance / Billing', 'Information needed for billing and filings'],
    ['Firmwide', 'Public-facing information (title, bio)'],
  ] },
];
const A_TASKS: [string, string][] = [
  ['Send NDA to attorney', 'HR'], ['Sign and return the NDA', 'New Hire'],
  ['Provide full legal name (as registered with Bar)', 'New Hire'],
  ['Provide State Bar number(s) & jurisdictions', 'New Hire'],
  ['Provide admission dates & registration status', 'New Hire'],
  ['Provide malpractice insurance info (if applicable)', 'New Hire'],
  ['Provide law school & graduation year', 'New Hire'],
  ['Provide practice areas / specialties', 'New Hire'],
  ['Provide DOB & home address (legal team — court verification)', 'New Hire'],
  ['Provide professional headshot & short bio', 'New Hire'],
  ['Provide LinkedIn profile (optional)', 'New Hire'],
  ['Provision systems, e-filing & billing access', 'HR'],
  ['Add attorney to password manager', 'HR'],
  ['Update website, directory & order business cards', 'HR'],
  ['Process court admissions (TN Bar, W/M/E TN districts, 6th Cir.)', 'HR'],
];

async function seedGuide(guide: string, sections: [number, string, string][], schedule: [string, string, string, string, string][], tools: string[], links: string[], tasks: [string, string][], tables: { title: string; headers: string[]; rows: string[][] }[] = []) {
  for (const [sort, title, body] of sections)
    await sql`INSERT INTO onboarding_items (id, guide, kind, title, body, sort_order) VALUES (${cuid()}, ${guide}, 'section', ${title}, ${body}, ${sort})`;
  let i = 0;
  for (const [day, title, assignee, notes, loc] of schedule)
    await sql`INSERT INTO onboarding_items (id, guide, kind, day, title, assignee, body, location, sort_order) VALUES (${cuid()}, ${guide}, 'schedule', ${day}, ${title}, ${assignee}, ${notes}, ${loc}, ${i++})`;
  let ti = 0;
  for (const t of tools)
    await sql`INSERT INTO onboarding_items (id, guide, kind, title, sort_order) VALUES (${cuid()}, ${guide}, 'tool', ${t}, ${ti++})`;
  let j = 0;
  for (const t of links)
    await sql`INSERT INTO onboarding_items (id, guide, kind, title, sort_order) VALUES (${cuid()}, ${guide}, 'sop', ${t}, ${j++})`;
  let b = 0;
  for (const tb of tables)
    await sql`INSERT INTO onboarding_items (id, guide, kind, title, body, sort_order) VALUES (${cuid()}, ${guide}, 'table', ${tb.title}, ${JSON.stringify({ headers: tb.headers, rows: tb.rows })}, ${b++})`;
  let k = 0;
  for (const [title, owner] of tasks)
    await sql`INSERT INTO onboarding_items (id, guide, kind, title, owner, sort_order) VALUES (${cuid()}, ${guide}, 'task', ${title}, ${owner}, ${k++})`;
}
// ---------- CONTRACTOR guide (no benefits) ----------
const C_SECTIONS: [number, string, string][] = [
  [0, 'Contractor Onboarding — Welcome', `Welcome! This guide covers setup and payment for contractors working with Litson.\n\nNote: employee benefits (medical, dental, vision, 401k) do not apply to contractors.`],
  [1, 'Payment Setup', `How you're paid depends on your location:\n\n• US-based contractors — paid via ADP. You'll receive an ADP invite to complete self-onboarding (you enter your own details and payment info).\n\n• International contractors — paid via Wise. Please provide your IBAN, account name, bank number, and complete address (see the Wise Payment Details table below).`],
  [2, 'Accounts & Tools', `You'll be granted access to the tools needed for your work. Contact HR if you're missing anything.`],
  [50, 'Point of Contact', `For onboarding, payment, or access questions, contact HR: clarizz@litson.co`],
];
const C_TOOLS = ['Dialpad (if needed)', 'Dashlane (password manager)', 'Clio (case management, if needed)', 'Dropbox (documents & files)', 'Zoom'];
const C_TABLES: { title: string; headers: string[]; rows: string[][] }[] = [
  { title: 'Wise Payment Details (international contractors only)', headers: ['Field', 'Value'], rows: [
    ['IBAN', ''], ['Account name', ''], ['Bank number', ''], ['Complete address', ''],
  ] },
];
const C_TASKS: [string, string][] = [
  ['Confirm contractor is US-based or international', 'HR'],
  ['US: send ADP invite for self-onboarding', 'HR'],
  ['International: set up Wise payment', 'HR'],
  ['Send contractor agreement / NDA', 'HR'],
  ['Provision tool access', 'HR'],
  ['Sign contractor agreement / NDA', 'New Hire'],
  ['US: complete ADP self-onboarding', 'New Hire'],
  ['International: provide Wise details (IBAN, account name, bank number, address)', 'New Hire'],
  ['Confirm tool access', 'New Hire'],
];

async function seedAll() {
  await seedGuide('General', G_SECTIONS, G_SCHEDULE, G_TOOLS, G_LINKS, G_TASKS);
  await seedGuide('Attorney', A_SECTIONS, [], A_TOOLS, A_LINKS, A_TASKS, A_TABLES);
  await seedGuide('Contractor', C_SECTIONS, [], C_TOOLS, [], C_TASKS, C_TABLES);
}

async function migrate() {
  const meta = await sql`SELECT body FROM onboarding_items WHERE kind = 'meta' AND title = 'seed_version' LIMIT 1`;
  const cur = meta.length ? parseInt((meta as any[])[0].body ?? '0') : 0;
  if (cur >= SEED_VERSION) return;
  await sql`DELETE FROM onboarding_items`;
  await seedAll();
  await sql`INSERT INTO onboarding_items (id, kind, title, body) VALUES (${cuid()}, 'meta', 'seed_version', ${String(SEED_VERSION)})`;
}

export async function GET() {
  await ensureTable();
  await migrate();
  const items = await sql`SELECT * FROM onboarding_items WHERE kind <> 'meta' ORDER BY sort_order ASC`;
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  await ensureTable();
  const body = await req.json();
  if (body.action === 'reset') {
    await sql`DELETE FROM onboarding_items`;
    await seedAll();
    await sql`INSERT INTO onboarding_items (id, kind, title, body) VALUES (${cuid()}, 'meta', 'seed_version', ${String(SEED_VERSION)})`;
    const items = await sql`SELECT * FROM onboarding_items WHERE kind <> 'meta' ORDER BY sort_order ASC`;
    return NextResponse.json({ items });
  }
  // Duplicate every item from one guide into another (append; source untouched)
  if (body.action === 'duplicate') {
    const from = (body.from ?? '').toString();
    const to = (body.to ?? '').toString();
    if (!from || !to || from === to) return NextResponse.json({ error: 'Bad from/to' }, { status: 400 });
    const src = await sql`SELECT * FROM onboarding_items WHERE guide = ${from} AND kind <> 'meta' ORDER BY kind, sort_order ASC`;
    const base: Record<string, number> = {};
    const counter: Record<string, number> = {};
    for (const kind of ['section', 'schedule', 'sop', 'tool', 'table', 'task']) {
      const [{ mx }] = await sql`SELECT COALESCE(MAX(sort_order), -1)::int as mx FROM onboarding_items WHERE guide = ${to} AND kind = ${kind}`;
      base[kind] = (mx ?? -1) + 1; counter[kind] = 0;
    }
    for (const r of src as any[]) {
      const so = base[r.kind] + (counter[r.kind]++);
      await sql`INSERT INTO onboarding_items (id, guide, kind, title, body, day, assignee, location, url, owner, done, sort_order)
        VALUES (${cuid()}, ${to}, ${r.kind}, ${r.title}, ${r.body}, ${r.day}, ${r.assignee}, ${r.location}, ${r.url}, ${r.owner}, false, ${so})`;
    }
    const items = await sql`SELECT * FROM onboarding_items WHERE kind <> 'meta' ORDER BY sort_order ASC`;
    return NextResponse.json({ items });
  }
  const guide = (body.guide ?? 'General').toString();
  const kind = ['section', 'schedule', 'sop', 'tool', 'table', 'task'].includes(body.kind) ? body.kind : 'section';
  const [{ mx }] = await sql`SELECT COALESCE(MAX(sort_order), -1)::int as mx FROM onboarding_items WHERE guide = ${guide} AND kind = ${kind}`;
  const id = cuid();
  await sql`INSERT INTO onboarding_items (id, guide, kind, title, body, day, assignee, location, url, owner, sort_order)
    VALUES (${id}, ${guide}, ${kind}, ${body.title ?? ''}, ${body.body ?? null}, ${body.day ?? null}, ${body.assignee ?? null}, ${body.location ?? null}, ${body.url ?? null}, ${body.owner ?? null}, ${(mx ?? -1) + 1})`;
  const [item] = await sql`SELECT * FROM onboarding_items WHERE id = ${id}`;
  return NextResponse.json({ item }, { status: 201 });
}

export async function PATCH(req: Request) {
  await ensureTable();
  const { id, ...f } = await req.json();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  for (const key of ['title', 'body', 'day', 'assignee', 'location', 'url', 'owner', 'done', 'sort_order'] as const) {
    if (f[key] !== undefined) await sql`UPDATE onboarding_items SET ${sql(key)} = ${f[key]} WHERE id = ${id}`;
  }
  const [item] = await sql`SELECT * FROM onboarding_items WHERE id = ${id}`;
  return NextResponse.json({ item });
}

export async function DELETE(req: Request) {
  await ensureTable();
  const { id, guide } = await req.json();
  if (guide) await sql`DELETE FROM onboarding_items WHERE guide = ${guide}`;
  else await sql`DELETE FROM onboarding_items WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}

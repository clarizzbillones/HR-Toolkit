// Server-side AI drafting — falls back to local templates without an API key

export type DraftKind = 'offer' | 'sop';

export interface OfferParams {
  employeeType: 'contractor' | 'employee';
  name: string;
  email: string;
  role: string;
  dept: string;
  salary: string;
  startDate: string;
  location: string;
  notes: string;
  firm: string;
  cadence: string;
}

export interface SopParams {
  title: string;
  template: string;
  notes: string;
  firm: string;
}

function todayStr() {
  return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function signByDate() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function localOffer(p: OfferParams): string {
  const first = (p.name || 'Candidate').split(' ')[0];
  const sal = Number(p.salary).toLocaleString('en-US');
  const loc = p.location || (p.employeeType === 'contractor' ? 'Remote' : 'Nashville, TN');
  const startDisplay = p.startDate
    ? new Date(p.startDate + 'T12:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '[Start Date TBD]';

  if (p.employeeType === 'contractor') {
    return `${todayStr()}

Via Email

Re: 1099 Independent Contractor Offer — ${p.role}

${p.name}${p.email ? '\n' + p.email : ''}

Dear ${first},

On behalf of ${p.firm}, PLLC, I am pleased to extend this offer for you to serve as an independent contractor in the role of ${p.role}${p.dept ? ` (${p.dept})` : ''}, based ${loc}. We have been impressed with your background and look forward to working together.

Engagement Terms
Start Date: ${startDisplay}
Compensation: $${sal} per month, invoiced monthly
Classification: 1099 Independent Contractor${p.notes ? '\n' + p.notes : ''}

As an independent contractor, you will not be an employee of ${p.firm}, PLLC and will not be entitled to employee benefits. You will be responsible for your own taxes and business expenses. Either party may terminate this engagement with seven (7) days' written notice.

Please sign and return this letter by ${signByDate()} to indicate your acceptance. We look forward to your contributions.

Very truly yours,

Alex Little
Managing Member
${p.firm}, PLLC

cc: Zack Lawson, Member`;
  }

  return `${todayStr()}

Via Email

Re: Offer of Employment — ${p.role}

${p.name}${p.email ? '\n' + p.email : ''}

Dear ${first},

On behalf of ${p.firm}, PLLC, I am delighted to extend an offer of employment for the position of ${p.role}${p.dept ? `, ${p.dept}` : ''}, located in ${loc}. The partners were impressed by your experience and believe you will be a valued addition to our team.

Compensation & Benefits
Start Date: ${startDisplay}
Annual Salary: $${sal}, paid on the firm's ${(p.cadence || 'semi-monthly').toLowerCase()} schedule
Classification: W-2 Employee${p.dept ? '\nDepartment: ' + p.dept : ''}${p.notes ? '\n' + p.notes : ''}

As a member of the firm you will be eligible for our benefits program, including health, dental, and vision insurance, a 401(k) plan with firm match, and paid time off. Employment with ${p.firm} is at-will.

Please sign and return this letter by ${signByDate()}. We look forward to welcoming you to the team.

Very truly yours,

Alex Little
Managing Member
${p.firm}, PLLC`;
}

export function localSop(p: SopParams): string {
  const sopId = `HR-${String(Date.now()).slice(-4)}`;
  const n = p.notes ? `\n   (Incorporating: ${p.notes})` : '';
  return `STANDARD OPERATING PROCEDURE
${p.firm}, PLLC — Human Resources

Title: ${p.title}
SOP ID: ${sopId}   |   Effective: ${todayStr()}   |   Version: 1.0   |   Owner: HR Administrator

1. PURPOSE
This SOP establishes a consistent, repeatable process for ${p.title.toLowerCase()} at ${p.firm}, PLLC, ensuring quality, compliance, and a clear record.

2. SCOPE
Applies to all attorneys and staff involved in ${p.template.toLowerCase()}.

3. RESPONSIBILITIES
   • HR Administrator — owns and maintains this procedure.
   • Assigned staff — execute the steps below and document completion.
   • Supervising attorney — reviews and signs off where required.

4. PROCEDURE${n}
   Step 1 — Receive and log the request in the firm system.
   Step 2 — Verify required information and run any necessary checks.
   Step 3 — Complete the core task per firm standards.
   Step 4 — Obtain review/approval from the responsible party.
   Step 5 — File records and update the relevant tracker.

5. RECORDS & REFERENCES
Retain all records per the firm's Document Retention SOP. Reference the firm handbook for related policies.

6. REVISION HISTORY
   v1.0 — Initial release (${todayStr()}).`;
}

export async function generateDraft(kind: 'offer', params: OfferParams): Promise<string>;
export async function generateDraft(kind: 'sop', params: SopParams): Promise<string>;
export async function generateDraft(kind: DraftKind, params: OfferParams | SopParams): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5-20250929';

  if (!apiKey) {
    if (kind === 'offer') return localOffer(params as OfferParams);
    return localSop(params as SopParams);
  }

  let prompt: string;
  if (kind === 'offer') {
    const p = params as OfferParams;
    const loc = p.location || (p.employeeType === 'contractor' ? 'Remote' : 'Nashville, TN');
    const startDisplay = p.startDate
      ? new Date(p.startDate + 'T12:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : '[Start Date TBD]';
    const sal = Number(p.salary).toLocaleString('en-US');
    if (p.employeeType === 'contractor') {
      prompt = `Draft a formal 1099 independent contractor offer letter for ${p.firm}, PLLC, a law firm. Today is ${todayStr()}. Structure: date; blank line; "Via Email"; blank line; "Re: 1099 Independent Contractor Offer — ${p.role}"; blank line; candidate name and email on separate lines; blank line; greeting "Dear ${first},"; opening paragraph offering the contractor role; "Engagement Terms" section (label bold) listing Start Date (${startDisplay}), Compensation ($${sal} per month invoiced monthly), Classification (1099 Independent Contractor)${p.notes ? ', and additional notes: ' + p.notes : ''}; paragraph clarifying no employee benefits and self-responsibility for taxes; termination clause (7 days written notice by either party); instructions to sign and return by ${signByDate()}; blank line; "Very truly yours,"; blank lines for signature; "Alex Little"; "Managing Member"; "${p.firm}, PLLC"; blank line; "cc: Zack Lawson, Member". Location: ${loc}. Keep it professional and concise, about 220 words. Return ONLY the letter text.`;
    } else {
      prompt = `Draft a formal W-2 employment offer letter for ${p.firm}, PLLC, a law firm in Nashville, Tennessee. Today is ${todayStr()}. Structure: date; blank line; "Via Email"; blank line; "Re: Offer of Employment — ${p.role}"; blank line; candidate name and email on separate lines; blank line; greeting "Dear ${first},"; opening paragraph offering the position; "Compensation & Benefits" section listing Start Date (${startDisplay}), Annual Salary ($${sal} paid ${(p.cadence || 'semi-monthly').toLowerCase()}), Classification (W-2 Employee)${p.dept ? ', Department: ' + p.dept : ''}${p.notes ? ', additional: ' + p.notes : ''}; benefits paragraph (health/dental/vision, 401k with match, PTO); at-will employment statement; instructions to sign and return by ${signByDate()}; blank line; "Very truly yours,"; blank lines for signature; "Alex Little"; "Managing Member"; "${p.firm}, PLLC". Candidate: ${p.name}${p.email ? ' (' + p.email + ')' : ''}. Role: ${p.role}. Location: ${loc}. Keep it warm but professional, about 230 words. Return ONLY the letter text.`;
    }
  } else {
    const p = params as SopParams;
    prompt = `Write a Standard Operating Procedure for ${p.firm}, PLLC, a law firm. Title: "${p.title}". Category: ${p.template}. Today is ${todayStr()}. Use this exact section structure with numbered headings: a header block (firm name, title, SOP ID, effective date, version 1.0, owner: HR Administrator), then 1. PURPOSE, 2. SCOPE, 3. RESPONSIBILITIES, 4. PROCEDURE (numbered steps), 5. RECORDS & REFERENCES, 6. REVISION HISTORY. ${p.notes ? `Incorporate these specifics: ${p.notes}.` : ''} Keep it concise and practical for a 33-person firm, about 250 words. Return ONLY the SOP text.`;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic.Anthropic({ apiKey });
    const msg = await client.messages.create({
      model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = msg.content[0]?.type === 'text' ? msg.content[0].text : '';
    return text.trim() || (kind === 'offer' ? localOffer(params as OfferParams) : localSop(params as SopParams));
  } catch {
    return kind === 'offer' ? localOffer(params as OfferParams) : localSop(params as SopParams);
  }
}

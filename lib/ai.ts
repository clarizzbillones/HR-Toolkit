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
  const nameParts = (p.name || 'Candidate').split(' ');
  const last = nameParts.slice(1).join(' ');
  const salutation = last ? `Mr./Ms. ${last}` : nameParts[0];
  const sal = Number(p.salary).toLocaleString('en-US');
  const loc = p.location || (p.employeeType === 'contractor' ? 'Remote' : 'Nashville, TN');
  const startDisplay = p.startDate
    ? new Date(p.startDate + 'T12:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '[Start Date TBD]';

  if (p.employeeType === 'contractor') {
    return `[DATE_CENTERED]${todayStr()}

Via Email

${p.name}${p.email ? '\n' + p.email : ''}

    Re:    Offer of Employment

Dear ${salutation},

${p.firm} PLLC is pleased to offer you the opportunity to join our team as an ${p.role}. This independent contractor role provides monthly compensation of $${sal}, payable on a monthly basis.

Please note that this engagement is structured as a 1099 independent contractor relationship and not as a W-2 employment relationship. Your performance and our working relationship will be reviewed periodically, with the possibility of continuation at the sole discretion of ${p.firm} PLLC.

This is a ${loc === 'Remote' ? 'fully remote' : loc} position. As an independent contractor, you will be solely responsible for all applicable federal, state, and local taxes. Additionally, this position does not include employee benefits, including but not limited to health, dental, or vision insurance.

Either party may terminate this contractual relationship at any time with seven (7) days' written notice.

We anticipate your start date to be on or before ${startDisplay}. Please confirm your acceptance of this offer in writing.

We are excited about the possibility of working with you. If you have any questions or concerns, please do not hesitate to contact Zack Lawson at zack@litson.co or 865-719-4067, or myself.${p.notes ? '\n\n' + p.notes : ''}

[CC_BLOCK]
cc:    Zack Lawson, Founding Partner
         Catie Toole, Director of Operations
[/CC_BLOCK]
Very truly yours,

Alex Little
Founding & Managing Partner`;
  }

  const article = /^[aeiou]/i.test(p.role.trim()) ? 'an' : 'a';
  return `[DATE_CENTERED]${todayStr()}

Via Email

${p.name}${p.email ? '\n' + p.email : ''}

    Re:    Offer of Employment

Dear ${nameParts[0]},

We are pleased to extend an offer for you to join ${p.firm} PLLC as ${article} ${p.role}. This letter is to confirm the details of our employment offer in writing.

Specifically, ${p.firm} will set your annual base compensation at $${sal}, paid ${(p.cadence || 'semi-monthly').toLowerCase()}. Your benefits will include health, dental, and life insurance, to which the firm will contribute in whole or part, and the firm will provide a 6% match on your 401(k) contributions after you have completed one year of employment. As you are aware, you will be an at-will employee, and your compensation may be adjusted pursuant to firm policies, as in effect and amended from time to time.${p.notes ? ' ' + p.notes : ''}

Your anticipated start date will be ${startDisplay}. We ask that you respond in writing confirming your acceptance of this offer. We are excited about the prospect of you joining us. Please do not hesitate to contact Zack Lawson at zack@litson.co or 865-719-4067, or myself with any questions or concerns.

[CC_BLOCK]
cc:    Zack Lawson, Founding Partner
         Catie Toole, Director of Operations
[/CC_BLOCK]
Very truly yours,

Alex Little
Founding & Managing Partner`;
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
    const first = (p.name || 'Candidate').split(' ')[0];
    const last = (p.name || 'Candidate').split(' ').slice(1).join(' ');
    const salutation = last ? `Mr./Ms. ${last}` : first;
    const loc = p.location || (p.employeeType === 'contractor' ? 'Remote' : 'Nashville, TN');
    const startDisplay = p.startDate
      ? new Date(p.startDate + 'T12:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : '[Start Date TBD]';
    const sal = Number(p.salary).toLocaleString('en-US');
    if (p.employeeType === 'contractor') {
      prompt = `Draft a formal 1099 independent contractor offer letter for ${p.firm}, PLLC, a law firm. Today is ${todayStr()}. Write plain text only — no markdown, no asterisks, no bold markers. Structure exactly: centered date line; blank line; "Via Email"; blank line; candidate full name; candidate email; blank line; "    Re:    Offer of Employment" (indented); blank line; "Dear ${salutation},"; blank line; opening paragraph: ${p.firm} PLLC is pleased to offer the opportunity to join as ${p.role}, an independent contractor role with monthly compensation of $${sal} payable monthly; blank line; paragraph: this engagement is structured as a 1099 independent contractor relationship, not W-2; performance reviewed periodically at sole discretion of ${p.firm} PLLC; blank line; paragraph: fully remote position (or ${loc}); as independent contractor solely responsible for federal, state, and local taxes; position does not include employee benefits including health dental or vision insurance; blank line; paragraph: either party may terminate with seven (7) days written notice; blank line; paragraph: anticipate start date on or before ${startDisplay}; please confirm acceptance in writing; blank line; paragraph: excited about working together; questions contact Zack Lawson at zack@litson.co or 865-719-4067, or myself; blank line; blank line; "cc:    Zack Lawson, Founding Partner"; "         Catie Toole, Director of Operations"; 3 blank lines (for signature space); "Very truly yours,"; blank line; "Alex Little"; "Founding & Managing Partner". Return ONLY the letter text, no preamble.`;
    } else {
      prompt = `Draft a W-2 employment offer letter for ${p.firm}, PLLC, a law firm. Today is ${todayStr()}. Write plain text only — no markdown, no asterisks, no bold markers. Match this exact structure and tone:

Line 1: centered date
"Via Email"
candidate full name
candidate email
"    Re:    Offer of Employment"
"Dear ${first},"
Paragraph 1: "We are pleased to extend an offer for you to join ${p.firm} PLLC as ${/^[aeiou]/i.test(p.role.trim()) ? 'an' : 'a'} ${p.role}. This letter is to confirm the details of our employment offer in writing."
Paragraph 2: "Specifically, ${p.firm} will set your annual base compensation at $${sal}, paid ${(p.cadence || 'semi-monthly').toLowerCase()}. Your benefits will include health, dental, and life insurance, to which the firm will contribute in whole or part, and the firm will provide a 6% match on your 401(k) contributions after you have completed one year of employment. As you are aware, you will be an at-will employee, and your compensation may be adjusted pursuant to firm policies, as in effect and amended from time to time."${p.notes ? ' Also include: ' + p.notes + '.' : ''}
Paragraph 3: "Your anticipated start date will be ${startDisplay}. We ask that you respond in writing confirming your acceptance of this offer. We are excited about the prospect of you joining us. Please do not hesitate to contact Zack Lawson at zack@litson.co or 865-719-4067, or myself with any questions or concerns."
Then a cc block on its own lines: "cc:    Zack Lawson, Founding Partner" then "         Catie Toole, Director of Operations"
"Very truly yours,"
"Alex Little"
"Founding & Managing Partner"
Return ONLY the letter text.`;
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

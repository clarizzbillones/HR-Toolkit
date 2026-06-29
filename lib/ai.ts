// Server-side AI drafting — falls back to local templates without an API key

export type DraftKind = 'offer' | 'sop';

export interface OfferParams {
  name: string;
  role: string;
  salary: string;
  start: string;
  type: string;
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
  return `${todayStr()}

${p.name}

Dear ${first},

On behalf of ${p.firm}, PLLC, I am delighted to extend an offer for the position of ${p.role} with our firm in Nashville, Tennessee. The partners were impressed by your experience and believe you will be a valued addition to our team.

Your starting annual salary will be $${sal}, paid on the firm's ${(p.cadence || 'semi-monthly').toLowerCase()} schedule. This is a ${(p.type || 'Full-time').toLowerCase()} position with an anticipated start date of ${p.start}.

As a member of the firm you will be eligible for our benefits program, including health, dental, and vision insurance, a 401(k) plan with firm match, and our paid-time-off policy. Employment with ${p.firm} is at-will, meaning either party may end the relationship at any time, with or without cause.

To accept this offer, please sign and return this letter by ${signByDate()}. We are genuinely excited about the prospect of you joining ${p.firm} and look forward to your response.

Sincerely,

Renee Mathis
HR Administrator
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
    prompt = `Draft a formal job offer letter for ${p.firm}, PLLC, a law firm in Nashville, Tennessee. Today is ${todayStr()}. Use this structure: date; candidate name; greeting; statement offering the position; compensation (annual salary, paid on the firm's ${(p.cadence || 'semi-monthly').toLowerCase()} schedule); employment type and start date; a brief benefits summary (health/dental/vision, 401k with match, PTO); an at-will employment statement; instructions to sign and return within 7 business days; and a closing signed by Renee Mathis, HR Administrator. Candidate: ${p.name}. Position: ${p.role}. Annual salary: $${p.salary}. Start date: ${p.start}. Employment type: ${p.type}. Keep it warm but professional, about 230 words. Return ONLY the letter text, no preamble.`;
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

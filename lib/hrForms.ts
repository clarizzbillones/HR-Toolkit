// HR Forms & Templates — adapted from the firm's
// "LITSON PLLC — Templates & Sample Forms" (Parts A–E; Part F excluded).
// [bracketed] fields are fill-ins to replace before use.
// `guidance` is HR-only usage instruction: shown in the app, NOT in downloads.
import { offboardingTemplateBody } from './offboarding';

export interface HrForm { id: string; part: string; title: string; guidance?: string; body: string; }
export const HR_FORMS: HrForm[] = [
  {
    id: "a2", part: "Part A — Performance & Discipline", title: "A2 — Verbal Warning (Documented)",
    guidance: "First formal step. The warning is delivered verbally; this form documents that it occurred. Provide a copy to the employee and file the original. If the employee declines to sign, write “Employee declined to sign” on the signature line, add the date, and have a witness sign. A refusal to sign does not invalidate the warning.",
    body: `Employee name
[NAME]
Position
[TITLE]
Manager
[MANAGER]
Date of occurrence
[DATE]
Level of action
Verbal Warning — Step 1

1. Issue
[Describe the specific conduct or performance issue. Include dates, examples, and the number of occurrences. State facts only — do not characterize motive or attitude.]

2. Policy or standard involved
[Cite the handbook section or the performance standard not met. Example: "Employee Handbook §4.2 — Core Hours."]

3. Prior discussions on this issue
[List dates of prior coaching conversations, or state "None — this is the first discussion."]

4. Expectation and required change
[State exactly what must change and by when. Be measurable where possible.]

5. Support the firm will provide
[Training, mentoring, resources, schedule adjustment, or "none requested."]

6. Consequence of no improvement
Continued failure to meet this expectation may result in further disciplinary action, up to and including termination of employment.

7. Employee comments
[The employee is not required to comment.]

Acknowledgment. My signature confirms that this warning was discussed with me and that I received a copy. It does not indicate agreement with its contents.

Employee signature ______________________________   Date __________

Manager signature ______________________________   Date __________

HR representative ______________________________   Date __________

Witness to refusal (print and sign) ______________________________   Date __________`,
  },
  {
    id: "a3", part: "Part A — Performance & Discipline", title: "A3 — Written Warning",
    guidance: "Second formal step. Use the same structure as A2, escalated. Copy to the personnel file and to HR.",
    body: `Employee name
[NAME]
Position
[TITLE]
Manager
[MANAGER]
Date of occurrence
[DATE]
Level of action
Written Warning — Step 2
Prior action on this issue
[Date of verbal warning]

1. Issue and prior notice
[Describe the continuing issue. State that the employee received a verbal warning on (date) and that the conduct has continued. Include specific dates and examples since that warning.]

2. Policy or standard involved
[Cite the handbook section or standard.]

3. Required improvement and deadline
[State the specific, measurable change required and the date by which it must be achieved.]

4. How improvement will be measured
[Describe how progress will be assessed and by whom.]

5. Support provided
[Training, resources, supervision adjustments.]

6. Consequence
Failure to achieve and sustain the required improvement may result in further disciplinary action, up to and including termination of employment.

7. Employee comments
[The employee is not required to comment.]

Acknowledgment. My signature confirms that this warning was discussed with me and that I received a copy. It does not indicate agreement with its contents.

Employee signature ______________________________   Date __________

Manager signature ______________________________   Date __________

HR representative ______________________________   Date __________`,
  },
  {
    id: "a4", part: "Part A — Performance & Discipline", title: "A4 — Final Written Warning",
    guidance: "Final step before termination. HR review is required before issuing. If the employee is 40 or older, or if any protected activity has occurred in the prior twelve months, complete the Pre-Termination Risk Assessment (B1) before issuing.",
    body: `Employee name
[NAME]
Position
[TITLE]
Manager
[MANAGER]
Date of occurrence
[DATE]
Level of action
Final Written Warning — Step 3
Prior actions
Verbal [DATE] · Written [DATE]

1. Issue and full history
[Summarize the complete history: what the issue is, when it was first raised, each prior warning with dates, and what has occurred since the written warning.]

2. Required improvement and deadline
[State exactly what must change and by what date.]

3. Consequence — state plainly
This is a final warning. Failure to achieve and sustain the required improvement will result in termination of employment.

4. Employee comments
[The employee is not required to comment.]

Acknowledgment. My signature confirms that this final warning was discussed with me and that I received a copy. It does not indicate agreement with its contents.

Employee signature ______________________________   Date __________

Manager signature ______________________________   Date __________

HR representative ______________________________   Date __________`,
  },
  {
    id: "a5", part: "Part A — Performance & Discipline", title: "A5 — Performance Improvement Plan",
    guidance: "Use where the issue is capability or sustained performance rather than a discrete rule violation. A PIP is a genuine improvement effort — it should not be used as documentation cover for a decision already made.",
    body: `Employee name
[NAME]
Position
[TITLE]
Manager
[MANAGER]
Plan start date
[DATE]
Plan end date
[DATE — typically 30, 60, or 90 days]
Review points
[DATES of scheduled check-ins]

Performance areas requiring improvement

Area 1
[AREA]
Current performance
[What is happening now, with specifics]
Required standard
[The standard to be met]
How measured
[Method and reviewer]

Area 2
[AREA]
Current performance
[  ]
Required standard
[  ]
How measured
[  ]

Support and resources provided by the firm
[Training, mentoring, revised workload, additional supervision, tools. Be specific — a PIP without support is difficult to defend.]

Check-in schedule
[DATE] — progress noted [  ] — manager initials ____ — employee initials ____
[DATE] — progress noted [  ] — manager initials ____ — employee initials ____
[DATE] — progress noted [  ] — manager initials ____ — employee initials ____

Outcome if standards are not met
Failure to achieve and sustain the standards set out above by [END DATE] may result in termination of employment.

Employee comments
[The employee is not required to comment.]

Acknowledgment. My signature confirms that this plan was discussed with me and that I received a copy. It does not indicate agreement with its contents.

Employee signature ______________________________   Date __________

Manager signature ______________________________   Date __________

HR representative ______________________________   Date __________`,
  },
  {
    id: "b1", part: "Part B — Pre-Termination", title: "B1 — Pre-Termination Risk Assessment",
    guidance: "Required before every involuntary separation. Must be reviewed by at least two people. Age and protected-characteristic information is collected solely for this risk review and is retained separately from the personnel file.",
    body: `Employee name
[NAME]
Position and tier
[TITLE] / Tier [1-4]
Hire date
[DATE]
Length of service
[YEARS / MONTHS]
Age
[AGE] — if 40 or older, counsel review required
Proposed separation date
[DATE]
Stated reason
[Specific reason, in the words that will appear on the LB-0489 and any unemployment response]

Risk checks — all must be completed

1. Is the stated reason documented contemporaneously in the personnel file, predating any termination discussion?
[Yes / No — list documents]

2. Have employees under 40 in comparable roles with comparable issues been treated the same way?
[Yes / No — explain any difference on non-age grounds]

3. Has the employee engaged in any protected activity in the prior 12 months — complaint, investigation participation, workers' compensation claim, accommodation request, leave?
[Yes / No — detail]

4. Is there any known or suspected medical condition or disability? If yes, was the ADA interactive process completed and documented?
[Yes / No — detail]

5. Is the employee near a benefit vesting date, retirement eligibility, or bonus milestone?
[Yes / No]

6. Have all reviews, emails, and notes been audited for age-coded or otherwise prohibited language?
[Yes / No]

7. Does the internal reason match what will be stated on the LB-0489 and in any unemployment response?
[Yes / No]

8. Was progressive discipline followed, or does the conduct justify skipping steps?
[Detail]

Severance determination
Gate 1 — Reason qualifies?
[Yes / No]
Gate 2 — Six months of service?
[Yes / No]
Gate 3 — Release to be signed?
[Yes / No]
Severance recommended?
[Yes / No]
Calculated amount (attach C1)
[$AMOUNT]
Risk enhancement applied?
[No / 1.5× — justification]

Approvals

Manager ______________________________   Date __________

Human Resources ______________________________   Date __________

Counsel (if required) ______________________________   Date __________`,
  },
  {
    id: "c1", part: "Part C — Severance", title: "C1 — Severance Calculation Worksheet",
    guidance: "Complete before the separation meeting. Attach to the Pre-Termination Risk Assessment. Any deviation from the formula requires written justification and second approval. Use the calculator above — enter the figures and the totals compute automatically.",
    body: `Employee name
[NAME]
Position
[TITLE]
Hire date
[DATE]
Separation date
[DATE]
Age
[AGE] — if 40+, OWBPA requirements apply

Step 1 — Weekly base rate
Annual base salary (base only — exclude bonus, overtime, commission): [$AMOUNT]
Weekly base rate (annual ÷ 52): [$AMOUNT]

Step 2 — Severance weeks
Tier (1 Admin · 2 Paralegal/Specialist · 3 Manager · 4 Director/Attorney): [TIER]
Base weeks for tier (T1 = 2 · T2 = 3 · T3 = 4 · T4 = 4): [WEEKS]
Years of service (to nearest half year): [YEARS]
Weeks per year for tier (T1 = 1 · T2 = 1.5 · T3 = 2 · T4 = 2): [RATE]
Service weeks (years × rate): [WEEKS]
Subtotal weeks (base + service): [WEEKS]
Tier cap (T1 = 12 · T2 = 16 · T3 = 20 · T4 = 26): [CAP]
Capped weeks (lesser of subtotal and cap): [WEEKS]

Step 3 — Total
Capped weeks × weekly base rate: [$AMOUNT]
Risk enhancement (× 1.5 if authorized — attach justification): [$AMOUNT]
TOTAL SEVERANCE: [$AMOUNT]

Payment structure: lump sum. Under Tenn. Code Ann. § 50-7-303(a)(12), severance paid as salary continuation may disqualify the employee from unemployment benefits for the covered weeks. Lump sum generally does not. Do not pay until any applicable revocation period has expired.

Prepared by ______________________________   Date __________

Approved by ______________________________   Date __________`,
  },
  {
    id: "d1", part: "Part D — Severance Transmittal Letters", title: "D1 — Severance Letter: Employee Under Age 40",
    guidance: "Cover letter only — it accompanies a separation and release agreement drafted or approved by counsel. No OWBPA formalities are legally required. The 7-day review and 7-day revocation periods below are recommended practice, not legal requirements — they make the release harder to challenge and keep one consistent process across all ages. Do not send without counsel approval of the agreement.",
    body: `[DATE]

[EMPLOYEE NAME]
[ADDRESS]

Dear [FIRST NAME],

As we discussed on [DATE], your employment with Litson PLLC will end effective [SEPARATION DATE].

You will receive your final wages for all time worked through your separation date, payable on [DATE]. This payment is not conditional on anything — you will receive it whether or not you accept the offer described below.

In addition, the firm is offering you a severance payment of [$AMOUNT], less applicable taxes and withholding. This amount is offered in exchange for your agreement to the terms in the enclosed Separation and Release Agreement, and is in addition to any amounts you are already owed.

[IF APPLICABLE: The firm will also provide (describe COBRA subsidy, career transition support, or other components).]

What happens next
Please take time to review the enclosed agreement. We are asking that you return it by [DATE — at least 7 days out]. If you would like additional time, please let me know. You are welcome to have an attorney review it before you sign — that is entirely your decision.

After you sign, you have 7 days to change your mind. If you decide to revoke, notify me in writing within that period and the agreement will not take effect. Payment will be issued within [NUMBER] days after the revocation period ends.

Your benefits
Your health coverage [ends on DATE / continues through DATE]. Please see the enclosed health coverage notice, which explains your options and includes time-sensitive enrollment deadlines. I have also enclosed a letter confirming your coverage dates, which most plans require for enrollment. Also enclosed is your Tennessee Separation Notice, Form LB-0489.

If you have questions about any of this, please contact me directly at [PHONE] or [EMAIL]. I am glad to help.

Sincerely,

[NAME]
[TITLE], Litson PLLC

Enclosures: Separation and Release Agreement · Health Coverage Notice · Certificate of Prior Coverage · Tennessee Separation Notice (LB-0489)`,
  },
  {
    id: "d2", part: "Part D — Severance Transmittal Letters", title: "D2 — Severance Letter: Employee Age 40 or Older",
    guidance: "Cover letter only — it accompanies a counsel-approved separation and release agreement. All seven OWBPA elements must be present. This letter contains the attorney-consultation advisement and the consideration and revocation periods. The enclosed agreement must name the Age Discrimination in Employment Act explicitly. Do not shorten the 21 days or the 7-day revocation period. If any material term changes during the 21 days, the period restarts. For a group separation of two or more employees, use 45 days and attach the group disclosure chart (D3).",
    body: `[DATE]

[EMPLOYEE NAME]
[ADDRESS]

Dear [FIRST NAME],

As we discussed on [DATE], your employment with Litson PLLC will end effective [SEPARATION DATE].

You will receive your final wages for all time worked through your separation date, payable on [DATE]. This payment is not conditional on anything — you will receive it whether or not you accept the offer described below.

In addition, the firm is offering you a severance payment of [$AMOUNT], less applicable taxes and withholding. This amount is offered in exchange for your agreement to the terms in the enclosed Separation and Release Agreement, and is in addition to any amounts you are already owed.

[IF APPLICABLE: The firm will also provide (describe COBRA subsidy, career transition support, or other components).]

Important: your right to review and revoke
The enclosed agreement includes a release of claims, including claims under the Age Discrimination in Employment Act. Because of that, federal law gives you specific rights, and the firm wants to be sure you understand them:

You have 21 calendar days to consider this offer. That period began on [DATE THIS PACKET WAS PROVIDED] and ends on [DATE]. You may take the full 21 days.

You are advised to consult with an attorney before signing this agreement. The firm encourages you to do so.

You may sign before the 21 days end if you choose to. That decision is entirely yours. The offer will not be withdrawn or reduced if you use the full period.

After you sign, you have 7 calendar days to revoke. To revoke, deliver written notice to [NAME] at [EMAIL / ADDRESS] before the end of the seventh day. The agreement does not become effective until the eighth day after you sign, assuming you have not revoked. Payment will be issued within [NUMBER] days after that date.

Alternative for group separations: replace the first bullet with — You have 45 calendar days to consider this offer. That period began on [DATE] and ends on [DATE]. Please also see the enclosed disclosure listing the job titles and ages of the individuals selected and not selected for this separation.

Your benefits
Your health coverage [ends on DATE / continues through DATE]. Please see the enclosed health coverage notice, which explains your options and includes time-sensitive enrollment deadlines. I have also enclosed a letter confirming your coverage dates, which most plans require for enrollment. Also enclosed is your Tennessee Separation Notice, Form LB-0489.

If you have questions about any of this, please contact me directly at [PHONE] or [EMAIL]. I am glad to help.

Sincerely,

[NAME]
[TITLE], Litson PLLC

Enclosures: Separation and Release Agreement · Health Coverage Notice · Certificate of Prior Coverage · Tennessee Separation Notice (LB-0489) [· Group Disclosure Chart, if applicable]`,
  },
  {
    id: "d3", part: "Part D — Severance Transmittal Letters", title: "D3 — Group Disclosure Chart (OWBPA)",
    guidance: "Required whenever two or more employees are separated as part of the same decision and any one of them is 40 or older. Must be delivered with the agreement — the 45-day clock starts on delivery. Include everyone in the decisional unit, both selected and not selected. Do not include employee names; job title and age only.",
    body: `Decisional unit
[Describe the group considered — e.g., "Administrative support staff, Nashville office"]
Eligibility factors
[State how individuals were selected]
Time limits
45 days to consider; 7 days to revoke after signing

Job title — Age — Selected for separation?
[TITLE] — [AGE] — [Yes / No]
[TITLE] — [AGE] — [Yes / No]
[TITLE] — [AGE] — [Yes / No]
[TITLE] — [AGE] — [Yes / No]
[TITLE] — [AGE] — [Yes / No]`,
  },
  {
    id: "e1", part: "Part E — Health Coverage Notices", title: "E1 — Health Coverage Notice: No Continuation Available",
    guidance: "For separations before January 1, 2027. Do not include the legal basis for why continuation is unavailable — that is a legal conclusion and should not appear in writing to a former employee.",
    body: `Subject: Your health coverage — important dates

Hi [FIRST NAME],

I wanted to follow up with information about your health coverage, including a few time-sensitive deadlines.

Your coverage under the firm's plan ends on [COVERAGE END DATE]. Continuation coverage is not available through our plan, so you will need to arrange new coverage directly.

There are two deadlines worth noting, and the shorter one catches people off guard:

Spouse's or partner's employer plan — if this is an option, you generally have only 30 days from the loss of coverage to enroll. This is often the least expensive route.

Health Insurance Marketplace — losing job-based coverage opens a 60-day special enrollment period. You can enroll at HealthCare.gov or by calling 1-800-318-2596. Depending on income, you may qualify for premium subsidies that significantly reduce the cost.

It is also worth checking TennCare eligibility at tn.gov/tenncare, though eligibility in Tennessee is limited.

Most enrollments require proof that your prior coverage ended. I have enclosed a letter confirming your coverage dates so you have it ready.

If anything here is unclear, please reach out. I am glad to help however I can.

All the best,
[YOUR NAME]`,
  },
  {
    id: "e2", part: "Part E — Health Coverage Notices", title: "E2 — Health Coverage Notice: COBRA Available",
    guidance: "For separations on or after January 1, 2027. This does not replace the formal COBRA Election Notice, which must be issued by the plan administrator within required timeframes.",
    body: `Subject: Your health coverage options

Hi [FIRST NAME],

I wanted to make sure you have what you need regarding your health coverage.

Your coverage under the firm's plan ends on [COVERAGE END DATE]. You are eligible to continue that same coverage through COBRA. You will receive a formal election notice from [ADMINISTRATOR] separately — it will include premium amounts, deadlines, and enrollment instructions. Please watch for it, as the election window is limited.

A few things worth knowing as you decide:

COBRA continues your current plan — same network, same coverage, no change in providers. You pay the full premium.

The Health Insurance Marketplace is worth comparing. Losing job-based coverage opens a 60-day special enrollment period at HealthCare.gov or 1-800-318-2596. Depending on income, subsidies may make marketplace coverage less expensive than COBRA.

A spouse's or partner's employer plan typically has a 30-day enrollment window — shorter than the others, so check this first if it is an option.

[IF SEVERANCE INCLUDES A COBRA SUBSIDY: As part of your separation agreement, the firm will cover your COBRA premium for (NUMBER) months, through (DATE). After that date, premiums become your responsibility.]

If you have questions about any of this, please reach out. Happy to help.

All the best,
[YOUR NAME]`,
  },
  {
    id: "e3", part: "Part E — Health Coverage Notices", title: "E3 — Certificate of Prior Coverage",
    guidance: "Send proactively with E1 or E2. Most marketplace and spouse-plan enrollments require documentation that prior coverage ended, and employees usually do not know to ask until they are stuck mid-application.",
    body: `[DATE]

To Whom It May Concern:

This letter confirms that [FULL NAME] was enrolled in group health coverage sponsored by Litson PLLC through BlueCross BlueShield of Tennessee.

Coverage effective date
[START DATE]
Coverage end date
[END DATE]
Reason coverage ended
Separation from employment
Covered dependents
[NAMES, or "None"]
Group / policy number
[NUMBER]

This letter is provided to assist with enrollment in other coverage. Please contact me with any questions.

Sincerely,

[YOUR NAME]
[TITLE], Litson PLLC
[PHONE] · [EMAIL]`,
  },
  {
    id: "offboarding", part: "Part H — Checklists",
    title: "Separation / Offboarding Checklist",
    guidance: "Working checklist built from the HR Compliance & Risk Management Manual. For live per-employee tracking (with N/A steps and age suggestions), use the Offboarding tab.",
    body: offboardingTemplateBody(),
  },
  {
    id: "lb0489", part: "Part G — State & Government Forms",
    title: "LB-0489 — TN Separation Notice",
    guidance: "Give the separated employee a completed copy within 24 hours of separation (Rule 0800-09-01-.02). Not required for employees of less than a week or recalled within seven days. Use the official pre-filled PDF above.",
    body: `STATE OF TENNESSEE
DEPARTMENT OF LABOR AND WORKFORCE DEVELOPMENT
DIVISION OF EMPLOYMENT SECURITY
SEPARATION NOTICE

1. Employee's Name:  [FIRST]  [MIDDLE INITIAL]  [LAST]
2. Social Security Number:  [SSN]
3. Last Employed — From:  [START mm/dd/yyyy]   To:  [END mm/dd/yyyy]
   Occupation:  [OCCUPATION]
4. Where was work performed?  [WORK LOCATION]

5. Reason for Separation:  [Lack of Work / Discharge / Quit]
   If lack of work, layoff is:  [Permanent / Temporary]
   If temporary, Recall Date:  [RECALL DATE mm/dd/yyyy]
   If temporary, vacation pay — Week Ending:  [WEEK ENDING mm/dd/yyyy]   Amount:  $[VACATION AMOUNT]

6. Employee received:  [Wages in Lieu of Notice / Severance Pay / None]
   In the amount of  $[AMOUNT]  for the period from  [FROM mm/dd/yyyy]  to  [TO mm/dd/yyyy]

If other than lack of work, explain the circumstances of this separation:
[EXPLANATION]

Employer's Name:  Litson PLLC
Address:  54 Music Square E Ste 300, Nashville, TN 37203
Employer's Telephone Number:  (615) 985-8205
Employer's Email Address:  [EMPLOYER EMAIL]
Employer's Account Number (from LB-0851 / LB-0456):  [ACCOUNT NUMBER]

I certify that the above worker has been separated from work and the information furnished hereon is true and correct. This report has been handed to or mailed to the worker.

Signature of Official or Representative: ______________________________
Title of Person Signing:  [TITLE]
Date Completed and Released to Employee:  [DATE mm/dd/yyyy]

—— NOTICE TO EMPLOYEE ——
Unemployment Insurance (UI) benefits are available to workers who are unemployed and meet state UI eligibility requirements. You may file a UI claim in the first week that employment stops or work hours are reduced.
File by phone: (844) 224-5818   ·   File online: www.jobs4tn.gov   ·   Questions: 1-844-224-5818 or lwd.support@tn.gov

LB-0489 (Rev. 08-2020) RDA 0063`,
  },
];
export const HR_FORM_PARTS: string[] = ["Part A — Performance & Discipline", "Part B — Pre-Termination", "Part C — Severance", "Part D — Severance Transmittal Letters", "Part E — Health Coverage Notices", "Part G — State & Government Forms", "Part H — Checklists"];

// Escape + highlight [fill-in] fields, used by the preview and the print/Word output.
function esc(s: string): string { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
export function highlightFills(escaped: string): string {
  return escaped.replace(/\[[^\]]+\]/g, m => `<span style="color:#b0412f;font-weight:600">${m}</span>`);
}
// Inline formatting: **bold**, `bold`, *italic* (used to render values filled
// into the form and manual emphasis), then highlight any remaining [blanks].
function inlineFmt(escaped: string): string {
  const fmt = escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\s)([^*]+?)\*(?!\*)/g, '$1<em>$2</em>');
  return highlightFills(fmt);
}

// The form rendered as a branded Litson document (navy + gold), for PDF/Word.
// HR-only guidance is intentionally NOT rendered here so it never reaches the
// downloaded / printed copy.
export function hrFormDocHtml(title: string, body: string): string {
  const raw = String(body ?? '').split('\n');
  const lines = raw.map((l, i) => {
    const t = l.trim();
    if (t === '') return '<div style="height:12px"></div>';
    const next = (raw[i + 1] ?? '').trim();
    // Bulleted list item (line starts with •, -, or *).
    if (/^[•\-*]\s+/.test(t)) return `<div style="margin:2px 0 2px 1.4em;text-indent:-1em">&bull;&nbsp;${inlineFmt(esc(t.replace(/^[•\-*]\s+/, '')))}</div>`;
    const isHead = (t === t.toUpperCase() && /[A-Z]/.test(t) && t.length < 60) || /^(Step \d|Part |Subject:)/.test(t);
    // A short line immediately followed by a [fill-in] reads as a field label.
    const isLabel = next.startsWith('[') && !t.startsWith('[') && t.length < 60 && !/[.?!]$/.test(t);
    const inner = inlineFmt(esc(l));
    if (isHead) return `<div style="font-weight:700;font-size:14.5px;margin-top:14px;color:#1b2a3d">${inner}</div>`;
    if (isLabel) return `<div style="font-weight:700;margin-top:8px">${inner}</div>`;
    return `<div style="margin-top:3px">${inner}</div>`;
  }).join('');
  return `<div style="font-family:Georgia,'Times New Roman',serif;color:#1b2a3d;max-width:700px">
    <div style="background:#1b2a3d;border-top:3px solid #c9a24a;border-radius:10px;padding:16px 18px;margin-bottom:18px">
      <div style="font-size:15px;font-weight:700;letter-spacing:4px;color:#c9a24a">LITSON</div>
      <div style="font-size:7.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#9fb0c4;margin-top:2px">PLLC &middot; Human Resources</div>
      <div style="font-size:18px;font-weight:700;color:#fff;margin-top:9px">${esc(title)}</div>
    </div>
    <div style="font-size:13.5px;line-height:1.6">${lines}</div>
    <div style="margin-top:18px;padding-top:8px;border-top:1px solid #e6ddcd;font-size:10px;font-style:italic;color:#8a8474">Replace every [bracketed] field before use. Severance and release documents must be reviewed and approved by counsel before first use.</div>
  </div>`;
}

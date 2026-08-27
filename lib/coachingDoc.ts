// Shared rendering for coaching forms: the standard draft per type, the printed
// document body (used in the PDF, the e-sign page, and the emails), and the two
// email templates. Kept framework-free so it works server- and client-side.

export const COACHING_TYPES = ['Quick check-in', 'Weekly', '30-day check-in', '60-day check-in', '90-day check-in', 'Performance conversation', 'SMART Goals'] as const;

// SMART Performance Development Goals — mirrors the firm's SMART goals document:
// header milestones, one block per goal (Specific / Measurable / Achievable /
// Relevant / Time-bound), open items for the reviewer, and an acknowledgment.
const SMART_GOALS_DRAFT = [
  'SMART Performance Development Goals — specific, measurable goals with 3-, 6-, and 12-month milestones.',
  '',
  '**Milestones:** [3 months (Mon YYYY) · 6 months (Mon YYYY) · 12 months (Mon YYYY)]',
  '**Goals prepared:** [Month DD, YYYY]',
  '',
  '**Goal 1 — [Goal title]**',
  '**S · Specific:** [What exactly will be done, and how.]',
  '**M · Measurable:** [The numbers/metrics that show progress — use [brackets] for targets.]',
  '**A · Achievable:** [Why it is realistic — resources, support, who owns what.]',
  '**R · Relevant:** [Why this goal matters and what it enables.]',
  '**T · Time-bound:** [3 months: … · 6 months: … · 12 months: …]',
  '',
  '**Goal 2 — [Goal title]**',
  '**S · Specific:** [ … ]',
  '**M · Measurable:** [ … ]',
  '**A · Achievable:** [ … ]',
  '**R · Relevant:** [ … ]',
  '**T · Time-bound:** [ … ]',
  '',
  '**Goal 3 — [Goal title]**',
  '**S · Specific:** [ … ]',
  '**M · Measurable:** [ … ]',
  '**A · Achievable:** [ … ]',
  '**R · Relevant:** [ … ]',
  '**T · Time-bound:** [ … ]',
  '',
  '**Open Items for Reviewer**',
  '• [Item to confirm before finalizing]',
  '• [Item to confirm before finalizing]',
  '',
  '**Acknowledgment**',
  'These goals have been discussed with me and I have had the opportunity to provide input.',
  '',
  'Employee signature: ______________________________   Date: ____________',
  'Reviewer signature: ______________________________   Date: ____________',
].join('\n');

// The firm's corrective / performance coaching template (kept alongside the
// check-in drafts). Uses the exact section headings and guidance prompts.
const PERFORMANCE_DRAFT = [
  '**What was discussed**',
  '[State the specific issue with dates and examples. Describe behavior, not personality. Example: "On 6/12 the intake file for Client A was submitted without the signed engagement letter. This is the second occurrence this quarter."]',
  '',
  '**Expectation going forward**',
  '[State the standard clearly. Example: "All intake files must include a signed engagement letter before submission, without exception."]',
  '',
  '**Support offered**',
  '[Training, resources, adjusted workload, or "none requested."]',
].join('\n');

// The standard coaching draft the coach starts from (fully editable).
// Supports **bold**, *italic*, and lines starting with • as bullets.
export function coachingDraft(type: string): string {
  const common = [
    '**Discussion Summary:**',
    '• ',
    '',
    '**Strengths & Wins:**',
    '• ',
    '',
    '**Areas for Growth:**',
    '• ',
    '',
    '**Goals & Expectations:**',
    '• ',
  ];
  const quick = [
    '**Touch-base notes:**',
    '• ',
    '',
    '**Next steps:**',
    '• ',
  ];
  const head: Record<string, string> = {
    'Quick check-in': 'This quick check-in captures a brief touch-base on how things are going, any blockers, and next steps.',
    'Weekly': 'This weekly coaching session reviews progress, wins, blockers, and goals for the week ahead.',
    '30-day check-in': 'This 30-day check-in reviews onboarding progress, role clarity, early wins, and the support needed to succeed.',
    '60-day check-in': 'This 60-day check-in reviews performance against expectations, skill development, and goals for the next period.',
    '90-day check-in': 'This 90-day review evaluates overall performance since hire, core competencies, and a forward development plan.',
  };
  if (type === 'Performance conversation') return PERFORMANCE_DRAFT;
  if (type === 'SMART Goals') return SMART_GOALS_DRAFT;
  const body = type === 'Quick check-in' ? quick : common;
  return [head[type] ?? head['Weekly'], '', ...body].join('\n');
}

function esc(s: any): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
// Lightweight inline markdown: **bold**, *italic* (run after escaping).
function inlineMd(escaped: string): string {
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/(^|[^a-zA-Z0-9])_(.+?)_(?![a-zA-Z0-9])/g, '$1<em>$2</em>');
}
function fmtInline(raw: string): string { return inlineMd(esc(raw)); }
export function fmtLong(iso: any): string {
  if (!iso) return '';
  const d = new Date(String(iso).length <= 10 ? String(iso).slice(0, 10) + 'T12:00:00' : iso);
  return isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
function fmtStamp(iso: any): string {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? String(iso) : d.toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' CT';
}
export interface Signatory { name: string; position: string; role?: string; email?: string; signed_at?: string | null; signature_name?: string | null }
export function parseSignatories(raw: any): Signatory[] {
  try { const a = typeof raw === 'string' ? JSON.parse(raw) : raw; return Array.isArray(a) ? a : []; } catch { return []; }
}

// The full coaching document as branded HTML (Litson navy + gold).
export function coachingDocHtml(row: any): string {
  const bodyLines = String(row.notes ?? '').split('\n').map((l: string) => {
    const t = l.trim();
    if (t === '') return '<div style="height:8px"></div>';
    if (/^[•\-]\s*/.test(t)) return `<div style="margin-left:1.4em;text-indent:-1em">&bull;&nbsp;${fmtInline(t.replace(/^[•\-]\s*/, ''))}</div>`;
    if (/:\s*$/.test(t) && !/[*_]/.test(t)) return `<div style="font-weight:700;margin-top:6px">${esc(t)}</div>`;
    return `<div>${fmtInline(l)}</div>`;
  }).join('');
  const actions = String(row.action_items ?? '').split('\n').map((l: string) => l.trim()).filter(Boolean);
  const actionsHtml = actions.length
    ? `<div style="margin-top:14px"><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#8a8474;margin-bottom:4px">Action items</div>${actions.map(a => `<div style="margin-left:1.4em;text-indent:-1em">&bull;&nbsp;${fmtInline(a.replace(/^[•\-]\s*/, ''))}</div>`).join('')}</div>`
    : '';
  const signers = parseSignatories(row.signatories);
  const sigCell = (s: Signatory) => s.signed_at
    ? `<span style="color:#2f7d5b;font-weight:700">✓ Signed</span> <span style="color:#33503f">${esc(fmtStamp(s.signed_at))}</span>${s.signature_name && s.signature_name.trim().toLowerCase() !== String(s.name).trim().toLowerCase() ? ` <span style="color:#777">(${esc(s.signature_name)})</span>` : ''}`
    : `<span style="color:#b07d2a">Pending signature</span>`;
  const roleBadge = (r?: string) => r
    ? `<span style="font-size:10px;font-weight:700;padding:1px 6px;border-radius:8px;background:${/reviewee|employee/i.test(r) ? '#f7efe1;color:#b07d2a' : '#eef2f7;color:#3f5a76'}">${esc(r)}</span>`
    : '';
  const signerRows = signers.map(s => `<tr>
      <td style="padding:6px 10px;border:1px solid #e6ddcd">${esc(s.name)}</td>
      <td style="padding:6px 10px;border:1px solid #e6ddcd">${roleBadge(s.role)}</td>
      <td style="padding:6px 10px;border:1px solid #e6ddcd;color:#555">${esc(s.position)}</td>
      <td style="padding:6px 10px;border:1px solid #e6ddcd;font-size:12px">${sigCell(s)}</td>
    </tr>`).join('');
  const meta = (l: string, v: string) => `<div><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#8a8474">${esc(l)}</div><div style="font-weight:600;color:#1b2a3d">${esc(v) || '—'}</div></div>`;

  const signedCount = signers.filter(s => s.signed_at).length;
  const statusBadge = signers.length
    ? (signedCount >= signers.length
        ? `<div style="margin-top:16px;background:#eef5f1;border:1px solid #cfe4d8;border-radius:8px;padding:10px 14px;font-weight:700;color:#2f7d5b">✓ Fully signed by all ${signers.length} signator${signers.length === 1 ? 'y' : 'ies'}</div>`
        : `<div style="margin-top:16px;background:#f7efe1;border:1px solid #ecd9b6;border-radius:8px;padding:10px 14px;font-weight:700;color:#b07d2a">Awaiting signatures — ${signedCount} of ${signers.length} signed</div>`)
    : (row.signed_at
        ? `<div style="margin-top:16px;background:#eef5f1;border:1px solid #cfe4d8;border-radius:8px;padding:10px 14px"><div style="font-weight:700;color:#2f7d5b">✓ Electronically signed</div><div style="font-size:13px;color:#33503f">Signed by <b>${esc(row.signature_name)}</b> on ${esc(fmtStamp(row.signed_at))}</div></div>`
        : '');

  const isSmart = (row.coaching_type || '') === 'SMART Goals';
  const title = isSmart ? 'SMART Performance Development Goals' : `Coaching Form — ${esc(row.coaching_type || 'Weekly')}`;
  return `<div style="font-family:Georgia,'Times New Roman',serif;color:#1b2a3d;max-width:680px">
    <div style="background:#1b2a3d;border-top:3px solid #c9a24a;border-radius:10px;padding:16px 18px;margin-bottom:16px">
      <div style="font-size:15px;font-weight:700;letter-spacing:4px;color:#c9a24a">LITSON</div>
      <div style="font-size:7.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#9fb0c4;margin-top:2px">PLLC &middot; Human Resources</div>
      <div style="font-size:19px;font-weight:700;color:#fff;margin-top:9px">${title}</div>
    </div>
    <div style="display:flex;gap:22px;flex-wrap:wrap;padding:0 2px 14px;border-bottom:1px solid #e6ddcd;margin-bottom:14px">
      ${meta('Employee', row.employee)}
      ${meta(isSmart ? 'Review date' : 'Coaching date', fmtLong(row.date))}
      ${meta(isSmart ? 'Reviewer' : 'Submitted by', row.coach_name)}
      ${meta('Position', row.coach_position)}
      ${row.submitted_at ? meta('Submitted', fmtStamp(row.submitted_at)) : ''}
    </div>
    ${row.topic ? `<div style="font-weight:700;margin-bottom:8px">${esc(row.topic)}</div>` : ''}
    <div style="font-size:14px;line-height:1.6">${bodyLines}</div>
    ${actionsHtml}
    ${signerRows ? `<div style="margin-top:16px"><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#8a8474;margin-bottom:5px">Signatures</div><table style="border-collapse:collapse;font-size:13px;width:100%"><tr style="background:#faf7f0"><th align="left" style="padding:6px 10px;border:1px solid #e6ddcd">Name</th><th align="left" style="padding:6px 10px;border:1px solid #e6ddcd">Role</th><th align="left" style="padding:6px 10px;border:1px solid #e6ddcd">Position</th><th align="left" style="padding:6px 10px;border:1px solid #e6ddcd">Signature</th></tr>${signerRows}</table></div>` : ''}
    ${statusBadge}
    <div style="margin-top:14px;font-size:11px;font-style:italic;color:#8a8474;border-top:1px solid #e6ddcd;padding-top:8px">Signature confirms the conversation occurred and the employee received a copy. It does not indicate agreement.</div>
  </div>`;
}

// Small Litson banner + a light meta line — used at the top of both emails.
// The emails intentionally do NOT include the coaching content; it is only
// shown securely on the signing page / in the toolkit.
function emailShell(inner: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#1b2a3d;max-width:560px">
    <div style="background:#1b2a3d;border-top:3px solid #c9a24a;border-radius:10px;padding:14px 16px;margin-bottom:16px">
      <div style="font-size:14px;font-weight:700;letter-spacing:4px;color:#c9a24a">LITSON</div>
      <div style="font-size:7.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#9fb0c4;margin-top:2px">PLLC &middot; Human Resources</div>
    </div>
    ${inner}
  </div>`;
}
function metaLine(row: any): string {
  const parts = [row.coaching_type || 'Coaching', row.date ? fmtLong(row.date) : '', row.coach_name ? `From ${row.coach_name}` : ''].filter(Boolean);
  return `<p style="font-size:13px;color:#666;margin:4px 0 0">${esc(parts.join(' &middot; '))}</p>`;
}

// Email to the employee: a brief notice + a button to review and sign.
// The coaching content is NOT included — it is shown on the signing page.
export function coachingEmailHtml(row: any, signUrl: string): string {
  return emailShell(`
    <p>Hi ${esc((row.employee || '').split(' ')[0] || 'there')},</p>
    <p>${esc(row.coach_name || 'Your coach')} has shared a <b>${esc(row.coaching_type || 'coaching')}</b> form with you to review and sign.</p>
    ${metaLine(row)}
    <p style="margin:18px 0"><a href="${esc(signUrl)}" style="display:inline-block;background:#1b2a3d;color:#fff;text-decoration:none;font-weight:bold;padding:11px 22px;border-radius:8px">Review &amp; sign the form</a></p>
    <p style="font-size:12px;color:#666">Or paste this link into your browser:<br>${esc(signUrl)}</p>
    <p style="font-size:11px;color:#999;margin-top:16px">For privacy, the coaching details are shown securely on the signing page, not in this email.</p>
  `);
}

// Receipt after signing, sent to employee + coach + HR. Confirmation only —
// the full form lives in the HR Toolkit (Coaching tab).
export function coachingReceiptHtml(row: any): string {
  return emailShell(`
    <p>The coaching form for <b>${esc(row.employee)}</b> has been <b>signed</b> and is on file.</p>
    <p style="font-size:13px;color:#33503f;margin:4px 0 0">Signed by ${esc(row.signature_name)} on ${esc(fmtStamp(row.signed_at))}.</p>
    ${metaLine(row)}
    <p style="font-size:12px;color:#888;margin-top:16px">The full form is available in the HR Toolkit &rsaquo; Coaching, where it can be downloaded as PDF or Word.</p>
  `);
}

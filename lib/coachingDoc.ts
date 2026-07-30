// Shared rendering for coaching forms: the standard draft per type, the printed
// document body (used in the PDF, the e-sign page, and the emails), and the two
// email templates. Kept framework-free so it works server- and client-side.

export const COACHING_TYPES = ['Weekly', '30-day check-in', '60-day check-in', '90-day check-in'] as const;

// The standard coaching draft the coach starts from (fully editable).
export function coachingDraft(type: string): string {
  const common = [
    'Discussion Summary:',
    '• ',
    '',
    'Strengths & Wins:',
    '• ',
    '',
    'Areas for Growth:',
    '• ',
    '',
    'Goals & Expectations:',
    '• ',
  ];
  const head: Record<string, string> = {
    'Weekly': 'This weekly coaching session reviews progress, wins, blockers, and goals for the week ahead.',
    '30-day check-in': 'This 30-day check-in reviews onboarding progress, role clarity, early wins, and the support needed to succeed.',
    '60-day check-in': 'This 60-day check-in reviews performance against expectations, skill development, and goals for the next period.',
    '90-day check-in': 'This 90-day review evaluates overall performance since hire, core competencies, and a forward development plan.',
  };
  return [head[type] ?? head['Weekly'], '', ...common].join('\n');
}

function esc(s: any): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
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
function parseSignatories(raw: any): { name: string; position: string }[] {
  try { const a = typeof raw === 'string' ? JSON.parse(raw) : raw; return Array.isArray(a) ? a : []; } catch { return []; }
}

// The full coaching document as branded HTML (Litson navy + gold).
export function coachingDocHtml(row: any): string {
  const bodyLines = String(row.notes ?? '').split('\n').map((l: string) => {
    const t = l.trim();
    if (t === '') return '<div style="height:8px"></div>';
    if (/^[•\-]\s*/.test(t)) return `<div style="margin-left:1.4em;text-indent:-1em">&bull;&nbsp;${esc(t.replace(/^[•\-]\s*/, ''))}</div>`;
    if (/:$/.test(t)) return `<div style="font-weight:700;margin-top:6px">${esc(t)}</div>`;
    return `<div>${esc(l)}</div>`;
  }).join('');
  const actions = String(row.action_items ?? '').split('\n').map((l: string) => l.trim()).filter(Boolean);
  const actionsHtml = actions.length
    ? `<div style="margin-top:14px"><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#8a8474;margin-bottom:4px">Action items</div>${actions.map(a => `<div style="margin-left:1.4em;text-indent:-1em">&bull;&nbsp;${esc(a)}</div>`).join('')}</div>`
    : '';
  const signers = parseSignatories(row.signatories);
  const signerRows = signers.map(s => `<tr><td style="padding:6px 10px;border:1px solid #e6ddcd">${esc(s.name)}</td><td style="padding:6px 10px;border:1px solid #e6ddcd;color:#555">${esc(s.position)}</td></tr>`).join('');
  const meta = (l: string, v: string) => `<div><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#8a8474">${esc(l)}</div><div style="font-weight:600;color:#1b2a3d">${esc(v) || '—'}</div></div>`;

  const signedBadge = row.signed_at
    ? `<div style="margin-top:18px;background:#eef5f1;border:1px solid #cfe4d8;border-radius:8px;padding:12px 14px">
         <div style="font-weight:700;color:#2f7d5b">✓ Electronically signed</div>
         <div style="font-size:13px;color:#33503f;margin-top:2px">Signed by <b>${esc(row.signature_name)}</b> on ${esc(fmtStamp(row.signed_at))}</div>
       </div>`
    : '';

  return `<div style="font-family:Georgia,'Times New Roman',serif;color:#1b2a3d;max-width:680px">
    <div style="background:#1b2a3d;border-top:3px solid #c9a24a;border-radius:10px;padding:16px 18px;margin-bottom:16px">
      <div style="font-size:15px;font-weight:700;letter-spacing:4px;color:#c9a24a">LITSON</div>
      <div style="font-size:7.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#9fb0c4;margin-top:2px">PLLC &middot; Human Resources</div>
      <div style="font-size:19px;font-weight:700;color:#fff;margin-top:9px">Coaching Form — ${esc(row.coaching_type || 'Weekly')}</div>
    </div>
    <div style="display:flex;gap:22px;flex-wrap:wrap;padding:0 2px 14px;border-bottom:1px solid #e6ddcd;margin-bottom:14px">
      ${meta('Employee', row.employee)}
      ${meta('Coaching date', fmtLong(row.date))}
      ${meta('Submitted by', row.coach_name)}
      ${meta('Position', row.coach_position)}
      ${row.submitted_at ? meta('Submitted', fmtStamp(row.submitted_at)) : ''}
    </div>
    ${row.topic ? `<div style="font-weight:700;margin-bottom:8px">${esc(row.topic)}</div>` : ''}
    <div style="font-size:14px;line-height:1.6">${bodyLines}</div>
    ${actionsHtml}
    ${signerRows ? `<div style="margin-top:16px"><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#8a8474;margin-bottom:5px">Signatories</div><table style="border-collapse:collapse;font-size:13px"><tr style="background:#faf7f0"><th align="left" style="padding:6px 10px;border:1px solid #e6ddcd">Name</th><th align="left" style="padding:6px 10px;border:1px solid #e6ddcd">Position</th></tr>${signerRows}</table></div>` : ''}
    ${signedBadge}
  </div>`;
}

// Email to the employee: the form + a button to review and sign.
export function coachingEmailHtml(row: any, signUrl: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#1b2a3d;max-width:680px">
    <p>Hi ${esc((row.employee || '').split(' ')[0] || 'there')},</p>
    <p>${esc(row.coach_name || 'Your coach')} has shared a <b>${esc(row.coaching_type || 'coaching')}</b> form with you. Please review it and sign electronically using the button below.</p>
    <p style="margin:18px 0"><a href="${esc(signUrl)}" style="display:inline-block;background:#1b2a3d;color:#fff;text-decoration:none;font-weight:bold;padding:11px 22px;border-radius:8px">Review &amp; sign the form</a></p>
    <p style="font-size:12px;color:#666">Or paste this link into your browser:<br>${esc(signUrl)}</p>
    <hr style="border:none;border-top:1px solid #e6ddcd;margin:18px 0">
    ${coachingDocHtml(row)}
  </div>`;
}

// Receipt after signing, sent to employee + coach + HR.
export function coachingReceiptHtml(row: any): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#1b2a3d;max-width:680px">
    <p>The following coaching form for <b>${esc(row.employee)}</b> has been <b>signed</b> and is on file.</p>
    <p style="font-size:13px;color:#33503f">Signed by ${esc(row.signature_name)} on ${esc(fmtStamp(row.signed_at))}.</p>
    <hr style="border:none;border-top:1px solid #e6ddcd;margin:16px 0">
    ${coachingDocHtml(row)}
  </div>`;
}

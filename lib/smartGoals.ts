// SMART Performance Development Goals — a structured form (separate from
// coaching). Each form has a header, one or more goals with the five SMART
// sections, open items for the reviewer, and an acknowledgment. Kept
// framework-free so the branded HTML renders server- and client-side.

export interface SmartGoal {
  id: string;
  title: string;
  specific: string;
  measurable: string;
  achievable: string;
  relevant: string;
  timeBound: string;
}

export interface SmartGoalsRow {
  id: string;
  employee: string;
  employee_email?: string;
  reviewer: string;
  reviewer_position?: string;
  review_date?: string;
  goals_prepared?: string;
  milestones?: string;
  goals: SmartGoal[];
  open_items: string[];
  status?: string;
  created_at?: string;
}

let _n = 0;
function gid() { return `g${Date.now().toString(36)}${(_n++).toString(36)}${Math.random().toString(36).slice(2, 5)}`; }

export function emptyGoal(): SmartGoal {
  return { id: gid(), title: '', specific: '', measurable: '', achievable: '', relevant: '', timeBound: '' };
}
export function emptyForm(): Partial<SmartGoalsRow> {
  return { employee: '', employee_email: '', reviewer: '', reviewer_position: '', review_date: '', goals_prepared: '', milestones: '', goals: [emptyGoal()], open_items: [''], status: 'Draft' };
}

export function parseGoals(raw: any): SmartGoal[] {
  try {
    const a = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(a)) return [];
    return a.map((g: any) => ({
      id: String(g?.id ?? gid()), title: String(g?.title ?? ''),
      specific: String(g?.specific ?? ''), measurable: String(g?.measurable ?? ''),
      achievable: String(g?.achievable ?? ''), relevant: String(g?.relevant ?? ''),
      timeBound: String(g?.timeBound ?? ''),
    }));
  } catch { return []; }
}
export function parseItems(raw: any): string[] {
  try { const a = typeof raw === 'string' ? JSON.parse(raw) : raw; return Array.isArray(a) ? a.map(String) : []; } catch { return []; }
}

function esc(s: any): string { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
// Preserve line breaks in a free-text section.
function multiline(s: any): string { return esc(s).replace(/\n/g, '<br>'); }
export function fmtLong(iso: any): string {
  if (!iso) return '';
  const d = new Date(String(iso).length <= 10 ? String(iso).slice(0, 10) + 'T12:00:00' : iso);
  return isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

// The full SMART Goals document as branded HTML (Litson navy + gold).
export function smartGoalsDocHtml(row: SmartGoalsRow): string {
  const meta = (l: string, v: string) => `<div><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#8a8474">${esc(l)}</div><div style="font-weight:600;color:#1b2a3d">${esc(v) || '—'}</div></div>`;
  const smartRow = (letter: string, label: string, val: string) => val && val.trim()
    ? `<div style="margin:6px 0"><span style="display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;border-radius:5px;background:#1b2a3d;color:#c9a24a;font-weight:700;font-size:12px;margin-right:8px">${letter}</span><b style="color:#1b2a3d">${esc(label)}</b><div style="margin:3px 0 0 30px;color:#333">${multiline(val)}</div></div>`
    : '';
  const goalsHtml = (row.goals ?? []).map((g, i) => `
    <div style="margin-top:16px;break-inside:avoid">
      <div style="font-size:15px;font-weight:700;color:#1b2a3d;border-left:4px solid #c9a24a;padding-left:10px">${esc(g.title || `Goal ${i + 1}`)}</div>
      <div style="margin-top:6px">
        ${smartRow('S', 'Specific', g.specific)}
        ${smartRow('M', 'Measurable', g.measurable)}
        ${smartRow('A', 'Achievable', g.achievable)}
        ${smartRow('R', 'Relevant', g.relevant)}
        ${smartRow('T', 'Time-bound', g.timeBound)}
      </div>
    </div>`).join('');
  const items = (row.open_items ?? []).map(s => String(s).trim()).filter(Boolean);
  const openItemsHtml = items.length
    ? `<div style="margin-top:18px"><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#8a8474;margin-bottom:4px">Open items for reviewer</div><ol style="margin:0;padding-left:20px;color:#333">${items.map(i => `<li style="margin:3px 0">${multiline(i)}</li>`).join('')}</ol></div>`
    : '';

  return `<div style="font-family:Georgia,'Times New Roman',serif;color:#1b2a3d;max-width:700px">
    <div style="background:#1b2a3d;border-top:3px solid #c9a24a;border-radius:10px;padding:16px 18px;margin-bottom:16px">
      <div style="font-size:15px;font-weight:700;letter-spacing:4px;color:#c9a24a">LITSON</div>
      <div style="font-size:7.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#9fb0c4;margin-top:2px">PLLC &middot; Human Resources</div>
      <div style="font-size:19px;font-weight:700;color:#fff;margin-top:9px">SMART Performance Development Goals</div>
    </div>
    <div style="display:flex;gap:22px;flex-wrap:wrap;padding:0 2px 14px;border-bottom:1px solid #e6ddcd;margin-bottom:6px">
      ${meta('Employee', row.employee)}
      ${meta('Reviewer', row.reviewer)}
      ${row.reviewer_position ? meta('Reviewer position', row.reviewer_position) : ''}
      ${meta('Review date', fmtLong(row.review_date))}
      ${row.goals_prepared ? meta('Goals prepared', fmtLong(row.goals_prepared)) : ''}
    </div>
    ${row.milestones && row.milestones.trim() ? `<div style="font-size:13px;color:#33503f;margin:10px 0 2px"><b>Milestones:</b> ${esc(row.milestones)}</div>` : ''}
    ${goalsHtml}
    ${openItemsHtml}
    <div style="margin-top:20px;border-top:1px solid #e6ddcd;padding-top:12px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#8a8474;margin-bottom:6px">Acknowledgment</div>
      <div style="font-size:13px;color:#333">These goals have been discussed with me and I have had the opportunity to provide input.</div>
      <div style="margin-top:18px;font-size:13px;color:#1b2a3d">Employee signature: <span style="display:inline-block;border-bottom:1px solid #999;width:230px">&nbsp;</span> &nbsp; Date: <span style="display:inline-block;border-bottom:1px solid #999;width:110px">&nbsp;</span></div>
      <div style="margin-top:14px;font-size:13px;color:#1b2a3d">Reviewer signature: <span style="display:inline-block;border-bottom:1px solid #999;width:230px">&nbsp;</span> &nbsp; Date: <span style="display:inline-block;border-bottom:1px solid #999;width:110px">&nbsp;</span></div>
    </div>
  </div>`;
}

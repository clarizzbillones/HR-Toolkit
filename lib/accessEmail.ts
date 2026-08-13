import { SECTIONS, REPORT_TABS } from './access';

// Builds the "you've been given access" invite email for a viewer grant.
export function buildAccessInvite(opts: {
  name: string;
  email: string;
  sections: string[];
  reportTabs: string[];
  appUrl: string;
  password: string;
  full?: boolean;          // full-access admin invite (not a view-only viewer)
  editSections?: string[]; // sections this person may edit (subset of sections)
}): { subject: string; html: string } {
  const first = (opts.name || opts.email.split('@')[0]).split(' ')[0];
  const secLabel = (k: string) => SECTIONS.find(s => s.key === k)?.label ?? k;
  const tabLabel = (k: string) => REPORT_TABS.find(t => t.key === k)?.label ?? k;
  const editSet = new Set(opts.editSections ?? []);
  const canEditAny = opts.sections.some(k => editSet.has(k));
  const url = (opts.appUrl || '').replace(/\/$/, '') || 'https://hr-toolkit-delta.vercel.app';

  // Editable sections get a gold "✎" chip; view-only sections stay blue.
  const chip = (t: string, editable = false) => editable
    ? `<span style="display:inline-block;background:#f7efe1;color:#b07d2a;border:1px solid #e0c48a;font-size:12px;font-weight:600;padding:3px 10px;border-radius:12px;margin:0 6px 6px 0">✎ ${t}</span>`
    : `<span style="display:inline-block;background:#eef2f7;color:#3f5a76;font-size:12px;font-weight:600;padding:3px 10px;border-radius:12px;margin:0 6px 6px 0">${t}</span>`;
  const sectionChips = opts.sections.length ? opts.sections.map(k => chip(secLabel(k), editSet.has(k))).join('') : '<span style="color:#888">—</span>';
  const tabChips = opts.reportTabs.length
    ? `<div style="margin-top:14px"><div style="font-size:12px;font-weight:700;color:#8a6d3b;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">Within Reports, you can view</div>${opts.reportTabs.map(k => chip(tabLabel(k))).join('')}</div>`
    : '';
  const editNote = canEditAny
    ? `<div style="font-size:12px;color:#8a6d3b;line-height:1.5;margin-top:10px"><strong>✎</strong> = you can add &amp; edit entries here (e.g. your initials, dates and notes). Everything else is view-only.</div>`
    : '';

  const subject = opts.full ? 'Your admin access to the Litson HR Toolkit' : 'Your access to the Litson HR Toolkit';
  const banner = opts.full ? 'HR TOOLKIT · FULL ACCESS' : canEditAny ? 'HR TOOLKIT · TEAM ACCESS' : 'HR TOOLKIT · VIEWER ACCESS';
  const viewerIntro = canEditAny
    ? `You've been given access to the Litson HR Toolkit. You can open the sections below — and on the ones marked <strong>✎</strong> you can add and edit entries; the rest are view-only.`
    : `You've been given <strong>view-only access</strong> to the Litson HR Toolkit. You can open the sections below and view (but not edit) their information.`;
  const introHtml = opts.full
    ? `<p style="font-size:14px;line-height:1.6;margin:0 0 18px">You've been given <strong>full access</strong> to the Litson HR Toolkit — you can open and edit every section, and manage access for others.</p>
        <div style="background:#eef5f1;border:1px solid #cfe4d8;border-radius:8px;padding:16px 18px;margin:0 0 20px">
          <div style="font-size:12px;font-weight:700;color:#2f7d5b;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">Your access</div>
          <div style="font-size:14px;line-height:1.6;color:#2a2a2a">Full access to every section, including Employee Files — plus access management.</div>
        </div>`
    : `<p style="font-size:14px;line-height:1.6;margin:0 0 18px">${viewerIntro}</p>

        <div style="background:#faf7f0;border:1px solid #efe6d5;border-radius:8px;padding:16px 18px;margin:0 0 20px">
          <div style="font-size:12px;font-weight:700;color:#8a6d3b;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">${canEditAny ? 'Sections you can open' : 'Sections you can view'}</div>
          ${sectionChips}
          ${tabChips}
          ${editNote}
        </div>`;
  const html = `<!DOCTYPE html><html><body style="margin:0;background:#f4f1ea;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#2a2a2a">
    <div style="max-width:560px;margin:0 auto;padding:24px 16px">
      <div style="background-color:#ffffff;padding:22px 28px;border-radius:10px 10px 0 0;border:1px solid #e6ddcd;border-bottom:4px solid #c9a24a">
        <div style="font-size:26px;font-weight:800;letter-spacing:.20em;color:#1b2a3d">LITSON</div>
        <div style="font-size:11px;color:#8a6d3b;letter-spacing:.12em;font-weight:600;margin-top:2px">${banner}</div>
      </div>
      <div style="background:#fff;padding:26px 28px;border-radius:0 0 10px 10px;border:1px solid #e6ddcd;border-top:none">
        <p style="font-size:15px;margin:0 0 14px">Hi ${first},</p>
        ${introHtml}

        <div style="background:#f4f8fb;border:1px solid #d9e4ee;border-radius:8px;padding:16px 18px;margin:0 0 22px">
          <div style="font-size:12px;font-weight:700;color:#3f5a76;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">How to sign in</div>
          <div style="font-size:14px;line-height:1.7">
            1. Go to <a href="${url}" style="color:#3f6b8a;font-weight:600">${url.replace(/^https?:\/\//, '')}</a><br>
            2. Enter your email: <strong>${opts.email}</strong><br>
            3. Access password: <strong style="font-family:monospace;background:#fff;padding:1px 6px;border-radius:4px;border:1px solid #d9e4ee">${opts.password}</strong>
          </div>
        </div>

        <a href="${url}" style="display:inline-block;background:#1b2a3d;color:#fff;font-size:14px;font-weight:600;text-decoration:none;padding:11px 22px;border-radius:8px">Open the HR Toolkit →</a>

        <p style="font-size:12px;color:#999;line-height:1.6;margin:22px 0 0">If you weren't expecting this, you can ignore this email. Questions? Just reply.</p>
      </div>
    </div>
  </body></html>`;
  return { subject, html };
}

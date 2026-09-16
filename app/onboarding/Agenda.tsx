'use client';
import { useState } from 'react';
import { useToast } from '@/components/Toast';

// ── Agenda content (from "Litson Onboarding Call Agendas") ──────────────────
type Block =
  | { h: string }
  | { p: string }
  | { note: string }
  | { tiny: string }
  | { checks: string[] }
  | { meta: [string, string][] }
  | { table: { headers: string[]; rows: string[][]; widths?: number[] } }
  | { notes: true };
interface Section { title: string; kicker?: string; page?: boolean; blocks: Block[] }

const SECTIONS: Section[] = [
  {
    title: 'New hire — standard first day',
    kicker: 'Onboarding call agendas · Draft for review',
    blocks: [
      { tiny: 'Prepared by HR · Litson PLLC' },
      { meta: [['Prepared for', '[New hire name]'], ['Start date', '[START DATE]']] },
      { p: 'These four calls run in the same order for every new hire. Each has a distinct purpose so the meetings do not overlap: the first is the welcome and the map of the firm, the second is how we actually work and use our legal systems, the third is the employee’s own HR setup, and the fourth is money and expenses.' },
      { note: 'This is a draft template. Each lead can customize or add to their own section. Placeholders in brackets are filled in per hire.' },
      { h: 'Order of calls' },
      { table: { widths: [6, 30, 26, 13, 25], headers: ['#', 'Call', 'Led by', 'Duration', 'Focus'], rows: [
        ['1', 'Initial onboarding call', 'Clarizz + Catie', '45 min', 'Welcome and map of the firm'],
        ['2', 'Legal systems & operations', 'Caitlin', '45 min', 'How we work and the systems used'],
        ['3', 'HR meeting', 'Clarizz', '45 min', 'The employee’s own setup'],
        ['4', 'Finance meeting', 'Ryan', '45 min', 'Money and expenses'],
        ['5', '1:1 with Paula', 'Paula', '45 min', 'Inbox Management'],
        ['6', 'EOD check in', 'Alex / Caitlin', '45 min', 'Check in'],
        ['7', '1:1 with Simran (Day 2)', 'Simran', '45 min', 'PACER and admissions'],
      ] } },
      { h: 'Before the first call' },
      { checks: [
        'Laptop delivered, set up, and tested — IT / Catie',
        'All accounts created per the onboarding checklist — HR and Catie',
        'Ramp card activated — depends on laptop setup; confirm before Call 4',
        'Onboarding form submitted by the new hire',
        'Calendar invites sent for all four calls',
      ] },
      { note: 'Account creation happens before the first day. Configuration, training, and access confirmation happen on these calls.' },
    ],
  },
  {
    title: 'Call 1 — Initial onboarding call', kicker: 'Onboarding call agenda — [New hire name]', page: true,
    blocks: [
      { meta: [
        ['Led by', 'Clarizz Ann Alon — HR Admin Specialist, and Catie Toole — Director of Operations'],
        ['Suggested duration', '45 minutes'],
        ['Start date', '[START DATE]'],
        ['Purpose', 'Welcome, and making sure they can actually get started.'],
      ] },
      { h: '1. Welcome and introductions' },
      { checks: ['Introductions — who is on the call and what each of you does', 'Brief overview of the firm and what the new hire will be working on'] },
      { h: '2. Access check — can they get in' },
      { note: 'This is a can-you-log-in check only. System-by-system configuration happens in Call 2.' },
      { checks: ['Laptop working and required software installed', 'Signed into firm email', 'Multi-factor authentication and password manager set up', 'Signed into all active accounts', 'Note anything not working and who is fixing it'] },
      { h: '3. Firm roster and points of contact' },
      { note: 'The full roster is covered here only, so later calls do not repeat it.' },
      { table: { widths: [52, 48], headers: ['Need', 'Go to'], rows: [
        ['Legal workflows, case setup, Clio, e-filing, practice systems', 'Caitlin Giuliano — Legal Operations Coordinator'],
        ['Operations, process and policy questions', 'Caitlin Giuliano — Legal Operations Coordinator'],
        ['Escalations', 'Catie Toole — Director of Operations'],
        ['HR, onboarding paperwork, benefits, PTO, email and account provisioning', 'Clarizz Ann Alon — HR Admin Specialist'],
        ['Ramp card, expenses, reimbursements, Uber for Business', 'Ryan Leite — Financial Administrator'],
        ['Laptop, software installs, login and access issues', 'Matthew Nunez — IT'],
        ['Case strategy', 'Alex Little — Founding Partner'],
      ] } },
      { checks: ['Walk through the roster and confirm they know how to reach each person'] },
      { h: '4. First day schedule' },
      { checks: ['Explain the sequence of today’s calls and roughly how long each runs', 'Review the remaining introductory meetings and who they will meet with', 'Confirm all calendar invites have been received'] },
      { h: '5. Settling in' },
      { checks: ['Working hours, time zone, and core availability', 'Communication norms — where to ask questions and expected response times', 'Answer any immediate questions about getting settled'] },
      { h: '6. Close' },
      { checks: ['Confirm the time of the next call', 'Record follow-ups and who owns each'] },
      { h: 'Notes / Follow-ups' }, { notes: true },
    ],
  },
  {
    title: 'Call 2 — Legal systems and operations', kicker: 'Onboarding call agenda — [New hire name]', page: true,
    blocks: [
      { meta: [
        ['Led by', 'Caitlin Giuliano — Legal Operations Coordinator'],
        ['Suggested duration', '45 minutes — the heaviest call of the day'],
        ['Purpose', 'Get them comfortable with the systems and legal workflow they will actually use.'],
      ] },
      { h: '1. Your role as their day-to-day contact' },
      { note: 'The full firm roster is covered in Call 1. Keep this short — what comes to you, and what gets escalated.' },
      { checks: ['Introduce yourself as their day-to-day contact for legal, practice, and operations questions', 'Explain what to bring to you and what to escalate to Catie'] },
      { h: 'Accounts and access' },
      { note: 'Review all relevant accounts and confirm access. Mark any item that does not apply to this role.' },
      { h: '2. Donna' }, { checks: ['Confirm access', 'Walk through day-to-day use'] },
      { h: '3. Ajax' }, { checks: ['Confirm access', 'Walk through the training link', 'Explain actual day-to-day use', 'Explain that Ajax is used for automated time tracking', 'Set up their Ajax account and book the required onboarding call'] },
      { h: '4. Clio' }, { note: 'Heaviest item — allow the most time.' }, { checks: ['Confirm access', 'Set billing rates in their user settings', 'Add them to the rate table for national rates', 'Adjust each pardon and national case individually'] },
      { h: '5. PACER' }, { checks: ['Confirm they have their own account', 'Confirm they have shared access with the firm'] },
      { h: '6. Tybera' }, { checks: ['If they have an account: they update account info and share with the firm', 'If not: the firm sets it up'] },
      { h: '7. Westlaw' }, { checks: ['Walk through their access'] },
      { h: '8. Lawline' }, { checks: ['[To be confirmed — Catie / Caitlin]'] },
      { h: '9. Davidson County court systems — e-filing' }, { checks: ['[To be confirmed — Catie / Caitlin]'] },
      { h: 'Workflow and orientation' },
      { h: '10. Onboarding intake survey' }, { checks: ['Confirm onboarding intake survey information is accurate'] },
      { h: '11. File storage' }, { checks: ['Review file storage — Dropbox for now, transitioning to Box'] },
      { h: '12. Case and work responsibilities' }, { checks: ['Begin discussing their case and work responsibilities', 'Explain where information lives and how the systems interact'] },
      { h: '13. Role-specific legal operations' }, { checks: ['Cover any role-specific legal operations and processes they need to know'] },
      { h: 'Notes / Follow-ups' }, { notes: true },
    ],
  },
  {
    title: 'Call 3 — HR meeting', kicker: 'Onboarding call agenda — [New hire name]', page: true,
    blocks: [
      { meta: [
        ['Led by', 'Clarizz Ann Alon — HR Admin Specialist'],
        ['Suggested duration', '45 minutes'],
        ['Purpose', 'Employee-specific HR and administrative setup — the new hire as an employee.'],
      ] },
      { h: '1. Required paperwork' },
      { checks: ['Form I-9 — Section 1 complete — Section 2 must be verified within 3 business days of the start date', 'W-4 and state withholding on file', 'Direct deposit confirmed', 'Emergency contact and personal details verified'] },
      { h: '2. Benefits' },
      { checks: ['Walk through the benefits package — attorney or support staff version', 'Medical, dental, vision, and life insurance', '401(k) — Guideline enrollment', 'State the enrollment deadline and the specific date it falls on'] },
      { h: '3. Admin portal' }, { checks: ['Walk through admin portal access and day-to-day use'] },
      { h: '4. Employee handbook and policies' }, { checks: ['Review the employee handbook', 'Collect the signed acknowledgment and file it', 'Overview of company policies'] },
      { h: '5. Time off' }, { checks: ['Unlimited PTO — how it works and what is expected', 'Walk through the PTO request form', 'Firm holidays'] },
      { h: '6. Performance review' }, { checks: ['What to expect and how it works'] },
      { h: '7. HR expectations and process' }, { checks: ['How to reach HR and expected response times', 'Performance review cycle and check-in cadence', 'Explain that the first weekly check-in is scheduled by HR, and later ones by Caitlin'] },
      { h: '8. Close' }, { checks: ['Answer any HR questions', 'Record follow-ups and outstanding paperwork'] },
      { h: 'Notes / Follow-ups' }, { notes: true },
    ],
  },
  {
    title: 'Call 4 — Finance meeting', kicker: 'Onboarding call agenda — [New hire name]', page: true,
    blocks: [
      { meta: [
        ['Led by', 'Ryan Leite — Financial Administrator'],
        ['Suggested duration', '45 minutes'],
        ['Purpose', 'Get them set up to handle company-related purchases and understand financial expectations.'],
      ] },
      { h: '1. Finance policies' }, { checks: ['Overview of company finance policies', 'Spending limits and what needs pre-approval'] },
      { h: '2. Ramp' }, { note: 'Card activation depends on laptop setup — confirm it is active before this call.' }, { checks: ['Confirm the Ramp card is activated', 'Account setup and walkthrough', 'Make a few actual purchases or subscriptions so they learn the process — e.g. Claude, Adobe'] },
      { h: '3. Uber for Business' }, { checks: ['Business Uber setup', 'When it may and may not be used'] },
      { h: '4. Expenses and receipts' }, { checks: ['Receipts — what to keep and how to submit them', 'Approvals and expected turnaround', 'Reimbursement process for out-of-pocket spend'] },
      { h: '5. Ongoing expectations' }, { checks: ['Recurring subscriptions and renewals', 'Who to contact for finance questions'] },
      { h: '6. Close' }, { checks: ['Answer finance-related questions', 'Record follow-ups'] },
      { h: 'Notes / Follow-ups' }, { notes: true },
    ],
  },
];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const FONT = 'Calibri,"Segoe UI",Arial,sans-serif';
const NAVY = '#1F2A44';
const GOLD = '#c9a24a';
const GRAY = '#666666';
const GRAY2 = '#888888';
const THFILL = '#E4E8EF';
const BORDER = '#cfd6e0';
const BOX = '&#9744;'; // ☐

export default function Agenda() {
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');

  const sub = (s: string) =>
    s.replace(/\[New hire name\]/g, name.trim() || '[New hire name]')
     .replace(/\[START DATE\]/g, startDate.trim() || '[Start date]');

  // Everything is rendered with INLINE styles so Word and the browser (PDF)
  // look identical — Word drops CSS class rules but honors inline styles.
  function blockHtml(b: Block): string {
    if ('h' in b) {
      // Numbered items are navy bold headings; the rest are small gray uppercase
      // section labels (ORDER OF CALLS, ACCOUNTS AND ACCESS, …).
      if (/^\d+\./.test(b.h.trim()))
        return `<div style="font-family:${FONT};font-weight:bold;color:${NAVY};font-size:11.5pt;margin:9pt 0 3pt">${esc(sub(b.h))}</div>`;
      return `<div style="font-family:${FONT};font-weight:bold;color:${GRAY};font-size:9.5pt;letter-spacing:1px;text-transform:uppercase;margin:11pt 0 4pt">${esc(sub(b.h))}</div>`;
    }
    if ('p' in b) return `<p style="font-family:${FONT};font-size:11pt;line-height:1.4;margin:3pt 0">${esc(sub(b.p))}</p>`;
    if ('note' in b) return `<p style="font-family:${FONT};color:${GRAY};font-size:9.5pt;margin:2pt 0 5pt">${esc(sub(b.note))}</p>`;
    if ('tiny' in b) return `<p style="font-family:${FONT};color:${GRAY2};font-size:9.5pt;margin:1pt 0 8pt">${esc(sub(b.tiny))}</p>`;
    if ('checks' in b) return b.checks.map(c => `<div style="font-family:${FONT};font-size:10.5pt;color:#1a1a2e;margin:2pt 0">${BOX}&nbsp;&nbsp;${esc(sub(c))}</div>`).join('');
    if ('meta' in b) return b.meta.map(([k, v]) => `<p style="font-family:${FONT};font-size:11pt;font-weight:bold;color:#1a1a2e;margin:2pt 0">${esc(k)}:&nbsp;&nbsp;${esc(sub(v))}</p>`).join('');
    if ('table' in b) {
      const cg = b.table.widths ? `<colgroup>${b.table.widths.map(w => `<col style="width:${w}%">`).join('')}</colgroup>` : '';
      return `<table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;margin:7pt 0 11pt;border:0.75pt solid ${BORDER}">${cg}<thead><tr>${b.table.headers.map(h => `<th style="background:${THFILL};color:#1a1a2e;text-align:left;padding:6px 9px;font-family:${FONT};font-weight:bold;font-size:9.5pt;border:0.75pt solid ${BORDER}">${esc(h)}</th>`).join('')}</tr></thead><tbody>${b.table.rows.map((r, ri) => `<tr>${r.map(c => `<td style="border:0.75pt solid ${BORDER};padding:6px 9px;font-family:${FONT};font-size:9.5pt;line-height:1.35;vertical-align:top;background:${ri % 2 ? '#F4F6F9' : '#ffffff'}">${esc(sub(c))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    }
    if ('notes' in b) return `<div style="border:0.75pt solid ${BORDER};height:62px;margin:4pt 0 8pt"></div>`;
    return '';
  }

  function sectionHtml(s: Section, forExport = false): string {
    const brk = forExport && s.page ? `<br clear="all" style="page-break-before:always">` : '';
    const titleSize = s.page ? 15 : 16;
    // Letterhead: small navy LITSON wordmark, then the title + kicker.
    return brk
      + `<div style="font-family:${FONT};font-weight:bold;color:${NAVY};font-size:11pt;margin:0 0 4pt">LITSON</div>`
      + `<div style="font-family:${FONT};font-weight:bold;color:${NAVY};font-size:${titleSize}pt;margin:0 0 2pt">${esc(sub(s.title))}</div>`
      + (s.kicker ? `<div style="font-family:${FONT};color:${GRAY};font-size:10pt;margin:0 0 10pt">${esc(sub(s.kicker))}</div>` : '')
      + s.blocks.map(blockHtml).join('');
  }

  function fullHtml(): string {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Litson Onboarding Call Agendas${name.trim() ? ` — ${esc(name.trim())}` : ''}</title>`
      + `<style>@page{size:8.5in 11in;margin:1in}</style></head>`
      + `<body style="font-family:${FONT};color:#1a1a2e;font-size:11pt;line-height:1.4;margin:0">`
      + SECTIONS.map(s => sectionHtml(s, true)).join('')
      + `<div style="margin-top:16pt;border-top:0.5pt solid #aaa;padding-top:5pt;font-family:Arial,sans-serif;font-size:8pt;color:#888">Prepared by HR · Litson PLLC · Draft for review</div>`
      + `</body></html>`;
  }

  function downloadPdf() {
    const w = window.open('', '_blank');
    if (!w) { showToast('Allow pop-ups to download the PDF'); return; }
    w.document.write(fullHtml() + '<script>window.onload=function(){window.print()}<\/script>');
    w.document.close();
  }
  function downloadWord() {
    const header = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">';
    const html = fullHtml().replace('<!DOCTYPE html><html>', header);
    const blob = new Blob(['﻿', html], { type: 'application/msword' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Litson-Onboarding-Call-Agendas${name.trim() ? '-' + name.trim().replace(/\s+/g, '-') : ''}.doc`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
    showToast('Word document downloaded');
  }

  const inputCls = 'border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink';

  return (
    <div className="flex-1 overflow-auto px-8 py-6">
      <div className="max-w-3xl mx-auto">
        {/* Controls */}
        <div className="bg-white border border-border rounded-card p-5 mb-5 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1">New hire name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Bill Abely" className={inputCls + ' w-52'} />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1">Start date</label>
            <input value={startDate} onChange={e => setStartDate(e.target.value)} placeholder="September 22, 2026" className={inputCls + ' w-52'} />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={downloadPdf} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark">🖨 Download PDF</button>
            <button onClick={downloadWord} className="bg-white border border-border-light text-ink text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-canvas">⬇ Download Word</button>
          </div>
          <p className="w-full text-[11px] text-text-muted">Fill in the name and start date to personalize every call agenda, then download. The PDF and Word files use the same layout.</p>
        </div>

        {/* Live preview — identical inline styles to the exported files */}
        <div className="bg-white border border-border rounded-card p-8 shadow-sm">
          <div dangerouslySetInnerHTML={{ __html: SECTIONS.map(s => sectionHtml(s)).join('') }} />
        </div>
      </div>
    </div>
  );
}

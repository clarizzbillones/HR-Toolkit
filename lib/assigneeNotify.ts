// Notify onboarding/offboarding document assignees by email. Emails are resolved
// ONLY from Access Control (viewers + admins) so we never email someone who
// isn't set up in the toolkit — no guessing addresses.

import { sql } from './db';
import { listPortalAdmins } from './adminGrants';
import { accessAdminList, hrAdminList } from './access';
import { sendMailAsApp } from './graph';

const SENDER = process.env.REVIEW_REMINDER_SENDER ?? 'clarizz@litson.co';
// When a person is known by more than one address, deliver to their firm
// mailbox (litson.co) rather than any personal/other address on file.
const FIRM_DOMAIN = (process.env.FIRM_EMAIL_DOMAIN ?? 'litson.co').toLowerCase();
const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const norm = (s: any) => String(s ?? '').normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().toLowerCase();

export interface Person { name: string; email: string }

// Canonical mailboxes that override whatever else is on file for a person,
// keyed by their first name (normalized). This guarantees mail always goes to
// the right inbox even if an older/alternate address is stored. Clarizz's mail
// always goes to her litson.co mailbox; add more via CANONICAL_EMAILS
// ("clarizz=clarizz@litson.co; jane=jane@litson.co").
function canonicalEmails(): Record<string, string> {
  const m: Record<string, string> = { clarizz: 'clarizz@litson.co' };
  for (const pair of String(process.env.CANONICAL_EMAILS ?? '').split(/[;,]/)) {
    const [k, v] = pair.split('=').map(s => (s ?? '').trim());
    if (k && v) m[norm(k)] = v;
  }
  return m;
}

// Everyone the toolkit knows an email for: Access Control viewers, portal
// admins, and env-configured admins.
export async function directoryPeople(): Promise<Person[]> {
  const out: Person[] = [];
  try { const g = await sql`SELECT email, name FROM access_grants` as any[]; for (const r of g) if (r.email) out.push({ name: r.name || '', email: String(r.email) }); } catch { /* no table */ }
  try { const pa = await listPortalAdmins(); for (const a of pa) if (a.email) out.push({ name: a.name || '', email: a.email }); } catch { /* ignore */ }
  // Give admin/env firm addresses a name derived from the local-part (e.g.
  // clarizz@litson.co -> "clarizz") so they can be matched by name, not just
  // by email local-part — and so the firm mailbox is always a candidate.
  for (const e of new Set([...accessAdminList(), ...hrAdminList()])) if (e) out.push({ name: e.split('@')[0].replace(/[._]+/g, ' '), email: e });
  // Force any person whose first name has a canonical mailbox onto that address,
  // so an alternate address on file can never receive their mail.
  const canon = canonicalEmails();
  for (const p of out) { const first = norm(p.name).split(' ')[0]; if (first && canon[first]) p.email = canon[first]; }
  const seen = new Set<string>(); const uniq: Person[] = [];
  for (const p of out) { const k = p.email.toLowerCase(); if (!seen.has(k)) { seen.add(k); uniq.push(p); } }
  return uniq;
}

// Match an assignee display name (e.g. "Catie", "Matthew") to a known person by
// full name, first name, or the email's local-part.
export function resolvePerson(assignee: string, people: Person[]): Person | null {
  const a = norm(assignee); if (!a) return null;
  // Collect every person that matches (by full/first name, then email local-part)
  // so we can prefer the firm mailbox when someone has more than one address.
  const aFirst = a.split(' ')[0];
  const matches: Person[] = [];
  for (const p of people) {
    const nm = norm(p.name);
    if (nm && (nm === a || nm.split(' ')[0] === a || nm.split(' ').includes(a) || nm.split(' ')[0] === aFirst)) matches.push(p);
  }
  for (const p of people) {
    if (matches.includes(p)) continue;
    const local = norm(p.email.split('@')[0]);
    if (local === a || local.replace(/\s+/g, '') === a.replace(/\s+/g, '')) matches.push(p);
  }
  if (!matches.length) return null;
  // Prefer the firm (litson.co) mailbox over any other address on file.
  return matches.find(p => p.email.toLowerCase().endsWith('@' + FIRM_DOMAIN)) ?? matches[0];
}

function notifyHtml(firstName: string, employeeName: string, kindLabel: string, tasks: { label: string; deadline?: string }[], url: string): string {
  const first = esc(String(firstName || '').split(' ')[0] || 'there');
  const items = tasks.map(t => `<li style="margin:4px 0">${esc(t.label)}${t.deadline ? ` <span style="color:#b07d2a">— due ${esc(fmtDate(t.deadline))}</span>` : ''}</li>`).join('');
  return `<div style="font-family:Arial,sans-serif;color:#1b2a3d;max-width:560px">
    <div style="background:#1b2a3d;border-top:3px solid #c9a24a;border-radius:10px;padding:14px 16px;margin-bottom:16px">
      <div style="font-size:14px;font-weight:700;letter-spacing:4px;color:#c9a24a">LITSON</div>
      <div style="font-size:7.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#9fb0c4;margin-top:2px">PLLC &middot; Human Resources</div>
    </div>
    <p>Hi ${first},</p>
    <p>You've been assigned the following ${esc(kindLabel.toLowerCase())} task${tasks.length === 1 ? '' : 's'} for <b>${esc(employeeName)}</b>:</p>
    <ul style="padding-left:18px">${items}</ul>
    <p style="margin:16px 0"><a href="${esc(url)}" style="display:inline-block;background:#1b2a3d;color:#fff;text-decoration:none;font-weight:bold;padding:10px 20px;border-radius:8px">Open the HR Toolkit</a></p>
    <p style="font-size:12px;color:#666">Please complete your part and mark it done in the document.</p>
  </div>`;
}
function fmtDate(s: any) { if (!s) return ''; const d = new Date(String(s).slice(0, 10) + 'T12:00:00'); return isNaN(+d) ? String(s) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }

export interface NotifyGroup { assignee: string; tasks: { label: string; deadline?: string }[] }

// Send one email per assignee with their incomplete tasks. Returns who was
// emailed and who was skipped (no Access Control email on file).
export async function notifyAssignees(opts: { employeeName: string; kindLabel: string; groups: NotifyGroup[]; appUrl: string }) {
  const people = await directoryPeople();
  const sent: { name: string; email: string; count: number }[] = [];
  const skipped: string[] = [];
  for (const g of opts.groups) {
    if (!g.tasks.length) continue;
    const person = resolvePerson(g.assignee, people);
    if (!person) { skipped.push(g.assignee); continue; }
    const html = notifyHtml(g.assignee, opts.employeeName, opts.kindLabel, g.tasks, opts.appUrl);
    const r = await sendMailAsApp(SENDER, person.email, `Litson PLLC — ${opts.kindLabel} tasks assigned to you`, html);
    if (r.ok) sent.push({ name: g.assignee, email: person.email, count: g.tasks.length }); else skipped.push(g.assignee);
  }
  return { sent, skipped };
}

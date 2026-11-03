export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';
import { normName } from '@/lib/employeeFiles';
import { parseDoc as parseOnbDoc } from '@/lib/onboardingDoc';
import { parseDoc as parseOffDoc } from '@/lib/offboardingDoc';

// The open onboarding/offboarding document tasks assigned to the person viewing
// the dashboard. A task is "open" when it has an assignee that matches the
// current user and no Date-done yet. Assignees are first-name-style labels
// (Catie, Clarizz, Matthew, …), so we match the logged-in user by their email
// local part, their session name, and their Access Control name.
export async function GET() {
  const session = await getServerSession(authOptions);
  const email = (session?.user?.email ?? '').toLowerCase();
  if (!email) return NextResponse.json({ tasks: [] });

  // Build the set of names that count as "me". Assignees are first-name labels
  // (Catie, Clarizz, Caitlin, Matthew, Ryan…), so we add the full normalized
  // value AND every individual word of it — the viewer's email local part, their
  // session name, and their Access Control name. Matching on any word (not just
  // the first) means a display name stored in any order — "Clarizz Ann Billones"
  // or "Billones, Clarizz" — still resolves to the "Clarizz" assignee.
  const keys = new Set<string>();
  const add = (s: any) => { const n = normName(s); if (!n) return; keys.add(n); for (const w of n.split(' ')) if (w.length >= 2) keys.add(w); };
  add(email.split('@')[0]);
  add(session?.user?.name);
  try { const [g] = await sql`SELECT name FROM access_grants WHERE email = ${email}` as any[]; if (g?.name) add(g.name); } catch { /* ignore */ }
  const isMine = (assignee: any) => { const n = normName(assignee); if (!n) return false; if (keys.has(n)) return true; const first = n.split(' ')[0]; return !!first && keys.has(first); };
  // A task is still "open" (needs action) until it is fully signed off — both an
  // initial AND a date — which mirrors the docProgress/cellDone "done" rule in
  // the onboarding/offboarding docs. A date on its own (e.g. a scheduled/target
  // date typed in before the task is actually completed and initialed) must NOT
  // close the task, otherwise assigned work silently disappears from the
  // dashboard before anyone has done it.
  const open = (cell: any) => !((cell?.initial ?? '').toString().trim() && (cell?.date ?? '').toString().trim());

  const tasks: any[] = [];

  // Onboarding documents.
  try {
    const rows = await sql`SELECT id, name, doc FROM onboardees` as any[];
    for (const r of rows) {
      const doc = parseOnbDoc(r.doc);
      const sections: [string, any[]][] = [['HR', doc.hr], ['Ops', doc.accounts], ['IT', doc.it]];
      for (const [section, list] of sections) {
        for (const row of list) {
          if (!isMine(row.cell?.assignee) || !open(row.cell)) continue;
          tasks.push({ source: 'onboarding', personId: r.id, personName: r.name, section, label: row.label, deadline: (row.cell?.deadline ?? '').toString(), assignee: (row.cell?.assignee ?? '').toString() });
        }
      }
    }
  } catch { /* ignore */ }

  // Offboarding documents — editable row arrays (Pre-Offboarding / Tools / IT).
  try {
    const rows = await sql`SELECT id, name, doc FROM offboarding` as any[];
    for (const r of rows) {
      const doc = parseOffDoc(r.doc);
      const sections: [string, any[]][] = [['Pre-Offboarding', doc.hr], ['Tools', doc.accounts], ['IT', doc.it]];
      for (const [section, list] of sections) {
        for (const row of list) {
          if (!isMine(row.cell?.assignee) || !open(row.cell)) continue;
          tasks.push({ source: 'offboarding', personId: r.id, personName: r.name, section, label: row.label, deadline: '', assignee: (row.cell?.assignee ?? '').toString() });
        }
      }
    }
  } catch { /* ignore */ }

  // Sort: tasks with a deadline first (soonest), then the rest by person + label.
  tasks.sort((a, b) => {
    const ad = a.deadline || '', bd = b.deadline || '';
    if (ad && bd && ad !== bd) return ad < bd ? -1 : 1;
    if (!!ad !== !!bd) return ad ? -1 : 1;
    return (a.personName + a.label).localeCompare(b.personName + b.label);
  });

  return NextResponse.json({ tasks });
}

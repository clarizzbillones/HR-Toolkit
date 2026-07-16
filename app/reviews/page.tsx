import { sql } from '@/lib/db';
import ModuleLayout from '@/components/ModuleLayout';
import ReviewsClient from './ReviewsClient';

export const dynamic = 'force-dynamic';

// Real firm roster: [id, name, role, department]
const ROSTER: [string, string, string, string][] = [
  ['emp_alex_little', 'Alex Little', 'Attorney', 'Attorneys'],
  ['emp_alicia_van_huizen', 'Alicia Van Huizen', 'Attorney', 'Attorneys'],
  ['emp_amy_green', 'Amy Green', 'Attorney', 'Attorneys'],
  ['emp_ashley_abraham', 'Ashley Abraham', 'Attorney', 'Attorneys'],
  ['emp_john_ross_glover', 'John Ross Glover', 'Attorney', 'Attorneys'],
  ['emp_matt_gibbs', 'Matt Gibbs', 'Attorney', 'Attorneys'],
  ['emp_sloan_nickel', 'Sloan Nickel', 'Attorney', 'Attorneys'],
  ['emp_ted_canter', 'Ted Canter', 'Attorney', 'Attorneys'],
  ['emp_brent_hannafan', 'Brent Hannafan', 'Attorney', 'Attorneys'],
  ['emp_zachary_lawson', 'Zachary Lawson', 'Member', 'Attorneys'],
  ['emp_ally_foresman', 'Ally Foresman', 'Paralegal', 'Legal Support'],
  ['emp_caitlin_giuliano', 'Caitlin Giuliano', 'Legal Operations Coordinator', 'Legal Support'],
  ['emp_fernanda_guillen', 'Fernanda Guillen', 'Legal Assistant', 'Legal Support'],
  ['emp_paula_laborne_valle', 'Paula Laborne Valle', 'Paralegal', 'Legal Support'],
  ['emp_ridwan_ahmed', 'Ridwan Ahmed', 'Law Clerk', 'Legal Support'],
  ['emp_simran_jain', 'Simran Mohini Jain', 'Paralegal Associate', 'Legal Support'],
  ['emp_isabella_ardila', 'Isabella Maria Ardila', 'Virtual Legal Assistant', 'Legal Support'],
  ['emp_syerra_ryan', 'Syerra Ryan', 'Paralegal', 'Legal Support'],
  ['emp_carly_crolly', 'Carly Crotty', 'Law Clerk', 'Legal Support'],
  ['emp_kelynn_enalls', "Ke'Lynn Enalls", 'Summer Law Clerk', 'Legal Support'],
  ['emp_amy_nelson', 'Amy Nelson', 'Strategist, Pardons and Clemency', 'Operations'],
  ['emp_brittany_brewer', 'Brittany Brewer', 'Administrative Assistant', 'Operations'],
  ['emp_catie_toole', 'Catie Toole', 'Director of Operations', 'Operations'],
  ['emp_clarizz_billones', 'Clarizz Ann Billones', 'HR Admin Specialist', 'Operations'],
  ['emp_clint_palmer', 'Clint Palmer', 'Compliance Manager', 'Operations'],
  ['emp_joey_mundy', 'Joey Mundy', 'Chief Investigator', 'Operations'],
  ['emp_kelley_hess', 'Kelley Hess', 'Director of Government Relations', 'Operations'],
  ['emp_ryan_leite', 'Ryan Leite', 'Financial Administrator', 'Operations'],
  ['emp_shannen_sharpe', 'Shannen Sharpe', 'Director of Marketing', 'Operations'],
  ['emp_victoria_seeley', 'Victoria Seeley', 'Compliance Manager', 'Operations'],
  ['emp_naomi_alinajad', 'Naomi Alinajad', 'Executive Assistant', 'Operations'],
];

export default async function ReviewsPage() {
  const [{ n }] = await sql`SELECT COUNT(*)::int as n FROM tasks WHERE status NOT IN ('done', 'archived')`;
  // Ensure review_6mo_date / review_1yr_date columns exist (idempotent)
  await sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS review_6mo_date TEXT`;
  await sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS review_1yr_date TEXT`;
  await sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS review_6mo_summary TEXT`;
  await sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS review_1yr_summary TEXT`;
  // New review model: last_review_date is the only writable date; the next
  // review, cycle, tenure and status are all derived on read. review_history
  // holds one { date, peer_reviewers[], notes } per completed review.
  await sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS last_review_date TEXT`;
  await sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS review_history TEXT`;
  await sql`UPDATE employees SET name = 'Carly Crotty' WHERE name = 'Carly Crolly'`;

  // Ensure the two clerks who were missing from the review roster exist
  // (principals Alex Little & Zachary Lawson are intentionally excluded from
  // reviews and filtered out in the UI). Additive only — never deletes.
  await sql`INSERT INTO employees (id, name, role, dept) VALUES ('emp_carly_crolly', 'Carly Crotty', 'Law Clerk', 'Legal Support') ON CONFLICT (id) DO NOTHING`;
  await sql`INSERT INTO employees (id, name, role, dept) VALUES ('emp_kelynn_enalls', 'Ke''Lynn Enalls', 'Summer Law Clerk', 'Legal Support') ON CONFLICT (id) DO NOTHING`;

  // Backfill last review dates + peer reviewers (spec §8). Idempotent: only
  // sets a row that has no last_review_date yet, so it never clobbers edits.
  // "Monica" (2025-11-18) from the legacy history is NOT on the roster — skipped.
  const BACKFILL: [string, string, string[]][] = [
    ['Sloan Nickel', '2025-10-15', []],
    ['Brittany Brewer', '2025-10-21', []],
    ['Fernanda Guillen', '2025-11-11', ['Ally', 'Paula']],
    ['Ted Canter', '2025-11-19', ['JR', 'Zach']],
    ['Ashley Abraham', '2025-12-03', ['JR', 'Ted']],
    ['Shannen Sharpe', '2026-01-14', ['Victoria', 'Ted', 'Alex', 'Clint', 'Zach', 'Catie']],
    ['Victoria Seeley', '2026-02-04', ['Catie', 'Alex', 'Alicia']],
    ['Joey Mundy', '2026-02-04', ['JR', 'Ally', 'Ted']],
    ['Paula Laborne Valle', '2026-02-04', ['Ally', 'JR', 'Caitlin']],
    ['Clint Palmer', '2026-02-19', ['Catie', 'Shannen', 'Ryan']],
    ['Ally Foresman', '2026-02-19', ['Ted', 'Alicia', 'Ryan']],
    ['Ridwan Ahmed', '2026-02-19', ['Sloan', 'JR', 'Ted']],
    ['Alicia Van Huizen', '2026-05-07', ['Caitlin', 'Zack', 'Brent']],
    ['Ryan Leite', '2026-05-07', ['Victoria', 'Matt', 'Catie', 'Caitlin', 'Brittany']],
    ['Matt Gibbs', '2026-05-14', ['Catie', 'Brent', 'Caitlin']],
    ['Amy Green', '2026-05-14', ['Caitlin', 'Zack', 'JR']],
    ['John Ross Glover', '2026-05-28', ['Alicia', 'Amy', 'Brent', 'Caitlin']],
    ['Caitlin Giuliano', '2026-07-02', []],
  ];
  for (const [name, date, peers] of BACKFILL) {
    const history = JSON.stringify([{ date, peer_reviewers: peers, notes: '' }]);
    await sql`UPDATE employees SET last_review_date = ${date}, review_history = ${history}
      WHERE lower(name) = lower(${name}) AND (last_review_date IS NULL OR last_review_date = '')`;
  }

  // Seed the firm roster only when the table is essentially empty. This never
  // deletes existing rows, so it can never wipe manually-entered review dates,
  // roles, or statuses. Rows that already exist are left untouched.
  const [{ total }] = await sql`SELECT COUNT(*)::int AS total FROM employees`;
  if (total < 5) {
    for (const [id, name, role, dept] of ROSTER) {
      if (id === 'emp_caitlin_giuliano') {
        await sql`INSERT INTO employees (id, name, role, dept, review_6mo_date, review_6mo_status)
          VALUES (${id}, ${name}, ${role}, ${dept}, '2026-07-02', 'Scheduled') ON CONFLICT (id) DO NOTHING`;
      } else {
        await sql`INSERT INTO employees (id, name, role, dept)
          VALUES (${id}, ${name}, ${role}, ${dept}) ON CONFLICT (id) DO NOTHING`;
      }
    }
  }

  const employees = await sql`SELECT * FROM employees ORDER BY name`;
  return (
    <ModuleLayout pendingTaskCount={n ?? 0}>
      <ReviewsClient initialEmployees={employees as any[]} />
    </ModuleLayout>
  );
}

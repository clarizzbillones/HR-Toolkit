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
  ['emp_carly_crolly', 'Carly Crolly', 'Law Clerk', 'Legal Support'],
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

  // One-time reseed: replace placeholder roster with the real firm roster.
  // Gated on "Catie Toole" being absent, so it runs exactly once.
  const [{ c }] = await sql`SELECT COUNT(*)::int AS c FROM employees WHERE name = 'Catie Toole'`;
  if (!c) {
    await sql`DELETE FROM employees`;
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

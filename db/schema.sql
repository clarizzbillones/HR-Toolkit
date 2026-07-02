-- Litson HR Toolkit — Supabase Schema
-- Run this in the Supabase SQL Editor (once)

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  sub TEXT,
  due_tag TEXT,
  status TEXT NOT NULL DEFAULT 'todo',
  status_history TEXT NOT NULL DEFAULT '[]',
  notes TEXT NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pto_entries (
  id TEXT PRIMARY KEY,
  employee TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'PTO',
  start_date TEXT,
  end_date TEXT,
  days REAL,
  status TEXT NOT NULL DEFAULT 'Approved',
  source_file TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  dept TEXT NOT NULL DEFAULT 'Operations',
  birthday TEXT,
  anniversary_date TEXT,
  anniversary_years INTEGER,
  review_6mo_status TEXT,
  review_6mo_date TEXT,
  review_6mo_reviewer TEXT,
  review_6mo_summary TEXT,
  review_1yr_status TEXT,
  review_1yr_date TEXT,
  review_1yr_reviewer TEXT,
  review_1yr_summary TEXT,
  external_review_url TEXT,
  hire_date TEXT,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll_periods (
  id TEXT PRIMARY KEY,
  run_date TEXT NOT NULL,
  period TEXT NOT NULL,
  cutoff TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Upcoming',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll_settings (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  cadence TEXT NOT NULL DEFAULT 'Semi-monthly',
  reminder_toggles TEXT NOT NULL DEFAULT '{"cutoff":true,"payrun":true,"timesheet":false}'
);

CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY,
  who TEXT NOT NULL,
  detail TEXT NOT NULL,
  cost REAL,
  matter TEXT,
  status TEXT NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS insurance_invoices (
  id TEXT PRIMARY KEY,
  carrier TEXT NOT NULL,
  invoice_type TEXT,
  amount REAL NOT NULL,
  deadline TEXT NOT NULL,
  coverage_period TEXT,
  enrolled_count INTEGER,
  attachments TEXT NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reimbursements (
  id TEXT PRIMARY KEY,
  employee TEXT NOT NULL,
  purpose TEXT NOT NULL,
  amount REAL NOT NULL,
  payout_date TEXT,
  attachments TEXT NOT NULL DEFAULT '[]',
  receipts TEXT NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contractor_payments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  due_date TEXT,
  paid_date TEXT,
  amount REAL NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS overtime (
  id TEXT PRIMARY KEY,
  employee TEXT NOT NULL,
  hours REAL NOT NULL,
  amount REAL NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cashout_ledger (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  payee TEXT NOT NULL,
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'Paid',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_settings (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  firm_name TEXT NOT NULL DEFAULT 'Litson',
  payroll_cadence TEXT NOT NULL DEFAULT 'Semi-monthly',
  external_review_dashboard TEXT,
  letterhead_image TEXT,
  signature_image TEXT
);

-- Seed Data — real firm roster
INSERT INTO employees (id,name,role,dept) VALUES ('emp_alex_little','Alex Little','Attorney','Attorneys') ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept) VALUES ('emp_alicia_van_huizen','Alicia Van Huizen','Attorney','Attorneys') ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept) VALUES ('emp_amy_green','Amy Green','Attorney','Attorneys') ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept) VALUES ('emp_ashley_abraham','Ashley Abraham','Attorney','Attorneys') ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept) VALUES ('emp_john_ross_glover','John Ross Glover','Attorney','Attorneys') ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept) VALUES ('emp_matt_gibbs','Matt Gibbs','Attorney','Attorneys') ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept) VALUES ('emp_sloan_nickel','Sloan Nickel','Attorney','Attorneys') ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept) VALUES ('emp_ted_canter','Ted Canter','Attorney','Attorneys') ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept) VALUES ('emp_brent_hannafan','Brent Hannafan','Attorney','Attorneys') ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept) VALUES ('emp_zachary_lawson','Zachary Lawson','Member','Attorneys') ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept) VALUES ('emp_ally_foresman','Ally Foresman','Paralegal','Legal Support') ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept,review_6mo_date,review_6mo_status) VALUES ('emp_caitlin_giuliano','Caitlin Giuliano','Legal Operations Coordinator','Legal Support','2026-07-02','Scheduled') ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept) VALUES ('emp_fernanda_guillen','Fernanda Guillen','Legal Assistant','Legal Support') ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept) VALUES ('emp_paula_laborne_valle','Paula Laborne Valle','Paralegal','Legal Support') ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept) VALUES ('emp_ridwan_ahmed','Ridwan Ahmed','Law Clerk','Legal Support') ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept) VALUES ('emp_simran_jain','Simran Mohini Jain','Paralegal Associate','Legal Support') ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept) VALUES ('emp_isabella_ardila','Isabella Maria Ardila','Virtual Legal Assistant','Legal Support') ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept) VALUES ('emp_syerra_ryan','Syerra Ryan','Paralegal','Legal Support') ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept) VALUES ('emp_carly_crolly','Carly Crotty','Law Clerk','Legal Support') ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept) VALUES ('emp_kelynn_enalls','Ke''Lynn Enalls','Summer Law Clerk','Legal Support') ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept) VALUES ('emp_amy_nelson','Amy Nelson','Strategist, Pardons and Clemency','Operations') ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept) VALUES ('emp_brittany_brewer','Brittany Brewer','Administrative Assistant','Operations') ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept) VALUES ('emp_catie_toole','Catie Toole','Director of Operations','Operations') ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept) VALUES ('emp_clarizz_billones','Clarizz Ann Billones','HR Admin Specialist','Operations') ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept) VALUES ('emp_clint_palmer','Clint Palmer','Compliance Manager','Operations') ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept) VALUES ('emp_joey_mundy','Joey Mundy','Chief Investigator','Operations') ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept) VALUES ('emp_kelley_hess','Kelley Hess','Director of Government Relations','Operations') ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept) VALUES ('emp_ryan_leite','Ryan Leite','Financial Administrator','Operations') ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept) VALUES ('emp_shannen_sharpe','Shannen Sharpe','Director of Marketing','Operations') ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept) VALUES ('emp_victoria_seeley','Victoria Seeley','Compliance Manager','Operations') ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept) VALUES ('emp_naomi_alinajad','Naomi Alinajad','Executive Assistant','Operations') ON CONFLICT (id) DO NOTHING;

INSERT INTO payroll_periods (id,run_date,period,cutoff,status) VALUES ('cvzrfewhps4mqzjodgp','2026-06-30','Jun 16–30','2026-06-26','Processing') ON CONFLICT (id) DO NOTHING;
INSERT INTO payroll_periods (id,run_date,period,cutoff,status) VALUES ('civnaf7688asmqzjodgp','2026-07-15','Jul 1–15','2026-07-11','Upcoming') ON CONFLICT (id) DO NOTHING;
INSERT INTO payroll_periods (id,run_date,period,cutoff,status) VALUES ('cdi3ky7520twmqzjodgp','2026-07-31','Jul 16–31','2026-07-28','Upcoming') ON CONFLICT (id) DO NOTHING;
INSERT INTO payroll_periods (id,run_date,period,cutoff,status) VALUES ('cqjloi256isimqzjodgp','2026-08-14','Aug 1–14','2026-08-11','Upcoming') ON CONFLICT (id) DO NOTHING;
INSERT INTO payroll_periods (id,run_date,period,cutoff,status) VALUES ('crmxl52dzl5omqzjodgp','2026-08-31','Aug 15–31','2026-08-27','Upcoming') ON CONFLICT (id) DO NOTHING;

INSERT INTO tasks (id,title,sub,due_tag,status,status_history,notes) VALUES ('cdvsxcqd1uevmqzjodgp','Update employee handbook — parental leave policy','Add new 12-week policy effective July 1','Today','todo','[{"status":"todo","timestamp":"2026-06-29T18:21:56.885Z"}]','[]') ON CONFLICT (id) DO NOTHING;
INSERT INTO tasks (id,title,sub,due_tag,status,status_history,notes) VALUES ('cnk2rqj81pubmqzjodgp','Send benefits enrollment reminder to new hires','Keisha Williams, Aaron Park — deadline Jun 30','Tomorrow','todo','[{"status":"todo","timestamp":"2026-06-29T18:21:56.885Z"}]','[]') ON CONFLICT (id) DO NOTHING;
INSERT INTO tasks (id,title,sub,due_tag,status,status_history,notes) VALUES ('cuq7xth4dwsgmqzjodgp','Process reimbursement — Sarah Caldwell conference travel',NULL,'Jun 30','todo','[{"status":"todo","timestamp":"2026-06-29T18:21:56.885Z"}]','[]') ON CONFLICT (id) DO NOTHING;
INSERT INTO tasks (id,title,sub,due_tag,status,status_history,notes) VALUES ('czn2qlxeeqwmqzjodgp','Schedule Q2 performance reviews — Operations team','15 reviews remaining',NULL,'doing','[{"status":"todo","timestamp":"2026-06-28T18:21:56.886Z"},{"status":"doing","timestamp":"2026-06-29T18:21:56.885Z"}]','[{"date":"6/29/2026","text":"Started outreach emails"}]') ON CONFLICT (id) DO NOTHING;
INSERT INTO tasks (id,title,sub,due_tag,status,status_history,notes) VALUES ('c9ixnct0wf2cmqzjodgp','Prepare BCBS insurance invoice for July payment',NULL,'Jul 1','doing','[{"status":"doing","timestamp":"2026-06-29T18:21:56.885Z"}]','[]') ON CONFLICT (id) DO NOTHING;
INSERT INTO tasks (id,title,sub,due_tag,status,status_history,notes) VALUES ('cg5zmgxel2emqzjodgp','Onboard Marcus Reed — welcome packet + IT setup',NULL,NULL,'todo','[{"status":"todo","timestamp":"2026-06-29T18:21:56.885Z"}]','[]') ON CONFLICT (id) DO NOTHING;
INSERT INTO tasks (id,title,sub,due_tag,status,status_history,notes) VALUES ('ckw3gou43x19mqzjodgp','Audit PTO balances — carry-over from H1',NULL,NULL,'todo','[{"status":"todo","timestamp":"2026-06-29T18:21:56.885Z"}]','[]') ON CONFLICT (id) DO NOTHING;
INSERT INTO tasks (id,title,sub,due_tag,status,status_history,notes) VALUES ('ceomo0v1ty3nmqzjodgp','Review and sign off June contractor invoices',NULL,'Today','todo','[{"status":"todo","timestamp":"2026-06-29T18:21:56.885Z"}]','[]') ON CONFLICT (id) DO NOTHING;
INSERT INTO tasks (id,title,sub,due_tag,status,status_history,notes) VALUES ('c8g1o6mi24xhmqzjodgp','Update org chart for new hires',NULL,NULL,'done','[{"status":"todo","timestamp":"2026-06-28T18:21:56.886Z"},{"status":"done","timestamp":"2026-06-29T18:21:56.885Z"}]','[]') ON CONFLICT (id) DO NOTHING;
INSERT INTO tasks (id,title,sub,due_tag,status,status_history,notes) VALUES ('cdjrm8268vmpmqzjodgp','Draft offer letter — paralegal position',NULL,NULL,'done','[{"status":"todo","timestamp":"2026-06-28T18:21:56.886Z"},{"status":"done","timestamp":"2026-06-29T18:21:56.885Z"}]','[{"date":"6/29/2026","text":"Sent to James for review"}]') ON CONFLICT (id) DO NOTHING;

INSERT INTO payroll_settings (id,cadence,reminder_toggles) VALUES ('singleton','Semi-monthly','{"cutoff":true,"payrun":true,"timesheet":false}') ON CONFLICT (id) DO NOTHING;
INSERT INTO app_settings (id,firm_name,payroll_cadence) VALUES ('singleton','Litson','Semi-monthly') ON CONFLICT (id) DO NOTHING;

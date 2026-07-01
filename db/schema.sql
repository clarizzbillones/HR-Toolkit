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

-- Seed Data
INSERT INTO employees (id,name,role,dept,birthday,hire_date,review_6mo_status,review_1yr_status,review_notes) VALUES ('c3svj38jmdrcmqzjodg4','James Litson','Managing Partner','Attorneys','1975-01-01',NULL,'Complete','Complete',NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept,birthday,hire_date,review_6mo_status,review_1yr_status,review_notes) VALUES ('ckx4x32qyijrmqzjodg4','Sarah Caldwell','Senior Partner','Attorneys','1976-02-02',NULL,'Pending','Complete',NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept,birthday,hire_date,review_6mo_status,review_1yr_status,review_notes) VALUES ('ckyj857myjftmqzjodg4','Michael Torres','Partner','Attorneys','1977-03-03',NULL,'Scheduled','Complete',NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept,birthday,hire_date,review_6mo_status,review_1yr_status,review_notes) VALUES ('coxds9nd9romqzjodg4','Emily Chen','Partner','Attorneys','1978-04-04',NULL,'Not started','Complete',NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept,birthday,hire_date,review_6mo_status,review_1yr_status,review_notes) VALUES ('cgw46kme19smqzjodg5','David Harrington','Of Counsel','Attorneys','1979-05-05',NULL,'Complete','Complete',NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept,birthday,hire_date,review_6mo_status,review_1yr_status,review_notes) VALUES ('cw67ef16mo8mqzjodg5','Rachel Nguyen','Associate','Attorneys','1980-06-06',NULL,'Pending','Complete',NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept,birthday,hire_date,review_6mo_status,review_1yr_status,review_notes) VALUES ('cwx8rsp2qu9mmqzjodg5','Brandon Wells','Associate','Attorneys','1981-07-07',NULL,'Scheduled','Complete',NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept,birthday,hire_date,review_6mo_status,review_1yr_status,review_notes) VALUES ('c7tt4kmxqenwmqzjodg5','Tiffany Moore','Associate','Attorneys','1982-08-08',NULL,'Not started','Complete',NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept,birthday,hire_date,review_6mo_status,review_1yr_status,review_notes) VALUES ('czzigbbe9uvkmqzjodg5','Keisha Williams','Associate','Attorneys','1975-09-09',NULL,'Complete','Complete',NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept,birthday,hire_date,review_6mo_status,review_1yr_status,review_notes) VALUES ('ccb2bd4fvnasmqzjodg5','Aaron Park','Associate','Attorneys','1976-10-10',NULL,'Pending','Complete',NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept,birthday,hire_date,review_6mo_status,review_1yr_status,review_notes) VALUES ('c8nc0svm3kd9mqzjodg5','Natalie Brooks','Associate','Attorneys','1977-11-11',NULL,'Scheduled','Complete',NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept,birthday,hire_date,review_6mo_status,review_1yr_status,review_notes) VALUES ('ckheeob13mqrmqzjodg5','Christopher Daly','Associate','Attorneys','1978-12-12',NULL,'Not started','Complete',NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept,birthday,hire_date,review_6mo_status,review_1yr_status,review_notes) VALUES ('cj3b5hs3embmqzjodg5','Jasmine Patel','Staff Attorney','Attorneys','1979-01-13',NULL,'Complete','Not started',NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept,birthday,hire_date,review_6mo_status,review_1yr_status,review_notes) VALUES ('czlkfhjq4hhmqzjodg5','Lucas Freeman','Law Clerk','Attorneys','1980-02-14',NULL,'Pending','Complete',NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept,birthday,hire_date,review_6mo_status,review_1yr_status,review_notes) VALUES ('cp0hdtiy3gpmqzjodg5','Olivia Grant','Law Clerk','Attorneys','1981-03-15',NULL,'Scheduled','Pending',NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept,birthday,hire_date,review_6mo_status,review_1yr_status,review_notes) VALUES ('c60t3ztq461smqzjodg5','Marcus Reed','Paralegal','Attorneys','1982-04-16',NULL,'Not started','Scheduled',NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept,birthday,hire_date,review_6mo_status,review_1yr_status,review_notes) VALUES ('c1e037dg1z6qmqzjodg5','Sophia Martinez','Paralegal','Attorneys','1975-05-17',NULL,'Complete','Not started',NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept,birthday,hire_date,review_6mo_status,review_1yr_status,review_notes) VALUES ('ckdt8dh306yemqzjodg5','Tyler Johnson','Paralegal','Attorneys','1976-06-18',NULL,'Pending','Complete',NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept,birthday,hire_date,review_6mo_status,review_1yr_status,review_notes) VALUES ('c8sg8hv8m5nhmqzjodg5','Renee Mathis','HR Administrator','Operations','1977-07-19',NULL,'Scheduled','Pending',NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept,birthday,hire_date,review_6mo_status,review_1yr_status,review_notes) VALUES ('cqdh7p2hkzunmqzjodg5','Catie Dawson','Office Manager','Operations','1978-08-20',NULL,'Not started','Scheduled',NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept,birthday,hire_date,review_6mo_status,review_1yr_status,review_notes) VALUES ('chpos4dq5remqzjodg5','Ryan Holloway','Controller','Operations','1979-09-21',NULL,'Complete','Not started',NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept,birthday,hire_date,review_6mo_status,review_1yr_status,review_notes) VALUES ('ctcw4b21d3r9mqzjodg5','Denise Okafor','Executive Assistant','Operations','1980-10-22',NULL,'Pending','Complete',NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept,birthday,hire_date,review_6mo_status,review_1yr_status,review_notes) VALUES ('cgfne79bfu5mmqzjodg5','Kevin Shaw','Legal Secretary','Operations','1981-11-23',NULL,'Scheduled','Pending',NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept,birthday,hire_date,review_6mo_status,review_1yr_status,review_notes) VALUES ('cfiw4wo3qjr9mqzjodg5','Amanda Hill','Legal Secretary','Operations','1982-12-24',NULL,'Not started','Scheduled',NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept,birthday,hire_date,review_6mo_status,review_1yr_status,review_notes) VALUES ('coqjjo8yl9agmqzjodg5','Patricia Yuen','Legal Secretary','Operations','1975-01-25',NULL,'Complete','Not started',NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept,birthday,hire_date,review_6mo_status,review_1yr_status,review_notes) VALUES ('cny9wp2lwwnimqzjodg5','Derek Simmons','IT Manager','Operations','1976-02-26',NULL,'Pending','Complete',NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept,birthday,hire_date,review_6mo_status,review_1yr_status,review_notes) VALUES ('cmvgo7k3w0qmqzjodg5','Brenda Collins','Receptionist','Operations','1977-03-27',NULL,'Scheduled','Pending',NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept,birthday,hire_date,review_6mo_status,review_1yr_status,review_notes) VALUES ('cs2mj0t1fsmqzjodg5','Joshua King','Mailroom Coordinator','Operations','1978-04-28',NULL,'Not started','Scheduled',NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept,birthday,hire_date,review_6mo_status,review_1yr_status,review_notes) VALUES ('cc46sfg98n9lmqzjodg5','Carla Dixon','Billing Coordinator','Operations','1979-05-01',NULL,'Complete','Not started',NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept,birthday,hire_date,review_6mo_status,review_1yr_status,review_notes) VALUES ('c956ycqpppmkmqzjodg5','Victor Espinoza','Facilities Manager','Operations','1980-06-02',NULL,'Pending','Complete',NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept,birthday,hire_date,review_6mo_status,review_1yr_status,review_notes) VALUES ('ctb6dxs96bvmqzjodg5','Monica Turner','Marketing Coordinator','Operations','1981-07-03',NULL,'Scheduled','Pending',NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept,birthday,hire_date,review_6mo_status,review_1yr_status,review_notes) VALUES ('c4oqes3f5uimqzjodg5','Sean Fletcher','Records Manager','Operations','1982-08-04',NULL,'Not started','Scheduled',NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept,birthday,hire_date,review_6mo_status,review_1yr_status,review_notes) VALUES ('cmqz8l5xiw8qmqzjodg5','Lori Chambers','Administrative Assistant','Operations','1975-09-05',NULL,'Complete','Not started',NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO employees (id,name,role,dept,hire_date,review_6mo_date,review_6mo_status,review_1yr_status) VALUES ('caitlin_toole_2026','Caitlin Toole','Director of Operations','Operations','2026-01-02','2026-07-02','Scheduled',NULL) ON CONFLICT (id) DO NOTHING;

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

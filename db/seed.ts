import { getDb, cuid } from './index';

const db = getDb();

const attorneys = [
  { name: 'James Litson', role: 'Managing Partner', dept: 'Attorneys' },
  { name: 'Sarah Caldwell', role: 'Senior Partner', dept: 'Attorneys' },
  { name: 'Michael Torres', role: 'Partner', dept: 'Attorneys' },
  { name: 'Emily Chen', role: 'Partner', dept: 'Attorneys' },
  { name: 'David Harrington', role: 'Of Counsel', dept: 'Attorneys' },
  { name: 'Rachel Nguyen', role: 'Associate', dept: 'Attorneys' },
  { name: 'Brandon Wells', role: 'Associate', dept: 'Attorneys' },
  { name: 'Tiffany Moore', role: 'Associate', dept: 'Attorneys' },
  { name: 'Keisha Williams', role: 'Associate', dept: 'Attorneys' },
  { name: 'Aaron Park', role: 'Associate', dept: 'Attorneys' },
  { name: 'Natalie Brooks', role: 'Associate', dept: 'Attorneys' },
  { name: 'Christopher Daly', role: 'Associate', dept: 'Attorneys' },
  { name: 'Jasmine Patel', role: 'Staff Attorney', dept: 'Attorneys' },
  { name: 'Lucas Freeman', role: 'Law Clerk', dept: 'Attorneys' },
  { name: 'Olivia Grant', role: 'Law Clerk', dept: 'Attorneys' },
  { name: 'Marcus Reed', role: 'Paralegal', dept: 'Attorneys' },
  { name: 'Sophia Martinez', role: 'Paralegal', dept: 'Attorneys' },
  { name: 'Tyler Johnson', role: 'Paralegal', dept: 'Attorneys' },
];

const operations = [
  { name: 'Renee Mathis', role: 'HR Administrator', dept: 'Operations' },
  { name: 'Catie Dawson', role: 'Office Manager', dept: 'Operations' },
  { name: 'Ryan Holloway', role: 'Controller', dept: 'Operations' },
  { name: 'Denise Okafor', role: 'Executive Assistant', dept: 'Operations' },
  { name: 'Kevin Shaw', role: 'Legal Secretary', dept: 'Operations' },
  { name: 'Amanda Hill', role: 'Legal Secretary', dept: 'Operations' },
  { name: 'Patricia Yuen', role: 'Legal Secretary', dept: 'Operations' },
  { name: 'Derek Simmons', role: 'IT Manager', dept: 'Operations' },
  { name: 'Brenda Collins', role: 'Receptionist', dept: 'Operations' },
  { name: 'Joshua King', role: 'Mailroom Coordinator', dept: 'Operations' },
  { name: 'Carla Dixon', role: 'Billing Coordinator', dept: 'Operations' },
  { name: 'Victor Espinoza', role: 'Facilities Manager', dept: 'Operations' },
  { name: 'Monica Turner', role: 'Marketing Coordinator', dept: 'Operations' },
  { name: 'Sean Fletcher', role: 'Records Manager', dept: 'Operations' },
  { name: 'Lori Chambers', role: 'Administrative Assistant', dept: 'Operations' },
];

const statuses = ['Complete', 'Pending', 'Scheduled', 'Not started'];
const reviewers = ['Catie Dawson', 'James Litson', 'Sarah Caldwell'];

function randDate(yearBase: number, monthBase: number, i: number): string {
  const y = yearBase + (i % 8);
  const m = String((monthBase + i) % 12 + 1).padStart(2, '0');
  const d = String((i % 28) + 1).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function randItem<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

const insertEmp = db.prepare(`
  INSERT OR REPLACE INTO employees (id, name, role, dept, birthday, anniversary_date, anniversary_years,
    review_6mo_status, review_6mo_date, review_6mo_reviewer,
    review_1yr_status, review_1yr_date, review_1yr_reviewer)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// Clear and reseed
db.exec(`
  DELETE FROM tasks; DELETE FROM pto_entries; DELETE FROM employees;
  DELETE FROM payroll_periods; DELETE FROM payroll_settings; DELETE FROM trips;
  DELETE FROM insurance_invoices; DELETE FROM reimbursements;
  DELETE FROM contractor_payments; DELETE FROM cashout_ledger; DELETE FROM app_settings;
`);

const allPeople = [...attorneys, ...operations];
for (let i = 0; i < allPeople.length; i++) {
  const p = allPeople[i];
  insertEmp.run(
    cuid(), p.name, p.role, p.dept,
    randDate(1975, 0, i),
    randDate(2014, 3, i),
    2 + (i % 10),
    randItem(statuses, i),
    '2026-06-15',
    randItem(reviewers, i),
    i < 12 ? 'Complete' : randItem(statuses, i + 3),
    '2026-06-15',
    randItem(reviewers, i + 2)
  );
}

const now = new Date().toISOString();
const yesterday = new Date(Date.now() - 86400000).toISOString();

const insertTask = db.prepare(`
  INSERT INTO tasks (id, title, sub, due_tag, status, status_history, notes) VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const tasks = [
  ['Update employee handbook — parental leave policy', 'Add new 12-week policy effective July 1', 'Today', 'todo', JSON.stringify([{status:'todo',timestamp:now}]), '[]'],
  ['Send benefits enrollment reminder to new hires', 'Keisha Williams, Aaron Park — deadline Jun 30', 'Tomorrow', 'todo', JSON.stringify([{status:'todo',timestamp:now}]), '[]'],
  ['Process reimbursement — Sarah Caldwell conference travel', null, 'Jun 30', 'todo', JSON.stringify([{status:'todo',timestamp:now}]), '[]'],
  ['Schedule Q2 performance reviews — Operations team', '15 reviews remaining', null, 'doing', JSON.stringify([{status:'todo',timestamp:yesterday},{status:'doing',timestamp:now}]), JSON.stringify([{date:new Date().toLocaleDateString(),text:'Started outreach emails'}])],
  ['Prepare BCBS insurance invoice for July payment', null, 'Jul 1', 'doing', JSON.stringify([{status:'doing',timestamp:now}]), '[]'],
  ['Onboard Marcus Reed — welcome packet + IT setup', null, null, 'todo', JSON.stringify([{status:'todo',timestamp:now}]), '[]'],
  ['Audit PTO balances — carry-over from H1', null, null, 'todo', JSON.stringify([{status:'todo',timestamp:now}]), '[]'],
  ['Review and sign off June contractor invoices', null, 'Today', 'todo', JSON.stringify([{status:'todo',timestamp:now}]), '[]'],
  ['Update org chart for new hires', null, null, 'done', JSON.stringify([{status:'todo',timestamp:yesterday},{status:'done',timestamp:now}]), '[]'],
  ['Draft offer letter — paralegal position', null, null, 'done', JSON.stringify([{status:'todo',timestamp:yesterday},{status:'done',timestamp:now}]), JSON.stringify([{date:new Date().toLocaleDateString(),text:'Sent to James for review'}])],
];

for (const [title, sub, dueTag, status, sh, notes] of tasks) {
  insertTask.run(cuid(), title, sub, dueTag, status, sh, notes);
}

const insertPto = db.prepare(`INSERT INTO pto_entries (id,employee,type,start_date,end_date,days,status) VALUES (?,?,?,?,?,?,?)`);
[
  ['Rachel Nguyen','Vacation','2026-07-07','2026-07-11',5,'Approved'],
  ['Brandon Wells','Sick','2026-06-29','2026-06-29',1,'Approved'],
  ['Tiffany Moore','Personal','2026-07-03','2026-07-03',1,'Approved'],
  ['Catie Dawson','Vacation','2026-07-14','2026-07-18',5,'Approved'],
  ['Kevin Shaw','Appointment','2026-06-30','2026-06-30',0.5,'Approved'],
  ['Jasmine Patel','Vacation','2026-08-04','2026-08-08',5,'Pending'],
].forEach(([emp,type,s,e,d,st]) => insertPto.run(cuid(),emp,type,s,e,d,st));

db.prepare(`INSERT INTO payroll_settings (id, cadence) VALUES ('singleton', 'Semi-monthly')`).run();

const insertPP = db.prepare(`INSERT INTO payroll_periods (id,run_date,period,cutoff,status) VALUES (?,?,?,?,?)`);
[
  ['2026-06-30','Jun 16–30','2026-06-26','Processing'],
  ['2026-07-15','Jul 1–15','2026-07-11','Upcoming'],
  ['2026-07-31','Jul 16–31','2026-07-28','Upcoming'],
  ['2026-08-14','Aug 1–14','2026-08-11','Upcoming'],
  ['2026-08-31','Aug 15–31','2026-08-27','Upcoming'],
].forEach(([r,p,c,s]) => insertPP.run(cuid(),r,p,c,s));

const insertTrip = db.prepare(`INSERT INTO trips (id,who,detail,cost,matter,status) VALUES (?,?,?,?,?,?)`);
insertTrip.run(cuid(),'James Litson','ABA Annual Meeting · Chicago, IL',2840,'Firm Business','Approved');
insertTrip.run(cuid(),'Sarah Caldwell','Client deposition · New York, NY',1650,'Matter #2241','Pending');
insertTrip.run(cuid(),'Emily Chen','CLE Conference · Atlanta, GA',980,'Firm Business','Hold');

const insertIns = db.prepare(`INSERT INTO insurance_invoices (id,carrier,invoice_type,amount,deadline,coverage_period,enrolled_count) VALUES (?,?,?,?,?,?,?)`);
insertIns.run(cuid(),'BCBS Tennessee','Medical',18450.00,'2026-07-01','July 2026',28);
insertIns.run(cuid(),'Guardian','Dental & Vision',3218.50,'2026-07-05','July 2026',31);

const insertR = db.prepare(`INSERT INTO reimbursements (id,employee,purpose,amount,payout_date) VALUES (?,?,?,?,?)`);
insertR.run(cuid(),'Sarah Caldwell','ABA conference registration',895.00,'2026-07-15');
insertR.run(cuid(),'Marcus Reed','Bar exam application fee',375.00,'2026-07-01');
insertR.run(cuid(),'Derek Simmons','Network equipment',642.18,'2026-07-15');
insertR.run(cuid(),'Catie Dawson','Office supplies — Q2',287.44,'2026-07-01');

const insertCP = db.prepare(`INSERT INTO contractor_payments (id,name,due_date,amount,note) VALUES (?,?,?,?,?)`);
insertCP.run(cuid(),'Nashville Temps LLC','2026-07-01',4200,'Legal secretary coverage — June');
insertCP.run(cuid(),'TechFixit Pro','2026-06-30',1800,'Monthly IT support contract');
insertCP.run(cuid(),'Grounds & Clean LLC','2026-07-01',650,'Office cleaning — June');

const insertCO = db.prepare(`INSERT INTO cashout_ledger (id,date,payee,category,amount,status) VALUES (?,?,?,?,?,?)`);
insertCO.run(cuid(),'2026-06-15','BCBS Tennessee','Insurance',18450.00,'Paid');
insertCO.run(cuid(),'2026-06-15','Guardian','Insurance',3218.50,'Paid');
insertCO.run(cuid(),'2026-06-15','Nashville Temps LLC','Contractor',4200.00,'Paid');
insertCO.run(cuid(),'2026-06-20','Sarah Caldwell','Reimbursement',895.00,'Pending');
insertCO.run(cuid(),'2026-06-20','Catie Dawson','Reimbursement',287.44,'Pending');
insertCO.run(cuid(),'2026-06-30','TechFixit Pro','Contractor',1800.00,'Pending');

db.prepare(`INSERT INTO app_settings (id, firm_name, payroll_cadence) VALUES ('singleton', 'Litson', 'Semi-monthly')`).run();

console.log('✓ Database seeded — 33 employees, 10 tasks, 6 PTO entries, 5 payroll periods');

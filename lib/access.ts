// Per-person viewer access control. A person listed in `access_grants` is a
// read-only viewer who can see ONLY the sections / report tabs granted to them;
// anyone NOT listed keeps full access (the default for HR/admins).

// Sidebar sections — keys are the route paths.
export const SECTIONS: { key: string; label: string }[] = [
  { key: '/', label: 'Dashboard' },
  { key: '/tasks', label: 'Open HR Tasks' },
  { key: '/pto', label: 'PTO & Calendar' },
  { key: '/offers', label: 'Letters' },
  { key: '/hr-forms', label: 'HR Forms' },
  { key: '/sop', label: 'SOP Builder' },
  { key: '/payroll', label: 'Payroll' },
  { key: '/trips', label: 'Trip Help Desk' },
  { key: '/reviews', label: 'Performance Reviews' },
  { key: '/coaching', label: 'Coaching' },
  { key: '/staffing', label: 'Staffing' },
  { key: '/employee-files', label: 'Employee Files' },
  { key: '/onboarding', label: 'Onboarding' },
  { key: '/onboarding-doc', label: 'Onboarding Document' },
  { key: '/offboarding', label: 'Offboarding' },
  { key: '/offboarding-doc', label: 'Offboarding Document' },
  { key: '/insurance', label: 'Insurance' },
  { key: '/reports', label: 'Reports' },
  { key: '/design', label: 'Graphic Design' },
];

// Report sub-tabs — keys match the Reports tab keys.
export const REPORT_TABS: { key: string; label: string }[] = [
  { key: 'monthly', label: 'Monthly Pack' },
  { key: 'trips', label: 'Trips' },
  { key: 'pto', label: 'PTO' },
  { key: 'reviews', label: 'Performance Reviews' },
  { key: 'insurance', label: 'Insurance' },
  { key: 'reimbursements', label: 'Reimbursements' },
  { key: 'cashout', label: 'Cash Out' },
];

export interface AccessGrant {
  email: string;
  name: string;
  sections: string[];      // allowed section keys (route paths)
  reportTabs: string[];    // allowed report tab keys
  editSections: string[];  // sections they may EDIT (subset of sections)
}

// The caller's effective access, as returned by /api/access/me.
export interface MyAccess {
  isAdmin: boolean;       // may manage access control
  isHrAdmin: boolean;     // may see HR-admin-only sections (Employee Files)
  restricted: boolean;    // false = full access (not in the grant list)
  sections: string[];     // allowed sections (only meaningful when restricted)
  reportTabs: string[];   // allowed report tabs (only meaningful when restricted)
  editSections: string[]; // sections a restricted viewer may edit (else view-only)
}

// May the caller edit the given section? Full-access users always can; a
// restricted viewer only if the section is in their editSections grant.
export function canEditSection(me: MyAccess | null | undefined, section: string): boolean {
  if (!me) return true;
  if (!me.restricted) return true;
  return (me.editSections ?? []).includes(section);
}

// Sections locked to HR admins only — hidden from everyone else, including
// otherwise-full-access users, regardless of any access grant.
// (Employee Files was temporarily unlocked to a normal full-access section so
// the owner is never blocked; re-add '/employee-files' here to relock it.)
export const HR_ADMIN_SECTIONS: string[] = [];

// Which route section a pathname belongs to (e.g. /reports/x -> /reports).
export function sectionForPath(pathname: string): string {
  if (pathname === '/' || pathname === '') return '/';
  const hit = SECTIONS.find(s => s.key !== '/' && (pathname === s.key || pathname.startsWith(s.key + '/')));
  return hit ? hit.key : pathname;
}

// Owners/admins who may manage access control. Role 'admin' always qualifies;
// otherwise the email must be in ACCESS_ADMINS (comma-separated env var).
export function accessAdminList(): string[] {
  return (process.env.ACCESS_ADMINS ?? 'clarizz@litson.co,catie@litson.co,admin@litson.co')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}
export function isAccessAdmin(email: string | null | undefined, role: string | null | undefined): boolean {
  if (role === 'admin') return true;
  return !!email && accessAdminList().includes(email.toLowerCase());
}

// HR admins — the only people who may see Employee Files. Role 'admin'
// qualifies; otherwise the email must be in HR_ADMINS (comma-separated env
// var). Defaults to Clarizz + Catie; override HR_ADMINS in the environment.
export function hrAdminList(): string[] {
  return (process.env.HR_ADMINS ?? 'clarizz@litson.co,catie@litson.co,admin@litson.co')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}
export function isHrAdmin(email: string | null | undefined, role: string | null | undefined): boolean {
  if (role === 'admin') return true;
  return !!email && hrAdminList().includes(email.toLowerCase());
}

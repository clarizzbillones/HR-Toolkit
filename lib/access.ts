// Per-person viewer access control. A person listed in `access_grants` is a
// read-only viewer who can see ONLY the sections / report tabs granted to them;
// anyone NOT listed keeps full access (the default for HR/admins).

// Sidebar sections — keys are the route paths.
export const SECTIONS: { key: string; label: string }[] = [
  { key: '/', label: 'Dashboard' },
  { key: '/tasks', label: 'Open HR Tasks' },
  { key: '/pto', label: 'PTO & Calendar' },
  { key: '/offers', label: 'Letters' },
  { key: '/sop', label: 'SOP Builder' },
  { key: '/payroll', label: 'Payroll' },
  { key: '/trips', label: 'Trip Help Desk' },
  { key: '/reviews', label: 'Performance Reviews' },
  { key: '/staffing', label: 'Staffing' },
  { key: '/onboarding', label: 'Onboarding' },
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
  sections: string[];    // allowed section keys (route paths)
  reportTabs: string[];  // allowed report tab keys
}

// The caller's effective access, as returned by /api/access/me.
export interface MyAccess {
  isAdmin: boolean;       // may manage access control
  restricted: boolean;    // false = full access (not in the grant list)
  sections: string[];     // allowed sections (only meaningful when restricted)
  reportTabs: string[];   // allowed report tabs (only meaningful when restricted)
}

// Which route section a pathname belongs to (e.g. /reports/x -> /reports).
export function sectionForPath(pathname: string): string {
  if (pathname === '/' || pathname === '') return '/';
  const hit = SECTIONS.find(s => s.key !== '/' && (pathname === s.key || pathname.startsWith(s.key + '/')));
  return hit ? hit.key : pathname;
}

// Owners/admins who may manage access control. Role 'admin' always qualifies;
// otherwise the email must be in ACCESS_ADMINS (comma-separated env var).
export function isAccessAdmin(email: string | null | undefined, role: string | null | undefined): boolean {
  if (role === 'admin') return true;
  const owners = (process.env.ACCESS_ADMINS ?? 'clarizz@litson.co,admin@litson.co')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  return !!email && owners.includes(email.toLowerCase());
}

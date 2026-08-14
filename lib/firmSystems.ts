// Canonical list of firm tools/systems an employee may have an account on.
// Used to seed an employee's Accounts & Access list and, in turn, the
// offboarding "Accounts to close" checklist. Ramp is included so charges Ryan
// finds can be reconciled back to a named system here.
export const FIRM_SYSTEMS = [
  'Microsoft 365', 'Dialpad', 'Dashlane', 'Clio', 'Dropbox', 'Zoom', 'Ajax',
  'Donna', 'Westlaw', 'PACER / ECF', 'ADP', 'Claude', 'Fathom',
  'Briefcatch & Reality Check', 'Logikcull', 'Adobe', 'Signitic', 'Verizon admin',
] as const;

// A short hint shown under a system when seeding the standard list / survey.
export const SYSTEM_HINTS: Record<string, string> = {
  'Microsoft 365': 'Email, calendar, OneDrive',
  'Dialpad': 'Phone system',
  'Dashlane': 'Shared password vault',
  'Dropbox': 'File storage',
  'Ajax': 'Timekeeping',
  'Donna': 'Internal AI assistant',
  'Westlaw': 'Legal research',
  'PACER / ECF': 'Court e-filing',
  'ADP': 'Payroll / HR',
  'Claude': 'AI assistant',
  'Fathom': 'AI meeting notes',
  'Briefcatch & Reality Check': 'Legal writing / editing',
  'Logikcull': 'eDiscovery',
  'Adobe': 'PDF editing',
  'Signitic': 'Email signatures',
  'Verizon admin': 'Corporate phone',
};

// Access levels an account can be held at.
export const ACCESS_LEVELS = ['Standard user', 'Admin'] as const;

export const ACCOUNT_STATUSES = ['Active', 'Needs review', 'Suspended', 'Closed'] as const;
export const ACCOUNT_SOURCES = ['Manual', 'Onboarding', 'Ramp', 'SSO'] as const;

export type AccountStatus = typeof ACCOUNT_STATUSES[number];

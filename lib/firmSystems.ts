// Canonical list of firm tools/systems an employee may have an account on.
// Used to seed an employee's Accounts & Access list and, in turn, the
// offboarding "Accounts to close" checklist. Ramp is included so charges Ryan
// finds can be reconciled back to a named system here.
export const FIRM_SYSTEMS = [
  'Microsoft 365', 'Dropbox', 'Dashlane', 'Clio', 'Donna',
  'Dialpad', 'Zoom', 'Signitic', 'Logikcull', 'PACER', 'Ramp',
] as const;

// A short hint shown under a few systems when seeding the standard list.
export const SYSTEM_HINTS: Record<string, string> = {
  'Microsoft 365': 'Email, calendar, OneDrive',
  'Dashlane': 'Shared password vault',
  'Dropbox': 'File storage',
  'Ramp': 'Corporate cards & spend',
};

export const ACCOUNT_STATUSES = ['Active', 'Needs review', 'Suspended', 'Closed'] as const;
export const ACCOUNT_SOURCES = ['Manual', 'Onboarding', 'Ramp', 'SSO'] as const;

export type AccountStatus = typeof ACCOUNT_STATUSES[number];

// Public new-hire intake: a per-person tokenized link (no login) where a future
// employee fills in their prerequisite info and uploads documents. On submit we
// create their Onboarding record, Staffing entry, and Employee File, and file
// the uploads. Forms differ by role (attorney / support staff / contractor).

export type IntakeRole = 'attorney' | 'support' | 'contractor';

export const INTAKE_ROLES: { key: IntakeRole; label: string; workerType: string; titleHint: string }[] = [
  { key: 'attorney', label: 'Attorney', workerType: 'Employee', titleHint: 'Attorney' },
  { key: 'support', label: 'Support Staff', workerType: 'Employee', titleHint: 'Support Staff' },
  { key: 'contractor', label: 'Contractor', workerType: 'Contractor', titleHint: 'Contractor' },
];

export interface IntakeField {
  id: string; label: string;
  type: 'text' | 'email' | 'tel' | 'date' | 'longtext' | 'select' | 'list';
  required?: boolean; options?: string[]; hint?: string;
}

// Fields everyone fills in (all three forms).
const COMMON: IntakeField[] = [
  { id: 'full_legal_name', label: 'Full legal name', type: 'text', required: true },
  { id: 'personal_email', label: 'Personal email', type: 'email', required: true },
  { id: 'phone', label: 'Mobile phone', type: 'tel', required: true },
  { id: 'home_address', label: 'Home mailing address', type: 'longtext' },
  { id: 'dob', label: 'Date of birth', type: 'date' },
  { id: 'weight', label: 'Weight (lbs)', type: 'text', hint: 'Used only for weight-and-balance planning in case you ever travel on the firm’s Vision Jet in the future.' },
  { id: 'tsa_ktn', label: 'TSA PreCheck / Known Traveler Number (KTN)', type: 'text' },
  { id: 'favorite_color', label: 'Favorite color', type: 'text' },
  { id: 'favorite_snack', label: 'Favorite snack', type: 'text' },
  { id: 'emergency_name', label: 'Emergency contact — name', type: 'text' },
  { id: 'emergency_phone', label: 'Emergency contact — phone', type: 'tel' },
];

// Role-specific fields, inserted after the common ones.
const BY_ROLE: Record<IntakeRole, IntakeField[]> = {
  attorney: [
    { id: 'bar_numbers', label: 'Bar number(s) & state(s)', type: 'text', required: true, hint: 'e.g. TX #12345678; NY #4567890' },
    { id: 'bar_admission', label: 'Bar admission date(s)', type: 'text' },
    { id: 'state_bar_logins', label: 'State bar portal login(s)', type: 'longtext', hint: 'For each state bar you’re admitted to, share your online portal login so HR can pay your bar fees and track your license. Include the state, portal username, and password.' },
    { id: 'other_court_logins', label: 'Other court e-filing login(s)', type: 'longtext', hint: 'If you have logins for any other court e-filing systems not already covered (beyond PACER, Tybera, and Davidson County), please share them here so Caitlin can set up access. Include the court/system, username, and password.' },
    { id: 'court_admissions', label: 'Court admissions', type: 'list', hint: 'List each court you’re admitted to practice in — add a row for each. Or upload your admissions documents below.' },
    { id: 'law_school', label: 'Law school', type: 'text' },
    { id: 'practice_areas', label: 'Primary practice areas', type: 'text' },
    { id: 'pacer_username', label: 'PACER username (if you have one)', type: 'text' },
  ],
  support: [
    { id: 'role_title', label: 'Role / title', type: 'text' },
    { id: 'shirt_size', label: 'Shirt size', type: 'select', options: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'] },
  ],
  contractor: [
    { id: 'business_name', label: 'Business / entity name', type: 'text' },
    { id: 'business_type', label: 'Business type', type: 'select', options: ['Sole proprietor', 'Single-member LLC', 'LLC', 'S-Corp', 'C-Corp', 'Partnership'] },
    { id: 'services', label: 'Services you provide', type: 'text' },
    { id: 'services_start', label: 'Engagement start date', type: 'date' },
  ],
};

// Always last on every form.
const TAIL: IntakeField[] = [
  { id: 'additional_notes', label: 'Additional notes', type: 'longtext', hint: 'Anything else you’d like us to know.' },
];

// Documents everyone should upload, plus role-specific ones.
const COMMON_UPLOADS = ['Driver’s license', 'Passport'];
const UPLOADS: Record<IntakeRole, string[]> = {
  attorney: ['Bar card / license', 'Court admission certificates (if not listed above)'],
  support: [],
  contractor: ['Signed W-9', 'Certificate of Insurance (COI)', 'Signed contract / SOW'],
};

// Fields that must always be included (needed to create the records).
export const REQUIRED_FIELDS = ['full_legal_name'];

export function isIntakeRole(v: any): v is IntakeRole { return INTAKE_ROLES.some(r => r.key === v); }
export function intakeFields(role: IntakeRole): IntakeField[] { return [...COMMON, ...(BY_ROLE[role] ?? []), ...TAIL]; }
export function intakeUploads(role: IntakeRole): string[] { return [...COMMON_UPLOADS, ...(UPLOADS[role] ?? [])]; }

// Narrow a role's full form to only the fields / uploads the sender chose.
// `include == null` (no selection stored) means "everything" — older links and
// the default. full_legal_name is always kept.
export function filterFields(role: IntakeRole, include?: string[] | null): IntakeField[] {
  const all = intakeFields(role);
  if (!include) return all;
  const set = new Set([...include, ...REQUIRED_FIELDS]);
  return all.filter(f => set.has(f.id));
}
export function filterUploads(role: IntakeRole, include?: string[] | null): string[] {
  const all = intakeUploads(role);
  if (!include) return all;
  const set = new Set(include);
  return all.filter(u => set.has(u));
}
export function roleLabel(role: string): string { return INTAKE_ROLES.find(r => r.key === role)?.label ?? role; }
export function roleMeta(role: string) { return INTAKE_ROLES.find(r => r.key === role) ?? INTAKE_ROLES[0]; }

// Human label for an answer key (used in the filed summary / emails).
export function fieldLabel(role: IntakeRole, id: string): string {
  return intakeFields(role).find(f => f.id === id)?.label ?? id;
}

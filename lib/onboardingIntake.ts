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
  type: 'text' | 'email' | 'tel' | 'date' | 'longtext' | 'select';
  required?: boolean; options?: string[]; hint?: string;
}

// Fields everyone fills in.
const COMMON: IntakeField[] = [
  { id: 'full_legal_name', label: 'Full legal name', type: 'text', required: true },
  { id: 'preferred_name', label: 'Preferred name', type: 'text' },
  { id: 'personal_email', label: 'Personal email', type: 'email', required: true },
  { id: 'phone', label: 'Mobile phone', type: 'tel', required: true },
  { id: 'home_address', label: 'Home mailing address', type: 'longtext' },
  { id: 'dob', label: 'Date of birth', type: 'date' },
  { id: 'start_date', label: 'Anticipated start date', type: 'date' },
  { id: 'emergency_name', label: 'Emergency contact — name', type: 'text' },
  { id: 'emergency_phone', label: 'Emergency contact — phone', type: 'tel' },
];

// Role-specific fields, appended after the common ones.
const BY_ROLE: Record<IntakeRole, IntakeField[]> = {
  attorney: [
    { id: 'bar_numbers', label: 'Bar number(s) & state(s)', type: 'text', required: true, hint: 'e.g. TX #12345678; NY #4567890' },
    { id: 'bar_admission', label: 'Bar admission date(s)', type: 'text' },
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

// Suggested documents per role. Freeform uploads are always allowed too.
const UPLOADS: Record<IntakeRole, string[]> = {
  attorney: ['Bar card / license', 'Signed offer letter', 'Direct deposit form or voided check', 'Government photo ID'],
  support: ['Signed offer letter', 'Direct deposit form or voided check', 'Government photo ID'],
  contractor: ['Signed W-9', 'Certificate of Insurance (COI)', 'Signed contract / SOW'],
};

export function isIntakeRole(v: any): v is IntakeRole { return INTAKE_ROLES.some(r => r.key === v); }
export function intakeFields(role: IntakeRole): IntakeField[] { return [...COMMON, ...(BY_ROLE[role] ?? [])]; }
export function intakeUploads(role: IntakeRole): string[] { return UPLOADS[role] ?? []; }
export function roleLabel(role: string): string { return INTAKE_ROLES.find(r => r.key === role)?.label ?? role; }
export function roleMeta(role: string) { return INTAKE_ROLES.find(r => r.key === role) ?? INTAKE_ROLES[0]; }

// Human label for an answer key (used in the filed summary / emails).
export function fieldLabel(role: IntakeRole, id: string): string {
  return intakeFields(role).find(f => f.id === id)?.label ?? id;
}

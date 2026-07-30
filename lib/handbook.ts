// Litson PLLC Employee Handbook — citable policy references for discipline forms.
// Lets HR drop the exact section + standard into a warning instead of paraphrasing.
// Quotes are condensed from the handbook (eff. 02-05-2026); section numbers are exact.

export interface HandbookRef {
  id: string;
  issues: string[];       // which HR problems this supports
  section: string;        // e.g. "§3.2"
  title: string;
  standard: string;       // the quotable standard / rule
}

// Buckets shown in the picker.
export const HANDBOOK_ISSUES = [
  'Attendance & tardiness',
  'Performance & quality',
  'PTO / availability',
  'Conduct & misconduct',
  'Insubordination',
  'Confidentiality',
  'Technology & systems',
  'Communication',
  'Harassment & violence',
  'Timekeeping',
  'Safety',
  'Company property',
] as const;

export const HANDBOOK_REFS: HandbookRef[] = [
  {
    id: 'attendance-32', issues: ['Attendance & tardiness', 'PTO / availability'],
    section: '§3.2', title: 'Work Hours, Availability & Coverage',
    standard: 'Full-time employees are expected to work a minimum of 40 hours per week, generally aligned with a 9:00 a.m.–5:00 p.m. schedule, and to be consistently available during core working hours, meet all deadlines and workload expectations, and communicate proactively if availability will be impacted.',
  },
  {
    id: 'attendance-71', issues: ['Attendance & tardiness', 'Conduct & misconduct'],
    section: '§7.1', title: 'Standards of Conduct',
    standard: 'Excessive absenteeism is listed among the behaviors considered unacceptable in the workplace and may result in disciplinary action, up to and including termination of employment.',
  },
  {
    id: 'perf-36', issues: ['Performance & quality'],
    section: '§3.6', title: 'Performance Expectations & Accountability',
    standard: 'Employee performance is evaluated on accuracy and attention to detail, timeliness and reliability, quality of work product, professional judgment, and compliance with Firm policies. Employees are expected to accept feedback and take corrective action where required.',
  },
  {
    id: 'comm-35', issues: ['Communication', 'Performance & quality'],
    section: '§3.5', title: 'Communication Standards',
    standard: 'Professional communication is required at all times — employees are expected to communicate clearly, respectfully, and promptly, escalate urgent matters immediately, and use professional language. Failure to follow communication standards may impact performance evaluations.',
  },
  {
    id: 'pto-32', issues: ['PTO / availability'],
    section: '§3.2', title: 'Unlimited PTO — Employee Responsibilities',
    standard: 'Unlimited PTO does not eliminate job responsibilities, deadlines, or performance expectations. Employees must ensure deadlines and coverage are handled and must update the Firm’s availability calendar. Failure to meet performance, availability, or workload expectations while using PTO may result in performance management or disciplinary action.',
  },
  {
    id: 'conduct-71', issues: ['Conduct & misconduct', 'Insubordination'],
    section: '§7.1', title: 'Standards of Conduct',
    standard: 'Unacceptable workplace behavior — including theft, falsification of timekeeping records, fighting or threatening violence, harassment, excessive absenteeism, and unauthorized use of company equipment — may result in disciplinary action, up to and including termination of employment.',
  },
  {
    id: 'discipline-72', issues: ['Conduct & misconduct', 'Insubordination'],
    section: '§7.2', title: 'Disciplinary Action',
    standard: 'Disciplinary action is intended to fairly correct behavior and performance problems and may include verbal warning, written warning, suspension, and termination depending on severity and frequency. Certain serious violations — including workplace violence, harassment, theft, and insubordinate behavior — may justify immediate termination without prior steps.',
  },
  {
    id: 'insub-72', issues: ['Insubordination'],
    section: '§7.2', title: 'Disciplinary Action — Serious Violations',
    standard: 'Insubordinate behavior is identified as a serious violation that may justify termination of employment without observing other disciplinary steps first.',
  },
  {
    id: 'conf-73', issues: ['Confidentiality'],
    section: '§7.3', title: 'Confidentiality',
    standard: 'Employees may not disclose confidential or non-public proprietary information to any unauthorized individual. Unauthorized disclosure of Confidential Information may result in disciplinary action, up to and including termination of employment.',
  },
  {
    id: 'conf-33', issues: ['Confidentiality'],
    section: '§3.3', title: 'Confidentiality & Data Security',
    standard: 'Employees must maintain strict confidentiality of all client, Firm, and case-related information and access information only as necessary to perform assigned duties. Violation of confidentiality obligations may result in immediate disciplinary action, up to and including termination of employment.',
  },
  {
    id: 'tech-34', issues: ['Technology & systems'],
    section: '§3.4', title: 'Technology & Systems Use',
    standard: 'Firm systems are provided for business purposes only. Employees must not share login credentials or allow unauthorized access to Firm systems; all electronic systems remain the property of Litson PLLC.',
  },
  {
    id: 'tech-79', issues: ['Technology & systems'],
    section: '§7.9', title: 'Computer, Email & Internet Usage',
    standard: 'Firm computer, email, and internet resources are provided for business use. Misuse of Firm systems may result in disciplinary action, up to and including termination of employment.',
  },
  {
    id: 'phone-76', issues: ['Technology & systems', 'Company property'],
    section: '§7.6', title: 'Telephone Usage',
    standard: 'The Firm-issued work number (Dialpad) is for business purposes only and may not be used for personal matters. Personal communications must be limited and not interfere with work. Misuse of Firm communication systems may result in disciplinary action.',
  },
  {
    id: 'property-78', issues: ['Company property'],
    section: '§7.8', title: 'Use of Company Property',
    standard: 'Company property is for business necessity only. Employees are responsible for using and caring for assigned equipment properly; all equipment remains Firm property subject to reassignment or use without notice.',
  },
  {
    id: 'harass-75', issues: ['Harassment & violence'],
    section: '§7.5', title: 'Sexual & Other Unlawful Harassment',
    standard: 'The Firm prohibits discrimination and all forms of harassment based on any protected characteristic. Any employee found to have engaged in sexual or other unlawful harassment may be subject to disciplinary action, up to and including termination of employment.',
  },
  {
    id: 'violence-74', issues: ['Harassment & violence', 'Safety'],
    section: '§7.4', title: 'Workplace Violence',
    standard: 'The Firm strictly prohibits workplace violence, including intimidation, threats, harassment, physical violence, verbal abuse, or coercion. The Firm will take prompt remedial action, up to and including immediate termination, against any employee found to have engaged in threatening behavior or acts of violence.',
  },
  {
    id: 'abusive-25', issues: ['Harassment & violence', 'Conduct & misconduct'],
    section: '§2.5', title: 'Abusive Conduct Prevention (Tennessee)',
    standard: 'The Firm is committed to a workplace free of abusive conduct. Employees engaging in abusive conduct may be subject to disciplinary action.',
  },
  {
    id: 'timekeeping-71', issues: ['Timekeeping'],
    section: '§7.1', title: 'Standards of Conduct — Timekeeping',
    standard: 'Falsification of timekeeping records is listed as unacceptable conduct that may result in disciplinary action, up to and including termination of employment.',
  },
  {
    id: 'safety-52', issues: ['Safety'],
    section: '§5.2', title: 'Workplace Safety',
    standard: 'Employees are expected to follow all safety and health rules. Violation of safety or health rules is listed among the behaviors that may result in disciplinary action.',
  },
];

// Ready-to-paste citation string.
export function citationText(r: HandbookRef): string {
  return `Employee Handbook ${r.section} — ${r.title}: "${r.standard}"`;
}

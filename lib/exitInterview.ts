// Standard exit-interview questionnaire, sent to a departing employee to
// complete via a private link. Framework-free so it works server + client side.

export interface ExitQuestion { id: string; label: string; type: 'text' | 'longtext' | 'choice' | 'rating'; options?: string[] }

export const EXIT_QUESTIONS: ExitQuestion[] = [
  { id: 'reason', type: 'choice', label: 'What is your primary reason for leaving?', options: ['New opportunity', 'Compensation', 'Career growth', 'Work environment', 'Relocation', 'Personal reasons', 'Retirement', 'Other'] },
  { id: 'enjoyed', type: 'longtext', label: 'What did you enjoy most about working at Litson PLLC?' },
  { id: 'improve', type: 'longtext', label: 'What could the firm do better?' },
  { id: 'manager', type: 'choice', label: 'Did you feel supported by your manager?', options: ['Always', 'Usually', 'Sometimes', 'Rarely', 'Never'] },
  { id: 'tools', type: 'choice', label: 'Did you have the tools and resources to do your job well?', options: ['Yes', 'Mostly', 'Somewhat', 'No'] },
  { id: 'recommend', type: 'choice', label: 'Would you recommend Litson PLLC as a place to work?', options: ['Yes', 'Maybe', 'No'] },
  { id: 'rating', type: 'rating', label: 'Overall, how would you rate your experience?' },
  { id: 'comments', type: 'longtext', label: 'Anything else you would like to share?' },
];

export function exitAnswerLabel(q: ExitQuestion, val: any): string {
  if (val == null || val === '') return '—';
  if (q.type === 'rating') return `${val} / 5`;
  return String(val);
}

// Employee "info request" form: a per-person tokenized link (no login) where an
// employee fills in personal details we don't want to ask for over email. On
// submit the answers flow into BOTH Staffing (staff_directory) and the person's
// Employee File — the same way the Tools & Access survey does for accounts.
//
// Which fields to collect is configurable per send (see FIELDS below), so the
// same mechanism can gather a personal email today and, say, an emergency
// contact next time without any code change on the form.

export type InfoFieldType = 'email' | 'tel' | 'text' | 'textarea' | 'date';

export interface InfoField {
  id: string;              // stable key used in answers JSON
  label: string;           // shown on the form AND used as the Staffing/File column name
  type: InfoFieldType;
  hint?: string;           // helper text under the field
  // If set, the answer also writes to this built-in staff_directory column.
  // If omitted, the answer is stored as a custom Staffing column (in `extra`)
  // under `label`, which also mirrors into the Employee File.
  staffCol?: string;
}

// The catalog of things we can ask an employee to provide. Add to this list to
// offer more fields in the "Request info" picker.
export const FIELDS: InfoField[] = [
  { id: 'personal_email', label: 'Personal Email', type: 'email', hint: 'A non-work email we can reach you at (e.g. Gmail).' },
  { id: 'personal_phone', label: 'Personal Phone Number', type: 'tel', staffCol: 'personal_phone', hint: 'Your personal cell number.' },
  { id: 'address', label: 'Home Address', type: 'textarea', staffCol: 'address', hint: 'Street, city, state, ZIP.' },
  { id: 'dob', label: 'Date of Birth', type: 'date', staffCol: 'dob' },
  { id: 'emergency_contact', label: 'Emergency Contact', type: 'text', hint: 'Name & phone number of someone we can call.' },
  { id: 'shirt_size', label: 'Shirt Size', type: 'text', hint: 'For firm swag (e.g. M, L, XL).' },
];

// What a brand-new request asks for unless the sender changes it.
export const DEFAULT_FIELD_IDS = ['personal_email'];

export function fieldById(id: string): InfoField | undefined {
  return FIELDS.find(f => f.id === id);
}
export function fieldsByIds(ids: string[]): InfoField[] {
  return ids.map(fieldById).filter(Boolean) as InfoField[];
}

const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// The email an employee receives with the link to the form. Kept in a builder so
// the same markup renders the on-screen preview and the real message.
export function infoRequestEmail(name: string, url: string, fields: InfoField[]): string {
  const first = esc(String(name || '').split(' ')[0] || 'there');
  const list = fields.map(f => `<li style="margin:2px 0">${esc(f.label)}</li>`).join('');
  return `<div style="font-family:Arial,sans-serif;color:#1b2a3d;max-width:560px">
    <div style="background:#1b2a3d;border-top:3px solid #c9a24a;border-radius:10px;padding:14px 16px;margin-bottom:16px">
      <div style="font-size:14px;font-weight:700;letter-spacing:4px;color:#c9a24a">LITSON</div>
      <div style="font-size:7.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#9fb0c4;margin-top:2px">PLLC &middot; Human Resources</div>
    </div>
    <p>Hi ${first},</p>
    <p>We're updating our employee records and need a couple of details from you. It only takes a minute — no login or password required. Please confirm the following:</p>
    <ul style="margin:8px 0 14px 18px;padding:0;color:#33445e;font-size:14px">${list}</ul>
    <p style="margin:18px 0"><a href="${esc(url)}" style="display:inline-block;background:#1b2a3d;color:#fff;text-decoration:none;font-weight:bold;padding:11px 22px;border-radius:8px">Update my info</a></p>
    <p style="font-size:12px;color:#666">Or paste this link into your browser:<br>${esc(url)}</p>
    <p style="font-size:12px;color:#999;margin-top:14px">Your responses are shared only with Litson PLLC's HR team.</p>
  </div>`;
}

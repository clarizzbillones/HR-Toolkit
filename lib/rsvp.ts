// Event RSVP surveys: a no-login, tokenized form employees fill in to RSVP to
// a firm event. Answers roll up into a headcount. Events are defined here in
// code (add to EVENTS to offer a new form); responses live in event_rsvps.

export interface RsvpQuestion {
  id: string; label: string;
  type?: 'choice' | 'text';       // default 'choice'
  options?: string[];             // for 'choice'
  showIf?: { q: string; value: string }; // only show when another answer matches
}
export interface EventDef { id: string; title: string; description: string; questions: RsvpQuestion[] }

export const EVENTS: EventDef[] = [
  {
    id: 'happy-hour-oct19',
    title: 'October 19 Happy Hour — Headcount',
    description: `We're planning a happy hour on October 19 from 5:30–7:00 PM to welcome our international employees who will be in town! Spouses/plus-ones are welcome.\n\nPlease RSVP below so we can get an accurate headcount.`,
    questions: [
      { id: 'attending', label: 'Will you be attending?', type: 'choice', options: ['Yes', 'No'] },
      { id: 'plus_one', label: 'Will you be bringing a spouse/plus-one?', type: 'choice', options: ['Yes', 'No'] },
      { id: 'plus_one_name', label: 'Your spouse/plus-one’s name', type: 'text', showIf: { q: 'plus_one', value: 'Yes' } },
    ],
  },
];

export function eventById(id: string | null | undefined): EventDef | undefined {
  return EVENTS.find(e => e.id === id);
}

const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function rsvpEmail(name: string, url: string, ev: EventDef, reminder = false): string {
  const first = esc(String(name || '').split(' ')[0] || 'there');
  const desc = esc(ev.description).replace(/\n+/g, '</p><p style="margin:8px 0">');
  return `<div style="font-family:Arial,sans-serif;color:#1b2a3d;max-width:560px">
    <div style="background:#1b2a3d;border-top:3px solid #c9a24a;border-radius:10px;padding:14px 16px;margin-bottom:16px">
      <div style="font-size:14px;font-weight:700;letter-spacing:4px;color:#c9a24a">LITSON</div>
      <div style="font-size:7.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#9fb0c4;margin-top:2px">PLLC &middot; Human Resources</div>
    </div>
    <p>Hi ${first},</p>
    <p style="font-size:16px;font-weight:700;color:#1b2a3d;margin:6px 0">${esc(ev.title)}</p>
    <p style="margin:8px 0">${desc}</p>
    <p style="margin:18px 0"><a href="${esc(url)}" style="display:inline-block;background:#1b2a3d;color:#fff;text-decoration:none;font-weight:bold;padding:11px 22px;border-radius:8px">${reminder ? 'RSVP now' : 'RSVP here'}</a></p>
    <p style="font-size:12px;color:#666">Or paste this link into your browser:<br>${esc(url)}</p>
    <p style="font-size:12px;color:#999;margin-top:14px">Thank you!</p>
  </div>`;
}

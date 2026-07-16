// Run: node --require esbuild-register lib/reviews.test.ts
// Verifies the performance-review scheduling logic (spec §9) and the staff-facing
// copy guarantee (spec §7).
import { readFileSync } from 'fs';
import { join } from 'path';
import { nextReviewDate, reviewCycle, tenureLabel, addMonths, statusFor, computeReview } from './reviews';

let failures = 0;
function eq(label: string, got: any, exp: any) {
  const ok = got === exp;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  got ${JSON.stringify(got)} expected ${JSON.stringify(exp)}`}`);
}

// §9 — scheduling
const cases: [string, string, string | null, string, number, string][] = [
  ['Never reviewed', '2026-03-02', null, '2026-09-02', 1, '0.5 yr'],
  ['Early review (grace month)', '2025-04-21', '2025-10-15', '2026-04-21', 2, '1.0 yr'],
  ['On time', '2025-12-30', '2026-07-02', '2026-12-30', 2, '1.0 yr'],
  ['Past 1 yr — must keep going', '2024-05-20', '2026-05-28', '2026-11-20', 5, '2.5 yr'],
  ['Late review, no drift', '2024-08-15', '2026-05-07', '2026-08-15', 4, '2.0 yr'],
  ['Month-end clamp', '2024-08-31', null, '2025-02-28', 1, '0.5 yr'],
];
for (const [name, hire, last, en, ec, et] of cases) {
  eq(`next  · ${name}`, nextReviewDate(hire, last), en);
  eq(`cycle · ${name}`, reviewCycle(hire, last), ec);
  eq(`tenure· ${name}`, tenureLabel(hire, last), et);
}
// A review logged at cycle 2 (the 1-year mark) produces cycle 3, not null.
eq('cycle-2 review -> cycle 3', reviewCycle('2025-01-10', addMonths('2025-01-10', 12)), 3);

// §4 — status thresholds
eq('status >42', statusFor(43), 'Scheduled');
eq('status 42', statusFor(42), 'Send forms');
eq('status 29', statusFor(29), 'Send forms');
eq('status 28', statusFor(28), 'Forms due');
eq('status 15', statusFor(15), 'Forms due');
eq('status 14', statusFor(14), 'Review week');
eq('status 0', statusFor(0), 'Review week');
eq('status <0', statusFor(-1), 'Overdue');

// Roll-forward: a review missed past the ~90-day grace window advances to the
// next milestone; one still within the window stays overdue.
{
  const t = '2026-07-16';
  const fer = computeReview('2025-02-25', '2025-11-11', t); // 1yr missed by ~141d
  eq('roll · Fer next', fer.next, '2026-08-25');
  eq('roll · Fer cycle', fer.cycle, 3);
  eq('roll · Fer tenure', fer.tenure, '1.5 yr');
  const recent = computeReview('2026-01-10', null, t); // 6mo due Jul 10, ~6d overdue
  eq('roll · recent stays overdue', recent.next, '2026-07-10');
  eq('roll · recent status', recent.status, 'Overdue');
  const future = computeReview('2026-05-01', null, t); // future, untouched
  eq('roll · future untouched', future.next, '2026-11-01');
}

// §7 — no staff-facing template interpolates tenure_label or cycle_number
for (const rel of ['reviewEmail.ts', 'inviteReminders.ts']) {
  const src = readFileSync(join(__dirname, rel), 'utf8').toLowerCase();
  eq(`${rel} has no tenure interpolation`, /\btenure_label\b|\bcycle_number\b/.test(src), false);
}

console.log(`\n${failures === 0 ? 'ALL PASS' : failures + ' FAILURE(S)'}`);
if (failures) process.exit(1);

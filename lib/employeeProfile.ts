// Shared shape for Employee File profiles: the extra personal / travel columns
// carried over from Staffing (plus address & salary, entered here manually).

export const EXTRA_COLS = ['address', 'salary', 'dob', 'favorite_color', 'favorite_treat', 'ktn', 'marriott', 'delta', 'southwest', 'american', 'weight', 'worker_type'] as const;

// Map a Staffing (staff_directory) row onto profile columns. Includes `address`
// and the `extra` JSON (custom Staffing columns like "Personal Email") so every
// Staffing field — built-in or custom — flows into the Employee File.
export function staffToProfile(s: any): Record<string, any> {
  return {
    position: s.position ?? null, email: s.email ?? null, phone: s.personal_phone ?? s.dialpad ?? null,
    address: s.address ?? null,
    start_date: s.start_date ?? null, dob: s.dob ?? null, favorite_color: s.favorite_color ?? null,
    favorite_treat: s.favorite_treat ?? null, ktn: s.ktn ?? null, marriott: s.marriott ?? null,
    delta: s.delta ?? null, southwest: s.southwest ?? null, american: s.american ?? null,
    weight: s.weight ?? null, worker_type: s.worker_type ?? null,
    extra: s.extra != null && String(s.extra).trim() ? String(s.extra) : null,
  };
}

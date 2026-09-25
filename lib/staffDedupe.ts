// Collapse duplicate Staffing rows for the same person into one. Rows are
// grouped by a nickname-tolerant name key (William "Bill" Abely == William
// Abely); a non-offboarded row is kept, its blank columns (and custom "extra"
// fields) are filled from the others, then the duplicates are deleted.
// Idempotent — once collapsed, each group has a single row. Shared by the
// Staffing page (SSR) and the Staffing API so duplicates clear themselves on
// load, no manual merge step required.
import { sql } from '@/lib/db';
import { coreName } from '@/lib/intakeSync';

const DUP_COLS = ['worker_type', 'position', 'dialpad', 'personal_phone', 'email', 'address', 'start_date', 'dob', 'favorite_color', 'favorite_treat', 'note', 'ktn', 'marriott', 'delta', 'southwest', 'american', 'weight'] as const;

export async function autoMergeDuplicateStaff(): Promise<void> {
  try {
    await sql`ALTER TABLE staff_directory ADD COLUMN IF NOT EXISTS extra TEXT`;
    const rows = await sql`SELECT * FROM staff_directory ORDER BY created_at ASC` as any[];
    const groups = new Map<string, any[]>();
    for (const r of rows) {
      const k = coreName(r.name);
      if (!k) continue;
      const g = groups.get(k); if (g) g.push(r); else groups.set(k, [r]);
    }
    for (const g of groups.values()) {
      if (g.length < 2) continue;
      const keep = g.find(r => !r.offboarded) || g[0];
      const others = g.filter(r => r.id !== keep.id);
      const upd: Record<string, any> = {};
      let mergedExtra: Record<string, any> = {};
      try { mergedExtra = keep.extra ? JSON.parse(keep.extra) : {}; } catch { /* ignore */ }
      for (const o of others) {
        for (const c of DUP_COLS) {
          if (upd[c] === undefined && !String(keep[c] ?? '').trim() && o[c] != null && String(o[c]).trim()) upd[c] = o[c];
        }
        try { const oe = o.extra ? JSON.parse(o.extra) : {}; mergedExtra = { ...oe, ...mergedExtra }; } catch { /* ignore */ }
      }
      if (Object.keys(mergedExtra).length) upd.extra = JSON.stringify(mergedExtra);
      if (Object.keys(upd).length) await sql`UPDATE staff_directory SET ${sql(upd)} WHERE id = ${keep.id}`;
      for (const o of others) await sql`DELETE FROM staff_directory WHERE id = ${o.id}`;
    }
  } catch { /* best-effort */ }
}

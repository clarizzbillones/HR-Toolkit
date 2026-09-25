// Collapse duplicate Staffing rows for the same person into one. Rows are
// grouped by a nickname-tolerant name key (William "Bill" Abely == William
// Abely); a non-offboarded row is kept, its blank columns (and custom "extra"
// fields) are filled from the others, then the duplicates are deleted.
// Idempotent — once collapsed, each group has a single row. Shared by the
// Staffing page (SSR) and the Staffing API so duplicates clear themselves on
// load, no manual merge step required.
import { sql } from '@/lib/db';
import { coreName } from '@/lib/intakeSync';

const parseArr = (s: any): string[] => { try { const p = JSON.parse(s ?? '[]'); return Array.isArray(p) ? p.map(String) : []; } catch { return []; } };
const parseMap = (s: any): Record<string, string> => { try { const p = JSON.parse(s ?? '{}'); return p && typeof p === 'object' && !Array.isArray(p) ? p : {}; } catch { return {}; } };
const normLabel = (s: any) => String(s ?? '').toLowerCase().replace(/[^a-z]/g, '');
// Custom column labels that duplicate the built-in "Address" field.
const ADDRESS_LIKE = new Set(['address', 'homeaddress', 'mailingaddress', 'homemailingaddress', 'addresshome', 'residentialaddress']);

// One-off self-heal: a custom "Address" column (stored per-row in `extra`) can
// end up alongside the built-in `address` field, so Staffing shows two Address
// columns. Move each row's custom value into the built-in `address` (only when
// that's blank — never lose existing data; a genuine conflict is preserved in
// the note), strip the custom value from `extra`, then drop the custom column
// from the saved config. Idempotent — once the custom column is gone it no-ops.
export async function dedupeAddressColumn(): Promise<void> {
  try {
    await sql`CREATE TABLE IF NOT EXISTS app_settings (id TEXT PRIMARY KEY)`;
    for (const c of ['staff_columns', 'staff_col_order', 'staff_col_labels'])
      await sql`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS ${sql(c)} TEXT`;
    const [cfg] = await sql`SELECT staff_columns, staff_col_order, staff_col_labels FROM app_settings WHERE id = 'singleton'` as any[];
    if (!cfg) return;
    const columns = parseArr(cfg.staff_columns);
    const order = parseArr(cfg.staff_col_order);
    const labels = parseMap(cfg.staff_col_labels);
    // A custom column is a duplicate Address when its label (or its own id) reads
    // as an address. Never touches the built-in `address` — it isn't in `columns`.
    const dupCols = columns.filter(id => ADDRESS_LIKE.has(normLabel(labels[id] ?? id)));
    if (!dupCols.length) return;

    await sql`ALTER TABLE staff_directory ADD COLUMN IF NOT EXISTS address TEXT`;
    await sql`ALTER TABLE staff_directory ADD COLUMN IF NOT EXISTS extra TEXT`;
    const rows = await sql`SELECT id, address, note, extra FROM staff_directory` as any[];
    for (const r of rows) {
      let obj: Record<string, any> = {};
      try { obj = r.extra ? JSON.parse(r.extra) : {}; } catch { obj = {}; }
      // First non-blank custom address value on this row.
      let custom = '';
      for (const dc of dupCols) { const v = String(obj[dc] ?? '').trim(); if (v) { custom = v; break; } }
      let extraChanged = false;
      for (const dc of dupCols) { if (dc in obj) { delete obj[dc]; extraChanged = true; } }

      const builtin = String(r.address ?? '').trim();
      let newAddr = r.address;
      let newNote = r.note;
      if (custom) {
        if (!builtin) newAddr = custom;                 // fill the blank built-in
        else if (builtin !== custom) {                  // real conflict — keep both
          const tag = `Alt address: ${custom}`;
          if (!String(r.note ?? '').includes(tag)) newNote = [String(r.note ?? '').trim(), tag].filter(Boolean).join(' | ');
        }
      }
      if (extraChanged || newAddr !== r.address || newNote !== r.note) {
        await sql`UPDATE staff_directory SET address = ${newAddr}, note = ${newNote}, extra = ${JSON.stringify(obj)} WHERE id = ${r.id}`;
      }
    }

    const drop = new Set(dupCols);
    const newColumns = columns.filter(id => !drop.has(id));
    const newOrder = order.filter(id => !drop.has(id));
    const newLabels: Record<string, string> = {};
    for (const [k, v] of Object.entries(labels)) if (!drop.has(k)) newLabels[k] = v;
    await sql`UPDATE app_settings SET staff_columns = ${JSON.stringify(newColumns)}, staff_col_order = ${JSON.stringify(newOrder)}, staff_col_labels = ${JSON.stringify(newLabels)} WHERE id = 'singleton'`;
  } catch { /* best-effort */ }
}

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

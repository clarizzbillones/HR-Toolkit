// Holiday / Christmas gift tracker — schema + one-time seed of the starter list.
import { sql, cuid } from '@/lib/db';

const SEED: [string, string, string][] = [
  ['Dave', 'Catalyze', '162 Lucia Ct\nJupiter, FL 33478'],
  ['OakPointe', 'Office', '54 Music Square E, Suite 100\nNashville, TN 37203'],
  ['Ashley Webber', 'ServisFirst', '1600 West End Ave #200\nNashville, TN 37203'],
  ['Kayla Husky', 'ServisFirst', '1600 West End Ave #200\nNashville, TN 37203'],
  ['Don Medine', 'Litson Jet', '2000 Mallory Ln., Ste. 290, PMB #1039\nFranklin, TN 37067'],
  ['Nathan Caldwell', 'Accountant', '5355 Pinehurst Park Dr., Apt. 438\nCharlotte, NC 28211'],
];

export async function ensureGifts(): Promise<void> {
  await sql`CREATE TABLE IF NOT EXISTS gift_recipients (
    id TEXT PRIMARY KEY,
    name TEXT, relationship TEXT, address TEXT, phone TEXT,
    tier TEXT, ordered BOOLEAN DEFAULT false, ordered_note TEXT,
    mailed BOOLEAN DEFAULT false, sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM gift_recipients` as any[];
  if (n === 0) {
    let i = 0;
    for (const [name, relationship, address] of SEED) {
      await sql`INSERT INTO gift_recipients (id, name, relationship, address, phone, tier, ordered, ordered_note, mailed, sort_order)
        VALUES (${cuid()}, ${name}, ${relationship}, ${address}, ${''}, ${''}, false, ${''}, false, ${i++})`;
    }
  }
}

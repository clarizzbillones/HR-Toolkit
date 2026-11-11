// Format a pay value, understanding hourly vs annual rates so an hourly
// employee's pay reads as a rate, not an annual figure.
//
//   "120000"        -> "$120,000"        (annual, the default)
//   "120000/yr"     -> "$120,000/yr"
//   "50/hr"         -> "$50.00/hr"       (hourly keeps cents)
//   "50 per hour"   -> "$50.00/hr"
//   "$120k" / "$95,000" -> kept as typed (already formatted, no rate unit)
//   "TBD" / ""      -> returned unchanged
export function fmtPay(v: any): string {
  const s = String(v ?? '').trim();
  if (!s) return '';
  const low = s.toLowerCase();

  let unit = '';
  if (/(^|[^a-z])(hr|hour|hourly)([^a-z]|$)|\/\s*h\b|per\s*hour/.test(low)) unit = '/hr';
  else if (/(^|[^a-z])(yr|year|annual|annually)([^a-z]|$)|per\s*year/.test(low)) unit = '/yr';

  // Already-formatted dollar amount with no rate unit (e.g. "$120k", "$95,000"):
  // leave exactly as typed.
  if (s.startsWith('$') && !unit) return s;

  const num = s.replace(/[^0-9.]/g, '');
  if (!/\d/.test(num)) return s; // non-numeric like "TBD"
  const n = Number(num);
  if (!isFinite(n)) return s;

  const money = unit === '/hr'
    ? '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '$' + n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return money + unit;
}

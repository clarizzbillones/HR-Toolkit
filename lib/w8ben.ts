// IRS Form W-8BEN — fields the international contractor fills in. The values are
// overlaid onto the official flat PDF (public/forms/w8ben.pdf) at fixed
// coordinates in the fill route, so the government formatting is preserved.

export interface W8Field { id: string; label: string; type?: 'text' | 'date' | 'check'; req?: boolean; help?: string }

export const W8BEN_FIELDS: W8Field[] = [
  { id: 'name', label: '1. Name of individual who is the beneficial owner', req: true },
  { id: 'country', label: '2. Country of citizenship', req: true },
  { id: 'address', label: '3. Permanent residence address — street, apt/suite (no P.O. box)', req: true },
  { id: 'city3', label: 'City or town, state or province, postal code', req: true },
  { id: 'country3', label: 'Country', req: true },
  { id: 'mailing', label: '4. Mailing address (if different from above)' },
  { id: 'city4', label: 'City or town, state or province, postal code' },
  { id: 'country4', label: 'Country' },
  { id: 'usTin', label: '5. U.S. taxpayer identification number (SSN or ITIN), if any' },
  { id: 'foreignTin', label: '6a. Foreign tax identifying number' },
  { id: 'ftinNotReq', label: '6b. Check if FTIN not legally required', type: 'check' },
  { id: 'reference', label: '7. Reference number(s)' },
  { id: 'dob', label: '8. Date of birth', type: 'date', req: true },
  { id: 'printName', label: 'Print name of signer (Part III)', req: true },
  { id: 'signDate', label: 'Date signed', type: 'date', req: true },
];

// Clean, consistent Excel sheets for exports (works with xlsx-js-style, passed in as `X`):
// navy header, optional merged group headings above it, filter buttons,
// light zebra rows and borders, $ formatting on money columns, and an optional Totals row.

const NAVY = '1B2A3D', BAND = 'F1ECE3', ZEBRA = 'FAF8F4', LINE = 'E5DED2', INK = '1F2937';
const thin = { style: 'thin', color: { rgb: LINE } };
const border = { top: thin, bottom: thin, left: thin, right: thin };
const font = (o: object = {}) => ({ name: 'Calibri', sz: 10, color: { rgb: INK }, ...o });
export const MONEY = '"$"#,##0.00';

export interface SheetSpec {
  headers: string[];
  rows: any[][];
  money?: (colIndex: number) => boolean;     // columns shown as dollars
  groups?: { label: string; span: number }[]; // merged headings above `headers` (spans add up to headers.length)
  widths?: number[];
  totals?: boolean;                            // add a Totals row summing the money columns
}

const colName = (i: number) => { let s = ''; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };

export function styledSheet(X: any, spec: SheetSpec) {
  const { headers, rows, money = () => false, groups, widths, totals } = spec;
  const top = groups ? 2 : 1; // header rows
  const aoa: any[][] = [];
  if (groups) {
    const g: any[] = [];
    for (const grp of groups) { g.push(grp.label); for (let i = 1; i < grp.span; i++) g.push(''); }
    aoa.push(g);
  }
  aoa.push(headers);
  for (const r of rows) aoa.push(headers.map((_, i) => (r[i] === undefined || r[i] === null ? '' : r[i])));
  const firstData = top, lastData = top + rows.length - 1;
  if (totals && rows.length) {
    aoa.push(headers.map((_, i) => (i === 0 ? 'Totals' : money(i) ? { f: `SUM(${colName(i)}${firstData + 1}:${colName(i)}${lastData + 1})` } : '')));
  }
  const ws = X.utils.aoa_to_sheet(aoa.map(r => r.map(v => (v && typeof v === 'object' && 'f' in v ? null : v))));
  // Formulas, styles.
  aoa.forEach((r, ri) => r.forEach((v, ci) => {
    const ref = colName(ci) + (ri + 1);
    const cell = ws[ref] ?? (ws[ref] = { t: 's', v: '' });
    if (v && typeof v === 'object' && 'f' in v) { cell.f = v.f; cell.t = 'n'; delete cell.v; }
    const isGroup = groups && ri === 0, isHead = ri === top - 1, isTotal = totals && rows.length && ri === aoa.length - 1;
    if (isGroup) cell.s = { fill: { fgColor: { rgb: BAND } }, font: font({ bold: true }), alignment: { horizontal: 'center', vertical: 'center' }, border };
    else if (isHead) cell.s = { fill: { fgColor: { rgb: NAVY } }, font: font({ bold: true, color: { rgb: 'FFFFFF' } }),
      alignment: { horizontal: money(ci) ? 'right' : 'left', vertical: 'center', wrapText: true, indent: 1 }, border };
    else if (isTotal) cell.s = { font: font({ bold: true }), fill: { fgColor: { rgb: BAND } }, border: { ...border, top: { style: 'medium', color: { rgb: NAVY } } },
      alignment: { horizontal: money(ci) ? 'right' : 'left', indent: 1 }, ...(money(ci) ? { numFmt: MONEY } : {}) };
    else {
      const zebra = (ri - top) % 2 === 1;
      const num = typeof v === 'number' || (v && typeof v === 'object' && v.t === 'n');
      cell.s = { font: font(ci === 0 ? { bold: true } : {}), border, alignment: { vertical: 'center', horizontal: money(ci) ? 'right' : 'left', indent: 1 },
        ...(zebra ? { fill: { fgColor: { rgb: ZEBRA } } } : {}), ...(money(ci) && num ? { numFmt: MONEY } : {}) };
      if (money(ci) && num) cell.z = MONEY;
    }
  }));
  if (groups) {
    const merges: any[] = []; let c = 0;
    for (const grp of groups) { if (grp.span > 1) merges.push({ s: { r: 0, c }, e: { r: 0, c: c + grp.span - 1 } }); c += grp.span; }
    ws['!merges'] = merges;
  }
  ws['!cols'] = headers.map((h, i) => ({ wch: widths?.[i] ?? Math.min(34, Math.max(money(i) ? 13 : 12, h.length + 2)) }));
  ws['!rows'] = [...(groups ? [{ hpt: 20 }] : []), { hpt: 30 }];
  ws['!autofilter'] = { ref: `A${top}:${colName(headers.length - 1)}${top + rows.length}` };
  return ws;
}

export function downloadWorkbook(X: any, sheets: [string, any][], filename: string) {
  const wb = X.utils.book_new();
  // Tab names: no apostrophes (the library doesn't escape them in filter ranges, which makes Excel
  // report the file as damaged) and none of Excel's forbidden characters; max 31 characters.
  for (const [name, ws] of sheets) X.utils.book_append_sheet(wb, ws, name.replace(/['’]/g, '').replace(/[\\/?*:\[\]]/g, '-').slice(0, 31));
  const out = X.write(wb, { type: 'array', bookType: 'xlsx' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  a.download = filename; a.click(); URL.revokeObjectURL(a.href);
}

'use client';
import { useState } from 'react';
import { useToast } from '@/components/Toast';
import { useAccess } from '@/components/AccessProvider';

interface Policy {
  id: string; category: string; ins_type: string; carrier: string; policy_number: string;
  broker: string; broker_contact: string; contact_info: string; effective_date: string;
  renews: string; annual_premium: string; notes: string; sort_order?: number;
}
interface FollowUp { id: string; kind: string; item: string; detail: string; sort_order?: number }

const POLICY_FIELDS: [keyof Policy, string][] = [
  ['ins_type', 'Insurance type'], ['carrier', 'Carrier'], ['policy_number', 'Policy number'],
  ['broker', 'Broker / agency'], ['broker_contact', 'Broker contact'], ['contact_info', 'Contact info'],
  ['effective_date', 'Effective date'], ['renews', 'Renews'], ['annual_premium', 'Annual premium'],
];

// Sum the numeric annual premiums (ignores TBD / N/A / "Varies"). Handles $, commas, ~, /yr.
function parseMoney(s: string): number {
  const m = String(s ?? '').replace(/,/g, '').match(/\$?\s*([\d]+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}
const fmtUSD = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Best-effort next renewal date from the free-text "Renews" field. Handles
// M/D/YYYY, M/D/YY and M/D (no year); rolls annual dates forward to the next
// occurrence. Returns null for "Active until cancelled" / "N/A" etc.
function nextRenewal(renews: string): Date | null {
  const s = String(renews ?? '');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    let yr = parseInt(m[3], 10); if (yr < 100) yr += 2000;
    let dt = new Date(yr, +m[1] - 1, +m[2]);
    let guard = 0;
    while (dt < today && /annual|yr|year/i.test(s) && guard++ < 10) dt = new Date(dt.getFullYear() + 1, dt.getMonth(), dt.getDate());
    return isNaN(+dt) ? null : dt;
  }
  m = s.match(/\b(\d{1,2})\/(\d{1,2})\b/);
  if (m) {
    let dt = new Date(today.getFullYear(), +m[1] - 1, +m[2]);
    if (dt < today) dt = new Date(today.getFullYear() + 1, +m[1] - 1, +m[2]);
    return isNaN(+dt) ? null : dt;
  }
  return null;
}
function daysUntil(dt: Date | null): number | null {
  if (!dt) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((dt.getTime() - today.getTime()) / 86400000);
}
const fmtDate = (dt: Date) => dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// Distinct, on-brand accent per category (bar = solid header, tint = light bg).
const CAT_PALETTE = [
  { bar: '#1b2a3d', tint: '#eef2f7', text: '#1b2a3d' }, // navy — Property/Liability/WC
  { bar: '#6e2b3e', tint: '#f6ecef', text: '#6e2b3e' }, // burgundy — Professional Liability
  { bar: '#2f5d3a', tint: '#eaf3ec', text: '#2f5d3a' }, // forest — Life
  { bar: '#34506e', tint: '#eaf0f6', text: '#34506e' }, // slate — Health & Welfare
  { bar: '#8a6d3b', tint: '#f6efe1', text: '#8a6d3b' }, // gold-brown — extra
];

export default function InsuranceClient({ initialPolicies, initialFollowups, categories }: { initialPolicies: Policy[]; initialFollowups: FollowUp[]; categories: string[] }) {
  const { showToast } = useToast();
  const { me } = useAccess();
  const readOnly = !!me?.restricted && !(me?.editSections ?? []).includes('/insurance');
  const [policies, setPolicies] = useState<Policy[]>(initialPolicies);
  const [followups, setFollowups] = useState<FollowUp[]>(initialFollowups);
  const [editing, setEditing] = useState<Policy | null>(null);
  const [isNew, setIsNew] = useState(false);

  const input = 'w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink';
  const catsPresent = categories.filter(c => policies.some(p => p.category === c)).concat(
    [...new Set(policies.map(p => p.category))].filter(c => !categories.includes(c)));
  const catColor = (cat: string) => CAT_PALETTE[Math.max(0, catsPresent.indexOf(cat)) % CAT_PALETTE.length];
  const openItems = followups.filter(f => f.kind !== 'excluded');
  const excluded = followups.filter(f => f.kind === 'excluded');
  const totalPremium = policies.reduce((s, p) => s + parseMoney(p.annual_premium), 0);
  // Upcoming renewals (≤60 days), soonest first — powers the banner + row badges.
  const upcoming = policies
    .map(p => ({ p, days: daysUntil(nextRenewal(p.renews)), date: nextRenewal(p.renews) }))
    .filter(x => x.days != null && x.days <= 60)
    .sort((a, b) => (a.days! - b.days!));

  // Branded PDF in the Litson palette (navy + gold), instead of printing the raw page.
  function printDoc() {
    const w = window.open('', '_blank'); if (!w) return;
    const e = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const cols = ['Insurance type', 'Carrier', 'Policy #', 'Broker', 'Contact', 'Effective', 'Renews', 'Annual premium', 'Notes'];
    const catBlocks = catsPresent.map(cat => {
      const c = catColor(cat);
      const rows = policies.filter(p => p.category === cat).map(p => `<tr>
        <td style="font-weight:600;color:#1b2a3d">${e(p.ins_type)}</td>
        <td>${e(p.carrier)}</td><td>${e(p.policy_number)}</td>
        <td>${e(p.broker)}${p.broker_contact ? `<div style="color:#8a7f6d">${e(p.broker_contact)}</div>` : ''}</td>
        <td style="color:#6a6456">${e(p.contact_info)}</td>
        <td>${e(p.effective_date)}</td><td>${e(p.renews)}</td>
        <td style="font-weight:600;white-space:nowrap">${e(p.annual_premium)}</td>
        <td style="color:#6a6456">${e(p.notes)}</td></tr>`).join('');
      return `<div style="break-inside:avoid;margin-top:16px">
        <div style="background:${c.bar};color:#fff;font-weight:700;font-size:9.5pt;letter-spacing:.04em;text-transform:uppercase;padding:6px 10px;border-radius:6px 6px 0 0">${e(cat)}</div>
        <table style="width:100%;border-collapse:collapse;font-size:8pt">
          <thead><tr style="background:${c.tint}">${cols.map(col => `<th style="text-align:left;padding:5px 7px;border:0.5pt solid #e6ddcd;color:${c.text};text-transform:uppercase;font-size:7pt;letter-spacing:.04em">${col}</th>`).join('')}</tr></thead>
          <tbody>${rows.replace(/<td>/g, '<td style="padding:5px 7px;border:0.5pt solid #e6ddcd;vertical-align:top;color:#333">').replace(/<td style="font-weight:600;color:#1b2a3d">/g, '<td style="padding:5px 7px;border:0.5pt solid #e6ddcd;vertical-align:top;font-weight:600;color:#1b2a3d">').replace(/<td style="font-weight:600;white-space:nowrap">/g, '<td style="padding:5px 7px;border:0.5pt solid #e6ddcd;vertical-align:top;font-weight:600;white-space:nowrap;color:#1b2a3d">').replace(/<td style="color:#6a6456">/g, '<td style="padding:5px 7px;border:0.5pt solid #e6ddcd;vertical-align:top;color:#6a6456">')}</tbody>
        </table></div>`;
    }).join('');
    const openHtml = openItems.length ? `<div style="break-inside:avoid;margin-top:20px"><div style="color:#1b2a3d;font-weight:700;font-size:10pt;border-bottom:2px solid #c9a24a;padding-bottom:3px;margin-bottom:6px">Open Items &amp; Things Left Off the Master List</div>${openItems.map(f => `<div style="margin:5px 0"><span style="font-weight:600;color:#1b2a3d">${e(f.item)}</span>${f.detail ? `<div style="color:#555;font-size:9pt">${e(f.detail)}</div>` : ''}</div>`).join('')}</div>` : '';
    const exclHtml = excluded.length ? `<div style="break-inside:avoid;margin-top:16px"><div style="color:#1b2a3d;font-weight:700;font-size:10pt;border-bottom:2px solid #c9a24a;padding-bottom:3px;margin-bottom:6px">Excluded from the Master List <span style="font-weight:400;color:#8a7f6d;font-size:8.5pt">(not Litson business insurance)</span></div>${excluded.map(f => `<div style="color:#555;font-size:9pt;margin:3px 0">• ${e(f.item)}</div>`).join('')}</div>` : '';
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Litson Insurance Master List</title>
<style>*{box-sizing:border-box;margin:0;padding:0}@page{size:letter landscape;margin:0.4in}
body{font-family:Georgia,'Times New Roman',serif;color:#1b2a3d;-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head><body>
<div style="background:#1b2a3d;border-top:3px solid #c9a24a;border-radius:10px;padding:14px 18px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:flex-end">
  <div><div style="font-size:15px;font-weight:700;letter-spacing:4px;color:#c9a24a">LITSON</div>
    <div style="font-size:7.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#9fb0c4;margin-top:2px">PLLC &middot; Human Resources</div>
    <div style="font-size:18px;font-weight:700;color:#fff;margin-top:8px">Insurance Master List</div></div>
  <div style="text-align:right;color:#9fb0c4;font-size:9px">${policies.length} policies · ${fmtUSD(totalPremium)} known annual premium<br>Generated ${e(new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))}</div>
</div>
${catBlocks}${openHtml}${exclHtml}
<script>var i=document.images,n=i.length,d=0;function go(){if(++d>=n)window.print()}if(!n){window.print()}else{for(var k=0;k<n;k++){i[k].complete?go():(i[k].onload=go,i[k].onerror=go)}}</script>
</body></html>`;
    w.document.write(html); w.document.close();
  }

  async function exportExcel() {
    const XLSX: any = await import('xlsx-js-style'); // styled fork (fills/fonts)
    const NAVY = '1B2A3D', GOLD = 'C9A24A', MUTED = '8A7F6D';
    const barHex = (cat: string) => ['1B2A3D', '6E2B3E', '2F5D3A', '34506E', '8A6D3B'][Math.max(0, catsPresent.indexOf(cat)) % 5];
    const header = ['Insurance Type', 'Carrier', 'Policy Number', 'Broker / Agency', 'Broker Contact', 'Contact Info', 'Effective Date', 'Renews', 'Annual Premium', 'Notes'];
    const NC = header.length;
    const cell = (v: any, s?: any) => ({ v: v ?? '', t: 's', s });
    const titleStyle = { fill: { fgColor: { rgb: NAVY } }, font: { color: { rgb: GOLD }, bold: true, sz: 15 }, alignment: { vertical: 'center' } };
    const subStyle = { font: { color: { rgb: MUTED }, italic: true, sz: 10 } };
    const headStyle = { fill: { fgColor: { rgb: NAVY } }, font: { color: { rgb: 'FFFFFF' }, bold: true, sz: 10 }, alignment: { wrapText: true, vertical: 'center' } };
    const catStyle = (hex: string) => ({ fill: { fgColor: { rgb: hex } }, font: { color: { rgb: 'FFFFFF' }, bold: true, sz: 11 } });
    const dataStyle = { alignment: { vertical: 'top', wrapText: true }, font: { sz: 10 } };

    const rows: any[][] = [];
    rows.push([cell('Litson PLLC — Insurance Master List', titleStyle), ...Array(NC - 1).fill(cell('', titleStyle))]);
    rows.push([cell(`Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} · ${policies.length} policies · ${fmtUSD(totalPremium)} known annual premium`, subStyle), ...Array(NC - 1).fill(cell('', subStyle))]);
    rows.push([]);
    rows.push(header.map(h => cell(h, headStyle)));
    const catRowIdx: number[] = [];
    for (const cat of catsPresent) {
      catRowIdx.push(rows.length);
      rows.push([cell(cat, catStyle(barHex(cat))), ...Array(NC - 1).fill(cell('', catStyle(barHex(cat))))]);
      for (const p of policies.filter(x => x.category === cat)) {
        rows.push([p.ins_type, p.carrier, p.policy_number, p.broker, p.broker_contact, p.contact_info, p.effective_date, p.renews, p.annual_premium, p.notes].map(v => cell(v, dataStyle)));
      }
    }
    const ws1 = XLSX.utils.aoa_to_sheet(rows);
    ws1['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 18 }, { wch: 22 }, { wch: 24 }, { wch: 26 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 46 }];
    ws1['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: NC - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: NC - 1 } },
      ...catRowIdx.map(r => ({ s: { r, c: 0 }, e: { r, c: NC - 1 } })),
    ];

    const f2: any[][] = [
      [cell('Open Items & Things Left Off the Master List', catStyle(NAVY)), cell('', catStyle(NAVY))],
      [cell('Item', headStyle), cell('Detail', headStyle)],
      ...openItems.map(f => [cell(f.item, { ...dataStyle, font: { bold: true, sz: 10 } }), cell(f.detail, dataStyle)]),
      [],
      [cell('Excluded from the master list (not Litson business insurance)', catStyle('8A6D3B')), cell('', catStyle('8A6D3B'))],
      ...excluded.map(f => [cell(f.item, dataStyle), cell('', dataStyle)]),
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(f2);
    ws2['!cols'] = [{ wch: 46 }, { wch: 80 }];
    ws2['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, 'Insurance Master List');
    XLSX.utils.book_append_sheet(wb, ws2, 'Follow-ups & Exclusions');
    const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'Litson_Insurance_Master_List.xlsx'; a.click(); URL.revokeObjectURL(a.href);
  }

  function startNew() { setEditing({ id: '', category: categories[0], ins_type: '', carrier: '', policy_number: '', broker: '', broker_contact: '', contact_info: '', effective_date: '', renews: '', annual_premium: '', notes: '' }); setIsNew(true); }
  function startEdit(p: Policy) { setEditing({ ...p }); setIsNew(false); }

  async function savePolicy() {
    if (!editing) return;
    if (isNew) {
      const res = await fetch('/api/insurance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) });
      const { row } = await res.json(); if (row) setPolicies(p => [...p, row]);
    } else {
      const res = await fetch('/api/insurance', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) });
      const { row } = await res.json(); if (row) setPolicies(p => p.map(x => x.id === row.id ? row : x));
    }
    setEditing(null); showToast('Saved');
  }
  async function deletePolicy(p: Policy) {
    if (!confirm(`Delete "${p.ins_type}"?`)) return;
    await fetch(`/api/insurance?id=${p.id}`, { method: 'DELETE' });
    setPolicies(prev => prev.filter(x => x.id !== p.id)); showToast('Deleted');
  }

  async function addFollowup(kind: string) {
    const res = await fetch('/api/insurance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'followup', kind, item: '', detail: '' }) });
    const { row } = await res.json(); if (row) setFollowups(f => [...f, row]);
  }
  function editFollowupLocal(id: string, patch: Partial<FollowUp>) { setFollowups(f => f.map(x => x.id === id ? { ...x, ...patch } : x)); }
  async function saveFollowup(f: FollowUp) {
    await fetch('/api/insurance', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'followup', id: f.id, item: f.item, detail: f.detail }) });
  }
  async function deleteFollowup(id: string) {
    await fetch(`/api/insurance?type=followup&id=${id}`, { method: 'DELETE' });
    setFollowups(prev => prev.filter(x => x.id !== id));
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="px-8 py-5 bg-white border-b border-border flex items-center justify-between gap-4 flex-shrink-0">
        <div>
          <h1 className="font-spectral text-[23px] font-semibold text-text-primary">Insurance</h1>
          <p className="text-sm text-text-muted mt-0.5">Litson PLLC insurance master list — policies, carriers, renewals &amp; open items.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportExcel} className="text-sm font-semibold text-ink border border-border-light px-4 py-2 rounded-ctrl hover:bg-canvas">⤓ Excel</button>
          <button onClick={printDoc} className="text-sm font-semibold text-ink border border-border-light px-4 py-2 rounded-ctrl hover:bg-canvas">⤓ Print / PDF</button>
          {!readOnly && (
            <button onClick={async () => { showToast('Sending test…'); try { const r = await fetch('/api/insurance/remind?test=1', { method: 'POST' }); const d = await r.json(); showToast(r.ok ? `✓ Test renewal email sent to ${d.to}` : (d.error || 'Could not send')); } catch { showToast('Could not send'); } }}
              title="Email a renewal-reminder preview to clarizz@litson.co now"
              className="text-sm font-semibold text-ink border border-border-light px-4 py-2 rounded-ctrl hover:bg-canvas">🔔 Test email</button>
          )}
          {!readOnly && <button onClick={startNew} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark">+ Add policy</button>}
        </div>
      </header>

      <div className="flex-1 overflow-auto px-8 py-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-2xl">
          {([['Policies on file', String(policies.length)], ['Known annual premium', fmtUSD(totalPremium)], ['Renewing ≤60 days', String(upcoming.length)], ['Open items', String(openItems.length)]] as [string, string][]).map(([l, v]) => (
            <div key={l} className="bg-white border border-border-light rounded-card px-4 py-3" style={{ borderTop: '3px solid #c9a24a' }}>
              <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">{l}</div>
              <div className="text-[20px] font-semibold text-text-primary">{v}</div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-text-faint -mt-3">Known annual premium sums only the policies with a numeric premium (TBD / N/A / roster-rated are excluded).</p>

        {/* Upcoming renewals banner */}
        {upcoming.length > 0 && (
          <div className="bg-[#fdf6e9] border border-[#e0c48a] rounded-card px-5 py-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#b07d2a] mb-2">⏰ Renewals coming up (next 60 days)</div>
            <div className="space-y-1">
              {upcoming.map(({ p, days, date }) => (
                <div key={p.id} className="flex items-center gap-2 text-sm flex-wrap">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${days! < 0 ? 'bg-[#fdeaea] text-[#b0412f]' : days! <= 30 ? 'bg-[#fdeaea] text-[#b0412f]' : 'bg-[#f7efe1] text-[#b07d2a]'}`}>
                    {days! < 0 ? `${Math.abs(days!)}d overdue` : days === 0 ? 'due today' : `in ${days}d`}
                  </span>
                  <span className="font-medium text-text-primary">{p.ins_type}</span>
                  <span className="text-text-muted">· {p.carrier}{date ? ` · renews ${fmtDate(date)}` : ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Policies grouped by category — each category gets a distinct accent */}
        {catsPresent.map(cat => {
          const c = catColor(cat);
          return (
          <div key={cat} className="bg-white border border-border rounded-card overflow-hidden" style={{ borderLeft: `4px solid ${c.bar}` }}>
            <div className="px-5 py-3" style={{ background: c.bar }}>
              <div className="text-[11px] font-bold uppercase tracking-wider text-white">{cat}</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1000px]">
                <thead style={{ background: c.tint }}>
                  <tr>{['Insurance type', 'Carrier', 'Policy #', 'Broker', 'Contact', 'Effective', 'Renews', 'Annual premium', 'Notes', ''].map(h => (
                    <th key={h} className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: c.text }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {policies.filter(p => p.category === cat).map((p, ri) => (
                    <tr key={p.id} className="border-t border-[#f1ece3] align-top" style={{ background: ri % 2 ? '#faf8f4' : '#fff' }}>
                      <td className="px-3 py-2.5 font-semibold min-w-[180px]" style={{ color: c.text, borderLeft: `3px solid ${c.bar}` }}>{p.ins_type}</td>
                      <td className="px-3 py-2.5 text-text-primary font-medium whitespace-nowrap">{p.carrier}</td>
                      <td className="px-3 py-2.5 text-text-secondary whitespace-nowrap font-mono text-[12px]">{p.policy_number}</td>
                      <td className="px-3 py-2.5 text-text-secondary min-w-[140px]">{p.broker}<div className="text-xs text-text-muted">{p.broker_contact}</div></td>
                      <td className="px-3 py-2.5 text-text-muted text-xs min-w-[160px]">{p.contact_info}</td>
                      <td className="px-3 py-2.5 text-text-secondary whitespace-nowrap">{p.effective_date}</td>
                      <td className="px-3 py-2.5 text-text-secondary whitespace-nowrap">
                        {p.renews}
                        {(() => { const d = daysUntil(nextRenewal(p.renews)); return d != null && d <= 60 ? (
                          <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${d <= 30 ? 'bg-[#fdeaea] text-[#b0412f]' : 'bg-[#f7efe1] text-[#b07d2a]'}`}>{d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? 'today' : `${d}d`}</span>
                        ) : null; })()}
                      </td>
                      <td className="px-3 py-2.5 font-bold whitespace-nowrap" style={{ color: c.text }}>{p.annual_premium}</td>
                      <td className="px-3 py-2.5 text-text-muted text-xs min-w-[240px] max-w-[320px]">{p.notes}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-right">
                        {!readOnly && (
                          <>
                            <button onClick={() => startEdit(p)} className="text-xs font-semibold text-ink border border-border-light px-2 py-1 rounded-ctrl hover:bg-canvas">Edit</button>
                            <button onClick={() => deletePolicy(p)} className="ml-1.5 text-xs font-semibold text-litred-alt border border-border-light px-2 py-1 rounded-ctrl hover:bg-[#fdeaea]">✕</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          );
        })}

        {/* Open items */}
        <div className="bg-white border border-border rounded-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between gap-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">Open items &amp; things left off the master list</div>
            {!readOnly && <button onClick={() => addFollowup('open')} className="text-xs font-semibold text-[#3f6b8a] hover:underline">+ Add item</button>}
          </div>
          <div className="divide-y divide-[#f1ece3]">
            {openItems.map(f => (
              <div key={f.id} className="px-5 py-3">
                {readOnly ? (
                  <><div className="font-semibold text-text-primary text-sm">{f.item}</div><div className="text-sm text-text-muted mt-0.5">{f.detail}</div></>
                ) : (
                  <div className="flex gap-2 items-start">
                    <div className="flex-1 space-y-1.5">
                      <input value={f.item} onChange={e => editFollowupLocal(f.id, { item: e.target.value })} onBlur={() => saveFollowup(f)} placeholder="Item" className={input + ' font-semibold'} />
                      <textarea value={f.detail} onChange={e => editFollowupLocal(f.id, { detail: e.target.value })} onBlur={() => saveFollowup(f)} rows={2} placeholder="Detail" className={input + ' resize-y'} />
                    </div>
                    <button onClick={() => deleteFollowup(f.id)} className="text-xs font-semibold text-litred-alt border border-border-light px-2 py-1 rounded-ctrl hover:bg-[#fdeaea] shrink-0">✕</button>
                  </div>
                )}
              </div>
            ))}
            {openItems.length === 0 && <div className="px-5 py-4 text-sm text-text-muted">No open items.</div>}
          </div>
        </div>

        {/* Excluded */}
        <div className="bg-white border border-border rounded-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between gap-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">Excluded from the master list <span className="font-normal normal-case text-text-faint">(not Litson business insurance)</span></div>
            {!readOnly && <button onClick={() => addFollowup('excluded')} className="text-xs font-semibold text-[#3f6b8a] hover:underline">+ Add</button>}
          </div>
          <div className="divide-y divide-[#f1ece3]">
            {excluded.map(f => (
              <div key={f.id} className="px-5 py-2.5 flex gap-2 items-center">
                {readOnly ? <span className="text-sm text-text-muted">• {f.item}</span> : (
                  <>
                    <span className="text-text-faint">•</span>
                    <input value={f.item} onChange={e => editFollowupLocal(f.id, { item: e.target.value })} onBlur={() => saveFollowup(f)} className={input} />
                    <button onClick={() => deleteFollowup(f.id)} className="text-xs font-semibold text-litred-alt border border-border-light px-2 py-1 rounded-ctrl hover:bg-[#fdeaea] shrink-0">✕</button>
                  </>
                )}
              </div>
            ))}
            {excluded.length === 0 && <div className="px-5 py-4 text-sm text-text-muted">Nothing excluded.</div>}
          </div>
        </div>
      </div>

      {/* Edit / add policy modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-6 overflow-auto" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-card w-full max-w-2xl my-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="font-spectral text-[18px] font-semibold text-text-primary">{isNew ? 'Add policy' : 'Edit policy'}</h2>
              <button onClick={() => setEditing(null)} className="text-text-muted hover:text-text-primary text-xl leading-none">×</button>
            </div>
            <div className="px-6 py-5 grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-text-secondary mb-1">Category</label>
                <input list="ins-cats" value={editing.category} onChange={e => setEditing({ ...editing, category: e.target.value })} className={input} />
                <datalist id="ins-cats">{categories.map(c => <option key={c} value={c} />)}</datalist>
              </div>
              {POLICY_FIELDS.map(([k, label]) => (
                <div key={k} className={k === 'ins_type' ? 'col-span-2' : ''}>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">{label}</label>
                  <input value={(editing as any)[k] ?? ''} onChange={e => setEditing({ ...editing, [k]: e.target.value })} className={input} />
                </div>
              ))}
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-text-secondary mb-1">Notes</label>
                <textarea value={editing.notes} onChange={e => setEditing({ ...editing, notes: e.target.value })} rows={3} className={input + ' resize-y'} />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="text-sm font-semibold text-text-muted px-4 py-2">Cancel</button>
              <button onClick={savePolicy} className="bg-ink text-white text-sm font-semibold px-4 py-2 rounded-ctrl hover:bg-ink-dark">{isNew ? 'Add policy' : 'Save changes'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

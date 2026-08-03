'use client';
import { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';
import { useToast } from '@/components/Toast';
import EditGate from '@/components/EditGate';
import { ALEX_SIGNATURE } from '@/lib/signature';

type EmpType = 'contractor' | 'employee';

interface Form {
  name: string; email: string; role: string; dept: string;
  salary: string; startDate: string; location: string; notes: string;
}

const EMPTY: Form = { name: '', email: '', role: '', dept: '', salary: '', startDate: '', location: '', notes: '' };

type LetterKind = 'offer' | 'declination' | 'general' | 'certificate';

// Declination letter — a fixed template on Litson letterhead with fillable
// fields (no AI). Mirrors the firm's sample declination-of-representation letter.
interface DecForm {
  date: string; name: string; email: string; salutation: string;
  re: string; body: string; signer: string;
}
const DEC_DEFAULT_BODY = 'Thank you for your interest in Litson PLLC representing you in connection with your case. As you know, we have not signed an engagement letter and have not created an attorney-client relationship. We will not be able to take your case at this time but wish you the best.';
const DEC_EMPTY: DecForm = {
  date: '', name: '', email: '', salutation: '',
  re: 'Declination of Representation', body: DEC_DEFAULT_BODY, signer: 'J. Alex Little',
};
function fmtLongDate(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

// Escape HTML, then apply lightweight inline markdown so users can bold/italic
// parts of a letter: **bold**, *italic* (or __bold__ / _italic_). Bold is
// resolved before italic so the double markers win. Used for both the live
// preview and the print/PDF output so they always match.
function escHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function inlineMd(escaped: string) {
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/(^|[^a-zA-Z0-9])_(.+?)_(?![a-zA-Z0-9])/g, '$1<em>$2</em>');
}
function fmtInline(raw: string) { return inlineMd(escHtml(raw)); }

// General letter — a fully fillable letter on Litson letterhead (no AI) for
// anything that isn't an offer or declination: financial sponsorship, proof of
// employment, reference letters, etc. Addressee, Re:, a free-text body, signer
// and an optional cc block.
interface GenForm {
  date: string; addressee: string; re: string; greeting: string;
  body: string; signer: string; signerTitle: string; cc: string; withSig: boolean;
}
const GEN_EMPTY: GenForm = {
  date: '', addressee: 'To Whom It May Concern:', re: '', greeting: '',
  body: '', signer: 'Alex Little', signerTitle: 'Founding & Managing Partner', cc: '', withSig: true,
};

// Certificate of Employment — modeled on the firm's sample (Paula Laborne
// Valle). Structured fields compose the body; the body stays fully editable.
interface CertForm {
  date: string; name: string; email: string; shortName: string; pronoun: string;
  role: string; engagement: string; startDate: string; hours: string;
  duties: string; purpose: string; signer: string; signerTitle: string; body: string;
}
const CERT_DEFAULT_DUTIES = [
  'Client Intake – Conducting initial client intake processes, gathering necessary information, and ensuring accurate and timely entry of client data into firm systems.',
  'Document Organization and Management – Organizing, maintaining, and managing legal files, correspondence, and case documentation in accordance with firm protocols.',
  'Legal Research – Conducting thorough legal research to support attorneys in case preparation, including reviewing statutes, regulations, and case law relevant to ongoing matters.',
  'Drafting Legal Documents – Assisting attorneys in the preparation and drafting of legal documents, pleadings, correspondence, and other materials as required.',
  'Court Communications and Confirmations – Assisting with court-related communications and confirmations as needed, including liaising with court personnel and tracking case scheduling deadlines.',
].join('\n');
const CERT_EMPTY: CertForm = {
  date: '', name: '', email: '', shortName: '', pronoun: 'their',
  role: 'Paralegal', engagement: 'an independent contractor',
  startDate: '', hours: '8:00 AM to 5:30 PM Central Time (CT)',
  duties: CERT_DEFAULT_DUTIES,
  purpose: 'submission to their academic institution and for no other purpose',
  signer: 'Alex Little', signerTitle: 'Founding & Managing Partner', body: '',
};
// Compose the certificate body from the fields (bold name + duty titles).
function composeCert(f: CertForm): string {
  const who = f.shortName.trim() || f.name.trim() || 'the employee';
  const pron = f.pronoun.trim() || 'their';
  const out: string[] = [];
  out.push(`This letter is to certify that **${f.name || '[Name]'}** is currently engaged as ${f.engagement} at Litson PLLC as **${f.role}** since **${f.startDate || '[start date]'}**, with scheduled working hours from ${f.hours}.`);
  out.push('');
  out.push(`In ${pron} role as **${f.role}**, ${who}'s principal duties and responsibilities include, but are not limited to, the following:`);
  out.push('');
  f.duties.split('\n').map(l => l.trim()).filter(Boolean).forEach(d => {
    const i = d.indexOf(' – ') >= 0 ? d.indexOf(' – ') : d.indexOf(' - ');
    out.push('• ' + (i > 0 ? `**${d.slice(0, i)}**${d.slice(i)}` : d));
  });
  out.push('');
  out.push(`This certification is issued upon the request of ${who} for ${f.purpose}. Should you require any additional information or have questions regarding the contents of this letter, please do not hesitate to contact our Human Resources Department.`);
  return out.join('\n');
}

const LOGO_B64 = 'data:image/png;base64,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AABIRXkCAAAgFeUJAACAVJQnAAAAUlGeAAAASEV5AgAAIBXlCQAAgFSUJwAAAFJRngAAAEhFeQIAACAV5QkAAIBUlCcAAABSUZ4AAABIRXkCAAAgFeUJAACAVJQnAAAAUlGeAAAASEV5AgAAIBXlCQAAgFSUJwAAAFJRngAAAEhFeQIAACAV5QkAAIBUlCcAAABSUZ4AAABIRXkCAAAgFeUJAACAVJQnAAAAUlGeAAAASEV5AgAAIBXlCQAAgFSUJwAAAFJRngAAAEhFeQIAACAV5QkAAIBUlCcAAABSUZ4AAABIRXkCAAAgFeUJAACAVJQnAAAAUlGeAAAASEV5AgAAIBXlCQAAgFSUJwAAAFJRngAAAEhFeQIAACAV5QkAAIBUlCcAAABSUZ4AAABIRXkCAAAgFeUJAACAVJQnAAAAUlGeAAAASEV5AgAAIBXlCQAAgFSUJwAAAFJRngAAAEhFeQIAACAV5QkAAIBUlCcAAABSUZ4AAABIRXkCAAAgFeUJAACAVJQnAAAAUlGeAAAASEV5AgAAIBXlCQAAgFSUJwAAAFJRngAAAEhFeQIAACAV5QkAAIBUlCcAAABSUZ4AAABIRXkCAAAgFeUJAACAVJQnAAAAUlGeAAAASEV5AgAAIBXlCQAAgFSUJwAAAFJRngAAAEhFeQIAACAV5QkAAIBUlCcAAABSUZ4AAABIRXkCAAAgFeUJAACAVJQnAAAAUlGeAAAASEV5AgAAIBXlCQAAgFSUJwAAAFJRngAAAEhFeQIAACAV5QkAAIBUlCcAAABSUZ4AAABIRXkCAAAgFeUJAACAVJQnAAAAUlGeAAAASEV5AgAAIBXlCQAAgFSUJwAAAFJRngAAAEhFeQIAACAV5QkAAIBUlCcAAABSUZ4AAABIRXkCAAAgFeUJAACAVJQnAAAAUlGeAAAASEV5AgAAIBXlCQAAgFSUJwAAAFJRngAAAEhFeQIAACAV5QkAAIBUlCcAAABSUZ4AAABIRXkCAAAgFeUJAACAVJQnAAAAUv8PDLgy32PsBbgAAAAASUVORK5CYII=';
const SIG_B64 = ALEX_SIGNATURE;
const BODY_FONT = '"Century Schoolbook","Century","Book Antiqua",Georgia,serif';

export default function OffersClient() {
  const { showToast } = useToast();
  const [letterKind, setLetterKind] = useState<LetterKind>('offer');
  const [empType, setEmpType] = useState<EmpType>('contractor');
  const [rateBasis, setRateBasis] = useState<'monthly' | 'hourly'>('monthly');
  const [payBasis, setPayBasis] = useState<'monthly' | 'weekly' | 'biweekly'>('monthly');
  const [compBasis, setCompBasis] = useState<'annual' | 'monthly' | 'hourly'>('annual');  // W-2 employee
  const [salTitle, setSalTitle] = useState('');
  const [form, setForm] = useState<Form>(EMPTY);
  const [draft, setDraft] = useState('');
  const [generating, setGenerating] = useState(false);
  const [dec, setDec] = useState<DecForm>(() => ({ ...DEC_EMPTY, date: fmtLongDate(new Date()) }));
  const [gen, setGen] = useState<GenForm>(() => ({ ...GEN_EMPTY, date: fmtLongDate(new Date()) }));
  const [cert, setCert] = useState<CertForm>(() => ({ ...CERT_EMPTY, date: fmtLongDate(new Date()) }));

  function set(k: keyof Form, v: string) { setForm(p => ({ ...p, [k]: v })); }
  function setD(k: keyof DecForm, v: string) { setDec(p => ({ ...p, [k]: v })); }
  function setG<K extends keyof GenForm>(k: K, v: GenForm[K]) { setGen(p => ({ ...p, [k]: v })); }
  function setC<K extends keyof CertForm>(k: K, v: CertForm[K]) { setCert(p => ({ ...p, [k]: v })); }
  // The certificate body: the user's edited text, or the live-composed text.
  const certBody = cert.body.trim() ? cert.body : composeCert(cert);

  // Saved certificate templates (per browser).
  const [certTemplates, setCertTemplates] = useState<Record<string, CertForm>>({});
  const [certTplName, setCertTplName] = useState('');
  useEffect(() => {
    try {
      const raw = localStorage.getItem('litson_cert_templates');
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, CertForm>;
      let changed = false;
      for (const k of Object.keys(parsed)) {
        if (parsed[k]?.signerTitle === 'Managing Member') { parsed[k] = { ...parsed[k], signerTitle: 'Founding & Managing Partner' }; changed = true; }
      }
      setCertTemplates(parsed);
      if (changed) localStorage.setItem('litson_cert_templates', JSON.stringify(parsed));
    } catch { /* ignore */ }
  }, []);
  function persistCertTemplates(next: Record<string, CertForm>) {
    setCertTemplates(next);
    try { localStorage.setItem('litson_cert_templates', JSON.stringify(next)); } catch { /* ignore */ }
  }
  function saveCertTemplate() {
    const suggested = certTplName || (cert.role ? `${cert.role} certificate` : '');
    const name = (window.prompt('Save this letter as a template named:', suggested) || '').trim();
    if (!name) return;
    persistCertTemplates({ ...certTemplates, [name]: { ...cert, body: certBody } });
    setCertTplName(name);
    showToast('Template saved');
  }
  function loadCertTemplate(name: string) {
    const t = certTemplates[name];
    if (!t) { setCertTplName(''); return; }
    setCert({ ...t });
    setCertTplName(name);
    showToast(`Loaded “${name}”`);
  }
  function deleteCertTemplate() {
    if (!certTplName || !certTemplates[certTplName]) return;
    if (!window.confirm(`Delete the template “${certTplName}”?`)) return;
    const next = { ...certTemplates }; delete next[certTplName];
    persistCertTemplates(next); setCertTplName('');
    showToast('Template deleted');
  }

  // Saved General-letter templates (per browser).
  const [genTemplates, setGenTemplates] = useState<Record<string, GenForm>>({});
  const [genTplName, setGenTplName] = useState('');
  useEffect(() => {
    try {
      const raw = localStorage.getItem('litson_gen_templates');
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, GenForm>;
      let changed = false;
      for (const k of Object.keys(parsed)) {
        if (parsed[k]?.signerTitle === 'Managing Member') { parsed[k] = { ...parsed[k], signerTitle: 'Founding & Managing Partner' }; changed = true; }
      }
      setGenTemplates(parsed);
      if (changed) localStorage.setItem('litson_gen_templates', JSON.stringify(parsed));
    } catch { /* ignore */ }
  }, []);
  function persistGenTemplates(next: Record<string, GenForm>) {
    setGenTemplates(next);
    try { localStorage.setItem('litson_gen_templates', JSON.stringify(next)); } catch { /* ignore */ }
  }
  function saveGenTemplate() {
    const suggested = genTplName || (gen.re ? gen.re.slice(0, 40) : '');
    const name = (window.prompt('Save this letter as a template named:', suggested) || '').trim();
    if (!name) return;
    persistGenTemplates({ ...genTemplates, [name]: { ...gen } });
    setGenTplName(name);
    showToast('Template saved');
  }
  function loadGenTemplate(name: string) {
    const t = genTemplates[name];
    if (!t) { setGenTplName(''); return; }
    setGen({ ...t });
    setGenTplName(name);
    showToast(`Loaded “${name}”`);
  }
  function deleteGenTemplate() {
    if (!genTplName || !genTemplates[genTplName]) return;
    if (!window.confirm(`Delete the template “${genTplName}”?`)) return;
    const next = { ...genTemplates }; delete next[genTplName];
    persistGenTemplates(next); setGenTplName('');
    showToast('Template deleted');
  }

  const bodyRef = useRef<HTMLTextAreaElement>(null);
  // Toolbar for the General letter body: wrap the current selection in bold/
  // italic markers, or prefix the selected line(s) with a bullet.
  function applyFmt(kind: 'bold' | 'italic' | 'bullet') {
    const ta = bodyRef.current;
    if (!ta) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    const val = gen.body;
    let next: string, caret: number;
    if (kind === 'bullet') {
      const lineStart = val.lastIndexOf('\n', start - 1) + 1;
      const block = val.slice(lineStart, Math.max(end, start));
      const bulleted = (block || '').split('\n').map(l => /^\s*[•\-]\s/.test(l) ? l : '• ' + l).join('\n');
      next = val.slice(0, lineStart) + bulleted + val.slice(Math.max(end, start));
      caret = lineStart + bulleted.length;
    } else {
      const mark = kind === 'bold' ? '**' : '*';
      const sel = val.slice(start, end) || (kind === 'bold' ? 'bold text' : 'italic text');
      next = val.slice(0, start) + mark + sel + mark + val.slice(end);
      caret = start + mark.length + sel.length + mark.length;
    }
    setG('body', next);
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(caret, caret); });
  }

  // Toolbar for the generated offer-letter draft — wrap the selection in
  // **bold** / *italic* so you can emphasize the salary, rate, dates, etc.
  const offerRef = useRef<HTMLTextAreaElement>(null);
  function applyOfferFmt(kind: 'bold' | 'italic') {
    const ta = offerRef.current;
    if (!ta) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    const mark = kind === 'bold' ? '**' : '*';
    const sel = draft.slice(start, end) || (kind === 'bold' ? 'bold text' : 'italic text');
    const next = draft.slice(0, start) + mark + sel + mark + draft.slice(end);
    setDraft(next);
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(start + mark.length, start + mark.length + sel.length); });
  }

  const certBodyRef = useRef<HTMLTextAreaElement>(null);
  // Same toolbar for the Certificate wording box. Operates on the shown text
  // (certBody), materializing the composed default into cert.body on first use.
  function applyCertFmt(kind: 'bold' | 'italic' | 'bullet') {
    const ta = certBodyRef.current;
    if (!ta) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    const val = certBody;
    let next: string, caret: number;
    if (kind === 'bullet') {
      const lineStart = val.lastIndexOf('\n', start - 1) + 1;
      const block = val.slice(lineStart, Math.max(end, start));
      const bulleted = (block || '').split('\n').map(l => /^\s*[•\-]\s/.test(l) ? l : '• ' + l).join('\n');
      next = val.slice(0, lineStart) + bulleted + val.slice(Math.max(end, start));
      caret = lineStart + bulleted.length;
    } else {
      const mark = kind === 'bold' ? '**' : '*';
      const sel = val.slice(start, end) || (kind === 'bold' ? 'bold text' : 'italic text');
      next = val.slice(0, start) + mark + sel + mark + val.slice(end);
      caret = start + mark.length + sel.length + mark.length;
    }
    setC('body', next);
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(caret, caret); });
  }

  async function generate() {
    setGenerating(true);
    try {
      const res = await fetch('/api/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'offer',
          employeeType: empType,
          name: form.name,
          email: form.email,
          role: form.role,
          dept: form.dept,
          salary: form.salary,
          startDate: form.startDate,
          location: form.location,
          notes: form.notes,
          rateBasis: empType === 'contractor' ? rateBasis : 'monthly',
          payBasis: empType === 'contractor' ? payBasis : 'monthly',
          compBasis: empType === 'employee' ? compBasis : 'annual',
          salutationTitle: salTitle,
        }),
      });
      const data = await res.json();
      setDraft(data.text ?? data.draft ?? '');
    } catch { showToast('Generation failed'); }
    setGenerating(false);
  }

  function printPdf() {
    const win = window.open('', '_blank');
    if (!win) return;

    function esc(s: string) {
      return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    // Bold the position, salary and start date wherever they appear in the body.
    const salFmt = form.salary ? `$${Number(form.salary).toLocaleString('en-US')}` : '';
    const startFmt = form.startDate
      ? new Date(form.startDate + 'T12:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : '';
    const boldPhrases = [form.role, salFmt, startFmt].map(p => (p ?? '').trim()).filter(Boolean);
    function boldize(escaped: string) {
      let out = escaped;
      for (const p of boldPhrases) {
        const e = esc(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        out = out.replace(new RegExp(e, 'g'), m => `<strong>${m}</strong>`);
      }
      return out;
    }
    // Honor manual **bold** / *italic* markers typed or added via the toolbar.
    function inlineMd(escaped: string) {
      return escaped
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[^*])\*(?!\s)([^*]+?)\*(?!\*)/g, '$1<em>$2</em>');
    }

    const draftClean = draft.replace(/\n{3,}/g, '\n\n');
    const linesArr = draftClean.split('\n');

    // Detect structural markers
    const ccBlockStart = linesArr.findIndex(l => /^\[CC_BLOCK\]/.test(l));
    const ccBlockEnd = linesArr.findIndex(l => /^\[\/CC_BLOCK\]/.test(l));
    const closingIdx = linesArr.findIndex(l => /^very truly yours/i.test(l.trim()));

    // Separate cc block (contractor) from rest
    let ccLines: string[] = [];
    let bodyEnd = closingIdx >= 0 ? closingIdx : linesArr.length;
    if (ccBlockStart >= 0 && ccBlockEnd >= 0) {
      ccLines = linesArr.slice(ccBlockStart + 1, ccBlockEnd).filter(l => !l.startsWith('['));
      bodyEnd = ccBlockStart;
    }

    // Build body HTML
    let bodyHtml = '';
    for (let i = 0; i < bodyEnd; i++) {
      const l = linesArr[i];
      if (l.startsWith('[DATE_CENTERED]')) {
        bodyHtml += `<div style="text-align:center;margin-bottom:11pt">${esc(l.replace('[DATE_CENTERED]',''))}</div>`;
      } else if (/^Via Email$/i.test(l.trim())) {
        bodyHtml += `<div style="text-decoration:underline;font-weight:bold;margin-bottom:6pt">${esc(l)}</div>`;
      } else if (/^\s*Re:\s+/i.test(l)) {
        bodyHtml += `<div style="margin-left:2.5em;margin-bottom:6pt"><span style="font-weight:bold">Re:</span><span style="margin-left:2em;font-weight:bold">${esc(l.replace(/^\s*Re:\s+/i,''))}</span></div>`;
      } else if (l.trim() === '') {
        bodyHtml += `<div style="height:6pt"></div>`;
      } else {
        bodyHtml += `<div style="text-align:justify;margin-bottom:0">${inlineMd(boldize(esc(l)))}</div>`;
      }
    }

    // Closing block (right side) — Alex signs; Zack & Catie appear in the cc block.
    const sigInner = `<div>Very truly yours,</div>`
      + `<div style="height:5pt"></div>`
      + `<div><img src="${SIG_B64}" width="148" height="49" style="display:block;margin-bottom:1pt" alt=""/></div>`
      + `<div>Alex Little</div>`
      + `<div>Founding &amp; Managing Partner</div>`;
    const closingHtml = `<div style="display:flex;justify-content:flex-end;margin-top:12pt"><div style="text-align:left">${sigInner}</div></div>`;

    // cc block (left side, below closing)
    const ccHtml = ccLines.length
      ? `<div style="margin-top:2pt">${ccLines.map(l => `<div style="min-height:1em">${esc(l) || '&nbsp;'}</div>`).join('')}</div>`
      : '';

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Offer Letter – ${esc(form.name)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  @page{size:letter;margin:0.65in 0.8in 0.55in}
  body{font-family:${BODY_FONT};color:#1a1a2e;font-size:11pt;line-height:1.4;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  img{-webkit-print-color-adjust:exact;print-color-adjust:exact}
</style></head><body>
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18pt">
  <img src="${LOGO_B64}" width="175" height="58" alt="Litson"/>
  <div style="text-align:right;font-size:8.5pt;color:#333;line-height:1.65;font-family:Arial,sans-serif;margin-top:2pt">
    J. Alex Little<br>615.985.8189<br>alex@litson.co
  </div>
</div>
${bodyHtml}
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-top:8pt">
  <div style="max-width:55%">${ccHtml}</div>
  ${closingHtml ? closingHtml.replace('display:flex;justify-content:flex-end;margin-top:12pt','display:flex;justify-content:flex-end') : ''}
</div>
<div style="margin-top:16pt;padding-top:5pt;border-top:0.5pt solid #aaa;font-family:Arial,sans-serif;font-size:8pt;color:#888">
  Litson PLLC<br>54 Music Square E Ste 300, Nashville, TN 37203<br>(615) 985-8205<br>www.litson.co
</div>
<script>
  var imgs=document.images,n=imgs.length,done=0;
  function go(){done++;if(done>=n)window.print();}
  if(!n){window.print();}else{for(var i=0;i<n;i++){if(imgs[i].complete)go();else{imgs[i].onload=go;imgs[i].onerror=go;}}}
</script>
</body></html>`;
    win.document.write(html);
    win.document.close();
  }

  function downloadTxt() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([draft], { type: 'text/plain' }));
    a.download = `offer-${form.name.replace(/\s+/g, '-') || 'letter'}.txt`;
    a.click();
  }

  function printDeclination() {
    const win = window.open('', '_blank');
    if (!win) return;
    const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const salutation = dec.salutation.trim() || dec.name.trim();
    const bodyHtml = dec.body.split('\n').map(l =>
      l.trim() === ''
        ? `<div style="height:11pt"></div>`
        : `<div style="text-align:justify;text-indent:0.5in;margin-bottom:0">${esc(l)}</div>`
    ).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Declination Letter${dec.name ? ' – ' + esc(dec.name) : ''}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  @page{size:letter;margin:0.65in 0.8in 0.55in}
  body{font-family:${BODY_FONT};color:#1a1a2e;font-size:11pt;line-height:1.4;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  img{-webkit-print-color-adjust:exact;print-color-adjust:exact}
</style></head><body>
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18pt">
  <img src="${LOGO_B64}" width="175" height="58" alt="Litson"/>
  <div style="text-align:right;font-size:8.5pt;color:#333;line-height:1.65;font-family:Arial,sans-serif;margin-top:2pt">
    J. Alex Little<br>615.985.8189<br>alex@litson.co
  </div>
</div>
${dec.date ? `<div style="text-align:center;margin-bottom:22pt">${esc(dec.date)}</div>` : ''}
${dec.name ? `<div>${esc(dec.name)}</div>` : ''}
${dec.email ? `<div>${esc(dec.email)}</div>` : ''}
<div style="height:22pt"></div>
${dec.re ? `<div style="margin-left:0.5in;margin-bottom:16pt"><span style="font-weight:bold">Re:</span><span style="margin-left:1.5em;font-weight:bold">${esc(dec.re)}</span></div>` : ''}
<div style="margin-bottom:11pt">Dear ${esc(salutation)},</div>
${bodyHtml}
<div style="height:28pt"></div>
<div style="margin-left:3.4in">
  <div>Sincerely,</div>
  <div><img src="${SIG_B64}" width="148" height="49" style="display:block;margin:2pt 0" alt=""/></div>
  <div style="margin-top:10pt">${esc(dec.signer)}</div>
</div>
<div style="margin-top:16pt;padding-top:5pt;border-top:0.5pt solid #aaa;font-family:Arial,sans-serif;font-size:8pt;color:#888">
  Litson PLLC<br>54 Music Square E Ste 300, Nashville, TN 37203<br>(615) 985-8205<br>www.litson.co
</div>
<script>
  var imgs=document.images,n=imgs.length,done=0;
  function go(){done++;if(done>=n)window.print();}
  if(!n){window.print();}else{for(var i=0;i<n;i++){if(imgs[i].complete)go();else{imgs[i].onload=go;imgs[i].onerror=go;}}}
</script>
</body></html>`;
    win.document.write(html);
    win.document.close();
  }

  function printGeneral() {
    const win = window.open('', '_blank');
    if (!win) return;
    const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    // Body: blank line = paragraph gap; lines starting with • or - become
    // bullet rows; **bold** / *italic* are honored inline; everything else is a
    // justified paragraph.
    const bodyHtml = gen.body.split('\n').map(l => {
      const t = l.trim();
      if (t === '') return `<div style="height:11pt"></div>`;
      if (/^[•\-]\s*/.test(t)) {
        return `<div style="margin-left:1.5em;text-indent:-1em;margin-bottom:2pt">&bull;&nbsp;${fmtInline(t.replace(/^[•\-]\s*/, ''))}</div>`;
      }
      return `<div style="text-align:justify;margin-bottom:0">${fmtInline(l)}</div>`;
    }).join('');

    const ccLines = gen.cc.split('\n').map(l => l.trim()).filter(Boolean);
    const ccHtml = ccLines.length
      ? `<div style="margin-top:20pt"><span style="font-weight:bold">cc:</span>&nbsp;&nbsp;${ccLines.map(esc).join('<br>')}</div>`
      : '';

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Letter${gen.re ? ' – ' + esc(gen.re) : ''}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  @page{size:letter;margin:0.65in 0.8in 0.55in}
  body{font-family:${BODY_FONT};color:#1a1a2e;font-size:11pt;line-height:1.4;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  img{-webkit-print-color-adjust:exact;print-color-adjust:exact}
</style></head><body>
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18pt">
  <img src="${LOGO_B64}" width="175" height="58" alt="Litson"/>
  <div style="text-align:right;font-size:8.5pt;color:#333;line-height:1.65;font-family:Arial,sans-serif;margin-top:2pt">
    J. Alex Little<br>615.985.8189<br>alex@litson.co
  </div>
</div>
${gen.date ? `<div style="margin-bottom:16pt">${esc(gen.date)}</div>` : ''}
${gen.addressee ? `<div style="margin-bottom:16pt;font-weight:bold">${esc(gen.addressee)}</div>` : ''}
${gen.re ? `<div style="margin-bottom:14pt"><span style="font-weight:bold">RE:</span><span style="margin-left:1em;font-weight:bold">${esc(gen.re)}</span></div>` : ''}
${gen.greeting.trim() ? `<div style="margin-bottom:11pt">${esc(gen.greeting)}</div>` : ''}
${bodyHtml}
<div style="height:22pt"></div>
<div style="display:flex;justify-content:flex-end">
  <div style="text-align:left">
    <div>Very truly yours,</div>
    ${gen.withSig ? `<div><img src="${SIG_B64}" width="148" height="49" style="display:block;margin:3pt 0 1pt" alt=""/></div>` : `<div style="height:24pt"></div>`}
    <div>${esc(gen.signer)}</div>
    ${gen.signerTitle ? `<div>${esc(gen.signerTitle)}</div>` : ''}
  </div>
</div>
${ccHtml}
<div style="margin-top:16pt;padding-top:5pt;border-top:0.5pt solid #aaa;font-family:Arial,sans-serif;font-size:8pt;color:#888">
  Litson PLLC<br>54 Music Square E Ste 300, Nashville, TN 37203<br>(615) 985-8205<br>www.litson.co
</div>
<script>
  var imgs=document.images,n=imgs.length,done=0;
  function go(){done++;if(done>=n)window.print();}
  if(!n){window.print();}else{for(var i=0;i<n;i++){if(imgs[i].complete)go();else{imgs[i].onload=go;imgs[i].onerror=go;}}}
</script>
</body></html>`;
    win.document.write(html);
    win.document.close();
  }

  function printCertificate() {
    const win = window.open('', '_blank');
    if (!win) return;
    const esc = (s: string) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const bodyHtml = certBody.split('\n').map(l => {
      const t = l.trim();
      if (t === '') return `<div style="height:11pt"></div>`;
      if (/^[•\-]\s*/.test(t)) {
        return `<div style="margin-left:2.2em;text-indent:-1.1em;margin-bottom:4pt">&bull;&nbsp;&nbsp;${fmtInline(t.replace(/^[•\-]\s*/, ''))}</div>`;
      }
      return `<div style="text-align:justify;text-indent:0.5in;margin-bottom:0">${fmtInline(l)}</div>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Certificate of Employment${cert.name ? ' – ' + esc(cert.name) : ''}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  @page{size:letter;margin:0.65in 0.8in 0.55in}
  body{font-family:${BODY_FONT};color:#1a1a2e;font-size:11pt;line-height:1.45;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  img{-webkit-print-color-adjust:exact;print-color-adjust:exact}
</style></head><body>
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20pt">
  <img src="${LOGO_B64}" width="175" height="58" alt="Litson"/>
  <div style="text-align:right;font-size:8.5pt;color:#333;line-height:1.65;font-family:Arial,sans-serif;margin-top:2pt">
    J. Alex Little<br>615.985.8189<br>alex@litson.co
  </div>
</div>
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14pt">
  <div style="text-decoration:underline;font-weight:bold">Via Email</div>
  <div>${esc(cert.date)}</div>
</div>
${cert.name ? `<div style="font-weight:bold">${esc(cert.name)}</div>` : ''}
${cert.email ? `<div style="color:#2f5fa0">${esc(cert.email)}</div>` : ''}
<div style="margin:14pt 0;margin-left:0.5in"><span style="font-weight:bold">Re:</span><span style="margin-left:1.5em;font-weight:bold">Certificate of Employment${cert.name ? ' – ' + esc(cert.name) : ''}</span></div>
<div style="margin-bottom:11pt">To whom it may concern,</div>
${bodyHtml}
<div style="height:20pt"></div>
<div style="display:flex;justify-content:flex-end">
  <div style="text-align:left">
    <div>Very truly yours,</div>
    <div><img src="${SIG_B64}" width="148" height="49" style="display:block;margin:3pt 0 1pt" alt=""/></div>
    <div>${esc(cert.signer)}</div>
    ${cert.signerTitle ? `<div>${esc(cert.signerTitle)}</div>` : ''}
  </div>
</div>
<div style="margin-top:16pt;padding-top:5pt;border-top:0.5pt solid #aaa;font-family:Arial,sans-serif;font-size:8pt;color:#888">
  Litson PLLC<br>54 Music Square E Ste 300, Nashville, TN 37203<br>(615) 985-8205<br>www.litson.co
</div>
<script>
  var imgs=document.images,n=imgs.length,done=0;
  function go(){done++;if(done>=n)window.print();}
  if(!n){window.print();}else{for(var i=0;i<n;i++){if(imgs[i].complete)go();else{imgs[i].onload=go;imgs[i].onerror=go;}}}
</script>
</body></html>`;
    win.document.write(html);
    win.document.close();
  }

  const ready = !!(form.name && form.role && form.salary);
  const decReady = !!(dec.name && dec.body);
  const genReady = !!gen.body.trim();
  const certReady = !!(cert.name && certBody.trim());

  const fields: [string, keyof Form, string][] = [
    ['Candidate Name *', 'name', 'text'],
    ['Email', 'email', 'email'],
    ['Role / Title *', 'role', 'text'],
    ...(empType === 'employee' ? [['Department', 'dept', 'text'] as [string, keyof Form, string]] : []),
    [empType === 'contractor'
      ? (rateBasis === 'hourly' ? 'Hourly Rate ($) *' : 'Monthly Rate ($) *')
      : (compBasis === 'hourly' ? 'Hourly Rate ($) *' : compBasis === 'monthly' ? 'Monthly Salary ($) *' : 'Annual Salary ($) *'), 'salary', 'text'],
    ['Start Date', 'startDate', 'date'],
    ['Location', 'location', 'text'],
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="px-8 py-5 bg-white border-b border-border flex-shrink-0 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-spectral text-[23px] font-semibold text-text-primary">
            {letterKind === 'offer' ? 'Offer Letters' : letterKind === 'declination' ? 'Declination Letters' : letterKind === 'certificate' ? 'Certificate of Employment' : 'General Letters'}
          </h1>
          <p className="text-sm text-text-muted mt-0.5">
            {letterKind === 'offer'
              ? 'AI-generated offer letters on Litson letterhead'
              : letterKind === 'declination'
              ? 'Declination-of-representation letters on Litson letterhead'
              : letterKind === 'certificate'
              ? 'Certificate / proof of employment on Litson letterhead — fully editable'
              : 'Fillable letters on Litson letterhead — sponsorship, proof of employment, references and more'}
          </p>
        </div>
        <div className="flex gap-1 bg-canvas border border-border rounded-ctrl p-1 flex-shrink-0">
          <button onClick={() => setLetterKind('offer')}
            className={clsx('px-4 py-1.5 text-sm font-semibold rounded-ctrl transition-colors',
              letterKind === 'offer' ? 'bg-ink text-white' : 'text-text-secondary hover:text-text-primary')}>
            Offer
          </button>
          <button onClick={() => setLetterKind('declination')}
            className={clsx('px-4 py-1.5 text-sm font-semibold rounded-ctrl transition-colors',
              letterKind === 'declination' ? 'bg-ink text-white' : 'text-text-secondary hover:text-text-primary')}>
            Declination
          </button>
          <button onClick={() => setLetterKind('general')}
            className={clsx('px-4 py-1.5 text-sm font-semibold rounded-ctrl transition-colors',
              letterKind === 'general' ? 'bg-ink text-white' : 'text-text-secondary hover:text-text-primary')}>
            General
          </button>
          <button onClick={() => setLetterKind('certificate')}
            className={clsx('px-4 py-1.5 text-sm font-semibold rounded-ctrl transition-colors',
              letterKind === 'certificate' ? 'bg-ink text-white' : 'text-text-secondary hover:text-text-primary')}>
            Certificate
          </button>
        </div>
      </header>

      {letterKind === 'offer' && (
      <div className="flex-1 overflow-auto p-8">
        <div className="grid grid-cols-[360px_1fr] gap-6 max-w-5xl items-start">

          {/* Form panel */}
          <div className="bg-white border border-border rounded-card p-6 space-y-4 sticky top-0">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-gold-muted mb-2">Letter Type</div>
              <div className="flex gap-2">
                <button onClick={() => setEmpType('contractor')}
                  className={clsx('flex-1 py-2 text-sm font-semibold rounded-ctrl border transition-colors',
                    empType === 'contractor' ? 'bg-ink text-white border-ink' : 'bg-white text-text-secondary border-border hover:border-ink')}>
                  1099 Contractor
                </button>
                <button onClick={() => setEmpType('employee')}
                  className={clsx('flex-1 py-2 text-sm font-semibold rounded-ctrl border transition-colors',
                    empType === 'employee' ? 'bg-ink text-white border-ink' : 'bg-white text-text-secondary border-border hover:border-ink')}>
                  W-2 Employee
                </button>
              </div>
            </div>

            {empType === 'contractor' && (
              <>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-gold-muted mb-2">Compensation</div>
                  <div className="flex gap-2">
                    {([['monthly', 'Monthly'], ['hourly', 'Hourly']] as const).map(([val, label]) => (
                      <button key={val} onClick={() => setRateBasis(val)}
                        className={clsx('flex-1 py-2 text-sm font-semibold rounded-ctrl border transition-colors',
                          rateBasis === val ? 'bg-ink text-white border-ink' : 'bg-white text-text-secondary border-border hover:border-ink')}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-gold-muted mb-2">Payable Basis</div>
                  <div className="flex gap-2">
                    {([['monthly', 'Monthly'], ['weekly', 'Weekly'], ['biweekly', 'Bi-weekly']] as const).map(([val, label]) => (
                      <button key={val} onClick={() => setPayBasis(val)}
                        className={clsx('flex-1 py-2 text-sm font-semibold rounded-ctrl border transition-colors',
                          payBasis === val ? 'bg-ink text-white border-ink' : 'bg-white text-text-secondary border-border hover:border-ink')}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {empType === 'employee' && (
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-gold-muted mb-2">Compensation basis</div>
                <div className="flex gap-2">
                  {([['annual', 'Annual'], ['monthly', 'Monthly'], ['hourly', 'Hourly']] as const).map(([val, label]) => (
                    <button key={val} onClick={() => setCompBasis(val)}
                      className={clsx('flex-1 py-2 text-sm font-semibold rounded-ctrl border transition-colors',
                        compBasis === val ? 'bg-ink text-white border-ink' : 'bg-white text-text-secondary border-border hover:border-ink')}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="text-xs font-bold uppercase tracking-wider text-gold-muted pt-1">Candidate Details</div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Salutation</label>
              <select value={salTitle} onChange={e => setSalTitle(e.target.value)}
                className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm bg-white focus:outline-none focus:border-ink">
                <option value="">First name (Dear [First],)</option>
                {['Mr.', 'Ms.', 'Mrs.', 'Mx.', 'Dr.'].map(t => <option key={t} value={t}>{t} [Last name]</option>)}
              </select>
            </div>

            {fields.map(([label, key, type]) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-text-secondary mb-1">{label}</label>
                <input
                  type={type}
                  value={form[key]}
                  onChange={e => set(key, e.target.value)}
                  placeholder={key === 'location' ? (empType === 'contractor' ? 'Remote' : 'Nashville, TN') : ''}
                  className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink"
                />
              </div>
            ))}

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Additional Notes</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
                className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink resize-none" />
            </div>

            <EditGate fallback={
              <p className="text-xs text-text-muted text-center py-2">View only — contact HR Admin to generate letters</p>
            }>
              <button onClick={generate} disabled={!ready || generating}
                className="w-full bg-ink text-white text-sm font-semibold py-2.5 rounded-ctrl hover:bg-ink-dark transition-colors disabled:opacity-40">
                {generating ? 'Generating…' : `Generate ${empType === 'contractor' ? 'Contractor' : 'Employee'} Letter`}
              </button>
            </EditGate>
          </div>

          {/* Letter preview panel */}
          <div className="space-y-3">
            <div className="bg-white border border-border rounded-card overflow-hidden shadow-sm">
              {/* Letterhead */}
              <div className="flex items-start justify-between px-8 pt-7 pb-5 border-b border-[#e8e2d8]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={LOGO_B64} alt="Litson" width={200} height={67} className="block" />
                <div className="text-right text-[10px] text-text-muted leading-[1.8] font-sans mt-1">
                  <span className="font-semibold text-[10.5px] text-text-primary">J. Alex Little</span><br />
                  Founding &amp; Managing Partner<br />615.985.8189<br />alex@litson.co
                </div>
              </div>

              {/* Body */}
              {draft ? (
                <div className="px-8 pt-4 pb-2">
                  <div className="flex items-center gap-1 mb-1.5 print:hidden">
                    <button type="button" onClick={() => applyOfferFmt('bold')} title="Bold selected text (**text**)"
                      className="px-2.5 py-1 text-sm font-bold rounded-ctrl border border-border-light text-text-secondary hover:border-ink hover:text-text-primary">B</button>
                    <button type="button" onClick={() => applyOfferFmt('italic')} title="Italicize selected text (*text*)"
                      className="px-2.5 py-1 text-sm italic rounded-ctrl border border-border-light text-text-secondary hover:border-ink hover:text-text-primary">I</button>
                    <span className="text-[10px] text-text-muted ml-1">Select a word (e.g. the rate) then B / I</span>
                  </div>
                  <textarea
                    ref={offerRef}
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    className="w-full text-[13px] leading-[1.6] text-text-primary resize-none focus:outline-none border-none bg-transparent"
                    style={{ fontFamily: BODY_FONT, minHeight: '440px' }}
                  />
                </div>
              ) : (
                <div className="px-8 py-20 text-center">
                  <div className="text-text-muted text-sm italic">Fill in the form and click Generate to create the letter</div>
                </div>
              )}

              {/* Closing block — right-aligned with signature */}
              {draft && /very truly yours/i.test(draft) && (
                <div className="px-8 pb-5 flex justify-end">
                  <div className="text-left">
                    <p className="text-[13px] mb-1" style={{ fontFamily: BODY_FONT }}>Very truly yours,</p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={SIG_B64} alt="Alex Little signature" width={130} height={43} className="block my-0.5" />
                    <p className="text-[13px] leading-snug" style={{ fontFamily: BODY_FONT }}>
                      Alex Little<br />Founding &amp; Managing Partner<br />Litson PLLC
                    </p>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="px-8 pt-3 pb-5 border-t border-[#ccc]">
                <p className="text-[9px] text-text-muted font-sans tracking-wide">
                  Litson PLLC &nbsp;&middot;&nbsp; 54 Music Square E Ste 300, Nashville, TN 37203 &nbsp;&middot;&nbsp; (615) 985-8205 &nbsp;&middot;&nbsp; www.litson.co
                </p>
              </div>
            </div>

            {draft && (
              <div className="flex items-center gap-2">
                <button onClick={printPdf}
                  className="bg-ink text-white text-sm font-semibold px-4 py-2.5 rounded-ctrl hover:bg-ink-dark transition-colors">
                  ⤓ Print / PDF
                </button>
                <button onClick={downloadTxt}
                  className="bg-white border border-border text-text-primary text-sm font-semibold px-4 py-2.5 rounded-ctrl hover:bg-canvas transition-colors">
                  ↓ TXT
                </button>
                <button onClick={() => { setDraft(''); setForm(EMPTY); }}
                  className="ml-auto text-sm font-semibold text-text-muted hover:text-text-primary px-3 py-2 rounded-ctrl hover:bg-canvas border border-transparent hover:border-border transition-colors">
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {letterKind === 'declination' && (
      <div className="flex-1 overflow-auto p-8">
        <div className="grid grid-cols-[360px_1fr] gap-6 max-w-5xl items-start">

          {/* Form panel */}
          <div className="bg-white border border-border rounded-card p-6 space-y-4 sticky top-0">
            <div className="text-xs font-bold uppercase tracking-wider text-gold-muted">Recipient</div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Date</label>
              <input type="text" value={dec.date} onChange={e => setD('date', e.target.value)}
                placeholder="July 13, 2026"
                className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Recipient Name *</label>
              <input type="text" value={dec.name} onChange={e => setD('name', e.target.value)}
                placeholder="Eugene Trussell"
                className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Email</label>
              <input type="email" value={dec.email} onChange={e => setD('email', e.target.value)}
                placeholder="name@example.com"
                className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Salutation</label>
              <input type="text" value={dec.salutation} onChange={e => setD('salutation', e.target.value)}
                placeholder="Mr. Trussell (defaults to name)"
                className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Re:</label>
              <input type="text" value={dec.re} onChange={e => setD('re', e.target.value)}
                className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Signed by</label>
              <input type="text" value={dec.signer} onChange={e => setD('signer', e.target.value)}
                className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
            </div>

            <button onClick={() => setDec({ ...DEC_EMPTY, date: fmtLongDate(new Date()) })}
              className="w-full text-sm font-semibold text-text-muted hover:text-text-primary py-2 rounded-ctrl hover:bg-canvas border border-transparent hover:border-border transition-colors">
              Reset to template
            </button>
          </div>

          {/* Letter preview panel */}
          <div className="space-y-3">
            <div className="bg-white border border-border rounded-card overflow-hidden shadow-sm">
              {/* Letterhead */}
              <div className="flex items-start justify-between px-8 pt-7 pb-5 border-b border-[#e8e2d8]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={LOGO_B64} alt="Litson" width={200} height={67} className="block" />
                <div className="text-right text-[10px] text-text-muted leading-[1.8] font-sans mt-1">
                  <span className="font-semibold text-[10.5px] text-text-primary">J. Alex Little</span><br />
                  Founding &amp; Managing Partner<br />615.985.8189<br />alex@litson.co
                </div>
              </div>

              {/* Body */}
              <div className="px-8 pt-6 pb-2 text-[13px] leading-[1.6] text-text-primary" style={{ fontFamily: BODY_FONT }}>
                <p className="text-center mb-5">{dec.date || 'July 13, 2026'}</p>
                <p>{dec.name || 'Recipient Name'}</p>
                {dec.email && <p>{dec.email}</p>}
                <p className="mt-5 mb-4" style={{ marginLeft: '2.5em' }}><span className="font-bold">Re:</span><span className="font-bold ml-6">{dec.re}</span></p>
                <p className="mb-3">Dear {dec.salutation.trim() || dec.name.trim() || 'Recipient'},</p>
                <textarea value={dec.body} onChange={e => setD('body', e.target.value)}
                  className="w-full resize-none focus:outline-none border border-transparent hover:border-border-light focus:border-ink rounded-ctrl bg-transparent text-[13px] leading-[1.6] px-1 py-1"
                  style={{ fontFamily: BODY_FONT, minHeight: '150px', textIndent: '2.5em', textAlign: 'justify' }} />
              </div>

              {/* Closing + signature — indented to the right, matching house style */}
              <div className="px-8 pb-5">
                <div style={{ marginLeft: '52%' }}>
                  <p className="text-[13px]" style={{ fontFamily: BODY_FONT }}>Sincerely,</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={SIG_B64} alt="signature" width={130} height={43} className="block my-1" />
                  <p className="text-[13px] mt-2" style={{ fontFamily: BODY_FONT }}>{dec.signer}</p>
                </div>
              </div>

              {/* Footer */}
              <div className="px-8 pt-3 pb-5 border-t border-[#ccc]">
                <p className="text-[9px] text-text-muted font-sans tracking-wide">
                  Litson PLLC &nbsp;&middot;&nbsp; 54 Music Square E Ste 300, Nashville, TN 37203 &nbsp;&middot;&nbsp; (615) 985-8205 &nbsp;&middot;&nbsp; www.litson.co
                </p>
              </div>
            </div>

            <EditGate fallback={
              <p className="text-xs text-text-muted py-2">View only — contact HR Admin to print letters</p>
            }>
              <div className="flex items-center gap-2">
                <button onClick={printDeclination} disabled={!decReady}
                  className="bg-ink text-white text-sm font-semibold px-4 py-2.5 rounded-ctrl hover:bg-ink-dark transition-colors disabled:opacity-40">
                  ⤓ Print / PDF
                </button>
              </div>
            </EditGate>
          </div>
        </div>
      </div>
      )}

      {letterKind === 'general' && (
      <div className="flex-1 overflow-auto p-8">
        <div className="grid grid-cols-[360px_1fr] gap-6 max-w-5xl items-start">

          {/* Form panel */}
          <div className="bg-white border border-border rounded-card p-6 space-y-4 sticky top-0">
            {/* Saved templates */}
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-gold-muted mb-1.5">Templates</div>
              <div className="flex items-center gap-1.5">
                <select value={genTplName} onChange={e => loadGenTemplate(e.target.value)}
                  className="flex-1 min-w-0 border border-border-light rounded-ctrl px-2.5 py-2 text-sm bg-white focus:outline-none focus:border-ink">
                  <option value="">Saved templates…</option>
                  {Object.keys(genTemplates).sort((a, b) => a.localeCompare(b)).map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <button onClick={saveGenTemplate} title="Save the current letter as a template"
                  className="shrink-0 text-sm font-semibold text-ink border border-border-light px-3 py-2 rounded-ctrl hover:bg-canvas">💾 Save</button>
                {genTplName && genTemplates[genTplName] && (
                  <button onClick={deleteGenTemplate} title="Delete this template"
                    className="shrink-0 text-sm text-text-muted border border-border-light px-2.5 py-2 rounded-ctrl hover:text-litred-alt hover:bg-[#fdeaea]">🗑</button>
                )}
              </div>
            </div>
            <div className="border-t border-border-light -mx-6" />
            <div className="text-xs font-bold uppercase tracking-wider text-gold-muted">Letter Details</div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Date</label>
              <input type="text" value={gen.date} onChange={e => setG('date', e.target.value)}
                placeholder="July 23, 2026"
                className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Addressee</label>
              <input type="text" value={gen.addressee} onChange={e => setG('addressee', e.target.value)}
                placeholder="To Whom It May Concern:"
                className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Re: (subject)</label>
              <input type="text" value={gen.re} onChange={e => setG('re', e.target.value)}
                placeholder="Financial Sponsorship Letter for …"
                className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Greeting <span className="text-text-muted font-normal">(optional)</span></label>
              <input type="text" value={gen.greeting} onChange={e => setG('greeting', e.target.value)}
                placeholder="Dear Sir or Madam,"
                className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Body *</label>
              <div className="flex items-center gap-1 mb-1.5">
                <button type="button" onClick={() => applyFmt('bold')} title="Bold selected text (**text**)"
                  className="px-2.5 py-1 text-sm font-bold rounded-ctrl border border-border-light text-text-secondary hover:border-ink hover:text-text-primary transition-colors">B</button>
                <button type="button" onClick={() => applyFmt('italic')} title="Italicize selected text (*text*)"
                  className="px-2.5 py-1 text-sm italic rounded-ctrl border border-border-light text-text-secondary hover:border-ink hover:text-text-primary transition-colors">I</button>
                <button type="button" onClick={() => applyFmt('bullet')} title="Turn the current line(s) into bullets"
                  className="px-2.5 py-1 text-sm rounded-ctrl border border-border-light text-text-secondary hover:border-ink hover:text-text-primary transition-colors">• List</button>
              </div>
              <textarea ref={bodyRef} value={gen.body} onChange={e => setG('body', e.target.value)} rows={9}
                placeholder={"Type the letter here. Leave a blank line between paragraphs.\n\nSelect text and use B / I above, or type **bold** and *italic*.\nStart a line with • or - for a bullet point."}
                className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink resize-y" />
              <p className="text-[11px] text-text-muted mt-1">Blank line = new paragraph. <code>**bold**</code>, <code>*italic*</code>, and lines starting with • or - become bullets.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Signed by</label>
                <input type="text" value={gen.signer} onChange={e => setG('signer', e.target.value)}
                  className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Title</label>
                <input type="text" value={gen.signerTitle} onChange={e => setG('signerTitle', e.target.value)}
                  className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">cc <span className="text-text-muted font-normal">(optional, one per line)</span></label>
              <textarea value={gen.cc} onChange={e => setG('cc', e.target.value)} rows={2}
                placeholder="Zack Lawson, Member"
                className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink resize-none" />
            </div>
            <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
              <input type="checkbox" checked={gen.withSig} onChange={e => setG('withSig', e.target.checked)} />
              Include Alex Little&rsquo;s signature image
            </label>

            <button onClick={() => setGen({ ...GEN_EMPTY, date: fmtLongDate(new Date()) })}
              className="w-full text-sm font-semibold text-text-muted hover:text-text-primary py-2 rounded-ctrl hover:bg-canvas border border-transparent hover:border-border transition-colors">
              Reset
            </button>
          </div>

          {/* Letter preview panel */}
          <div className="space-y-3">
            <div className="bg-white border border-border rounded-card overflow-hidden shadow-sm">
              {/* Letterhead */}
              <div className="flex items-start justify-between px-8 pt-7 pb-5 border-b border-[#e8e2d8]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={LOGO_B64} alt="Litson" width={200} height={67} className="block" />
                <div className="text-right text-[10px] text-text-muted leading-[1.8] font-sans mt-1">
                  <span className="font-semibold text-[10.5px] text-text-primary">J. Alex Little</span><br />
                  Founding &amp; Managing Partner<br />615.985.8189<br />alex@litson.co
                </div>
              </div>

              {/* Body */}
              <div className="px-8 pt-6 pb-2 text-[13px] leading-[1.6] text-text-primary" style={{ fontFamily: BODY_FONT }}>
                {gen.date && <p className="mb-4">{gen.date}</p>}
                {gen.addressee && <p className="mb-4 font-bold">{gen.addressee}</p>}
                {gen.re && <p className="mb-4"><span className="font-bold">RE:</span><span className="font-bold ml-3">{gen.re}</span></p>}
                {gen.greeting.trim() && <p className="mb-3">{gen.greeting}</p>}
                {gen.body.trim()
                  ? gen.body.split('\n').map((l, i) => {
                      const t = l.trim();
                      if (t === '') return <div key={i} style={{ height: '11px' }} />;
                      if (/^[•\-]\s*/.test(t)) return <p key={i} className="mb-1" style={{ marginLeft: '1.5em', textIndent: '-1em' }} dangerouslySetInnerHTML={{ __html: '&bull;&nbsp;' + fmtInline(t.replace(/^[•\-]\s*/, '')) }} />;
                      return <p key={i} style={{ textAlign: 'justify' }} dangerouslySetInnerHTML={{ __html: fmtInline(l) }} />;
                    })
                  : <p className="text-text-muted italic">Type the letter body in the form…</p>}
              </div>

              {/* Closing + signature */}
              <div className="px-8 pb-5 flex justify-end">
                <div className="text-left">
                  <p className="text-[13px]" style={{ fontFamily: BODY_FONT }}>Very truly yours,</p>
                  {gen.withSig
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={SIG_B64} alt="signature" width={130} height={43} className="block my-1" />
                    : <div style={{ height: '28px' }} />}
                  <p className="text-[13px]" style={{ fontFamily: BODY_FONT }}>{gen.signer}</p>
                  {gen.signerTitle && <p className="text-[13px]" style={{ fontFamily: BODY_FONT }}>{gen.signerTitle}</p>}
                </div>
              </div>

              {gen.cc.trim() && (
                <div className="px-8 pb-4 text-[13px]" style={{ fontFamily: BODY_FONT }}>
                  <span className="font-bold">cc:</span>{' '}
                  {gen.cc.split('\n').map(l => l.trim()).filter(Boolean).map((l, i) => (
                    <span key={i}>{i > 0 && <br />}{l}</span>
                  ))}
                </div>
              )}

              {/* Footer */}
              <div className="px-8 pt-3 pb-5 border-t border-[#ccc]">
                <p className="text-[9px] text-text-muted font-sans tracking-wide">
                  Litson PLLC &nbsp;&middot;&nbsp; 54 Music Square E Ste 300, Nashville, TN 37203 &nbsp;&middot;&nbsp; (615) 985-8205 &nbsp;&middot;&nbsp; www.litson.co
                </p>
              </div>
            </div>

            <EditGate fallback={
              <p className="text-xs text-text-muted py-2">View only — contact HR Admin to print letters</p>
            }>
              <div className="flex items-center gap-2">
                <button onClick={printGeneral} disabled={!genReady}
                  className="bg-ink text-white text-sm font-semibold px-4 py-2.5 rounded-ctrl hover:bg-ink-dark transition-colors disabled:opacity-40">
                  ⤓ Print / PDF
                </button>
              </div>
            </EditGate>
          </div>
        </div>
      </div>
      )}

      {letterKind === 'certificate' && (
      <div className="flex-1 overflow-auto p-8">
        <div className="grid grid-cols-[360px_1fr] gap-6 max-w-5xl items-start">

          {/* Form panel */}
          <div className="bg-white border border-border rounded-card p-6 space-y-4 sticky top-0">
            {/* Saved templates */}
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-gold-muted mb-1.5">Templates</div>
              <div className="flex items-center gap-1.5">
                <select value={certTplName} onChange={e => loadCertTemplate(e.target.value)}
                  className="flex-1 min-w-0 border border-border-light rounded-ctrl px-2.5 py-2 text-sm bg-white focus:outline-none focus:border-ink">
                  <option value="">Saved templates…</option>
                  {Object.keys(certTemplates).sort((a, b) => a.localeCompare(b)).map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <button onClick={saveCertTemplate} title="Save the current letter as a template"
                  className="shrink-0 text-sm font-semibold text-ink border border-border-light px-3 py-2 rounded-ctrl hover:bg-canvas">💾 Save</button>
                {certTplName && certTemplates[certTplName] && (
                  <button onClick={deleteCertTemplate} title="Delete this template"
                    className="shrink-0 text-sm text-text-muted border border-border-light px-2.5 py-2 rounded-ctrl hover:text-litred-alt hover:bg-[#fdeaea]">🗑</button>
                )}
              </div>
            </div>
            <div className="border-t border-border-light -mx-6" />
            <div className="text-xs font-bold uppercase tracking-wider text-gold-muted">Employee</div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Date</label>
              <input type="text" value={cert.date} onChange={e => setC('date', e.target.value)}
                className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Full name *</label>
              <input type="text" value={cert.name} onChange={e => setC('name', e.target.value)}
                placeholder="Paula Laborne Valle"
                className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Email</label>
              <input type="email" value={cert.email} onChange={e => setC('email', e.target.value)}
                placeholder="name@litson.co"
                className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Short name</label>
                <input type="text" value={cert.shortName} onChange={e => setC('shortName', e.target.value)}
                  placeholder="Ms. Valle"
                  className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Pronoun</label>
                <select value={cert.pronoun} onChange={e => setC('pronoun', e.target.value)}
                  className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm bg-white focus:outline-none focus:border-ink">
                  {['her', 'his', 'their'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Role / Title</label>
              <input type="text" value={cert.role} onChange={e => setC('role', e.target.value)}
                className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Engagement</label>
              <input type="text" value={cert.engagement} onChange={e => setC('engagement', e.target.value)}
                placeholder="an independent contractor / a full-time employee"
                className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Since (start date)</label>
                <input type="text" value={cert.startDate} onChange={e => setC('startDate', e.target.value)}
                  placeholder="July 28, 2025"
                  className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Working hours</label>
                <input type="text" value={cert.hours} onChange={e => setC('hours', e.target.value)}
                  className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Duties <span className="text-text-muted font-normal">(one per line · “Title – description”)</span></label>
              <textarea value={cert.duties} onChange={e => setC('duties', e.target.value)} rows={5}
                className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink resize-y" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Purpose</label>
              <input type="text" value={cert.purpose} onChange={e => setC('purpose', e.target.value)}
                className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Signed by</label>
                <input type="text" value={cert.signer} onChange={e => setC('signer', e.target.value)}
                  className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Title</label>
                <input type="text" value={cert.signerTitle} onChange={e => setC('signerTitle', e.target.value)}
                  className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
              </div>
            </div>
            <button onClick={() => setCert({ ...CERT_EMPTY, date: fmtLongDate(new Date()) })}
              className="w-full text-sm font-semibold text-text-muted hover:text-text-primary py-2 rounded-ctrl hover:bg-canvas border border-transparent hover:border-border transition-colors">
              Reset
            </button>
          </div>

          {/* Letter preview panel */}
          <div className="space-y-3">
            <div className="bg-white border border-border rounded-card overflow-y-auto shadow-sm" style={{ maxHeight: '58vh' }}>
              {/* Letterhead */}
              <div className="flex items-start justify-between px-8 pt-7 pb-5 border-b border-[#e8e2d8]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={LOGO_B64} alt="Litson" width={200} height={67} className="block" />
                <div className="text-right text-[10px] text-text-muted leading-[1.8] font-sans mt-1">
                  <span className="font-semibold text-[10.5px] text-text-primary">J. Alex Little</span><br />
                  Founding &amp; Managing Partner<br />615.985.8189<br />alex@litson.co
                </div>
              </div>

              {/* Body */}
              <div className="px-8 pt-6 pb-2 text-[13px] leading-[1.6] text-text-primary" style={{ fontFamily: BODY_FONT }}>
                <div className="flex items-start justify-between mb-4">
                  <span className="font-bold underline">Via Email</span>
                  <span>{cert.date}</span>
                </div>
                {cert.name && <p className="font-bold">{cert.name}</p>}
                {cert.email && <p className="text-[#2f5fa0]">{cert.email}</p>}
                <p className="mt-4 mb-4" style={{ marginLeft: '0.5in' }}><span className="font-bold">Re:</span><span className="font-bold ml-6">Certificate of Employment{cert.name ? ` – ${cert.name}` : ''}</span></p>
                <p className="mb-3">To whom it may concern,</p>
                <div className="space-y-0">
                  {certBody.split('\n').map((l, i) => {
                    const t = l.trim();
                    if (t === '') return <div key={i} style={{ height: '10px' }} />;
                    if (/^[•\-]\s*/.test(t)) return <p key={i} className="mb-1" style={{ marginLeft: '2em', textIndent: '-1.1em' }} dangerouslySetInnerHTML={{ __html: '&bull;&nbsp;&nbsp;' + fmtInline(t.replace(/^[•\-]\s*/, '')) }} />;
                    return <p key={i} style={{ textAlign: 'justify', textIndent: '0.5in' }} dangerouslySetInnerHTML={{ __html: fmtInline(l) }} />;
                  })}
                </div>
              </div>

              {/* Closing + signature */}
              <div className="px-8 pb-5 flex justify-end">
                <div className="text-left">
                  <p className="text-[13px]" style={{ fontFamily: BODY_FONT }}>Very truly yours,</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={SIG_B64} alt="signature" width={130} height={43} className="block my-1" />
                  <p className="text-[13px]" style={{ fontFamily: BODY_FONT }}>{cert.signer}</p>
                  {cert.signerTitle && <p className="text-[13px]" style={{ fontFamily: BODY_FONT }}>{cert.signerTitle}</p>}
                </div>
              </div>

              {/* Footer */}
              <div className="px-8 pt-3 pb-5 border-t border-[#ccc]">
                <p className="text-[9px] text-text-muted font-sans tracking-wide">
                  Litson PLLC &nbsp;&middot;&nbsp; 54 Music Square E Ste 300, Nashville, TN 37203 &nbsp;&middot;&nbsp; (615) 985-8205 &nbsp;&middot;&nbsp; www.litson.co
                </p>
              </div>
            </div>

            {/* Editable wording */}
            <div className="bg-white border border-border rounded-card p-4">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-gold-muted">Letter wording — edit freely</label>
                <button onClick={() => setC('body', composeCert(cert))} className="text-[11px] font-semibold text-[#3f6b8a] hover:underline">↺ Rebuild from fields</button>
              </div>
              <div className="flex items-center gap-1 mb-1.5">
                <button type="button" onClick={() => applyCertFmt('bold')} title="Bold selected text (**text**)"
                  className="px-2.5 py-1 text-sm font-bold rounded-ctrl border border-border-light text-text-secondary hover:border-ink hover:text-text-primary transition-colors">B</button>
                <button type="button" onClick={() => applyCertFmt('italic')} title="Italicize selected text (*text*)"
                  className="px-2.5 py-1 text-sm italic rounded-ctrl border border-border-light text-text-secondary hover:border-ink hover:text-text-primary transition-colors">I</button>
                <button type="button" onClick={() => applyCertFmt('bullet')} title="Turn the current line(s) into bullets"
                  className="px-2.5 py-1 text-sm rounded-ctrl border border-border-light text-text-secondary hover:border-ink hover:text-text-primary transition-colors">• List</button>
              </div>
              <textarea ref={certBodyRef} value={certBody} onChange={e => setC('body', e.target.value)} rows={10}
                className="w-full border border-border-light rounded-ctrl px-3 py-2 text-[13px] leading-[1.6] focus:outline-none focus:border-ink resize-y"
                style={{ fontFamily: BODY_FONT }} />
              <p className="text-[11px] text-text-muted mt-1">Edits here appear in the preview and PDF. **bold**, *italic*, and lines starting with • become bullets. Until you type here, the wording updates from the fields above.</p>
            </div>

            <EditGate fallback={<p className="text-xs text-text-muted py-2">View only — contact HR Admin to print letters</p>}>
              <div className="flex items-center gap-2">
                <button onClick={printCertificate} disabled={!certReady}
                  className="bg-ink text-white text-sm font-semibold px-4 py-2.5 rounded-ctrl hover:bg-ink-dark transition-colors disabled:opacity-40">
                  ⤓ Print / PDF
                </button>
              </div>
            </EditGate>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

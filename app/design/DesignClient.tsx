'use client';
import { useState, useRef, useEffect, useCallback } from 'react';

type EventType = 'birthday' | 'anniversary';
type PhotoLayout = 'classic' | 'spotlight' | 'banner';
const SIZE = 1080;

function ordSuffix(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return 'th';
  return ['th','st','nd','rd'][n % 4] ?? 'th';
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, maxWidth: number, lineHeight: number, startY: number) {
  const words = text.split(' ');
  let line = '';
  let y = startY;
  for (let i = 0; i < words.length; i++) {
    const test = line + words[i] + ' ';
    if (ctx.measureText(test).width > maxWidth && i > 0) {
      ctx.fillText(line.trim(), x, y);
      line = words[i] + ' ';
      y += lineHeight;
    } else { line = test; }
  }
  ctx.fillText(line.trim(), x, y);
}

function drawBackground(ctx: CanvasRenderingContext2D) {
  const bg = ctx.createLinearGradient(0, 0, 0, SIZE);
  bg.addColorStop(0, '#0e1520');
  bg.addColorStop(1, '#192233');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.strokeStyle = '#c9a24a';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, SIZE - 6, SIZE - 6);
}

function drawConfetti(ctx: CanvasRenderingContext2D) {
  const pieces: [number, number, number, string, number][] = [
    [90, 120, 12, '#c9a24a', 0.3], [180, 60, 10, '#c8102e', 0.7], [260, 100, 8, '#e6c878', 0.5],
    [340, 50, 11, '#c9a24a', 0.4], [430, 80, 9, '#c8102e', 0.6], [520, 45, 10, '#ffffff', 0.3],
    [610, 70, 12, '#c9a24a', 0.5], [700, 55, 8, '#c8102e', 0.7], [790, 90, 11, '#e6c878', 0.4],
    [880, 60, 10, '#c9a24a', 0.6], [960, 110, 9, '#c8102e', 0.5],
    [70, 960, 10, '#c9a24a', 0.4], [170, 1010, 12, '#c8102e', 0.6], [300, 990, 9, '#e6c878', 0.5],
    [450, 1020, 11, '#c9a24a', 0.4], [600, 1000, 8, '#c8102e', 0.7], [750, 1015, 10, '#ffffff', 0.3],
    [900, 990, 12, '#c9a24a', 0.5], [1000, 960, 9, '#c8102e', 0.6],
    [50, 400, 8, '#c9a24a', 0.3], [1030, 350, 9, '#e6c878', 0.4], [45, 650, 10, '#c8102e', 0.5],
    [1025, 620, 8, '#c9a24a', 0.4],
  ];
  pieces.forEach(([x, y, r, color, opacity]) => {
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.translate(x, y);
    ctx.rotate(Math.random() * Math.PI);
    // triangle confetti
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.87, r * 0.5);
    ctx.lineTo(-r * 0.87, r * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });
  // Gold cross sparkles
  const sparks: [number, number][] = [[70,70],[940,65],[55,500],[1020,480],[60,800],[1010,760],[540,45]];
  sparks.forEach(([sx, sy]) => {
    ctx.fillStyle = 'rgba(201,162,74,0.5)';
    ctx.beginPath();
    ctx.arc(sx, sy, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(201,162,74,0.25)';
    ctx.fillRect(sx - 12, sy - 1.5, 24, 3);
    ctx.fillRect(sx - 1.5, sy - 12, 3, 24);
  });
}

function drawLitson(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#c9a24a';
  ctx.font = '600 28px Georgia, serif';
  ctx.letterSpacing = '8px';
  ctx.fillText('LITSON', SIZE / 2, 72);
  ctx.restore();
}

function drawBalloons(ctx: CanvasRenderingContext2D) {
  const balloons: [number, number, number, number, string][] = [
    // Left cluster — bigger, staggered heights
    [108, 230, 62, 78, '#c9a24a'],
    [178, 160, 52, 66, '#e6c878'],
    [238, 210, 58, 72, '#c8102e'],
    // Right cluster
    [842, 230, 62, 78, '#c9a24a'],
    [902, 160, 52, 66, '#e6c878'],
    [962, 210, 58, 72, '#c8102e'],
  ];
  balloons.forEach(([cx, cy, rx, ry, color]) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath();
    ctx.ellipse(cx - rx * 0.28, cy - ry * 0.28, rx * 0.35, ry * 0.28, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy + ry + 4, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(201,162,74,0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy + ry + 9);
    ctx.quadraticCurveTo(cx + 18, cy + ry + 90, cx - 8, cy + ry + 180);
    ctx.stroke();
  });
}

function drawStars(ctx: CanvasRenderingContext2D) {
  function star(cx: number, cy: number, r: number, opacity: number) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = `rgba(201,162,74,${opacity})`;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 - Math.PI / 4;
      const ai = a + Math.PI / 4;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      ctx.lineTo(Math.cos(ai) * (r * 0.35), Math.sin(ai) * (r * 0.35));
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  star(120, 160, 24, 0.9); star(168, 122, 16, 0.7); star(92, 118, 12, 0.5);
  star(958, 160, 24, 0.9); star(912, 122, 16, 0.7); star(984, 118, 12, 0.5);
  star(540, 46, 14, 0.5); star(300, 52, 10, 0.4); star(780, 52, 10, 0.4);
}

function drawCirclePhoto(ctx: CanvasRenderingContext2D, img: HTMLImageElement, cx: number, cy: number, r: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  const aspect = img.naturalWidth / img.naturalHeight;
  let sw = r * 2, sh = r * 2;
  if (aspect > 1) sw = sh * aspect; else sh = sw / aspect;
  ctx.drawImage(img, cx - sw / 2, cy - sh / 2, sw, sh);
  ctx.restore();
  ctx.strokeStyle = '#c9a24a';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
  ctx.stroke();
}

export default function DesignClient({ employees }: { employees: { name: string }[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const [eventType, setEventType] = useState<EventType>('birthday');
  const [photoLayout, setPhotoLayout] = useState<PhotoLayout>('classic');
  const [name, setName] = useState('');
  const [greeting, setGreeting] = useState('Wishing you a wonderful birthday and a year ahead full of joy!');
  const [years, setYears] = useState('1');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [format, setFormat] = useState<'png' | 'jpeg'>('png');

  // Employee-name dropdown (shared by birthday + anniversary)
  const [nameOpen, setNameOpen] = useState(false);
  const nameBoxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) { if (nameBoxRef.current && !nameBoxRef.current.contains(e.target as Node)) setNameOpen(false); }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  const nameOptions = employees.map(e => e.name).filter(Boolean);
  const filteredNames = name.trim() ? nameOptions.filter(nm => nm.toLowerCase().includes(name.trim().toLowerCase())) : nameOptions;

  useEffect(() => {
    setGreeting(eventType === 'birthday'
      ? 'Wishing you a wonderful birthday and a year ahead full of joy!'
      : 'Thank you for your dedication and all you bring to the firm. Here’s to many more years together!');
    if (eventType === 'anniversary') setPhotoUrl(null);
  }, [eventType]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const c = ctx;
    ctx.clearRect(0, 0, SIZE, SIZE);

    function drawBirthdayText(textStart: number) {
      c.textAlign = 'center';
      // "Happy" in Spectral italic — elegant serif, always renders
      c.fillStyle = '#ffffff';
      c.font = `italic 600 120px 'Spectral', Georgia, serif`;
      c.fillText('Happy', SIZE / 2, textStart);
      // "BIRTHDAY" in Anton
      c.fillStyle = '#ffffff';
      c.font = `400 182px 'Anton', Impact, sans-serif`;
      c.fillText('BIRTHDAY', SIZE / 2, textStart + 185);
      // Name in gold
      c.fillStyle = '#c9a24a';
      c.font = `600 58px Georgia, serif`;
      c.fillText(name || 'NAME', SIZE / 2, textStart + 293);
      // Greeting
      c.fillStyle = 'rgba(255,255,255,0.6)';
      c.font = `26px Georgia, serif`;
      wrapText(c, greeting, SIZE / 2, 820, 42, textStart + 358);
    }

    function drawAnniversaryText(topY: number) {
      const yr = parseInt(years) || 1;
      const suffix = ordSuffix(yr);
      c.textAlign = 'center';
      // CELEBRATING
      c.fillStyle = 'rgba(255,255,255,0.4)';
      c.font = '400 28px Georgia, serif';
      c.fillText('C E L E B R A T I N G', SIZE / 2, topY);
      // Number (big, red)
      const numStr = String(yr);
      c.font = `400 260px 'Anton', Impact, sans-serif`;
      const numW = c.measureText(numStr).width;
      c.fillStyle = '#c8102e';
      c.fillText(numStr, SIZE / 2 - suffix.length * 16, topY + 260);
      // Ordinal suffix (gold, superscript)
      c.font = `400 76px 'Anton', Impact, sans-serif`;
      c.fillStyle = '#c9a24a';
      c.textAlign = 'left';
      c.fillText(suffix, SIZE / 2 - suffix.length * 16 + numW / 2 + 6, topY + 120);
      c.textAlign = 'center';
      // WORK ANNIVERSARY (below number)
      c.fillStyle = '#ffffff';
      c.font = `400 88px 'Anton', Impact, sans-serif`;
      c.fillText('WORK ANNIVERSARY', SIZE / 2, topY + 360);
      // YEARS WITH THE FIRM
      c.fillStyle = 'rgba(255,255,255,0.4)';
      c.font = '400 24px Georgia, serif';
      c.fillText('Y E A R S   W I T H   T H E   F I R M', SIZE / 2, topY + 430);
      // Name
      c.fillStyle = '#c9a24a';
      c.font = `600 58px Georgia, serif`;
      c.fillText(name || 'NAME', SIZE / 2, topY + 505);
      // Greeting
      c.fillStyle = 'rgba(255,255,255,0.6)';
      c.font = `24px Georgia, serif`;
      wrapText(c, greeting, SIZE / 2, 820, 38, topY + 565);
    }

    if (eventType === 'birthday') {
      if (photoUrl && photoLayout === 'spotlight') {
        // Spotlight: full-bleed dark photo bg, text overlay
        const img = new Image();
        img.onload = () => {
          c.save();
          c.drawImage(img, 0, 0, SIZE, SIZE);
          // dark overlay
          c.fillStyle = 'rgba(10,16,28,0.72)';
          c.fillRect(0, 0, SIZE, SIZE);
          c.restore();
          drawBackground(c); // re-draw border over photo
          // clear bg fill but keep border — redo just border
          c.strokeStyle = '#c9a24a'; c.lineWidth = 6;
          c.strokeRect(3, 3, SIZE - 6, SIZE - 6);
          drawConfetti(c); drawLitson(c); drawBalloons(c);
          drawBirthdayText(310);
        };
        img.src = photoUrl;
        return;
      }
      drawBackground(c); drawConfetti(c); drawLitson(c); drawBalloons(c);
      if (photoUrl && photoLayout === 'banner') {
        // Banner: wide rectangular strip near top
        const img = new Image();
        img.onload = () => {
          c.save();
          const bh = 220;
          const by = 110;
          ctx.beginPath();
          ctx.roundRect(60, by, SIZE - 120, bh, 12);
          ctx.clip();
          c.drawImage(img, 60, by, SIZE - 120, bh);
          c.restore();
          c.strokeStyle = '#c9a24a'; c.lineWidth = 4;
          ctx.beginPath();
          ctx.roundRect(60, by, SIZE - 120, bh, 12);
          c.stroke();
          drawBirthdayText(410);
        };
        img.src = photoUrl;
        return;
      }
      if (photoUrl && photoLayout === 'classic') {
        const img = new Image();
        img.onload = () => {
          // Photo center at 350, radius 155 → bottom edge at 509
          drawCirclePhoto(c, img, SIZE / 2, 350, 155);
          // "Happy" starts 130px below photo bottom = 509 + 130 = 639
          drawBirthdayText(639);
        };
        img.src = photoUrl;
        return;
      }
      // No photo — center text vertically
      drawBirthdayText(300);

    } else {
      // Anniversary
      if (photoUrl && photoLayout === 'spotlight') {
        const img = new Image();
        img.onload = () => {
          c.save();
          c.drawImage(img, 0, 0, SIZE, SIZE);
          c.fillStyle = 'rgba(10,16,28,0.72)';
          c.fillRect(0, 0, SIZE, SIZE);
          c.restore();
          c.strokeStyle = '#c9a24a'; c.lineWidth = 6;
          c.strokeRect(3, 3, SIZE - 6, SIZE - 6);
          drawConfetti(c); drawLitson(c); drawStars(c);
          drawAnniversaryText(240);
        };
        img.src = photoUrl;
        return;
      }
      drawBackground(c); drawConfetti(c); drawLitson(c); drawStars(c);
      if (photoUrl && photoLayout === 'banner') {
        const img = new Image();
        img.onload = () => {
          c.save();
          const bh = 200;
          const by = 105;
          ctx.beginPath();
          ctx.roundRect(60, by, SIZE - 120, bh, 12);
          ctx.clip();
          c.drawImage(img, 60, by, SIZE - 120, bh);
          c.restore();
          c.strokeStyle = '#c9a24a'; c.lineWidth = 4;
          ctx.beginPath();
          ctx.roundRect(60, by, SIZE - 120, bh, 12);
          c.stroke();
          drawAnniversaryText(380);
        };
        img.src = photoUrl;
        return;
      }
      if (photoUrl && photoLayout === 'classic') {
        const img = new Image();
        img.onload = () => {
          drawCirclePhoto(c, img, SIZE / 2, 280, 110);
          drawAnniversaryText(460);
        };
        img.src = photoUrl;
        return;
      }
      drawAnniversaryText(240);
    }
  }, [name, eventType, photoUrl, photoLayout, years, greeting]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    Promise.all([
      document.fonts.load("italic 600 120px 'Spectral'"),
      document.fonts.load("400 182px 'Anton'"),
      document.fonts.load("400 260px 'Anton'"),
      document.fonts.load("400 88px 'Anton'"),
      document.fonts.load("400 76px 'Anton'"),
      document.fonts.ready,
    ]).then(() => draw());
  }, [draw]);

  function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL(`image/${format}`, 0.95);
    a.download = `litson-${eventType}-${name.replace(/\s+/g, '-') || 'graphic'}.${format}`;
    a.click();
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="px-8 py-5 bg-white border-b border-border flex-shrink-0 flex items-center">
        <div>
          <h1 className="font-spectral text-[23px] font-semibold text-text-primary">Graphic Design</h1>
          <p className="text-sm text-text-muted mt-0.5">Birthday &amp; anniversary greetings — upload, type, download</p>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={() => setEventType('birthday')}
            className={`flex items-center gap-2 px-5 py-2 rounded-ctrl text-sm font-semibold transition-colors ${eventType === 'birthday' ? 'bg-ink text-white' : 'bg-[#f1ece3] text-text-secondary hover:bg-[#e8e3da]'}`}>
            🎂 Birthday
          </button>
          <button onClick={() => setEventType('anniversary')}
            className={`flex items-center gap-2 px-5 py-2 rounded-ctrl text-sm font-semibold transition-colors ${eventType === 'anniversary' ? 'bg-ink text-white' : 'bg-[#f1ece3] text-text-secondary hover:bg-[#e8e3da]'}`}>
            ★ Anniversary
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden flex">
        {/* Left form */}
        <div className="w-[340px] flex-shrink-0 border-r border-border bg-white overflow-auto">
          <div className="p-6 space-y-6">
            {/* Photo upload — birthday only */}
            {eventType === 'birthday' && (
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-text-muted mb-3">
                  1 · PHOTO <span className="font-normal normal-case">(optional)</span>
                </div>
                <input ref={photoRef} type="file" accept="image/*" className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) setPhotoUrl(URL.createObjectURL(f));
                    e.target.value = '';
                  }} />
                <button onClick={() => photoRef.current?.click()}
                  className="w-full border border-dashed border-border-light rounded-ctrl py-5 text-center hover:border-ink transition-colors">
                  {photoUrl
                    ? <><span className="block text-sm font-semibold text-[#2f7d5b]">↑ Photo loaded ✓ — replace</span><span className="text-xs text-text-muted">Shown as a round photo on the card</span></>
                    : <><span className="block text-sm font-semibold text-text-secondary">↑ Upload photo</span><span className="text-xs text-text-muted">Shown as a round photo on the card</span></>}
                </button>
                {photoUrl && <button onClick={() => setPhotoUrl(null)} className="mt-2 text-xs text-text-muted hover:text-litred-alt">Remove photo</button>}
              </div>
            )}

            {/* Photo layout — birthday only */}
            {eventType === 'birthday' && photoUrl && (
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2">Photo Layout</div>
                <div className="flex gap-2">
                  {(['classic','spotlight','banner'] as PhotoLayout[]).map(l => (
                    <button key={l} onClick={() => setPhotoLayout(l)}
                      className={`flex-1 py-2 rounded-ctrl text-xs font-semibold transition-colors capitalize ${photoLayout === l ? 'bg-ink text-white' : 'bg-[#f1ece3] text-text-secondary hover:bg-[#e8e3da]'}`}>
                      {l}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-text-muted mt-1.5">
                  {photoLayout === 'classic' && 'Circular photo centered above text'}
                  {photoLayout === 'spotlight' && 'Full-card photo background with dark overlay'}
                  {photoLayout === 'banner' && 'Wide photo banner strip near the top'}
                </p>
              </div>
            )}

            {/* Details */}
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-text-muted mb-3">{eventType === 'birthday' ? '2 · DETAILS' : '1 · DETAILS'}</div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1.5">Name</label>
                  <div className="relative" ref={nameBoxRef}>
                    <div className="flex">
                      <input value={name} onChange={e => { setName(e.target.value); setNameOpen(true); }} onFocus={() => setNameOpen(true)}
                        placeholder={eventType === 'birthday' ? 'e.g. Priya Raman' : 'e.g. David Thornton'}
                        className="w-full border border-border-light rounded-l-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
                      <button type="button" onClick={() => setNameOpen(o => !o)} title="Choose an employee"
                        className="border border-l-0 border-border-light rounded-r-ctrl px-2.5 bg-white text-text-muted hover:text-ink">▾</button>
                    </div>
                    {nameOpen && filteredNames.length > 0 && (
                      <div className="absolute z-20 mt-1 w-full max-h-56 overflow-auto bg-white border border-border-light rounded-ctrl shadow-lg">
                        {filteredNames.map(nm => (
                          <button key={nm} type="button" onClick={() => { setName(nm); setNameOpen(false); }}
                            className="w-full text-left px-3 py-1.5 text-sm text-text-primary hover:bg-canvas">{nm}</button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {eventType === 'anniversary' && (
                  <div>
                    <label className="block text-sm font-semibold text-text-primary mb-1.5">Years with the firm</label>
                    <input type="number" min={1} value={years} onChange={e => setYears(e.target.value)}
                      placeholder="e.g. 5"
                      className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1.5">
                    Greeting <span className="font-normal text-text-muted">(below the banner)</span>
                  </label>
                  <textarea value={greeting} onChange={e => setGreeting(e.target.value)} rows={4}
                    className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink resize-none" />
                </div>
              </div>
            </div>

            {/* Format + download */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-sm font-semibold text-text-primary">Format</span>
                {(['png','jpeg'] as const).map(f => (
                  <button key={f} onClick={() => setFormat(f)}
                    className={`px-4 py-1.5 rounded-ctrl text-sm font-semibold transition-colors ${format === f ? 'bg-ink text-white' : 'bg-[#f1ece3] text-text-secondary hover:bg-[#e8e3da]'}`}>
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>
              <button onClick={download}
                className="w-full bg-ink text-white text-sm font-semibold py-3 rounded-ctrl hover:bg-ink-dark transition-colors">
                ↓ Generate &amp; Download
              </button>
            </div>
          </div>
        </div>

        {/* Right preview */}
        <div className="flex-1 bg-canvas overflow-auto flex flex-col items-center justify-start p-8">
          <p className="text-xs text-text-muted mb-4 self-start">Live preview — this is exactly what downloads (1080×1080)</p>
          <canvas ref={canvasRef} width={SIZE} height={SIZE}
            className="w-full max-w-[480px] rounded-card shadow-card border border-border" />
        </div>
      </div>
    </div>
  );
}

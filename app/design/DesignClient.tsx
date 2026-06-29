'use client';
import { useState, useRef, useEffect, useCallback } from 'react';

type EventType = 'birthday' | 'anniversary';

const SIZE = 1080;

function ordinal(n: number): string {
  const s = ['th','st','nd','rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(' ');
  let line = '';
  for (let i = 0; i < words.length; i++) {
    const test = line + words[i] + ' ';
    if (ctx.measureText(test).width > maxWidth && i > 0) {
      ctx.fillText(line.trim(), x, y);
      line = words[i] + ' ';
      y += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line.trim(), x, y);
}

function drawSparkles(ctx: CanvasRenderingContext2D) {
  const points = [
    [90,90],[200,50],[980,80],[870,120],[50,300],[1020,250],
    [150,700],[60,500],[1010,600],[920,800],[300,30],[750,40],
    [400,1020],[650,1040],[100,950],[950,950],[500,60],[800,1010],
  ];
  ctx.fillStyle = 'rgba(201,162,74,0.55)';
  points.forEach(([px, py]) => {
    ctx.beginPath();
    ctx.arc(px, py, 2.5, 0, Math.PI * 2);
    ctx.fill();
    // cross sparkle
    ctx.fillStyle = 'rgba(201,162,74,0.35)';
    ctx.fillRect(px - 8, py - 1, 16, 2);
    ctx.fillRect(px - 1, py - 8, 2, 16);
    ctx.fillStyle = 'rgba(201,162,74,0.55)';
  });
}

function drawBalloons(ctx: CanvasRenderingContext2D) {
  // Left cluster
  const leftBalloons = [[130, 160, '#c9a24a'], [80, 200, '#e6c878'], [170, 220, '#c9a24a']];
  // Right cluster
  const rightBalloons = [[950, 160, '#c9a24a'], [1000, 200, '#e6c878'], [910, 220, '#c9a24a']];

  [...leftBalloons, ...rightBalloons].forEach(([bx, by, color]) => {
    ctx.fillStyle = color as string;
    ctx.beginPath();
    ctx.ellipse(bx as number, by as number, 38, 46, 0, 0, Math.PI * 2);
    ctx.fill();
    // balloon knot
    ctx.fillStyle = (color as string);
    ctx.beginPath();
    ctx.arc(bx as number, (by as number) + 48, 5, 0, Math.PI * 2);
    ctx.fill();
    // string
    ctx.strokeStyle = 'rgba(201,162,74,0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(bx as number, (by as number) + 53);
    ctx.quadraticCurveTo((bx as number) + 10, (by as number) + 100, bx as number, (by as number) + 140);
    ctx.stroke();
  });
}

function drawStars(ctx: CanvasRenderingContext2D) {
  const positions = [[150,160],[90,220],[1000,140],[940,200],[200,100],[870,90],[540,50]];
  positions.forEach(([sx, sy]) => {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.fillStyle = 'rgba(201,162,74,0.7)';
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
      const r = i === 0 ? 18 : 18;
      const inner = 8;
      if (i === 0) ctx.moveTo(Math.cos(-Math.PI / 2) * r, Math.sin(-Math.PI / 2) * r);
      const outerAngle = ((i * 2) * Math.PI) / 5 - Math.PI / 2;
      const innerAngle = ((i * 2 + 1) * Math.PI) / 5 - Math.PI / 2;
      ctx.lineTo(Math.cos(outerAngle) * r, Math.sin(outerAngle) * r);
      ctx.lineTo(Math.cos(innerAngle) * inner, Math.sin(innerAngle) * inner);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });
}

export default function DesignClient({ employees }: { employees: { name: string }[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const [eventType, setEventType] = useState<EventType>('birthday');
  const [name, setName] = useState('');
  const [greeting, setGreeting] = useState('Wishing you a wonderful birthday and a year ahead full of joy!');
  const [years, setYears] = useState('1');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [format, setFormat] = useState<'png' | 'jpeg'>('png');

  useEffect(() => {
    if (eventType === 'birthday') {
      setGreeting('Wishing you a wonderful birthday and a year ahead full of joy!');
    } else {
      setGreeting('Thank you for your dedication and all you bring to the firm. Here is to many more years together!');
    }
  }, [eventType]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, SIZE, SIZE);

    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, SIZE);
    bg.addColorStop(0, '#111827');
    bg.addColorStop(1, '#1b2a3d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Subtle vignette border
    const vignette = ctx.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.3, SIZE / 2, SIZE / 2, SIZE * 0.8);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, SIZE, SIZE);

    drawSparkles(ctx);

    // LITSON top label
    ctx.fillStyle = '#c9a24a';
    ctx.font = '500 32px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.letterSpacing = '6px';
    ctx.fillText('LITSON', SIZE / 2, 80);
    ctx.letterSpacing = '0px';

    if (eventType === 'birthday') {
      drawBalloons(ctx);

      // Photo circle
      const photoY = 310;
      const photoR = 140;
      if (photoUrl) {
        const img = new Image();
        img.onload = () => {
          ctx.save();
          ctx.beginPath();
          ctx.arc(SIZE / 2, photoY, photoR, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(img, SIZE / 2 - photoR, photoY - photoR, photoR * 2, photoR * 2);
          ctx.restore();
          // gold ring
          ctx.strokeStyle = '#c9a24a';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(SIZE / 2, photoY, photoR + 3, 0, Math.PI * 2);
          ctx.stroke();
          finishBirthdayText(ctx);
        };
        img.src = photoUrl;
      } else {
        finishBirthdayText(ctx);
      }
    } else {
      drawStars(ctx);

      // Photo
      const photoY = 280;
      const photoR = 120;
      if (photoUrl) {
        const img = new Image();
        img.onload = () => {
          ctx.save();
          ctx.beginPath();
          ctx.arc(SIZE / 2, photoY, photoR, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(img, SIZE / 2 - photoR, photoY - photoR, photoR * 2, photoR * 2);
          ctx.restore();
          ctx.strokeStyle = '#c9a24a';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(SIZE / 2, photoY, photoR + 3, 0, Math.PI * 2);
          ctx.stroke();
          finishAnniversaryText(ctx);
        };
        img.src = photoUrl;
      } else {
        finishAnniversaryText(ctx);
      }
    }

    function finishBirthdayText(c: CanvasRenderingContext2D) {
      const topY = photoUrl ? 540 : 380;
      // "Happy" in script
      c.fillStyle = '#ffffff';
      c.font = `96px 'Great Vibes', cursive`;
      c.textAlign = 'center';
      c.fillText('Happy', SIZE / 2, topY);
      // "BIRTHDAY" bold
      c.fillStyle = '#ffffff';
      c.font = `bold 168px 'Anton', Impact, sans-serif`;
      c.fillText('BIRTHDAY', SIZE / 2, topY + 160);
      // Name
      c.fillStyle = '#c9a24a';
      c.font = `bold 64px Georgia, serif`;
      c.fillText(name || 'NAME', SIZE / 2, topY + 270);
      // Greeting
      c.fillStyle = 'rgba(255,255,255,0.65)';
      c.font = `28px Georgia, serif`;
      wrapText(c, greeting, SIZE / 2, topY + 340, 780, 44);
    }

    function finishAnniversaryText(c: CanvasRenderingContext2D) {
      const topY = photoUrl ? 470 : 340;
      c.fillStyle = 'rgba(255,255,255,0.45)';
      c.font = '500 28px Georgia, serif';
      c.textAlign = 'center';
      c.fillText('C E L E B R A T I N G', SIZE / 2, topY);
      // WORK ANNIVERSARY
      c.fillStyle = '#ffffff';
      c.font = `bold 110px 'Anton', Impact, sans-serif`;
      c.fillText('WORK ANNIVERSARY', SIZE / 2, topY + 120);
      // Year number — large red
      const yr = parseInt(years) || 1;
      c.fillStyle = '#c8102e';
      c.font = `bold 260px 'Anton', Impact, sans-serif`;
      c.fillText(String(yr), SIZE / 2, topY + 410);
      // ordinal suffix
      c.fillStyle = '#c8102e';
      c.font = `bold 60px 'Anton', Impact, sans-serif`;
      c.textAlign = 'left';
      const numWidth = c.measureText(String(yr)).width;
      // suffix positioned top-right of the number
      c.font = `bold 72px 'Anton', Impact, sans-serif`;
      c.fillStyle = '#c8102e';
      c.textAlign = 'center';
      // rewrite with ordinal as single string
      c.font = `bold 260px 'Anton', Impact, sans-serif`;
      // (already drawn, skip redraw — just label suffix small)
      c.fillStyle = '#c9a24a';
      c.font = `bold 44px Georgia, serif`;
      c.textAlign = 'center';
      c.fillText(ordinal(yr).replace(String(yr), '').toUpperCase(), SIZE / 2 + numWidth / 2 - 30, topY + 280);
      // YEARS WITH THE FIRM
      c.fillStyle = 'rgba(255,255,255,0.45)';
      c.font = '500 28px Georgia, serif';
      c.fillText('Y E A R S  W I T H  T H E  F I R M', SIZE / 2, topY + 470);
      // Name
      c.fillStyle = '#c9a24a';
      c.font = `bold 64px Georgia, serif`;
      c.fillText(name || 'NAME', SIZE / 2, topY + 550);
      // Greeting
      c.fillStyle = 'rgba(255,255,255,0.65)';
      c.font = `26px Georgia, serif`;
      wrapText(c, greeting, SIZE / 2, topY + 620, 780, 42);
    }
  }, [name, eventType, photoUrl, years, greeting]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.fonts.ready.then(() => draw());
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

      <div className="flex-1 overflow-auto">
        <div className="flex h-full">
          {/* Left form panel */}
          <div className="w-[340px] flex-shrink-0 border-r border-border bg-white overflow-auto">
            <div className="p-6 space-y-6">
              {/* Step 1 */}
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-text-muted mb-3">1 · PHOTO <span className="font-normal normal-case">(optional)</span></div>
                <input ref={photoRef} type="file" accept="image/*" className="hidden"
                  onChange={e => e.target.files?.[0] && setPhotoUrl(URL.createObjectURL(e.target.files[0]))} />
                <button onClick={() => photoRef.current?.click()}
                  className="w-full border border-dashed border-border-light rounded-ctrl py-5 text-sm text-text-muted hover:border-ink hover:text-text-primary transition-colors text-center">
                  {photoUrl ? <><span className="block font-semibold text-[#2f7d5b]">✓ Photo uploaded</span><span className="text-xs">Click to change</span></> : <><span className="block font-semibold">↑ Upload photo</span><span className="text-xs">Shown as a round photo on the card</span></>}
                </button>
                {photoUrl && <button onClick={() => setPhotoUrl(null)} className="mt-2 text-xs text-text-muted hover:text-litred-alt">Remove photo</button>}
              </div>

              {/* Step 2 */}
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-text-muted mb-3">2 · DETAILS</div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-text-primary mb-1.5">Name</label>
                    <input list="emp-names" value={name} onChange={e => setName(e.target.value)}
                      placeholder={eventType === 'birthday' ? 'e.g. Priya Raman' : 'e.g. David Thornton'}
                      className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
                    <datalist id="emp-names">
                      {employees.map(e => <option key={e.name} value={e.name} />)}
                    </datalist>
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
                    <label className="block text-sm font-semibold text-text-primary mb-1.5">Greeting <span className="font-normal text-text-muted">(below the banner)</span></label>
                    <textarea value={greeting} onChange={e => setGreeting(e.target.value)} rows={4}
                      className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink resize-none" />
                  </div>
                </div>
              </div>

              {/* Format + Download */}
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

          {/* Right preview panel */}
          <div className="flex-1 bg-canvas overflow-auto flex flex-col items-center justify-start p-8">
            <p className="text-xs text-text-muted mb-4 self-start">Live preview — this is exactly what downloads (1080×1080)</p>
            <canvas
              ref={canvasRef}
              width={SIZE}
              height={SIZE}
              className="w-full max-w-[480px] rounded-card shadow-card border border-border"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

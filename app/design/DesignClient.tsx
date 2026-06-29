'use client';
import { useState, useRef, useEffect, useCallback } from 'react';

type EventType = 'birthday' | 'anniversary';
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
  // Dark navy gradient
  const bg = ctx.createLinearGradient(0, 0, 0, SIZE);
  bg.addColorStop(0, '#0e1520');
  bg.addColorStop(1, '#192233');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SIZE, SIZE);
  // Thin gold border
  ctx.strokeStyle = '#c9a24a';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, SIZE - 6, SIZE - 6);
  // Scattered sparkle dots
  const sparks: [number, number][] = [
    [70,70],[180,45],[260,90],[820,55],[940,70],[1010,130],
    [50,200],[1020,220],[55,500],[1020,480],[60,800],[1010,760],
    [150,980],[380,1020],[700,1035],[940,1010],[500,40],[620,1040],
    [300,60],[750,50],[400,980],[700,60],
  ];
  sparks.forEach(([sx, sy]) => {
    ctx.fillStyle = 'rgba(201,162,74,0.5)';
    ctx.beginPath();
    ctx.arc(sx, sy, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(201,162,74,0.25)';
    ctx.fillRect(sx - 10, sy - 1.5, 20, 3);
    ctx.fillRect(sx - 1.5, sy - 10, 3, 20);
  });
}

function drawLitson(ctx: CanvasRenderingContext2D) {
  ctx.textAlign = 'center';
  ctx.fillStyle = '#c9a24a';
  ctx.font = '600 30px Georgia, serif';
  // letter-spacing via manual positioning
  const letters = 'LITSON'.split('');
  const spacing = 10;
  const totalW = letters.length * 18 + (letters.length - 1) * spacing;
  let lx = SIZE / 2 - totalW / 2 + 9;
  letters.forEach(l => {
    ctx.fillText(l, lx, 75);
    lx += 18 + spacing;
  });
}

function drawBalloons(ctx: CanvasRenderingContext2D) {
  // Each balloon: [cx, cy, rx, ry, color]
  const balloons: [number, number, number, number, string][] = [
    // Left cluster
    [110, 175, 36, 44, '#c9a24a'],
    [155, 145, 32, 40, '#e6c878'],
    [195, 170, 34, 42, '#c8102e'],
    // Right cluster
    [885, 175, 36, 44, '#c9a24a'],
    [930, 145, 32, 40, '#e6c878'],
    [970, 170, 34, 42, '#c8102e'],
  ];
  balloons.forEach(([cx, cy, rx, ry, color]) => {
    // Balloon body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.ellipse(cx - rx * 0.25, cy - ry * 0.25, rx * 0.35, ry * 0.3, -0.3, 0, Math.PI * 2);
    ctx.fill();
    // Knot
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy + ry + 4, 5, 0, Math.PI * 2);
    ctx.fill();
    // String
    ctx.strokeStyle = 'rgba(201,162,74,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy + ry + 9);
    ctx.quadraticCurveTo(cx + 12, cy + ry + 60, cx - 5, cy + ry + 120);
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
  star(120, 155, 22, 0.9);
  star(165, 120, 16, 0.7);
  star(95, 115, 12, 0.5);
  star(960, 155, 22, 0.9);
  star(915, 120, 16, 0.7);
  star(985, 115, 12, 0.5);
  star(540, 45, 14, 0.5);
  star(300, 50, 10, 0.4);
  star(780, 50, 10, 0.4);
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
    setGreeting(eventType === 'birthday'
      ? 'Wishing you a wonderful birthday and a year ahead full of joy!'
      : 'Thank you for your dedication and all you bring to the firm. Here is to many more years together!');
  }, [eventType]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const c = ctx;
    ctx.clearRect(0, 0, SIZE, SIZE);
    drawBackground(ctx);
    drawLitson(ctx);

    if (eventType === 'birthday') {
      drawBalloons(ctx);
      const hasPhoto = !!photoUrl;
      const photoR = 130;
      const photoY = 330;

      function finishBirthday() {
        const textStart = hasPhoto ? photoY + photoR + 60 : 320;
        c.textAlign = 'center';
        c.fillStyle = '#ffffff';
        c.font = `italic 110px 'Great Vibes', cursive`;
        c.fillText('Happy', SIZE / 2, textStart);
        c.fillStyle = '#ffffff';
        c.font = `bold 160px 'Anton', Impact, sans-serif`;
        c.fillText('BIRTHDAY', SIZE / 2, textStart + 155);
        c.fillStyle = '#c9a24a';
        c.font = `bold 58px Georgia, serif`;
        c.fillText(name || 'NAME', SIZE / 2, textStart + 260);
        c.fillStyle = 'rgba(255,255,255,0.6)';
        c.font = `26px Georgia, serif`;
        wrapText(c, greeting, SIZE / 2, 800, 40, textStart + 325);
      }

      if (photoUrl) {
        const img = new Image();
        img.onload = () => {
          c.save();
          c.beginPath();
          c.arc(SIZE / 2, photoY, photoR, 0, Math.PI * 2);
          c.clip();
          c.drawImage(img, SIZE / 2 - photoR, photoY - photoR, photoR * 2, photoR * 2);
          c.restore();
          c.strokeStyle = '#c9a24a';
          c.lineWidth = 5;
          c.beginPath();
          c.arc(SIZE / 2, photoY, photoR + 4, 0, Math.PI * 2);
          c.stroke();
          finishBirthday();
        };
        img.src = photoUrl;
      } else { finishBirthday(); }

    } else {
      // Anniversary
      drawStars(ctx);
      const hasPhoto = !!photoUrl;
      const photoR = 110;
      const photoY = 270;

      function finishAnniversary() {
        const topY = hasPhoto ? photoY + photoR + 50 : 240;
        const yr = parseInt(years) || 1;
        const suffix = ordSuffix(yr);

        c.textAlign = 'center';
        c.fillStyle = 'rgba(255,255,255,0.4)';
        c.font = '500 26px Georgia, serif';
        const cel = 'CELEBRATING'.split('');
        let cx2 = SIZE / 2 - (cel.length * 14) / 2;
        cel.forEach(l => { c.fillText(l, cx2, topY); cx2 += 14; });

        c.fillStyle = '#ffffff';
        c.font = `bold 96px 'Anton', Impact, sans-serif`;
        c.fillText('WORK ANNIVERSARY', SIZE / 2, topY + 100);

        const numStr = String(yr);
        c.font = `bold 280px 'Anton', Impact, sans-serif`;
        const numW = c.measureText(numStr).width;
        c.fillStyle = '#c8102e';
        c.fillText(numStr, SIZE / 2 - suffix.length * 18, topY + 390);

        c.font = `bold 80px 'Anton', Impact, sans-serif`;
        c.fillStyle = '#c9a24a';
        c.textAlign = 'left';
        c.fillText(suffix, SIZE / 2 - suffix.length * 18 + numW / 2 + 8, topY + 250);

        c.textAlign = 'center';
        c.fillStyle = 'rgba(255,255,255,0.4)';
        c.font = '500 22px Georgia, serif';
        const ytf = 'YEARS WITH THE FIRM'.split('');
        let yx = SIZE / 2 - (ytf.length * 11) / 2;
        ytf.forEach(l => { c.fillText(l, yx, topY + 450); yx += 11; });

        c.textAlign = 'center';
        c.fillStyle = '#c9a24a';
        c.font = `bold 60px Georgia, serif`;
        c.fillText(name || 'NAME', SIZE / 2, topY + 530);

        c.fillStyle = 'rgba(255,255,255,0.6)';
        c.font = `24px Georgia, serif`;
        wrapText(c, greeting, SIZE / 2, 820, 38, topY + 595);
      }

      if (photoUrl) {
        const img = new Image();
        img.onload = () => {
          c.save();
          c.beginPath();
          c.arc(SIZE / 2, photoY, photoR, 0, Math.PI * 2);
          c.clip();
          c.drawImage(img, SIZE / 2 - photoR, photoY - photoR, photoR * 2, photoR * 2);
          c.restore();
          c.strokeStyle = '#c9a24a';
          c.lineWidth = 5;
          c.beginPath();
          c.arc(SIZE / 2, photoY, photoR + 4, 0, Math.PI * 2);
          c.stroke();
          finishAnniversary();
        };
        img.src = photoUrl;
      } else { finishAnniversary(); }
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

      <div className="flex-1 overflow-hidden flex">
        {/* Left form */}
        <div className="w-[340px] flex-shrink-0 border-r border-border bg-white overflow-auto">
          <div className="p-6 space-y-6">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-text-muted mb-3">
                1 · PHOTO <span className="font-normal normal-case">(optional)</span>
              </div>
              <input ref={photoRef} type="file" accept="image/*" className="hidden"
                onChange={e => e.target.files?.[0] && setPhotoUrl(URL.createObjectURL(e.target.files[0]))} />
              <button onClick={() => photoRef.current?.click()}
                className="w-full border border-dashed border-border-light rounded-ctrl py-5 text-center hover:border-ink transition-colors">
                {photoUrl
                  ? <><span className="block text-sm font-semibold text-[#2f7d5b]">✓ Photo uploaded</span><span className="text-xs text-text-muted">Click to change</span></>
                  : <><span className="block text-sm font-semibold text-text-secondary">↑ Upload photo</span><span className="text-xs text-text-muted">Shown as a round photo on the card</span></>}
              </button>
              {photoUrl && <button onClick={() => setPhotoUrl(null)} className="mt-2 text-xs text-text-muted hover:text-litred-alt">Remove photo</button>}
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-text-muted mb-3">2 · DETAILS</div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1.5">Name</label>
                  <input list="emp-names" value={name} onChange={e => setName(e.target.value)}
                    placeholder={eventType === 'birthday' ? 'e.g. Priya Raman' : 'e.g. David Thornton'}
                    className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
                  <datalist id="emp-names">{employees.map(e => <option key={e.name} value={e.name} />)}</datalist>
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

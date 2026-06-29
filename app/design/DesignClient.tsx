'use client';
import { useState, useRef, useEffect, useCallback } from 'react';

type Layout = 'classic' | 'spotlight' | 'banner';
type EventType = 'birthday' | 'anniversary';

const SIZE = 1080;

interface DesignClientProps { employees: { name: string; birthday: string | null }[]; }

export default function DesignClient({ employees }: DesignClientProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [layout, setLayout] = useState<Layout>('classic');
  const [eventType, setEventType] = useState<EventType>('birthday');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [years, setYears] = useState('');

  function handlePhoto(file: File) {
    const url = URL.createObjectURL(file);
    setPhotoUrl(url);
  }

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, SIZE, SIZE);

    const label = eventType === 'birthday' ? '🎂 Happy Birthday!' : `🎉 ${years ? years + '-Year ' : ''}Work Anniversary!`;
    const subLabel = eventType === 'birthday' ? 'Wishing you a wonderful day!' : 'Thank you for your dedication to Litson, PLLC!';

    if (layout === 'classic') {
      // Navy gradient bg
      const grad = ctx.createLinearGradient(0, 0, 0, SIZE);
      grad.addColorStop(0, '#1b2a3d');
      grad.addColorStop(1, '#213044');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, SIZE, SIZE);

      // Gold accent bar
      ctx.fillStyle = '#c9a24a';
      ctx.fillRect(0, SIZE - 8, SIZE, 8);

      // Photo circle
      if (photoUrl) {
        const img = new Image();
        img.onload = () => {
          ctx.save();
          ctx.beginPath();
          ctx.arc(SIZE / 2, 340, 180, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(img, SIZE / 2 - 180, 160, 360, 360);
          ctx.restore();
          drawText(ctx, name, label, subLabel, layout);
        };
        img.src = photoUrl;
      } else {
        // Placeholder circle
        ctx.fillStyle = 'rgba(201,162,74,0.2)';
        ctx.beginPath();
        ctx.arc(SIZE / 2, 340, 180, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#c9a24a';
        ctx.lineWidth = 3;
        ctx.stroke();
        drawText(ctx, name, label, subLabel, layout);
      }
    } else if (layout === 'spotlight') {
      ctx.fillStyle = '#f4f1ec';
      ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.fillStyle = '#213044';
      ctx.fillRect(0, 0, SIZE, 120);
      ctx.fillStyle = '#c9a24a';
      ctx.fillRect(0, 116, SIZE, 4);

      if (photoUrl) {
        const img = new Image();
        img.onload = () => {
          ctx.save();
          ctx.beginPath();
          ctx.arc(SIZE / 2, 380, 200, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(img, SIZE / 2 - 200, 180, 400, 400);
          ctx.restore();
          drawText(ctx, name, label, subLabel, layout);
        };
        img.src = photoUrl;
      } else {
        ctx.fillStyle = '#e8e3da';
        ctx.beginPath();
        ctx.arc(SIZE / 2, 380, 200, 0, Math.PI * 2);
        ctx.fill();
        drawText(ctx, name, label, subLabel, layout);
      }
    } else {
      // Banner layout
      const grad = ctx.createLinearGradient(0, 0, SIZE, 0);
      grad.addColorStop(0, '#213044');
      grad.addColorStop(0.5, '#26405c');
      grad.addColorStop(1, '#213044');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.fillStyle = '#c9a24a';
      ctx.fillRect(0, 0, 6, SIZE);
      ctx.fillRect(SIZE - 6, 0, 6, SIZE);

      if (photoUrl) {
        const img = new Image();
        img.onload = () => {
          ctx.save();
          ctx.beginPath();
          ctx.arc(200, SIZE / 2, 160, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(img, 40, SIZE / 2 - 160, 320, 320);
          ctx.restore();
          drawText(ctx, name, label, subLabel, layout);
        };
        img.src = photoUrl;
      } else {
        ctx.fillStyle = 'rgba(201,162,74,0.15)';
        ctx.beginPath();
        ctx.arc(200, SIZE / 2, 160, 0, Math.PI * 2);
        ctx.fill();
        drawText(ctx, name, label, subLabel, layout);
      }
    }
  }, [name, layout, eventType, photoUrl, years]);

  function drawText(ctx: CanvasRenderingContext2D, name: string, label: string, sub: string, layout: Layout) {
    if (layout === 'classic') {
      ctx.fillStyle = '#c9a24a';
      ctx.font = `bold 52px Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.fillText(label, SIZE / 2, 600);
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold 68px Georgia, serif`;
      ctx.fillText(name || 'Employee Name', SIZE / 2, 680);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = `28px Georgia, serif`;
      ctx.fillText(sub, SIZE / 2, 730);
      ctx.fillStyle = '#c9a24a';
      ctx.font = `italic 24px Georgia, serif`;
      ctx.fillText('Litson, PLLC', SIZE / 2, 980);
    } else if (layout === 'spotlight') {
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold 40px Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.fillText('LITSON, PLLC', SIZE / 2, 75);
      ctx.fillStyle = '#213044';
      ctx.font = `bold 64px Georgia, serif`;
      ctx.fillText(name || 'Employee Name', SIZE / 2, 680);
      ctx.fillStyle = '#c9a24a';
      ctx.font = `bold 44px Georgia, serif`;
      ctx.fillText(label, SIZE / 2, 750);
      ctx.fillStyle = '#8b8478';
      ctx.font = `28px Georgia, serif`;
      ctx.fillText(sub, SIZE / 2, 800);
    } else {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#c9a24a';
      ctx.font = `bold 48px Georgia, serif`;
      ctx.fillText(label, 420, SIZE / 2 - 60);
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold 64px Georgia, serif`;
      ctx.fillText(name || 'Employee Name', 420, SIZE / 2 + 20);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = `28px Georgia, serif`;
      ctx.fillText(sub, 420, SIZE / 2 + 80);
      ctx.fillStyle = '#c9a24a';
      ctx.font = `italic 22px Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.fillText('Litson, PLLC', SIZE / 2, SIZE - 40);
    }
  }

  useEffect(() => { draw(); }, [draw]);

  function download(format: 'png' | 'jpeg') {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL(`image/${format}`, 0.95);
    a.download = `litson-${eventType}-${name.replace(/\s+/g, '-') || 'graphic'}.${format}`;
    a.click();
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="px-8 py-5 bg-white border-b border-border flex-shrink-0">
        <h1 className="font-spectral text-[23px] font-semibold text-text-primary">Graphic Design</h1>
        <p className="text-sm text-text-muted mt-0.5">Generate birthday & anniversary graphics for staff</p>
      </header>
      <div className="flex-1 overflow-auto p-6">
        <div className="flex gap-6 max-w-5xl">
          {/* Controls */}
          <div className="w-72 flex-shrink-0 space-y-4">
            <div className="bg-white border border-border rounded-card p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Event Type</label>
                <div className="flex gap-2">
                  {(['birthday','anniversary'] as EventType[]).map(t => (
                    <button key={t} onClick={() => setEventType(t)}
                      className={`flex-1 text-sm font-semibold py-2 rounded-ctrl transition-colors ${eventType === t ? 'bg-ink text-white' : 'bg-[#f1ece3] text-text-secondary hover:bg-[#e8e3da]'}`}>
                      {t === 'birthday' ? 'Birthday' : 'Anniversary'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Employee Name</label>
                <input list="emp-names" value={name} onChange={e => setName(e.target.value)} placeholder="Type or select…"
                  className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
                <datalist id="emp-names">
                  {employees.map(e => <option key={e.name} value={e.name} />)}
                </datalist>
              </div>

              {eventType === 'anniversary' && (
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Years</label>
                  <input type="number" min={1} value={years} onChange={e => setYears(e.target.value)}
                    className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-2">Layout</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['classic','spotlight','banner'] as Layout[]).map(l => (
                    <button key={l} onClick={() => setLayout(l)}
                      className={`text-xs font-semibold py-2 rounded-ctrl capitalize transition-colors ${layout === l ? 'bg-ink text-white' : 'bg-[#f1ece3] text-text-secondary hover:bg-[#e8e3da]'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handlePhoto(e.target.files[0])} />
                <button onClick={() => photoRef.current?.click()}
                  className="w-full text-sm font-semibold border border-border-light px-3 py-2 rounded-ctrl hover:bg-canvas text-left">
                  {photoUrl ? '✓ Photo uploaded' : '↑ Upload Photo'}
                </button>
                {photoUrl && <button onClick={() => setPhotoUrl(null)} className="mt-1 text-xs text-text-muted hover:text-text-primary">Remove photo</button>}
              </div>
            </div>

            <div className="bg-white border border-border rounded-card p-4 space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-gold-muted mb-2">Download</div>
              <button onClick={() => download('png')} className="w-full bg-ink text-white text-sm font-semibold py-2.5 rounded-ctrl hover:bg-ink-dark">↓ PNG (1080×1080)</button>
              <button onClick={() => download('jpeg')} className="w-full bg-white border border-border-light text-ink text-sm font-semibold py-2.5 rounded-ctrl hover:bg-canvas">↓ JPEG</button>
            </div>
          </div>

          {/* Canvas preview */}
          <div className="flex-1">
            <canvas
              ref={canvasRef}
              width={SIZE}
              height={SIZE}
              className="w-full max-w-[540px] border border-border rounded-card shadow-card"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

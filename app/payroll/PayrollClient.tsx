'use client';
import { useState } from 'react';
import { useToast } from '@/components/Toast';

interface Period { id: string; period: string; run_date: string; cutoff: string; status: string; }
interface Settings { id: string; cadence: string; reminder_toggles: string; }

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} className={`relative w-11 h-6 rounded-full transition-colors ${on ? 'bg-[#2f7d5b]' : 'bg-[#d8d1c4]'}`}>
      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${on ? 'left-6' : 'left-1'}`} />
    </button>
  );
}

export default function PayrollClient({ initialPeriods, initialSettings }: { initialPeriods: Period[]; initialSettings: Settings }) {
  const { showToast } = useToast();
  const [periods] = useState<Period[]>(initialPeriods);
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [saving, setSaving] = useState(false);

  const nextPeriod = periods.find(p => p.status === 'Upcoming') ?? periods[0];
  const nextDate = nextPeriod?.run_date ? new Date(nextPeriod.run_date) : null;
  const cutoffDate = nextPeriod?.cutoff ? new Date(nextPeriod.cutoff) : null;
  const today = new Date();
  const daysLeft = nextDate ? Math.ceil((nextDate.getTime() - today.getTime()) / 86400000) : null;
  const cutoffToday = cutoffDate ? cutoffDate.toDateString() === today.toDateString() : false;

  const toggles = JSON.parse(settings?.reminder_toggles ?? '{"cutoff":true,"payrun":true,"timesheet":false}');

  async function saveToggles(patch: object) {
    setSaving(true);
    const res = await fetch('/api/payroll', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reminderToggles: patch }) });
    const data = await res.json();
    setSettings(data.settings);
    setSaving(false);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="flex items-center px-8 py-5 bg-white border-b border-border flex-shrink-0">
        <div>
          <h1 className="font-spectral text-[23px] font-semibold text-text-primary">Payroll Schedule &amp; Reminders</h1>
          <p className="text-sm text-text-muted mt-0.5">{settings?.cadence ?? 'Semi-monthly'} · administered via ADP</p>
        </div>
        <button onClick={() => showToast('Reminder sent (connect Microsoft 365 to deliver)')}
          className="ml-auto bg-ink text-white text-sm font-semibold px-5 py-2.5 rounded-ctrl hover:bg-ink-dark transition-colors">
          Send reminder now
        </button>
      </header>

      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="grid grid-cols-[320px_1fr] gap-6 mb-6">
          {/* Next payroll hero */}
          <div className="bg-ink rounded-card p-6 text-white">
            <div className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-3">NEXT PAYROLL RUN</div>
            {nextDate ? (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div className="font-spectral leading-tight">
                    <div className="text-2xl text-white/80">{nextDate.toLocaleDateString('en-US', { month: 'long' })}</div>
                    <div className="text-6xl font-semibold">{nextDate.getDate()},</div>
                    <div className="text-4xl font-semibold text-white/70">{nextDate.getFullYear()}</div>
                  </div>
                  <span className="text-xs font-semibold bg-white/15 px-2.5 py-1 rounded-full shrink-0">
                    {daysLeft === 0 ? 'Today' : daysLeft === 1 ? 'in 1 day' : `in ${daysLeft} days`}
                  </span>
                </div>
                {cutoffDate && (
                  <div className={`mt-4 rounded-ctrl p-3 text-sm font-semibold ${cutoffToday ? 'bg-[#c9a24a]/20 border border-[#c9a24a]/30' : 'bg-white/10'}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-[#c9a24a]">⚑</span>
                      <div>
                        <div className={cutoffToday ? 'text-[#c9a24a]' : 'text-white/80'}>
                          Submission cutoff{cutoffToday ? ' today' : ''}, 5:00 PM
                        </div>
                        {!cutoffToday && <div className="text-xs text-white/40 font-normal">{cutoffDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>}
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-white/50">No upcoming periods</div>
            )}
          </div>

          {/* Reminders */}
          <div className="bg-white border border-border rounded-card p-6">
            <div className="text-[10px] font-bold uppercase tracking-widest text-gold-muted mb-5">REMINDERS</div>
            <div className="space-y-5">
              {[
                { key: 'cutoff', label: 'Payroll cutoff reminder', sub: '9:00 AM on cutoff day' },
                { key: 'payrun', label: 'Pay run confirmation', sub: 'Morning of each run' },
                { key: 'timesheet', label: 'Timesheet nudge', sub: '2 days before cutoff' },
              ].map(({ key, label, sub }) => (
                <div key={key} className="flex items-center justify-between gap-4 py-3 border-b border-[#f1ece3] last:border-0 last:pb-0">
                  <div>
                    <div className="text-sm font-semibold text-text-primary">{label}</div>
                    <div className="text-xs text-text-muted mt-0.5">{sub}</div>
                  </div>
                  <Toggle on={Boolean(toggles[key])} onChange={v => saveToggles({ ...toggles, [key]: v })} />
                </div>
              ))}
            </div>
            {saving && <p className="text-xs text-text-muted mt-3">Saving…</p>}
          </div>
        </div>

        {/* Upcoming pay periods */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-gold-muted mb-4">UPCOMING PAY PERIODS</div>
          <div className="space-y-3">
            {periods.map(p => {
              const runDate = new Date(p.run_date);
              const cutDate = new Date(p.cutoff);
              const isCutoffToday = cutDate.toDateString() === today.toDateString();
              return (
                <div key={p.id} className="bg-white border border-border rounded-card px-5 py-4 flex items-center gap-6">
                  <div className="w-24 shrink-0">
                    <div className="font-spectral text-xl font-semibold text-text-primary">
                      {runDate.toLocaleDateString('en-US', { month: 'long' })}
                    </div>
                    <div className="font-spectral text-2xl font-semibold text-text-primary leading-tight">{runDate.getDate()},</div>
                    <div className="font-spectral text-lg text-text-muted">{runDate.getFullYear()}</div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-text-muted">
                    <span className={`w-2 h-2 rounded-full ${p.status === 'Processed' ? 'bg-[#2f7d5b]' : p.status === 'Upcoming' ? 'bg-[#c9a24a]' : 'bg-[#d8d1c4]'}`} />
                    Cutoff {cutDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                  <div className="text-xs text-text-muted">Period {p.period}</div>
                  {isCutoffToday && <span className="ml-auto text-xs font-semibold bg-[#f7efe1] text-[#b07d2a] px-3 py-1 rounded-full">Cutoff today</span>}
                  {p.status === 'Processed' && !isCutoffToday && <span className="ml-auto text-xs font-semibold bg-[#eef5f1] text-[#2f7d5b] px-3 py-1 rounded-full">Processed</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';
import { useState } from 'react';
import { useToast } from '@/components/Toast';

interface Period { id: string; period: string; run_date: string; cutoff: string; status: string; }
interface Settings { id: string; cadence: string; reminder_toggles: string; }

export default function PayrollClient({ initialPeriods, initialSettings }: { initialPeriods: Period[]; initialSettings: Settings }) {
  const { showToast } = useToast();
  const [periods] = useState<Period[]>(initialPeriods);
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [saving, setSaving] = useState(false);

  const nextPeriod = periods.find(p => p.status === 'Upcoming') ?? periods[0];
  const nextDate = nextPeriod?.run_date ? new Date(nextPeriod.run_date) : null;
  const today = new Date();
  const daysLeft = nextDate ? Math.ceil((nextDate.getTime() - today.getTime()) / 86400000) : null;

  const toggles = JSON.parse(settings?.reminder_toggles ?? '{"cutoff":true,"payrun":true,"timesheet":false}');

  async function saveSettings(patch: Partial<{ cadence: string; reminderToggles: object }>) {
    setSaving(true);
    const res = await fetch('/api/payroll', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
    const data = await res.json();
    setSettings(data.settings);
    showToast('Settings saved');
    setSaving(false);
  }

  async function sendReminder() {
    showToast('Payroll reminder sent (connect Microsoft 365 to email)');
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="px-8 py-5 bg-white border-b border-border flex-shrink-0">
        <h1 className="font-spectral text-[23px] font-semibold text-text-primary">Payroll</h1>
        <p className="text-sm text-text-muted mt-0.5">Track pay periods and manage payroll reminders</p>
      </header>
      <div className="flex-1 overflow-auto p-8">
        <div className="grid grid-cols-3 gap-5 mb-8">
          {/* Next run hero */}
          <div className="col-span-1 bg-ink text-white rounded-card p-6">
            <div className="text-xs font-bold uppercase tracking-wider text-white/60 mb-1">Next Payroll Run</div>
            {daysLeft !== null && nextDate ? (
              <>
                <div className="text-4xl font-spectral font-semibold mt-2">{daysLeft > 0 ? daysLeft + 'd' : 'Today'}</div>
                <div className="text-sm text-white/70 mt-1">{nextDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
                {nextPeriod?.cutoff && <div className="text-xs text-white/50 mt-1">Cutoff: {nextPeriod.cutoff}</div>}
              </>
            ) : (
              <div className="text-sm text-white/60 mt-2">No upcoming periods</div>
            )}
            <button onClick={sendReminder} className="mt-4 text-xs font-semibold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-ctrl transition-colors">
              Send Reminder
            </button>
          </div>

          {/* Settings */}
          <div className="col-span-2 bg-white border border-border rounded-card p-6">
            <div className="text-xs font-bold uppercase tracking-wider text-gold-muted mb-4">Payroll Settings</div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Cadence</label>
                <select value={settings?.cadence ?? 'Semi-monthly'}
                  onChange={e => saveSettings({ cadence: e.target.value })}
                  className="border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink bg-white">
                  {['Weekly','Bi-weekly','Semi-monthly','Monthly'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-semibold text-text-secondary">Email Reminders</div>
                {(['cutoff','payrun','timesheet'] as const).map(key => (
                  <label key={key} className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                    <input type="checkbox" checked={Boolean(toggles[key])}
                      onChange={e => saveSettings({ reminderToggles: { ...toggles, [key]: e.target.checked } })}
                      className="w-4 h-4 rounded" />
                    {key === 'cutoff' ? 'Timesheet cutoff reminder' : key === 'payrun' ? 'Pay run day reminder' : 'Timesheet submission reminder'}
                  </label>
                ))}
              </div>
            </div>
            {saving && <p className="text-xs text-text-muted mt-3">Saving…</p>}
          </div>
        </div>

        {/* Pay periods table */}
        <div className="bg-white border border-border rounded-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border">
            <span className="text-xs font-bold uppercase tracking-wider text-gold-muted">Pay Period Schedule</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-[#f1ece3] border-b border-border">
              <tr>{['Period','Cutoff Date','Run Date','Status'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-text-secondary">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {periods.map(p => (
                <tr key={p.id} className="border-t border-[#f1ece3]">
                  <td className="px-4 py-3 font-medium text-text-primary">{p.period}</td>
                  <td className="px-4 py-3 text-text-secondary">{p.cutoff}</td>
                  <td className="px-4 py-3 text-text-secondary">{p.run_date}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      p.status === 'Processed' ? 'bg-[#eef5f1] text-[#2f7d5b]' :
                      p.status === 'Upcoming' ? 'bg-[#e9f0f5] text-[#3f6b8a]' :
                      'bg-[#f7efe1] text-[#b07d2a]'}`}>{p.status}</span>
                  </td>
                </tr>
              ))}
              {periods.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-text-muted">No pay periods yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

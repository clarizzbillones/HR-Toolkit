'use client';
import { useState } from 'react';
import CoachingClient from './CoachingClient';
import SmartGoalsClient from '../smart-goals/SmartGoalsClient';
import type { SmartGoalsRow } from '@/lib/smartGoals';

// The Coaching module has two tabs: the coaching forms, and the (separate,
// structured) SMART Goals forms — both live under the Coaching sidebar entry.
export default function CoachingModule({ coachingRows, staff, smartRows }: {
  coachingRows: any[]; staff: { name: string; position: string; email: string }[]; smartRows: SmartGoalsRow[];
}) {
  const [tab, setTab] = useState<'coaching' | 'smart'>('coaching');
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-8 pt-3 bg-white border-b border-border flex items-center gap-1 flex-shrink-0">
        {([['coaching', 'Coaching forms'], ['smart', 'SMART Goals']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`text-sm font-semibold px-4 py-2 rounded-t-ctrl border-b-2 transition-colors ${tab === k ? 'border-ink text-ink' : 'border-transparent text-text-muted hover:text-text-primary'}`}>{l}</button>
        ))}
      </div>
      <div className="flex-1 min-h-0">
        {tab === 'coaching'
          ? <CoachingClient initialRows={coachingRows} staff={staff} />
          : <SmartGoalsClient initialRows={smartRows} staff={staff} />}
      </div>
    </div>
  );
}

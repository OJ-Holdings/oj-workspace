'use client';

import { useState } from 'react';
import { loadJobTimeline, type JobEvent } from '@/app/workspace/exterior-actions';

const when = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' });

/** Who changed what on this job, and when. Loads the first time it is opened. Live workspace only. */
export function JobTimeline({ org, leadId, live }: { org: string; leadId: string; live: boolean }) {
  const [events, setEvents] = useState<JobEvent[] | null>(null);
  const [problem, setProblem] = useState('');
  if (!live) return null;
  const open = async (isOpen: boolean) => {
    if (!isOpen || events) return;
    try { const r = await loadJobTimeline(org, leadId); if (r.ok) setEvents(r.events); else setProblem(r.message); } catch { setProblem('History did not load.'); }
  };
  return (
    <details className="jobtimeline" onToggle={e => void open((e.currentTarget as HTMLDetailsElement).open)}>
      <summary>History</summary>
      {problem ? <p className="quiet">{problem}</p> : events === null ? <p className="quiet">Loading</p> : events.length === 0 ? <p className="quiet">Nothing recorded yet.</p> : <ol>
        {events.map(e => <li key={e.id}><time>{when(e.at)}</time><span>{e.text}</span><small>{e.who}</small></li>)}
      </ol>}
    </details>
  );
}

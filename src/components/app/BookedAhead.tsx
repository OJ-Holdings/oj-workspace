import Link from 'next/link';
import type { JobItem } from '@/app/workspace/exterior-actions';
import { dollars } from '@/lib/metrics';
import { bookedAhead } from '@/lib/booked-ahead';

/** What is already on the calendar for the next four weeks and what it was quoted at. Quotes, not money in. */
export function BookedAhead({ jobs, today, base }: { jobs: JobItem[]; today: string; base: string }) {
  const a = bookedAhead(jobs, today);
  const top = Math.max(1, ...a.weeks.map(w => w.quoted));
  return (
    <section className="panel bookedahead" aria-label="Booked ahead">
      <header className="panel-head"><h2>Booked ahead</h2><Link className="secondary small" href={`${base}/b/exterior/bookings`}>See jobs</Link></header>
      {a.jobs === 0 ? <div className="empty"><p><b>Nothing booked in the next four weeks.</b></p></div> : <>
        <p className="bookedahead-total"><b>{dollars(a.quoted)}</b> quoted across {a.jobs} job{a.jobs === 1 ? '' : 's'}{a.unquoted ? `, ${a.unquoted} with no quote yet` : ''}.</p>
        <ul className="bookedahead-weeks">
          {a.weeks.map(w => <li key={w.label}>
            <span>{w.label}</span>
            <i aria-hidden="true"><b style={{ width: `${(w.quoted / top) * 100}%` }} /></i>
            <span>{w.jobs ? `${w.jobs} job${w.jobs === 1 ? '' : 's'}, ${dollars(w.quoted)}` : 'Open'}</span>
          </li>)}
        </ul>
      </>}
    </section>
  );
}

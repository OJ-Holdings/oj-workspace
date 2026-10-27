'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { ExteriorData, ExtBooking } from '@/lib/exterior';
import { blockLabel, isRealPhone } from '@/lib/exterior-ops';
import { dayKey } from '@/lib/dashboard';
import { dollars } from '@/lib/metrics';
import { JobSheet, type Act } from './ExteriorManage';
import { ExteriorFieldCommand } from './ExteriorFieldCommand';

const addDays = (key: string, n: number) => { const d = new Date(`${key}T12:00:00`); d.setDate(d.getDate() + n); return dayKey(d); };
const label = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

/**
 * The field page, simplified: today's jobs, the ones coming up, and past jobs still missing their figures. Tap a job to put in what
 * the customer paid and what it cost. The full evidence log is still here, folded away underneath.
 */
export function ExteriorFieldToday({ data, act, busy, readOnly, org, now, base, mode }: { data: ExteriorData; act: Act; busy: boolean; readOnly: boolean; org: string; now: Date; base: string; mode: 'preview' | 'live' }) {
  const [open, setOpen] = useState<string | null>(null);
  const params = useSearchParams();
  const today = dayKey(now);
  const lead = new Map(data.leads.map(l => [l.id, l]));
  const live = data.bookings.filter(b => b.status !== 'denied' && b.status !== 'cancelled');
  const by = (a: ExtBooking, b: ExtBooking) => a.date.localeCompare(b.date) || (a.time_block ?? '').localeCompare(b.time_block ?? '');
  const todays = live.filter(b => b.date === today).sort(by);
  const coming = live.filter(b => b.date > today && b.date <= addDays(today, 7)).sort(by);
  const missing = live.filter(b => b.date < today && b.date >= addDays(today, -45) && lead.get(b.lead_id ?? '')?.job_revenue == null).sort((a, b) => b.date.localeCompare(a.date));
  const sheet = open ? live.find(b => b.id === open) ?? null : null;

  const row = (b: ExtBooking, showDay: boolean) => {
    const l = lead.get(b.lead_id ?? '');
    return <li key={b.id} className="fieldtoday-row">
      <div>
        <b>{l?.name || 'Customer'}</b>
        <span>{showDay ? `${label(b.date)}, ` : ''}{blockLabel(b.time_block)}{l?.service_requested ? `, ${l.service_requested}` : ''}{l?.quote_amount != null ? `, quoted ${dollars(l.quote_amount)}` : ''}</span>
        {l?.address && <span>{l.address}</span>}
      </div>
      <div className="fieldtoday-actions">
        {l?.phone && isRealPhone(l.phone) && <a className="secondary small" href={`tel:${l.phone}`}>Call</a>}
        {l?.address && <a className="secondary small" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(l.address)}`}>Directions</a>}
        <button type="button" className="primary small" onClick={() => setOpen(b.id)}>Open job</button>
      </div>
    </li>;
  };

  return <>
    <section className="panel fieldtoday">
      <header className="panel-head"><h2>Today</h2><span className="quiet">{label(today)}</span></header>
      {todays.length ? <ul className="fieldtoday-list">{todays.map(b => row(b, false))}</ul> : <div className="empty"><p><b>No jobs today.</b> Book one from the Jobs tab.</p></div>}
    </section>
    {missing.length > 0 && <section className="panel fieldtoday">
      <header className="panel-head"><h2>Needs its figures</h2><span className="quiet">{missing.length} past job{missing.length === 1 ? '' : 's'} with no revenue entered</span></header>
      <ul className="fieldtoday-list">{missing.slice(0, 12).map(b => row(b, true))}</ul>
    </section>}
    {coming.length > 0 && <section className="panel fieldtoday">
      <header className="panel-head"><h2>Next 7 days</h2></header>
      <ul className="fieldtoday-list">{coming.map(b => row(b, true))}</ul>
    </section>}
    <details className="jobs-headsup" open={!!params.get('booking')}>
      <summary>Full field log and evidence checklists</summary>
      <ExteriorFieldCommand data={data} org={org} readOnly={readOnly} mode={mode} base={base} now={now} />
    </details>
    <JobSheet booking={sheet} lead={sheet ? lead.get(sheet.lead_id ?? '') : undefined} close={() => setOpen(null)} act={act} busy={busy} org={org} readOnly={readOnly} base={base} />
  </>;
}

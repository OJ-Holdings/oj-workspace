'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import NumberFlow from '@number-flow/react';
import { CalendarPlus, DollarSign, Pencil, Plus, Trash2, X } from 'lucide-react';
import { bookJob, dedupeLeads, importDoorSheet, importLeadSheet, moveBooking, removeBooking, removeSession, saveFinancials, saveLead, saveSession, saveSettings, setLeadStatus, type LeadInput, type SessionInput } from '@/app/workspace/exterior-actions';
import { openStatuses, sourceLabel, statusLabel, type Done, type ExtBooking, type ExteriorData, type ExtLead, type ExtSession } from '@/lib/exterior';
import { blockLabel, isRealPhone, leadSources, leadStatuses, services, slotTaken, timeBlocks } from '@/lib/exterior-ops';
import { dayKey } from '@/lib/dashboard';
import { dollars } from '@/lib/metrics';

// The parts of Exterior Care that change records: the same actions the original
// Exterior Care app offers, against the same database.

export type Act = <T extends object>(work: () => Promise<Done<T>>, success: (result: T) => string) => Promise<boolean>;
type Common = { data: ExteriorData; act: Act; busy: boolean; readOnly: boolean; org: string; now: Date };

const day = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const cash = (v: number | null) => v === null ? '-' : dollars(v);
const shownPhone = (p: string | null) => !p ? '-' : !isRealPhone(p) ? 'No usable number' : p.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, '($1) $2-$3');
const usd = { style: 'currency', currency: 'USD', maximumFractionDigits: 0 } as const;

/** A modal form. Escape or a click outside closes it. */
function Modal({ title, open, onClose, children }: { title: string; open: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (open && !ref.current?.open) ref.current?.showModal(); if (!open && ref.current?.open) ref.current.close(); }, [open]);
  return (
    <dialog ref={ref} className="card-dialog" data-venture="exterior" aria-label={title} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === ref.current) onClose(); }}>
      {open && <>
        <div className="dialog-header"><h2>{title}</h2><button type="button" className="icon-button" aria-label="Close" onClick={onClose}><X size={20} /></button></div>
        {children}
      </>}
    </dialog>
  );
}

/* ------------------------------ Leads ------------------------------ */

const blankLead: LeadInput = { name: '', phone: '', address: '', service_requested: '', quote_amount: '', notes: '', source: 'dtd' };

export function LeadsManager({ data, act, busy, readOnly, org, now }: Common) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [shown, setShown] = useState(50);
  const [editing, setEditing] = useState<LeadInput | null>(null);
  const [paying, setPaying] = useState<ExtLead | null>(null);
  const [booking, setBooking] = useState<ExtLead | null>(null);

  const counts = useMemo(() => Object.fromEntries(leadStatuses.map(s => [s, data.leads.filter(l => l.status === s).length])), [data.leads]);
  const pipeline = data.leads.filter(l => openStatuses.includes(l.status ?? '')).reduce((s, l) => s + (l.quote_amount ?? 0), 0);
  const q = search.trim().toLowerCase();
  const rows = data.leads.filter(l => (filter === 'all' || l.status === filter) && (!q || [l.name, l.phone, l.address].some(v => (v ?? '').toLowerCase().includes(q))));

  return <>
    <div className="kpis many">
      {(['new', 'contacted', 'following_up', 'booked', 'completed'] as const).map(s => <div key={s}><span>{statusLabel(s)}</span><strong><NumberFlow value={counts[s]} /></strong></div>)}
      <div><span>Open pipeline</span><strong><NumberFlow value={pipeline} format={usd} /></strong><small className="quiet">Quotes on open leads, not money in</small></div>
    </div>
    <section className="panel">
      <header className="panel-head">
        <h2>Leads</h2>
        {!readOnly && <button className="primary" disabled={busy} onClick={() => setEditing({ ...blankLead })}><Plus size={15} aria-hidden="true" />New lead</button>}
      </header>
      <div className="lead-tools">
        <input type="search" aria-label="Search leads" placeholder="Search by name, phone or address" value={search} onChange={e => { setSearch(e.target.value); setShown(50); }} />
        <div className="filter-chips" role="group" aria-label="Filter by status">
          {['all', ...leadStatuses].map(s => <button key={s} type="button" aria-pressed={filter === s} onClick={() => { setFilter(s); setShown(50); }}>{s === 'all' ? 'All' : statusLabel(s)}<span>{s === 'all' ? data.leads.length : counts[s]}</span></button>)}
        </div>
      </div>
      {rows.length ? <div className="tablewrap"><table className="table lead-table">
        <thead><tr><th>Name</th><th>Service</th><th className="num">Quote</th><th>Source</th><th>Status</th><th>Added</th>{!readOnly && <th><span className="sr-only">Actions</span></th>}</tr></thead>
        <tbody>{rows.slice(0, shown).map(l => (
          <tr key={l.id}>
            <td><b>{l.name || 'Unnamed'}</b><small className="quiet block">{isRealPhone(l.phone) ? <a href={`tel:${l.phone}`}>{shownPhone(l.phone)}</a> : shownPhone(l.phone)}</small><small className="quiet block">{l.address || ''}</small></td>
            <td>{l.service_requested || '-'}</td>
            <td className="num">{cash(l.quote_amount)}</td>
            <td><span className="tag">{sourceLabel(l.source)}</span></td>
            <td>{readOnly ? statusLabel(l.status) : (
              <select aria-label={`Status of ${l.name}`} className={`status-select is-${l.status}`} value={l.status ?? 'new'} disabled={busy} onChange={e => { const s = e.target.value; act(() => setLeadStatus(org, l.id, s), () => `${l.name} marked ${statusLabel(s).toLowerCase()}.`); }}>
                {leadStatuses.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
              </select>
            )}</td>
            <td>{day(l.created_at)}</td>
            {!readOnly && <td><div className="row-actions">
              {l.status === 'completed' && <button className="secondary small" onClick={() => setPaying(l)} aria-label={`Payment for ${l.name}`}><DollarSign size={14} aria-hidden="true" />{l.job_revenue ? dollars(l.job_revenue) : 'Add'}</button>}
              {!['booked', 'completed', 'closed'].includes(l.status ?? '') && <button className="secondary small" onClick={() => setBooking(l)}><CalendarPlus size={14} aria-hidden="true" />Book</button>}
              <button className="icon-button" aria-label={`Edit ${l.name}`} onClick={() => setEditing({ id: l.id, name: l.name ?? '', phone: l.phone ?? '', address: l.address ?? '', service_requested: l.service_requested ?? '', quote_amount: l.quote_amount ?? '', notes: l.notes ?? '', source: l.source ?? '' })}><Pencil size={15} /></button>
            </div></td>}
          </tr>
        ))}</tbody></table>
        {rows.length > shown && <button className="secondary showmore" onClick={() => setShown(shown + 50)}>Show {Math.min(50, rows.length - shown)} more of {rows.length}</button>}</div>
        : <div className="empty"><p><b>No leads match.</b> Change the filter or search.</p></div>}
    </section>

    <LeadDialog lead={editing} close={() => setEditing(null)} act={act} busy={busy} org={org} />
    <MoneyDialog lead={paying} close={() => setPaying(null)} act={act} busy={busy} org={org} />
    <BookDialog lead={booking} close={() => setBooking(null)} act={act} busy={busy} org={org} bookings={data.bookings} now={now} />
  </>;
}

function LeadDialog({ lead, close, act, busy, org }: { lead: LeadInput | null; close: () => void; act: Act; busy: boolean; org: string }) {
  const [f, setF] = useState<LeadInput>(blankLead);
  useEffect(() => { if (lead) setF(lead); }, [lead]);
  const set = (k: keyof LeadInput) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const sourceKnown = leadSources.some(([id]) => id === f.source);
  return (
    <Modal title={lead?.id ? `Edit ${lead.name || 'lead'}` : 'New lead'} open={!!lead} onClose={close}>
      <form onSubmit={e => { e.preventDefault(); act(() => saveLead(org, f), () => lead?.id ? 'Lead saved.' : `${f.name} added.`).then(ok => ok && close()); }}>
        <div className="form-grid">
          <label>Full name<input required maxLength={255} autoComplete="off" value={f.name} onChange={set('name')} /></label>
          <label>Phone<input required type="tel" maxLength={40} value={f.phone} onChange={set('phone')} placeholder="(262) 555-0123" /></label>
        </div>
        <label>Address<input maxLength={500} value={f.address} onChange={set('address')} placeholder="Street, Kenosha, WI 53140" /></label>
        <div className="form-grid">
          <label>Service<input list="oj-services" maxLength={255} value={f.service_requested} onChange={set('service_requested')} /></label>
          <label>Quote in dollars<input type="number" min="0" step="1" inputMode="decimal" value={f.quote_amount ?? ''} onChange={set('quote_amount')} /></label>
          <label>Lead source<select value={f.source} onChange={set('source')}>{!sourceKnown && f.source && <option value={f.source}>{sourceLabel(f.source)}</option>}{leadSources.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        </div>
        <datalist id="oj-services">{services.map(s => <option key={s} value={s} />)}</datalist>
        <label>Notes<textarea rows={3} maxLength={4000} value={f.notes} onChange={set('notes')} /></label>
        <div className="dialog-actions"><span>{lead?.id ? 'Edited fields are kept when the sheet syncs.' : 'Starts as New.'}</span><button className="primary" disabled={busy}>{busy ? 'Saving' : 'Save lead'}</button></div>
      </form>
    </Modal>
  );
}

function MoneyDialog({ lead, close, act, busy, org }: { lead: ExtLead | null; close: () => void; act: Act; busy: boolean; org: string }) {
  const [f, setF] = useState({ job_revenue: '', job_cost: '', notes: '' });
  useEffect(() => { if (lead) setF({ job_revenue: lead.job_revenue?.toString() ?? '', job_cost: lead.job_cost?.toString() ?? '', notes: lead.notes ?? '' }); }, [lead]);
  const revenue = Number(f.job_revenue) || 0, cost = Number(f.job_cost) || 0;
  return (
    <Modal title={`Payment for ${lead?.name ?? ''}`} open={!!lead} onClose={close}>
      {lead && <form onSubmit={e => { e.preventDefault(); act(() => saveFinancials(org, lead.id, f), () => 'Payment saved.').then(ok => ok && close()); }}>
        <p className="quiet">{[lead.service_requested, lead.address].filter(Boolean).join(', ')}. Quoted {cash(lead.quote_amount)}.</p>
        <div className="form-grid">
          <label>What the customer paid<input type="number" min="0" step="0.01" inputMode="decimal" value={f.job_revenue} onChange={e => setF({ ...f, job_revenue: e.target.value })} /></label>
          <label>Job expenses<input type="number" min="0" step="0.01" inputMode="decimal" value={f.job_cost} onChange={e => setF({ ...f, job_cost: e.target.value })} placeholder="Labour, supplies, gas" /></label>
        </div>
        <div className="kpis compact">
          <div><span>Paid</span><strong>{dollars(revenue)}</strong></div>
          <div><span>Expenses</span><strong>{dollars(cost)}</strong></div>
          <div><span>Profit</span><strong className={revenue - cost < 0 ? 'neg' : ''}>{dollars(revenue - cost)}</strong>{revenue > 0 && <small className="quiet">{Math.round(((revenue - cost) / revenue) * 100)}% margin</small>}</div>
        </div>
        <label>Notes<textarea rows={2} maxLength={4000} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} /></label>
        <div className="dialog-actions"><span>Entering a payment counts it in this month.</span><button className="primary" disabled={busy}>{busy ? 'Saving' : 'Save payment'}</button></div>
      </form>}
    </Modal>
  );
}

/** Dates for the next two weeks, Thursdays and Fridays marked as the usual job days. */
function nextDays(now: Date) {
  return Array.from({ length: 21 }, (_, i) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + i + 1)).map(d => ({ key: dayKey(d), label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }), usual: d.getDay() === 4 || d.getDay() === 5 }));
}

function BookDialog({ lead, close, act, busy, org, bookings, now, booking }: { lead: ExtLead | null; close: () => void; act: Act; busy: boolean; org: string; bookings: ExtBooking[]; now: Date; booking?: ExtBooking }) {
  const [date, setDate] = useState('');
  const [slot, setSlot] = useState('');
  const open = !!lead;
  useEffect(() => { if (open) { setDate(booking?.date ?? ''); setSlot(booking?.time_block ?? ''); } }, [open, booking]);
  const days = useMemo(() => nextDays(now), [now]);
  return (
    <Modal title={booking ? `Move ${lead?.name ?? ''}` : `Book ${lead?.name ?? ''}`} open={open} onClose={close}>
      {lead && <form onSubmit={e => { e.preventDefault(); act(() => booking ? moveBooking(org, booking.id, date, slot) : bookJob(org, lead.id, date, slot), () => booking ? 'Booking moved.' : `${lead.name} booked for ${day(date)}, ${blockLabel(slot)}.`).then(ok => ok && close()); }}>
        <p className="quiet">{[lead.service_requested, cash(lead.quote_amount), lead.address, isRealPhone(lead.phone) ? shownPhone(lead.phone) : null].filter(v => v && v !== '-').join(', ')}</p>
        <fieldset className="day-picker"><legend>Day</legend>
          {days.map(d => <button type="button" key={d.key} aria-pressed={date === d.key} className={d.usual ? 'usual' : ''} onClick={() => { setDate(d.key); setSlot(''); }}>{d.label}</button>)}
          <label className="other-day">Another day<input type="date" value={date} min={dayKey(now)} onChange={e => { setDate(e.target.value); setSlot(''); }} /></label>
        </fieldset>
        <fieldset className="block-picker"><legend>Time</legend>
          {timeBlocks.map(([id, label, part]) => { const taken = !!date && slotTaken(bookings, date, id, booking?.id); return (
            <button type="button" key={id} aria-pressed={slot === id} disabled={!date || taken} onClick={() => setSlot(id)}><b>{label}</b><span>{taken ? 'Booked' : part}</span></button>
          ); })}
        </fieldset>
        <div className="dialog-actions"><span>{booking ? 'Let the customer know about the new time.' : 'Booked as confirmed, and the lead moves to Booked.'}</span><button className="primary" disabled={busy || !date || !slot}>{busy ? 'Saving' : booking ? 'Move booking' : 'Confirm booking'}</button></div>
      </form>}
    </Modal>
  );
}

/* ------------------------------ Bookings ------------------------------ */

export function BookingsManager({ data, act, busy, readOnly, org, now }: Common) {
  const [moving, setMoving] = useState<ExtBooking | null>(null);
  const today = dayKey(now), month = today.slice(0, 7);
  const lead = new Map(data.leads.map(l => [l.id, l]));
  const live = data.bookings.filter(b => b.status !== 'denied');
  const upcoming = live.filter(b => b.date >= today).sort((a, b) => a.date.localeCompare(b.date) || (a.time_block ?? '').localeCompare(b.time_block ?? ''));
  const past = live.filter(b => b.date < today);
  return <>
    <div className="kpis">
      <div><span>Upcoming jobs</span><strong><NumberFlow value={upcoming.length} /></strong></div>
      <div><span>Booked this month</span><strong><NumberFlow value={live.filter(b => b.date.startsWith(month)).length} /></strong></div>
      <div><span>Upcoming quoted value</span><strong><NumberFlow value={upcoming.reduce((s, b) => s + (lead.get(b.lead_id ?? '')?.quote_amount ?? 0), 0)} format={usd} /></strong><small className="quiet">Quotes, not money in</small></div>
    </div>
    {[['Upcoming', upcoming, 'Nothing booked from today on. Book a job from the Leads tab.'] as const, ['Past', past, 'No past bookings.'] as const].map(([title, list, none]) => (
      <section className="panel" key={title}>
        <header className="panel-head"><h2>{title}</h2></header>
        {list.length ? <div className="tablewrap"><table className="table">
          <thead><tr><th>Date</th><th>Time</th><th>Customer</th><th>Service</th><th>Address</th><th className="num">Quote</th>{!readOnly && title === 'Upcoming' && <th><span className="sr-only">Actions</span></th>}</tr></thead>
          <tbody>{list.map(b => { const l = lead.get(b.lead_id ?? ''); return (
            <tr key={b.id}><td>{day(b.date)}</td><td>{blockLabel(b.time_block)}</td><td>{l?.name || 'Lead no longer on record'}{b.status === 'pending_approval' && <small className="quiet block">Waiting for approval</small>}</td><td>{l?.service_requested || '-'}</td><td>{l?.address || '-'}</td><td className="num">{cash(l?.quote_amount ?? null)}</td>
              {!readOnly && title === 'Upcoming' && <td><div className="row-actions">
                {l && <button className="secondary small" onClick={() => setMoving(b)}>Move</button>}
                <button className="icon-button" aria-label={`Cancel booking for ${l?.name ?? 'lead'}`} disabled={busy} onClick={() => { if (window.confirm(`Cancel ${l?.name ?? 'this'} booking on ${day(b.date)}? The lead goes back to following up.`)) act(() => removeBooking(org, b.id), () => 'Booking cancelled.'); }}><Trash2 size={15} /></button>
              </div></td>}
            </tr>
          ); })}</tbody></table></div>
          : <div className="empty"><p><b>{none}</b></p></div>}
      </section>
    ))}
    <BookDialog lead={moving ? lead.get(moving.lead_id ?? '') ?? null : null} booking={moving ?? undefined} close={() => setMoving(null)} act={act} busy={busy} org={org} bookings={data.bookings} now={now} />
  </>;
}

/* ------------------------------ Door knocking ------------------------------ */

const blankSession = (today: string): SessionInput => ({ session_date: today, knocked_by: '', area: '', start_time: '', end_time: '', doors_knocked: '', answers: '', interested: '', quotes_given: '', jobs_scheduled: '', job_total: '', notes: '' });

/** Every session, newest first, with logging, editing and removing. */
export function SessionsManager({ data, act, busy, readOnly, org, now }: Common) {
  const [editing, setEditing] = useState<SessionInput | null>(null);
  const [shown, setShown] = useState(25);
  const crew = [...new Set(data.sessions.map(s => s.knocked_by).filter(Boolean))] as string[];
  const areas = [...new Set(data.sessions.map(s => s.area?.trim()).filter(Boolean))] as string[];
  const edit = (s: ExtSession) => setEditing({ id: s.id, session_date: s.session_date, knocked_by: s.knocked_by ?? '', area: s.area ?? '', start_time: s.start_time ?? '', end_time: s.end_time ?? '', doors_knocked: s.doors_knocked ?? '', answers: s.answers ?? '', interested: s.interested ?? '', quotes_given: s.quotes_given ?? '', jobs_scheduled: s.jobs_scheduled ?? '', job_total: s.job_total ?? '', notes: s.notes ?? '' });
  return (
    <section className="panel">
      <header className="panel-head"><h2>Sessions</h2>{!readOnly && <button className="primary" disabled={busy} onClick={() => setEditing(blankSession(dayKey(now)))}><Plus size={15} aria-hidden="true" />Log a session</button>}</header>
      {data.sessions.length ? <div className="tablewrap"><table className="table">
        <thead><tr><th>Date</th><th>Who</th><th>Area</th><th className="num">Doors</th><th className="num">Answers</th><th className="num">Interested</th><th className="num">Quotes</th><th className="num">Jobs</th><th className="num">Job value</th>{!readOnly && <th><span className="sr-only">Actions</span></th>}</tr></thead>
        <tbody>{data.sessions.slice(0, shown).map(x => (
          <tr key={x.id}><td>{day(x.session_date)}</td><td>{x.knocked_by || '-'}</td><td>{x.area || '-'}</td><td className="num">{x.doors_knocked ?? '-'}</td><td className="num">{x.answers ?? '-'}</td><td className="num">{x.interested ?? '-'}</td><td className="num">{x.quotes_given ?? '-'}</td><td className="num">{x.jobs_scheduled ?? '-'}</td><td className="num">{cash(x.job_total)}</td>
            {!readOnly && <td><div className="row-actions">
              <button className="icon-button" aria-label={`Edit session on ${day(x.session_date)}`} onClick={() => edit(x)}><Pencil size={15} /></button>
              <button className="icon-button" aria-label={`Remove session on ${day(x.session_date)}`} disabled={busy} onClick={() => { if (window.confirm(`Remove the ${day(x.session_date)} session${x.area ? ` in ${x.area}` : ''}?`)) act(() => removeSession(org, x.id), () => 'Session removed.'); }}><Trash2 size={15} /></button>
            </div></td>}
          </tr>
        ))}</tbody></table>{data.sessions.length > shown && <button className="secondary showmore" onClick={() => setShown(shown + 50)}>Show {Math.min(50, data.sessions.length - shown)} more of {data.sessions.length}</button>}</div>
        : <div className="empty"><p><b>No sessions yet.</b> Log one after each night out, or bring in the door-knocking sheet from Settings.</p></div>}
      <SessionDialog session={editing} close={() => setEditing(null)} act={act} busy={busy} org={org} crew={crew} areas={areas} />
    </section>
  );
}

function SessionDialog({ session, close, act, busy, org, crew, areas }: { session: SessionInput | null; close: () => void; act: Act; busy: boolean; org: string; crew: string[]; areas: string[] }) {
  const [f, setF] = useState<SessionInput | null>(null);
  useEffect(() => { if (session) setF(session); }, [session]);
  const set = (k: keyof SessionInput) => (e: { target: { value: string } }) => setF(v => v && { ...v, [k]: e.target.value });
  const n = (k: keyof SessionInput, label: string) => <label>{label}<input type="number" min="0" step="1" inputMode="numeric" value={f?.[k] ?? ''} onChange={set(k)} /></label>;
  const doors = Number(f?.doors_knocked) || 0, total = Number(f?.job_total) || 0;
  return (
    <Modal title={session?.id ? 'Edit session' : 'Log a door-knocking session'} open={!!session} onClose={close}>
      {f && <form onSubmit={e => { e.preventDefault(); act(() => saveSession(org, f), () => session?.id ? 'Session saved.' : 'Session logged.').then(ok => ok && close()); }}>
        <div className="form-grid">
          <label>Date<input type="date" required value={f.session_date} onChange={set('session_date')} /></label>
          <label>Who knocked<input list="oj-crew" maxLength={120} value={f.knocked_by} onChange={set('knocked_by')} placeholder="Jacob + Oscar" /></label>
          <label>Area<input list="oj-areas" maxLength={200} value={f.area} onChange={set('area')} /></label>
          <div className="form-grid">
            <label>Start<input type="time" value={f.start_time} onChange={set('start_time')} /></label>
            <label>End<input type="time" value={f.end_time} onChange={set('end_time')} /></label>
          </div>
        </div>
        <datalist id="oj-crew">{crew.map(c => <option key={c} value={c} />)}</datalist>
        <datalist id="oj-areas">{areas.map(a => <option key={a} value={a} />)}</datalist>
        <div className="form-grid five">{n('doors_knocked', 'Doors')}{n('answers', 'Answers')}{n('interested', 'Interested')}{n('quotes_given', 'Quotes')}{n('jobs_scheduled', 'Jobs')}</div>
        <label>Value of jobs booked, in dollars<input type="number" min="0" step="1" inputMode="decimal" value={f.job_total} onChange={set('job_total')} /></label>
        <label>Notes<textarea rows={2} maxLength={2000} value={f.notes} onChange={set('notes')} /></label>
        <div className="dialog-actions"><span>{doors ? `${dollars(Math.round((total / doors) * 100) / 100)} a door` : 'Rates are worked out from these numbers.'}</span><button className="primary" disabled={busy}>{busy ? 'Saving' : session?.id ? 'Save session' : 'Log session'}</button></div>
      </form>}
    </Modal>
  );
}

/* ------------------------------ Activity ------------------------------ */

export function ActivityList({ data }: { data: ExteriorData }) {
  const [who, setWho] = useState('');
  const people = [...new Set(data.activity.map(a => a.operator).filter(Boolean))] as string[];
  const rows = data.activity.filter(a => !who || a.operator === who);
  return (
    <section className="panel">
      <header className="panel-head"><h2>Activity</h2>
        <label className="quiet">Who <select value={who} onChange={e => setWho(e.target.value)}><option value="">Everyone</option>{people.map(p => <option key={p}>{p}</option>)}</select></label>
      </header>
      {rows.length ? <ol className="activity">{rows.map(a => (
        <li key={a.id}><time dateTime={a.created_at}>{new Date(a.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time><b>{a.operator || 'System'}</b><span>{a.description || a.action}</span></li>
      ))}</ol> : <div className="empty"><p><b>Nothing recorded yet.</b></p></div>}
      <p className="quiet">The latest 300 changes made in either app.</p>
    </section>
  );
}

/* ------------------------------ Settings ------------------------------ */

export function ExteriorSettings({ data, act, busy, readOnly, org }: Common) {
  const [f, setF] = useState<Record<string, string>>({});
  useEffect(() => { const s = data.extras?.settings ?? {}; setF({ ...s, googleSheetUrl: s.googleSheetUrl || s.google_sheet_url || '' }); }, [data.extras]);
  const val = (k: string) => f[k] ?? '';
  const set = (k: string) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const save = (keys: string[], label: string) => act(() => saveSettings(org, Object.fromEntries(keys.map(k => [k, val(k)]))), () => `${label} saved.`);
  if (!data.extras) return <div className="planned"><h2>One step left to switch this on</h2><p>Settings are shared through a database update a founder runs once.</p></div>;

  const importLeads = async () => {
    let preview: { added: number; updated: number; unchanged: number } | null = null;
    const ok = await act(() => importLeadSheet(org, false), r => { preview = r; return `The leads sheet has ${r.added} new ${r.added === 1 ? 'person' : 'people'} and updates for ${r.updated} lead${r.updated === 1 ? '' : 's'}; ${r.unchanged} already match.`; });
    const p = preview as { added: number; updated: number } | null;
    if (!ok || !p || (!p.added && !p.updated)) return;
    if (window.confirm(`Bring in the leads sheet? This adds ${p.added} and updates ${p.updated}. Anything already edited in the workspace stays as it is, and no status moves backwards.`))
      await act(() => importLeadSheet(org, true), r => `Leads sheet imported: ${r.added} added, ${r.updated} updated${r.failed ? `, ${r.failed} could not be saved` : ''}.`);
  };
  const importDoors = async () => {
    let preview: { sessions: number; doors: number; current: number } | null = null;
    const ok = await act(() => importDoorSheet(org, false), r => { preview = r; return `The door-knocking sheet has ${r.sessions} sessions (${r.doors.toLocaleString('en-US')} doors). There are ${r.current} here now.`; });
    const p = preview as { sessions: number; current: number } | null;
    if (!ok || !p) return;
    if (window.confirm(`Replace the ${p.current} door-knocking sessions here with the ${p.sessions} in the sheet? Any session logged in the workspace that is not in the sheet will be removed.`))
      await act(() => importDoorSheet(org, true), r => `Door-knocking sheet imported: ${r.sessions} sessions.`);
  };

  return <>
    <section className="panel formpanel">
      <h2>Business</h2>
      <div className="fields">
        <label>Business name<input disabled={readOnly} maxLength={200} value={val('businessName')} onChange={set('businessName')} /></label>
        <label>Service area<input disabled={readOnly} maxLength={200} value={val('address')} onChange={set('address')} /></label>
        <label>Monthly revenue goal in dollars<input disabled={readOnly} type="number" min="0" step="100" value={val('monthlyRevenueGoal')} onChange={set('monthlyRevenueGoal')} /></label>
      </div>
      {!readOnly && <div className="formactions"><button className="primary" disabled={busy} onClick={() => save(['businessName', 'address', 'monthlyRevenueGoal'], 'Business details')}>Save business details</button></div>}
    </section>
    <section className="panel formpanel">
      <h2>Starting point from Google Sheets</h2>
      <p className="quiet">This workspace is now where leads, jobs and door knocking are recorded. The sheets are the starting point: bring each one in once, then keep working here. Each preview shows what would change before anything is written. Sheets must be shared as &quot;Anyone with the link can view&quot;.</p>
      <div className="fields">
        <label className="wide">Leads sheet<input disabled={readOnly} type="url" maxLength={2000} value={val('googleSheetUrl')} onChange={set('googleSheetUrl')} placeholder="https://docs.google.com/spreadsheets/d/..." /></label>
        <label className="wide">Door-knocking sheet<input disabled={readOnly} type="url" maxLength={2000} value={val('d2dSheetUrl')} onChange={set('d2dSheetUrl')} placeholder="https://docs.google.com/spreadsheets/d/..." /></label>
      </div>
      {!readOnly && <div className="formactions">
        <button className="secondary" disabled={busy} onClick={() => save(['googleSheetUrl', 'd2dSheetUrl'], 'Sheet links')}>Save sheet links</button>
        <button className="secondary" disabled={busy} onClick={importDoors}>Bring in door knocking</button>
        <button className="primary" disabled={busy} onClick={importLeads}>Bring in leads</button>
      </div>}
    </section>
    <section className="panel formpanel">
      <h2>Duplicate leads</h2>
      <p className="quiet">Finds leads with the same phone number, or the same name and address. Each group keeps the one furthest along; the others&apos; bookings and notes move to it.</p>
      {!readOnly && <div className="formactions">
        <button className="secondary" disabled={busy} onClick={() => act(() => dedupeLeads(org, false), r => r.removed ? `Found ${r.removed} duplicate lead${r.removed === 1 ? '' : 's'} in ${r.groups} group${r.groups === 1 ? '' : 's'}. Press "Merge duplicates" to merge them.` : 'No duplicates found.')}>Find duplicates</button>
        <button className="secondary" disabled={busy} onClick={() => { if (window.confirm('Merge duplicate leads? Each group keeps the lead furthest along; the others are deleted after their bookings and notes move to it. This cannot be undone.')) act(() => dedupeLeads(org, true), r => r.removed ? `Merged ${r.removed} duplicate lead${r.removed === 1 ? '' : 's'}.` : 'No duplicates found.'); }}>Merge duplicates</button>
      </div>}
    </section>
  </>;
}

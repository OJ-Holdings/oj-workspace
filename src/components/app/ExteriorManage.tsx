'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import NumberFlow from '@number-flow/react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarPlus, DollarSign, Pencil, Plus, Trash2, X } from 'lucide-react';
import { countLeadWorkFocuses, leadWorkDescriptions, leadWorkLabels, leadWorkFocuses, matchesLeadWorkFocus, sortLeadsForWork, type LeadWorkFocus } from '@/lib/exterior-lead-workflow';
import { bookingWorkCounts, bookingWorkDescriptions, bookingWorkFocuses, bookingWorkLabels, matchesBookingWorkFocus, sortBookingsForWork, type BookingWorkFocus } from '@/lib/exterior-booking-workflow';
import {qualifiedDispatchQuotes} from '@/lib/exterior-dispatch-preflight';
import {ExteriorDispatchPreflight} from './ExteriorDispatchPreflight';
import {ExteriorJobContinuity} from './ExteriorJobContinuity';
import { bookJob, bookNewClient, dedupeLeads, importDoorSheet, importLeadSheet, moveBooking, removeBooking, removeSession, saveFinancials, saveJob, saveLead, saveSession, saveSettings, setLeadStatus, type LeadInput, type SessionInput } from '@/app/workspace/exterior-actions';
import { openStatuses, sourceLabel, statusLabel, type Done, type ExtBooking, type ExteriorData, type ExtLead, type ExtSession } from '@/lib/exterior';
import { blockLabel, blocksOverlap, clockLabel, DAY_FIRST_START, DAY_LAST_END, DAY_LAST_START, isRealPhone, jobLengths, leadSources, leadStatuses, lengthLabel, makeBlock, MAX_JOB, MIN_JOB, parseBlock, quickStarts, services } from '@/lib/exterior-ops';
import { dayKey } from '@/lib/dashboard';
import { dollars } from '@/lib/metrics';
import { saveEmployeeAssignment } from '@/app/workspace/employees/actions';
import { LeadSourceTagger } from './LeadSourceTagger';
import { RebookList } from './RebookList';
import { JobCosts } from './JobCosts';
import { JobTimeline } from './JobTimeline';

// The parts of Exterior Care that change records: the same actions the original
// Exterior Care app offers, against the same database.

export type Act = <T extends object>(work: () => Promise<Done<T>>, success: (result: T) => string) => Promise<boolean>;
type Common = { data: ExteriorData; act: Act; busy: boolean; readOnly: boolean; org: string; now: Date };

const day = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const cash = (v: number | null) => v === null ? '-' : dollars(v);
const shownPhone = (p: string | null) => !p ? '-' : !isRealPhone(p) ? 'No usable number' : p.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, '($1) $2-$3');
const usd = { style: 'currency', currency: 'USD', maximumFractionDigits: 0 } as const;

/** A modal form. Escape or a click outside closes it. */
export function Modal({ title, open, onClose, children }: { title: string; open: boolean; onClose: () => void; children: ReactNode }) {
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
  const [workFocus,setWorkFocus]=useState<LeadWorkFocus>('all');
  const [view,setView]=useState<'cards'|'table'>('cards');
  const [search, setSearch] = useState('');
  const [shown, setShown] = useState(50);
  const [editing, setEditing] = useState<LeadInput | null>(null);
  const [paying, setPaying] = useState<ExtLead | null>(null);
  const [booking, setBooking] = useState<ExtLead | null>(null);
  const [tagging, setTagging] = useState(false);
  const leadPathname=usePathname();
  const base=leadPathname.startsWith('/preview')?'/preview':'/workspace';
  const leadParams=useSearchParams();
  const selected=leadParams.get('lead');
  const launchNewLead=leadParams.get('new');
  useEffect(()=>{
    if(readOnly||launchNewLead!=='1')return;
    setEditing({...blankLead});
    const url=new URL(window.location.href);
    url.searchParams.delete('new');
    window.history.replaceState(window.history.state,'',url.pathname+url.search+url.hash);
  },[readOnly,launchNewLead]);
  useEffect(() => {
    const lead = data.leads.find(l => l.id === selected);
    if (lead) { setFilter('all'); setWorkFocus('all'); setSearch(lead.name ?? ''); setShown(data.leads.length); }
  }, [selected, data.leads]);

  const counts = useMemo(() => Object.fromEntries(leadStatuses.map(s => [s, data.leads.filter(l => l.status === s).length])), [data.leads]);
  const workCounts=useMemo(()=>countLeadWorkFocuses(data.leads),[data.leads]);
  const pipeline = data.leads.filter(l => openStatuses.includes(l.status ?? '')).reduce((s, l) => s + (l.quote_amount ?? 0), 0);
  const q = search.trim().toLowerCase();
  const rows = sortLeadsForWork(data.leads.filter(l => (filter === 'all' || l.status === filter) && matchesLeadWorkFocus(l,workFocus) && (!q || [l.name, l.phone, l.address, l.service_requested].some(v => (v ?? '').toLowerCase().includes(q)))));

  return <>
    <p className="lead-pipeline-note">Open pipeline <strong><NumberFlow value={pipeline} format={usd} /></strong> <span className="quiet">quoted on open leads, not money in</span></p>
    {data.coverage?.leads&&data.coverage.leads.total!==null&&data.coverage.leads.total>data.coverage.leads.loaded&&
      <p className="banner-inline" role="status">Showing {data.coverage.leads.loaded} of {data.coverage.leads.total} customers. Counts cover those only.</p>}
    <section className="atlas-lead-priority" aria-label="Customer work queues">
      <header><div><h2>Customers</h2></div></header>
      <div className="atlas-lead-focuses">
        {leadWorkFocuses.filter(focus=>focus!=='all').map(focus=><button key={focus} type="button"
          aria-pressed={workFocus===focus} onClick={()=>{setWorkFocus(focus);setFilter('all');setSearch('');setShown(50);}}>
          <strong>{workCounts[focus]}</strong><span>{leadWorkLabels[focus]}</span>
          <small>{leadWorkDescriptions[focus]}</small>
        </button>)}
      </div>
      {workFocus!=='all'&&<div className="atlas-lead-focus-notice" role="status">
        <span><b>{leadWorkLabels[workFocus]}:</b> {leadWorkDescriptions[workFocus]}</span>
        <button type="button" className="secondary small" onClick={()=>{setWorkFocus('all');setFilter('all');setShown(50);}}>Show all customers</button>
      </div>}
    </section>
    <RebookList leads={data.leads} now={now} />
    <section className="panel">
      <header className="panel-head">
        <h2>Customer workbench <small className="quiet">{rows.length} visible of {data.leads.length} loaded</small></h2>
        <div className="exterior-customer-head-actions">
          <Link className="secondary" href={`${base}/b/exterior/intake`}>Website intake <span aria-hidden="true">↗</span></Link>
          {!readOnly && <button className="secondary" disabled={busy} onClick={() => setTagging(true)}>Tag lead sources</button>}
          {!readOnly && <button className="primary" disabled={busy} onClick={() => setEditing({ ...blankLead })}><Plus size={15} aria-hidden="true" />New lead</button>}
        </div>
      </header>
      <div className="lead-tools">
        <input type="search" aria-label="Search leads" placeholder="Search by name, phone or address" value={search} onChange={e => { setSearch(e.target.value); setShown(50); }} />
        <div className="filter-chips" role="group" aria-label="Filter by status">
          {['all', ...leadStatuses].map(s => <button key={s} type="button" aria-pressed={filter === s} onClick={() => { setFilter(s); setWorkFocus('all'); setShown(50); }}>{s === 'all' ? 'All' : statusLabel(s)}<span>{s === 'all' ? data.leads.length : counts[s]}</span></button>)}
        </div>
      </div>
      <div className="atlas-lead-view-toggle" role="group" aria-label="Customer display">
        <span>{rows.length} shown, newest first</span>
        <button type="button" aria-pressed={view==='cards'} onClick={()=>setView('cards')}>Customer cards</button>
        <button type="button" aria-pressed={view==='table'} onClick={()=>setView('table')}>Compact table</button>
      </div>
      {view==='cards'&&(rows.length ? <>
        <div className="atlas-customer-grid" aria-label="Accessible customer cards">
          {rows.slice(0,shown).map(l=><article key={l.id} className="atlas-customer-card" data-status={l.status??'unknown'}>
            <header>
              <span className="atlas-customer-avatar" aria-hidden="true">{(l.name??'?').trim().charAt(0).toUpperCase()||'?'}</span>
              <div><h3>{l.name||'Unnamed customer'}</h3>
                <small>Added {day(l.created_at)} · {sourceLabel(l.source)}</small></div>
              <span className="atlas-customer-stage">{statusLabel(l.status)}</span>
            </header>
            <div className="atlas-customer-description">
              <div><small>Requested service</small><strong>{l.service_requested||'Not entered'}</strong></div>
              <div><small>Entered quote, not paid</small><strong>{cash(l.quote_amount)}</strong></div>
              {l.status==='completed'&&<div><small>Recorded job revenue</small><strong>{cash(l.job_revenue)}</strong></div>}
            </div>
            <div className="atlas-customer-contact">
              {isRealPhone(l.phone)?<a href={`tel:${l.phone}`}>{shownPhone(l.phone)}</a>:<span>{shownPhone(l.phone)}</span>}
              {l.address&&<small>{l.address}</small>}
            </div>
            <footer>
              {!readOnly&&<label>Customer status<select aria-label={`Status of ${l.name??'customer'}`}
                value={l.status??''} disabled={busy}
                onChange={e=>{const status=e.target.value;act(()=>setLeadStatus(org,l.id,status),()=>`${l.name} marked ${statusLabel(status).toLowerCase()}.`);}}>
                {!leadStatuses.some(status=>status===l.status)&&<option value={l.status??''}>{statusLabel(l.status)}</option>}
                {leadStatuses.map(status=><option key={status} value={status}>{statusLabel(status)}</option>)}
              </select></label>}
              <div className="atlas-customer-card-actions">
                {!readOnly&&l.status==='completed'&&<button type="button" className="secondary small"
                  onClick={()=>setPaying(l)}><DollarSign size={14}/>{l.job_revenue===null?'Add job figures':'Edit job figures'}</button>}
                <Link className="secondary small" href={`${base}/b/exterior/customer?lead=${encodeURIComponent(l.id)}`}>Customer 360</Link>
                <Link className="secondary small" href={`${base}/b/exterior/estimate?lead=${encodeURIComponent(l.id)}`}>Estimate</Link>
                {!readOnly&&l.status!=='booked'&&<button type="button" className="primary small" onClick={()=>setBooking(l)}>
                  <CalendarPlus size={14}/>{isDone(l)?'Book again':'Book job'}</button>}
                {!readOnly&&<button type="button" className="secondary small" onClick={()=>setEditing({
                  id:l.id,name:l.name??'',phone:l.phone??'',address:l.address??'',
                  service_requested:l.service_requested??'',quote_amount:l.quote_amount??'',
                  notes:l.notes??'',source:l.source??'',
                })}><Pencil size={14}/>Edit details</button>}
              </div>
            </footer>
          </article>)}
        </div>
        {rows.length>shown&&<button className="secondary showmore" onClick={()=>setShown(shown+50)}>
          Show {Math.min(50,rows.length-shown)} more customers
        </button>}
      </>:<div className="empty"><p><b>No customers in this view.</b> Change the work queue, status or search to see other loaded records.</p></div>)}
      {view==='table'&&(rows.length ? <div className="tablewrap"><table className="table lead-table">
        <thead><tr><th>Name</th><th>Service</th><th className="num">Quote</th><th className="num">Recorded job revenue</th><th>Source</th><th>Status</th><th>Added</th>{!readOnly && <th><span className="sr-only">Actions</span></th>}</tr></thead>
        <tbody>{rows.slice(0, shown).map(l => (
          <tr key={l.id} className={selected === l.id ? 'record-highlight' : undefined}>
            <td data-label="Customer"><b>{l.name || 'Unnamed'}</b><small className="quiet block">{isRealPhone(l.phone) ? <a href={`tel:${l.phone}`}>{shownPhone(l.phone)}</a> : shownPhone(l.phone)}</small><small className="quiet block">{l.address || ''}</small></td>
            <td data-label="Service">{l.service_requested || '-'}</td>
            <td className="num" data-label="Quote">{cash(l.quote_amount)}</td>
            <td className="num" data-label="Recorded job revenue">{l.status==='completed'?cash(l.job_revenue):'—'}</td>
            <td data-label="Source"><span className="tag">{sourceLabel(l.source)}</span></td>
            <td data-label="Status">{readOnly ? statusLabel(l.status) : (
              <select aria-label={`Status of ${l.name}`} className={`status-select is-${l.status}`} value={l.status ?? ''} disabled={busy} onChange={e => { const s = e.target.value; act(() => setLeadStatus(org, l.id, s), () => `${l.name} marked ${statusLabel(s).toLowerCase()}.`); }}>
                {!leadStatuses.some(status=>status===l.status)&&<option value={l.status??''}>{statusLabel(l.status)}</option>}
                {leadStatuses.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
              </select>
            )}</td>
            <td data-label="Added">{day(l.created_at)}</td>
            {!readOnly && <td data-label="Actions"><div className="row-actions">
              {l.status === 'completed' && <button className="secondary small" onClick={() => setPaying(l)} aria-label={`Recorded job figures for ${l.name}`}><DollarSign size={14} aria-hidden="true" />{l.job_revenue===null?'Add':dollars(l.job_revenue)}</button>}
              {l.status !== 'booked' && <button className="secondary small" onClick={() => setBooking(l)}><CalendarPlus size={14} aria-hidden="true" />{isDone(l) ? 'Book again' : 'Book'}</button>}
              <Link className="secondary small" href={`${base}/b/exterior/customer?lead=${encodeURIComponent(l.id)}`}>Profile</Link>
              <Link className="secondary small" href={`${base}/b/exterior/estimate?lead=${encodeURIComponent(l.id)}`}>Estimate</Link>
              <button className="icon-button" aria-label={`Edit ${l.name}`} onClick={() => setEditing({ id: l.id, name: l.name ?? '', phone: l.phone ?? '', address: l.address ?? '', service_requested: l.service_requested ?? '', quote_amount: l.quote_amount ?? '', notes: l.notes ?? '', source: l.source ?? '' })}><Pencil size={15} /></button>
            </div></td>}
          </tr>
        ))}</tbody></table>
        {rows.length > shown && <button className="secondary showmore" onClick={() => setShown(shown + 50)}>Show {Math.min(50, rows.length - shown)} more of {rows.length}</button>}</div>
        : <div className="empty"><p><b>No leads match.</b> Change the filter or search.</p></div>)}
    </section>

    <LeadDialog lead={editing} close={() => setEditing(null)} act={act} busy={busy} org={org} bookings={data.bookings} now={now} />
    <LeadSourceTagger open={tagging} close={() => setTagging(false)} data={data} act={act} busy={busy} org={org} />
    <MoneyDialog lead={paying} close={() => setPaying(null)} act={act} busy={busy} org={org} />
    <BookDialog lead={booking} close={() => setBooking(null)} act={act} busy={busy} org={org} bookings={data.bookings} now={now} />
  </>;
}

/** Adds or edits a lead. A new lead can be booked in the same step. */
export function LeadDialog({ lead, close, act, busy, org, bookings, now, bookNow = false, presetDate = '' }: { lead: LeadInput | null; close: () => void; act: Act; busy: boolean; org: string; bookings: ExtBooking[]; now: Date; bookNow?: boolean; presetDate?: string }) {
  const [f, setF] = useState<LeadInput>(blankLead);
  const [booking, setBooking] = useState(false);
  const [date, setDate] = useState('');
  const [slot, setSlot] = useState('');
  useEffect(() => { if (lead) { setF(lead); setBooking(bookNow); setDate(presetDate); setSlot(''); } }, [lead, bookNow, presetDate]);
  const set = (k: keyof LeadInput) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const sourceKnown = leadSources.some(([id]) => id === f.source);
  const isNew = !lead?.id;
  const submit = () => isNew && booking
    ? act(() => bookNewClient(org, f, date, slot), () => `${f.name} added and booked for ${day(date)}, ${blockLabel(slot)}.`)
    : act(() => saveLead(org, f), () => lead?.id ? 'Lead saved.' : `${f.name} added.`);
  return (
    <Modal title={lead?.id ? `Edit ${lead.name || 'lead'}` : bookNow ? 'Book a new client' : 'New lead'} open={!!lead} onClose={close}>
      <form onSubmit={e => { e.preventDefault(); submit().then(ok => ok && close()); }}>
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
        <label>Notes<textarea rows={2} maxLength={4000} value={f.notes} onChange={set('notes')} /></label>
        {isNew && <label className="checkbox-row"><input type="checkbox" checked={booking} onChange={e => setBooking(e.target.checked)} />Book a job now</label>}
        {isNew && booking && <SlotPicker bookings={bookings} now={now} date={date} slot={slot} setDate={setDate} setSlot={setSlot} />}
        <div className="dialog-actions">
          <span>{lead?.id ? 'Edited fields are kept if the sheet is brought in again.' : booking ? 'Saved as Booked, with the job on the Bookings tab.' : 'Starts as New. Book them any time from the Leads tab.'}</span>
          <button className="primary" disabled={busy || (isNew && booking && (!date || !slot))}>{busy ? 'Saving' : isNew && booking ? 'Add and book' : 'Save lead'}</button>
        </div>
      </form>
    </Modal>
  );
}

export function MoneyDialog({ lead, close, act, busy, org }: { lead: ExtLead | null; close: () => void; act: Act; busy: boolean; org: string }) {
  const [f, setF] = useState({ job_revenue: '', job_cost: '', notes: '' });
  useEffect(() => { if (lead) setF({ job_revenue: lead.job_revenue?.toString() ?? '', job_cost: lead.job_cost?.toString() ?? '', notes: lead.notes ?? '' }); }, [lead]);
  const revenue = f.job_revenue.trim() === '' ? null : Number(f.job_revenue), cost = f.job_cost.trim() === '' ? null : Number(f.job_cost);
  const contribution = revenue === null || cost === null ? null : revenue - cost;
  return (
    <Modal title={`Review recorded job figures: ${lead?.name ?? ''}`} open={!!lead} onClose={close}>
      {lead && <form onSubmit={e => { e.preventDefault(); act(() => saveFinancials(org, lead.id, f), () => 'Recorded job figures saved.').then(ok => ok && close()); }}>
        <p className="quiet">{[lead.service_requested, lead.address].filter(Boolean).join(', ')}. Quoted {cash(lead.quote_amount)}.</p>
        <div className="form-grid">
          <label>Source-recorded job revenue<input type="number" min="0" step="0.01" inputMode="decimal" value={f.job_revenue} onChange={e => setF({ ...f, job_revenue: e.target.value })} /></label>
          <label>Recorded job costs<input type="number" min="0" step="0.01" inputMode="decimal" value={f.job_cost} onChange={e => setF({ ...f, job_cost: e.target.value })} placeholder="Labour, supplies, gas" /></label>
        </div>
        <div className="kpis compact">
            <div><span>Recorded job revenue</span><strong>{revenue === null ? 'Not recorded' : dollars(revenue)}</strong></div>
            <div><span>Expenses</span><strong>{cost === null ? 'Not recorded' : dollars(cost)}</strong></div>
            <div><span>Contribution</span><strong className={contribution !== null && contribution < 0 ? 'neg' : ''}>{contribution === null ? 'Incomplete' : dollars(contribution)}</strong>{revenue !== null && revenue > 0 && contribution !== null && <small className="quiet">{Math.round((contribution / revenue) * 100)}% margin</small>}</div>
        </div>
        <label>Notes<textarea rows={2} maxLength={4000} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} /></label>
          <div className="dialog-actions"><span>These are historical lead-level amounts, not bank-verified customer payments. Reports group them by job date, not collection date. Leave unknown amounts blank; enter 0 only when confirmed.</span><button className="primary" disabled={busy}>{busy ? 'Saving' : 'Save recorded figures'}</button></div>
      </form>}
    </Modal>
  );
}

/**
 * One job, one simple screen: who, where, when, what it was quoted at, and the two numbers that matter, what the customer paid
 * and what the job cost. "Mark complete" closes the job and saves those figures in one go. Everything deeper is behind one link.
 */
export function JobSheet({ booking, lead, close, act, busy, org, readOnly, base, onAdvanced }: { booking: ExtBooking | null; lead: ExtLead | undefined; close: () => void; act: Act; busy: boolean; org: string; readOnly: boolean; base: string; onAdvanced?: () => void }) {
  const [f, setF] = useState({ job_revenue: '', job_cost: '', notes: '' });
  // The itemised cost total when the job has itemised costs; it replaces the single cost box.
  const [itemised, setItemised] = useState<number | null>(null);
  useEffect(() => { if (lead) setF({ job_revenue: lead.job_revenue?.toString() ?? '', job_cost: lead.job_cost?.toString() ?? '', notes: lead.notes ?? '' }); }, [lead?.id, booking?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const revenue = f.job_revenue.trim() === '' ? null : Number(f.job_revenue), cost = itemised !== null ? itemised : f.job_cost.trim() === '' ? null : Number(f.job_cost);
  const profit = revenue === null || cost === null ? null : revenue - cost;
  const done = lead?.status === 'completed' || lead?.status === 'closed';
  const set = (k: 'job_revenue' | 'job_cost' | 'notes') => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const save = (complete: boolean) => {
    if (!lead) return;
    void act(async () => {
      if (complete) { const r = await setLeadStatus(org, lead.id, 'completed'); if (!r.ok) return r; }
      return saveFinancials(org, lead.id, itemised !== null ? { ...f, job_cost: String(itemised) } : f);
    }, () => complete ? `${lead.name ?? 'Job'} completed and saved.` : 'Saved.').then(ok => ok && close());
  };
  return (
    <Modal title={lead?.name || 'Job'} open={!!booking} onClose={close}>
      {booking && <div className="jobsheet">
        <p className="jobsheet-when"><b>{day(booking.date)}</b><span>{blockLabel(booking.time_block)}</span><span className={`jobsheet-state${done ? ' is-done' : ''}`}>{done ? 'Completed' : statusLabel(lead?.status ?? booking.status)}</span></p>
        {!lead ? <p className="quiet">The customer record for this job is not loaded, so figures cannot be saved here.</p> : <>
          <dl className="jobsheet-facts">
            <div><dt>Service</dt><dd>{lead.service_requested || 'Not entered'}</dd></div>
            <div><dt>Quote</dt><dd>{cash(lead.quote_amount)}</dd></div>
            <div><dt>Address</dt><dd>{lead.address || 'Not entered'}</dd></div>
            <div><dt>Phone</dt><dd>{shownPhone(lead.phone)}</dd></div>
          </dl>
          <div className="jobsheet-links">
            {lead.phone && isRealPhone(lead.phone) && <a className="secondary small" href={`tel:${lead.phone}`}>Call</a>}
            {lead.address && <a className="secondary small" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.address)}`}>Directions</a>}
            <Link className="secondary small" href={`${base}/b/exterior/customer?lead=${encodeURIComponent(lead.id)}`}>Customer record</Link>
            {!readOnly && <Link className="secondary small" href={`${base}/invoices?lead=${encodeURIComponent(lead.id)}`}>Invoice this job</Link>}
          </div>
          <fieldset className="jobsheet-money" disabled={readOnly || busy}>
            <legend>Money</legend>
            <div className="form-grid">
              <label>Customer paid (revenue)<input type="number" min="0" step="0.01" inputMode="decimal" value={f.job_revenue} onChange={set('job_revenue')} placeholder="0.00" />
                {lead.quote_amount !== null && f.job_revenue.trim() === '' && <button type="button" className="linkish" onClick={() => setF({ ...f, job_revenue: String(lead.quote_amount) })}>Use the {cash(lead.quote_amount)} quote</button>}</label>
            </div>
            <JobCosts org={org} leadId={lead.id} live={!base.startsWith('/preview')} readOnly={readOnly} act={act} busy={busy} onTotal={setItemised} fallback={<label>Job costs (supplies, gas, help)<input type="number" min="0" step="0.01" inputMode="decimal" value={f.job_cost} onChange={set('job_cost')} placeholder="0.00" /></label>} />
            <p className="jobsheet-profit">Profit <b className={profit !== null && profit < 0 ? 'neg' : ''}>{profit === null ? 'enter both amounts' : dollars(profit)}</b>{profit !== null && revenue ? <small> {Math.round((profit / revenue) * 100)}% margin</small> : null}</p>
            <label>Notes<textarea rows={2} maxLength={4000} value={f.notes} onChange={set('notes')} /></label>
          </fieldset>
          <JobTimeline org={org} leadId={lead.id} live={!base.startsWith('/preview')} />
          <div className="dialog-actions">
            {onAdvanced && <button type="button" className="linkish" onClick={onAdvanced}>Crew, field and closeout details</button>}
            {!readOnly && !done && <button type="button" className="primary" disabled={busy} onClick={() => save(true)}>{busy ? 'Saving' : 'Mark complete and save'}</button>}
            {!readOnly && <button type="button" className={done ? 'primary' : 'secondary'} disabled={busy} onClick={() => save(false)}>{busy ? 'Saving' : 'Save figures'}</button>}
          </div>
        </>}
      </div>}
    </Modal>
  );
}

/** Today and the next three weeks, Thursdays and Fridays marked as the usual job days. */
function nextDays(now: Date) {
  return Array.from({ length: 22 }, (_, i) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + i)).map((d, i) => ({ key: dayKey(d), label: i === 0 ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }), usual: d.getDay() === 4 || d.getDay() === 5 }));
}

const hhmm = (minutes: number | null) => minutes === null ? '' : `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
const fromHhmm = (value: string) => { const m = /^(\d{1,2}):(\d{2})/.exec(value); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };

/**
 * Pick a day, any start time, and how long the job will take. Times that clash with another booking that day, or
 * have already passed, are not accepted, and the screen says why. Reports the finished time (like '4:30-9') or ''.
 */
function SlotPicker({ bookings, now, date, slot, setDate, setSlot, ignoreId }: { bookings: ExtBooking[]; now: Date; date: string; slot: string; setDate: (d: string) => void; setSlot: (s: string) => void; ignoreId?: string }) {
  const days = useMemo(() => nextDays(now), [now]);
  const [start, setStart] = useState<number | null>(null);
  const [length, setLength] = useState(120);
  const block = start === null ? '' : makeBlock(start, length);
  // A booking being edited (or a time chosen elsewhere) brings its own start and length.
  useEffect(() => { const p = parseBlock(slot); if (p && makeBlock(p.start, p.end - p.start) !== block) { setStart(p.start); setLength(p.end - p.start); } }, [slot]); // eslint-disable-line react-hooks/exhaustive-deps
  const today = dayKey(now);
  // Judge the time that was actually picked, not the saved text: '7-8:30' reads back as 7 PM, so a 7 AM pick must be refused here.
  const end = start === null ? null : start + length;
  const inHours = start !== null && end !== null && start >= DAY_FIRST_START && start <= DAY_LAST_START && end <= DAY_LAST_END && length >= MIN_JOB && length <= MAX_JOB;
  const that = bookings.filter(b => b.id !== ignoreId && b.date === date && (b.status === 'confirmed' || b.status === 'pending_approval'));
  const clashes = inHours && date ? that.filter(b => blocksOverlap(b.time_block, block)) : [];
  const passed = inHours && date === today && start! <= now.getHours() * 60 + now.getMinutes();
  const problem = start === null ? '' : !inHours ? `Jobs start between ${clockLabel(DAY_FIRST_START)} and ${clockLabel(DAY_LAST_START + 1)} and finish by ${clockLabel(DAY_LAST_END)}, and last ${MIN_JOB} minutes to ${MAX_JOB / 60} hours.`
    : passed ? 'That time has already passed today.' : clashes.length ? `Overlaps another job: ${clashes.map(b => blockLabel(b.time_block)).join(', ')}.` : '';
  const ok = !!date && inHours && !problem;
  // Only tell the form about a time that can actually be booked.
  useEffect(() => { if (!block) return; const next = ok ? block : ''; if (next !== slot) setSlot(next); }, [block, ok, date]); // eslint-disable-line react-hooks/exhaustive-deps
  return <>
    <fieldset className="day-picker"><legend>Day</legend>
      {days.map(d => <button type="button" key={d.key} aria-pressed={date === d.key} className={d.usual ? 'usual' : ''} onClick={() => setDate(d.key)}>{d.label}</button>)}
      <label className="other-day">Another day<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
    </fieldset>
    <fieldset className="time-picker"><legend>Start time</legend>
      <div className="time-quick">{quickStarts.map(q => <button type="button" key={q} aria-pressed={start === q} onClick={() => setStart(q)}>{clockLabel(q)}</button>)}</div>
      <label className="time-exact">Or any time<input type="time" value={hhmm(start)} onChange={e => setStart(fromHhmm(e.target.value))} /></label>
    </fieldset>
    <fieldset className="length-picker"><legend>How long will the job take?</legend>
      {jobLengths.map(h => <button type="button" key={h} aria-pressed={length === h} onClick={() => setLength(h)}>{lengthLabel(h)}</button>)}
      <label className="length-custom">Other, in minutes<input type="number" min={MIN_JOB} max={MAX_JOB} step={5} inputMode="numeric" value={length} onChange={e => { const n = Math.round(Number(e.target.value)); if (Number.isFinite(n) && n > 0) setLength(Math.min(MAX_JOB, n)); }} /></label>
    </fieldset>
    <div className="slot-summary" role="status" aria-live="polite">
      {problem ? <p className="slot-problem">{problem}</p> : ok && start !== null && end !== null ? <p><b>{clockLabel(start)} to {clockLabel(end)}</b> <span>{lengthLabel(length)}</span></p> : <p className="quiet">{date ? 'Choose a start time and how long it will take.' : 'Choose a day first.'}</p>}
      {!!date && !!that.length && <p className="quiet">Already booked that day: {that.map(b => blockLabel(b.time_block)).join(', ')}.</p>}
    </div>
  </>;
}

const isDone = (l: ExtLead) => l.status === 'completed' || l.status === 'closed';

export function BookDialog({ lead, close, act, busy, org, bookings, now, booking, presetDate = '' }: { lead: ExtLead | null; close: () => void; act: Act; busy: boolean; org: string; bookings: ExtBooking[]; now: Date; booking?: ExtBooking; presetDate?: string }) {
  const [date, setDate] = useState('');
  const [slot, setSlot] = useState('');
  const open = !!lead;
  useEffect(() => { if (open) { setDate(booking?.date ?? presetDate); setSlot(booking?.time_block ?? ''); } }, [open, booking, presetDate]);
  const again = !!lead && !booking && isDone(lead);
  return (
    <Modal title={booking ? `Move ${lead?.name ?? ''}` : `${again ? 'Book again' : 'Book'}: ${lead?.name ?? ''}`} open={open} onClose={close}>
      {lead && <form onSubmit={e => { e.preventDefault(); act(() => booking ? moveBooking(org, booking.id, date, slot) : bookJob(org, lead.id, date, slot), () => booking ? 'Booking moved.' : `${lead.name} booked for ${day(date)}, ${blockLabel(slot)}.`).then(ok => ok && close()); }}>
        <p className="quiet">{[lead.service_requested, cash(lead.quote_amount), lead.address, isRealPhone(lead.phone) ? shownPhone(lead.phone) : null].filter(v => v && v !== '-').join(', ')}</p>
        <SlotPicker bookings={bookings} now={now} date={date} slot={slot} setDate={setDate} setSlot={setSlot} ignoreId={booking?.id} />
        <div className="dialog-actions">
          <span>{booking ? 'Let the customer know about the new time.' : again ? 'Returning client: this books a new job, and their past job and payment stay as they are.' : 'Booked as confirmed, and the lead moves to Booked.'}</span>
          <button className="primary" disabled={busy || !date || !slot}>{busy ? 'Saving' : booking ? 'Move booking' : 'Confirm booking'}</button>
        </div>
      </form>}
    </Modal>
  );
}

/** Choose who to book: anyone already on record, or a new client. */
function ClientPicker({ open, leads, close, pick, fresh }: { open: boolean; leads: ExtLead[]; close: () => void; pick: (l: ExtLead) => void; fresh: () => void }) {
  const [q, setQ] = useState('');
  useEffect(() => { if (open) setQ(''); }, [open]);
  const term = q.trim().toLowerCase();
  // Book the exact saved record. Shared phone/address is NOT verified common identity;
  // collapsing by contact values can hide different owners, tenants or opportunities.
  const people = useMemo(
    () => [...leads].sort((a, b) => (b.updated_at ?? b.created_at).localeCompare(a.updated_at ?? a.created_at) || a.id.localeCompare(b.id)),
    [leads],
  );
  const matches = people.filter(l => !term || [l.name, l.phone, l.address].some(v => (v ?? '').toLowerCase().includes(term))).slice(0, 8);
  return (
    <Modal title="Book a job" open={open} onClose={close}>
      <div className="fields"><label className="wide">Who is it for?<input type="search" autoFocus placeholder="Search by name, phone or address" value={q} onChange={e => setQ(e.target.value)} /></label></div>
      <ul className="client-list">{matches.map(l => (
        <li key={l.id}><button type="button" onClick={() => pick(l)}><b>{l.name || 'Unnamed'}</b><span>{[l.address, isRealPhone(l.phone) ? shownPhone(l.phone) : null].filter(Boolean).join(', ')}</span><small>{isDone(l) ? 'Completed source record' : statusLabel(l.status)} · {sourceLabel(l.source)} · select exact record</small></button></li>
      ))}</ul>
      {!matches.length && <p className="quiet">Nobody matches. Add them as a new client.</p>}
      <div className="dialog-actions"><span>Not on record yet?</span><button type="button" className="primary" onClick={fresh}><Plus size={15} aria-hidden="true" />New client</button></div>
    </Modal>
  );
}

/* ------------------------------ Bookings ------------------------------ */

const toLeadInput = (l: ExtLead): LeadInput => ({ id: l.id, name: l.name ?? '', phone: l.phone ?? '', address: l.address ?? '', service_requested: l.service_requested ?? '', quote_amount: l.quote_amount ?? '', notes: l.notes ?? '', source: l.source ?? '' });

/** Edit a booked job: the customer's details, the day and the time, or cancel it. Used by the Bookings tab and the calendar. */
export function JobDialog({ booking, lead, close, act, busy, org, bookings, now }: { booking: ExtBooking | null; lead: ExtLead | undefined; close: () => void; act: Act; busy: boolean; org: string; bookings: ExtBooking[]; now: Date }) {
  const [f, setF] = useState<LeadInput>(blankLead);
  const [date, setDate] = useState('');
  const [slot, setSlot] = useState('');
  useEffect(() => { if (booking && lead) { setF(toLeadInput(lead)); setDate(booking.date); setSlot(booking.time_block ?? ''); } }, [booking, lead]);
  const set = (k: keyof LeadInput) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const sourceKnown = leadSources.some(([id]) => id === f.source);
  const open = !!booking && !!lead;
  const changedTime = !!booking && (booking.date !== date || booking.time_block !== slot);
  return (
    <Modal title={`Edit job: ${lead?.name || 'customer'}`} open={open} onClose={close}>
      {booking && lead && <form onSubmit={e => { e.preventDefault(); act(() => saveJob(org, booking.id, f, date, slot), r => r.moved ? `Job saved and moved to ${day(date)}, ${blockLabel(slot)}.` : 'Job saved.').then(ok => ok && close()); }}>
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
        <label>Notes<textarea rows={2} maxLength={4000} value={f.notes} onChange={set('notes')} /></label>
        <SlotPicker bookings={bookings} now={now} date={date} slot={slot} setDate={setDate} setSlot={setSlot} ignoreId={booking.id} />
        <div className="dialog-actions">
          <button type="button" className="secondary danger" disabled={busy} onClick={() => { if (window.confirm(`Cancel ${lead.name ?? 'this'} booking on ${day(booking.date)}? The lead goes back to following up.`)) act(() => removeBooking(org, booking.id), () => 'Booking cancelled.').then(ok => ok && close()); }}><Trash2 size={14} aria-hidden="true" />Cancel booking</button>
          <span>{changedTime ? 'Let the customer know about the new time.' : 'Edited fields are kept if the sheet is brought in again.'}</span>
          <button className="primary" disabled={busy || !date || !slot}>{busy ? 'Saving' : changedTime ? 'Save and move' : 'Save job'}</button>
        </div>
      </form>}
    </Modal>
  );
}

type JobCrewEmployee = { user_id: string; display_name: string; active: boolean };
type JobCrewAssignment = { booking_id: string; employee_id: string; employee_name: string; commission_percent: number; instructions: string; checklist: unknown };

function JobAssignmentDialog({ booking, lead, close, act, busy, org, employees, assignment, onSaved }: { booking: ExtBooking | null; lead: ExtLead | undefined; close: () => void; act: Act; busy: boolean; org: string; employees: JobCrewEmployee[]; assignment?: JobCrewAssignment; onSaved: () => void }) {
  const active = employees.filter(employee => employee.active);
  return <Modal title={`Assign job${lead?.service_requested ? ` · ${lead.service_requested}` : ''}`} open={!!booking} onClose={close}>
    {booking && <>
      <p className="quiet job-assignment-context">{day(booking.date)} · {blockLabel(booking.time_block)}{lead?.address ? ` · ${lead.address}` : ''}</p>
      {active.length ? <form onSubmit={event => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const employeeName = active.find(person => person.user_id === form.get('employee'))?.display_name ?? 'employee';
        act(async () => { await saveEmployeeAssignment(org, booking.id, form); return { ok: true }; }, () => `Assigned to ${employeeName}.`).then(ok => { if (ok) { close(); onSaved(); } });
      }}>
        <div className="form-grid">
          <label>Assign to<select name="employee" required defaultValue={assignment?.employee_id ?? ''} disabled={busy}><option value="" disabled>Select employee</option>{active.map(employee => <option key={employee.user_id} value={employee.user_id}>{employee.display_name}</option>)}</select></label>
          <label>Commission for this job (%)<input name="commission_percent" type="number" min="0" max="100" step="0.01" required defaultValue={assignment?.commission_percent ?? 20} disabled={busy} placeholder="20" /></label>
        </div>
        <label>Instructions<textarea name="instructions" maxLength={2000} rows={2} defaultValue={assignment?.instructions ?? ''} disabled={busy} placeholder="Optional instructions only the assigned employee can see" /></label>
        <label>Checklist<textarea name="checklist" maxLength={4000} rows={3} defaultValue={Array.isArray(assignment?.checklist) ? assignment.checklist.map((item: { text?: string }) => item.text ?? '').join('\n') : ''} disabled={busy} placeholder="Optional; one step per line" /></label>
        <div className="dialog-actions"><span>Starts at the usual flat 20%. Earnings use payment collected, not the quote.</span><button className="primary" disabled={busy}>{busy ? 'Saving…' : assignment ? 'Save assignment' : 'Assign job'}</button></div>
      </form> : <div className="empty"><p><b>No active employee account is available.</b> {employees.length ? 'Restore an employee in Employee work, then return here.' : 'Invite Edy first, then return here to assign this job.'}</p><Link className="primary" href="/workspace/employees">{employees.length ? 'Manage employee access' : 'Invite Edy'}</Link></div>}
    </>}
  </Modal>;
}

/**
 * The whole "book a job" path: pick who it is for (or add them), then pick the day and time.
 * `startDate` null means closed; '' opens it with no day chosen; a day opens it with that day chosen.
 */
export function BookFlow({ startDate, close, data, act, busy, org, now }: { startDate: string | null; close: () => void; data: ExteriorData; act: Act; busy: boolean; org: string; now: Date }) {
  const [stage, setStage] = useState<'pick' | 'book' | 'new'>('pick');
  const [lead, setLead] = useState<ExtLead | null>(null);
  useEffect(() => { if (startDate !== null) { setStage('pick'); setLead(null); } }, [startDate]);
  const open = startDate !== null;
  const fresh = useMemo(() => ({ ...blankLead }), [startDate, stage]); // eslint-disable-line react-hooks/exhaustive-deps
  return <>
    <ClientPicker open={open && stage === 'pick'} leads={data.leads} close={close} pick={l => { setLead(l); setStage('book'); }} fresh={() => setStage('new')} />
    <BookDialog lead={open && stage === 'book' ? lead : null} presetDate={startDate ?? ''} close={close} act={act} busy={busy} org={org} bookings={data.bookings} now={now} />
    <LeadDialog lead={open && stage === 'new' ? fresh : null} bookNow presetDate={startDate ?? ''} close={close} act={act} busy={busy} org={org} bookings={data.bookings} now={now} />
  </>;
}

export function BookingsManager({ data, act, busy, readOnly, org, now, crew, refreshCrew }: Common & { crew?: { employees: JobCrewEmployee[]; assignments: JobCrewAssignment[] } | null; refreshCrew: () => void }) {
  const [moving, setMoving] = useState<ExtBooking | null>(null);
  const [editing, setEditing] = useState<ExtBooking | null>(null);
  const [assigning, setAssigning] = useState<ExtBooking | null>(null);
  const [flow, setFlow] = useState<string | null>(null);
  const [focus, setFocus] = useState<BookingWorkFocus>('upcoming');
  const [view, setView] = useState<'cards' | 'table'>('cards');
  const [search, setSearch] = useState('');
  const [shown, setShown] = useState(30);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [completing, setCompleting] = useState<ExtLead | null>(null);
  const base = usePathname().startsWith('/preview') ? '/preview' : '/workspace';
  const bookingParams = useSearchParams();
  const launchNewBooking = bookingParams.get('new');
  const selectedJobId=selectedJob ?? bookingParams.get('booking');
  const selectedBooking=data.bookings.find(b=>b.id===selectedJobId);
  const openJob=(id:string)=>{
    const url=new URL(window.location.href);
    url.searchParams.set('booking',id);
    window.history.replaceState(window.history.state,'',url.pathname+url.search+url.hash);
    setSelectedJob(id);
  };
  const closeJob=()=>{
    const url=new URL(window.location.href);
    url.searchParams.delete('booking');
    window.history.replaceState(window.history.state,'',url.pathname+url.search+url.hash);
    setSelectedJob(null);
    setAdvanced(false);
  };
  useEffect(() => {
    if (readOnly || launchNewBooking !== '1') return;
    setFlow('');
    const url = new URL(window.location.href);
    url.searchParams.delete('new');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  }, [readOnly, launchNewBooking]);

  const today = dayKey(now);
  const month = today.slice(0, 7);
  const lead = useMemo(() => new Map(data.leads.map(l => [l.id, l])), [data.leads]);
  const counts = useMemo(() => bookingWorkCounts(data.bookings, today), [data.bookings, today]);
  const upcoming = data.bookings.filter(b => matchesBookingWorkFocus(b, 'upcoming', today));
  const quoted = useMemo(() => qualifiedDispatchQuotes(data,upcoming),[data,upcoming]);
  const q = search.trim().toLowerCase();
  const rows = sortBookingsForWork(data.bookings.filter(b => {
    if (!matchesBookingWorkFocus(b, focus, today)) return false;
    if (!q) return true;
    const customer = lead.get(b.lead_id ?? '');
    return [customer?.name, customer?.phone, customer?.address, customer?.service_requested, b.date, b.status]
      .some(value => (value ?? '').toLowerCase().includes(q));
  }), focus === 'past');
  const setQueue = (next: BookingWorkFocus) => { setFocus(next); setShown(30); setSearch(''); };
  const statusOf = (b: ExtBooking) => b.status === 'confirmed' ? 'Confirmed' :
    b.status === 'pending_approval' ? 'Pending approval' :
    b.status === 'denied' ? 'Denied' : statusLabel(b.status);
  const actionable = (b: ExtBooking) => !readOnly && b.date >= today && b.status !== 'denied';
  // A finished job: mark the customer's job completed, then open the money form so revenue and costs go in right away.
  const markDone = async (l: ExtLead) => {
    const ok = await act(() => setLeadStatus(org, l.id, 'completed'), () => `${l.name ?? 'Job'} marked completed. Add the money next.`);
    if (ok) setCompleting({ ...l, status: 'completed' });
  };
  const canComplete = (b: ExtBooking, l: ExtLead | undefined) => !readOnly && !!l && l.status === 'booked' && b.status === 'confirmed' && b.date <= today;
  const cancelBooking = (b: ExtBooking, name: string | null) => {
    if (window.confirm(`Cancel ${name || 'this'} booking on ${day(b.date)}? The lead goes back to following up.`))
      void act(() => removeBooking(org, b.id), () => 'Booking cancelled.');
  };

  return <>
    <section className="atlas-booking-command" aria-label="Booking operation queues">
      <header className="atlas-booking-command-head">
        <div><h2>Jobs</h2></div>
        {!readOnly && <button type="button" className="primary" disabled={busy} onClick={() => setFlow('')}><CalendarPlus size={17} aria-hidden="true"/>Book a job</button>}
      </header>
      <div className="atlas-booking-command-stats">
        <div><small>Upcoming bookings</small><strong><NumberFlow value={counts.upcoming} /></strong><span>From today on</span></div>
        <div><small>Confirmed upcoming</small><strong><NumberFlow value={upcoming.filter(b => b.status === 'confirmed').length} /></strong><span>Marked confirmed</span></div>
        <div><small>Quoted value, confirmed jobs</small><strong>{quoted.total===null?'Withheld':<NumberFlow value={quoted.total} format={usd}/>}</strong><span>{quoted.eligible} of {quoted.confirmed} confirmed jobs have one clear quote</span></div>
        <div><small>Bookings this month</small><strong><NumberFlow value={data.bookings.filter(b => b.status !== 'denied' && b.date.startsWith(month)).length} /></strong><span>Scheduled, not necessarily done</span></div>
      </div>
      {data.coverage?.bookings && data.coverage.bookings.total !== null && data.coverage.bookings.total > data.coverage.bookings.loaded &&
        <p className="banner-inline" role="status">Showing {data.coverage.bookings.loaded} of {data.coverage.bookings.total} bookings. Counts cover those only.</p>}
      <div className="atlas-booking-queues" role="group" aria-label="Choose booking queue">
        {bookingWorkFocuses.map(key => <button key={key} type="button" aria-pressed={focus === key}
          onClick={() => setQueue(key)}>
          <strong>{counts[key]}</strong><span>{bookingWorkLabels[key]}</span>
        </button>)}
      </div>
    </section>
    <details className="jobs-headsup">
      <summary>Heads-up for upcoming jobs</summary>
      <ExteriorDispatchPreflight data={data} now={now} base={base} mode={base==='/preview'?'preview':'live'} org={org} readOnly={readOnly}/>
    </details>
    {selectedJobId&&!selectedBooking&&<p className="ecjourney-alert" role="alert">
      The requested exact booking is not in this authorized source window. No customer, job or field data was substituted.
      <button type="button" onClick={closeJob}>Clear selection</button>
    </p>}
    <JobSheet booking={advanced?null:selectedBooking??null} lead={selectedBooking?lead.get(selectedBooking.lead_id??''):undefined} close={closeJob} act={act} busy={busy} org={org} readOnly={readOnly} base={base} onAdvanced={()=>setAdvanced(true)} />
    {selectedBooking&&advanced&&<ExteriorJobContinuity
      key={selectedBooking.id} data={data} booking={selectedBooking} org={org}
      base={base} mode={base==='/preview'?'preview':'live'} readOnly={readOnly}
      crew={{available:!!crew,employeeName:crew?.assignments.find(a=>a.booking_id===selectedBooking.id)?.employee_name??null}}
      close={closeJob}
    />}
    <section className="panel atlas-booking-workbench">
      <header className="panel-head"><h2>Job workbench <small className="quiet">{rows.length} matching record{rows.length === 1 ? '' : 's'}</small></h2>
        <Link className="secondary small" href={`${base}/b/exterior/calendar`}>View calendar</Link>
      </header>
      <div className="atlas-booking-tools">
        <input type="search" aria-label="Search booked jobs" placeholder="Customer, address, date or service" value={search}
          onChange={e => { setSearch(e.target.value); setShown(30); }}/>
        <div role="group" aria-label="Booking display mode">
          <button type="button" aria-pressed={view === 'cards'} onClick={() => setView('cards')}>Job cards</button>
          <button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')}>Compact table</button>
        </div>
      </div>
      {rows.length === 0 ? <div className="empty"><p><b>No bookings match this view.</b> {q ? 'Try another search.' : focus === 'upcoming' ? 'Book a job to populate the upcoming schedule.' : 'Choose another queue to see existing booking records.'}</p></div> : <>
        {view === 'cards' ? <div className="atlas-booking-card-grid" aria-label="Booked job cards">
          {rows.slice(0, shown).map(b => {
            const l = lead.get(b.lead_id ?? '');
            const canEdit = actionable(b);
            const assigned = crew?.assignments.find(a => a.booking_id === b.id);
            return <article key={b.id} className="atlas-booking-card" data-status={b.status ?? 'unknown'}>
              <header><div><small>{day(b.date)} · {blockLabel(b.time_block)}</small>
                <h3>{l?.name || 'Customer record unavailable'}</h3></div>
                <span className="atlas-booking-state">{statusOf(b)}</span>
              </header>
              <div className="atlas-booking-card-fields">
                <div><small>Requested service</small><strong>{l?.service_requested || 'Not entered'}</strong></div>
                <div><small>Entered quote (not paid)</small><strong>{cash(l?.quote_amount ?? null)}</strong></div>
              </div>
              <div className="atlas-booking-card-context">
                {l?.address ? <p>{l.address}</p> : <p>Address not recorded</p>}
                {crew && <p>Crew: {assigned?.employee_name || 'Not assigned in workspace'}</p>}
                {!l && <p>Linked lead is not in the loaded customer records. No contact or quote can be verified here.</p>}
              </div>
              <footer>
                <div className="atlas-booking-contact-actions">
                  <button type="button" className="primary small" onClick={()=>openJob(b.id)}>Open job</button>
                  {l && <Link className="secondary small" href={`${base}/b/exterior/customer?lead=${encodeURIComponent(l.id)}`}>Customer record</Link>}
                  {l&&<Link className="secondary small" href={`${base}/b/exterior/field?booking=${encodeURIComponent(b.id)}`}>Field log</Link>}
                  {l?.phone && isRealPhone(l.phone) && <a className="secondary small" href={`tel:${l.phone}`}>Call {shownPhone(l.phone)}</a>}
                  {l?.address && <a className="secondary small" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(l.address)}`}>Directions</a>}
                </div>
                {(canEdit || canComplete(b, l)) && <div className="atlas-booking-management-actions">
                  {canComplete(b, l) && <button type="button" className="primary small" disabled={busy} onClick={() => void markDone(l!)}>Mark complete</button>}
                  {canEdit && l && <button type="button" className="primary small" disabled={busy} onClick={() => setEditing(b)}><Pencil size={14} aria-hidden="true" />Edit job</button>}
                  {canEdit && l && <button type="button" className="secondary small" disabled={busy} onClick={() => setMoving(b)}>Reschedule</button>}
                  {canEdit && l && crew && <button type="button" className="secondary small" disabled={busy} onClick={() => setAssigning(b)}>{assigned?.employee_name ?? 'Assign crew'}</button>}
                  {canEdit && <button type="button" className="secondary small" disabled={busy} onClick={() => cancelBooking(b, l?.name ?? null)}><Trash2 size={13} aria-hidden="true"/>Cancel</button>}
                </div>}
              </footer>
            </article>;
          })}
        </div> : <div className="tablewrap"><table className="table booking-table">
          <caption className="sr-only">Exact source booking records in the {bookingWorkLabels[focus]} queue</caption>
          <thead><tr><th>Date</th><th>Time</th><th>Customer</th><th>Recorded status</th><th>Service</th><th>Address</th><th className="num">Quote, not paid</th>{!readOnly && <th>Actions</th>}</tr></thead>
          <tbody>{rows.slice(0, shown).map(b => {
            const l = lead.get(b.lead_id ?? '');
            return <tr key={b.id}>
              <td data-label="Date">{day(b.date)}</td><td data-label="Time">{blockLabel(b.time_block)}</td>
              <td data-label="Customer">{l?.name || 'Customer record unavailable'}</td><td data-label="Status">{statusOf(b)}</td>
              <td data-label="Service">{l?.service_requested || '-'}</td><td data-label="Address">{l?.address || '-'}</td>
              <td className="num" data-label="Quoted, not paid">{cash(l?.quote_amount ?? null)}</td>
              {!readOnly && <td data-label="Actions"><div className="row-actions">
                <button type="button" className="primary small" onClick={()=>openJob(b.id)}>Open job</button>
                {l && <Link className="secondary small" href={`${base}/b/exterior/customer?lead=${encodeURIComponent(l.id)}`}>Customer</Link>}
                {l&&<Link className="secondary small" href={`${base}/b/exterior/field?booking=${encodeURIComponent(b.id)}`}>Field log</Link>}
                {canComplete(b, l) && <button className="primary small" disabled={busy} onClick={() => void markDone(l!)}>Mark complete</button>}
                {actionable(b) && <>
                  {l && <button className="secondary small" disabled={busy} onClick={() => setEditing(b)}>Edit</button>}
                  {l && <button className="secondary small" disabled={busy} onClick={() => setMoving(b)}>Move</button>}
                  {l && crew && <button className="secondary small" disabled={busy} onClick={() => setAssigning(b)}>{crew.assignments.find(a => a.booking_id === b.id)?.employee_name || 'Assign'}</button>}
                  <button className="icon-button" aria-label={`Cancel booking for ${l?.name ?? 'lead'}`} disabled={busy} onClick={() => cancelBooking(b, l?.name ?? null)}><Trash2 size={15} /></button>
                </>}
              </div></td>}
            </tr>;
          })}</tbody>
        </table></div>}
        {rows.length > shown && <button type="button" className="secondary showmore" onClick={() => setShown(n => n + 30)}>
          Show {Math.min(30, rows.length - shown)} more bookings
        </button>}
      </>}
    </section>
    <MoneyDialog lead={completing} close={() => setCompleting(null)} act={act} busy={busy} org={org} />
    <BookFlow startDate={flow} close={() => setFlow(null)} data={data} act={act} busy={busy} org={org} now={now} />
    <BookDialog lead={moving ? lead.get(moving.lead_id ?? '') ?? null : null} booking={moving ?? undefined} close={() => setMoving(null)} act={act} busy={busy} org={org} bookings={data.bookings} now={now} />
    <JobDialog booking={editing} lead={editing ? lead.get(editing.lead_id ?? '') : undefined} close={() => setEditing(null)} act={act} busy={busy} org={org} bookings={data.bookings} now={now} />
    {crew && <JobAssignmentDialog booking={assigning} lead={assigning ? lead.get(assigning.lead_id ?? '') : undefined} close={() => setAssigning(null)} act={act} busy={busy} org={org} employees={crew.employees} assignment={crew.assignments.find(row => row.booking_id === assigning?.id)} onSaved={refreshCrew} />}
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
  const base = usePathname().startsWith('/preview') ? '/preview' : '/workspace';
  const [who, setWho] = useState('');
  const people = [...new Set(data.activity.map(a => a.operator).filter(Boolean))] as string[];
  const rows = data.activity.filter(a => !who || a.operator === who);
  return (
    <section className="panel">
      <header className="panel-head"><h2>Activity</h2>
        <label className="quiet">Who <select value={who} onChange={e => setWho(e.target.value)}><option value="">Everyone</option>{people.map(p => <option key={p}>{p}</option>)}</select></label>
      </header>
        {rows.length ? <ol className="operating-activity">{rows.map(a => {
          const matches = a.lead_name ? data.leads.filter(l => l.name === a.lead_name) : [];
          return <li key={a.id}><span className="activity-person" aria-hidden="true">{(a.operator || 'S').charAt(0)}</span><div><b>{a.operator || 'System'}</b><p>{a.description || a.action || 'Record updated'}</p>{matches.length === 1 && <Link href={`${base}/b/exterior/leads?lead=${encodeURIComponent(matches[0].id)}`}>Open {a.lead_name}</Link>}</div><time dateTime={a.created_at}>{new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(a.created_at))}</time></li>;
        })}</ol> : <div className="empty"><p><b>Nothing recorded yet.</b></p></div>}
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

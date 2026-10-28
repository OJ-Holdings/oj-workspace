'use client';

import { useEffect, useMemo, useState } from 'react';
import { bookCommercialVisits } from '@/app/workspace/exterior-actions';
import { loadCommercialAccounts } from '@/app/workspace/commercial-account-actions';
import type { CommercialAccount } from '@/lib/commercial-accounts';
import { frequencyLabel, MAX_DAYS_PER_VISIT, MAX_VISITS, planClashes, planVisits, type Frequency } from '@/lib/commercial-booking';
import { blockLabel, isValidBlock, leadSources, makeBlock, services } from '@/lib/exterior-ops';
import type { ExtBooking } from '@/lib/exterior';
import { OutOfStateFlag } from './OutOfStateFlag';
import { dollars } from '@/lib/metrics';
import { Modal, type Act } from './ExteriorManage';

export type CommercialPrefill = { company?: string; contact?: string; phone?: string; email?: string; address?: string; service?: string; price?: number | null; proposalNumber?: string };

const starts = Array.from({ length: 21 }, (_, i) => 8 * 60 + i * 30).filter(m => m <= 18 * 60);
const clock = (m: number) => `${Math.floor(m / 60) % 12 || 12}:${String(m % 60).padStart(2, '0')} ${m >= 720 ? 'PM' : 'AM'}`;
const lengths = [1, 2, 3, 4, 5, 6, 7, 8];
const pretty = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

/**
 * Books a commercial client onto the calendar: who they are, the site, the price per visit, when the first visit is, how often it repeats, and how many days
 * in a row a big building takes. Every day of the plan is listed, with any clash marked, and nothing is booked until the whole plan fits.
 */
export function CommercialBooking({ open, close, act, busy, org, bookings, today, prefill }: { open: boolean; close: () => void; act: Act; busy: boolean; org: string; bookings: ExtBooking[]; today: string; prefill: CommercialPrefill | null }) {
  const blank = () => ({ company: prefill?.company ?? '', contact: prefill?.contact ?? '', phone: prefill?.phone ?? '', email: prefill?.email ?? '', address: prefill?.address ?? '', service: prefill?.service ?? 'Window Cleaning', price: prefill?.price != null ? String(prefill.price) : '', source: 'lsa', notes: '',
    firstDate: today, start: 9 * 60, hours: 4, frequency: 'once' as Frequency, visits: 4, days: 1 });
  const [f, setF] = useState(blank);
  useEffect(() => { if (open) setF(blank()); }, [open, prefill]); // eslint-disable-line react-hooks/exhaustive-deps
  // The saved company profiles, so a client is picked rather than retyped.
  const [accounts, setAccounts] = useState<CommercialAccount[]>([]);
  useEffect(() => {
    if (!open) return;
    let live = true;
    loadCommercialAccounts(org).then(page => { if (live) setAccounts(page.accounts); }, () => { if (live) setAccounts([]); });
    return () => { live = false; };
  }, [open, org]);
  const account = accounts.find(a => a.name === f.company);
  const pickCompany = (id: string) => {
    const a = accounts.find(x => x.id === id);
    if (!a) return;
    const c = a.contacts[0], p = a.properties[0];
    setF({ ...f, company: a.name, contact: c?.fullName ?? '', phone: c?.phone ?? '', email: c?.email ?? '', address: p?.address ?? '' });
  };

  const block = makeBlock(f.start, f.hours * 60);
  const plan = useMemo(() => planVisits(f.firstDate, f.frequency, f.visits, f.days), [f.firstDate, f.frequency, f.visits, f.days]);
  const clashes = useMemo(() => planClashes(plan, block, bookings, today), [plan, block, bookings, today]);
  const clash = new Map(clashes.map(c => [c.date, c.reason]));
  const visitCount = new Set(plan.map(d => d.visit)).size;
  const price = Number(f.price.replace(/[$,\s]/g, ''));
  const ready = f.company.trim() !== '' && f.phone.replace(/\D/g, '').length >= 10 && isValidBlock(block) && f.firstDate >= today && clashes.length === 0;
  const set = (k: keyof ReturnType<typeof blank>) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  return (
    <Modal title="Book a commercial client" open={open} onClose={close}>
      <form className="commercial-book" onSubmit={e => {
        e.preventDefault();
        void act(() => bookCommercialVisits(org, { company: f.company, contact: f.contact, phone: f.phone, email: f.email, address: f.address, service: f.service, pricePerVisit: f.price.trim() === '' ? null : f.price, source: f.source, notes: f.notes,
          firstDate: f.firstDate, timeBlock: block, frequency: f.frequency, visits: f.visits, daysPerVisit: f.days, proposalNumber: prefill?.proposalNumber }),
          r => `Booked ${r.days} day${r.days === 1 ? '' : 's'} for ${f.company}${r.visits > 1 ? ` across ${r.visits} visits` : ''}.`).then(ok => ok && close());
      }}>
        {accounts.length > 0 && <label>Saved company<select value={account?.id ?? ''} onChange={e => pickCompany(e.target.value)}><option value="">Choose a saved company, or type a new one below</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}
        {account && (account.properties.length > 1 || account.contacts.length > 1) && <div className="form-grid">
          {account.properties.length > 1 && <label>Property<select value={account.properties.find(p => p.address === f.address)?.id ?? ''} onChange={e => setF({ ...f, address: account.properties.find(p => p.id === e.target.value)?.address ?? f.address })}>{account.properties.map(p => <option key={p.id} value={p.id}>{p.name || p.address}</option>)}</select></label>}
          {account.contacts.length > 1 && <label>Contact<select value={account.contacts.find(c => c.fullName === f.contact)?.id ?? ''} onChange={e => { const c = account.contacts.find(x => x.id === e.target.value); if (c) setF({ ...f, contact: c.fullName, phone: c.phone, email: c.email }); }}>{account.contacts.map(c => <option key={c.id} value={c.id}>{c.fullName}{c.role ? ` (${c.role})` : ''}</option>)}</select></label>}
        </div>}
        <div className="form-grid">
          <label>Company<input required maxLength={255} value={f.company} onChange={set('company')} placeholder="American Roller Company" /></label>
          <label>Contact name<input maxLength={200} value={f.contact} onChange={set('contact')} /></label>
          <label>Contact phone<input required type="tel" maxLength={40} value={f.phone} onChange={set('phone')} placeholder="(262) 555-0123" /></label>
          <label>Email<input type="email" maxLength={200} value={f.email} onChange={set('email')} /></label>
        </div>
        <label>Site address<input maxLength={500} value={f.address} onChange={set('address')} placeholder="Street, city, state" /><OutOfStateFlag address={f.address} /></label>
        <div className="form-grid">
          <label>Service<input list="oj-services" maxLength={255} value={f.service} onChange={set('service')} /></label>
          <label>Price per visit ($)<input type="number" min="0" step="0.01" inputMode="decimal" value={f.price} onChange={set('price')} placeholder="950.00" /></label>
          <label>Where they came from<select value={f.source} onChange={set('source')}>{leadSources.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        </div>
        <datalist id="oj-services">{services.map(s => <option key={s} value={s} />)}</datalist>
        <fieldset className="commercial-when">
          <legend>When</legend>
          <div className="form-grid">
            <label>First visit<input type="date" required min={today} value={f.firstDate} onChange={set('firstDate')} /></label>
            <label>Start time<select value={f.start} onChange={e => setF({ ...f, start: Number(e.target.value) })}>{starts.map(m => <option key={m} value={m}>{clock(m)}</option>)}</select></label>
            <label>Hours each day<select value={f.hours} onChange={e => setF({ ...f, hours: Number(e.target.value) })}>{lengths.map(h => <option key={h} value={h}>{h}</option>)}</select></label>
            <label>Days in a row per visit<select value={f.days} onChange={e => setF({ ...f, days: Number(e.target.value) })}>{Array.from({ length: MAX_DAYS_PER_VISIT }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d === 1 ? '1 day' : `${d} days`}</option>)}</select></label>
            <label>Repeats<select value={f.frequency} onChange={e => setF({ ...f, frequency: e.target.value as Frequency })}>{(Object.keys(frequencyLabel) as Frequency[]).map(k => <option key={k} value={k}>{frequencyLabel[k]}</option>)}</select></label>
            {f.frequency !== 'once' && <label>Number of visits<select value={f.visits} onChange={e => setF({ ...f, visits: Number(e.target.value) })}>{Array.from({ length: MAX_VISITS }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}</select></label>}
          </div>
          <p className="quiet">{blockLabel(block)} each day. Sundays are skipped.</p>
        </fieldset>
        <ol className="commercial-plan" aria-label="Days that will be booked">
          {plan.map(d => <li key={d.date} className={clash.has(d.date) ? 'is-clash' : undefined}><span>{pretty(d.date)}</span><span>{visitCount > 1 ? `Visit ${d.visit}` : ''}</span><b>{clash.get(d.date) === 'past' ? 'In the past' : clash.get(d.date) === 'taken' ? 'Time already booked' : 'Free'}</b></li>)}
        </ol>
        <label>Notes<textarea rows={2} maxLength={2000} value={f.notes} onChange={set('notes')} placeholder="Access, parking, who to check in with" /></label>
        <div className="dialog-actions">
          <span>{plan.length} day{plan.length === 1 ? '' : 's'}{visitCount > 1 ? ` in ${visitCount} visits` : ''}{Number.isFinite(price) && price > 0 ? `, ${dollars(price * visitCount)} total at ${dollars(price)} a visit` : ''}.{clashes.length ? ` ${clashes.length} day${clashes.length === 1 ? '' : 's'} cannot be booked. Change the date or time.` : ''}</span>
          <button className="primary" disabled={busy || !ready}>{busy ? 'Booking' : `Book ${plan.length} day${plan.length === 1 ? '' : 's'}`}</button>
        </div>
      </form>
    </Modal>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { loadExterior } from '@/app/workspace/exterior-actions';
import { addProperty, loadCustomers, mergeCustomers, saveCustomer, saveProperty, syncCustomers, type CustomersLoad } from '@/app/workspace/customer-actions';
import { buildDirectory, filterDirectory, segmentCounts, segmentLabels, type DirectoryRow, type Segment } from '@/lib/customers';
import { statusLabel, type ExteriorData } from '@/lib/exterior';
import { jobDate } from '@/lib/exterior';
import { businessDay } from '@/lib/reporting';
import { dollars } from '@/lib/metrics';
import { Modal, type Act } from './ExteriorManage';
import { CommercialAccounts } from './CommercialAccounts';

const shortDate = (key: string | null) => key ? new Date(key + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-';
const SEGMENTS = Object.keys(segmentLabels) as Segment[];

/** The customer directory (master plan 6.2): one record per person or company with their properties, jobs, lifetime value and when they are next due. */
export function CustomersView({ org, mode, readOnly, base }: { org: string; mode: 'preview' | 'live'; readOnly: boolean; base: string }) {
  const [load, setLoad] = useState<CustomersLoad | null>(null);
  const [ext, setExt] = useState<ExteriorData | null>(null);
  const [segment, setSegment] = useState<Segment>('all');
  const [search, setSearch] = useState('');
  const [shown, setShown] = useState(40);
  const [openId, setOpenId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<'directory' | 'commercial'>('directory');
  const today = useMemo(() => businessDay(new Date().toISOString()) ?? new Date().toISOString().slice(0, 10), []);

  const refresh = useCallback(async () => {
    const [c, e] = await Promise.all([loadCustomers(org), loadExterior(org)]);
    setLoad(c); if (e.ok) setExt(e.data);
  }, [org]);
  useEffect(() => { if (mode === 'live') void refresh(); }, [mode, refresh]);

  const rows = useMemo(() => (load && load.ok && ext ? buildDirectory(load.customers, load.properties, load.links, ext.leads) : []), [load, ext]);
  const visible = useMemo(() => filterDirectory(rows, segment, search, today), [rows, segment, search, today]);
  const counts = useMemo(() => segmentCounts(rows, today), [rows, today]);

  const tabs = <nav className="subtabs" aria-label="Customers views"><Link href={`${base}/b/exterior/leads`}>Pipeline</Link>
    <button type="button" aria-current={view === 'directory' ? 'page' : undefined} onClick={() => setView('directory')}>Directory</button>
    <button type="button" aria-current={view === 'commercial' ? 'page' : undefined} onClick={() => setView('commercial')}>Commercial</button></nav>;
  if (mode === 'preview') return <>{tabs}<section className="panel"><p className="quiet">The customer directory works in your live workspace. The sample workspace does not keep customers.</p></section></>;
  if (!load || !ext) return <>{tabs}<div className="loading" aria-busy="true" /></>;
  if (!load.ok) {
    return <>{tabs}<section className="panel" role="status">
      <h2>{load.reason === 'not-set-up' ? 'The customer directory is not switched on yet' : load.reason === 'no-access' ? 'Members only' : 'Customers did not load'}</h2>
      <p className="quiet">{load.reason === 'not-set-up' ? 'It needs one small database update. Until then the Pipeline tab works as before.' : load.reason === 'no-access' ? 'Ask a founder for member access.' : 'Try again in a moment.'}</p>
      {load.reason === 'failed' && <button className="secondary" onClick={() => void refresh()}>Try again</button>}
    </section></>;
  }

  const linked = new Set(load.links.map(k => k.lead_id));
  const unlinked = ext.leads.filter(l => !linked.has(l.id)).length;
  const run = async (work: () => Promise<{ ok: boolean; message?: string }>, success: string) => {
    setBusy(true); setNotice('');
    try { const r = await work(); if (!r.ok) { setNotice(r.message ?? 'That did not go through.'); return false; } setNotice(success); await refresh(); return true; }
    catch { setNotice('That did not go through. Try again.'); return false; } finally { setBusy(false); }
  };
  /** Runs one change the way the Exterior pages do: says what happened and reloads. */
  const act: Act = async (work, success) => {
    setBusy(true); setNotice('');
    try { const r = await work(); if (!r.ok) { setNotice(r.message); return false; } setNotice(success(r)); await refresh(); return true; }
    catch { setNotice('That did not go through. Check your connection and try again.'); return false; } finally { setBusy(false); }
  };
  const revenue = rows.reduce((t, r) => t + (r.lifetimeRevenue ?? 0), 0);
  const open = rows.find(r => r.customer.id === openId) ?? null;

  return <>
    {tabs}
    <p className="notice" role="status" aria-live="polite">{notice}</p>
    {view === 'commercial' ? <>
      <p className="quiet">Company profiles with their contacts and properties. Open one to book a visit. <Link href={`${base}/b/exterior/commercial`}>Estimates and project work</Link></p>
      <CommercialAccounts org={org} base={base} mode={mode} readOnly={readOnly} booking={readOnly ? undefined : { act, busy, bookings: ext.bookings, today }} />
    </> : <>
    {unlinked > 0 && !readOnly && <section className="panel"><p><b>{unlinked} job{unlinked === 1 ? '' : 's'} not in the directory yet.</b> Sync builds a customer and property for each person, matching by phone, then name and address.</p>
      <button className="primary" disabled={busy} onClick={() => void run(() => syncCustomers(org), 'Customers synced.')}>{busy ? 'Syncing' : 'Sync customers'}</button></section>}
    <div className="kpis">
      <div><span>Customers</span><strong>{rows.length}</strong></div>
      <div><span>Repeat customers</span><strong>{counts.repeat}</strong></div>
      <div><span>Due to rebook</span><strong>{counts.due}</strong></div>
      <div><span>Lifetime revenue</span><strong>{dollars(revenue)}</strong><small className="quiet">where job revenue is entered</small></div>
    </div>
    <section className="panel">
      <div className="filter-chips" role="group" aria-label="Customer segments">
        {SEGMENTS.map(s => <button key={s} aria-pressed={segment === s} onClick={() => { setSegment(s); setShown(40); }}>{segmentLabels[s]} <span>{counts[s]}</span></button>)}
      </div>
      <input type="search" aria-label="Search customers" placeholder="Name, phone or address" value={search} onChange={e => { setSearch(e.target.value); setShown(40); }} />
      {visible.length === 0 ? <div className="empty"><p><b>No customers match.</b></p></div> : <ul className="customer-list">
        {visible.slice(0, shown).map(r => <li key={r.customer.id}><button type="button" onClick={() => setOpenId(r.customer.id)}>
          <span><b>{r.customer.name}</b><small>{r.properties[0]?.address ?? r.customer.phone ?? 'No address or phone'}{r.properties.length > 1 ? ` and ${r.properties.length - 1} more` : ''}</small></span>
          <span className="num">{r.completed} job{r.completed === 1 ? '' : 's'}</span>
          <span className="num">{r.lifetimeRevenue === null ? '-' : dollars(r.lifetimeRevenue)}</span>
          <span className="num">{r.nextDue ? `due ${shortDate(r.nextDue)}` : r.hasOpenJob ? 'open job' : '-'}</span>
        </button></li>)}
      </ul>}
      {visible.length > shown && <button className="secondary showmore" onClick={() => setShown(n => n + 40)}>Show {Math.min(40, visible.length - shown)} more</button>}
    </section>
    <CustomerDialog row={open} rows={rows} close={() => setOpenId(null)} base={base} readOnly={readOnly} busy={busy} run={run} org={org} />
    </>}
  </>;
}

function CustomerDialog({ row, rows, close, base, readOnly, busy, run, org }: { row: DirectoryRow | null; rows: DirectoryRow[]; close: () => void; base: string; readOnly: boolean; busy: boolean; run: (w: () => Promise<{ ok: boolean; message?: string }>, s: string) => Promise<boolean>; org: string }) {
  const [c, setC] = useState({ name: '', phone: '', email: '', notes: '', kind: 'person' });
  const [props, setProps] = useState<Record<string, { label: string; address: string; access_notes: string; water_notes: string; surface_notes: string }>>({});
  const [newAddress, setNewAddress] = useState('');
  const [mergeId, setMergeId] = useState('');
  useEffect(() => {
    if (!row) return;
    setC({ name: row.customer.name, phone: row.customer.phone ?? '', email: row.customer.email ?? '', notes: row.customer.notes, kind: row.customer.kind });
    setProps(Object.fromEntries(row.properties.map(p => [p.id, { label: p.label, address: p.address, access_notes: p.access_notes, water_notes: p.water_notes, surface_notes: p.surface_notes }])));
    setNewAddress(''); setMergeId('');
  }, [row?.customer.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const setProp = (id: string, patch: Partial<(typeof props)[string]>) => setProps({ ...props, [id]: { ...props[id], ...patch } });
  return (
    <Modal title={row?.customer.name ?? 'Customer'} open={!!row} onClose={close}>
      {row && <div className="customer-sheet">
        <fieldset disabled={readOnly || busy} className="customer-contact">
          <legend>Contact</legend>
          <div className="form-grid">
            <label>Name<input maxLength={200} value={c.name} onChange={e => setC({ ...c, name: e.target.value })} /></label>
            <label>Phone<input type="tel" maxLength={40} value={c.phone} onChange={e => setC({ ...c, phone: e.target.value })} /></label>
            <label>Email<input type="email" maxLength={200} value={c.email} onChange={e => setC({ ...c, email: e.target.value })} /></label>
            <label>Type<select value={c.kind} onChange={e => setC({ ...c, kind: e.target.value })}><option value="person">Person</option><option value="company">Company</option></select></label>
          </div>
          <label>Notes<textarea rows={2} maxLength={2000} value={c.notes} onChange={e => setC({ ...c, notes: e.target.value })} /></label>
          <button type="button" className="secondary small" onClick={() => void run(() => saveCustomer(org, row.customer.id, c), 'Customer saved.')}>Save contact</button>
        </fieldset>

        <h3>Properties</h3>
        {row.properties.length === 0 && <p className="quiet">No address on file yet.</p>}
        {row.properties.map(p => props[p.id] && <fieldset key={p.id} disabled={readOnly || busy} className="customer-property">
          <label>Address<input maxLength={500} value={props[p.id].address} onChange={e => setProp(p.id, { address: e.target.value })} /></label>
          <div className="form-grid">
            <label>Gate, pets, access<textarea rows={2} maxLength={1000} value={props[p.id].access_notes} onChange={e => setProp(p.id, { access_notes: e.target.value })} placeholder="Gate code, dog in the yard, park on the street" /></label>
            <label>Water source<textarea rows={2} maxLength={500} value={props[p.id].water_notes} onChange={e => setProp(p.id, { water_notes: e.target.value })} placeholder="Spigot on the north wall" /></label>
            <label>Surfaces and what worked<textarea rows={2} maxLength={1000} value={props[p.id].surface_notes} onChange={e => setProp(p.id, { surface_notes: e.target.value })} placeholder="Cedar siding, low pressure" /></label>
          </div>
          <button type="button" className="secondary small" onClick={() => void run(() => saveProperty(org, p.id, props[p.id]), 'Property saved.')}>Save property</button>
        </fieldset>)}
        {!readOnly && <div className="customer-addprop"><input maxLength={500} aria-label="New property address" placeholder="Add another address" value={newAddress} onChange={e => setNewAddress(e.target.value)} />
          <button type="button" className="secondary small" disabled={busy || !newAddress.trim()} onClick={async () => { if (await run(() => addProperty(org, row.customer.id, { label: '', address: newAddress }), 'Property added.')) setNewAddress(''); }}>Add</button></div>}

        <h3>Jobs</h3>
        {row.jobs.length === 0 ? <p className="quiet">No jobs linked.</p> : <ul className="customer-jobs">
          {row.jobs.map(j => <li key={j.id}><span>{shortDate(businessDay(jobDate(j)))}</span><span>{j.service_requested || 'Service not entered'}</span><span>{statusLabel(j.status)}</span><span className="num">{j.job_revenue !== null ? dollars(j.job_revenue) : j.quote_amount !== null ? `quoted ${dollars(j.quote_amount)}` : '-'}</span>
            <Link className="secondary small" href={`${base}/b/exterior/customer?lead=${encodeURIComponent(j.id)}`}>Open</Link></li>)}
        </ul>}

        {!readOnly && rows.length > 1 && <details className="customer-merge"><summary>Merge a duplicate into this customer</summary>
          <div className="customer-addprop">
            <select aria-label="Duplicate to merge in" value={mergeId} onChange={e => setMergeId(e.target.value)}><option value="">Choose the duplicate</option>{rows.filter(r => r.customer.id !== row.customer.id).map(r => <option key={r.customer.id} value={r.customer.id}>{r.customer.name}{r.properties[0] ? `, ${r.properties[0].address}` : ''}</option>)}</select>
            <button type="button" className="secondary small" disabled={busy || !mergeId} onClick={async () => { if (window.confirm('Merge this customer into the one you have open? Their properties and jobs move over and the duplicate is removed.')) { if (await run(() => mergeCustomers(org, row.customer.id, mergeId), 'Customers merged.')) setMergeId(''); } }}>Merge</button>
          </div></details>}
      </div>}
    </Modal>
  );
}

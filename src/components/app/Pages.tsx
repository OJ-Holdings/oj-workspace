'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import NumberFlow from '@number-flow/react';
import { CalendarPlus, ChevronLeft, ChevronRight, Download, FileArchive, FileSpreadsheet, FileText, Plus, Send, Trash2, Upload } from 'lucide-react';
import { isVenture, ventureList, ventures, type VentureId } from '@/lib/ventures';
import { dayKey, documentTags, fileKind, fileSize, lastMonths, leadStages, monthlyTotals, relativeDay, type Dashboard, type DocumentItem, type EventItem, type Lead, type LeadStage } from '@/lib/dashboard';
import { dollars, money } from '@/lib/metrics';
import type { Card } from '@/lib/board';
import { LineChart } from './Charts';
import type { DashboardStore } from './useDashboard';
import type { JobItem } from '@/app/workspace/exterior-actions';
import { blockLabel, parseBlock } from '@/lib/exterior-ops';
import { businessDay, operationalAnalytics, type AnalyticsFilters } from '@/lib/reporting';

const color = (v: VentureId | null | 'shared') => `var(--c-${v ?? 'shared'})`;
const short = (v: VentureId | null) => v ? ventures[v].short : 'Shared';
type Common = { store: DashboardStore; readOnly: boolean; venture?: VentureId };

/** Shown instead of a page when the live database does not have the dashboard tables yet. */
export function NeedsSetup({ what }: { what: string }) {
  return (
    <div className="planned">
      <h2>One step left to switch this on</h2>
      <p>{what} is built, but your database does not have its tables yet. A founder needs to approve one database update (supabase/schemas/dashboard.sql). Nothing is lost by waiting, and the task board is unaffected.</p>
    </div>
  );
}
/** Renders `children()` only once the records are loaded, so pages can read `store.data` without null checks. */
function Gate({ store, what, children }: { store: DashboardStore; what: string; children: () => ReactNode }) {
  if (store.missing) return <NeedsSetup what={what} />;
  if (!store.data || !store.now) return <div className="loading" aria-busy="true" />;
  return <>{children()}</>;
}
function VentureSelect({ value, onChange, allowShared, disabled }: { value: VentureId | null; onChange: (v: VentureId | null) => void; allowShared?: boolean; disabled?: boolean }) {
  return (
    <select aria-label="Business" value={value ?? ''} disabled={disabled} onChange={e => onChange((e.target.value || null) as VentureId | null)}>
      {allowShared && <option value="">Shared (all businesses)</option>}
      {ventureList.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
    </select>
  );
}
const Notice = ({ store }: { store: DashboardStore }) => <p className="notice" role="status" aria-live="polite">{store.notice}</p>;

/* ------------------------------ Messages ------------------------------ */
export function MessagesView({ store, readOnly }: Common) {
  const selected = useSearchParams().get('message');
  const [thread, setThread] = useState<VentureId | null | 'all'>('all');
  const [body, setBody] = useState('');
  return (
    <Gate store={store} what="Messages">{() => (
      <div className="split">
        <nav className="threads" aria-label="Threads">
          {([['all', 'Everything'], [null, 'Shared'], ...ventureList.map(v => [v.id, v.short])] as [VentureId | null | 'all', string][]).map(([id, label]) => (
            <button key={String(id)} aria-pressed={thread === id} onClick={() => setThread(id)}>
              {id !== 'all' && <i style={{ background: color(id) }} />}{label}
              <span>{store.data!.messages.filter(m => id === 'all' || m.venture === id).length}</span>
            </button>
          ))}
        </nav>
        <section className="panel thread" aria-label="Messages">
          {!readOnly && (
            <form className="composer" onSubmit={e => { e.preventDefault(); if (body.trim()) store.sendMessage(thread === 'all' ? null : thread, body, () => setBody('')); }}>
              <textarea aria-label="Write a message" rows={2} maxLength={4000} value={body} onChange={e => setBody(e.target.value)} placeholder={`Write to ${thread === 'all' || thread === null ? 'the shared thread' : ventures[thread].short}`} />
              <button className="primary" disabled={store.pending || !body.trim()}><Send size={15} aria-hidden="true" />Send</button>
            </form>
          )}
          <Notice store={store} />
          <ul className="messages">
            {store.data!.messages.filter(m => thread === 'all' || m.venture === thread).map(m => (
              <li key={m.id} id={`record-${m.id}`} className={selected === m.id ? 'record-highlight' : undefined}>
                <span className="avatar">{m.author.charAt(0).toUpperCase()}</span>
                <div><b>{m.author}<span className="tag" style={{ '--tag': color(m.venture) } as React.CSSProperties}>{short(m.venture)}</span><time>{relativeDay(m.created_at, store.now!)}</time></b><p>{m.body}</p></div>
              </li>
            ))}
          </ul>
          {store.data!.messages.filter(m => thread === 'all' || m.venture === thread).length === 0 && <div className="empty"><p><b>No messages here yet.</b> Write the first one above.</p></div>}
        </section>
      </div>
    )}</Gate>
  );
}

/* ------------------------------ Leads & CRM ------------------------------ */
const blankLead = (venture: VentureId): Omit<Lead, 'created_at'> => ({ id: crypto.randomUUID(), venture, name: '', contact: '', stage: 'New', value: null, source: '', notes: '' });
export function CrmView({ store, readOnly, venture }: Common) {
  const selected = useSearchParams().get('lead');
  const path = usePathname();
  const base = path.startsWith('/preview') ? '/preview' : '/workspace';
  const opened = useRef<string | null>(null);
  const [filter, setFilter] = useState<VentureId | 'all'>(venture ?? 'all');
  const [draft, setDraft] = useState<(Omit<Lead, 'created_at'> & { isNew: boolean }) | null>(null);
  const scope = venture ?? filter;
  useEffect(() => {
    if (!selected || opened.current === selected || !store.data) return;
    const found = store.data.leads.find(l => l.id === selected);
    if (found) { setFilter(found.venture); setDraft({ ...found, isNew: false }); opened.current = selected; }
  }, [selected, store.data]);
  return (
    <Gate store={store} what="Leads and CRM">{() => <>
      <div className="toolbar">
        {!venture && (
          <div className="seg" role="group" aria-label="Filter by business">
            {[['all', 'All businesses'] as const, ...ventureList.map(v => [v.id, v.short] as const)].map(([id, label]) => <button key={id} aria-pressed={filter === id} className={filter === id ? 'is-on' : ''} onClick={() => setFilter(id)}><span>{label}</span></button>)}
          </div>
        )}
        {!readOnly && <button className="primary" onClick={() => setDraft({ ...blankLead(scope === 'all' ? 'exterior' : scope), isNew: true })}><Plus size={16} aria-hidden="true" />New lead</button>}
      </div>
      <Notice store={store} />
      {draft && (
        <form className="panel formpanel" onSubmit={e => { e.preventDefault(); if (readOnly || store.pending) return; const { isNew, ...lead } = draft; store.saveLead(lead, isNew, () => setDraft(null)); }}>
          <h2>{draft.isNew ? 'New lead' : readOnly ? 'Lead details' : 'Edit lead'}</h2>
          <fieldset className="fields" disabled={readOnly || store.pending}>
            <label>Name or job<input required autoFocus maxLength={160} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
            <label>Business<VentureSelect value={draft.venture} onChange={v => v && setDraft({ ...draft, venture: v })} /></label>
            <label>Contact<input maxLength={200} value={draft.contact} onChange={e => setDraft({ ...draft, contact: e.target.value })} placeholder="Phone or email" /></label>
            <label>Stage<select value={draft.stage} onChange={e => setDraft({ ...draft, stage: e.target.value as LeadStage })}>{leadStages.map(s => <option key={s}>{s}</option>)}</select></label>
            <label>Value in dollars<input type="number" min="0" step="0.01" inputMode="decimal" value={draft.value ?? ''} onChange={e => setDraft({ ...draft, value: e.target.value === '' ? null : Number(e.target.value) })} /></label>
            <label>Source<input maxLength={120} value={draft.source} onChange={e => setDraft({ ...draft, source: e.target.value })} placeholder="Website, referral, door knocking" /></label>
            <label className="wide">Notes<textarea rows={2} maxLength={4000} value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} /></label>
          </fieldset>
          <div className="formactions">{!readOnly && !draft.isNew && <Link className="secondary" href={`${base}/tasks?sourceLead=${encodeURIComponent(draft.id)}`}>Create follow-up task</Link>}<button type="button" className="secondary" onClick={() => setDraft(null)}>Close</button><button className="primary" disabled={store.pending || readOnly}>Save lead</button></div>
        </form>
      )}
      <div className="pipeline-board">
        {leadStages.map(stage => {
          const rows = store.data!.leads.filter(l => l.stage === stage && (scope === 'all' || l.venture === scope));
          const total = rows.reduce((sum, l) => sum + (l.value ?? 0), 0);
          return (
            <section key={stage} className="column" data-lead-stage={stage}>
              <header><h2>{stage}</h2><span className="column-count">{rows.length}</span>{total > 0 && <span className="column-sum">{money(total)}</span>}</header>
              <div className="column-cards">
                {rows.map(lead => (
                  <article key={lead.id} className="taskcard leadcard" data-venture-tag={lead.venture}>
                    <button className="taskcard-open" onClick={() => setDraft({ ...lead, isNew: false })}>
                      <div className="taskcard-tags"><span className="tag" style={{ '--tag': color(lead.venture) } as React.CSSProperties}>{short(lead.venture)}</span>{lead.value !== null && <b>{dollars(lead.value)}</b>}</div>
                      <h3>{lead.name}</h3>
                      {(lead.contact || lead.source) && <p>{[lead.contact, lead.source].filter(Boolean).join(' / ')}</p>}
                    </button>
                    {!readOnly && (
                      <label className="move">Move to
                        <select aria-label={`Move ${lead.name}`} value={lead.stage} disabled={store.pending} onChange={e => store.saveLead({ ...lead, stage: e.target.value as LeadStage }, false)}>{leadStages.map(s => <option key={s}>{s}</option>)}</select>
                        <button className="icon-button" aria-label={`Remove ${lead.name}`} onClick={() => { if (window.confirm(`Remove the lead "${lead.name}"?`)) store.remove('lead', lead.id); }}><Trash2 size={14} /></button>
                      </label>
                    )}
                  </article>
                ))}
                {rows.length === 0 && <p className="column-empty">None</p>}
              </div>
            </section>
          );
        })}
      </div>
    </>}</Gate>
  );
}

/* ------------------------------ Finance ------------------------------ */
export function FinanceView({ store, readOnly, venture, owner = false }: Common & { owner?: boolean }) {
  const blank = () => ({ venture: venture ?? 'exterior' as VentureId, kind: 'revenue' as const, amount: '', occurred_on: store.now ? dayKey(store.now) : '', category: '', note: '' });
  const [form, setForm] = useState<{ venture: VentureId; kind: 'revenue' | 'cost'; amount: string; occurred_on: string; category: string; note: string } | null>(null);
  return (
    <Gate store={store} what="Finance">
      {() => <FinanceBody store={store} readOnly={readOnly} venture={venture} owner={owner} form={form} setForm={setForm} blank={blank} />}
    </Gate>
  );
}
function FinanceBody({ store, readOnly, venture, owner = false, form, setForm, blank }: Common & { owner?: boolean; form: ReturnType<typeof Object> | null; setForm: (f: any) => void; blank: () => any }) {
  const now = store.now!, data = store.data!;
  const [shown, setShown] = useState(12);
  const query = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const selectedEntry = query.get('entry');
  const filterBusiness = venture ?? (isVenture(query.get('business') ?? '') ? query.get('business') as VentureId : null);
  const filterMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(query.get('month') ?? '') ? query.get('month')! : '';
  const scope = filterBusiness ? [ventures[filterBusiness]] : ventureList;
  const month = filterMonth || dayKey(now).slice(0, 7);
  const pick = (key: string, value: string) => { const next = new URLSearchParams(query.toString()); if (value) next.set(key, value); else next.delete(key); setShown(12); router.replace(`${pathname}?${next}`, { scroll: false }); };
  const entries = data.finance.filter(f => (!filterBusiness || f.venture === filterBusiness) && (!filterMonth || f.occurred_on.startsWith(filterMonth))).sort((a, b) => b.occurred_on.localeCompare(a.occurred_on));
  useEffect(() => {
    if (!selectedEntry) return;
    const index = entries.findIndex(f => f.id === selectedEntry);
    if (index >= 0) setShown(n => Math.max(n, index + 1));
  }, [selectedEntry, data.finance]);
  useEffect(() => { if (selectedEntry) document.getElementById(`finance-${selectedEntry}`)?.scrollIntoView({ block: 'center' }); }, [selectedEntry, shown]);
  const sum = (kind: 'revenue' | 'cost') => entries.filter(f => f.kind === kind && f.occurred_on.startsWith(month)).reduce((s, f) => s + f.amount, 0);
  const revenue = sum('revenue'), costs = sum('cost');
  const netKnown = entries.some(f => f.kind === 'revenue' && f.occurred_on.startsWith(month)) && entries.some(f => f.kind === 'cost' && f.occurred_on.startsWith(month));
  const withRevenue = scope.filter(v => data.finance.some(f => f.venture === v.id && f.kind === 'revenue'));
  return <>
    {!venture && owner && <MercuryBankPanel snapshot={data.mercury} />}
    <div className="toolbar">
      {!venture && <label>Business<select value={filterBusiness ?? ''} onChange={e => pick('business', e.target.value)}><option value="">All businesses</option>{ventureList.map(v => <option key={v.id} value={v.id}>{v.short}</option>)}</select></label>}
      <label>Entries for month<input type="month" value={filterMonth} onChange={e => pick('month', e.target.value)} /></label>
      {filterMonth && <button className="secondary" onClick={() => pick('month', '')}>All dates</button>}
    </div>
    <div className="kpis">
      <div><span>Recorded revenue / {month}</span><strong><NumberFlow value={revenue} format={{ style: 'currency', currency: 'USD', maximumFractionDigits: 0 }} /></strong></div>
      <div><span>Recorded costs / {month}</span><strong>{entries.some(f => f.kind === 'cost' && f.occurred_on.startsWith(month)) ? dollars(costs) : 'Not recorded'}</strong></div>
      <div><span>Recorded net / {month}</span><strong className={revenue - costs < 0 ? 'neg' : ''}>{netKnown ? dollars(revenue - costs) : 'Incomplete'}</strong><small className="quiet">Entered revenue minus entered costs. Missing costs can overstate this figure.</small></div>
    </div>
    <section className="panel">
      <header className="panel-head"><h2>Money in, last 12 months</h2></header>
      {withRevenue.length ? <LineChart labels={lastMonths(now).map(m => m.label)} series={withRevenue.map(v => ({ id: v.id, label: v.short, color: color(v.id), values: monthlyTotals(data.finance, v.id, 'revenue', now) }))} />
        : <div className="empty"><p><b>No money logged yet.</b> Paid Exterior Care jobs and Shopify orders appear here on their own. Add anything else that has been paid in or out below.</p></div>}
    </section>
    <section className="panel">
      <header className="panel-head"><h2>Entries</h2>{!readOnly && !form && <button className="secondary" onClick={() => setForm(blank())}><Plus size={15} aria-hidden="true" />Log money</button>}</header>
      {form && (
        <form className="formpanel inline" onSubmit={e => { e.preventDefault(); store.addFinance({ ...form, amount: Number(form.amount) }, () => setForm(null)); }}>
          <div className="fields">
            <label>Type<select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}><option value="revenue">Money in</option><option value="cost">Money out</option></select></label>
            <label>Business<VentureSelect value={form.venture} disabled={!!venture} onChange={v => v && setForm({ ...form, venture: v })} /></label>
            <label>Amount in dollars<input required type="number" min="0.01" step="0.01" inputMode="decimal" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></label>
            <label>Date<input required type="date" value={form.occurred_on} onChange={e => setForm({ ...form, occurred_on: e.target.value })} /></label>
            <label>Category<input maxLength={80} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="Job, subscription, stock, fuel" /></label>
            <label>Note<input maxLength={500} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></label>
          </div>
          <div className="formactions"><button type="button" className="secondary" onClick={() => setForm(null)}>Cancel</button><button className="primary" disabled={store.pending}>Save entry</button></div>
        </form>
      )}
      <Notice store={store} />
      {entries.some(f => f.auto) && <p className="quiet">Recorded Exterior Care payments and paid USD Shopify orders are included automatically. Exterior figures use the job date, not a verified collection date. Do not enter these amounts again.</p>}
      {data.reporting?.sources.map(source => <p className="quiet" key={source.id}>{source.label}: {source.state}. {source.detail}</p>)}
      {entries.length ? (
        <div className="tablewrap"><table className="table">
          <thead><tr><th>Date</th><th>Business</th><th>Category</th><th>Note</th><th className="num">Amount</th><th /></tr></thead>
          <tbody>{entries.slice(0, shown).map(f => (
            <tr key={f.id} id={`finance-${f.id}`} className={selectedEntry === f.id ? 'record-highlight' : undefined}><td>{f.occurred_on}</td><td><span className="tag" style={{ '--tag': color(f.venture) } as React.CSSProperties}>{short(f.venture)}</span></td><td>{f.category || '-'}</td><td>{f.note || '-'}{f.auto && <small className="quiet"> From {f.auto}</small>}</td>
              <td className={f.kind === 'cost' ? 'num neg' : 'num pos'}>{f.kind === 'cost' ? '-' : '+'}{dollars(f.amount)}</td>
              <td>{!readOnly && !f.auto && <button className="icon-button" aria-label="Remove entry" onClick={() => { if (window.confirm('Remove this entry?')) store.remove('finance', f.id); }}><Trash2 size={14} /></button>}</td></tr>
          ))}</tbody>
        </table>{entries.length > shown && <button className="secondary showmore" onClick={() => setShown(shown + 50)}>Show {Math.min(50, entries.length - shown)} more of {entries.length}</button>}</div>
      ) : <div className="empty"><p><b>Nothing logged.</b> A quote is not money in: log it when it is paid.</p></div>}
    </section>
  </>;
}

function MercuryBankPanel({ snapshot }: { snapshot: Dashboard['mercury'] }) {
  const money = (value: number | null, currency: string) => value === null ? 'Not reported' : new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
  const stamp = snapshot?.checkedAt ? new Date(snapshot.checkedAt).toLocaleString() : null;
  return <section className="panel" aria-labelledby="mercury-heading">
    <header className="panel-head"><div><h2 id="mercury-heading">Mercury accounts</h2><p className="quiet">Private to the workspace owner · Read only</p></div>{snapshot?.state === 'available' && <span className="tag">Connected</span>}</header>
    {!snapshot || snapshot.state === 'not-connected' ? <div className="empty"><p><b>Connect Mercury when you’re ready.</b> Create a read-only API token in Mercury and add it to the OJ Workspace’s Netlify server variables as <code>OJ_MERCURY_API_TOKEN</code>. Never paste the token into this page or chat.</p><p className="quiet">This panel will show cash balances and recent bank activity. Bank activity stays separate from recorded revenue and costs.</p></div>
      : snapshot.state === 'unavailable' ? <div className="empty"><p><b>Mercury is temporarily unavailable.</b> {snapshot.detail}</p></div>
      : <>
        <p className="quiet">{snapshot.detail} Bank transfers and deposits are not counted as sales. Checked {stamp}.</p>
        {snapshot.accounts.length ? <div className="kpis mercury-balances">{snapshot.accounts.map(account => <div key={account.id}><span>{account.name}</span><strong>{money(account.currentBalance, account.currency)}</strong><small className="quiet">Available {money(account.availableBalance, account.currency)} · {account.status}</small></div>)}</div> : <p className="quiet">No accounts were returned.</p>}
        <h3>Recent activity</h3>
        {snapshot.transactions.length ? <div className="tablewrap"><table className="table"><thead><tr><th>Posted</th><th>Account</th><th>Description</th><th>Status</th><th className="num">Amount</th></tr></thead><tbody>
          {snapshot.transactions.slice(0, 15).map(row => <tr key={row.id}><td>{(row.postedAt || row.createdAt) ? new Date(row.postedAt || row.createdAt).toLocaleDateString() : 'Date unavailable'}</td><td>{row.accountName}</td><td>{row.description}</td><td>{row.status}</td><td className="num">{money(row.amount, row.currency)}</td></tr>)}
        </tbody></table></div> : <p className="quiet">No recent transactions were returned.</p>}
      </>}
  </section>;
}

/* ------------------------------ Calendar ------------------------------ */
const blankEvent = (day: string): EventItem => ({ id: crypto.randomUUID(), venture: null, title: '', starts_at: `${day}T09:00`, ends_at: `${day}T10:00`, all_day: false, location: '', notes: '' });
const toLocalInput = (iso: string) => { const d = new Date(iso); return `${dayKey(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
export function CalendarView({ store, readOnly, cards, jobs, base }: Common & { cards: Card[]; jobs: JobItem[]; base: string }) {
  const eventId = useSearchParams().get('event');
  const opened = useRef<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [draft, setDraft] = useState<(EventItem & { isNew: boolean }) | null>(null);
  const [link, setLink] = useState('');
  const [linkError, setLinkError] = useState('');
  useEffect(() => {
    if (!eventId || opened.current === eventId || !store.data || !store.now) return;
    const found = store.data.events.find(e => e.id === eventId);
    if (found) { const d = new Date(found.starts_at); setOffset((d.getFullYear() - store.now.getFullYear()) * 12 + d.getMonth() - store.now.getMonth()); if (!readOnly) setDraft({ ...found, isNew: false }); opened.current = eventId; }
  }, [eventId, store.data, store.now, readOnly]);
  return (
    <Gate store={store} what="The calendar">
      {() => <CalendarBody store={store} readOnly={readOnly} cards={cards} jobs={jobs} base={base} offset={offset} setOffset={setOffset} draft={draft} setDraft={setDraft} link={link} setLink={setLink} linkError={linkError} setLinkError={setLinkError} />}
    </Gate>
  );
}
function CalendarBody({ store, readOnly, cards, jobs, base, offset, setOffset, draft, setDraft, link, setLink, linkError, setLinkError }: any) {
  const now: Date = store.now, data = store.data;
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const gridStart = new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay());
  const days = Array.from({ length: 42 }, (_, i) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
  const today = dayKey(now);
  type Item = { id: string; title: string; venture: VentureId | null; time: string; event?: EventItem; href?: string };
  const byDay = useMemo(() => {
    const map = new Map<string, Item[]>();
    const push = (k: string, item: Item) => map.set(k, [...(map.get(k) ?? []), item]);
    for (const e of data.events as EventItem[]) push(dayKey(new Date(e.starts_at)), { id: e.id, title: e.title, venture: e.venture, time: e.all_day ? '' : new Date(e.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }), event: e });
    for (const c of cards as Card[]) if (c.due_date && c.stage !== 'Done') push(c.due_date, { id: c.id, title: c.title, venture: c.business, time: 'Task due', href: `${base}/tasks?task=${encodeURIComponent(c.id)}` });
    // Exterior Care jobs, in time order within their day, linking to the Exterior Care calendar to edit them.
    for (const j of [...(jobs as JobItem[])].sort((a, b) => (parseBlock(a.time_block)?.start ?? 0) - (parseBlock(b.time_block)?.start ?? 0))) push(j.date, { id: `job-${j.id}`, title: `${j.name}${j.service ? `, ${j.service}` : ''}`, venture: 'exterior', time: blockLabel(j.time_block), href: `${base}/b/exterior/calendar` });
    return map;
  }, [data.events, cards, jobs, base]);
  const upcoming = [...byDay.entries()].filter(([k]) => k >= today).sort(([a], [b]) => a.localeCompare(b)).slice(0, 8);
  return <>
    <div className="toolbar">
      <div className="monthnav"><button className="icon-button" aria-label="Previous month" onClick={() => setOffset(offset - 1)}><ChevronLeft size={18} /></button><h2>{first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2><button className="icon-button" aria-label="Next month" onClick={() => setOffset(offset + 1)}><ChevronRight size={18} /></button>{offset !== 0 && <button className="secondary" onClick={() => setOffset(0)}>Today</button>}</div>
      {!readOnly && <button className="primary" onClick={() => setDraft({ ...blankEvent(today), isNew: true })}><CalendarPlus size={16} aria-hidden="true" />New event</button>}
    </div>
    <Notice store={store} />
    {draft && (
      <form className="panel formpanel" onSubmit={e => { e.preventDefault(); const { isNew, ...ev } = draft; store.saveEvent({ ...ev, starts_at: new Date(ev.starts_at).toISOString(), ends_at: ev.all_day || !ev.ends_at ? null : new Date(ev.ends_at).toISOString() }, isNew, () => setDraft(null)); }}>
        <h2>{draft.isNew ? 'New event' : 'Edit event'}</h2>
        <div className="fields">
          <label>Title<input required autoFocus maxLength={160} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></label>
          <label>Business<VentureSelect allowShared value={draft.venture} onChange={v => setDraft({ ...draft, venture: v })} /></label>
          <label>Starts<input required type="datetime-local" value={draft.starts_at.length > 16 ? toLocalInput(draft.starts_at) : draft.starts_at} onChange={e => setDraft({ ...draft, starts_at: e.target.value })} /></label>
          <label>Ends<input type="datetime-local" disabled={draft.all_day} value={draft.ends_at ? (draft.ends_at.length > 16 ? toLocalInput(draft.ends_at) : draft.ends_at) : ''} onChange={e => setDraft({ ...draft, ends_at: e.target.value || null })} /></label>
          <label>Location<input maxLength={200} value={draft.location} onChange={e => setDraft({ ...draft, location: e.target.value })} /></label>
          <label className="checkbox-row"><input type="checkbox" checked={draft.all_day} onChange={e => setDraft({ ...draft, all_day: e.target.checked })} />All day</label>
          <label className="wide">Notes<textarea rows={2} maxLength={2000} value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} /></label>
        </div>
        <div className="formactions">
          {!draft.isNew && <button type="button" className="secondary danger" onClick={() => { if (window.confirm(`Remove "${draft.title}"?`)) { store.remove('event', draft.id); setDraft(null); } }}>Remove</button>}
          <button type="button" className="secondary" onClick={() => setDraft(null)}>Cancel</button><button className="primary" disabled={store.pending}>Save event</button>
        </div>
      </form>
    )}
    <div className="calendar-layout">
      <div className="month panel" role="grid" aria-label="Month">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="month-head" role="columnheader">{d}</div>)}
        {days.map(d => {
          const k = dayKey(d), items = byDay.get(k) ?? [];
          return (
            <div key={k} role="gridcell" className={`month-day${d.getMonth() !== first.getMonth() ? ' is-other' : ''}${k === today ? ' is-today' : ''}`}>
              <button className="month-num" disabled={readOnly} aria-label={`Add an event on ${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`} onClick={() => setDraft({ ...blankEvent(k), isNew: true })}>{d.getDate()}</button>
              {items.slice(0, 3).map(item => item.href ? <Link key={item.id} className="month-item" style={{ '--dot': color(item.venture) } as React.CSSProperties} href={item.href} title={`${item.time}: ${item.title}`}>{item.title}</Link> : <button key={item.id} className="month-item" style={{ '--dot': color(item.venture) } as React.CSSProperties} disabled={!item.event || readOnly || Boolean(item.event.source)} onClick={() => item.event && !item.event.source && setDraft({ ...item.event, starts_at: toLocalInput(item.event.starts_at), ends_at: item.event.ends_at ? toLocalInput(item.event.ends_at) : null, isNew: false })} title={item.event?.source ? `${item.title}, from an outside calendar (read-only)` : item.title}>{item.title}</button>)}
              {items.length > 3 && <span className="month-more">+{items.length - 3} more</span>}
            </div>
          );
        })}
      </div>
      <aside className="calendar-side">
        <section className="panel"><header className="panel-head"><h2>Coming up</h2></header>
          {upcoming.length ? <ol className="agenda">{upcoming.map(([k, items]) => <li key={k}><time>{new Date(`${k}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</time>{items.map(i => <p key={i.id} style={{ '--dot': color(i.venture) } as React.CSSProperties}><b>{i.title}</b><span>{[i.time, short(i.venture)].filter(Boolean).join(' / ')}</span></p>)}</li>)}</ol>
            : <div className="empty"><p><b>Nothing scheduled.</b> Add an event, or give a task a due date.</p></div>}
        </section>
        <section className="panel"><header className="panel-head"><h2>On your iPhone</h2></header>
          <p className="quiet">Create a private link, then on your iPhone open Settings, Calendar, Accounts, Add Account, Other, Add Subscribed Calendar, and paste it. (The link starts with https://; the iPhone box rejects webcals://.) Events and task due dates show up in your Calendar app and refresh on their own. The phone can read this calendar but not change it.</p>
          {link ? <>
            <label className="linkbox">Your private link<input readOnly value={link} onFocus={e => e.currentTarget.select()} /></label>
            <p className="quiet">Anyone with this link can read the calendar, so keep it to yourself. Creating a new link switches the old one off.</p>
          </> : <button className="secondary" onClick={async () => { try { setLinkError(''); setLink(`${window.location.origin}${await store.calendarLink()}.ics`); } catch (e) { setLinkError(e instanceof Error ? e.message : 'Could not create the link.'); } }}>Create my private link</button>}
          {linkError && <p className="error-text">{linkError}</p>}
        </section>
      </aside>
    </div>
  </>;
}

/* ------------------------------ Files and documents ------------------------------ */
const kindIcon = { pdf: FileText, doc: FileText, sheet: FileSpreadsheet, zip: FileArchive };
export function FilesView({ store, readOnly, venture }: Common) {
  const selected = useSearchParams().get('document');
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('');
  const [meta, setMeta] = useState<{ venture: VentureId | null; name: string; tag: DocumentItem['tag'] }>({ venture: venture ?? null, name: '', tag: 'other' });
  const [file, setFile] = useState<File | null>(null);
  const input = useRef<HTMLInputElement>(null);
  return (
    <Gate store={store} what="Documents">{() => <>
      {!readOnly && (
        <form className="panel formpanel" onSubmit={e => { e.preventDefault(); if (file) store.upload(file, meta, () => { setFile(null); setMeta({ ...meta, name: '' }); if (input.current) input.current.value = ''; }); }}>
          <h2>Upload a document</h2>
          <div className="fields">
            <label className="wide">File (up to 25 MB)<input ref={input} required type="file" onChange={e => { const f = e.target.files?.[0] ?? null; setFile(f); if (f && !meta.name) setMeta({ ...meta, name: f.name }); }} /></label>
            <label>Name<input required maxLength={200} value={meta.name} onChange={e => setMeta({ ...meta, name: e.target.value })} /></label>
            <label>Type<select value={meta.tag} onChange={e => setMeta({ ...meta, tag: e.target.value as DocumentItem['tag'] })}>{documentTags.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}</select></label>
            <label>Business<VentureSelect allowShared value={meta.venture} disabled={!!venture} onChange={v => setMeta({ ...meta, venture: v })} /></label>
          </div>
          <div className="formactions"><button className="primary" disabled={store.pending || !file}><Upload size={15} aria-hidden="true" />{store.pending ? 'Uploading' : 'Upload'}</button></div>
        </form>
      )}
      <div className="toolbar">
        <label className="searchbox"><input aria-label="Search documents" placeholder="Search documents" value={query} onChange={e => setQuery(e.target.value)} /></label>
        <select aria-label="Filter by type" value={tag} onChange={e => setTag(e.target.value)}><option value="">All types</option>{documentTags.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}</select>
      </div>
      <Notice store={store} />
      {(() => {
        const rows = store.data!.documents.filter(d => (!venture || d.venture === venture) && (!tag || d.tag === tag) && d.name.toLowerCase().includes(query.toLowerCase()));
        if (!rows.length) return <div className="empty"><p><b>No documents{query || tag ? ' match' : ' yet'}.</b> Contracts, insurance, tax and brand files live here, private to workspace members.</p></div>;
        return <ul className="doclist">{rows.map(d => {
          const Icon = kindIcon[fileKind(d.mime, d.name)];
          return (
            <li key={d.id} id={`record-${d.id}`} className={`panel${selected === d.id ? ' record-highlight' : ''}`}>
              <span className="file-icon" style={{ color: color(d.venture) }}><Icon size={18} aria-hidden="true" /></span>
              <div><b>{d.name}</b><span>{short(d.venture)} / {d.tag} / {fileSize(d.size_bytes)} / {d.uploaded_by}, {relativeDay(d.created_at, store.now!)}</span></div>
              <button className="icon-button" aria-label={`Open ${d.name}`} onClick={() => store.open(d)}><Download size={16} /></button>
              {!readOnly && <button className="icon-button" aria-label={`Remove ${d.name}`} onClick={() => { if (window.confirm(`Remove "${d.name}"? The file is deleted.`)) store.remove('document', d.id); }}><Trash2 size={16} /></button>}
            </li>
          );
        })}</ul>;
      })()}
    </>}</Gate>
  );
}

/* ------------------------------ Hand-logged metrics (a tab inside each business) ------------------------------ */
export function MetricsTab({ store, readOnly, venture }: Common & { venture: VentureId }) {
  const [form, setForm] = useState({ label: '', value: '', unit: '', measured_on: '', note: '' });
  return (
    <Gate store={store} what="Metrics">
      {() => {
        const rows = store.data!.metricEntries.filter(m => m.venture === venture);
        const labels = [...new Set(rows.map(r => r.label))];
        return <>
          {labels.length > 0 && <div className="kpis">{labels.slice(0, 8).map(label => { const latest = rows.find(r => r.label === label)!; return <div key={label}><span>{label}</span><strong>{latest.value.toLocaleString('en-US')}{latest.unit && <small className="unit"> {latest.unit}</small>}</strong><small className="quiet">Logged by hand, {latest.measured_on}</small></div>; })}</div>}
          {!readOnly && (
            <form className="panel formpanel" onSubmit={e => { e.preventDefault(); store.addMetric({ venture, label: form.label, value: Number(form.value), unit: form.unit, measured_on: form.measured_on || dayKey(store.now!), note: form.note }, () => setForm({ label: '', value: '', unit: '', measured_on: '', note: '' })); }}>
              <h2>Log a number</h2>
              <p className="quiet">For anything no connected system tracks. Use the same label each time to build a history.</p>
              <div className="fields">
                <label>What is it<input required maxLength={80} list={`labels-${venture}`} value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="Calls handled, doors knocked" /><datalist id={`labels-${venture}`}>{labels.map(l => <option key={l} value={l} />)}</datalist></label>
                <label>Value<input required type="number" step="any" inputMode="decimal" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} /></label>
                <label>Unit<input maxLength={20} value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="calls, %, hours" /></label>
                <label>Date<input type="date" value={form.measured_on || dayKey(store.now!)} onChange={e => setForm({ ...form, measured_on: e.target.value })} /></label>
                <label className="wide">Note<input maxLength={500} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></label>
              </div>
              <div className="formactions"><button className="primary" disabled={store.pending}>Log it</button></div>
            </form>
          )}
          <Notice store={store} />
          {rows.length ? (
            <div className="tablewrap"><table className="table"><thead><tr><th>Date</th><th>What</th><th className="num">Value</th><th>Note</th><th /></tr></thead>
              <tbody>{rows.slice(0, 100).map(m => <tr key={m.id}><td>{m.measured_on}</td><td>{m.label}</td><td className="num">{m.value.toLocaleString('en-US')} {m.unit}</td><td>{m.note || '-'}</td><td>{!readOnly && <button className="icon-button" aria-label="Remove" onClick={() => { if (window.confirm('Remove this number?')) store.remove('metric', m.id); }}><Trash2 size={14} /></button>}</td></tr>)}</tbody></table></div>
          ) : <div className="empty"><p><b>No numbers logged for {ventures[venture].short} yet.</b></p></div>}
        </>;
      }}
    </Gate>
  );
}

/* ------------------------------ Analytics ------------------------------ */
export function AnalyticsView({ store, cards }: Common & { cards: Card[] }) {
  const pathname = usePathname(), query = useSearchParams(), router = useRouter();
  const records = useRef<HTMLHeadingElement>(null);
  const [shown, setShown] = useState(50);
  const base = pathname.startsWith('/preview') ? '/preview' : '/workspace';
  const pick = (patch: Record<string, string>) => {
    const next = new URLSearchParams(query.toString());
    for (const [key, value] of Object.entries(patch)) next.set(key, value);
    setShown(50);
    router.replace(`${pathname}?${next}`, { scroll: false });
  };
  const cash = (value: number | null) => value === null ? 'Not recorded' : dollars(value);
  return (
    <Gate store={store} what="Analytics">
      {() => {
        const now = store.now!, data = store.data!;
        const today = businessDay(now.toISOString())!, month = today.slice(0, 7);
        const date = (key: string, fallback: string) => { const value = query.get(key); return value === '' || value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback; };
        const filters: AnalyticsFilters = { venture: ventureList.some(v => v.id === query.get('business')) ? query.get('business') as VentureId : 'all', from: date('from', `${month}-01`), to: date('to', today) };
        const report = operationalAnalytics(data, cards, filters, today);
        const kind = query.get('entries') === 'revenue' || query.get('entries') === 'cost' ? query.get('entries') : 'all';
        const entries = report.finance.filter(row => kind === 'all' || row.kind === kind);
        const withRevenue = ventureList.filter(v => (filters.venture === 'all' || v.id === filters.venture) && report.finance.some(row => row.venture === v.id && row.kind === 'revenue'));
        const labelMonth = (key: string) => new Date(`${key}-15T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
        const drill = (patch: Record<string, string>) => { pick(patch); records.current?.focus(); };
        const sourceState = { available: 'Available', partial: 'Partial coverage', unavailable: 'Unavailable', 'not-connected': 'Not connected' };
        return <>
          <section className="panel">
            <header className="panel-head"><h2>Understand the work behind the numbers</h2><span className="quiet">USD / business dates</span></header>
            <div className="fields">
              <label>Business<select value={filters.venture} onChange={event => pick({ business: event.target.value })}><option value="all">All businesses</option>{ventureList.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
              <label>From<input type="date" value={filters.from} max={filters.to || undefined} onChange={event => pick({ from: event.target.value })} /></label>
              <label>Through<input type="date" value={filters.to} min={filters.from || undefined} onChange={event => pick({ to: event.target.value })} /></label>
            </div>
            <div className="formactions"><button className="secondary small" onClick={() => pick({ from: `${month}-01`, to: today })}>This month</button><button className="secondary small" onClick={() => pick({ from: businessDay(new Date(now.getTime() - 29 * 86400000).toISOString())!, to: today })}>Last 30 days</button><button className="secondary small" onClick={() => pick({ from: '', to: '' })}>All loaded history</button></div>
            {filters.from && filters.to && filters.from > filters.to && <p role="alert" className="notice">Choose an end date on or after the start date.</p>}
            <p className="quiet">Revenue and costs use each entry&apos;s recorded date. Exterior Care uses job completion dates (or labeled estimates); Shopify uses order dates. These are not verified collection or bank-deposit dates.</p>
          </section>

          <div className="kpis">
            <div><span>Recorded revenue</span><strong>{cash(report.revenue)}</strong><button className="secondary small" onClick={() => drill({ entries: 'revenue' })}>Inspect {report.revenueEntries} entries</button></div>
            <div><span>Recorded costs</span><strong>{cash(report.cost)}</strong><button className="secondary small" onClick={() => drill({ entries: 'cost' })}>Inspect {report.costEntries} entries</button></div>
            <div><span>Recorded net</span><strong>{cash(report.net)}</strong><small className="quiet">Entered revenue minus entered costs; not business profit</small></div>
            <div><span>Workspace leads added</span><strong>{report.leads.length}</strong><small className="quiet">Created in this range; connected-system leads are separate</small></div>
          </div>
          <p className="banner-inline">Missing costs remain unknown. Recorded net appears only when both revenue and cost entries exist, and can still overstate the result when expenses or owner labor are incomplete.</p>

          {data.reporting && <section className="panel">
            <header className="panel-head"><h2>Source coverage</h2><Link className="panel-link" href={`${base}/settings`}>Connections</Link></header>
            <ul className="connections">{data.reporting.sources.map(source => <li key={source.id}><i className={source.state === 'available' ? 'is-on' : ''} aria-hidden="true" /><div><b>{source.label}</b><span>{source.detail}</span></div><strong>{sourceState[source.state]}</strong></li>)}</ul>
            <p className="quiet">Across all loaded Exterior Care history: {data.reporting.exterior.revenueJobs}/{data.reporting.exterior.jobs} completed jobs have payment figures, {data.reporting.exterior.costJobs}/{data.reporting.exterior.jobs} have costs, and {data.reporting.exterior.matchedJobs} have both. <Link href={`${base}/b/exterior/jobs`}>Inspect job coverage</Link>.</p>
          </section>}

          <section className="panel"><header className="panel-head"><h2>Recorded revenue by month</h2><span className="quiet">Current business and date filters</span></header>
            {withRevenue.length ? <LineChart labels={report.months.map(row => labelMonth(row.key))} series={withRevenue.map(v => ({ id: v.id, label: v.short, color: color(v.id), values: report.months.map(row => row.byBusiness.find(business => business.venture === v.id)?.revenue ?? 0) }))} /> : <div className="empty"><p><b>No revenue entries in this range.</b> Choose another date range or log a received payment.</p></div>}
            <p className="quiet">Only months containing entries are plotted. A zero means no revenue entry in the loaded records for that month, not proof of a fully reconciled period.</p>
            {report.months.length > 0 && <div className="tablewrap"><table className="table">
              <caption className="sr-only">Monthly data alternative and entry drilldown</caption><thead><tr><th scope="col">Month</th><th scope="col" className="num">Recorded revenue</th><th scope="col" className="num">Recorded costs</th><th scope="col" className="num">Entries</th></tr></thead>
              <tbody>{report.months.map(row => <tr key={row.key}><th scope="row"><button className="secondary small" onClick={() => { const last = new Date(Date.UTC(Number(row.key.slice(0, 4)), Number(row.key.slice(5, 7)), 0)).getUTCDate(); drill({ from: filters.from && filters.from > `${row.key}-01` ? filters.from : `${row.key}-01`, to: filters.to && filters.to < `${row.key}-${last}` ? filters.to : `${row.key}-${last}`, entries: 'all' }); }}>{labelMonth(row.key)}</button></th><td className="num">{cash(row.revenue)}</td><td className="num">{cash(row.cost)}</td><td className="num">{row.revenueEntries + row.costEntries}</td></tr>)}</tbody>
            </table></div>}
          </section>

          <section className="panel"><header className="panel-head"><h2>Business comparison</h2><span className="quiet">Choose a business to inspect it</span></header>
            <div className="tablewrap"><table className="table"><caption className="sr-only">Operational figures using the selected dates and businesses</caption><thead><tr><th scope="col">Business</th><th scope="col" className="num">Revenue entered</th><th scope="col" className="num">Costs entered</th><th scope="col" className="num">Recorded net</th><th scope="col" className="num">Leads added</th><th scope="col" className="num">Won</th><th scope="col" className="num">Win rate</th></tr></thead>
              <tbody>{report.businesses.map(row => <tr key={row.venture}><th scope="row"><button className="secondary small" onClick={() => drill({ business: row.venture, entries: 'all' })}>{short(row.venture)}</button></th><td className="num">{cash(row.revenue)}</td><td className="num">{cash(row.cost)}</td><td className="num">{cash(row.net)}</td><td className="num">{row.leads}</td><td className="num">{row.won}</td><td className="num">{row.winRate === null ? '-' : `${Math.round(row.winRate * 100)}%`}</td></tr>)}</tbody>
            </table></div><p className="quiet">Lead figures describe the current status of workspace leads created in the selected range. Win rate = won / (won + lost), excluding undecided leads. Exterior Care and GoHighLevel pipelines remain in their business screens.</p>
          </section>

          <section className="panel"><header className="panel-head"><h2>Current team workload</h2><Link className="panel-link" href={`${base}/tasks`}>Task board</Link></header>
            <p className="quiet">Business filter applies; date filter does not. The board records current state, so these are not historical completion rates.</p>
            {report.owners.length ? report.owners.map(owner => <details className="thread" key={owner.owner}><summary><b>{owner.owner}</b><span>{owner.open} open / {owner.overdue} overdue</span></summary><ul>{owner.tasks.map(task => <li key={task.id}><Link href={`${base}/tasks?task=${encodeURIComponent(task.id)}`}>{task.title}</Link> <span className="quiet">{short(task.business)} / {task.stage}{task.due_date ? ` / due ${task.due_date}` : ' / no due date'}</span></li>)}</ul></details>) : <div className="empty"><p><b>No open tasks for this selection.</b></p></div>}
          </section>

          <section className="panel"><header className="panel-head"><h2 ref={records} tabIndex={-1}>Entries behind the figures</h2><span className="quiet" role="status">{entries.length} matching entries</span></header>
            <div className="filter-chips" role="group" aria-label="Entry type">{(['all', 'revenue', 'cost'] as const).map(value => <button key={value} aria-pressed={kind === value} onClick={() => pick({ entries: value })}>{value === 'all' ? 'All entries' : value === 'revenue' ? 'Revenue' : 'Costs'}</button>)}</div>
            {entries.length ? <div className="tablewrap"><table className="table"><caption className="sr-only">The loaded records used in the analytics calculations</caption><thead><tr><th scope="col">Date / basis</th><th scope="col">Business</th><th scope="col">Record</th><th scope="col">Source</th><th scope="col" className="num">Amount</th></tr></thead><tbody>{entries.slice(0, shown).map(row => {
              const jobId = row.auto === 'Exterior Care job' ? row.id.replace(/^jobcost-|^job-/, '') : null;
              const href = jobId ? `${base}/b/exterior/leads?lead=${encodeURIComponent(jobId)}` : row.auto === 'Shopify' ? `${base}/b/essentials/orders` : `${base}/b/${row.venture}/money?entry=${encodeURIComponent(row.id)}`;
              const basis = row.dateBasis === 'completion' ? 'Job completion date' : row.dateBasis === 'updated-estimate' ? 'Estimated from last update' : row.dateBasis === 'created-estimate' ? 'Estimated from creation' : row.dateBasis === 'order-created' ? 'Order created' : 'Entered date';
              return <tr key={row.id}><td>{row.occurred_on}<small className="quiet block">{basis}</small></td><td>{short(row.venture)}</td><th scope="row"><Link href={href}>{row.category || (row.kind === 'revenue' ? 'Revenue entry' : 'Cost entry')}</Link><small className="quiet block">{row.note}</small></th><td>{row.auto || 'Hand logged'}</td><td className={row.kind === 'cost' ? 'num neg' : 'num'}>{row.kind === 'cost' ? '-' : '+'}{dollars(row.amount)}</td></tr>;
            })}</tbody></table>{entries.length > shown && <button className="secondary showmore" onClick={() => setShown(value => value + 50)}>Show {Math.min(50, entries.length - shown)} more entries</button>}</div> : <div className="empty"><p><b>No matching entries.</b> Change the date, business or entry-type filter.</p></div>}
          </section>
        </>;
      }}
    </Gate>
  );
}

/* ------------------------------ Settings and connections ------------------------------ */
export type Connections = { shopify: boolean; ghl: boolean };
export function SettingsView({ store, displayName, role, connections, mode, workMissing = false }: { store: DashboardStore; displayName: string; role: string; connections: Connections; mode: 'preview' | 'live'; workMissing?: boolean }) {
  const rows: { name: string; what: string; on: boolean; next: string }[] = [
    { name: 'Workspace database', what: 'Tasks, messages, leads, money, calendar and documents.', on: !store.missing, next: 'A founder approves the one-time database update (supabase/schemas/dashboard.sql).' },
    ...(workMissing ? [{ name: 'Work timer and leaderboard', what: 'The timer in the top bar and the weekly leaderboard on Home.', on: false, next: 'A founder approves the database update in supabase/pending/RUN-ME-work-leaderboard.sql.' }] : []),
    { name: 'Shopify (OJ Essentials)', what: 'Orders, revenue, products and stock from ojessentials.store.', on: connections.shopify, next: 'Create a read-only app in the Shopify Dev Dashboard, install it on the store, and add SHOPIFY_STORE_DOMAIN, SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET to the host settings. Steps are in docs/CONNECTIONS.md.' },
    { name: 'GoHighLevel (OJ Solutions)', what: 'Clients, calls handled and pipeline.', on: connections.ghl, next: 'Create a read-only private integration in GoHighLevel and add GHL_ACCESS_TOKEN and GHL_LOCATION_ID. Steps are in docs/CONNECTIONS.md.' },
  ];
  return <>
    <section className="panel"><header className="panel-head"><h2>You</h2></header>
      <dl className="deflist"><div><dt>Name</dt><dd>{mode === 'preview' ? 'Oscar and Jacob (sample)' : displayName}</dd></div><div><dt>Access</dt><dd>{role}</dd></div></dl>
      {mode === 'live' && <p className="quiet">Change your password from the sign-in page. A founder manages members and invitations on the Team page.</p>}
    </section>
    <section className="panel"><header className="panel-head"><h2>Connections</h2></header>
      <p className="quiet">Keys are stored in the host's protected settings. They are never shown here, kept in the database, or put in the code.</p>
      <ul className="connections">{rows.map(r => (
        <li key={r.name}><i className={r.on ? 'is-on' : ''} aria-hidden="true" /><div><b>{r.name}</b><span>{r.what}</span>{!r.on && <span className="next">To connect: {r.next}</span>}</div><strong>{mode === 'preview' ? 'Sample' : r.on ? 'Connected' : 'Not connected'}</strong></li>
      ))}</ul>
    </section>
  </>;
}

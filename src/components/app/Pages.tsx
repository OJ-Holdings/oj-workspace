'use client';

import { useMemo, useRef, useState, type ReactNode } from 'react';
import NumberFlow from '@number-flow/react';
import { CalendarPlus, ChevronLeft, ChevronRight, Download, FileArchive, FileSpreadsheet, FileText, Plus, Send, Trash2, Upload } from 'lucide-react';
import { ventureList, ventures, type VentureId } from '@/lib/ventures';
import { dayKey, documentTags, fileKind, fileSize, lastMonths, leadStages, monthlyTotals, relativeDay, type DocumentItem, type EventItem, type Lead, type LeadStage } from '@/lib/dashboard';
import { dollars, money } from '@/lib/metrics';
import type { Card } from '@/lib/board';
import { LineChart } from './Charts';
import type { DashboardStore } from './useDashboard';

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
              <li key={m.id}>
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
  const [filter, setFilter] = useState<VentureId | 'all'>(venture ?? 'all');
  const [draft, setDraft] = useState<(Omit<Lead, 'created_at'> & { isNew: boolean }) | null>(null);
  const scope = venture ?? filter;
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
        <form className="panel formpanel" onSubmit={e => { e.preventDefault(); const { isNew, ...lead } = draft; store.saveLead(lead, isNew, () => setDraft(null)); }}>
          <h2>{draft.isNew ? 'New lead' : 'Edit lead'}</h2>
          <div className="fields">
            <label>Name or job<input required autoFocus maxLength={160} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
            <label>Business<VentureSelect value={draft.venture} onChange={v => v && setDraft({ ...draft, venture: v })} /></label>
            <label>Contact<input maxLength={200} value={draft.contact} onChange={e => setDraft({ ...draft, contact: e.target.value })} placeholder="Phone or email" /></label>
            <label>Stage<select value={draft.stage} onChange={e => setDraft({ ...draft, stage: e.target.value as LeadStage })}>{leadStages.map(s => <option key={s}>{s}</option>)}</select></label>
            <label>Value in dollars<input type="number" min="0" step="0.01" inputMode="decimal" value={draft.value ?? ''} onChange={e => setDraft({ ...draft, value: e.target.value === '' ? null : Number(e.target.value) })} /></label>
            <label>Source<input maxLength={120} value={draft.source} onChange={e => setDraft({ ...draft, source: e.target.value })} placeholder="Website, referral, door knocking" /></label>
            <label className="wide">Notes<textarea rows={2} maxLength={4000} value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} /></label>
          </div>
          <div className="formactions"><button type="button" className="secondary" onClick={() => setDraft(null)}>Cancel</button><button className="primary" disabled={store.pending}>Save lead</button></div>
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
                    <button className="taskcard-open" disabled={readOnly} onClick={() => setDraft({ ...lead, isNew: false })}>
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
export function FinanceView({ store, readOnly, venture }: Common) {
  const blank = () => ({ venture: venture ?? 'exterior' as VentureId, kind: 'revenue' as const, amount: '', occurred_on: store.now ? dayKey(store.now) : '', category: '', note: '' });
  const [form, setForm] = useState<{ venture: VentureId; kind: 'revenue' | 'cost'; amount: string; occurred_on: string; category: string; note: string } | null>(null);
  return (
    <Gate store={store} what="Finance">
      {() => <FinanceBody store={store} readOnly={readOnly} venture={venture} form={form} setForm={setForm} blank={blank} />}
    </Gate>
  );
}
function FinanceBody({ store, readOnly, venture, form, setForm, blank }: Common & { form: ReturnType<typeof Object> | null; setForm: (f: any) => void; blank: () => any }) {
  const now = store.now!, data = store.data!;
  const [shown, setShown] = useState(12);
  const scope = venture ? [ventures[venture]] : ventureList;
  const month = dayKey(now).slice(0, 7);
  const entries = data.finance.filter(f => !venture || f.venture === venture).sort((a, b) => b.occurred_on.localeCompare(a.occurred_on));
  const sum = (kind: 'revenue' | 'cost') => entries.filter(f => f.kind === kind && f.occurred_on.startsWith(month)).reduce((s, f) => s + f.amount, 0);
  const revenue = sum('revenue'), costs = sum('cost');
  const withRevenue = scope.filter(v => data.finance.some(f => f.venture === v.id && f.kind === 'revenue'));
  return <>
    <div className="kpis">
      <div><span>Money in this month</span><strong><NumberFlow value={revenue} format={{ style: 'currency', currency: 'USD', maximumFractionDigits: 0 }} /></strong></div>
      <div><span>Money out this month</span><strong><NumberFlow value={costs} format={{ style: 'currency', currency: 'USD', maximumFractionDigits: 0 }} /></strong></div>
      <div><span>Profit this month</span><strong className={revenue - costs < 0 ? 'neg' : ''}><NumberFlow value={revenue - costs} format={{ style: 'currency', currency: 'USD', maximumFractionDigits: 0 }} /></strong><small className="quiet">From logged entries only</small></div>
    </div>
    <section className="panel">
      <header className="panel-head"><h2>Money in, last 12 months</h2></header>
      {withRevenue.length ? <LineChart labels={lastMonths(now).map(m => m.label)} series={withRevenue.map(v => ({ id: v.id, label: v.short, color: color(v.id), values: monthlyTotals(data.finance, v.id, 'revenue', now) }))} />
        : <div className="empty"><p><b>No money logged yet.</b> Add what has been paid in and paid out below. Shopify and the other systems will add theirs once connected.</p></div>}
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
      {entries.length ? (
        <div className="tablewrap"><table className="table">
          <thead><tr><th>Date</th><th>Business</th><th>Category</th><th>Note</th><th className="num">Amount</th><th /></tr></thead>
          <tbody>{entries.slice(0, shown).map(f => (
            <tr key={f.id}><td>{f.occurred_on}</td><td><span className="tag" style={{ '--tag': color(f.venture) } as React.CSSProperties}>{short(f.venture)}</span></td><td>{f.category || '-'}</td><td>{f.note || '-'}</td>
              <td className={f.kind === 'cost' ? 'num neg' : 'num pos'}>{f.kind === 'cost' ? '-' : '+'}{dollars(f.amount)}</td>
              <td>{!readOnly && <button className="icon-button" aria-label="Remove entry" onClick={() => { if (window.confirm('Remove this entry?')) store.remove('finance', f.id); }}><Trash2 size={14} /></button>}</td></tr>
          ))}</tbody>
        </table>{entries.length > shown && <button className="secondary showmore" onClick={() => setShown(shown + 50)}>Show {Math.min(50, entries.length - shown)} more of {entries.length}</button>}</div>
      ) : <div className="empty"><p><b>Nothing logged.</b> A quote is not money in: log it when it is paid.</p></div>}
    </section>
  </>;
}

/* ------------------------------ Calendar ------------------------------ */
const blankEvent = (day: string): EventItem => ({ id: crypto.randomUUID(), venture: null, title: '', starts_at: `${day}T09:00`, ends_at: `${day}T10:00`, all_day: false, location: '', notes: '' });
const toLocalInput = (iso: string) => { const d = new Date(iso); return `${dayKey(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
export function CalendarView({ store, readOnly, cards }: Common & { cards: Card[] }) {
  const [offset, setOffset] = useState(0);
  const [draft, setDraft] = useState<(EventItem & { isNew: boolean }) | null>(null);
  const [link, setLink] = useState('');
  const [linkError, setLinkError] = useState('');
  return (
    <Gate store={store} what="The calendar">
      {() => <CalendarBody store={store} readOnly={readOnly} cards={cards} offset={offset} setOffset={setOffset} draft={draft} setDraft={setDraft} link={link} setLink={setLink} linkError={linkError} setLinkError={setLinkError} />}
    </Gate>
  );
}
function CalendarBody({ store, readOnly, cards, offset, setOffset, draft, setDraft, link, setLink, linkError, setLinkError }: any) {
  const now: Date = store.now, data = store.data;
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const gridStart = new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay());
  const days = Array.from({ length: 42 }, (_, i) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
  const today = dayKey(now);
  type Item = { id: string; title: string; venture: VentureId | null; time: string; event?: EventItem };
  const byDay = useMemo(() => {
    const map = new Map<string, Item[]>();
    const push = (k: string, item: Item) => map.set(k, [...(map.get(k) ?? []), item]);
    for (const e of data.events as EventItem[]) push(dayKey(new Date(e.starts_at)), { id: e.id, title: e.title, venture: e.venture, time: e.all_day ? '' : new Date(e.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }), event: e });
    for (const c of cards as Card[]) if (c.due_date && c.stage !== 'Done') push(c.due_date, { id: c.id, title: c.title, venture: c.business, time: 'Task due' });
    return map;
  }, [data.events, cards]);
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
              {items.slice(0, 3).map(item => <button key={item.id} className="month-item" style={{ '--dot': color(item.venture) } as React.CSSProperties} disabled={!item.event || readOnly} onClick={() => item.event && setDraft({ ...item.event, starts_at: toLocalInput(item.event.starts_at), ends_at: item.event.ends_at ? toLocalInput(item.event.ends_at) : null, isNew: false })} title={item.title}>{item.title}</button>)}
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
          <p className="quiet">Create a private link, then on your iPhone open Settings, Calendar, Accounts, Add Account, Other, Add Subscribed Calendar, and paste it. Events and task due dates show up in your Calendar app and refresh on their own. The phone can read this calendar but not change it.</p>
          {link ? <>
            <label className="linkbox">Your private link<input readOnly value={link} onFocus={e => e.currentTarget.select()} /></label>
            <p className="quiet">Anyone with this link can read the calendar, so keep it to yourself. Creating a new link switches the old one off.</p>
          </> : <button className="secondary" onClick={async () => { try { setLinkError(''); setLink(`${window.location.origin.replace(/^http/, 'webcal')}${await store.calendarLink()}.ics`); } catch (e) { setLinkError(e instanceof Error ? e.message : 'Could not create the link.'); } }}>Create my private link</button>}
          {linkError && <p className="error-text">{linkError}</p>}
        </section>
      </aside>
    </div>
  </>;
}

/* ------------------------------ Files and documents ------------------------------ */
const kindIcon = { pdf: FileText, doc: FileText, sheet: FileSpreadsheet, zip: FileArchive };
export function FilesView({ store, readOnly, venture }: Common) {
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
            <li key={d.id} className="panel">
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
  return (
    <Gate store={store} what="Analytics">
      {() => {
        const now = store.now!, data = store.data!;
        const month = dayKey(now).slice(0, 7);
        const row = (v: VentureId) => {
          const rev = data.finance.filter(f => f.venture === v && f.kind === 'revenue' && f.occurred_on.startsWith(month)).reduce((s, f) => s + f.amount, 0);
          const cost = data.finance.filter(f => f.venture === v && f.kind === 'cost' && f.occurred_on.startsWith(month)).reduce((s, f) => s + f.amount, 0);
          const leads = data.leads.filter(l => l.venture === v), won = leads.filter(l => l.stage === 'Won').length, closed = won + leads.filter(l => l.stage === 'Lost').length;
          return { rev, cost, leads: leads.length, won, rate: closed ? Math.round((won / closed) * 100) : null, open: cards.filter(c => c.business === v && c.stage !== 'Done').length, done: cards.filter(c => c.business === v && c.stage === 'Done').length };
        };
        const any = data.finance.length + data.leads.length > 0;
        const withRevenue = ventureList.filter(v => data.finance.some(f => f.venture === v.id && f.kind === 'revenue'));
        return <>
          <section className="panel"><header className="panel-head"><h2>Money in by business, last 12 months</h2></header>
            {withRevenue.length ? <LineChart labels={lastMonths(now).map(m => m.label)} series={withRevenue.map(v => ({ id: v.id, label: v.short, color: color(v.id), values: monthlyTotals(data.finance, v.id, 'revenue', now) }))} /> : <div className="empty"><p><b>No revenue to compare yet.</b> Log money in Finance, or connect the business systems.</p></div>}
          </section>
          <section className="panel"><header className="panel-head"><h2>This month, side by side</h2></header>
            <div className="tablewrap"><table className="table"><thead><tr><th>Business</th><th className="num">Money in</th><th className="num">Money out</th><th className="num">Profit</th><th className="num">Leads</th><th className="num">Won</th><th className="num">Win rate</th><th className="num">Open tasks</th><th className="num">Done</th></tr></thead>
              <tbody>{ventureList.map(v => { const r = row(v.id); return <tr key={v.id}><td><span className="tag" style={{ '--tag': color(v.id) } as React.CSSProperties}>{v.short}</span></td><td className="num">{dollars(r.rev)}</td><td className="num">{dollars(r.cost)}</td><td className={r.rev - r.cost < 0 ? 'num neg' : 'num'}>{dollars(r.rev - r.cost)}</td><td className="num">{r.leads}</td><td className="num">{r.won}</td><td className="num">{r.rate === null ? '-' : `${r.rate}%`}</td><td className="num">{r.open}</td><td className="num">{r.done}</td></tr>; })}</tbody></table></div>
            {!any && <p className="quiet">Money and lead columns read zero because nothing has been logged yet. Tasks are live.</p>}
          </section>
        </>;
      }}
    </Gate>
  );
}

/* ------------------------------ Settings and connections ------------------------------ */
export type Connections = { shopify: boolean; ghl: boolean; exterior: boolean };
export function SettingsView({ store, displayName, role, connections, mode }: { store: DashboardStore; displayName: string; role: string; connections: Connections; mode: 'preview' | 'live' }) {
  const rows: { name: string; what: string; on: boolean; next: string }[] = [
    { name: 'Workspace database', what: 'Tasks, messages, leads, money, calendar and documents.', on: !store.missing, next: 'A founder approves the one-time database update (supabase/schemas/dashboard.sql).' },
    { name: 'Shopify (OJ Essentials)', what: 'Orders, revenue, products and stock from ojessentials.store.', on: connections.shopify, next: 'Create a read-only access token in Shopify admin and add it to the host settings as SHOPIFY_ADMIN_TOKEN.' },
    { name: 'GoHighLevel (OJ Solutions)', what: 'Clients, calls handled and pipeline.', on: connections.ghl, next: 'Create a private integration token in GoHighLevel and add it as GHL_ACCESS_TOKEN.' },
    { name: 'Exterior Care leads system', what: 'Leads, text conversations, bookings and door knocking.', on: connections.exterior, next: 'Approve database access for workspace members to the existing leads tables, and set EXTERIOR_API_URL so texts can be sent from here.' },
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

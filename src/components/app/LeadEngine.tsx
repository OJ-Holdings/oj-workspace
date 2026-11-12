'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, MessageSquare, Phone, RefreshCw } from 'lucide-react';
import { decideLeadReview, leadEngineAction, linkLsaLead, loadLeadEngine, saveLeadEngineField, syncLeadsNow, type LeadEngineAction, type LeadEngineField, type LeadEngineResult, type LeadSyncView } from '@/app/workspace/exterior-actions';
import { ago, attemptsLabel, bucket, chicagoDay, dueDay, engineStats, isSpringRevival, needsReply, PIPELINE, stageOf, townOf, suggestionsFor, type EngineLead, type Stage, type Suggestion, type ThreadEvent } from '@/lib/lead-pipeline';
import type { ReviewRow } from '@/lib/lsa-sync';
import { LEAD_SERVICES } from '@/lib/lead-extract';
import { isRealPhone, leadSources } from '@/lib/exterior-ops';
import { sourceLabel, type ExtLead } from '@/lib/exterior';
import { dollars } from '@/lib/metrics';
import { Modal } from './ExteriorManage';

// The Local Services Ads lead inbox: who is waiting on a reply, who is due a
// follow-up today, who is overdue, and everyone else. iPhone first: one column,
// big targets, every field edited in place.

type Tab = 'reply' | 'today' | 'overdue' | 'all' | 'dupes';
type Show = 'active' | 'archived' | 'spring' | 'dispute';
const stageLabel: Record<Stage, string> = { new: 'New', contacted: 'Contacted', quoted: 'Quoted', scheduled: 'Scheduled', won: 'Won', lost: 'Lost', dead: 'Dead' };
const shownPhone = (p: string | null) => p && isRealPhone(p) ? p.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, '($1) $2-$3') : null;
const shortDate = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: day.slice(0, 4) === String(new Date().getFullYear()) ? undefined : 'numeric' });
const when = (iso: string) => new Date(iso).toLocaleString('en-US', { timeZone: PIPELINE.timeZone, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

const dayName = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const plainPhone = (p: string | null) => p?.replace(/^\+?1?(\d{3})(\d{3})(\d{4})$/, '($1) $2-$3') ?? null;
const clipText = (s: string, n = 160) => { const t = s.replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

/** Sample leads in /preview carry no thread or counter. */
const fromSample = (l: ExtLead): EngineLead => ({
  ...l, email: null, manually_updated_fields: [], lsa_lead_id: null, lsa: null, proxy_phone: null, stage: null, stage_at: null, attempts: 0, contact_log: [], thread: [],
  cycle_at: null, last_customer_at: null, last_ours_at: null, quoted_at: null, scheduled_on: null, dead_reason: null, archived_at: null, revive_on: null, original_status: null, dispute: false, auto_fields: [],
});

/** Preview only: the first sample lead gets a short fake conversation (dates relative to today) so the suggestions show, plus one fake possible duplicate. */
function previewSamples(sample: ExtLead[]): { leads: EngineLead[]; reviews: ReviewRow[] } {
  const leads = sample.map(fromSample);
  const now = new Date();
  const iso = (offsetDays: number, hour: number) => { const d = new Date(now); d.setDate(d.getDate() + offsetDays); d.setHours(hour, 0, 0, 0); return d.toISOString(); };
  const upcoming = (dow: number, after: number) => { const d = new Date(now); d.setDate(d.getDate() + after); while (d.getDay() !== dow) d.setDate(d.getDate() + 1); return d; };
  const first = upcoming(2, 2), second = new Date(first); second.setDate(second.getDate() + 1);
  const md = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  if (leads[0]) {
    const l = leads[0], offered = iso(-1, 10), replied = iso(0, 8);
    leads[0] = { ...l, stage: 'contacted', stage_at: offered, quote_amount: null, quoted_at: null, scheduled_on: null, last_ours_at: offered, last_customer_at: replied,
      lsa: { ids: ['sample'], origin: 'sync', type: 'MESSAGE', category: null, service: null, status: 'NEW', charged: null, credit: null, creditAt: null, locale: null, createdAt: offered, note: null, feedback: null }, thread: [
      { id: 'sample-1', lsa: 'sample', at: offered, who: 'us', channel: 'MESSAGE', text: `Total would be $450 for the house wash. We could come Tuesday ${md(first)} or Wednesday ${md(second)}.` },
      { id: 'sample-2', lsa: 'sample', at: replied, who: 'customer', channel: 'MESSAGE', text: 'Yes Tuesday works, thanks!' },
    ] };
  }
  const reviews: ReviewRow[] = leads[1] ? [{
    id: 'sample-review', lsa_lead_id: 'sample-lsa', reason: 'Same last name, first name fits, no phone number to compare.', status: 'pending', merge_into: null, decided_by: null, decided_at: null, created_at: iso(0, 7),
    lead: { id: 'sample-lsa', type: 'MESSAGE', category: null, service: null, status: null, charged: null, credit: null, creditAt: null, locale: null, createdAt: iso(0, 7), name: 'Jenny Sample', phone: null, email: null, note: null, feedback: null },
    thread: [{ id: 'sample-3', lsa: 'sample-lsa', at: iso(0, 7), who: 'customer', channel: 'MESSAGE', text: 'Hi, do you do driveway cleaning? I think my sister called you last week.' }],
    candidates: [{ id: leads[1].id, name: 'Jennifer Sample', phone: '2625550100', address: '123 Sample St, Kenosha', why: 'same last name, first name fits' }],
  }] : [];
  return { leads, reviews };
}

export function LeadEngine({ org, mode, readOnly, sample }: { org: string; mode: 'preview' | 'live'; readOnly: boolean; sample: ExtLead[] }) {
  const [result, setResult] = useState<LeadEngineResult | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [tab, setTab] = useState<Tab>('reply');
  const [show, setShow] = useState<Show>('active');
  const [source, setSource] = useState('all');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const locked = readOnly || mode === 'preview';

  const load = useCallback(async () => {
    if (mode === 'preview') { setResult({ ok: true, ready: true, ...previewSamples(sample), customerId: null, sync: { lastRunAt: null, lastOkAt: null, errorKind: null, lastError: null, opsUsed: 0, setupProblem: 'Preview has no Google connection.', poller: false } }); return; }
    try { setResult(await loadLeadEngine(org)); } catch { setResult({ ok: false, message: 'The leads did not load. Check your connection and try again.' }); }
  }, [org, mode, sample]);
  useEffect(() => { load(); }, [load]);
  // Timers tick every minute; the list reloads every three minutes while the page is open.
  useEffect(() => {
    const tickId = setInterval(() => setNow(new Date()), 60_000);
    const loadId = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 180_000);
    return () => { clearInterval(tickId); clearInterval(loadId); };
  }, [load]);

  const run = useCallback(async (work: () => Promise<{ ok: true } | { ok: false; message: string }>, done: string) => {
    if (locked) { setNotice('Read-only here. Nothing was saved.'); return false; }
    setBusy(true); setNotice('');
    try {
      const r = await work();
      setNotice(r.ok ? done : r.message);
      if (r.ok) await load();
      return r.ok;
    } catch { setNotice('That did not go through. Check your connection and try again.'); return false; }
    finally { setBusy(false); }
  }, [locked, load]);

  const leads = useMemo(() => result?.ok && result.ready ? result.leads : [], [result]);
  const stats = useMemo(() => engineStats(leads, now), [leads, now]);
  const lists = useMemo(() => {
    const active = leads.filter(l => !l.archived_at);
    const wait = (l: EngineLead) => Date.parse(l.last_customer_at ?? '') || 0;
    const due = (l: EngineLead) => dueDay(l) ?? '';
    const q = search.trim().toLowerCase();
    const all = leads
      .filter(l => show === 'archived' ? Boolean(l.archived_at) : show === 'spring' ? isSpringRevival(l, now) : show === 'dispute' ? l.dispute : !l.archived_at)
      .filter(l => source === 'all' || (l.source ?? '') === source)
      .filter(l => !q || [l.name, l.phone, l.address, l.email, l.service_requested].some(v => (v ?? '').toLowerCase().includes(q)));
    return {
      reply: active.filter(l => needsReply(l, now)).sort((a, b) => wait(a) - wait(b)),
      today: active.filter(l => bucket(l, now) === 'today').sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')),
      overdue: active.filter(l => bucket(l, now) === 'overdue').sort((a, b) => due(a).localeCompare(due(b))),
      all,
    };
  }, [leads, now, show, source, search]);

  if (!result) return <div className="loading" aria-busy="true" />;
  if (!result.ok) return <div className="planned" role="alert"><h2>The lead inbox did not load</h2><p>{result.message}</p><button className="primary" onClick={load}>Try again</button></div>;
  if (!result.ready) return <div className="planned" role="status"><h2>Lead inbox not switched on yet</h2><p>{result.message}</p></div>;

  const open = leads.find(l => l.id === openId) ?? null;
  const springLater = leads.filter(l => l.archived_at && l.revive_on && !isSpringRevival(l, now)).length;
  const sources = [...new Set(leads.map(l => l.source).filter((s): s is string => Boolean(s)))];
  const reviews = result.reviews.filter(r => r.status === 'pending');
  const rows = tab === 'dupes' ? [] : lists[tab];

  return <section className="lead-engine" aria-label="Lead inbox">
    <SyncBanner sync={result.sync} now={now} />
    <div className="le-stats">
      {([['New today', stats.newToday], ['Needs reply', stats.needsReply], ['Due today', stats.dueToday], ['Quotes out', stats.quotesOut], ['Won this week', stats.wonThisWeek]] as const).map(([label, n]) =>
        <div key={label} className={label === 'Needs reply' && n ? 'is-hot' : undefined}><strong>{n}</strong><span>{label}</span></div>)}
    </div>
    <div className="le-syncbar">
      <span className="quiet">{result.sync.lastOkAt ? `LSA synced ${ago(result.sync.lastOkAt, now)} ago` : 'No LSA sync yet'}{result.sync.poller ? ' · auto every 10 min, 7am-10pm' : ''}</span>
      <button type="button" className="secondary small" disabled={busy || locked || Boolean(result.sync.setupProblem)} title={result.sync.setupProblem ?? undefined}
        onClick={() => run(async () => { const r = await syncLeadsNow(org); return r.ok ? { ok: true } : r; }, 'LSA sync finished.')}><RefreshCw size={14} aria-hidden="true" />Sync now</button>
    </div>
    {result.sync.setupProblem && mode === 'live' && <p className="quiet le-setup">Sync now is not available on this server: {result.sync.setupProblem}</p>}
    <p className="notice" role="status" aria-live="polite">{notice}</p>

    <div className="le-tabs" role="tablist" aria-label="Lead lists">
      {([['reply', 'Needs Reply'], ['today', 'Due Today'], ['overdue', 'Overdue'], ['all', 'All'], ['dupes', 'Possible duplicates']] as const).map(([id, label]) =>
        <button key={id} type="button" role="tab" aria-selected={tab === id} className={id === 'reply' && lists.reply.length ? 'is-hot' : undefined} onClick={() => setTab(id)}>{label}<span>{id === 'dupes' ? reviews.length : lists[id].length}</span></button>)}
    </div>
    {tab === 'all' && <div className="le-filters">
      <div className="filter-chips" role="group" aria-label="Which leads">
        {([['active', 'Active'], ['archived', 'Archived'], ['spring', 'Spring Revival'], ['dispute', 'Dispute']] as const).map(([id, label]) =>
          <button key={id} type="button" aria-pressed={show === id} onClick={() => setShow(id)}>{label}</button>)}
      </div>
      <select aria-label="Source" value={source} onChange={e => setSource(e.target.value)}>
        <option value="all">All sources</option>
        {sources.map(s => <option key={s} value={s}>{sourceLabel(s)}</option>)}
      </select>
      <input type="search" aria-label="Search leads" placeholder="Search name, phone, address" value={search} onChange={e => setSearch(e.target.value)} />
    </div>}

    {tab === 'dupes' ? (reviews.length ? <ul className="le-list">
      {reviews.map(r => <li key={r.id}><ReviewCard review={r} off={busy || locked}
        merge={cid => run(() => decideLeadReview(org, r.id, 'merge', cid), 'Merged.')} separate={() => run(() => decideLeadReview(org, r.id, 'separate'), 'Kept as a new lead.')} /></li>)}
    </ul> : <div className="empty"><p>No possible duplicates to check.</p></div>)
    : rows.length ? <ul className="le-list">
      {rows.map(l => <li key={l.id}><LeadCard lead={l} now={now} onOpen={() => setOpenId(l.id)} /></li>)}
    </ul> : <div className="empty"><p>{tab === 'reply' ? 'Nobody is waiting on a reply.' : tab === 'today' ? 'No follow-ups due today.' : tab === 'overdue' ? 'Nothing overdue.'
      : show === 'spring' ? (springLater ? `${springLater} archived lead${springLater === 1 ? '' : 's'} come back here on ${shortDate(PIPELINE.reviveOn)}.` : 'No leads on the Spring Revival list.') : 'No leads match.'}</p></div>}

    <Modal title={open?.name ?? 'Lead'} open={Boolean(open)} onClose={() => setOpenId(null)}>
      {open && <LeadPanel key={open.id} lead={open} leads={leads} now={now} busy={busy} locked={locked} customerId={result.customerId}
        act={(action, value) => run(() => leadEngineAction(org, open.id, action, value), action === 'dispute' ? (open.dispute ? 'Dispute flag removed.' : 'Flagged for an LSA dispute.') : action === 'contacted' ? 'Contact logged.' : 'Saved.')}
        save={(field, value) => run(() => saveLeadEngineField(org, open.id, field, value), 'Saved.')}
        link={async toId => { const ok = await run(() => linkLsaLead(org, open.id, toId), 'Linked. The LSA lead is archived and its messages are on this lead.'); if (ok) setOpenId(toId); return ok; }} />}
    </Modal>
  </section>;
}

/** One possible duplicate: the new LSA lead, and the existing leads it might be. Nothing merges until you tap. */
function ReviewCard({ review: r, off, merge, separate }: { review: ReviewRow; off: boolean; merge: (candidateId: string) => Promise<boolean>; separate: () => Promise<boolean> }) {
  const lastSaid = [...r.thread].reverse().find(e => e.who === 'customer' && e.text)?.text;
  const kind = r.lead.type === 'PHONE_CALL' ? 'phone call' : r.lead.type === 'MESSAGE' ? 'message' : (r.lead.type ?? 'lead').toLowerCase().replace('_', ' ');
  return <div className="le-review">
    <div className="le-card-top"><b>{r.lead.name || 'Unknown'}</b><span className="le-chip">{kind}</span></div>
    <p className="le-card-meta">Received {when(r.lead.createdAt)}</p>
    {r.reason && <p className="le-why">{r.reason}</p>}
    {lastSaid && <blockquote className="le-quote">“{clipText(lastSaid)}”</blockquote>}
    {r.candidates.map(c => <div key={c.id} className="le-cand">
      <div><b>{c.name || 'Unknown'}</b>{plainPhone(c.phone) && <span> · {plainPhone(c.phone)}</span>}</div>
      {c.address && <div className="le-card-meta">{c.address}</div>}
      <div className="quiet">{c.why}</div>
      <button type="button" className="secondary" disabled={off} onClick={() => merge(c.id)}>Merge into {c.name || 'this lead'}</button>
    </div>)}
    <button type="button" className="primary" disabled={off} onClick={separate}>Keep separate</button>
  </div>;
}

function SyncBanner({ sync, now }: { sync: LeadSyncView; now: Date }) {
  if (!sync.lastError) return null;
  const title = { setup: 'LSA sync is not set up', token: 'Google refused the service account sign-in', quota: 'Google API daily limit reached', access: 'Google Ads refused access to LSA data', api: 'The last LSA sync failed' }[sync.errorKind ?? 'api'];
  return <div className="le-banner" role="alert">
    <b>{title}</b>
    <code>{sync.lastError}</code>
    <span>{sync.lastRunAt ? `Tried ${ago(sync.lastRunAt, now)} ago. ` : ''}{sync.lastOkAt ? `Last good sync ${ago(sync.lastOkAt, now)} ago. ` : ''}Leads already here and their follow-up counts keep working.{sync.errorKind === 'token' ? ' Fix: check the key file at GOOGLE_ADS_SERVICE_ACCOUNT_KEY_PATH on the computer that syncs, or create a new key in Cloud Console.' : ''}</span>
  </div>;
}

function LeadCard({ lead: l, now, onOpen }: { lead: EngineLead; now: Date; onOpen: () => void }) {
  const stage = stageOf(l), attempts = attemptsLabel(l), due = dueDay(l), waiting = needsReply(l, now);
  const town = townOf(l.address);
  const sug = suggestionsFor(l, now);
  return <button type="button" className="le-card" onClick={onOpen}>
    <span className="le-card-top"><b>{l.name || 'Unknown'}</b><span className={`le-chip le-${stage}`}>{stageLabel[stage]}</span></span>
    <span className="le-card-meta">{[town, l.service_requested].filter(Boolean).join(' · ') || <span className="quiet">No town or service yet</span>}</span>
    <span className="le-card-foot">
      {waiting && <span className="le-wait">waiting {ago(l.last_customer_at, now)}</span>}
      {!waiting && l.last_customer_at && <span>last msg {ago(l.last_customer_at, now)} ago</span>}
      {attempts && <span>{attempts}</span>}
      {due && !waiting && <span>due {shortDate(due)}</span>}
      {l.quote_amount !== null && <span>{dollars(l.quote_amount)}</span>}
      {l.dispute && <span className="le-flag">Dispute</span>}
      {sug.length > 0 && <span className="le-hint">Suggests: {sug[0].kind === 'quoted' ? `quoted ${dollars(sug[0].amount)}` : `scheduled ${shortDate(sug[0].day)}`}{sug.length > 1 ? ` +${sug.length - 1}` : ''}</span>}
      {l.archived_at && <span className="quiet">archived{l.revive_on ? ` until ${shortDate(l.revive_on)}` : ''}</span>}
    </span>
  </button>;
}

/** Link to existing lead: an LSA lead the sync added that is someone already here. Search, pick, confirm. */
function LinkToLead({ lead, leads, off, link }: { lead: EngineLead; leads: EngineLead[]; off: boolean; link: (toId: string) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase(), digits = term.replace(/\D/g, '');
  const matches = useMemo(() => term.length < 2 ? [] : leads.filter(o => o.id !== lead.id && !o.lsa?.mergedInto
    && ([o.name, o.address, o.email].some(v => (v ?? '').toLowerCase().includes(term)) || (digits.length >= 3 && (o.phone ?? '').replace(/\D/g, '').includes(digits)))).slice(0, 8), [term, digits, leads, lead.id]);
  if (!open) return <button type="button" className="secondary" disabled={off} onClick={() => setOpen(true)}>Link to existing lead</button>;
  return <div className="le-review">
    <label className="le-field"><span>Link to existing lead</span>
      <input type="search" autoFocus placeholder="Search name, phone, address" value={q} onChange={e => setQ(e.target.value)} /></label>
    {term.length >= 2 && !matches.length && <p className="quiet">No lead matches.</p>}
    {matches.map(o => <div key={o.id} className="le-cand">
      <div><b>{o.name || 'Unknown'}</b>{shownPhone(o.phone) && <span> · {shownPhone(o.phone)}</span>}</div>
      {o.address && <div className="le-card-meta">{o.address}</div>}
      <div className="quiet">{stageLabel[stageOf(o)]}{o.archived_at ? ' · archived' : ''}{o.lsa?.origin === 'sync' ? ' · LSA lead' : ''}</div>
      <button type="button" className="secondary" disabled={off}
        onClick={() => window.confirm(`Link this LSA lead to ${o.name || 'that lead'}? Its messages move there, only that lead's empty fields are filled, and this LSA lead is archived (not deleted).`) && link(o.id)}>Link to {o.name || 'this lead'}</button>
    </div>)}
    <button type="button" className="secondary" onClick={() => { setOpen(false); setQ(''); }}>Cancel</button>
  </div>;
}

function LeadPanel({ lead: l, leads, now, busy, locked, customerId, act, save, link }: {
  lead: EngineLead; leads: EngineLead[]; now: Date; busy: boolean; locked: boolean; customerId: string | null;
  act: (action: LeadEngineAction, value?: string | number | null) => Promise<boolean>; save: (field: LeadEngineField, value: string) => Promise<boolean>;
  link: (toId: string) => Promise<boolean>;
}) {
  const stage = stageOf(l), attempts = attemptsLabel(l), due = dueDay(l), phone = shownPhone(l.phone);
  const message = l.lsa?.type === 'MESSAGE' || Boolean(l.proxy_phone);
  const thread = useRef<HTMLOListElement>(null);
  useEffect(() => { thread.current?.scrollTo({ top: thread.current.scrollHeight }); }, [l.thread.length]);
  const off = busy || locked;
  const sug = suggestionsFor(l, now);
  const quote = () => {
    const raw = window.prompt('Quote amount ($)', l.quote_amount === null ? '' : String(l.quote_amount));
    if (raw === null) return;
    const amount = Number(raw.replace(/[$,\s]/g, ''));
    if (!Number.isFinite(amount) || amount < 0) { window.alert('Enter a number, like 450.'); return; }
    act('quoted', amount);
  };

  return <div className="le-panel">
    <p className="le-panel-status">
      <span className={`le-chip le-${stage}`}>{stageLabel[stage]}</span>
      {attempts && <span>Attempts {attempts}</span>}
      {due && <span>Next {shortDate(due)}{due < chicagoDay(now) ? ' (overdue)' : ''}</span>}
      {needsReply(l, now) && <span className="le-wait">waiting {ago(l.last_customer_at, now)}</span>}
      {l.archived_at && <span>Archived{l.revive_on ? `, back ${shortDate(l.revive_on)}` : ''}</span>}
    </p>
    {l.dead_reason && <p className="le-why">{l.dead_reason}</p>}

    {sug.length > 0 && <div className="le-suggest" aria-label="Suggestions from the conversation">
      {sug.map((s: Suggestion) => s.kind === 'quoted'
        ? <div key={`q${s.amount}`}><button type="button" className="secondary" disabled={off} onClick={() => act('quoted', s.amount)}>Mark quoted {dollars(s.amount)}?</button><small className="quiet">“{clipText(s.line)}”</small></div>
        : <div key={`s${s.day}`}><button type="button" className="secondary" disabled={off} onClick={() => act('scheduled', s.day)}>Mark scheduled for {dayName(s.day)}?</button><small className="quiet">Customer: “{clipText(s.line)}”</small></div>)}
    </div>}

    <div className="le-actions">
      {phone && <a className="secondary" href={`tel:${l.phone}`}><Phone size={15} aria-hidden="true" />Call</a>}
      {phone && <a className="secondary" href={`sms:${l.phone}`}><MessageSquare size={15} aria-hidden="true" />Text</a>}
      {message && <a className="secondary" href={`https://ads.google.com/localservices/leads${customerId ? `?cid=${customerId}` : ''}`} target="_blank" rel="noreferrer"><ExternalLink size={15} aria-hidden="true" />Open in LSA</a>}
      <button type="button" className="primary" disabled={off} onClick={() => act('contacted')}>Contacted</button>
      <button type="button" className="secondary" disabled={off} onClick={quote}>Quoted</button>
      <label className="le-date secondary">Scheduled<input type="date" disabled={off} value={l.scheduled_on ?? ''} onChange={e => e.target.value && act('scheduled', e.target.value)} /></label>
      <button type="button" className="secondary" disabled={off} onClick={() => act('won')}>Won</button>
      <button type="button" className="secondary" disabled={off} onClick={() => act('lost')}>Lost</button>
      <button type="button" className="secondary" disabled={off} onClick={() => window.confirm('Mark Dead? It is archived and comes back on the Spring Revival list.') && act('dead')}>Dead</button>
      {l.archived_at && <button type="button" className="secondary" disabled={off} onClick={() => act('unarchive')}>Unarchive</button>}
      <label className="le-toggle"><input type="checkbox" disabled={off} checked={l.dispute} onChange={() => act('dispute')} />Dispute?</label>
    </div>
    {l.lsa?.origin === 'sync' && !l.lsa.mergedInto && <LinkToLead lead={l} leads={leads} off={off} link={link} />}

    <div className="le-fields">
      <Field lead={l} field="name" label="Name" save={save} locked={off} />
      <Field lead={l} field="phone" label="Phone" save={save} locked={off} value={phone ?? ''} inputMode="tel" />
      {l.proxy_phone && <p className="le-field le-proxy"><span>Google proxy number</span><b>{l.proxy_phone}</b></p>}
      <Field lead={l} field="email" label="Email" save={save} locked={off} inputMode="email" />
      <Field lead={l} field="address" label="Address" save={save} locked={off} />
      <Field lead={l} field="service_requested" label="Service" save={save} locked={off} list="le-services" />
      <datalist id="le-services">{LEAD_SERVICES.map(s => <option key={s} value={s} />)}</datalist>
      <Field lead={l} field="quote_amount" label="Quote ($)" save={save} locked={off} value={l.quote_amount === null ? '' : String(l.quote_amount)} inputMode="decimal" />
      <label className="le-field"><span>Source</span>
        <select disabled={off} value={l.source ?? ''} onChange={e => save('source', e.target.value)}>
          {!l.source && <option value="">-</option>}
          {leadSources.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          {l.source && !leadSources.some(([id]) => id === l.source) && <option value={l.source}>{l.source}</option>}
        </select>
      </label>
      <Field lead={l} field="notes" label="Notes" save={save} locked={off} multiline />
    </div>

    {l.lsa && <p className="le-lsa quiet">LSA {(l.lsa.type ?? 'lead').toLowerCase().replace('_', ' ')} · {l.lsa.charged === null ? 'charge unknown' : l.lsa.charged ? 'charged' : 'not charged'}{l.lsa.credit && l.lsa.credit !== 'UNSPECIFIED' ? ` · credit ${l.lsa.credit.toLowerCase()}` : ''}{l.lsa.createdAt ? ` · ${when(l.lsa.createdAt)}` : ''}</p>}
    <h3 className="le-thread-title">Conversation</h3>
    {l.thread.length ? <ol className="le-thread" ref={thread}>{l.thread.map(e => <Bubble key={e.id} e={e} />)}</ol>
      : <p className="quiet">No LSA messages on this lead.</p>}
  </div>;
}

function Bubble({ e }: { e: ThreadEvent }) {
  const call = e.channel === 'PHONE_CALL';
  const minutes = e.seconds ? `${Math.floor(e.seconds / 60)}m ${e.seconds % 60}s` : null;
  return <li className={`le-msg le-${e.who}`}>
    <div className="le-bubble">
      {call ? <p><Phone size={13} aria-hidden="true" /> {e.who === 'customer' ? 'Call from customer' : e.who === 'us' ? 'Call from us' : 'Call'}{minutes ? `, ${minutes}` : ''}</p> : null}
      {e.text ? <p>{e.text}</p> : !call ? <p className="quiet">{e.channel.toLowerCase().replace('_', ' ')}</p> : null}
      {e.attachments?.map((url, i) => <a key={url} href={url} target="_blank" rel="noreferrer">Attachment {i + 1}</a>)}
      {e.recording && <a href={e.recording} target="_blank" rel="noreferrer">Call recording</a>}
    </div>
    <time dateTime={e.at}>{when(e.at)}</time>
  </li>;
}

/** Tap to edit; saves when you leave the field. No Save button. */
function Field({ lead, field, label, save, locked, value, inputMode, list, multiline }: {
  lead: EngineLead; field: LeadEngineField; label: string; save: (field: LeadEngineField, value: string) => Promise<boolean>; locked: boolean;
  value?: string; inputMode?: 'tel' | 'email' | 'decimal'; list?: string; multiline?: boolean;
}) {
  const stored = value ?? String((lead as Record<string, unknown>)[field] ?? '');
  const [draft, setDraft] = useState(stored);
  useEffect(() => setDraft(stored), [stored]);
  const blur = async () => { if (draft.trim() !== stored.trim() && !(await save(field, draft))) setDraft(stored); };
  const auto = lead.auto_fields.includes(field);
  return <label className="le-field"><span>{label}{auto && <em className="le-auto" title="Filled in from the customer's messages">auto</em>}</span>
    {multiline
      ? <textarea rows={3} disabled={locked} value={draft} onChange={e => setDraft(e.target.value)} onBlur={blur} />
      : <input disabled={locked} value={draft} inputMode={inputMode} list={list} onChange={e => setDraft(e.target.value)} onBlur={blur} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />}
  </label>;
}

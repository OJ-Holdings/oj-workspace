'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, RefreshCw } from 'lucide-react';
import { loadOutreach, loadOutreachHistory, updateOutreachStatus } from '@/app/workspace/outreach-actions';
import { contactsMarkedToday, effectiveOutreachStatus, outreachNextStep, selectProspects, outreachStatuses, safeOutreachUrl, type OutreachActivity, type OutreachProspect, type OutreachStatus, type OutreachQueue } from '@/lib/outreach';
import { RecordPanel } from './RecordPanel';
import { useViewParams } from './useViewParams';

type Props = { organizationId: string; mode: 'preview' | 'live'; readOnly: boolean; displayName: string; examples: OutreachProspect[] };
type Sync = { status: string; rows_written: number; error_summary: string; finished_at: string };
const queues = [['all', 'All prospects'], ['pending', 'To contact'], ['replies', 'Replies'], ['demos', 'Demos']] as const;

export function OutreachQueueView({ organizationId, mode, readOnly, displayName, examples }: Props) {
  const { params, update } = useViewParams();
  const query = (params.get('q') ?? '').slice(0, 200);
  const owner = ['Oscar', 'Jacob'].includes(params.get('owner') ?? '') ? params.get('owner')! : '';
  const status = outreachStatuses.find(s => s === params.get('status')) ?? '';
  const queue = (queues.find(([id]) => id === params.get('view'))?.[0] ?? 'all') as OutreachQueue;
  const selectedId = params.get('prospect');
  const [prospects, setProspects] = useState(mode === 'preview' ? examples : []);
  const [activity, setActivity] = useState<OutreachActivity[] | null>(mode === 'preview' ? [] : null);
  const [total, setTotal] = useState(prospects.length);
  const [activityLimited, setActivityLimited] = useState(false);
  const [lastSync, setLastSync] = useState<Sync | null>(null);
  const [loading, setLoading] = useState(mode === 'live');
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNotice(''); }, [selectedId]);

  useEffect(() => {
    const tick = () => { setNow(new Date()); if (document.visibilityState === 'visible') setRevision(r => r + 1); };
    setNow(new Date());
    const timer = window.setInterval(tick, 60_000);
    window.addEventListener('focus', tick);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', tick); };
  }, []);
  useEffect(() => {
    if (mode !== 'live' || saving) return;
    let active = true;
    loadOutreach(organizationId).then(data => {
      if (!active) return;
      setProspects(data.prospects); setTotal(data.total); setLastSync(data.lastSync); setActivity(data.activity); setActivityLimited(data.activityLimited); setError('');
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Could not load outreach.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [organizationId, mode, revision, saving]);

  const filtered = useMemo(() => selectProspects(prospects, query, owner, status, queue), [prospects, query, owner, status, queue]);
  const selected = prospects.find(p => p.id === selectedId);
  const index = filtered.findIndex(p => p.id === selectedId);
  const pending = prospects.filter(p => effectiveOutreachStatus(p) === 'Not Sent').length;
  const mine = ['Oscar', 'Jacob'].find(name => displayName.toLowerCase().split(/\s+/)[0] === name.toLowerCase()) ?? (mode === 'preview' ? 'Oscar' : null);

  async function changeStatus(p: OutreachProspect, next: OutreachStatus) {
    if (readOnly || mode !== 'live' || saving || next === effectiveOutreachStatus(p)) return;
    setSaving(true); setNotice('');
    try {
      await updateOutreachStatus(organizationId, p.id, next);
      setProspects(current => current.map(item => item.id === p.id ? { ...item, outreach_status: next } : item));
      setNotice(`${p.business_name}: ${next} recorded.`);
      setRevision(r => r + 1);
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Could not save the status.'); }
    finally { setSaving(false); }
  }

  return <section className="outreach-view" aria-labelledby="outreach-title">
    <header className="page-head outreach-head"><div><h1 id="outreach-title">Outreach</h1><p>Research to conversations. Pick a prospect and keep the next step moving.</p></div>
      <button className="secondary" disabled={mode === 'preview' || saving || loading} onClick={() => { setLoading(true); setRevision(r => r + 1); }}><RefreshCw size={15} />Refresh</button>
    </header>
    {mode === 'preview' ? <p className="outreach-preview-note">Fictional preview. Status changes are disabled; drafts can be inspected and copied.</p> : <p className="quiet">{lastSync ? `Latest import: ${lastSync.status}, ${new Date(lastSync.finished_at).toLocaleString()}` : 'Waiting for the first spreadsheet import.'}</p>}
    {error && <div className="outreach-error" role="alert"><b>Outreach could not refresh.</b><span>{error} Use Refresh to retry. Previously loaded records may be stale.</span></div>}
    {lastSync?.status === 'failed' && <p className="outreach-error" role="status">The latest spreadsheet import failed. {lastSync.error_summary || 'Review the sheet connection.'}</p>}
    {loading && <p role="status" className="quiet">Loading outreach…</p>}
    {!loading && <>
      <div className="outreach-summary">
        <div><span>Prospects loaded</span><strong>{prospects.length}</strong><small>{total > prospects.length ? `Showing the latest ${prospects.length} of ${total}. Filters cover loaded records.` : 'Imported research'}</small></div>
        <div><span>Still to contact</span><strong>{pending}</strong><small>Loaded prospects marked Not Sent</small></div>
        <div><span>Contact marked today</span><strong>{activity && now ? `${activityLimited ? '≥ ' : ''}${contactsMarkedToday(activity, now)}` : '—'}</strong><small>{activity ? 'Unique prospects in manual status history · Central time' : 'Status history unavailable'}</small></div>
      </div>
      <p className="quiet">Contact markings are not verified message delivery. Import dates do not count as activity.</p>
      <div className="queue-tabs" role="group" aria-label="Prospect queues">{queues.map(([id, label]) => <button key={id} aria-pressed={queue === id} onClick={() => update({ view: id === 'all' ? '' : id, status: '' })}>{label}</button>)}{mine && <button aria-pressed={owner === mine} onClick={() => update({ owner: owner === mine ? '' : mine })}>Mine</button>}</div>
      <div className="outreach-toolbar">
        <label className="outreach-search">Search prospects<input type="search" maxLength={200} value={query} placeholder="Business, service, person…" onChange={e => update({ q: e.target.value })} /></label>
        <label>Assigned to<select value={owner} onChange={e => update({ owner: e.target.value })}><option value="">Everyone</option><option>Oscar</option><option>Jacob</option></select></label>
        <label>Status<select value={status} onChange={e => update({ status: e.target.value, view: '' })}><option value="">All statuses</option>{outreachStatuses.map(s => <option key={s}>{s}</option>)}</select></label>
      </div>
      <div className="queue-result-head"><p role="status">{filtered.length} matching {filtered.length === 1 ? 'prospect' : 'prospects'}</p>{(query || owner || status || queue !== 'all') && <button className="text-link" onClick={() => update({ q: '', owner: '', status: '', view: '' })}>Clear filters</button>}</div>
      {filtered.length ? <ul className="prospect-queue">{filtered.map(p => <li key={p.id}><button onClick={() => update({ prospect: p.id }, true)} aria-haspopup="dialog">
        <span className="prospect-company"><b>{p.business_name}</b><small>{[p.industry, p.city_state].filter(Boolean).join(' / ') || 'Details not recorded'}</small></span>
        <span className="prospect-fit">{p.best_fit_service || 'Service fit not recorded'}</span><span className="prospect-owner">{p.sent_by || 'Unassigned'}</span>
        <span className="prospect-next"><span className="service-chip">{effectiveOutreachStatus(p)}</span><small>{outreachNextStep(effectiveOutreachStatus(p))}</small></span><ChevronRight size={17} aria-hidden="true" />
      </button></li>)}</ul> : <div className="panel outreach-empty"><h2>{prospects.length ? 'No matching prospects' : 'No prospects imported yet'}</h2><p>{prospects.length ? 'Clear the filters or try another search.' : 'Add businesses to the Outreach spreadsheet tab, then run the configured import.'}</p></div>}
    </>}
    {selectedId && !loading && <RecordPanel titleId="prospect-title" focusKey={selectedId} onClose={() => update({ prospect: '' })}>
      {selected ? <>
        <div className="record-stepper"><button className="icon-button" aria-label="Previous prospect" disabled={index <= 0} onClick={() => update({ prospect: filtered[index - 1].id })}><ChevronLeft size={18} /></button><span>{index >= 0 ? `${index + 1} of ${filtered.length}` : 'Outside current filters'}</span><button className="icon-button" aria-label="Next prospect" disabled={index < 0 || index >= filtered.length - 1} onClick={() => update({ prospect: filtered[index + 1].id })}><ChevronRight size={18} /></button></div>
        <h2 id="prospect-title" tabIndex={-1}>{selected.business_name}</h2><p className="quiet">{[selected.industry, selected.city_state, selected.sent_by ? `For ${selected.sent_by}` : 'Unassigned'].filter(Boolean).join(' / ')}</p>
        <div className="outreach-controls"><label>Status<select aria-label={`Outreach status for ${selected.business_name}`} value={effectiveOutreachStatus(selected)} disabled={readOnly || mode === 'preview' || saving} onChange={e => changeStatus(selected, e.target.value as OutreachStatus)}>{outreachStatuses.map(s => <option key={s}>{s}</option>)}</select></label><span>{outreachNextStep(effectiveOutreachStatus(selected))}</span></div>
        <p role="status" className="outreach-notice">{saving ? 'Recording status…' : notice || 'Changes are recorded in the workspace. Contacting a prospect remains a separate action.'}</p>
        <ProspectDetails key={selected.id} prospect={selected} org={organizationId} preview={mode === 'preview'} revision={revision} />
      </> : <><h2 id="prospect-title">Prospect not available</h2><p>This prospect is not in the loaded records. Refresh the queue or close this panel and choose another.</p></>}
    </RecordPanel>}
  </section>;
}

function ProspectDetails({ prospect: p, org, preview, revision }: { prospect: OutreachProspect; org: string; preview: boolean; revision: number }) {
  const [history, setHistory] = useState<{ entries: OutreachActivity[]; total: number } | null>(null);
  const [historyError, setHistoryError] = useState('');
  const [copied, setCopied] = useState('');
  useEffect(() => {
    if (preview) return;
    let active = true;
    loadOutreachHistory(org, p.id).then(data => { if (active) { setHistory(data); setHistoryError(''); } }).catch(e => { if (active) setHistoryError(e instanceof Error ? e.message : 'History unavailable.'); });
    return () => { active = false; };
  }, [org, p.id, preview, revision]);
  async function copy(label: string, value: string) {
    try { await navigator.clipboard.writeText(value); setCopied(`${label} copied.`); }
    catch { setCopied('Clipboard unavailable. Select and copy the draft text below.'); }
  }
  const website = safeOutreachUrl(p.website_url);
  const social = (value: string | null, root: string) => !value ? null : /^https?:\/\//i.test(value) ? safeOutreachUrl(value) : `${root}/${encodeURIComponent(value.trim().replace(/^@/, ''))}`;
  const instagram = social(p.instagram, 'https://instagram.com'), facebook = social(p.facebook, 'https://facebook.com');
  return <div className="prospect-details">
    <section><h3>Opportunity</h3><div className="outreach-fit"><span className="service-chip">{p.best_fit_service || 'Fit not recorded'}</span>{p.secondary_fit && <span className="service-chip is-muted">{p.secondary_fit}</span>}</div><p>{p.leak || 'Opportunity not recorded.'}</p><h4>Research evidence</h4><p>{p.evidence || 'Evidence not recorded.'}</p></section>
    <section><h3>Contact</h3><p>{p.decision_maker || 'Decision maker not recorded.'}</p><div className="outreach-contact">{p.email && <a href={`mailto:${p.email}`}>{p.email}</a>}{p.phone_number && <a href={`tel:${p.phone_number}`}>{p.phone_number}</a>}{website && <a href={website} target="_blank" rel="noreferrer">Website</a>}{instagram && <a href={instagram} target="_blank" rel="noreferrer">Instagram</a>}{facebook && <a href={facebook} target="_blank" rel="noreferrer">Facebook</a>}{!p.email && !p.phone_number && !website && !instagram && !facebook && <span>No contact channels recorded.</span>}</div></section>
    <section><h3>Drafts</h3><p className="quiet">Review before sending. Copying does not send or change status.</p><p role="status">{copied}</p>{[['Email subject', p.email_subject], ['Email draft', p.email_body], ['DM draft', p.dm]].map(([label, value]) => value && <div className="draft-block" key={label}><header><h4>{label}</h4><button className="secondary" onClick={() => copy(label!, value)}><Copy size={14} />Copy {label!.toLowerCase()}</button></header><p>{value}</p></div>)}{!p.email_subject && !p.email_body && !p.dm && <p>No drafts imported for this prospect.</p>}</section>
    {(p.source_notes || p.outreach_notes) && <section><h3>Notes</h3>{p.outreach_notes && <p>{p.outreach_notes}</p>}{p.source_notes && <p>From sheet: {p.source_notes}</p>}</section>}
    <section><h3>Status history</h3>{preview ? <p className="quiet">No recorded activity in this fictional preview.</p> : historyError ? <p role="alert">{historyError}</p> : history ? <>{history.total > 30 && <p className="quiet">Latest 30 of {history.total} changes.</p>}{history.entries.length ? <ol className="prospect-history">{history.entries.map(a => <li key={a.id}><b>{a.previous_status} → {a.new_status}</b><time dateTime={a.created_at}>{new Date(a.created_at).toLocaleString()}</time></li>)}</ol> : <p>No workspace status changes yet. The imported status is {p.source_status}.</p>}</> : <p role="status">Loading history…</p>}</section>
  </div>;
}

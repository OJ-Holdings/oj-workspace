'use client';

import { useEffect, useMemo, useState } from 'react';
import { loadOutreach, updateOutreachStatus } from '@/app/workspace/outreach-actions';
import { effectiveOutreachStatus, isOutreachComplete, outreachStatuses, safeOutreachUrl, type OutreachProspect, type OutreachStatus } from '@/lib/outreach';

const demoDate = new Date().toISOString().slice(0, 10);
const previewProspects: OutreachProspect[] = [
  { id: 'preview-o1', organization_id: 'preview', source_key: 'preview-one', source_row: 2, business_name: 'Sample Dental Studio', industry: 'Dental', city_state: 'Kenosha, WI', website_url: 'https://example.invalid', phone_number: '(262) 555-0100', decision_maker: 'Office manager', best_fit_service: 'AI Receptionist', secondary_fit: 'Website', leak: 'Sample only: after-hours calls appear to go unanswered.', evidence: 'Fictional preview record. Not a real business.', email: 'hello@example.invalid', instagram: null, facebook: null, email_subject: 'A sample subject', email_body: 'This is a fictional preview outreach draft.', dm: 'This is a fictional preview direct message.', date_added: demoDate, sent_by: 'Oscar', source_status: 'Not Sent', source_notes: null, outreach_status: null, outreach_notes: '', status_updated_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), last_seen_at: new Date().toISOString() },
  { id: 'preview-o2', organization_id: 'preview', source_key: 'preview-two', source_row: 3, business_name: 'Sample Auto Care', industry: 'Automotive', city_state: 'Racine, WI', website_url: null, phone_number: null, decision_maker: null, best_fit_service: 'Website', secondary_fit: null, leak: 'Sample only: no online booking link shown.', evidence: 'Fictional preview record. Not a real business.', email: null, instagram: null, facebook: null, email_subject: null, email_body: null, dm: null, date_added: demoDate, sent_by: 'Jacob', source_status: 'Emailed', source_notes: null, outreach_status: null, outreach_notes: '', status_updated_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), last_seen_at: new Date().toISOString() },
];

function todayCentral() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  return `${parts.find(p => p.type === 'year')?.value}-${parts.find(p => p.type === 'month')?.value}-${parts.find(p => p.type === 'day')?.value}`;
}
const dateLabel = (iso: string | null) => iso ? new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Date not recorded';
const socialUrl = (value: string, base: string) => /^https?:\/\//i.test(value.trim())
  ? safeOutreachUrl(value)
  : `${base}/${encodeURIComponent(value.trim().replace(/^@/, ''))}`;

export function OutreachView({ organizationId, mode, readOnly }: { organizationId: string; mode: 'preview' | 'live'; readOnly: boolean }) {
  const [prospects, setProspects] = useState<OutreachProspect[]>(mode === 'preview' ? previewProspects : []);
  const [lastSync, setLastSync] = useState<{ status: string; rows_written: number; error_summary: string; finished_at: string } | null>(null);
  const [loading, setLoading] = useState(mode === 'live');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [savingId, setSavingId] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (mode !== 'live') return;
    let active = true;
    loadOutreach(organizationId).then(data => { if (active) { setProspects(data.prospects); setLastSync(data.lastSync); setError(''); } })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : 'Could not load outreach.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [mode, organizationId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return prospects.filter(p => {
      const status = effectiveOutreachStatus(p);
      const matchesQuery = !q || [p.business_name, p.industry, p.city_state, p.best_fit_service, p.secondary_fit, p.decision_maker, p.email, p.sent_by]
        .some(v => (v ?? '').toLowerCase().includes(q));
      return matchesQuery && (ownerFilter === 'All' || p.sent_by === ownerFilter) && (statusFilter === 'All' || status === statusFilter);
    });
  }, [prospects, query, ownerFilter, statusFilter]);

  const today = todayCentral();
  const queuedToday = prospects.filter(p => p.date_added === today && !isOutreachComplete(effectiveOutreachStatus(p))).length;
  const doneToday = prospects.filter(p => p.date_added === today && isOutreachComplete(effectiveOutreachStatus(p))).length;
  const pending = prospects.filter(p => !isOutreachComplete(effectiveOutreachStatus(p))).length;

  async function changeStatus(p: OutreachProspect, status: OutreachStatus) {
    if (mode === 'preview' || readOnly) return;
    const previous = effectiveOutreachStatus(p);
    setSavingId(p.id); setNotice('');
    setProspects(current => current.map(item => item.id === p.id ? { ...item, outreach_status: status } : item));
    try {
      await updateOutreachStatus(organizationId, p.id, status);
      setNotice(`${p.business_name}: ${status} recorded.`);
    } catch (e) {
      setProspects(current => current.map(item => item.id === p.id ? { ...item, outreach_status: p.outreach_status } : item));
      setNotice(e instanceof Error ? e.message : 'Could not save the status.');
    } finally { setSavingId(''); }
    if (previous === status) setNotice(`${p.business_name} is already marked ${status}.`);
  }

  return <section className="outreach-view" aria-labelledby="outreach-title">
    <header className="page-head outreach-head">
      <div><p className="eyebrow">OJ SOLUTIONS · DAILY PROSPECTING</p><h1 id="outreach-title">Outreach</h1>
        <p>Today’s targets, each prospect’s fit, and the progress you and Jacob record.</p></div>
      {mode === 'preview' ? <span className="preview-badge">Sample only</span> : <span className={`sync-badge ${lastSync?.status === 'success' ? 'is-good' : lastSync?.status === 'failed' ? 'is-bad' : ''}`}>
        {lastSync ? `${lastSync.status === 'success' ? 'Synced' : lastSync.status === 'failed' ? 'Sync failed' : 'Sync needs review'} · ${new Date(lastSync.finished_at).toLocaleString()}` : 'Waiting for first nightly sync'}
      </span>}
    </header>

    {mode === 'preview' && <p className="outreach-preview-note">Fictional records for preview. Live prospects appear after the private spreadsheet sync is configured.</p>}
    {error && <div className="outreach-error" role="alert"><b>Outreach data is not available.</b><span>{error}</span></div>}
    {lastSync?.status === 'failed' && <div className="outreach-error" role="status"><b>The latest import failed.</b><span>{lastSync.error_summary || 'Check the connection setup and Netlify function logs.'}</span></div>}
    {loading && <p className="quiet">Loading outreach…</p>}

    {!loading && !error && <>
      <div className="outreach-summary" aria-label="Outreach summary">
        <div><span>Prospects</span><strong>{prospects.length}</strong><small>Imported from the Outreach tab</small></div>
        <div><span>Still to contact</span><strong>{pending}</strong><small>Current status is Not Sent</small></div>
        <div><span>Added today · open</span><strong>{queuedToday}</strong><small>{doneToday} of {queuedToday + doneToday} recorded as contacted or resolved</small></div>
      </div>

      {notice && <p className="outreach-notice" role="status">{notice}</p>}
      <div className="outreach-toolbar">
        <label className="outreach-search">Search prospects<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Business, service, person…" /></label>
        <label>Assigned to<select value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)}><option>All</option><option>Oscar</option><option>Jacob</option></select></label>
        <label>Status<select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option>All</option>{outreachStatuses.map(s => <option key={s}>{s}</option>)}</select></label>
      </div>

      {filtered.length ? <div className="outreach-list">{filtered.map(p => {
        const status = effectiveOutreachStatus(p);
        return <article className="panel outreach-card" key={p.id}>
          <div className="outreach-card-top">
            <div className="outreach-company"><h2>{p.business_name}</h2><p>{[p.industry, p.city_state].filter(Boolean).join(' · ') || 'Industry and location not recorded'}</p></div>
            <div className="outreach-controls"><span>{p.sent_by ? `For ${p.sent_by}` : 'Unassigned'} · {dateLabel(p.date_added)}</span>
              <label>Status<select aria-label={`Outreach status for ${p.business_name}`} value={status} disabled={readOnly || mode === 'preview' || savingId === p.id} onChange={e => changeStatus(p, e.target.value as OutreachStatus)}>{outreachStatuses.map(s => <option key={s}>{s}</option>)}</select></label>
            </div>
          </div>
          <div className="outreach-fit"><span className="service-chip">{p.best_fit_service || 'Service fit not set'}</span>{p.secondary_fit && <span className="service-chip is-muted">Also: {p.secondary_fit}</span>}</div>
          {(p.leak || p.evidence) && <div className="outreach-evidence">
            {p.leak && <p><b>Opportunity</b>{p.leak}</p>}{p.evidence && <p><b>Evidence</b>{p.evidence}</p>}
          </div>}
          <div className="outreach-contact">
            {p.decision_maker && <span>Contact: {p.decision_maker}</span>}{p.email && <a href={`mailto:${p.email}`}>{p.email}</a>}
            {p.phone_number && <a href={`tel:${p.phone_number}`}>{p.phone_number}</a>}
            {safeOutreachUrl(p.website_url) && <a href={safeOutreachUrl(p.website_url)!} target="_blank" rel="noreferrer">Website ↗</a>}
            {p.instagram && socialUrl(p.instagram, 'https://instagram.com') && <a href={socialUrl(p.instagram, 'https://instagram.com')!} target="_blank" rel="noreferrer">Instagram ↗</a>}
            {p.facebook && socialUrl(p.facebook, 'https://facebook.com') && <a href={socialUrl(p.facebook, 'https://facebook.com')!} target="_blank" rel="noreferrer">Facebook ↗</a>}
          </div>
          {(p.email_subject || p.email_body || p.dm || p.source_notes) && <details className="outreach-drafts"><summary>Drafts and notes</summary>
            {p.email_subject && <p><b>Email subject</b>{p.email_subject}</p>}{p.email_body && <p><b>Email draft</b>{p.email_body}</p>}{p.dm && <p><b>DM draft</b>{p.dm}</p>}{p.source_notes && <p><b>Sheet notes</b>{p.source_notes}</p>}
          </details>}
        </article>;
      })}</div> : <div className="panel outreach-empty"><h2>{prospects.length ? 'No matching prospects' : 'No prospects imported yet'}</h2><p>{prospects.length ? 'Try changing the search or filters.' : mode === 'preview' ? 'Preview examples are shown above; the real sheet currently has its header row but no business rows.' : 'The daily spreadsheet sync will add prospects after rows are added to the Outreach tab.'}</p></div>}
    </>}
  </section>;
}


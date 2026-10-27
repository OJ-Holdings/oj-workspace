'use client';

import { useMemo, useState } from 'react';
import { setLeadSources } from '@/app/workspace/exterior-actions';
import { leadSources } from '@/lib/exterior-ops';
import { sourceLabel, type ExteriorData } from '@/lib/exterior';
import { Modal, type Act } from './ExteriorManage';

type Props = { open: boolean; close: () => void; data: ExteriorData; act: Act; busy: boolean; org: string };

const UNCLEAR = new Set(['', 'other', 'manual', 'dtd', 'door-to-door', 'phone']);
const shortDay = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-');

/**
 * Tag where customers came from in bulk. Most of this season's leads are labelled door to door or Other even though Local Services Ads,
 * the website and referrals now bring most of them. Tick the leads, pick the real source, apply. Only the source field changes.
 */
export function LeadSourceTagger({ open, close, data, act, busy, org }: Props) {
  const [scope, setScope] = useState<'unclear' | 'all'>('unclear');
  const [since, setSince] = useState('2026-07-01');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [source, setSource] = useState('lsa');
  const rows = useMemo(() => data.leads
    .filter(l => (scope === 'all' || UNCLEAR.has((l.source ?? '').trim().toLowerCase())) && (!since || (l.created_at ?? '') >= since))
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
    .slice(0, 400), [data.leads, scope, since]);
  const toggle = (id: string) => setPicked(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const chosen = rows.filter(r => picked.has(r.id));

  return (
    <Modal title="Tag lead sources" open={open} onClose={close}>
      <p className="quiet">Choose the leads that came from one place, pick that source, and apply. Only the source changes.</p>
      <div className="form-grid">
        <label>Show
          <select value={scope} onChange={e => setScope(e.target.value as 'unclear' | 'all')}>
            <option value="unclear">Leads with an unclear source (blank, Other, door to door, phone)</option>
            <option value="all">All leads</option>
          </select>
        </label>
        <label>Created on or after<input type="date" value={since} onChange={e => setSince(e.target.value)} /></label>
      </div>
      <div className="tablewrap" style={{ maxHeight: '40vh', overflow: 'auto' }}>
        <table className="table">
          <caption className="sr-only">Leads that can be tagged</caption>
          <thead><tr><th scope="col"><input type="checkbox" aria-label="Select all shown" checked={rows.length > 0 && chosen.length === rows.length} onChange={e => setPicked(e.target.checked ? new Set(rows.map(r => r.id)) : new Set())} /></th><th scope="col">Created</th><th scope="col">Customer</th><th scope="col">Service</th><th scope="col">Source now</th></tr></thead>
          <tbody>{rows.map(l => (
            <tr key={l.id}>
              <td><input type="checkbox" aria-label={`Select ${l.name ?? 'customer'}`} checked={picked.has(l.id)} onChange={() => toggle(l.id)} /></td>
              <td>{shortDay(l.created_at)}</td><th scope="row">{l.name || 'Unnamed'}</th><td>{l.service_requested || '-'}</td><td>{sourceLabel(l.source)}</td>
            </tr>
          ))}</tbody>
        </table>
        {rows.length === 0 && <p className="quiet">No leads match.</p>}
      </div>
      <div className="form-grid">
        <label>Set source to
          <select value={source} onChange={e => setSource(e.target.value)}>{leadSources.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        </label>
      </div>
      <div className="dialog-actions">
        <span>{chosen.length} selected{rows.length >= 400 ? ' (showing the newest 400)' : ''}. Applies to up to 200 at a time.</span>
        <button className="primary" disabled={busy || chosen.length === 0 || chosen.length > 200}
          onClick={() => act(() => setLeadSources(org, chosen.map(r => r.id), source), r => `Source set on ${r.count} customer${r.count === 1 ? '' : 's'}.`).then(ok => { if (ok) { setPicked(new Set()); close(); } })}>
          {busy ? 'Saving' : `Apply to ${chosen.length}`}
        </button>
      </div>
    </Modal>
  );
}

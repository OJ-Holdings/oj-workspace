'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  loadSolutionsConsultations, setSolutionsConsultationStatus,
  type SolutionsConsultation, type SolutionsConsultationResult,
} from '@/app/workspace/solutions-consultation-actions';

const dateLabel = (d: string) => {
  const dt = new Date(d + 'T12:00:00Z');
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
};
const timeLabel = (s: string) => {
  const dt = new Date('2026-01-01T' + s + 'Z');
  return Number.isNaN(dt.getTime()) ? s : dt.toLocaleTimeString('en-US', { timeZone: 'UTC', hour: 'numeric', minute: '2-digit' });
};

export function SolutionsConsultations({ org, mode }: { org: string; mode: 'preview' | 'live' }) {
  const [result, setResult] = useState<SolutionsConsultationResult | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [alert, setAlert] = useState('');
  const load = useCallback(() => {
    if (mode === 'preview') return;
    loadSolutionsConsultations(org).then(setResult).catch(() => setResult({ ok: false, message: 'Could not load website consultations.' }));
  }, [mode, org]);
  useEffect(() => { load(); }, [load]);

  async function change(row: SolutionsConsultation, status: 'confirmed' | 'declined' | 'completed') {
    if (pending) return;
    setPending(row.id);
    setAlert('');
    try {
      const result = await setSolutionsConsultationStatus(org, row.id, status);
      setAlert(result.message);
      if (result.ok) load();
    } catch { setAlert('The update did not finish. Refresh before trying again.'); }
    finally { setPending(null); }
  }

  if (mode === 'preview') return <section className="panel"><h2>Website consultations</h2><p>Private contact requests appear in the live workspace only.</p></section>;
  return <section className="panel" aria-label="Website consultation requests">
    <header className="panel-head">
      <h2>Website 15-minute consultations</h2>
      <button onClick={load} disabled={Boolean(pending)} type="button">Refresh</button>
    </header>
    <p className="quiet">Submitted through ojsolutions.org — preferred times are not confirmed or synced with external calendars until a founder reviews them. Times shown are Central.</p>
    {alert && <p role="status" className="quiet">{alert}</p>}
    {!result ? <div className="loading" aria-busy="true"/> : !result.ok
      ? <div className="empty" role="alert"><p>{result.message}</p></div>
      : result.entries.length === 0
        ? <div className="empty"><p>No website consultation requests yet.</p></div>
        : <div className="tablewrap"><table className="table">
          <thead><tr><th>Preferred time (CT)</th><th>Prospect</th><th>Service</th><th>Details</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {result.entries.map(row => <tr key={row.id}>
              <td><strong>{dateLabel(row.preferred_date)}</strong><br />{timeLabel(row.preferred_time)} · 15 min</td>
              <td><strong>{row.name}</strong><br /><a href={'mailto:' + row.email}>{row.email}</a>
                {row.phone && <><br /><a href={'tel:' + row.phone.replace(/[^\d+]/g, '')}>{row.phone}</a>
                  <br /><small>SMS consent: {row.sms_consent ? 'Yes (consultation only)' : 'No'}</small></>}
                {row.business && <><br /><small>{row.business}</small></>}
              </td>
              <td>{row.service}</td>
              <td>{row.notes || '—'}</td>
              <td><span className="tag">{row.status}</span></td>
              <td>
                {row.status === 'requested' && <>
                  <button type="button" disabled={Boolean(pending)} onClick={() => change(row, 'confirmed')}>Confirm</button>{' '}
                  <button type="button" disabled={Boolean(pending)} onClick={() => change(row, 'declined')}>Decline</button>
                </>}
                {row.status === 'confirmed' && <button type="button" disabled={Boolean(pending)} onClick={() => change(row, 'completed')}>Completed</button>}
              </td>
            </tr>)}
          </tbody>
        </table></div>}
  </section>;
}

'use client';

import { useMemo, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { ojConnection } from '@/lib/oj-connection';

export function EmployeeAssignmentPhotos({ assignmentId }: { assignmentId: string }) {
  const client = useMemo(() => createBrowserClient(ojConnection.url, ojConnection.publishableKey), []);
  const [state, setState] = useState<{ busy: boolean; loaded: boolean; urls: string[]; error: string }>({ busy: false, loaded: false, urls: [], error: '' });
  async function load() {
    setState(current => ({ ...current, busy: true, error: '' }));
    const { data, error } = await client.storage.from('oj-employee-jobs').list(assignmentId, { limit: 50, sortBy: { column: 'created_at', order: 'desc' } });
    if (error) { setState({ busy: false, loaded: true, urls: [], error: 'Photos are unavailable. Confirm the employee portal migration and storage policies are installed.' }); return; }
    const objects = (data ?? []).filter(item => item.id && !item.name.startsWith('.'));
    const signed = await Promise.all(objects.map(item => client.storage.from('oj-employee-jobs').createSignedUrl(`${assignmentId}/${item.name}`, 900)));
    setState({ busy: false, loaded: true, error: '', urls: signed.flatMap(result => result.data?.signedUrl ? [result.data.signedUrl] : []) });
  }
  return <div className="employee-owner-photos"><button type="button" className="secondary small" disabled={state.busy} onClick={() => void load()}>{state.busy ? 'Loading photos…' : 'Review job photos'}</button>{state.error && <span role="status">{state.error}</span>}{state.urls.length > 0 && <div className="employee-photo-grid">{state.urls.map((url,index) => <a href={url} target="_blank" rel="noreferrer" key={url}><img src={url} alt={`Employee job photo ${index + 1}`} /></a>)}</div>}{state.loaded && !state.busy && !state.error && state.urls.length === 0 && <span>No photos uploaded for this job.</span>}</div>;
}

'use client';

import { useMemo, useState, useTransition } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { ojConnection } from '@/lib/oj-connection';
import { updateEmployeeCloseout } from '@/app/workspace/employees/actions';
import { signOut } from '@/app/workspace/actions';

type ChecklistItem = { text: string; done: boolean };
type Job = {
  assignment_id: string; job_date: string;
  time_block: string | null; service: string | null; address: string | null; instructions: string;
  commission_percent: number; lead_status: string; closeout_status: string | null;
  checklist: ChecklistItem[] | null; closeout_notes: string | null; commission_status: string | null;
  commission_estimate: number | null;
};
type Earning = {
  id: string; assignment_id: string; entry_type: string; commission_percent: number;
  amount: number; reason: string; status: string;
  approved_at: string; paid_at: string | null; job_date: string; service: string | null;
};

const money = (value: number | null | undefined) => value == null ? 'Not recorded' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
const dateLabel = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

function useOJClient() {
  return useMemo(() => createBrowserClient(ojConnection.url, ojConnection.publishableKey), []);
}

export function EmployeePortal({ displayName, jobs, earnings }: { displayName: string; jobs: Job[]; earnings: Earning[] }) {
  const client = useOJClient();
  const [busy, startTransition] = useTransition();
  const [notice, setNotice] = useState('');
  const [photoState, setPhotoState] = useState<Record<string, { loading: boolean; urls: string[] }>>({});
  const [notes, setNotes] = useState<Record<string, string>>(() => Object.fromEntries(jobs.map(job => [job.assignment_id, job.closeout_notes ?? ''])));
  const activeJobs = jobs.filter(job => !['completed', 'cancelled', 'denied'].includes(job.lead_status));
  const historyJobs = jobs.filter(job => ['completed', 'cancelled', 'denied'].includes(job.lead_status));
  const pendingJobs = historyJobs.filter(job => job.lead_status === 'completed' && !job.commission_status);
  const pendingTotal = pendingJobs.reduce((total, job) => total + Number(job.commission_estimate ?? 0), 0);

  async function loadPhotos(assignmentId: string) {
    setPhotoState(value => ({ ...value, [assignmentId]: { loading: true, urls: value[assignmentId]?.urls ?? [] } }));
    const { data, error } = await client.storage.from('oj-employee-jobs').list(assignmentId, { limit: 50, sortBy: { column: 'created_at', order: 'desc' } });
    if (error) { setPhotoState(value => ({ ...value, [assignmentId]: { loading: false, urls: [] } })); return; }
    const objects = (data ?? []).filter(item => item.id && !item.name.startsWith('.'));
    const signed = await Promise.all(objects.map(item => client.storage.from('oj-employee-jobs').createSignedUrl(`${assignmentId}/${item.name}`, 900)));
    setPhotoState(value => ({ ...value, [assignmentId]: { loading: false, urls: signed.flatMap(result => result.data?.signedUrl ? [result.data.signedUrl] : []) } }));
  }

  async function uploadPhoto(assignmentId: string, file: File | undefined) {
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    if (!allowed.includes(file.type) || file.size > 10 * 1024 * 1024) { setNotice('Choose a JPG, PNG, WebP, or HEIC image under 10 MB.'); return; }
    const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = `${assignmentId}/${crypto.randomUUID()}.${extension}`;
    setNotice('Uploading job photo…');
    const { error } = await client.storage.from('oj-employee-jobs').upload(path, file, { contentType: file.type, upsert: false });
    if (error) { setNotice('Photo upload failed. Check your connection and try again.'); return; }
    setNotice('Job photo added.');
    await loadPhotos(assignmentId);
  }

  function save(job: Job, nextStatus: string) {
    const current = job.checklist ?? [];
    startTransition(async () => {
      try {
        await updateEmployeeCloseout(job.assignment_id, nextStatus, current, notes[job.assignment_id] ?? '');
        setNotice(nextStatus === 'submitted' ? 'Closeout sent to the owner for review.' : 'Work status saved.');
        window.location.reload();
      } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not save your work.'); }
    });
  }

  function toggleItem(job: Job, index: number) {
    const updated = (job.checklist ?? []).map((item, itemIndex) => itemIndex === index ? { ...item, done: !item.done } : item);
    startTransition(async () => {
      try {
        await updateEmployeeCloseout(job.assignment_id, job.closeout_status === 'assigned' ? 'accepted' : job.closeout_status === 'in_progress' ? 'in_progress' : 'accepted', updated, notes[job.assignment_id] ?? '');
        window.location.reload();
      } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not save the checklist.'); }
    });
  }

  const renderJob = (job: Job) => {
    const editable = ['assigned', 'accepted', 'in_progress'].includes(job.closeout_status ?? 'assigned');
    return <article className="employee-work-card" key={job.assignment_id}>
      <div className="employee-work-heading"><div><p className="eyebrow">{dateLabel(job.job_date)} · {job.time_block || 'Time to be confirmed'}</p><h3>{job.service || 'Exterior Care job'}</h3></div><span className={`employee-status ${job.closeout_status ?? 'assigned'}`}>{job.closeout_status ?? 'assigned'}</span></div>
      <p className="employee-work-address">{job.address || 'Address will be provided by the owner.'}</p>
      {job.instructions && <div className="employee-instructions"><span className="eyebrow">From the owner</span><p>{job.instructions}</p></div>}
      {job.checklist?.length ? <fieldset className="employee-checklist" disabled={!editable || busy}><legend>Job checklist</legend>{job.checklist.map((item, index) => <label key={`${index}-${item.text}`}><input type="checkbox" checked={item.done} onChange={() => toggleItem(job, index)} /><span>{item.text}</span></label>)}</fieldset> : null}
      {editable && <label className="employee-notes-label">Completion notes<textarea value={notes[job.assignment_id] ?? ''} onChange={event => setNotes(value => ({ ...value, [job.assignment_id]: event.target.value }))} maxLength={4000} rows={3} placeholder="Anything the owner should know about this job" /></label>}
      <div className="employee-photo-tools"><label className="secondary small">Add job photos<input type="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple={false} disabled={!editable || busy} onChange={event => { void uploadPhoto(job.assignment_id, event.currentTarget.files?.[0]); event.currentTarget.value = ''; }} /></label><button type="button" className="secondary small" disabled={photoState[job.assignment_id]?.loading} onClick={() => void loadPhotos(job.assignment_id)}>{photoState[job.assignment_id]?.loading ? 'Loading…' : 'View photos'}</button><span>Private to you and the owner</span></div>
      {photoState[job.assignment_id]?.urls.length ? <div className="employee-photo-grid">{photoState[job.assignment_id].urls.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt={`Job photo ${index + 1}`} /></a>)}</div> : null}
      {editable && <div className="employee-work-actions">{job.closeout_status === 'assigned' && <button type="button" className="secondary" disabled={busy} onClick={() => save(job, 'accepted')}>Acknowledge job</button>}{job.closeout_status !== 'in_progress' && <button type="button" className="secondary" disabled={busy} onClick={() => save(job, 'in_progress')}>Start work</button>}<button type="button" className="primary" disabled={busy || (job.checklist ?? []).some(item => !item.done)} onClick={() => save(job, 'submitted')}>Submit completion</button></div>}
    </article>;
  };

  return <main className="employee-portal">
    <header className="employee-portal-head"><div><p className="eyebrow">OJ Exterior Care · Employee access</p><h1>Good to see you, {displayName}.</h1><p>Your assigned work and your earnings, together in one place.</p></div><form action={signOut}><button className="secondary">Sign out</button></form></header>
    <section className="employee-portal-section"><div className="employee-section-title"><div><p className="eyebrow">My work</p><h2>Assigned jobs</h2></div><span>{activeJobs.length} upcoming or active</span></div>{activeJobs.length ? <div className="employee-work-list">{activeJobs.map(renderJob)}</div> : <p className="employee-empty">No upcoming work is assigned to you yet.</p>}</section>
    <section className="employee-portal-section"><div className="employee-section-title"><div><p className="eyebrow">My earnings</p><h2>Commission and payouts</h2></div></div><div className="employee-earning-totals"><div><span>Pending · estimate only</span><strong>{money(pendingTotal)}</strong></div>{(['approved', 'paid'] as const).map(status => <div key={status}><span>{status === 'approved' ? 'Approved · awaiting payout' : 'Paid'}</span><strong>{money(earnings.filter(item => status === 'approved' ? item.status === 'approved' : item.status === 'paid').reduce((total, item) => total + Number(item.amount), 0))}</strong></div>)}</div>{pendingJobs.some(job => job.commission_estimate == null) && <p className="employee-empty">Some completed jobs are waiting for the owner to record customer payment; those estimates are not included yet.</p>}{earnings.length ? <div className="employee-earning-list">{earnings.map(item => <article key={item.id}><div><strong>{item.service || 'Exterior Care job'}{item.entry_type === 'adjustment' ? ' · adjustment' : ''}</strong><span>{dateLabel(item.job_date)} · {item.commission_percent}% commission</span>{item.reason && <small>{item.reason}</small>}</div><div><strong>{money(item.amount)}</strong><span className={`employee-status ${item.status}`}>{item.status === 'paid' ? `Paid ${item.paid_at ? new Date(item.paid_at).toLocaleDateString() : ''}` : 'Approved · not yet paid'}</span></div></article>)}</div> : <p className="employee-empty">Approved commissions will appear here after the owner records customer payment and approves the job closeout.</p>}{pendingJobs.filter(job => job.commission_estimate != null).map(job => <div className="employee-pending-row" key={job.assignment_id}><span>{job.service || 'Exterior Care job'} · {dateLabel(job.job_date)}</span><strong>{money(job.commission_estimate)} · pending owner approval</strong></div>)}</section>
    {historyJobs.length > 0 && <section className="employee-portal-section"><div className="employee-section-title"><div><p className="eyebrow">History</p><h2>Recent jobs</h2></div><span>{historyJobs.length} jobs</span></div><div className="employee-work-list">{historyJobs.map(job => <article className="employee-history-card" key={job.assignment_id}><div><strong>{job.service || 'Exterior Care job'}</strong><span>{dateLabel(job.job_date)} · {job.lead_status}</span></div><span>{job.commission_status === 'paid' ? 'Commission paid' : job.commission_status ? 'Commission approved' : job.commission_estimate == null ? 'Payment not recorded' : `${money(job.commission_estimate)} estimated at ${job.commission_percent}%`}</span></article>)}</div></section>}
    <p className="employee-notice" role="status" aria-live="polite">{notice}</p>
  </main>;
}

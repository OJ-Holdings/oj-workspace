'use client';
import { useActionState, useState, useTransition } from 'react';
import Link from 'next/link';
import { createEmployeeInvitation, revokeEmployeeInvitation, setEmployeeActive, saveEmployeeAssignment, verifyEmployeeCloseout, approveEmployeeCommission, markEmployeeCommissionPaid, adjustEmployeeCommission } from '@/app/workspace/employees/actions';
import { EmployeeAssignmentPhotos } from '@/components/EmployeeAssignmentPhotos';

type Employee = { user_id: string; display_name: string; email: string; active: boolean };
type Invitation = { id: string; email: string; created_at: string; expires_at: string; revoked_at: string | null; accepted_at: string | null };
type ChecklistItem = { text: string; done: boolean };
type Assignment = { assignment_id: string; booking_id: string; employee_id: string; employee_name: string; job_date: string; time_block: string; service: string | null; address: string | null; lead_status: string; commission_percent: number; instructions: string; checklist: ChecklistItem[]; closeout_status: string | null; closeout_checklist: ChecklistItem[] | null; closeout_notes: string | null; customer_paid: number | null; commission_id: string | null; commission_amount: number | null; commission_status: string | null };
type Earning = { id: string; assignment_id: string; employee_id: string; employee_name: string; entry_type: string; amount: number; reason: string; status: string; approved_at: string; paid_at: string | null };
type Job = { id: string; date: string; time_block: string; service: string; address: string; status: string; customer_paid: number | null; lead_status: string };

const money = (value: number | null | undefined) => value === null || value === undefined ? 'Not recorded' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
const dateLabel = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const checklistText = (value: unknown) => Array.isArray(value) ? value.map((item: ChecklistItem) => item.text).join('\n') : '';

export function EmployeesPanel({ org, employees, invitations, assignments, earnings, jobs }: { org: string; employees: Employee[]; invitations: Invitation[]; assignments: Assignment[]; earnings: Earning[]; jobs: Job[] }) {
  const [invite, inviteAction, creating] = useActionState(createEmployeeInvitation.bind(null, org), { error: '', link: '' });
  const [busy, startTransition] = useTransition();
  const [notice, setNotice] = useState('');
  function run(task: () => Promise<unknown>, success: string) {
    startTransition(async () => { try { await task(); setNotice(success); } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not save this change.'); } });
  }
  const byBooking = new Map(assignments.map(row => [row.booking_id, row]));
  return <>
    <section className="employee-card"><header><span className="eyebrow">Invite</span><h2>Add an employee</h2><p>Send Edy the private invite link. He verifies his email and chooses his own password, then signs in to his employee portal. No shared password is created.</p></header>
      <form action={inviteAction} className="employee-invite-form"><label>Email address<input name="email" type="email" maxLength={254} required disabled={creating} placeholder="edy@example.com" /></label><button className="primary" disabled={creating}>{creating ? 'Creating…' : 'Create employee link'}</button></form>
      {invite.error && <p role="status" className="error-text">{invite.error}</p>}{invite.link && <><div className="employee-invite-result"><label>Copy and send this private link<input readOnly value={invite.link} onFocus={event => event.target.select()} /></label><button className="secondary" onClick={async () => { try { await navigator.clipboard.writeText(invite.link); setNotice('Employee invite link copied.'); } catch { setNotice('Select the link and copy it manually.'); } }}>Copy invite</button></div><p className="employee-empty">After Edy sets his password, he can sign in at <Link href="/login?next=%2Femployee">the employee portal login</Link>.</p></>}
      {invitations.length > 0 && <div className="employee-list">{invitations.map(row => <div className="employee-line" key={row.id}><div><strong>{row.email}</strong><small>{row.accepted_at ? 'Accepted' : row.revoked_at ? 'Revoked' : `Expires ${dateLabel(row.expires_at.slice(0, 10))}`}</small></div>{!row.accepted_at && !row.revoked_at && <button className="secondary small" disabled={busy} onClick={() => run(() => revokeEmployeeInvitation(org, row.id), 'Invitation revoked.')}>Revoke</button>}</div>)}</div>}
    </section>

    <section className="employee-card"><header><span className="eyebrow">Crew</span><h2>Employee access</h2><p>Disabling access preserves the employee’s history and stops new portal reads immediately.</p></header>
      {employees.length ? <div className="employee-list">{employees.map(row => <div className="employee-line" key={row.user_id}><div><strong>{row.display_name}</strong><small>{row.email} · {row.active ? 'Active' : 'Access paused'}</small></div><button className={row.active ? 'secondary small' : 'primary small'} disabled={busy} onClick={() => run(() => setEmployeeActive(org, row.user_id, !row.active), row.active ? 'Employee access paused.' : 'Employee access restored.')}>{row.active ? 'Pause access' : 'Restore access'}</button></div>)}</div> : <p className="employee-empty">No employees have accepted an invitation yet.</p>}
    </section>

    <section className="employee-card"><header><span className="eyebrow">Schedule</span><h2>Assign upcoming work</h2><p>One employee per job. Set the commission for each assignment; there is no default rate.</p></header>
      {jobs.length ? <div className="employee-job-list">{jobs.map(job => {
        const assigned = byBooking.get(job.id);
        return <form key={job.id} className="employee-job-row" onSubmit={event => { event.preventDefault(); const form = event.currentTarget; run(() => saveEmployeeAssignment(org, job.id, new FormData(form)), 'Job assignment saved.'); }}>
          <div className="employee-job-summary"><strong>{job.service}</strong><span>{dateLabel(job.date)} · {job.time_block || 'Time TBD'}</span><span>{job.address || 'Address not recorded'}</span></div>
          <label>Employee<select name="employee" required defaultValue={assigned?.employee_id ?? ''} disabled={!employees.some(e => e.active) || busy}><option value="" disabled>Select employee</option>{employees.filter(e => e.active).map(e => <option key={e.user_id} value={e.user_id}>{e.display_name}</option>)}</select></label>
          <label>Commission %<input name="commission_percent" type="number" min="0" max="100" step="0.01" required defaultValue={assigned?.commission_percent ?? ''} disabled={busy} placeholder="Set for this job" /></label>
          <label className="employee-wide">Instructions for the employee<textarea name="instructions" maxLength={2000} rows={2} defaultValue={assigned?.instructions ?? ''} disabled={busy} placeholder="Only the assigned employee sees these instructions" /></label>
          <label className="employee-wide">Job checklist<textarea name="checklist" rows={3} maxLength={4000} defaultValue={checklistText((assigned as unknown as { checklist?: unknown } | undefined)?.checklist)} disabled={busy} placeholder="One step per line" /></label>
          <button className="primary" disabled={!employees.some(e => e.active) || busy}>{assigned ? 'Save assignment' : 'Assign job'}</button>
        </form>;
      })}</div> : <p className="employee-empty">No upcoming bookings found for the next 120 days.</p>}
    </section>

    <section className="employee-card"><header><span className="eyebrow">Review</span><h2>Assigned jobs and commission</h2><p>Commission is calculated from customer payments actually recorded, never from the quote.</p></header>
      {assignments.length ? <div className="employee-job-list">{assignments.map(row => {
        const preview = row.customer_paid === null ? null : Math.round((row.customer_paid * row.commission_percent / 100 + Number.EPSILON) * 100) / 100;
        const shownCommission = row.commission_status ? row.commission_amount : preview;
        const eligible = row.commission_status === null && row.lead_status === 'completed' && row.customer_paid !== null && row.customer_paid > 0;
        return <article className="employee-review-row" key={row.assignment_id}><div className="employee-job-summary"><strong>{row.service || 'Exterior Care job'} · {row.employee_name}</strong><span>{dateLabel(row.job_date)} · {row.time_block || 'Time TBD'} · job {row.lead_status} · closeout {row.closeout_status ?? 'assigned'}</span><span>Collected {money(row.customer_paid)} · {row.commission_percent}% rate · {row.commission_status ? 'approved' : 'estimated'} {money(shownCommission)}</span><span>Commission {row.commission_status ?? (eligible ? 'ready for owner approval' : 'awaiting completed job and recorded payment')}</span>{row.closeout_status === 'submitted' || row.closeout_status === 'verified' ? <><div className="employee-closeout-checklist"><strong>Employee checklist</strong>{(row.closeout_checklist ?? []).map((item,index)=><span key={`${index}-${item.text}`}>{item.done ? '✓' : '○'} {item.text}</span>)}</div>{row.closeout_notes && <p className="employee-closeout-notes"><strong>Completion notes</strong><br />{row.closeout_notes}</p>}<EmployeeAssignmentPhotos assignmentId={row.assignment_id} /></> : null}</div>
          {row.closeout_status === 'submitted' && <button className="secondary small" disabled={busy} onClick={() => run(() => verifyEmployeeCloseout(org, row.assignment_id), 'Closeout verified.')}>Verify closeout</button>}
          {eligible && <button className="primary small" disabled={busy} onClick={() => run(() => approveEmployeeCommission(org, row.assignment_id), 'Commission approved.')}>Approve commission</button>}
        </article>;
      })}</div> : <p className="employee-empty">No employee job assignments yet.</p>}
    </section>

    <section className="employee-card"><header><span className="eyebrow">Payout ledger</span><h2>Approved earnings</h2><p>Record payouts after you have paid Edy. Adjustments keep the original amount and reason in the history.</p></header>
      {earnings.length ? <div className="employee-list">{earnings.map(row => <div className="employee-line employee-ledger-row" key={row.id}><div><strong>{row.employee_name} · {money(row.amount)}{row.entry_type === 'adjustment' ? ' adjustment' : ''}</strong><small>{row.status === 'paid' ? `Paid ${row.paid_at ? dateLabel(row.paid_at.slice(0, 10)) : ''}` : 'Approved · not marked paid'}{row.reason ? ` · ${row.reason}` : ''}</small></div><div className="employee-row-actions">{row.entry_type === 'commission' && <form onSubmit={event => { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); run(() => adjustEmployeeCommission(org, row.id, String(data.get('amount') || ''), String(data.get('reason') || '')), 'Adjustment added to the ledger.'); form.reset(); }}><input aria-label="Commission adjustment in dollars" name="amount" type="number" step="0.01" required placeholder="± $" disabled={busy} /><input aria-label="Adjustment reason" name="reason" maxLength={1000} required placeholder="Reason" disabled={busy} /><button className="secondary small" disabled={busy}>Adjust</button></form>}{row.status === 'approved' && <button className="primary small" disabled={busy} onClick={() => run(() => markEmployeeCommissionPaid(org, row.id), 'Payout marked paid.')}>Mark paid</button>}</div></div>)}</div> : <p className="employee-empty">No commission has been approved yet.</p>}
    </section>
    <p className="employee-notice" role="status" aria-live="polite">{notice}</p>
  </>;
}

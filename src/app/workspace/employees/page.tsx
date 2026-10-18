import Link from 'next/link';
import { redirect } from 'next/navigation';
import { EmployeesPanel } from '@/components/EmployeesPanel';
import { requireMember, supabaseServer } from '@/lib/supabase';
import './employees.css';

export const dynamic = 'force-dynamic';

function chicagoToday() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const value = (key: string) => parts.find(part => part.type === key)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export default async function EmployeesPage() {
  const auth = await supabaseServer();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) redirect('/login');
  const { data: membership } = await auth.from('oj_memberships').select('organization_id').eq('user_id', user.id).order('created_at').limit(1).maybeSingle();
  if (!membership) redirect('/workspace');
  const { client, member } = await requireMember(membership.organization_id);
  if (member.role !== 'owner') redirect('/workspace');
  const today = chicagoToday();
  const until = new Date(`${today}T12:00:00Z`);
  until.setUTCDate(until.getUTCDate() + 120);
  const endDate = until.toISOString().slice(0, 10);
  const [employees, invitations, assignments, earnings, bookings] = await Promise.all([
    client.rpc('oj_employee_admin_list', { org: membership.organization_id }),
    client.rpc('oj_list_employee_invitations', { org: membership.organization_id }),
    client.rpc('oj_employee_assignment_list', { org: membership.organization_id }),
    client.rpc('oj_employee_admin_earnings', { org: membership.organization_id }),
    client.from('bookings').select('id,lead_id,date,time_block,status').gte('date', today).lte('date', endDate).order('date').limit(500),
  ]);
  const failed = [employees, invitations, assignments, earnings, bookings].find(result => result.error);
  if (failed) return <main className="settings-page"><Link className="text-link" href="/workspace/team">← Back to people &amp; access</Link><h1>Employee portal setup needed.</h1><p>The employee database migration is not installed, or the job records are unavailable. No sample data has been substituted.</p></main>;
  const booked = (bookings.data ?? []).filter(row => !['denied', 'cancelled'].includes(String(row.status)));
  const leadIds = [...new Set(booked.map(row => row.lead_id).filter(Boolean))];
  const leadResult = leadIds.length
    ? await client.from('leads').select('id,service_requested,address,job_revenue,status').in('id', leadIds)
    : { data: [], error: null };
  if (leadResult.error) return <main className="settings-page"><h1>Jobs unavailable.</h1><p>Exterior Care job details could not be loaded.</p></main>;
  const leads = new Map((leadResult.data ?? []).map(row => [row.id, row]));
  const jobs = booked.flatMap(row => {
    const lead = leads.get(row.lead_id);
    return lead ? [{ id: row.id, date: row.date, time_block: row.time_block ?? '', service: lead.service_requested ?? 'Exterior Care job', address: lead.address ?? '', status: row.status ?? '', customer_paid: lead.job_revenue === null ? null : Number(lead.job_revenue), lead_status: lead.status ?? '' }] : [];
  });
  return <main className="settings-page employee-admin"><Link className="text-link" href="/workspace/team">← Back to people &amp; access</Link><p className="eyebrow">OJ Exterior Care · Team</p><h1>Employee work<span className="heading-dot">.</span></h1><p>Assign the work, set its commission, and review closeouts and payouts.</p><EmployeesPanel org={membership.organization_id} employees={employees.data ?? []} invitations={invitations.data ?? []} assignments={assignments.data ?? []} earnings={earnings.data ?? []} jobs={jobs} />
    <p className="employee-privacy-note">Employees have a separate sign-in and can see only their assigned work, closeouts, photos, and earnings.</p>
  </main>;
}

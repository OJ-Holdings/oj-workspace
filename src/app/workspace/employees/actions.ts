'use server';
import { randomBytes, createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { requireMember, supabaseServer } from '@/lib/supabase';
import { validEmail } from '@/lib/auth-input';
import { workspaceOrigin } from '@/lib/auth-url';

const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const page = '/workspace/employees';
async function owner(org: string) {
  if (!idPattern.test(org)) throw new Error('Workspace unavailable.');
  const { client, member } = await requireMember(org);
  if (member.role !== 'owner') throw new Error('Owner access required.');
  return client;
}

/** Narrow owner-only data for assigning a crew member from a booked job. */
export async function loadJobCrew(org: string) {
  try {
    const client = await owner(org);
    const [employees, assignments] = await Promise.all([
      client.rpc('oj_employee_admin_list', { org }),
      client.rpc('oj_employee_assignment_list', { org }),
    ]);
    if (employees.error || assignments.error) return { ok: false as const, employees: [], assignments: [] };
    return {
      ok: true as const,
      employees: (employees.data ?? []).map((row: { user_id: string; display_name: string; active: boolean }) => ({ user_id: row.user_id, display_name: row.display_name, active: row.active })),
      assignments: (assignments.data ?? []).map((row: { booking_id: string; employee_id: string; employee_name: string; commission_percent: number; instructions: string; checklist: unknown }) => ({ booking_id: row.booking_id, employee_id: row.employee_id, employee_name: row.employee_name, commission_percent: Number(row.commission_percent), instructions: row.instructions ?? '', checklist: row.checklist ?? [] })),
    };
  } catch {
    return { ok: false as const, employees: [], assignments: [] };
  }
}

export async function createEmployeeInvitation(org: string, _state: { error: string; link: string }, form: FormData) {
  const email = String(form.get('email') || '').trim().toLowerCase();
  if (!validEmail(email)) return { error: 'Enter a valid email address.', link: '' };
  try {
    const client = await owner(org);
    const token = randomBytes(32).toString('hex');
    const { error } = await client.rpc('oj_create_employee_invitation', { org, email_address: email, digest: createHash('sha256').update(token).digest('hex') });
    if (error) return { error: 'Could not create the invitation. Check owner access or try again.', link: '' };
    revalidatePath(page);
    return { error: '', link: `${workspaceOrigin()}/employee/join/${token}` };
  } catch { return { error: 'Owner access is unavailable.', link: '' }; }
}

export async function revokeEmployeeInvitation(org: string, invitation: string) {
  if (!idPattern.test(invitation)) throw new Error('Invitation unavailable.');
  const client = await owner(org);
  const { error } = await client.rpc('oj_revoke_employee_invitation', { org, invitation_id: invitation });
  if (error) throw new Error('Could not revoke this invitation.');
  revalidatePath(page);
}

export async function setEmployeeActive(org: string, employee: string, active: boolean) {
  if (!idPattern.test(employee) || typeof active !== 'boolean') throw new Error('Employee unavailable.');
  const client = await owner(org);
  const { error } = await client.rpc('oj_employee_set_active', { org, employee, is_active: active });
  if (error) throw new Error('Could not update employee access.');
  revalidatePath(page);
}

export async function saveEmployeeAssignment(org: string, booking: string, form: FormData) {
  const employee = String(form.get('employee') || '');
  const rateText = String(form.get('commission_percent') || '');
  const commission = Number(rateText);
  const instructions = String(form.get('instructions') || '').trim();
  const checklistText = String(form.get('checklist') || '');
  const checklist = checklistText.split(/\r?\n/).map(text => text.trim()).filter(Boolean).map(text => ({ text, done: false }));
  if (!idPattern.test(booking) || !idPattern.test(employee) || !Number.isFinite(commission) || commission < 0 || commission > 100 || Math.round(commission * 100) !== commission * 100 || instructions.length > 2000 || checklist.length > 40 || checklist.some(item => item.text.length > 300)) throw new Error('Check the employee, commission rate, instructions and checklist.');
  const client = await owner(org);
  const { error } = await client.rpc('oj_employee_assignment_save', { org, booking, employee, commission_percent: commission, instructions, checklist });
  if (error) throw new Error('Could not save this job assignment. It may have been cancelled or the employee is inactive.');
  revalidatePath(page);
  revalidatePath('/employee');
}

export async function updateEmployeeCloseout(assignment: string, status: string, checklist: unknown, notes: string) {
  if (!idPattern.test(assignment) || !['accepted', 'in_progress', 'submitted'].includes(status) || !Array.isArray(checklist) || checklist.length > 40 || typeof notes !== 'string' || notes.length > 4000) throw new Error('Invalid closeout.');
  const client = await supabaseServer();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) throw new Error('Sign in to update your assigned work.');
  const { error } = await client.rpc('oj_employee_closeout_update', { assignment, new_status: status, new_checklist: checklist, new_notes: notes });
  if (error) throw new Error('Could not update this closeout. It may already have been submitted or your assignment changed.');
  revalidatePath('/employee');
}

export async function verifyEmployeeCloseout(org: string, assignment: string) {
  if (!idPattern.test(assignment)) throw new Error('Assignment unavailable.');
  const client = await owner(org);
  const { error } = await client.rpc('oj_employee_closeout_verify', { org, assignment });
  if (error) throw new Error('Only a submitted closeout can be verified.');
  revalidatePath(page);
  revalidatePath('/employee');
}

export async function approveEmployeeCommission(org: string, assignment: string) {
  if (!idPattern.test(assignment)) throw new Error('Assignment unavailable.');
  const client = await owner(org);
  const { error } = await client.rpc('oj_employee_commission_approve', { org, assignment });
  if (error) throw new Error('Commission requires completed work and a recorded customer payment; it may already be approved.');
  revalidatePath(page);
  revalidatePath('/employee');
}

export async function adjustEmployeeCommission(org: string, earning: string, amount: string, reason: string) {
  const delta = Number(amount);
  if (!idPattern.test(earning) || !Number.isFinite(delta) || delta === 0 || Math.round(delta * 100) !== delta * 100 || typeof reason !== 'string' || reason.trim().length < 1 || reason.length > 1000) throw new Error('Enter an adjustment in dollars and a reason.');
  const client = await owner(org);
  const { error } = await client.rpc('oj_employee_commission_adjust', { org, earning, delta, reason: reason.trim() });
  if (error) throw new Error('Could not record the commission adjustment.');
  revalidatePath(page);
  revalidatePath('/employee');
}

export async function markEmployeeCommissionPaid(org: string, earning: string) {
  if (!idPattern.test(earning)) throw new Error('Earning unavailable.');
  const client = await owner(org);
  const { error } = await client.rpc('oj_employee_commission_paid', { org, earning });
  if (error) throw new Error('Only an approved, unpaid commission can be marked paid.');
  revalidatePath(page);
  revalidatePath('/employee');
}

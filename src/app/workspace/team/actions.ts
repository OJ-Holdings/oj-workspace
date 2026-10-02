'use server';
import { randomBytes, createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { requireMember } from '@/lib/supabase';
import { validEmail } from '@/lib/auth-input';
import { workspaceOrigin } from '@/lib/auth-url';
export async function createInvitation(org: string, _state: { error: string; link: string }, form: FormData) {
  const email = String(form.get('email') || '').trim().toLowerCase();
  const role = String(form.get('role') || '');
  if (!validEmail(email) || !['member', 'viewer'].includes(role)) return { error: 'Enter a valid email and access level.', link: '' };
  try {
    const { client, member } = await requireMember(org);
    if (member.role !== 'owner') throw new Error();
    const token = randomBytes(32).toString('hex');
    const { error } = await client.rpc('oj_create_invitation', { org, email_address: email, invited_role: role, digest: createHash('sha256').update(token).digest('hex') });
    if (error) return { error: 'Could not create the invitation. Check owner access or try again later.', link: '' };
    revalidatePath('/workspace/team');
    return { error: '', link: `${workspaceOrigin()}/join/${token}` };
  } catch { return { error: 'Invitation connection is unavailable or your owner access ended.', link: '' }; }
}
export async function manageMember(org: string, userId: string, role: string) {
  if (!['member', 'viewer', 'remove'].includes(role)) throw new Error('Choose a valid access level.');
  const { client, member } = await requireMember(org);
  if (member.role !== 'owner') throw new Error('Owner access required.');
  const { error } = await client.rpc('oj_manage_member', { org, target_user: userId, new_role: role });
  if (error) throw new Error('Could not change access. Owner accounts cannot be changed here.');
  revalidatePath('/workspace/team');
}
export async function revokeInvitation(org: string, invitationId: string) {
  const { client, member } = await requireMember(org);
  if (member.role !== 'owner') throw new Error('Owner access required.');
  const { error } = await client.rpc('oj_revoke_invitation', { org, invitation_id: invitationId });
  if (error) throw new Error('Could not revoke this invitation.');
  revalidatePath('/workspace/team');
}

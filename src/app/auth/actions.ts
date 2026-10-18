'use server';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase';
import { workspaceOrigin } from '@/lib/auth-url';
import { validEmail, passwordError, invitationTokenPattern } from '@/lib/auth-input';

export type AccountState = { error: string; message: string };
export async function requestRecovery(_state: AccountState, _form: FormData): Promise<AccountState> {
  return { error: 'Email recovery is not enabled. Contact the project administrator for help restoring access.', message: '' };
}
export async function updatePassword(_state: AccountState, form: FormData): Promise<AccountState> {
  const password = String(form.get('password') || '');
  const validation = passwordError(password, String(form.get('confirmation') || ''));
  if (validation) return { error: validation, message: '' };
  try {
    const client = await supabaseServer();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return { error: 'Open a fresh password reset link or sign in first.', message: '' };
    const { error } = await client.auth.updateUser({ password });
    if (error) return { error: 'Could not update your password. Request a fresh recovery link.', message: '' };
    await client.auth.signOut();
  } catch { return { error: 'Account connection is unavailable.', message: '' }; }
  redirect('/login?notice=password-updated');
}
export async function registerInvited(token: string, _state: AccountState, form: FormData): Promise<AccountState> {
  const email = String(form.get('email') || '').trim().toLowerCase();
  const password = String(form.get('password') || '');
  const validation = passwordError(password, String(form.get('confirmation') || ''));
  if (!invitationTokenPattern.test(token) || !validEmail(email) || validation) return { error: validation || 'Check your invitation and email address.', message: '' };
  try {
    const client = await supabaseServer();
    const { data: valid, error: invitationError } = await client.rpc('oj_validate_invitation', { token, email_address: email });
    if (invitationError || valid !== true) return { error: 'This invitation is unavailable for that email. Check the address or ask for a new link.', message: '' };
    const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: `${workspaceOrigin()}/auth/callback?next=/join/${token}` } });
    if (error) return { error: 'Could not create your account. Try signing in if you already have one.', message: '' };
    return { error: '', message: data.session ? 'Account created. Reload this invitation to enter your display name and join the workspace.' : 'Account created. Sign in below to accept this invitation.' };
  } catch { return { error: 'Account connection is unavailable.', message: '' }; }
}
export async function registerEmployeeInvited(token: string, _state: AccountState, form: FormData): Promise<AccountState> {
  const email = String(form.get('email') || '').trim().toLowerCase();
  const password = String(form.get('password') || '');
  const validation = passwordError(password, String(form.get('confirmation') || ''));
  if (!invitationTokenPattern.test(token) || !validEmail(email) || validation) return { error: validation || 'Check your employee invitation and email address.', message: '' };
  try {
    const client = await supabaseServer();
    const { data: valid, error: invitationError } = await client.rpc('oj_validate_employee_invitation', { token, email_address: email });
    if (invitationError || valid !== true) return { error: 'This employee invitation is unavailable for that email. Check the address or ask your owner for a new link.', message: '' };
    const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: `${workspaceOrigin()}/auth/callback?next=/employee/join/${token}` } });
    if (error) return { error: 'Could not create your account. If you already have one, sign in with the invited email.', message: '' };
    return { error: '', message: data.session ? 'Account created. Confirm your email if asked, then accept this invitation.' : 'Account created. Confirm your email, then sign in to accept this invitation.' };
  } catch { return { error: 'Account connection is unavailable.', message: '' }; }
}
export async function acceptEmployeeInvitation(token: string, _state: AccountState, form: FormData): Promise<AccountState> {
  const displayName = String(form.get('display_name') || '').trim();
  if (!invitationTokenPattern.test(token) || !displayName || displayName.length > 120) return { error: 'Enter a display name of up to 120 characters.', message: '' };
  try {
    const client = await supabaseServer();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return { error: 'Sign in using the verified email address this employee invitation was created for.', message: '' };
    const { error } = await client.rpc('oj_accept_employee_invitation', { token, display_name: displayName });
    if (error) return { error: 'Employee invitation could not be accepted. Check the verified email, expiration, and account access.', message: '' };
  } catch { return { error: 'Account connection is unavailable.', message: '' }; }
  redirect('/employee');
}
export async function acceptInvitation(token: string, _state: AccountState, form: FormData): Promise<AccountState> {
  const displayName = String(form.get('display_name') || '').trim();
  if (!invitationTokenPattern.test(token) || !displayName || displayName.length > 120) return { error: 'Enter a display name of up to 120 characters.', message: '' };
  try {
    const client = await supabaseServer();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return { error: 'Sign in using the email address this invitation was created for.', message: '' };
    const { error } = await client.rpc('oj_accept_invitation', { token, display_name: displayName });
    if (error) return { error: 'Invitation could not be accepted. Check your account email, expiration, and that your display name is available.', message: '' };
  } catch { return { error: 'Account connection is unavailable.', message: '' }; }
  redirect('/workspace');
}

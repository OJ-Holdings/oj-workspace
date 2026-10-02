'use server';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase';
import { validEmail, passwordError } from '@/lib/auth-input';
import { workspaceOrigin } from '@/lib/auth-url';
import type { AccountState } from '@/app/auth/actions';
export async function registerOwner(_state: AccountState, form: FormData): Promise<AccountState> {
  const email = String(form.get('email') || '').trim().toLowerCase();
  const password = String(form.get('password') || '');
  const validation = passwordError(password, String(form.get('confirmation') || ''));
  if (!validEmail(email) || validation) return { error: validation || 'Enter a valid email address.', message: '' };
  try {
    const client = await supabaseServer();
    const { data: pending, error: setupError } = await client.rpc('oj_owner_setup_pending', { email_address: email });
    if (setupError || pending !== true) return { error: 'Owner setup is unavailable for this email. Existing owners can sign in.', message: '' };
    const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: `${workspaceOrigin()}/auth/callback?next=/setup` } });
    if (error) return { error: 'Could not create the owner account. Try signing in if it already exists.', message: '' };
    return { error: '', message: data.session ? 'Account created. Tell the project administrator you are signed in so they can approve your owner account. Then reload this page to finish setup.' : 'Account created. Sign in to continue owner setup.' };
  } catch { return { error: 'Owner setup connection is unavailable.', message: '' }; }
}
export async function claimOwner(_state: AccountState, form: FormData): Promise<AccountState> {
  const displayName = String(form.get('display_name') || '').trim();
  if (!displayName || displayName.length > 120) return { error: 'Enter a display name of up to 120 characters.', message: '' };
  try {
    const client = await supabaseServer();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return { error: 'Sign in to your account first.', message: '' };
    const { error } = await client.rpc('oj_claim_owner', { display_name: displayName });
    if (error) return { error: 'Owner setup needs administrator approval for this account, or has already been completed.', message: '' };
  } catch { return { error: 'Owner setup connection is unavailable.', message: '' }; }
  redirect('/workspace');
}

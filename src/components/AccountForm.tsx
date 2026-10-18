'use client';
import { useActionState } from 'react';
import { requestRecovery, updatePassword, registerInvited, acceptInvitation, registerEmployeeInvited, acceptEmployeeInvitation } from '@/app/auth/actions';
import { registerOwner, claimOwner } from '@/app/setup/actions';
export function AccountForm({ kind, configured, token = '' }: { kind: 'recovery' | 'password' | 'register' | 'accept' | 'register-employee' | 'accept-employee' | 'owner' | 'claim-owner'; configured: boolean; token?: string }) {
  const handler = kind === 'recovery' ? requestRecovery : kind === 'password' ? updatePassword : kind === 'owner' ? registerOwner : kind === 'claim-owner' ? claimOwner : kind === 'register' ? registerInvited.bind(null, token) : kind === 'register-employee' ? registerEmployeeInvited.bind(null, token) : kind === 'accept-employee' ? acceptEmployeeInvitation.bind(null, token) : acceptInvitation.bind(null, token);
  const [state, action, pending] = useActionState(handler, { error: '', message: '' });
  const disabled = !configured || pending;
  return <form action={action} className="login-form">
    {(kind === 'recovery' || kind === 'register' || kind === 'register-employee' || kind === 'owner') && <label>Email<input name="email" type="email" autoComplete="email" maxLength={254} required disabled={disabled} /></label>}
    {(kind === 'password' || kind === 'register' || kind === 'register-employee' || kind === 'owner') && <><label>{kind === 'password' ? 'New password' : 'Password'}<input name="password" type="password" minLength={12} maxLength={128} autoComplete="new-password" required disabled={disabled} /></label><label>Confirm password<input name="confirmation" type="password" minLength={12} maxLength={128} autoComplete="new-password" required disabled={disabled} /></label><p className="quiet">Use at least 12 characters. A unique passphrase works well.</p></>}
    {(kind === 'accept' || kind === 'accept-employee' || kind === 'claim-owner') && <label>Your display name<input name="display_name" autoComplete="name" required maxLength={120} disabled={disabled} /></label>}
    <p className="error-text" role="status">{state.error || (!configured ? 'Business accounts are being connected. This form will become available once setup is complete.' : '')}</p>
    {state.message && <p className="quiet" role="status">{state.message}</p>}
    <button className="primary" disabled={disabled}>{pending ? 'Please wait…' : kind === 'recovery' ? 'Send recovery link' : kind === 'password' ? 'Save new password' : kind === 'register' || kind === 'register-employee' || kind === 'owner' ? 'Create my account' : kind === 'claim-owner' ? 'Finish owner setup' : 'Accept invitation'}</button>
  </form>;
}

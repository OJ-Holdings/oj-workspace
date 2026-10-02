'use client';
import { useActionState } from 'react';
import { login } from '@/app/login/actions';
export function LoginForm({ configured, next = '/workspace' }: { configured: boolean; next?: string }) {
  const [state, action, pending] = useActionState(login, { error: '' });
  return <form action={action} className="login-form"><input type="hidden" name="next" value={next} /><label>Email<input name="email" type="email" autoComplete="username" required disabled={!configured || pending} /></label><label>Password<input name="password" type="password" autoComplete="current-password" required disabled={!configured || pending} /></label><p className="error-text" role="status">{state.error || (!configured ? 'Business accounts are being connected. You can explore the sample workspace meanwhile.' : '')}</p><button className="primary" disabled={!configured || pending}>{pending ? 'Signing in…' : 'Sign in'}</button></form>;
}

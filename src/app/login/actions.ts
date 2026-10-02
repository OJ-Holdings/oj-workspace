'use server';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase';
import { safeAuthNext } from '@/lib/auth-input';
export async function login(_previous: { error: string }, form: FormData) {
  const email = String(form.get('email') || '').trim();
  const password = String(form.get('password') || '');
  if (!email || email.length > 254 || !password || password.length > 1024) return { error: 'Enter your email and password.' };
  try {
    const client = await supabaseServer();
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) return { error: 'Could not sign in. Check your account details and try again.' };
  } catch { return { error: 'Account connection is unavailable. Please try again later.' }; }
  redirect(safeAuthNext(String(form.get('next') || '')));
}

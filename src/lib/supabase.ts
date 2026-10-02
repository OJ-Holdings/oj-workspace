import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { ojConnection } from '@/lib/oj-connection';

export function isConfigured() {
  return Boolean(ojConnection.url && ojConnection.publishableKey);
}
export async function supabaseServer() {
  if (!isConfigured()) throw new Error('OJ account connection is not configured yet.');
  const jar = await cookies();
  return createServerClient(ojConnection.url, ojConnection.publishableKey, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll(values) {
        try { values.forEach(({ name, value, options }) => jar.set(name, value, options)); }
        catch { /* Server components cannot set cookies; proxy refreshes sessions. */ }
      },
    },
  });
}
export async function requireMember(organizationId: string, write = false) {
  const client = await supabaseServer();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new Error('Sign in to access the OJ workspace.');
  const { data: member, error: memberError } = await client.from('oj_memberships').select('role,display_name').eq('organization_id', organizationId).eq('user_id', user.id).single();
  if (memberError || !member || (write && !['owner', 'member'].includes(member.role))) throw new Error('You do not have permission for this workspace.');
  return { client, user, member };
}

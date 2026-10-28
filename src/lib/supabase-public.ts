import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { ojConnection } from '@/lib/oj-connection';

/**
 * A Supabase client with no session and no cookies: it can do exactly what the public (anon) role can do, which is call the token-guarded public
 * functions and nothing else. Used by the pages a customer opens from a private link. It carries only the public key; there is no elevated key anywhere.
 */
export function supabasePublic() {
  return createServerClient(ojConnection.url, ojConnection.publishableKey, { cookies: { getAll: () => [], setAll: () => undefined } });
}

// Public client connection only. This key does not bypass authentication or row-level security.
// No legacy environment files or privileged keys are used.
export const ojConnection = {
  url: process.env.NEXT_PUBLIC_OJ_SUPABASE_URL || 'https://vgckpcktsfuithqggknd.supabase.co',
  publishableKey: process.env.NEXT_PUBLIC_OJ_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_zuuqWaQIT8ZZCwkDe3etfA_YIrc-erM',
};

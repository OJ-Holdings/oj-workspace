// Runs once when the workspace server starts. The Local Services Ads poller lives
// inside this server process, and only on the host that sets LSA_POLL=on.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.LSA_POLL !== 'on') return;
  const { startLsaPoller } = await import('./lib/lsa-sync');
  startLsaPoller();
}

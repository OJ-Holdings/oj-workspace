/** A previous browser bundle can reference Server Action IDs removed by a new Next.js release. */
export const STALE_SERVER_ACTION_NOTICE =
  'Workspace updated while this tab was open. Reload the workspace, check today\'s saved DM count, and log any already-sent DM that is missing. Do not resend the Instagram message.';

export function isStaleServerAction(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return /(?:server action[^\n]*(?:not found|failed to find)|failed to find server action)/i.test(message);
}

export function mutationFailureMessage(error: unknown, fallback: string): string {
  if (isStaleServerAction(error)) return STALE_SERVER_ACTION_NOTICE;
  return error instanceof Error ? error.message : fallback;
}

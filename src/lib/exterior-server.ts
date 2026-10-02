import 'server-only';

// Texting goes through the existing Exterior Care server, which owns the Twilio
// number, the AI replies and the daily follow-up job. This app never sends a
// text itself; it asks that server to, and only when a person presses a button.

const base = () => (process.env.EXTERIOR_API_URL ?? '').replace(/\/+$/, '');
export const textingConfigured = () => /^https?:\/\/[^/]+/.test(base());

/** Calls the Exterior Care server. Throws with a message meant for the person on any failure. */
export async function exteriorApi<T>(path: string, operator: string, init: { method: 'GET' | 'POST'; body?: unknown } = { method: 'GET' }): Promise<T> {
  if (!textingConfigured()) throw new Error('!Texting is not connected. Set EXTERIOR_API_URL to the Exterior Care server.');
  let response: Response;
  try {
    response = await fetch(`${base()}/api${path}`, {
      method: init.method, cache: 'no-store', signal: AbortSignal.timeout(30000),
      headers: { 'Content-Type': 'application/json', 'x-operator': operator, ...(process.env.EXTERIOR_API_KEY ? { 'x-api-key': process.env.EXTERIOR_API_KEY } : {}) },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new Error('!The Exterior Care server is not answering. It has to be running for texts to send.');
  }
  const body = await response.json().catch(() => ({})) as T & { message?: string; error?: string };
  if (!response.ok) throw new Error(`!The Exterior Care server could not do that: ${(body.message || body.error || response.status).toString().slice(0, 200)}`);
  return body;
}

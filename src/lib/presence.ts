/** Presence is a recent connection signal, never proof of productive work. */
export const PRESENCE_TTL_MS = 90_000;
export const PRESENCE_HEARTBEAT_MS = 30_000;
export type PresenceStatus = 'online' | 'away' | 'offline';
export type PresenceSession = { user_id: string; session_id: string; state: PresenceStatus; seen_at: string };
export type CurrentWork = { user_id: string; note: string; card_id: string | null; revision: number; updated_at: string };
export type PresenceMember = { user_id: string; display_name: string };
export type PresenceSnapshot = {
  userId: string; members: PresenceMember[]; sessions: PresenceSession[]; work: CurrentWork[]; now: string;
};
export type PresenceUpdate =
  | { action: 'heartbeat'; sessionId: string; state: PresenceStatus }
  | { action: 'work'; note: string; cardId: string | null; revision: number | null };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validPresenceId(value: unknown): value is string { return typeof value === 'string' && uuid.test(value); }
export function validPresenceOrigin(origin: string | null, host: string | null) {
  try { return !!origin && !!host && ['http:', 'https:'].includes(new URL(origin).protocol) && new URL(origin).host === host.toLowerCase(); }
  catch { return false; }
}
export function validatePresenceUpdate(value: unknown): PresenceUpdate {
  if (!value || typeof value !== 'object') throw new Error('Invalid availability update.');
  const input = value as Record<string, unknown>;
  if (input.action === 'heartbeat' && validPresenceId(input.sessionId) && ['online', 'away', 'offline'].includes(String(input.state))) {
    return { action: 'heartbeat', sessionId: input.sessionId, state: input.state as PresenceStatus };
  }
  if (input.action === 'work' && typeof input.note === 'string' && input.note.length <= 160 && (input.cardId === null || validPresenceId(input.cardId)) && (input.revision === null || (Number.isInteger(input.revision) && Number(input.revision) >= 0))) {
    return { action: 'work', note: input.note.trim(), cardId: input.cardId as string | null, revision: input.revision as number | null };
  }
  throw new Error('Use a status of up to 160 characters and a task from this workspace.');
}
export function memberPresence(sessions: PresenceSession[], userId: string, now: number) {
  const own = sessions.filter(s => s.user_id === userId && Number.isFinite(Date.parse(s.seen_at)));
  const recent = own.filter(s => now - Date.parse(s.seen_at) < PRESENCE_TTL_MS && Date.parse(s.seen_at) <= now + 5000);
  const state: PresenceStatus = recent.some(s => s.state === 'online') ? 'online' : recent.some(s => s.state === 'away') ? 'away' : 'offline';
  const seen = own.reduce((latest, s) => Math.max(latest, Date.parse(s.seen_at)), 0);
  return { state, lastSeen: seen ? new Date(seen).toISOString() : null };
}
export function presenceAge(value: string | null, now: number) {
  if (!value) return 'No connection recorded';
  const minutes = Math.max(0, Math.floor((now - Date.parse(value)) / 60_000));
  if (minutes < 1) return 'Last seen just now';
  if (minutes < 60) return `Last seen ${minutes}m ago`;
  if (minutes < 1440) return `Last seen ${Math.floor(minutes / 60)}h ago`;
  return `Last seen ${Math.floor(minutes / 1440)}d ago`;
}

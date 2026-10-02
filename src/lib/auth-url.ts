import 'server-only';
export function workspaceOrigin() {
  const origin = new URL(process.env.OJ_WORKSPACE_URL || 'https://desktop-lbi2ein.tail3f006f.ts.net:10000');
  if (origin.username || origin.password || (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(origin.hostname)))) throw new Error('Set a valid OJ workspace URL.');
  return origin.origin;
}

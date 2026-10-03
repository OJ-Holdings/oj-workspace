import 'server-only';
export function workspaceOrigin() {
  // Where sign-up and invitation emails send people back to. The workspace is hosted on Netlify.
  const origin = new URL(process.env.OJ_WORKSPACE_URL || 'https://ojworkspace.netlify.app');
  if (origin.username || origin.password || (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(origin.hostname)))) throw new Error('Set a valid OJ workspace URL.');
  return origin.origin;
}

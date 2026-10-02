import { ojConnection } from '../src/lib/oj-connection.ts';
const headers = { apikey: ojConnection.publishableKey };
for (const table of ['leads','conversations','bookings','settings','doorknocking_sessions','activity_log','quote_requests','oj_cards','oj_comments','oj_memberships','oj_activity']) {
  const response = await fetch(`${ojConnection.url}/rest/v1/${table}?select=*&limit=0`, { headers, signal: AbortSignal.timeout(10000) });
  const denied = response.status === 401 || response.status === 403;
  console.log(JSON.stringify({ check: `Anonymous ${table} read`, status: response.status, denied }));
  if (!denied) throw new Error(`Public read unexpectedly accessible: ${table}`);
}
const origin = process.argv[2] || 'https://desktop-lbi2ein.tail3f006f.ts.net:10000';
const login = await fetch(`${origin}/login`, { signal: AbortSignal.timeout(10000) });
if (login.status !== 200) throw new Error('Login page unavailable.');
for (const path of ['/workspace','workspace/team'].map(p=>p.startsWith('/')?p:`/${p}`)) {
  const response = await fetch(`${origin}${path}`, { redirect: 'manual', signal: AbortSignal.timeout(10000) });
  if (response.status !== 307 || !response.headers.get('location')?.includes('/login')) throw new Error(`Unauthenticated route not protected: ${path}`);
}
const snapshot = await fetch(`${origin}/api/workspace/00000000-0000-4000-8000-000000000001`, { signal: AbortSignal.timeout(10000) });
if (snapshot.status !== 401 || !snapshot.headers.get('cache-control')?.includes('no-store')) throw new Error('Anonymous snapshot must return private no-store 401.');
const privateRoute = await fetch(`${origin}/api/facility/resident`, { signal: AbortSignal.timeout(10000) });
if (privateRoute.status !== 404) throw new Error('Private dashboard route unexpectedly exists.');
console.log(JSON.stringify({ check: 'App login and isolation', login: login.status, anonymousSnapshot: snapshot.status, privateRoute: privateRoute.status, passed: true }));

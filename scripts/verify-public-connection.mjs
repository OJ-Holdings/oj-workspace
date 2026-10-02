import { ojConnection } from '../src/lib/oj-connection.ts';
const headers = { apikey: ojConnection.publishableKey, 'Content-Type': 'application/json' };
const settings = await fetch(`${ojConnection.url}/auth/v1/settings`, { headers });
const configuration = await settings.json();
console.log(JSON.stringify({ check: 'Auth settings', status: settings.status, emailEnabled: configuration.external?.email, signupDisabled: configuration.disable_signup, emailAutoconfirm: configuration.mailer_autoconfirm }));
const cards = await fetch(`${ojConnection.url}/rest/v1/oj_cards?select=id&limit=1`, { headers });
console.log(JSON.stringify({ check: 'Anonymous board access', status: cards.status, denied: !cards.ok }));
if (cards.ok) throw new Error('Anonymous access to workspace cards must be denied.');
for (const email_address of ['unrelated@example.test']) {
  const response = await fetch(`${ojConnection.url}/rest/v1/rpc/oj_owner_setup_pending`, { method: 'POST', headers, body: JSON.stringify({ email_address }) });
  const pending = await response.json();
  const expected = false;
  console.log(JSON.stringify({ check: 'Unrelated enrollment rejected', status: response.status, passed: response.ok && pending === expected }));
  if (!response.ok || pending !== expected) throw new Error('Owner enrollment check failed.');
}

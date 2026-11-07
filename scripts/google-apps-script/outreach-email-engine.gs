/**
 * OJ Solutions email engine + Daily 10 reminders.
 *
 * Paste this file into a NEW standalone Apps Script project (script.google.com) signed in as the sending
 * account, e.g. oscar@ojsolutions.org. It holds no rules of its own: it asks the OJ server
 * "what should I send now?", sends exactly that from this Google account, then reports
 * what happened (sent, failed, replies, bounces). Set the project timezone to America/Chicago.
 *
 * Script properties to set (Project Settings > Script properties):
 *   OUTREACH_SYNC_TOKEN  same value as OJ_OUTREACH_SYNC_TOKEN on the OJ server
 *   SENDER_NAME          the name on the signature, e.g. Oscar
 *   SENDER_FILTER        optional: Oscar or Jacob, to send only that founder's prospects
 *   NAG_EMAILS           JSON for the Daily 10 reminders, e.g. {"Oscar":"you@gmail.com","Jacob":"him@gmail.com"}
 *   ENGINE_URL           optional: where the OJ server lives. For the Windows/Tailscale Funnel host use
 *                        https://<your-funnel-host>/api/outreach-email-engine (must be a public Funnel address:
 *                        Google's servers cannot reach a tailnet-only address). Blank = the Netlify function below.
 */
const DEFAULT_ENGINE_ENDPOINT = 'https://ojworkspace.netlify.app/.netlify/functions/outreach-email-engine';
const SEEN_LIMIT = 300;

function engineCall_(payload) {
  const token = PropertiesService.getScriptProperties().getProperty('OUTREACH_SYNC_TOKEN');
  if (!token) throw new Error('Set OUTREACH_SYNC_TOKEN in Project Settings > Script properties.');
  const endpoint = (PropertiesService.getScriptProperties().getProperty('ENGINE_URL') || '').trim() || DEFAULT_ENGINE_ENDPOINT;
  if (!/^https:\/\//.test(endpoint)) throw new Error('ENGINE_URL must start with https://');
  const res = UrlFetchApp.fetch(endpoint, {
    method: 'post', contentType: 'application/json', headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify(payload), muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  if (code < 200 || code >= 300) throw new Error('Engine returned HTTP ' + code + ': ' + res.getContentText().slice(0, 300));
  return JSON.parse(res.getContentText());
}

function senderDomain_() {
  const email = Session.getEffectiveUser().getEmail() || '';
  return email.indexOf('@') > 0 ? email.split('@')[1] : '';
}

function readJson_(key, fallback) {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(key) || ''); } catch (e) { return fallback; }
}
function writeJson_(key, value) { PropertiesService.getScriptProperties().setProperty(key, JSON.stringify(value)); }

/** Every 10 minutes. Safe to run by hand: the server decides whether anything is due. */
function runEmailEngine() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    const props = PropertiesService.getScriptProperties();
    const domain = senderDomain_();
    // First flush previous outcomes, so the server never plans another send on an unconfirmed result.
    let results = readJson_('PENDING_RESULTS', []);
    if (results.length) {
      engineCall_({ action: 'report', senderDomain: domain, results: results });
      results = []; writeJson_('PENDING_RESULTS', []);
    }
    const plan = engineCall_({
      action: 'plan', senderName: props.getProperty('SENDER_NAME') || '',
      senderFilter: props.getProperty('SENDER_FILTER') || undefined, senderDomain: domain,
    });
    if (plan.state === 'braked') console.error('Email auto-paused: ' + plan.detail);
    // Reconcile stale claims using this account's Gmail Sent history before any new send.
    (plan.unconfirmed || []).forEach(function (candidate) {
      const sent = findSent_(candidate.to);
      if (sent === undefined) return; // Search unavailable, keep reserved rather than risk a duplicate.
      results.push(sent ? { prospect_id: candidate.prospect_id, kind: 'sent', sent_at: sent }
        : { prospect_id: candidate.prospect_id, kind: 'not_sent' });
    });
    if (results.length) {
      engineCall_({ action: 'report', senderDomain: domain, results: results });
      results = []; writeJson_('PENDING_RESULTS', []);
    }
    // One email per triggered run. The server schedules spaced slots across the day.
    if (plan.items.length > 1) throw new Error('Unsafe plan: more than one email per run.');
    if (plan.items.length) results.push(plan.items[0].kind === 'followup'
      ? sendFollowup_(plan.items[0]) : sendOne_(plan.items[0], props.getProperty('SENDER_NAME')));
    results = results.concat(scanInbox_(plan.watch || []));
    // Confirming a send updates Supabase. The bound outreach-sync.gs writer later updates only sheet F:G.
    if (results.length) {
      try { engineCall_({ action: 'report', senderDomain: domain, results: results }); results = []; }
      catch (e) { console.error('Could not report yet, will retry: ' + e.message); }
    }
    writeJson_('PENDING_RESULTS', results.slice(-100));
    console.log('Engine: ' + plan.state + '. ' + plan.detail);
  } finally { lock.releaseLock(); }
}

/** Returns the actual send date, null only on a successful definitive search, undefined on error. */
function findSent_(address) {
  try {
    if (!/^[^\\s@"]+@[^\\s@"]+\\.[^\\s@"]+$/.test(address)) return undefined;
    const threads = GmailApp.search('in:sent to:"' + address.replace(/"/g, '') + '"', 0, 20);
    for (let i = 0; i < threads.length; i++) {
      const messages = threads[i].getMessages();
      for (let j = messages.length - 1; j >= 0; j--) {
        const m = messages[j];
        if (m.isInTrash() || !m.getTo().toLowerCase().split(/[,;]/).some(to => to.includes(address.toLowerCase()))) continue;
        if (m.getFrom().toLowerCase().includes(Session.getEffectiveUser().getEmail().toLowerCase())) return m.getDate().toISOString();
      }
    }
    return null;
  } catch (e) { console.error('Gmail Sent lookup failed: ' + e); return undefined; }
}

/**
 * Gmail Advanced service is required (Apps Script > Services > Gmail API).
 * Reply in the existing thread using both threadId and RFC In-Reply-To headers.
 * Refuse if the original or a new inbound reply cannot be verified.
 */
function sendFollowup_(item) {
  try {
    const threads = GmailApp.search('in:sent to:"' + item.to.replace(/"/g, '') + '"', 0, 10);
    const thread = threads.find(function (t) { return t.getMessages().some(function (m) {
      return m.getTo().toLowerCase().indexOf(item.to.toLowerCase()) >= 0;
    }); });
    if (!thread) throw new Error('Original sent thread not found; follow-up held.');
    const messages = thread.getMessages();
    const replied = messages.find(function (m) { return m.getFrom().toLowerCase().indexOf(item.to.toLowerCase()) >= 0; });
    if (replied) return { prospect_id: item.prospect_id, kind: 'reply', ref: replied.getId(), text: replied.getPlainBody().slice(0, 1500) };
    const original = messages.find(function (m) {
      return m.getTo().toLowerCase().indexOf(item.to.toLowerCase()) >= 0;
    });
    const messageId = original && original.getHeader('Message-ID');
    if (!messageId || !/^<[^\r\n<>]+>$/.test(messageId)) throw new Error('Original Message-ID unavailable, not following up.');
    const subject = /^re:/i.test(item.subject) ? item.subject : 'Re: ' + item.subject;
    const raw = ['To: ' + item.to, 'Subject: ' + subject, 'In-Reply-To: ' + messageId,
      'References: ' + messageId, 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', '',
      String(item.body).replace(/\\n/g, '\n')].join('\r\n');
    const sent = Gmail.Users.Messages.send({ raw: Utilities.base64EncodeWebSafe(raw, Utilities.Charset.UTF_8), threadId: thread.getId() }, 'me');
    if (!sent || !sent.id) throw new Error('Gmail did not confirm the threaded follow-up.');
    return { prospect_id: item.prospect_id, kind: 'followup_sent', ref: sent.id, sent_at: new Date().toISOString() };
  } catch (e) { console.error('Follow-up held: ' + e); return { prospect_id: item.prospect_id, kind: 'failed', detail: String(e.message || e).slice(0, 160) }; }
}

function sendOne_(item, name) {
  try {
    // The server composes one compliant footer. Never append a second signature here.
    // Never email someone this account has already written to.
    const found = findSent_(item.to);
    if (found === undefined) throw new Error('Gmail Sent could not be verified, holding reservation.');
    if (found) return { prospect_id: item.prospect_id, kind: 'sent', sent_at: found };
    // GmailApp.sendEmail uses plain text by default. Do not add htmlBody or open pixels.
    // Some sheet cells contain literal backslash-n sequences.
    const plainText = String(item.body || '').replace(/\\n/g, '\n');
    GmailApp.sendEmail(item.to, item.subject, plainText, { name: name || undefined });
    return { prospect_id: item.prospect_id, kind: 'sent', sent_at: new Date().toISOString() };
  } catch (e) {
    return { prospect_id: item.prospect_id, kind: 'failed', detail: String(e.message || e).slice(0, 160) };
  }
}

/** Looks for replies and bounces from the people we emailed in the last 30 days. */
function scanInbox_(watch) {
  if (!watch.length) return [];
  const props = PropertiesService.getScriptProperties();
  const seen = readJson_('SEEN_IDS', []);
  const out = [];
  const byEmail = {};
  watch.forEach(function (w) { byEmail[w.email.toLowerCase()] = w.prospect_id; });
  for (let i = 0; i < watch.length; i += 15) {
    const batch = watch.slice(i, i + 15).map(function (w) { return w.email; });
    GmailApp.search('from:(' + batch.join(' OR ') + ') newer_than:3d', 0, 30).forEach(function (thread) {
      thread.getMessages().forEach(function (m) {
        const id = m.getId();
        if (seen.indexOf(id) >= 0) return;
        const from = (m.getFrom().match(/[^\s<>"]+@[^\s<>"]+/) || [''])[0].toLowerCase();
        if (!byEmail[from]) return;
        seen.push(id);
        out.push({ prospect_id: byEmail[from], kind: 'reply', ref: id, text: m.getPlainBody().slice(0, 1500) });
      });
    });
  }
  GmailApp.search('from:(mailer-daemon OR postmaster) newer_than:3d', 0, 30).forEach(function (thread) {
    thread.getMessages().forEach(function (m) {
      const id = m.getId();
      if (seen.indexOf(id) >= 0) return;
      const subject = m.getSubject().toLowerCase();
      if (!/undeliverable|failure|returned mail|couldn.t be delivered|not delivered/.test(subject) || /delay/.test(subject)) return;
      seen.push(id);
      const body = m.getPlainBody().toLowerCase();
      Object.keys(byEmail).forEach(function (email) {
        if (body.indexOf(email) >= 0) out.push({ prospect_id: byEmail[email], kind: 'bounce', ref: id });
      });
    });
  });
  writeJson_('SEEN_IDS', seen.slice(-SEEN_LIMIT));
  return out;
}

/** Hourly. Emails each founder who is under today's DM goal; the server picks the reminder and the wording. */
function runQuestReminders() {
  const addresses = readJson_('NAG_EMAILS', {});
  const result = engineCall_({ action: 'quests' });
  const sent = readJson_('NAGS_SENT', []);
  result.reminders.forEach(function (r) {
    const to = addresses[r.name];
    if (!to || sent.indexOf(r.key) >= 0) return;
    MailApp.sendEmail({ to: to, subject: r.subject, body: r.body, name: 'OJ Daily 10' });
    sent.push(r.key);
  });
  writeJson_('NAGS_SENT', sent.slice(-60));
}

/** Run once by hand: shows the next emails that WOULD go out. Sends nothing, claims nothing. */
function previewNextEmails() {
  const props = PropertiesService.getScriptProperties();
  const plan = engineCall_({ action: 'plan', dryRun: true, senderName: props.getProperty('SENDER_NAME') || '', senderFilter: props.getProperty('SENDER_FILTER') || undefined });
  console.log('Engine would be: ' + plan.state + '. ' + plan.detail);
  plan.items.forEach(function (i) { console.log('TO: ' + i.to + '\nSUBJECT: ' + i.subject + '\n\n' + i.body + '\n-----'); });
}

/** Run once by hand after the properties are set. Safe to run again: triggers are replaced, not duplicated. */
function installEngineTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (['runEmailEngine', 'runQuestReminders'].indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('runEmailEngine').timeBased().everyMinutes(1).create();
  ScriptApp.newTrigger('runQuestReminders').timeBased().everyHours(1).create();
}

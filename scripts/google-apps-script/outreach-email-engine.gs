/**
 * OJ Solutions email engine + Daily 10 reminders.
 *
 * Paste this file into the SAME Apps Script project as outreach-sync.gs (it reuses the
 * OUTREACH_SYNC_TOKEN script property). It holds no rules of its own: it asks the OJ server
 * "what should I send now?", sends exactly that from this Google account, then reports
 * what happened (sent, failed, replies, bounces). Set the project timezone to America/Chicago.
 *
 * Script properties to set (Project Settings > Script properties):
 *   OUTREACH_SYNC_TOKEN  same value as the existing spreadsheet sync
 *   SENDER_NAME          the name on the signature, e.g. Oscar
 *   SENDER_FILTER        optional: Oscar or Jacob, to send only that founder's prospects
 *   NAG_EMAILS           JSON for the Daily 10 reminders, e.g. {"Oscar":"you@gmail.com","Jacob":"him@gmail.com"}
 */
const ENGINE_ENDPOINT = 'https://ojworkspace.netlify.app/.netlify/functions/outreach-email-engine';
const SEEN_LIMIT = 300;

function engineCall_(payload) {
  const token = PropertiesService.getScriptProperties().getProperty('OUTREACH_SYNC_TOKEN');
  if (!token) throw new Error('Set OUTREACH_SYNC_TOKEN in Project Settings > Script properties.');
  const res = UrlFetchApp.fetch(ENGINE_ENDPOINT, {
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
    // Anything a previous run could not report goes first.
    let results = readJson_('PENDING_RESULTS', []);
    const plan = engineCall_({
      action: 'plan', senderName: props.getProperty('SENDER_NAME') || '',
      senderFilter: props.getProperty('SENDER_FILTER') || undefined, senderDomain: domain,
    });
    plan.items.forEach(function (item, i) {
      if (i > 0) Utilities.sleep(20000 + Math.floor(Math.random() * 40000));
      results.push(sendOne_(item, props.getProperty('SENDER_NAME')));
    });
    results = results.concat(scanInbox_(plan.watch || []));
    if (results.length) {
      try { engineCall_({ action: 'report', senderDomain: domain, results: results }); results = []; }
      catch (e) { console.error('Could not report yet, will retry: ' + e.message); }
    }
    writeJson_('PENDING_RESULTS', results.slice(-100));
    console.log('Engine: ' + plan.state + '. ' + plan.detail);
  } finally { lock.releaseLock(); }
}

function sendOne_(item, name) {
  try {
    // Never email someone this account has already written to.
    if (GmailApp.search('in:sent to:' + item.to, 0, 1).length) return { prospect_id: item.prospect_id, kind: 'sent' };
    GmailApp.sendEmail(item.to, item.subject, item.body, { name: name || undefined });
    return { prospect_id: item.prospect_id, kind: 'sent' };
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
  ScriptApp.newTrigger('runEmailEngine').timeBased().everyMinutes(10).create();
  ScriptApp.newTrigger('runQuestReminders').timeBased().everyHours(1).create();
}

/**
 * Bind this script to the OJ outreach spreadsheet. It reads only the Outreach
 * tab and pushes values to the authenticated OJ Workspace receiver once per day.
 * Configure the project timezone to America/Chicago before installing the trigger.
 */
const OUTREACH_SPREADSHEET_ID = '1p98z0dW-KERPxTTDQo_mBLUlXSGdFB_pNsWGyJieYpU';
const OUTREACH_ENDPOINT = 'https://desktop-lbi2ein.tail3f006f.ts.net:10000/api/daily-outreach-sync';

function syncOutreachSheet() {
  const token = PropertiesService.getScriptProperties().getProperty('OUTREACH_SYNC_TOKEN');
  if (!token) throw new Error('Set OUTREACH_SYNC_TOKEN in Apps Script Project Settings > Script properties.');

  const sheet = SpreadsheetApp.openById(OUTREACH_SPREADSHEET_ID).getSheetByName('Outreach');
  if (!sheet) throw new Error('The source spreadsheet must contain an Outreach tab.');
  const lastRow = Math.min(Math.max(sheet.getLastRow(), 1), 1000);
  const columns = Math.min(Math.max(sheet.getLastColumn(), 1), 20);
  const rows = sheet.getRange(1, 1, lastRow, columns).getDisplayValues();
  const result = UrlFetchApp.fetch(OUTREACH_ENDPOINT, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({ rows: rows }),
    muteHttpExceptions: true,
  });
  const status = result.getResponseCode();
  if (status < 200 || status >= 300) {
    throw new Error('Outreach import returned HTTP ' + status + ': ' + result.getContentText().slice(0, 300));
  }
  console.log('Outreach import: ' + result.getContentText());
}

function installDailyOutreachTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'syncOutreachSheet') ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger('syncOutreachSheet').timeBased().everyDays(1).atHour(22).create();
}

/** Supabase is authoritative. Only edit existing Outreach cells F:G, never other columns. */
function writeOutreachStatusesToSheet() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    const token = PropertiesService.getScriptProperties().getProperty('OUTREACH_SYNC_TOKEN');
    if (!token) throw new Error('OUTREACH_SYNC_TOKEN must be configured.');
    const sheet = SpreadsheetApp.openById(OUTREACH_SPREADSHEET_ID).getSheetByName('Outreach');
    if (!sheet) throw new Error('Outreach tab not found.');
    const header = sheet.getRange(1, 1, 1, 18).getDisplayValues()[0].map(x => x.trim().toLowerCase());
    if (header[5] !== 'status' || header[6] !== 'notes' || header[7] !== 'business name')
      throw new Error('Sheet columns changed: refusing any edits.');
    const endpoint = OUTREACH_ENDPOINT.replace('/api/daily-outreach-sync','/api/outreach-sheet-status');
    const response = UrlFetchApp.fetch(endpoint, { method: 'get', headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) throw new Error('Sheet status endpoint unavailable: HTTP ' + response.getResponseCode());
    const body = JSON.parse(response.getContentText());
    if (!body || !Array.isArray(body.rows) || body.rows.length > 1000) throw new Error('Unexpected writeback payload.');
    let changed = 0;
    body.rows.forEach(function (r) {
      if (!Number.isInteger(r.row) || r.row < 2 || r.row > sheet.getLastRow()) return;
      if (!['Sent','Skipped','Emailed','Followed up'].includes(r.status) || typeof r.notes !== 'string' || r.notes.length > 300) return;
      // The row is unchanged only if the business still matches. Never write to a shifted row.
      if (sheet.getRange(r.row, 8).getDisplayValue().trim().toLowerCase() !== String(r.business).trim().toLowerCase()) return;
      const range = sheet.getRange(r.row, 6, 1, 2);
      const existing = range.getDisplayValues()[0];
      if (existing[0] === r.status && existing[1] === r.notes) return;
      range.setValues([[r.status, r.notes]]);
      changed++;
    });
    console.log('Supabase status writeback, F:G only. Updated rows: ' + changed);
  } finally { lock.releaseLock(); }
}

function installOutreachStatusWritebackTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'writeOutreachStatusesToSheet') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('writeOutreachStatusesToSheet').timeBased().everyMinutes(5).create();
}

/**
 * Bind this script to the OJ outreach spreadsheet. It reads only the Outreach
 * tab and pushes values to the authenticated Netlify receiver once per day.
 * Configure the project timezone to America/Chicago before installing the trigger.
 */
const OUTREACH_SPREADSHEET_ID = '1p98z0dW-KERPxTTDQo_mBLUlXSGdFB_pNsWGyJieYpU';
const OUTREACH_ENDPOINT = 'https://ojworkspace.netlify.app/.netlify/functions/daily-outreach-sync';

function syncOutreachSheet() {
  const token = PropertiesService.getScriptProperties().getProperty('OUTREACH_SYNC_TOKEN');
  if (!token) throw new Error('Set OUTREACH_SYNC_TOKEN in Apps Script Project Settings > Script properties.');

  const sheet = SpreadsheetApp.openById(OUTREACH_SPREADSHEET_ID).getSheetByName('Outreach');
  if (!sheet) throw new Error('The source spreadsheet must contain an Outreach tab.');
  const lastRow = Math.min(Math.max(sheet.getLastRow(), 1), 1000);
  const rows = sheet.getRange(1, 1, lastRow, 20).getDisplayValues();
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

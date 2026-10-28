import assert from 'node:assert/strict';
import test from 'node:test';
import { lsaMarker, lsaSummary, parseLsaExport, parseLsaTime, planLsaImport } from '../src/lib/lsa-import';

const HEAD = 'Customer\tJob type\tSearch Intent\tLocation\tLead type\tCharge status\tLead received\tLast activity\tLead id';
// The web page copy puts every cell on its own line; a phone lead shows the number, a message lead the name.
const LINES = `${HEAD}
(262) 555-0101 ext. 65879
Window cleaning
Category
Wauwatosa
Phone
Charged
10/25/26 5:55 PM
10/26/26 5:55 PM
347874506
Pat Example
Window cleaning
Category
Mukwonago
Message
Credited
10/17/26 8:27 PM
10/26/26 11:10 AM
346766301
`;

test('times become Central-time ISO stamps, with the daylight-time change on 1 November 2026', () => {
  assert.deepEqual(parseLsaTime('10/25/26 5:55 PM'), { day: '2026-10-25', at: '2026-10-25T17:55:00-05:00' });
  assert.deepEqual(parseLsaTime('11/2/26 12:05 AM'), { day: '2026-11-02', at: '2026-11-02T00:05:00-06:00' });
  assert.deepEqual(parseLsaTime('7/4/2026 12:00 PM'), { day: '2026-07-04', at: '2026-07-04T12:00:00-05:00' });
  assert.equal(parseLsaTime('soon'), null);
});

test('the one-cell-per-line page copy is read into rows, phone leads by number and message leads by name', () => {
  const { rows, skipped } = parseLsaExport(LINES);
  assert.equal(skipped, 0);
  assert.equal(rows.length, 2);
  assert.deepEqual([rows[0].phone, rows[0].name, rows[0].charge, rows[0].leadType], ['+12625550101', null, 'charged', 'Phone']);
  assert.deepEqual([rows[1].phone, rows[1].name, rows[1].charge, rows[1].location], [null, 'Pat Example', 'credited', 'Mukwonago']);
});

test('spreadsheet rows (tab separated) read the same, repeats are dropped and bad rows are counted', () => {
  const sheet = `${HEAD}\nPat Example\tWindow cleaning\tCategory\tMukwonago\tMessage\tCharged\t10/17/26 8:27 PM\t10/26/26 11:10 AM\t346766301\nPat Example\tWindow cleaning\tCategory\tMukwonago\tMessage\tCharged\t10/17/26 8:27 PM\t10/26/26 11:10 AM\t346766301\nNo Id\tx\tx\tx\tx\tx\tnot a date\tx\tabc`;
  const { rows, skipped } = parseLsaExport(sheet);
  assert.equal(rows.length, 1);
  assert.equal(skipped, 1);
});

test('plan: match by phone or a single exact name, tag only when the source differs, and never import the same lead twice', () => {
  const { rows } = parseLsaExport(LINES);
  const leads = [
    { id: 'a', name: 'Somebody', phone: '+12625550101', source: 'dtd', notes: null },
    { id: 'b', name: 'pat  example', phone: 'NP_4', source: 'lsa', notes: null },
  ];
  const steps = planLsaImport(rows, leads);
  assert.deepEqual(steps.map(s => [s.action, s.leadId]), [['tag', 'a'], ['same', 'b']]);
  assert.deepEqual(planLsaImport(rows, [{ id: 'c', name: 'x', phone: 'NP_1', source: 'lsa', notes: `done ${lsaMarker('347874506')}` }]).map(s => s.action), ['already', 'create']);
  const twins = [{ id: 'd', name: 'Pat Example', phone: 'NP_2', source: null, notes: null }, { id: 'e', name: 'Pat Example', phone: 'NP_3', source: null, notes: null }];
  assert.equal(planLsaImport([rows[1]], twins)[0].action, 'create', 'two people with one name is not a safe match');
});

test('summary counts leads by month and lists charged leads still inside the 30-day dispute window, soonest first', () => {
  const { rows } = parseLsaExport(LINES);
  const s = lsaSummary(planLsaImport(rows, []), '2026-11-10');
  assert.deepEqual(s.months, [{ month: '2026-10', leads: 2, charged: 1, credited: 1, notCharged: 0 }]);
  assert.deepEqual(s.disputes.map(d => [d.row.leadId, d.deadline, d.daysLeft]), [['347874506', '2026-11-24', 14]]);
  assert.equal(lsaSummary(planLsaImport(rows, []), '2026-12-30').disputes.length, 0);
});

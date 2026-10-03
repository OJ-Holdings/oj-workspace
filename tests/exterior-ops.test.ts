import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone, planLeadUpdate, slotTaken } from '../src/lib/exterior-ops';
import { mapStatus, parseCsv, parseDoorRows, planDedupe, planSheetSync, sheetCsvUrl, type SyncLead } from '../src/lib/exterior-sync';

const now = '2026-10-03T15:00:00.000Z';
const lead = (l: Partial<SyncLead>): SyncLead => ({ id: 'a', name: 'Ann', phone: '+12625550100', address: '1 Main St', source: 'dtd', service_requested: 'House Wash', quote_amount: 300, status: 'new', notes: null, manually_updated_fields: [], ...l });

test('phone numbers normalise to +1 form and junk is refused', () => {
  assert.deepEqual(['(262) 555-0100', '1 262 555 0100', '555-0100', '', 'call me'].map(normalizePhone), ['+12625550100', '+12625550100', null, null, null]);
});

test('completing a job fills the payment from the quote, stamps the date and locks edited fields', () => {
  const u = planLeadUpdate({ status: 'booked', quote_amount: 400, job_revenue: null, completed_at: null, manually_updated_fields: ['notes'] }, { status: 'completed' }, now);
  assert.equal(u.job_revenue, 400);
  assert.equal(u.completed_at, now);
  assert.deepEqual(u.manually_updated_fields, ['notes', 'status', 'job_revenue']);
});

test('entering a payment on a completed job moves it to today; other edits leave the date alone', () => {
  const done = { status: 'completed', quote_amount: 400, job_revenue: 400, completed_at: '2026-07-01T00:00:00Z', manually_updated_fields: null };
  assert.equal(planLeadUpdate(done, { job_revenue: 450 }, now).completed_at, now);
  assert.equal('completed_at' in planLeadUpdate(done, { notes: 'Gate code 12' }, now), false);
  assert.equal('completed_at' in planLeadUpdate(done, { job_cost: 20 }, now), false);
  assert.equal('job_revenue' in planLeadUpdate({ ...done, status: 'new' }, { status: 'contacted' }, now), false);
  const kept = planLeadUpdate({ status: 'booked', quote_amount: 400, job_revenue: 380, completed_at: null, manually_updated_fields: [] }, { status: 'completed' }, now);
  assert.equal('job_revenue' in kept, false, 'a payment already entered is not replaced by the quote');
});

test('a time block is taken only by confirmed or pending bookings, and a booking does not block itself', () => {
  const b = [{ id: '1', date: '2026-10-08', time_block: '9-12', status: 'confirmed' }, { id: '2', date: '2026-10-08', time_block: '4-6', status: 'denied' }];
  assert.equal(slotTaken(b, '2026-10-08', '9-12'), true);
  assert.equal(slotTaken(b, '2026-10-08', '9-12', '1'), false);
  assert.equal(slotTaken(b, '2026-10-08', '4-6'), false);
  assert.equal(slotTaken(b, '2026-10-09', '9-12'), false);
});

test('CSV parsing handles quotes, commas and line breaks inside cells', () => {
  assert.deepEqual(parseCsv('"Name","Notes"\r\n"Ann","said ""hi"", twice"\n"Bob","line one\nline two"\n,\n'), [['Name', 'Notes'], ['Ann', 'said "hi", twice'], ['Bob', 'line one\nline two']]);
});

test('the sheet link is rebuilt from the sheet id only', () => {
  assert.equal(sheetCsvUrl('https://docs.google.com/spreadsheets/d/abc_123-X/edit?usp=sharing'), 'https://docs.google.com/spreadsheets/d/abc_123-X/gviz/tq?tqx=out:csv');
  assert.equal(sheetCsvUrl('https://docs.google.com/spreadsheets/d/abc/edit#gid=42'), 'https://docs.google.com/spreadsheets/d/abc/gviz/tq?tqx=out:csv&gid=42');
  assert.throws(() => sheetCsvUrl('https://example.com/evil'));
});

test('sheet statuses map onto the pipeline', () => {
  assert.deepEqual(['Job Completed', 'Scheduled', 'Needs Follow Up', 'Ghosted', 'New Lead', 'Texted', '', 'something odd'].map(mapStatus), ['completed', 'booked', 'following_up', 'closed', 'new', 'contacted', 'new', 'new']);
});

test('sheet sync adds new people, updates what changed, and never undoes hand edits or moves a status back', () => {
  const rows = [
    ['Name', 'Address', 'Phone', 'Source', 'Service Type', 'Quote', 'Status', 'Notes'],
    ['Ann', '1 Main St', '(262) 555-0100', 'dtd', 'House Wash', '$350', 'Scheduled', ''],
    ['Bob', '2 Oak Ave', '262-555-0111', 'Facebook', 'Driveway', '$200', 'New Lead', 'Has a dog'],
    ['Cara', '3 Elm Rd', 'ask husband', '', '', '', 'Contacted', ''],
    ['', '', '', '', '', '', '', ''],
    ['Dan', '4 Pine Ct', '2625550144', 'dtd', 'Deck', '', 'New Lead', ''],
    ['Eve', '5 Fir Ln', '2625550155', 'dtd', 'Windows', '$100', 'Scheduled', ''],
  ];
  const plan = planSheetSync(rows, [
    lead({}),
    lead({ id: 'c', name: 'cara', address: '3 elm rd', phone: 'NP_4_1', status: 'new', quote_amount: null, service_requested: null, source: 'door-to-door' }),
    lead({ id: 'd', name: 'Dan', address: '4 Pine Ct', phone: '+12625550144', status: 'completed', service_requested: 'Deck', quote_amount: 900, source: 'dtd' }),
    lead({ id: 'e', name: 'Eve', address: '5 Fir Ln', phone: '+12625550155', status: 'closed', service_requested: 'Gutters', quote_amount: 250, source: 'dtd', manually_updated_fields: ['status', 'quote_amount', 'service_requested'] }),
  ], '0000001');
  assert.deepEqual(plan.updates.find(u => u.id === 'a')?.changes, { quote_amount: 350, status: 'booked' });
  assert.deepEqual(plan.updates.find(u => u.id === 'c')?.changes, { name: 'Cara', address: '3 Elm Rd', notes: '[Phone from sheet: "ask husband"]', status: 'contacted' });
  assert.equal(plan.updates.some(u => u.id === 'd'), false, 'a completed job is not moved back to new, and an empty quote does not wipe $900');
  assert.equal(plan.updates.some(u => u.id === 'e'), false, 'hand-edited fields win');
  assert.equal(plan.unchanged, 2);
  assert.equal(plan.blank, 1);
  assert.deepEqual(plan.inserts, [{ name: 'Bob', address: '2 Oak Ave', source: 'Facebook', service_requested: 'Driveway', quote_amount: 200, status: 'new', notes: 'Has a dog', phone: '+12625550111' }]);
});

test('door-knocking rows parse, skipping headers and totals, and a yearless December date in January is last year', () => {
  const rows = [['Date', 'Who'], ['March 19', 'Both', 'White Caps', '4pm', '6pm', '40', '15', '5', '4', '2', '$650', '37.5%', '', '', '50%', '$16.25', '$325', '20', 'Good block'], ['Totals', '', '', '', '', '1170'], ['2026-07-24', 'Oscar', 'Hunters Ridge', '', '', '36', '10', '3', '2', '1', '300'], ['December 20', 'Jacob', 'Park', '', '', '10']];
  const s = parseDoorRows(rows, new Date(2026, 9, 3));
  assert.equal(s.length, 3);
  assert.deepEqual([s[0].session_date, s[0].doors_knocked, s[0].job_total, s[0].answer_rate, s[0].dollars_per_door, s[0].notes], ['2026-03-19', 40, 650, 37.5, 16.25, 'Good block']);
  assert.equal(s[1].session_date, '2026-07-24');
  assert.equal(s[2].session_date, '2025-12-20');
});

test('the newer door-knocking sheet layout reads by header: weekday dates, rep columns, same-day second sessions, no totals row', () => {
  const rows = [
    ['SESSION Date', 'WHO Who Knocked', 'Jacob', 'Oscar', 'Parker', 'Hendrix', 'Reps', 'SESSION Area', 'Start', 'End', 'Hours', 'RAW Doors', 'Answers', 'Interested', 'Quotes', 'Jobs', 'Job Total', 'RATES Answer %', 'Interest %', 'Quote %', 'Close %', 'VALUE $ / Door', 'Avg Job', 'Doors / Hr', 'Doors / Rep-Hr', 'SESSION Notes'],
    ['Thu Mar 19', 'Jacob + Oscar', 'x', 'x', '', '', '2', '', '', '', '', '34', '16', '3', '1', '', '', '47%', '19%', '33%', '0%', '$0.00', '', '', '', ''],
    ['Sat Aug 08', 'Jacob', 'x', '', '', '', '1', '10th Ave', '6:00 PM', '', '', '25', '3', '', '', '', '', '12%', '0%', '', '', '$0.00', '', '', '', 'Rain'],
    ['', 'Jacob + Oscar', 'x', 'x', '', '', '2', '', '', '', '', '35', '19', '6', '3', '1', '$450', '54%', '32%', '50%', '0%', '$12.86', '', '', '', ''],
    ['', '', '', '', '', '', '', '', '', '', '', '94', '38', '9', '4', '1', '$450', '40%', '', '', '', '', '', '', '', ''],
  ];
  const s = parseDoorRows(rows, new Date(2026, 9, 3));
  assert.equal(s.length, 3);
  assert.deepEqual([s[0].session_date, s[0].knocked_by, s[0].doors_knocked, s[0].answers, s[0].quotes_given, s[0].answer_rate], ['2026-03-19', 'Jacob + Oscar', 34, 16, 1, 47]);
  assert.deepEqual([s[1].session_date, s[1].area, s[1].start_time, s[1].notes], ['2026-08-08', '10th Ave', '6:00 PM', 'Rain']);
  assert.deepEqual([s[2].session_date, s[2].doors_knocked, s[2].jobs_scheduled, s[2].job_total, s[2].dollars_per_door], ['2026-08-08', 35, 1, 450, 12.86]);
});

test('duplicates merge into the lead furthest along, keeping notes and a real phone', () => {
  const merges = planDedupe([
    lead({ id: '1', status: 'new', notes: 'First knock' }),
    lead({ id: '2', status: 'completed', notes: 'Paid cash' }),
    lead({ id: '3', name: 'Bob', phone: 'NP_9_1', address: '2 Oak  Ave', status: 'booked', notes: null }),
    lead({ id: '4', name: 'bob', phone: '+12625550111', address: '2 oak ave', status: 'new', notes: null }),
    lead({ id: '5', name: 'Solo', phone: '+12625550199', address: null }),
  ]);
  assert.deepEqual(merges, [
    { keep: '2', remove: ['1'], notes: 'Paid cash\n[Merged] First knock', phone: null },
    { keep: '3', remove: ['4'], notes: null, phone: '+12625550111' },
  ]);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateEstimate, newEstimate, newSite } from '../src/lib/commercial-estimate';
import {
  commercialTransferFormat, commercialTransferMaxChars,
  commercialTransferVersion, exportCommercialEstimate, importCommercialEstimate,
} from '../src/lib/commercial-transfer';

const org = '00000000-0000-4000-8000-000000000001';
const partnerOrg = '00000000-0000-4000-8000-000000000002';
const example = () => {
  const input = newEstimate();
  input.sites = [
    { ...newSite('bldg-a'), name: 'North office', location: 'Waukegan',
      levels: 4, panes: 168, crewHours: 26.5, liftDays: 2,
      access: 'lift', notes: 'Loading restrictions and water supply unconfirmed.' },
    { ...newSite('bldg-b'), name: 'South office', location: 'Milwaukee',
      levels: 2, panes: 90, crewHours: 14, liftDays: 0,
      access: 'water-fed', notes: 'Main lobby requires separate schedule.' },
  ];
  input.laborRate = 47.5;
  input.liftDaily = 625;
  input.materials = 180;
  input.mobilization = 145;
  input.other = 95;
  input.margin = 35;
  input.contingency = 12;
  input.deposit = 30;
  return input;
};

test('a full multi-building estimate transfers losslessly between authorized founders', () => {
  const input = example();
  const review = [true, false, true, false, true];
  const timestamp = new Date('2026-10-22T19:15:00.000Z');
  const file = exportCommercialEstimate(org, 'Office portfolio inspection', input, review, timestamp);
  const imported = importCommercialEstimate(file, org);
  assert.equal(imported.format, commercialTransferFormat);
  assert.equal(imported.version, commercialTransferVersion);
  assert.equal(imported.organization_id, org);
  assert.equal(imported.exported_at, timestamp.toISOString());
  assert.equal(imported.name, 'Office portfolio inspection');
  assert.deepEqual(imported.input, input);
  assert.deepEqual(imported.review, review);
  assert.deepEqual(calculateEstimate(imported.input), calculateEstimate(input));
});

test('exported commercial files cannot be imported into a different company', () => {
  const file = exportCommercialEstimate(org, 'Private bid', example(), [false,false,false,false,false]);
  assert.throws(() => importCommercialEstimate(file, partnerOrg), /different.*workspace/i);
});

test('importing malformed JSON and unsupported versions fails without introducing a project', () => {
  const input = example();
  const json = exportCommercialEstimate(org, 'Portfolio', input, [true,true,true,true,true]);
  assert.throws(() => importCommercialEstimate('{not json', org), /not valid JSON/);
  assert.throws(() => importCommercialEstimate(json.replace(commercialTransferFormat, 'unknown-v1'), org), /Unsupported/);
  assert.throws(() => importCommercialEstimate(JSON.stringify({ ...JSON.parse(json), version: 2 }), org), /Unsupported/);
  assert.throws(() => importCommercialEstimate('x'.repeat(commercialTransferMaxChars + 1), org), /larger/);
});

test('untrusted fields are parsed into an explicit whitelist', () => {
  const data = JSON.parse(exportCommercialEstimate(org, 'Portfolio', example(), [false,false,false,false,false]));
  data.untrustedField = '<script>hello</script>';
  data.input.untrustedField = { exploit: true };
  data.input.sites[0].untrustedField = true;
  const cleaned = importCommercialEstimate(JSON.stringify(data), org);
  assert.equal(Object.prototype.hasOwnProperty.call(cleaned, 'untrustedField'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(cleaned.input, 'untrustedField'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(cleaned.input.sites[0], 'untrustedField'), false);
});

test('invalid numbers, duplicate building identifiers and unsupported access fail instead of silently changing prices', () => {
  const valid = JSON.parse(exportCommercialEstimate(org, 'Portfolio', example(), [false,false,false,false,false]));
  const check = (edit: (candidate: any) => void, pattern: RegExp) => {
    const x = structuredClone(valid);
    edit(x);
    assert.throws(() => importCommercialEstimate(JSON.stringify(x), org), pattern);
  };
  check(v => { v.input.margin = 99; }, /margin/i);
  check(v => { v.input.laborRate = -50; }, /labor/i);
  check(v => { v.input.materials = null; }, /materials/i);
  check(v => { v.input.sites[1].id = 'bldg-a'; }, /duplicate/i);
  check(v => { v.input.sites[0].access = 'rope'; }, /invalid access/i);
  check(v => { v.input.sites[0].levels = 2.4; }, /whole number/i);
  check(v => { v.input.sites = []; }, /between 1 and 12/i);
  check(v => { v.review = [true]; }, /review checklist/i);
  check(v => { v.exported_at = 'wrong'; }, /export timestamp/i);
});

test('files exceeding safe text bounds cannot silently truncate an estimate', () => {
  const input = example();
  input.sites[0].notes = 'x'.repeat(5001);
  assert.throws(() => exportCommercialEstimate(org, 'Portfolio', input, [false,false,false,false,false]), /notes/i);
  const valid = example();
  assert.throws(() => exportCommercialEstimate(org, '', valid, [false,false,false,false,false]), /Project reference/i);
});

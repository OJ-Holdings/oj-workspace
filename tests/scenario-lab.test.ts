import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateScenario, scenarioBusinesses, scenarioSensitivity, scenarioTemplates,
} from '../src/lib/scenario-lab';

test('every registered OJ business has a clearly hypothetical initial template', () => {
  assert.deepEqual(scenarioBusinesses, ['exterior', 'solutions', 'essentials', 'content']);
  for (const id of scenarioBusinesses) {
    const template = scenarioTemplates[id];
    assert.equal(template.example.business, id);
    assert.ok(template.title && template.description && template.unit);
    assert.doesNotThrow(() => calculateScenario(template.example));
  }
});

test('Exterior operating surplus, contribution, horizon and breakeven reconcile', () => {
  const inputs = scenarioTemplates.exterior.example;
  const s = calculateScenario(inputs);
  assert.equal(s.monthlyRevenue, 3900);
  assert.equal(s.monthlyDirectCost, 1140);
  assert.equal(s.contributionPerUnit, 230);
  assert.equal(s.monthlyContribution, 2760);
  assert.equal(s.monthlySurplus, 2310);
  assert.equal(s.periodRevenue, 23400);
  assert.equal(s.periodSurplusAfterInvestment, 13860);
  assert.equal(s.breakEvenUnits, 2);
  assert.equal(s.paybackMonths, null);
});

test('one-time investment is counted once and payback requires positive surplus', () => {
  const s = calculateScenario({ ...scenarioTemplates.exterior.example, upfrontInvestment: 4000, months: 3 });
  assert.equal(s.periodSurplusAfterInvestment, 2930);
  assert.equal(s.paybackMonths, 2);
  const losing = calculateScenario({ ...scenarioTemplates.content.example, upfrontInvestment: 1000 });
  assert.equal(losing.paybackMonths, null);
  assert.ok(losing.monthlySurplus < 0);
});

test('zero or negative contribution cannot claim break-even volume', () => {
  const zero = calculateScenario({ ...scenarioTemplates.content.example, revenuePerUnit: 0, directCostPerUnit: 0 });
  assert.equal(zero.breakEvenUnits, null);
  const negative = calculateScenario({ ...scenarioTemplates.essentials.example, revenuePerUnit: 10, directCostPerUnit: 25 });
  assert.equal(negative.breakEvenUnits, null);
});

test('sensitivity cases change only volume and never mutate source assumptions', () => {
  const inputs = { ...scenarioTemplates.solutions.example };
  const cases = scenarioSensitivity(inputs);
  assert.equal(cases.length, 3);
  assert.deepEqual(cases.map(c => c.units), [3.5, 5, 6.5]);
  assert.ok(cases[0].result.monthlySurplus < cases[1].result.monthlySurplus);
  assert.ok(cases[1].result.monthlySurplus < cases[2].result.monthlySurplus);
  assert.deepEqual(inputs, scenarioTemplates.solutions.example);
});

test('unbounded, negative, NaN and invalid horizon inputs fail closed', () => {
  const start = scenarioTemplates.exterior.example;
  for (const amount of [-1, Number.NaN, Number.POSITIVE_INFINITY, 1_000_001]) {
    assert.throws(() => calculateScenario({ ...start, revenuePerUnit: amount }), RangeError);
  }
  for (const months of [0, -1, 1.5, 37, Number.NaN]) {
    assert.throws(() => calculateScenario({ ...start, months }), RangeError);
  }
});

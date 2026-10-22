/**
 * Hypothetical unit-economics calculator. Not a forecast, accounting ledger,
 * bank balance, tax calculation, or observation from OJ customer records.
 */
export const scenarioBusinesses = ['exterior', 'solutions', 'essentials', 'content'] as const;
export type ScenarioBusiness = typeof scenarioBusinesses[number];
export type ScenarioInputs = {
  business: ScenarioBusiness;
  unitsPerMonth: number;
  revenuePerUnit: number;
  directCostPerUnit: number;
  fixedMonthlyCost: number;
  upfrontInvestment: number;
  months: number;
};

export const scenarioTemplates: Record<ScenarioBusiness, {
  title: string;
  unit: string;
  revenueLabel: string;
  costLabel: string;
  description: string;
  example: ScenarioInputs;
}> = {
  exterior: {
    title: 'Exterior Care', unit: 'jobs', revenueLabel: 'Revenue collected per job', costLabel: 'Direct cost per job',
    description: 'Explore job volume, pricing, labor/materials and equipment investments.',
    example: { business: 'exterior', unitsPerMonth: 12, revenuePerUnit: 325, directCostPerUnit: 95, fixedMonthlyCost: 450, upfrontInvestment: 0, months: 6 },
  },
  solutions: {
    title: 'OJ Solutions', unit: 'monthly clients', revenueLabel: 'Monthly revenue per client', costLabel: 'Monthly delivery cost per client',
    description: 'Model subscription clients, monthly delivery expenses and overhead.',
    example: { business: 'solutions', unitsPerMonth: 5, revenuePerUnit: 250, directCostPerUnit: 70, fixedMonthlyCost: 350, upfrontInvestment: 0, months: 6 },
  },
  essentials: {
    title: 'OJ Essentials', unit: 'orders', revenueLabel: 'Revenue collected per order', costLabel: 'Direct cost per order',
    description: 'Test order volume, landed costs, fulfillment and monthly advertising overhead.',
    example: { business: 'essentials', unitsPerMonth: 40, revenuePerUnit: 45, directCostPerUnit: 27, fixedMonthlyCost: 500, upfrontInvestment: 0, months: 6 },
  },
  content: {
    title: 'Oscar Jacob', unit: 'videos', revenueLabel: 'Revenue collected per video', costLabel: 'Production cost per video',
    description: 'Compare publishing volume, production expenses and hypothetical monetization.',
    example: { business: 'content', unitsPerMonth: 8, revenuePerUnit: 0, directCostPerUnit: 35, fixedMonthlyCost: 100, upfrontInvestment: 0, months: 6 },
  },
};

export type ScenarioResult = {
  monthlyRevenue: number;
  monthlyDirectCost: number;
  contributionPerUnit: number;
  monthlyContribution: number;
  monthlySurplus: number;
  periodRevenue: number;
  periodSurplusAfterInvestment: number;
  breakEvenUnits: number | null;
  paybackMonths: number | null;
};

/** Refuse nonsensical/unbounded inputs rather than silently calculating them. */
export function calculateScenario(inputs: ScenarioInputs): ScenarioResult {
  const { unitsPerMonth: units, revenuePerUnit: price, directCostPerUnit: direct,
    fixedMonthlyCost: fixed, upfrontInvestment: upfront, months } = inputs;
  for (const value of [units, price, direct, fixed, upfront]) {
    if (!Number.isFinite(value) || value < 0 || value > 1_000_000) throw new RangeError('Amounts must be between 0 and 1,000,000.');
  }
  if (!Number.isInteger(months) || months < 1 || months > 36) throw new RangeError('Months must be between 1 and 36.');
  const monthlyRevenue = units * price;
  const monthlyDirectCost = units * direct;
  const contributionPerUnit = price - direct;
  const monthlyContribution = units * contributionPerUnit;
  const monthlySurplus = monthlyContribution - fixed;
  return {
    monthlyRevenue,
    monthlyDirectCost,
    contributionPerUnit,
    monthlyContribution,
    monthlySurplus,
    periodRevenue: monthlyRevenue * months,
    periodSurplusAfterInvestment: monthlySurplus * months - upfront,
    breakEvenUnits: contributionPerUnit > 0 ? Math.ceil(fixed / contributionPerUnit) : null,
    paybackMonths: upfront > 0 && monthlySurplus > 0 ? Math.ceil(upfront / monthlySurplus) : null,
  };
}

/** Show volume sensitivity, never model these as probabilities or predictions. */
export function scenarioSensitivity(inputs: ScenarioInputs) {
  return [
    { name: 'Lower volume', factor: 0.7 },
    { name: 'Base case', factor: 1 },
    { name: 'Higher volume', factor: 1.3 },
  ].map(({ name, factor }) => ({
    name,
    units: Number((inputs.unitsPerMonth * factor).toFixed(1)),
    result: calculateScenario({ ...inputs, unitsPerMonth: Number((inputs.unitsPerMonth * factor).toFixed(1)) }),
  }));
}

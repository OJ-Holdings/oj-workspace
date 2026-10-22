'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, ArrowUpRight, Calculator, RotateCcw, ShieldCheck, TrendingUp } from 'lucide-react';
import {
  calculateScenario, scenarioBusinesses, scenarioSensitivity, scenarioTemplates,
  type ScenarioBusiness, type ScenarioInputs,
} from '@/lib/scenario-lab';

const usd = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const fields: { key: keyof Omit<ScenarioInputs, 'business' | 'months'>; label: string; prefix?: string; help: string }[] = [
  { key: 'unitsPerMonth', label: 'Units per month', help: 'Completed jobs, active monthly clients, orders or published videos.' },
  { key: 'revenuePerUnit', label: 'Revenue per unit', prefix: '$', help: 'Hypothetical collected revenue per unit; enter 0 if there is no proven revenue.' },
  { key: 'directCostPerUnit', label: 'Direct cost per unit', prefix: '$', help: 'Labor, materials, fulfillment, delivery or production costs per unit.' },
  { key: 'fixedMonthlyCost', label: 'Monthly fixed costs', prefix: '$', help: 'Overhead, software, insurance, advertising and other recurring fixed costs.' },
  { key: 'upfrontInvestment', label: 'One-time investment', prefix: '$', help: 'Optional new equipment, campaign setup or production investment.' },
];

export function ScenarioLab({ base }: { base: string }) {
  const [inputs, setInputs] = useState<ScenarioInputs>({ ...scenarioTemplates.exterior.example });
  const [showMethod, setShowMethod] = useState(false);
  const template = scenarioTemplates[inputs.business];
  const result = calculateScenario(inputs);
  const sensitivity = scenarioSensitivity(inputs);
  const contributionPercent = result.monthlyRevenue > 0
    ? result.monthlyContribution / result.monthlyRevenue * 100 : null;

  function changeBusiness(business: ScenarioBusiness) {
    setInputs({ ...scenarioTemplates[business].example });
  }

  function changeNumber(key: keyof Omit<ScenarioInputs, 'business'>, raw: string) {
    const numeric = raw === '' ? 0 : Number(raw);
    if (!Number.isFinite(numeric)) return;
    const bounded = Math.max(0, Math.min(key === 'months' ? 36 : 1_000_000, numeric));
    setInputs(previous => ({ ...previous, [key]: key === 'months' ? Math.max(1, Math.round(bounded)) : key === 'unitsPerMonth' ? Math.round(bounded) : bounded }));
  }

  return <div className="scenario page">
    <nav className="scenario-back"><Link href={`${base}/tools`}><ArrowLeft size={16} aria-hidden="true" /> Corporate Tools</Link></nav>
    <header className="scenario-hero">
      <p className="tools-eyebrow"><Calculator size={15} aria-hidden="true" /> FINANCE / STRATEGY LAB</p>
      <h1>Business Scenario Lab</h1>
      <p>Explore how volume, unit economics, fixed costs and investment change potential operating surplus across all four businesses.</p>
      <div className="scenario-boundary"><ShieldCheck size={17} aria-hidden="true" /><span><b>Hypothetical model only.</b> Inputs start as editable illustrations, not your actual OJ Holdings performance. No bank data, customer records, forecast accuracy claim, or database writes.</span></div>
    </header>

    <div className="scenario-venture-tabs" role="group" aria-label="Choose business">
      {scenarioBusinesses.map(business => <button key={business} type="button" aria-pressed={inputs.business === business} onClick={() => changeBusiness(business)}>{scenarioTemplates[business].title}</button>)}
    </div>
    <div className="scenario-grid">
      <section className="scenario-panel scenario-inputs" aria-labelledby="scenario-input-title">
        <div className="scenario-panel-head">
          <div><p className="tools-eyebrow">ASSUMPTIONS</p><h2 id="scenario-input-title">{template.title}</h2></div>
          <button className="scenario-reset" type="button" onClick={() => setInputs({ ...template.example })}><RotateCcw size={15} aria-hidden="true" /> Reset examples</button>
        </div>
        <p className="scenario-explainer">{template.description} Adjust every number to explore a different possible outcome.</p>
        <div className="scenario-fields">
          {fields.map(field => <label key={field.key}>
            <span>{field.key === 'unitsPerMonth' ? `${template.unit[0].toUpperCase() + template.unit.slice(1)} per month`
              : field.key === 'revenuePerUnit' ? template.revenueLabel
              : field.key === 'directCostPerUnit' ? template.costLabel : field.label}</span>
            <small>{field.help}</small>
            <span className="scenario-input-wrap">
              {field.prefix && <em aria-hidden="true">{field.prefix}</em>}
              <input aria-label={field.label} type="number" min="0" max="1000000" step={field.key === 'unitsPerMonth' ? '1' : '0.01'} value={inputs[field.key]} onChange={e => changeNumber(field.key, e.target.value)} />
            </span>
          </label>)}
          <label>
            <span>Scenario horizon</span>
            <small>Months to accumulate the same hypothetical monthly economics.</small>
            <select aria-label="Scenario horizon" value={inputs.months} onChange={e => changeNumber('months', e.target.value)}>
              {[1, 3, 6, 12, 24, 36].map(m => <option key={m} value={m}>{m} {m === 1 ? 'month' : 'months'}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="scenario-panel scenario-results" aria-labelledby="scenario-result-title">
        <div className="scenario-panel-head"><div><p className="tools-eyebrow">ILLUSTRATIVE RESULTS</p><h2 id="scenario-result-title">Unit economics</h2></div><TrendingUp size={22} aria-hidden="true" /></div>
        <div className="scenario-primary-result">
          <span>Estimated monthly operating surplus</span>
          <strong className={result.monthlySurplus < 0 ? 'scenario-negative' : undefined}>{usd(result.monthlySurplus)}</strong>
          <small>Before taxes, debt financing and any unmodeled expenses; not verified profit.</small>
        </div>
        <div className="scenario-metrics">
          <div><span>Monthly gross revenue</span><strong>{usd(result.monthlyRevenue)}</strong></div>
          <div><span>Monthly direct costs</span><strong>{usd(result.monthlyDirectCost)}</strong></div>
          <div><span>Monthly fixed costs</span><strong>{usd(inputs.fixedMonthlyCost)}</strong></div>
          <div><span>Contribution / {template.unit.replace(/s$/, '')}</span><strong>{usd(result.contributionPerUnit)}</strong></div>
          <div><span>Contribution margin</span><strong>{contributionPercent === null ? 'Unknown' : `${contributionPercent.toFixed(1)}%`}</strong></div>
          <div><span>Break-even monthly volume</span><strong>{result.breakEvenUnits === null ? 'Not attainable at this unit margin' : `${result.breakEvenUnits} ${template.unit}`}</strong></div>
        </div>
        <div className="scenario-period">
          <span>Operating surplus after one-time investment · {inputs.months} {inputs.months === 1 ? 'month' : 'months'}</span>
          <strong className={result.periodSurplusAfterInvestment < 0 ? 'scenario-negative' : undefined}>{usd(result.periodSurplusAfterInvestment)}</strong>
          <small>{inputs.upfrontInvestment > 0 ? result.paybackMonths === null ? 'At these assumptions, the investment does not pay back.' : `Simple investment payback: about ${result.paybackMonths} months, assuming constant monthly surplus.` : 'No up-front investment modeled.'}</small>
        </div>
      </section>
    </div>

    <section className="scenario-panel scenario-sensitivity">
      <div className="scenario-panel-head"><div><p className="tools-eyebrow">SENSITIVITY</p><h2>What if volume changes?</h2></div><span className="scenario-method-label">Illustrative −30% / base / +30%</span></div>
      <div className="scenario-table-wrap">
        <table>
          <thead><tr><th scope="col">Case</th><th scope="col">Monthly {template.unit}</th><th scope="col">Monthly revenue</th><th scope="col">Operating surplus / month</th><th scope="col">{inputs.months}-month surplus after investment</th></tr></thead>
          <tbody>{sensitivity.map(row => <tr key={row.name}><th scope="row">{row.name}</th><td>{row.units}</td><td>{usd(row.result.monthlyRevenue)}</td><td>{usd(row.result.monthlySurplus)}</td><td>{usd(row.result.periodSurplusAfterInvestment)}</td></tr>)}</tbody>
        </table>
      </div>
      <button type="button" className="scenario-method" aria-expanded={showMethod} onClick={() => setShowMethod(p => !p)}>Calculation method <ArrowUpRight size={15} aria-hidden="true" /></button>
      {showMethod && <div className="scenario-formula">
        <p>Monthly gross = volume × unit revenue. Direct costs = volume × unit cost. Monthly operating surplus = gross − direct costs − fixed costs. Period surplus = months × monthly surplus − one-time investment.</p>
        <p>Break-even volume = fixed monthly costs ÷ positive contribution per unit, rounded up. Simple payback = one-time investment ÷ positive monthly operating surplus, rounded up. The sensitivity table changes only volume by ±30%; all other inputs stay fixed. The model assumes constant economics, no taxes, no growth curve, no refunds, and no constraints on available capacity.</p>
      </div>}
    </section>
    <p className="scenario-disclaimer">These estimates are decision aids, not accounting reports, investment recommendations, or guarantees. Validate real sales, labor, direct costs, payment collections, taxes, capacity, and seasonality before acting.</p>
  </div>;
}

'use client';

import { useId, useState } from 'react';
import { money } from '@/lib/metrics';
import { chartPath, chartScale, chartValues, chartX } from '@/lib/chart-data';
import './workflows.css';

export type Series = { id: string; label: string; color: string; values: number[] };

/**
 * Revenue by business over time. Hover or focus a month to read the exact
 * figures; the legend and the table alternative below the chart carry the same
 * information without colour.
 */
export function LineChart({ series, labels }: { series: Series[]; labels: string[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const gradient = useId().replace(/:/g, '');
  const W = 640, H = 220, L = 46, R = 12, T = 14, B = 28;
  const normalized = series.map(s => ({ ...s, values: chartValues(s.values, labels.length) }));
  const allValues = normalized.flatMap(s => s.values);
  const { low, high, ticks } = chartScale(allValues);
  const x = (i: number) => chartX(i, labels.length, L, W - R);
  const y = (v: number) => T + (1 - (v - low) / (high - low)) * (H - T - B);
  const active = Math.max(0, Math.min(hover ?? labels.length - 1, labels.length - 1));
  const exactMoney = (value: number | null) => value === null ? 'Not recorded' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
  if (!labels.length || !allValues.some(v => v !== null)) return <div className="chart-empty"><p>No recorded values for this chart yet.</p></div>;

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Monthly revenue for ${series.map(s => s.label).join(', ')} over ${labels.length} months`}
        onPointerLeave={() => setHover(null)}
        onPointerMove={e => {
          const box = e.currentTarget.getBoundingClientRect();
          const ratio = ((e.clientX - box.left) / box.width * W - L) / (W - L - R);
          setHover(Math.max(0, Math.min(labels.length - 1, Math.round(ratio * (labels.length - 1)))));
        }}>
        <defs>
          {normalized.map(s => (
            <linearGradient key={s.id} id={`${gradient}-${s.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={s.color} stopOpacity="0.13" /><stop offset="1" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {ticks.map(t => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="chart-grid" />
            <text x={L - 8} y={y(t) + 4} textAnchor="end" className="chart-tick">{Math.abs(t) < 1 && t !== 0 ? exactMoney(t) : money(t)}</text>
          </g>
        ))}
        {labels.map((label, i) => (i % Math.ceil(labels.length / 6) === 0 || i === labels.length - 1) && (
          <text key={label + i} x={x(i)} y={H - 8} textAnchor="middle" className="chart-tick">{label}</text>
        ))}
        {normalized.map(s => (
          <g key={s.id}>
            {s.values.length > 1 && s.values.every(v => v !== null) && <path d={`${chartPath(s.values, x, y)} L${x(s.values.length - 1)} ${y(0)} L${x(0)} ${y(0)} Z`} fill={`url(#${gradient}-${s.id})`} />}
            <path d={chartPath(s.values, x, y)} fill="none" stroke={s.color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="chart-line" />
            {s.values.map((value, i) => value !== null && (labels.length === 1 || s.values[i - 1] === null || s.values[i + 1] === null) && <circle key={i} cx={x(i)} cy={y(value)} r="3" fill={s.color} />)}
          </g>
        ))}
        <line x1={x(active)} x2={x(active)} y1={T} y2={H - B} className="chart-cursor" />
        {normalized.map(s => s.values[active] !== null && <circle key={s.id} cx={x(active)} cy={y(s.values[active]!)} r="4.5" fill="var(--panel)" stroke={s.color} strokeWidth="2.2" />)}
      </svg>
      <div className="chart-readout" aria-live="polite">
        <strong>{labels[active]}</strong>
        {normalized.map(s => <span key={s.id}><i style={{ background: s.color }} />{s.label}<b>{exactMoney(s.values[active])}</b></span>)}
      </div>
      {labels.length > 1 && <label className="chart-period">Inspect period<input type="range" min="0" max={labels.length - 1} value={active} aria-valuetext={labels[active]} onChange={event => setHover(Number(event.target.value))} /></label>}
      <details className="chart-table"><summary>View chart data</summary><div className="tablewrap"><table className="table"><caption>Monthly revenue in US dollars. Missing values are not recorded, not zero.</caption><thead><tr><th scope="col">Period</th>{normalized.map(s => <th scope="col" key={s.id} className="num">{s.label}</th>)}</tr></thead><tbody>{labels.map((label, index) => <tr key={`${label}-${index}`}><th scope="row">{label}</th>{normalized.map(s => <td key={s.id} className="num">{exactMoney(s.values[index])}</td>)}</tr>)}</tbody></table></div></details>
    </div>
  );
}

export function Sparkline({ values, color }: { values: number[]; color: string }) {
  const W = 96, H = 30;
  const normalized = chartValues(values, values.length);
  const known = normalized.filter((v): v is number => v !== null);
  if (!known.length) return <span className="sparkline" aria-hidden="true" />;
  const min = Math.min(...known), max = Math.max(...known);
  const span = max - min || 1;
  const x = (i: number) => chartX(i, values.length, 2, W - 2);
  const y = (v: number) => min === max ? H / 2 : H - 3 - ((v - min) / span) * (H - 6);
  const d = chartPath(normalized, x, y);
  return <svg viewBox={`0 0 ${W} ${H}`} className="sparkline" preserveAspectRatio="none" aria-hidden="true"><path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />{known.length === 1 && <circle cx={x(normalized.findIndex(v => v !== null))} cy={H / 2} r="2" fill={color} />}</svg>;
}

/** A dashed ghost curve for panels whose data source is not connected yet. It is decoration, not data. */
export function GhostChart() {
  return (
    <svg viewBox="0 0 640 180" className="ghost-chart" aria-hidden="true">
      <path d="M0 150 C 90 140, 130 96, 210 104 S 340 60, 420 72 S 560 30, 640 38" fill="none" strokeDasharray="5 8" />
      <path d="M0 162 C 110 158, 160 130, 240 134 S 380 100, 460 108 S 580 76, 640 84" fill="none" strokeDasharray="5 8" />
    </svg>
  );
}

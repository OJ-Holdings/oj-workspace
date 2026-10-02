'use client';

import { useId, useState } from 'react';
import { money } from '@/lib/metrics';

export type Series = { id: string; label: string; color: string; values: number[] };

function path(values: number[], x: (i: number) => number, y: (v: number) => number) {
  return values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
}

/**
 * Revenue by business over time. Hover or focus a month to read the exact
 * figures; the legend and the table alternative below the chart carry the same
 * information without colour.
 */
export function LineChart({ series, labels }: { series: Series[]; labels: string[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const gradient = useId().replace(/:/g, '');
  const W = 640, H = 220, L = 46, R = 12, T = 14, B = 28;
  // Round the top of the scale up to a tidy figure so the axis reads $0 / $4K / $8K / $12K, not $3,622.
  const peak = Math.max(1, ...series.flatMap(s => s.values));
  const unit = Math.pow(10, Math.floor(Math.log10(peak / 3)));
  const step = [1, 2, 2.5, 5, 10].map(n => n * unit).find(n => n * 3 >= peak) ?? unit * 10;
  const max = step * 3;
  const x = (i: number) => L + (i / Math.max(1, labels.length - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const ticks = [0, 1, 2, 3].map(t => step * t);
  const active = hover ?? labels.length - 1;

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
          {series.map(s => (
            <linearGradient key={s.id} id={`${gradient}-${s.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={s.color} stopOpacity="0.13" /><stop offset="1" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {ticks.map(t => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="chart-grid" />
            <text x={L - 8} y={y(t) + 4} textAnchor="end" className="chart-tick">{money(t)}</text>
          </g>
        ))}
        {labels.map((label, i) => (i % Math.ceil(labels.length / 6) === 0 || i === labels.length - 1) && (
          <text key={label + i} x={x(i)} y={H - 8} textAnchor="middle" className="chart-tick">{label}</text>
        ))}
        {series.map(s => (
          <g key={s.id}>
            <path d={`${path(s.values, x, y)} L${x(s.values.length - 1)} ${H - B} L${x(0)} ${H - B} Z`} fill={`url(#${gradient}-${s.id})`} />
            <path d={path(s.values, x, y)} fill="none" stroke={s.color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="chart-line" />
          </g>
        ))}
        <line x1={x(active)} x2={x(active)} y1={T} y2={H - B} className="chart-cursor" />
        {series.map(s => <circle key={s.id} cx={x(active)} cy={y(s.values[active])} r="4.5" fill="var(--panel)" stroke={s.color} strokeWidth="2.2" />)}
      </svg>
      <div className="chart-readout" aria-live="polite">
        <strong>{labels[active]}</strong>
        {series.map(s => <span key={s.id}><i style={{ background: s.color }} />{s.label}<b>{money(s.values[active])}</b></span>)}
      </div>
    </div>
  );
}

export function Sparkline({ values, color }: { values: number[]; color: string }) {
  const W = 96, H = 30;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const d = path(values, i => (i / (values.length - 1)) * W, v => H - 3 - ((v - min) / span) * (H - 6));
  return <svg viewBox={`0 0 ${W} ${H}`} className="sparkline" preserveAspectRatio="none" aria-hidden="true"><path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" /></svg>;
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

'use client';

import NumberFlow from '@number-flow/react';
import type { ReactNode } from 'react';
import type { GrowthStore } from './useGrowth';
import type { StatusTone } from '@/lib/email-engine';

/** A progress ring with the count in the middle. Decoration only: the text carries the meaning. */
export function Ring({ value, max, size = 132, stroke = 11, tone = 'accent', label }: { value: number; max: number; size?: number; stroke?: number; tone?: 'accent' | 'good' | 'bad'; label: string }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, pct = max > 0 ? Math.min(value / max, 1) : 0;
  return <div className={`gx-ring is-${tone}`} style={{ width: size, height: size }} role="img" aria-label={label}>
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle className="gx-ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" />
      <circle className="gx-ring-fill" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
    <div className="gx-ring-center" aria-hidden="true"><b><NumberFlow value={value} /></b><span>of {max}</span></div>
  </div>;
}

export function Pill({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return <span className={`gx-pill is-${tone}`}><i aria-hidden="true" />{children}</span>;
}

export function Stat({ label, value, note, format }: { label: string; value: number | null; note?: ReactNode; format?: 'percent' }) {
  return <div className="gx-stat"><span>{label}</span>
    <strong>{value === null ? '-' : format === 'percent' ? <NumberFlow value={value} format={{ style: 'percent', maximumFractionDigits: 0 }} /> : <NumberFlow value={value} />}</strong>
    {note && <small>{note}</small>}</div>;
}

/** Shown when a screen needs a database update a founder has not applied yet. */
export function InstallNote({ title, file, what }: { title: string; file: string; what: string }) {
  return <section className="panel gx-install" aria-labelledby="gx-install-title">
    <header className="panel-head"><h2 id="gx-install-title">{title}</h2></header>
    <p><b>One step left to switch this on.</b> {what}</p>
    <p className="quiet">A founder reviews and applies <code>{file}</code> to the OJ Supabase project. It only adds new tables and functions and changes no existing data. Nothing here shows made-up numbers while it waits.</p>
  </section>;
}

/** Common loading / failure states for every growth screen. Returns the screen body once data is ready. */
export function Gate({ g, children }: { g: GrowthStore; children: (data: NonNullable<GrowthStore['data']>) => ReactNode }) {
  if (g.status === 'loading' && !g.data) return <div className="loading" aria-busy="true" />;
  if (g.status === 'no-prospects') return <section className="panel"><h2>Outreach is not installed</h2><p>The prospect tables are missing from this workspace. Apply <code>supabase/schemas/outreach-pipeline.sql</code> first.</p></section>;
  if (!g.data) return <section className="panel" role="alert"><h2>This could not load</h2><p>Nothing is shown rather than out-of-date numbers.</p><button className="primary" onClick={g.reload}>Try again</button></section>;
  return <>{g.mode === 'preview' && <p className="outreach-preview-note">Fictional preview. Every name, count and message here is made up, and nothing can be changed.</p>}{g.status === 'error' && <p className="outreach-error" role="status">Could not refresh. Showing what loaded earlier.</p>}{children(g.data)}</>;
}

export const clock = (d: Date) => d.toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' });

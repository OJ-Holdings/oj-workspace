'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Flag, Lock, Wind, X } from 'lucide-react';
import type { Dashboard } from '@/lib/dashboard';
import { camps, expedition, SUMMIT_ALTITUDE, SUMMIT_COMPANIES, type Camp, type Expedition, type Weather } from '@/lib/hyperborea';
import { codex, type Chapter } from '@/lib/hyperborea-codex';

type Props = { data: Dashboard | null; now: Date | null; companies: number; coreVentures: readonly string[]; base: string; mode: 'preview' | 'live' };

const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: n >= 100_000 ? 'compact' : 'standard', maximumFractionDigits: n >= 100_000 ? 1 : 0 }).format(n);
const metres = (n: number) => `${Math.round(n).toLocaleString('en-US')} m`;
const chicagoToday = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(d);

// ---- scene geometry (SVG units, viewBox 1000 x 640) ----
const FOOT = 590, PEAK = 70;
const yFor = (alt: number) => FOOT - (alt / SUMMIT_ALTITUDE) * (FOOT - PEAK);
const campX: Record<Camp['id'], number> = { base: 300, camp1: 470, camp2: 360, camp3: 560, camp4: 470, deathzone: 540, summit: 560 };
const routePoints = camps.map(c => ({ id: c.id, x: campX[c.id], y: yFor(c.altitude), alt: c.altitude }));
function pointAt(alt: number) {
  const a = Math.max(0, Math.min(alt, SUMMIT_ALTITUDE));
  for (let i = 1; i < routePoints.length; i++) {
    const p0 = routePoints[i - 1], p1 = routePoints[i];
    if (a <= p1.alt) { const t = (a - p0.alt) / (p1.alt - p0.alt || 1); return { x: p0.x + t * (p1.x - p0.x), y: p0.y + t * (p1.y - p0.y) }; }
  }
  return routePoints[routePoints.length - 1];
}
const MASSIF = 'M0,640 L90,560 L150,520 L210,455 L250,430 L300,370 L340,330 L380,270 L420,230 L470,160 L510,120 L560,70 L600,115 L640,150 L690,230 L730,270 L790,360 L850,430 L920,520 L1000,580 L1000,640 Z';
const SNOW = 'M412,238 L470,160 L510,120 L560,70 L600,115 L640,150 L690,230 L664,214 L632,232 L604,200 L574,226 L544,194 L506,230 L466,212 Z';
const RANGE_FAR = 'M0,640 L0,420 L80,380 L160,300 L230,340 L300,250 L360,300 L420,260 L520,330 L620,240 L700,290 L780,210 L860,280 L940,250 L1000,300 L1000,640 Z';
const RANGE_NEAR = 'M0,640 L0,540 L120,470 L200,500 L280,450 L360,520 L640,520 L720,470 L820,500 L900,450 L1000,490 L1000,640 Z';

const weatherWord: Record<Weather, string> = { clear: 'Clear skies', wind: 'High wind', storm: 'Storm', unknown: 'Fog: no momentum on record' };
const flakeCount: Record<Weather, number> = { clear: 14, wind: 46, storm: 110, unknown: 30 };
const rand = (i: number, salt: number) => (((i + 1) * 9301 + salt * 49297) % 233280) / 233280;

function chapterOpen(ch: Chapter, ex: Expedition) {
  if (ch.unlock === 'beyond') return ex.summitReached;
  return ex.altitude >= (camps.find(c => c.id === ch.unlock)?.altitude ?? Infinity);
}

export function HyperboreaView({ data, now, companies, coreVentures, base, mode }: Props) {
  const ex = useMemo(() => data && now ? expedition({ finance: data.finance, mercury: data.mercury, today: chicagoToday(now), companies, coreVentures }) : null, [data, now, companies, coreVentures]);
  const dialog = useRef<HTMLDialogElement>(null);
  const [chapter, setChapter] = useState('prologue');

  if (!ex) return <div className="hb" data-weather="unknown"><p className="hb-loading">Reading the mountain…</p></div>;

  const me = pointAt(ex.altitude), ghost = pointAt(ex.ghost.altitude);
  const flakes = Array.from({ length: flakeCount[ex.weather.weather] }, (_, i) => i);
  const active = codex.find(c => c.id === chapter) ?? codex[0];
  const activeOpen = chapterOpen(active, ex);
  const nextCampForChapter = (ch: Chapter) => ch.unlock === 'beyond' ? 'the summit' : camps.find(c => c.id === ch.unlock)?.name ?? '';
  const o = ex.oxygen;

  return (
    <div className="hb" data-weather={ex.weather.weather} data-summit={ex.summitReached ? 'reached' : 'shrouded'}>
      <header className="hb-head">
        <div>
          <p className="hb-kicker">OJ Holdings · Founders only</p>
          <h1>Hyperborea</h1>
          <p className="hb-sub">Beyond the North Wind. $100M a year and ten companies by October 27, 2046.</p>
        </div>
        <div className="hb-head-side">
          <div className="hb-clock" aria-label="Expedition clock">
            <span>Expedition day</span>
            <strong>{ex.clock.day.toLocaleString('en-US')} <small>of {ex.clock.totalDays.toLocaleString('en-US')}</small></strong>
            <span>{ex.clock.daysLeft.toLocaleString('en-US')} days to the summit window</span>
          </div>
          <button type="button" className="hb-codex-btn" onClick={() => dialog.current?.showModal()}><BookOpen size={17} aria-hidden="true" /> Codex</button>
        </div>
      </header>

      {mode === 'live' && !ex.hasRecords && <p className="hb-notice">No revenue recorded yet, so the expedition stands at base camp. <Link href={`${base}/finance`}>Record income in Money</Link> and the climb starts.</p>}

      <section className="hb-scene" aria-label={`Mountain: the expedition is at ${metres(ex.altitude)}, ${ex.camp.current.name}. Weather: ${weatherWord[ex.weather.weather]}.`}>
        <svg viewBox="0 0 1000 640" role="img" aria-hidden="true" preserveAspectRatio="xMidYMax slice">
          <defs>
            <linearGradient id="hb-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" className="hb-sky-top" /><stop offset="0.55" className="hb-sky-mid" /><stop offset="1" className="hb-sky-low" />
            </linearGradient>
            <linearGradient id="hb-rock" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" className="hb-rock-lit" /><stop offset="1" className="hb-rock-dark" />
            </linearGradient>
            <radialGradient id="hb-sun-glow"><stop offset="0" className="hb-sun-core" /><stop offset="1" className="hb-sun-edge" /></radialGradient>
            <filter id="hb-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14" /></filter>
          </defs>
          <rect width="1000" height="640" fill="url(#hb-sky)" />
          <circle className="hb-sun" cx="790" cy="90" r="120" fill="url(#hb-sun-glow)" />
          <path d={RANGE_FAR} className="hb-range-far" />
          <path d={MASSIF} fill="url(#hb-rock)" className="hb-massif" />
          <path d="M560,70 L600,115 L640,150 L690,230 L730,270 L790,360 L850,430 L920,520 L1000,580 L1000,640 L640,640 Z" className="hb-shade" />
          <path d={SNOW} className="hb-snowcap" />
          <path d={RANGE_NEAR} className="hb-range-near" />
          <line x1="0" x2="1000" y1={yFor(8000)} y2={yFor(8000)} className="hb-deathline" />
          <text x="18" y={yFor(8000) - 8} className="hb-deathline-label">8,000 m · Death Zone</text>
          <polyline points={routePoints.map(p => `${p.x},${p.y}`).join(' ')} className="hb-route" />
          <polyline points={[...routePoints.filter(p => p.alt <= ex.altitude).map(p => `${p.x},${p.y}`), `${me.x},${me.y}`].join(' ')} className="hb-route-done" />
          {routePoints.map((p, i) => {
            const c = camps[i]; const reached = ex.altitude >= c.altitude; const left = i % 2 === 1;
            return <g key={p.id} className={reached ? 'hb-camp is-reached' : 'hb-camp'}>
              {c.id !== 'summit' && <><circle cx={p.x} cy={p.y} r="6" />
              <text x={left ? p.x - 14 : p.x + 14} y={p.y + 4} textAnchor={left ? 'end' : 'start'}>{c.name}</text></>}
              {reached && c.id !== 'summit' && c.id !== 'base' && <path d={`M${p.x},${p.y - 6} L${p.x},${p.y - 26} L${p.x + 14},${p.y - 21} L${p.x},${p.y - 16}`} className="hb-flag" />}
            </g>;
          })}
          <g className="hb-shroud" filter="url(#hb-blur)">
            <ellipse cx="560" cy="80" rx="150" ry="46" /><ellipse cx="500" cy="110" rx="110" ry="34" /><ellipse cx="630" cy="104" rx="120" ry="38" />
          </g>
          <text x="560" y="40" textAnchor="middle" className="hb-summit-label">{ex.summitReached ? 'SUMMIT' : 'SUMMIT · 8,849 m'}</text>
          <g className="hb-ghost" transform={`translate(${ghost.x} ${ghost.y})`}>
            <circle r="9" /><text x="14" y="26">Pace for 2046</text>
          </g>
          <g className="hb-me" transform={`translate(${me.x} ${me.y})`}>
            <circle r="18" className="hb-me-pulse" /><circle r="8" className="hb-me-dot" />
            <text x="0" y="-30" textAnchor="middle">OJ · {metres(ex.altitude)}</text>
          </g>
        </svg>
        <div className="hb-fog" aria-hidden="true" />
        <div className="hb-snow" aria-hidden="true">
          {flakes.map(i => <span key={i} style={{ ['--x' as string]: `${(rand(i, 1) * 110 - 5).toFixed(2)}%`, ['--s' as string]: `${(1.5 + rand(i, 2) * 3).toFixed(1)}px`, ['--d' as string]: `${(ex.weather.weather === 'storm' ? 2.2 : 5) + rand(i, 3) * 5}s`, ['--delay' as string]: `${-rand(i, 4) * 10}s`, ['--o' as string]: (0.35 + rand(i, 5) * 0.6).toFixed(2) }} />)}
        </div>
        <p className="hb-weather"><Wind size={15} aria-hidden="true" /> {weatherWord[ex.weather.weather]}{ex.weather.change !== null && ` · ${ex.weather.change >= 0 ? '+' : ''}${Math.round(ex.weather.change * 100)}% recorded revenue, last 90 days vs the 90 before`}</p>
      </section>

      <section className="hb-stats" aria-label="Expedition instruments">
        <div className="hb-stat">
          <span>Altitude</span><strong>{metres(ex.altitude)}</strong>
          <small>{ex.hasRecords ? `${money(ex.revenue)} recorded revenue, last 12 months` : 'No revenue recorded yet'}</small>
        </div>
        <div className="hb-stat">
          <span>Camp</span><strong>{ex.camp.current.name}</strong>
          <small>{ex.camp.next ? `${money(ex.toNext ?? 0)} a year to ${ex.camp.next.name}` : 'Every camp reached'}</small>
        </div>
        <div className="hb-stat">
          <span>Pace</span>
          <strong>{ex.ghost.ahead === null ? 'Not started' : ex.ghost.gap === 0 ? 'On the line' : `${ex.ghost.ahead ? 'Ahead' : 'Behind'} ${metres(Math.abs(ex.ghost.gap))}`}</strong>
          <small>Summit by 2046 needs {Math.round(ex.ghost.requiredGrowth * 100)}% growth a year, every year, from {money(ex.ghost.start)}</small>
        </div>
        <div className="hb-stat">
          <span>Oxygen</span>
          {o.state === 'known' ? <>
            <strong>{o.months === null ? money(o.cash) : `${o.months.toFixed(1)} months`}</strong>
            {o.level !== null && <div className={o.level < 0.25 ? 'hb-o2 is-low' : 'hb-o2'} role="meter" aria-valuemin={0} aria-valuemax={12} aria-valuenow={Math.min(o.months ?? 0, 12)} aria-label="Months of runway"><i style={{ width: `${o.level * 100}%` }} /></div>}
            <small>{o.months === null ? o.detail : `${money(o.cash)} cash · ${money(o.burn ?? 0)} recorded costs a month`}</small>
          </> : <><strong>Unread</strong><small>{o.detail}</small></>}
        </div>
        <div className="hb-stat">
          <span>Banners</span><strong>{ex.companies} <small>of {SUMMIT_COMPANIES}</small></strong>
          <div className="hb-banners" aria-hidden="true">{Array.from({ length: SUMMIT_COMPANIES }, (_, i) => <Flag key={i} size={14} className={i < ex.companies ? 'is-planted' : ''} />)}</div>
          <small>Operating companies under OJ Holdings</small>
        </div>
      </section>

      <div className="hb-columns">
        <section className="hb-panel" aria-labelledby="hb-route-title">
          <h2 id="hb-route-title">The route</h2>
          <ol className="hb-camps">
            {[...camps].reverse().map(c => {
              const state = ex.camp.current.id === c.id ? 'is-current' : ex.altitude >= c.altitude ? 'is-reached' : '';
              return <li key={c.id} className={state}>
                <div className="hb-camp-row"><b>{c.name}</b><span>{metres(c.altitude)}{c.revenue ? ` · ${money(c.revenue)}/yr` : ''}</span></div>
                <p>{c.era}</p>
                <ul>{c.gates.map(g => <li key={g}>{g}</li>)}</ul>
              </li>;
            })}
          </ol>
          <p className="hb-fine">Gates are the objectives for each camp. Marking them done arrives with the next, staged database step.</p>
        </section>

        <section className="hb-panel" aria-labelledby="hb-badges-title">
          <h2 id="hb-badges-title">Achievements</h2>
          <ul className="hb-badges">
            {ex.achievements.map(a => <li key={a.id} className={a.earned ? 'is-earned' : a.earned === null ? 'is-pending' : ''}>
              <b>{a.name}</b><span>{a.detail}</span>
              <small>{a.earned ? `Earned${a.on ? ` · ${a.on}` : ''}` : a.earned === null ? 'Founder-confirmed' : 'Not yet'}</small>
            </li>)}
          </ul>
        </section>
      </div>

      <dialog ref={dialog} className="hb-codex" aria-labelledby="hb-codex-title" onClick={e => { if (e.target === dialog.current) dialog.current?.close(); }}>
        <div className="hb-codex-inner">
          <header>
            <h2 id="hb-codex-title"><BookOpen size={18} aria-hidden="true" /> The Codex of Hyperborea</h2>
            <button type="button" className="icon-button" aria-label="Close the Codex" onClick={() => dialog.current?.close()}><X size={18} /></button>
          </header>
          <div className="hb-codex-body">
            <nav aria-label="Chapters">
              {codex.map(ch => {
                const open = chapterOpen(ch, ex);
                return <button key={ch.id} type="button" aria-current={chapter === ch.id} className={open ? '' : 'is-locked'} onClick={() => setChapter(ch.id)}>
                  <small>{ch.numeral}</small><span>{open && !ch.sealed ? ch.title : ch.sealed ? 'Sealed' : '▇▇▇▇ ▇▇▇▇▇▇'}</span>
                  {(!open || ch.sealed) && <Lock size={13} aria-hidden="true" />}
                </button>;
              })}
            </nav>
            <article>
              <p className="hb-codex-numeral">{active.numeral}</p>
              {active.sealed ? <>
                <h3>The Summit</h3>
                <div className="hb-seal" aria-hidden="true">OJ</div>
                {active.paragraphs.map(p => <p key={p}>{p}</p>)}
                <p className="hb-fine">The founders write this by hand, in one sitting, together. It is stored as a sealed record in a later, staged step and opens only on arrival.</p>
              </> : activeOpen ? <>
                <h3>{active.title}</h3>
                {active.paragraphs.map(p => <p key={p}>{p}</p>)}
              </> : <>
                <h3 className="hb-redacted">▇▇▇▇▇▇ ▇▇▇▇</h3>
                <p>This page is sealed. Reach {nextCampForChapter(active)} to read it.</p>
              </>}
            </article>
          </div>
        </div>
      </dialog>
    </div>
  );
}

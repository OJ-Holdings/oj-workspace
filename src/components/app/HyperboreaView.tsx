'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { BookOpen, ChevronDown, ChevronUp, Crosshair, Lock, Volume2, VolumeX, Wind, X } from 'lucide-react';
import type { Dashboard } from '@/lib/dashboard';
import { campFor, camps, expedition, SUMMIT_ALTITUDE, type Expedition, type Weather } from '@/lib/hyperborea';
import { codex, type Chapter } from '@/lib/hyperborea-codex';
import type { SceneHandle, SceneInput } from './hyperborea/scene';
import { ExpeditionDesk } from './hyperborea/ExpeditionDesk';
import { altitudeHistory, objectives } from '@/lib/hyperborea-journal';

type Props = { data: Dashboard | null; now: Date | null; companies: number; coreVentures: readonly string[]; businesses: { id: string; name: string }[]; base: string; mode: 'preview' | 'live' };

const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: n >= 100_000 ? 'compact' : 'standard', maximumFractionDigits: n >= 100_000 ? 1 : 0 }).format(n);
const metres = (n: number) => `${Math.round(n).toLocaleString('en-US')} m`;
const chicagoToday = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(d);
const weatherWord: Record<Weather, string> = { clear: 'Clear night', wind: 'High wind', storm: 'Storm on the mountain', unknown: 'Whiteout. No momentum on record' };
const pct = (m: number) => `${(Math.min(Math.max(m / SUMMIT_ALTITUDE, 0), 1) * 100).toFixed(2)}%`;

function chapterOpen(ch: Chapter, ex: Expedition) {
  if (ch.unlock === 'beyond') return ex.summitReached;
  return ex.altitude >= (camps.find(c => c.id === ch.unlock)?.altitude ?? Infinity);
}

/** Where the camera is looking, said plainly relative to the expedition. */
function viewWords(view: number, ex: Expedition) {
  const gap = Math.round(view - ex.altitude);
  const zone = view >= 8000 && view < SUMMIT_ALTITUDE - 40 ? 'The Death Zone' : campFor(view).current.name;
  if (Math.abs(gap) < 40) return { zone, where: 'The expedition stands here' };
  return { zone, where: `${metres(Math.abs(gap))} ${gap > 0 ? 'above' : 'below'} the expedition` };
}

export function HyperboreaView({ data, now, companies, coreVentures, businesses, base, mode }: Props) {
  const ventureKey = coreVentures.join(',');
  const ex = useMemo(() => data && now ? expedition({ finance: data.finance, mercury: data.mercury, today: chicagoToday(now), companies, coreVentures: ventureKey.split(',').filter(Boolean) }) : null, [data, now, companies, ventureKey]);
  const dialog = useRef<HTMLDialogElement>(null);
  const stage = useRef<HTMLElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const labelLayer = useRef<HTMLDivElement>(null);
  const handle = useRef<SceneHandle | null>(null);
  const [chapter, setChapter] = useState('prologue');
  const [view, setView] = useState<number | null>(null);
  const [sceneState, setSceneState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [sound, setSound] = useState(false);
  const [selection, setSelection] = useState<string | null>(null);
  const [overview, setOverview] = useState(false);
  const inspectAltitude = useCallback((altitude: number) => { handle.current?.look(altitude); setOverview(false); }, []);

  const sceneInput = useMemo<SceneInput | null>(() => ex && {
    altitude: ex.altitude, ghost: ex.ghost.altitude, weather: ex.weather.weather, summitReached: ex.summitReached, summitMetres: SUMMIT_ALTITUDE,
    camps: camps.map(c => ({ id: c.id, name: c.name, altitude: c.altitude, reached: ex.altitude >= c.altitude })),
    waypoints: data ? [...altitudeHistory(data.finance, ex.today).slice(-12).map(h => ({ id: 'history:' + h.through, altitude: h.altitude, label: new Date(h.through + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }) })), ...objectives(data.finance, ex.today, ex.ghost.start).filter(o => !o.isCamp).map(o => ({ id: 'goal:' + o.revenue, altitude: o.altitude, label: o.name }))] : [],
  }, [ex, data]);
  const nextRidge = useMemo(() => ex && data ? objectives(data.finance, ex.today, ex.ghost.start)[0] ?? null : null, [ex, data]);
  const inputKey = sceneInput ? JSON.stringify(sceneInput) : '';
  const latest = useRef(sceneInput); latest.current = sceneInput;

  // Mount the 3D scene once the figures are known; tear it down on leave.
  const ready = Boolean(sceneInput);
  useEffect(() => {
    if (!ready || !host.current || !labelLayer.current) return;
    let cancelled = false;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    import('./hyperborea/scene').then(({ mountScene }) => {
      if (cancelled || !host.current || !labelLayer.current || !latest.current) return;
      // Let the loading line paint before the terrain is generated.
      requestAnimationFrame(() => {
        if (cancelled || !host.current || !labelLayer.current || !latest.current) return;
        try {
          handle.current = mountScene(host.current, labelLayer.current, latest.current, { reducedMotion, onView: setView, onInspect: setSelection });
          setSceneState('ready');
        } catch { setSceneState('failed'); }
      });
    }).catch(() => { if (!cancelled) setSceneState('failed'); });
    return () => { cancelled = true; handle.current?.dispose(); handle.current = null; };
  }, [ready]);
  useEffect(() => { if (handle.current && latest.current) handle.current.set(latest.current); }, [inputKey]);

  if (!ex) return <div className="hb" data-weather="unknown"><p className="hb-loading">Reading the mountain…</p></div>;

  const active = codex.find(c => c.id === chapter) ?? codex[0];
  const activeOpen = chapterOpen(active, ex);
  const unlockName = (ch: Chapter) => ch.unlock === 'beyond' ? 'the summit' : camps.find(c => c.id === ch.unlock)?.name ?? '';
  const viewing = view ?? ex.altitude;
  const words = viewWords(viewing, ex);
  const deathZone = Math.min(Math.max((viewing - 7800) / 500, 0), 1);
  const toggleSound = async () => { const on = await handle.current?.setSound(!sound); setSound(Boolean(on)); };

  return (
    <div className="hb" data-weather={ex.weather.weather} data-summit={ex.summitReached ? 'reached' : 'shrouded'}>
      <section ref={stage} className="hb3" data-state={sceneState} aria-label={`Hyperborea. The expedition is at ${metres(ex.altitude)}, ${ex.camp.current.name}. ${weatherWord[ex.weather.weather]}.`}>
        <div ref={host} className="hb3-canvas" />
        <div ref={labelLayer} className="hb3-labels" />
        <div className="hb3-vignette" aria-hidden="true" />
        <div className="hb3-deathzone" aria-hidden="true" style={{ opacity: deathZone }} />
        {sceneState === 'loading' && <p className="hb3-status">Reading the mountain…</p>}
        {sceneState === 'failed' && <p className="hb3-status">This browser can’t draw the mountain in 3D. The instruments below still read live.</p>}

        <header className="hb3-title">
          <h1>Hyperborea</h1>
          <p>Expedition day {ex.clock.day.toLocaleString('en-US')} of {ex.clock.totalDays.toLocaleString('en-US')}. {ex.clock.daysLeft.toLocaleString('en-US')} days until the summit window closes.</p>
        </header>
        <div className="hb3-tools">
          <button type="button" className="hb3-btn" onClick={toggleSound} aria-pressed={sound} disabled={sceneState !== 'ready'}>
            {sound ? <Volume2 size={16} aria-hidden="true" /> : <VolumeX size={16} aria-hidden="true" />}<span>{sound ? 'Wind on' : 'Wind off'}</span>
          </button>
          <button type="button" className="hb3-btn hb3-codex" onClick={() => dialog.current?.showModal()}><BookOpen size={16} aria-hidden="true" /><span>Codex</span></button>
        </div>

        {nextRidge && <aside className="hb3-next" aria-label="Next objective">
          <span>Next ridgeline</span>
          <b>{nextRidge.name}</b>
          <div className="hb-o2" aria-hidden="true"><i style={{ width: `${Math.min(ex.revenue / nextRidge.revenue, 1) * 100}%` }} /></div>
          <small>{money(nextRidge.gap)} more a year, about {money(nextRidge.monthly)} a month to hold it</small>
        </aside>}
        <nav className="hb3-gauge" aria-label="Altitude gauge: jump the view to a camp">
          <div className="hb3-gauge-rail" aria-hidden="true">
            <i className="hb3-gauge-done" style={{ height: pct(ex.altitude) }} />
            <i className="hb3-gauge-death" style={{ bottom: pct(8000) }} />
          </div>
          {camps.map(c => (
            <button key={c.id} type="button" className={ex.altitude >= c.altitude ? 'hb3-tick is-reached' : 'hb3-tick'} style={{ bottom: pct(c.altitude) }} onClick={() => { handle.current?.look(c.altitude); setOverview(false); setSelection('camp:' + c.id); }}>
              <span>{c.id === 'base' ? 'Base Camp' : c.id === 'summit' ? 'Summit' : c.name.replace(/^Camp [IV]+: /, '')}</span>
            </button>
          ))}
          <i className="hb3-mark is-ghost" style={{ bottom: pct(ex.ghost.altitude) }} aria-hidden="true" title="Pace for 2046" />
          <i className="hb3-mark is-me" style={{ bottom: pct(ex.altitude) }} aria-hidden="true" />
          <i className="hb3-mark is-view" style={{ bottom: pct(viewing) }} aria-hidden="true" />
        </nav>

        <div className="hb3-readout" aria-live="polite">
          <strong>{metres(viewing)}</strong>
          <span>{words.zone}</span>
          <small>{words.where}</small>
        </div>
        <div className="hb3-controls">
          <button type="button" className="hb3-btn" onClick={() => { handle.current?.nudge(400); setOverview(false); }} disabled={sceneState !== 'ready'}><ChevronUp size={16} aria-hidden="true" /><span>Look higher</span></button>
          <button type="button" className="hb3-btn" onClick={() => { handle.current?.nudge(-400); setOverview(false); }} disabled={sceneState !== 'ready'}><ChevronDown size={16} aria-hidden="true" /><span>Look lower</span></button>
          <button type="button" className="hb3-btn" aria-pressed={overview} onClick={() => { const next = !overview; handle.current?.overview(next); setOverview(next); }} disabled={sceneState !== 'ready'}>{overview ? 'Return to route' : 'Whole mountain'}</button>
          <button type="button" className="hb3-btn" onClick={() => setSelection('climb')}>Inspect this climb</button>
          <button type="button" className="hb3-btn" onClick={() => { handle.current?.recenter(); setOverview(false); }} disabled={sceneState !== 'ready'}><Crosshair size={16} aria-hidden="true" /><span>Back to the expedition</span></button>
        </div>
        <p className="hb3-weather"><Wind size={14} aria-hidden="true" /> {weatherWord[ex.weather.weather]}{ex.weather.change !== null && `, ${ex.weather.change >= 0 ? '+' : ''}${Math.round(ex.weather.change * 100)}% revenue over the last 90 days`}</p>
        <p className="hb3-hint" aria-hidden="true">Select a trail marker to inspect. Drag gently to explore.</p>
      </section>

      {mode === 'live' && !ex.hasRecords && <p className="hb-notice">No revenue recorded yet, so the expedition stands at base camp. <Link href={`${base}/finance`}>Record income in Money</Link> and the climb starts.</p>}

      {data && <ExpeditionDesk ex={ex} data={data} businesses={businesses} base={base} selection={selection} onSelect={setSelection} onLook={inspectAltitude} />}

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
                <p>This page is sealed. Reach {unlockName(active)} to read it.</p>
              </>}
            </article>
          </div>
        </div>
      </dialog>
    </div>
  );
}

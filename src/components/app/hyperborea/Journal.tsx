'use client';

import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { FinanceEntry } from '@/lib/dashboard';
import { camps, type Expedition } from '@/lib/hyperborea';
import { altitudeHistory, badgeProgress, breakdown, campSchedule, milestones, monthLabel, objectives, totals, type Milestone } from '@/lib/hyperborea-journal';

type Props = { ex: Expedition; finance: readonly FinanceEntry[]; businesses: { id: string; name: string }[] };

const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: n >= 100_000 ? 'compact' : 'standard', maximumFractionDigits: n >= 100_000 ? 1 : 0 }).format(n);
const metres = (n: number) => `${Math.round(n).toLocaleString('en-US')} m`;
const pct = (n: number) => `${Math.round(n * 100)}%`;
const date = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const monthYear = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const span = (days: number) => days < 45 ? `${days} days` : days < 730 ? `${Math.round(days / 30.4)} months` : `${(days / 365.25).toFixed(1)} years`;
const kindWord: Record<Milestone['kind'], string> = { first: 'First', lifetime: 'Total', month: 'Month', record: 'Record', camp: 'Camp' };

/** The climb so far, why OJ stands where it does, and what to take next. */
export function Journal({ ex, finance, businesses }: Props) {
  const names = Object.fromEntries(businesses.map(b => [b.id, b.name]));
  const history = altitudeHistory(finance, ex.today);
  const log = milestones(finance, ex.today, names).reverse();
  const t = totals(finance, ex.today);
  const why = breakdown(finance, ex.today, businesses.map(b => b.id), names);
  const next = objectives(finance, ex.today, ex.ghost.start);
  const schedule = campSchedule(ex.ghost.start);
  const badges = badgeProgress(finance, ex.today).filter(b => b.progress < 1);
  const nextCamp = ex.camp.next;

  if (!ex.hasRecords) return (
    <section className="hb-panel hb-journal-empty">
      <h2>The journal is empty</h2>
      <p>Nothing has been recorded yet, so there is no climb to read. Every job paid, retainer collected and order shipped that goes into Money moves the expedition up the mountain and writes the next line here.</p>
    </section>
  );

  // ---- the altitude chart ----
  const W = 760, H = 240, PAD = { l: 52, r: 14, t: 14, b: 26 };
  const top = Math.max(nextCamp?.altitude ?? 0, ...history.map(h => h.altitude), 500);
  const x = (i: number) => PAD.l + (history.length <= 1 ? (W - PAD.l - PAD.r) / 2 : (i / (history.length - 1)) * (W - PAD.l - PAD.r));
  const y = (alt: number) => PAD.t + (1 - alt / top) * (H - PAD.t - PAD.b);
  const line = history.map((h, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(h.altitude).toFixed(1)}`).join(' ');
  const area = history.length ? `${line} L${x(history.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z` : '';
  const shownCamps = camps.filter(c => c.altitude > 0 && c.altitude <= top);
  const labelEvery = Math.max(1, Math.ceil(history.length / 8));
  const maxMonth = Math.max(...history.map(h => h.monthRevenue), 1);

  // ---- why: plain sentences from the record ----
  const lead = why.ventures.filter(v => v.revenue > 0);
  const momentum = why.runRateAltitude - ex.altitude;
  const unknownMargins = why.ventures.filter(v => v.revenue > 0 && v.margin === null).map(v => v.name);

  return (
    <>
      <section className="hb-panel hb-journal" aria-labelledby="hb-climb-title">
        <h2 id="hb-climb-title">The climb so far</h2>
        <div className="hb-tally">
          <div><strong>{money(t.lifetimeRevenue)}</strong><span>recorded since {t.firstOn ? date(t.firstOn) : 'the start'}</span></div>
          <div><strong>{t.daysClimbing.toLocaleString('en-US')} days</strong><span>since the first dollar on record</span></div>
          <div><strong>{t.bestMonth ? money(t.bestMonth.amount) : 'None'}</strong><span>best month{t.bestMonth ? `, ${monthLabel(t.bestMonth.month)}` : ''}</span></div>
          <div><strong>{t.lifetimeCosts === null ? 'Not recorded' : money(t.lifetimeRevenue - t.lifetimeCosts)}</strong><span>{t.lifetimeCosts === null ? 'kept after costs: no costs on record' : `kept after ${money(t.lifetimeCosts)} of recorded costs`}</span></div>
        </div>

        <figure className="hb-chart">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Altitude by month, from ${history[0] ? monthLabel(history[0].month) : ''} to now. Now at ${metres(ex.altitude)}.`}>
            <defs><linearGradient id="hb-climb-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" className="hb-chart-fill-top" /><stop offset="1" className="hb-chart-fill-low" /></linearGradient></defs>
            {shownCamps.map(c => <g key={c.id} className="hb-chart-camp">
              <line x1={PAD.l} x2={W - PAD.r} y1={y(c.altitude)} y2={y(c.altitude)} />
              <text x={W - PAD.r} y={y(c.altitude) - 5} textAnchor="end">{c.name}</text>
            </g>)}
            {history.map((h, i) => {
              const bh = (h.monthRevenue / maxMonth) * 40;
              return <rect key={h.month} className="hb-chart-bar" x={x(i) - 5} y={H - PAD.b - bh} width={10} height={bh}><title>{`${monthLabel(h.month)}: ${money(h.monthRevenue)} recorded`}</title></rect>;
            })}
            <path d={area} className="hb-chart-area" />
            <path d={line} className="hb-chart-line" />
            {history.map((h, i) => <circle key={h.month} cx={x(i)} cy={y(h.altitude)} r={i === history.length - 1 ? 5 : 2.5} className={i === history.length - 1 ? 'hb-chart-now' : 'hb-chart-dot'}><title>{`${monthLabel(h.month)}: ${metres(h.altitude)}, ${money(h.revenue)} in the 12 months to ${date(h.through)}`}</title></circle>)}
            {[0, Math.round(top / 2), top].map(a => <text key={a} x={PAD.l - 8} y={y(a) + 4} textAnchor="end" className="hb-chart-axis">{Math.round(a).toLocaleString('en-US')}</text>)}
            {history.map((h, i) => (i % labelEvery === 0 || i === history.length - 1) && <text key={h.month} x={x(i)} y={H - 6} textAnchor="middle" className="hb-chart-axis">{monthYear(h.month + '-15')}</text>)}
          </svg>
          <figcaption>Altitude in metres at the end of each month, from the twelve months of recorded revenue before it. Bars are each month’s own revenue.</figcaption>
        </figure>

        <h3>What the record shows you have done</h3>
        <ol className="hb-log">
          {log.map((m, i) => <li key={m.on + m.title + i} data-kind={m.kind}>
            <time dateTime={m.on}>{date(m.on)}</time>
            <div><b>{m.title}</b><p>{m.detail}</p></div>
            <span className="hb-log-kind">{kindWord[m.kind]}</span>
          </li>)}
        </ol>
      </section>

      <section className="hb-panel hb-why" aria-labelledby="hb-why-title">
        <h2 id="hb-why-title">Why OJ stands at {metres(ex.altitude)}</h2>
        <div className="hb-why-prose">
          <p>Altitude comes from one number: <b>{money(ex.revenue)}</b> recorded across the businesses in the last twelve months. That puts the expedition {nextCamp ? <>at {ex.camp.current.name}, {money(ex.toNext ?? 0)} a year short of {nextCamp.name}</> : <>above every camp</>}.</p>
          {lead.length > 0 && <p>{lead[0].name} carries {pct(lead[0].share)} of the climb{lead.length > 1 ? <>, {lead.slice(1).map(v => `${v.name} ${pct(v.share)}`).join(', ')}</> : null}.{why.silent.length > 0 && <> {why.silent.join(' and ')} {why.silent.length > 1 ? 'have' : 'has'} nothing on record in that time, so {why.silent.length > 1 ? 'they add' : 'it adds'} no altitude yet.</>}</p>}
          <p>The last 90 days ran at <b>{money(why.runRate)}</b> a year. Held for a year, that pace stands at {metres(why.runRateAltitude)}, {Math.abs(momentum) < 40 ? 'about where you are now: the climb is holding' : momentum > 0 ? <>{metres(momentum)} higher than now: the climb is <b>accelerating</b></> : <>{metres(-momentum)} lower than now: the climb is <b>losing height</b> and older, bigger months are carrying the number</>}.</p>
          <p>{ex.ghost.ahead === null ? 'The 2046 pace line starts from the founding day.' : ex.ghost.ahead ? `You are ${metres(Math.abs(ex.ghost.gap))} above the 2046 pace line.` : `You are ${metres(Math.abs(ex.ghost.gap))} below the 2046 pace line.`} Reaching the summit on time takes {pct(ex.ghost.requiredGrowth)} growth a year, every year, for twenty years.{unknownMargins.length > 0 && <> Profit is unknown for {unknownMargins.join(' and ')}: no costs are recorded there, so the margin is not counted as 100%.</>}</p>
        </div>

        <ul className="hb-shares">
          {why.ventures.map(v => <li key={v.venture}>
            <div className="hb-share-head"><b>{v.name}</b><span>{v.revenue ? money(v.revenue) : 'Nothing recorded'}</span></div>
            <div className="hb-share-bar" aria-hidden="true"><i style={{ width: `${Math.max(v.share * 100, v.revenue ? 1.5 : 0)}%` }} /></div>
            <div className="hb-share-meta">
              <span>{pct(v.share)} of the climb</span>
              <span className={v.trend === null ? '' : v.trend >= 0 ? 'is-up' : 'is-down'}>
                {v.trend === null ? <><Minus size={13} aria-hidden="true" /> {v.recent ? 'New in the last 90 days' : 'No recent revenue'}</> : v.trend >= 0 ? <><ArrowUpRight size={13} aria-hidden="true" /> {pct(v.trend)} on the 90 days before</> : <><ArrowDownRight size={13} aria-hidden="true" /> {pct(-v.trend)} down on the 90 days before</>}
              </span>
              <span>{v.margin === null ? (v.revenue ? 'Costs not recorded' : '') : `${pct(v.margin)} kept after recorded costs`}</span>
            </div>
          </li>)}
        </ul>
        {why.categories.length > 0 && <div className="hb-cats">
          <h3>Where the money came from</h3>
          <ul>{why.categories.map(c => <li key={c.name}><span>{c.name}</span><b>{money(c.revenue)}</b><small>{pct(c.share)}</small></li>)}</ul>
        </div>}
      </section>

      <section className="hb-panel hb-next" aria-labelledby="hb-next-title">
        <h2 id="hb-next-title">Next objectives</h2>
        <p className="hb-next-lead">The next ridgelines between {ex.camp.current.name} and {nextCamp?.name ?? 'the summit'}, in order. Each is a twelve-month revenue figure. The forecast assumes the last 90 days’ pace holds while older months fall out of the window.</p>
        <ol className="hb-objectives">
          {next.map(o => <li key={o.revenue} className={o.isCamp ? 'is-camp' : ''}>
            <div className="hb-obj-head"><b>{o.name}</b><span>{metres(o.altitude)}</span></div>
            <p className="hb-obj-gap">{money(o.gap)} more a year. Holding it means about {money(o.monthly)} a month.</p>
            <dl>
              <div><dt>At the current pace</dt><dd>{o.etaOn ? `${monthYear(o.etaOn)}, in ${span(o.etaDays ?? 0)}` : 'Not reached at this pace'}</dd></div>
              <div><dt>Due on the 2046 line</dt><dd>{monthYear(o.dueOn)}</dd></div>
            </dl>
            <span className={o.late ? 'hb-obj-flag is-late' : 'hb-obj-flag'}>{o.late ? 'Behind the line' : 'On or ahead of the line'}</span>
          </li>)}
        </ol>

        <div className="hb-next-grid">
          {nextCamp && <div>
            <h3>Gates for {nextCamp.name}</h3>
            <ul className="hb-gates">{nextCamp.gates.map(g => <li key={g}>{g}</li>)}</ul>
            <p className="hb-fine">Revenue gets you to the camp. The gates are what make the next one possible.</p>
          </div>}
          {badges.length > 0 && <div>
            <h3>Badges within reach</h3>
            <ul className="hb-progress">{badges.map(b => <li key={b.id}>
              <div><span>{b.label}</span><b>{money(b.value)} of {money(b.target)}</b></div>
              <div className="hb-share-bar" aria-hidden="true"><i style={{ width: `${b.progress * 100}%` }} /></div>
            </li>)}</ul>
          </div>}
          <div>
            <h3>The 2046 timetable</h3>
            <ul className="hb-timetable">{schedule.map(c => <li key={c.id} className={ex.revenue >= c.revenue ? 'is-reached' : ''}>
              <span>{c.name}</span><b>{ex.revenue >= c.revenue ? 'Reached' : `Due ${monthYear(c.dueOn)}`}</b>
            </li>)}</ul>
            <p className="hb-fine">When the steady pace from {money(ex.ghost.start)} reaches each camp.</p>
          </div>
        </div>
      </section>
    </>
  );
}

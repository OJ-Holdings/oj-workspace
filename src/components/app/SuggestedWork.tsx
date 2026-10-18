'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowUpRight, CheckCircle2, SlidersHorizontal } from 'lucide-react';
import { suggestedWork, suggestionDraft, workDay, workRules, type WorkRule } from '@/lib/task-workflows';
import type { Dashboard } from '@/lib/dashboard';
import { ventures, type VentureId } from '@/lib/ventures';
import type { Board } from './useBoard';
import './workflows.css';

type Props = { board: Board; dashboard: Dashboard | null; base: string; organizationId: string; mode: 'preview' | 'live'; readOnly: boolean; venture?: VentureId };
const defaults = Object.fromEntries(workRules.map(rule => [rule.id, true])) as Record<WorkRule, boolean>;

/** Local rule preferences only. Reviewed tasks use the ordinary shared board and its audit trail. */
export function SuggestedWork({ board, dashboard, base, organizationId, mode, readOnly, venture }: Props) {
  const [rules, setRules] = useState(defaults);
  const [controls, setControls] = useState(false);
  const [today, setToday] = useState('');
  const [notice, setNotice] = useState('');
  const [showAll, setShowAll] = useState(false);
  const storageKey = `oj-work-rules:${mode}:${organizationId}`;
  useEffect(() => {
    const refresh = () => setToday(workDay(new Date())); refresh();
    const timer = window.setInterval(refresh, 60_000);
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || '{}') as Record<string, unknown>;
      setRules(Object.fromEntries(workRules.map(rule => [rule.id, typeof stored[rule.id] === 'boolean' ? stored[rule.id] : true])) as Record<WorkRule, boolean>);
    } catch { setNotice('Rule preferences could not be loaded. All checks are enabled.'); }
    return () => window.clearInterval(timer);
  }, [storageKey]);
  const toggle = (rule: WorkRule) => {
    const next = { ...rules, [rule]: !rules[rule] }; setRules(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setNotice('Your rule preference is saved in this browser.'); }
    catch { setNotice('This preference works for now, but your browser could not save it.'); }
  };
  const items = suggestedWork(board.data.cards, dashboard, today).filter(item => rules[item.rule] && (!venture || item.business === venture));
  const active = items.filter(item => !item.existingTask || item.sourceType === 'task');
  const history = board.data.cards.filter(card => (!venture || card.business === venture) && /^\[oj-work:(missing|older):[^\r\n]+\]$/m.test(card.description));
  const shown = showAll ? active : active.slice(0, 4);

  return <section className="suggested-work panel" aria-labelledby="suggested-work-title">
    <header className="panel-head"><div><h2 id="suggested-work-title">Suggested work</h2><p className="quiet">Checks your records as they change. You review every action.</p></div><button type="button" className="secondary small" aria-expanded={controls} onClick={() => setControls(!controls)}><SlidersHorizontal size={15} aria-hidden="true" />Rules</button></header>
    {controls && <div className="work-rules"><p>Personal preferences for this browser. These checks do not send messages or change records.</p>{workRules.map(rule => <label className="checkbox-row" key={rule.id}><input type="checkbox" checked={rules[rule.id]} onChange={() => toggle(rule.id)} />{rule.label}</label>)}<small>Older leads means at least 7 days since creation, not 7 days since last contact. Tasks you save appear in the shared activity history.</small></div>}
    {!today ? <p className="quiet">Checking dates…</p> : shown.length ? <ul className="work-suggestions">{shown.map(item => <li key={item.id} data-venture-tag={item.business}>
      <div className="work-suggestion-copy"><span className="work-suggestion-business">{ventures[item.business].short}</span><h3>{item.title}</h3><p>{item.reason}</p></div>
      <div className="work-suggestion-actions">
        {item.sourceType === 'lead' && <Link href={`${base}/crm?lead=${encodeURIComponent(item.sourceId)}`}>View lead <ArrowUpRight size={14} aria-hidden="true" /></Link>}
        {item.existingTask ? <button type="button" className="secondary small" onClick={() => board.openCard(item.existingTask)}>Open task</button> : !readOnly && <button type="button" className="secondary small" disabled={board.pending} onClick={() => board.openCard(undefined, suggestionDraft(item, base))}>Review task draft</button>}
      </div>
    </li>)}</ul> : <div className="work-clear"><CheckCircle2 size={20} aria-hidden="true" /><p>{Object.values(rules).some(Boolean) ? 'No new actions from your enabled checks.' : 'All suggestion checks are switched off.'}</p></div>}
    {active.length > 4 && <button type="button" className="text-button" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show fewer' : `Show all ${active.length} suggestions`}</button>}
    {!dashboard && <p className="quiet">Lead checks are unavailable until the workspace records load. Task checks still run.</p>}
    {history.length > 0 && <details className="work-history"><summary>{history.length} task{history.length === 1 ? '' : 's'} created from suggestions</summary><ul>{history.map(card => <li key={card.id}><button type="button" onClick={() => board.openCard(card)}>{card.title}</button><span>{card.stage}</span></li>)}</ul><p className="quiet">Existing source references prevent repeated drafts. Saved tasks and comments retain the normal team activity history.</p></details>}
    {notice && <p className="quiet" role="status">{notice}</p>}
  </section>;
}

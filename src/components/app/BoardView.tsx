'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import NumberFlow from '@number-flow/react';
import { usePathname } from 'next/navigation';
import { CheckSquare, MessageSquare, Plus, Search } from 'lucide-react';
import { matchesCard, stages, type Business } from '@/lib/board';
import { ventureList, ventures, type VentureId } from '@/lib/ventures';
import type { Board } from './useBoard';
import { selectTasks, taskMatchesFocus, workDay, type TaskFocus } from '@/lib/task-workflows';
import './workflows.css';
import { useViewParams } from './useViewParams';

function dateLabel(value: string) {
  return value ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`)) : '';
}

type Props = { board: Board; members: string[]; readOnly: boolean; displayName: string; lockVenture?: VentureId };

/** The task board. With `lockVenture` it shows one business only and new cards default to it. */
export function BoardView({ board, members, readOnly, displayName, lockVenture }: Props) {
  const { params, update } = useViewParams();
  const base = usePathname().startsWith('/preview') ? '/preview' : '/workspace';
  const business = lockVenture ?? (ventureList.some(v => v.id === params.get('business')) ? params.get('business')! : 'all');
  const query = (params.get('q') ?? '').slice(0, 200);
  const assignee = members.includes(params.get('assignee') ?? '') ? params.get('assignee')! : '';
  const focus = (['overdue', 'today', 'unassigned', 'review'].includes(params.get('focus') ?? '') ? params.get('focus') : 'all') as TaskFocus;
  const setBusiness = (value: string) => update({ business: value === 'all' ? '' : value });
  const setQuery = (value: string) => update({ q: value });
  const setAssignee = (value: string) => update({ assignee: value });
  const setFocus = (value: TaskFocus) => update({ focus: value === 'all' ? '' : value });
  const [today, setToday] = useState('');
  const [dragging, setDragging] = useState<string | null>(null);
  useEffect(() => { const refresh = () => setToday(workDay(new Date())); refresh(); const timer = window.setInterval(refresh, 60_000); return () => window.clearInterval(timer); }, []);
  const { data, pending } = board;
  const scope = lockVenture ?? business;
  const filtered = selectTasks(data.cards, scope, query, assignee, focus, today);
  const inScope = data.cards.filter(c => matchesCard(c, scope, query.trim(), assignee));
  const count = (stage: string) => filtered.filter(c => c.stage === stage).length;
  const newCard = (stage = 'Backlog') => board.openCard(undefined, { business: (scope === 'all' ? 'exterior' : scope) as Business, stage: stage as typeof stages[number] });
  const people: [string, string][] = [['', 'Everyone'], ...(displayName && members.includes(displayName) ? [[displayName, 'Mine'] as [string, string]] : []), ...members.filter(m => m !== displayName).map(m => [m, m] as [string, string])];

  return (
    <div className="boardview">
      <header className="atlas-workbench-head"><div><h1>Tasks</h1><small>Drag a task between columns, or use Move to.</small></div></header>
      <div className="statstrip">
        <div><span>Open in this view</span><strong><NumberFlow value={filtered.filter(c => c.stage !== 'Done').length} /></strong></div>
        <div><span>In progress</span><strong><NumberFlow value={count('In progress')} /></strong></div>
        <div><span>Needs review</span><strong><NumberFlow value={count('Review')} /></strong></div>
        <div><span>Done</span><strong><NumberFlow value={count('Done')} /></strong></div>
      </div>

      <div className="work-focus" role="group" aria-label="Task attention filters">
        {([['all', 'All tasks'], ['overdue', 'Overdue'], ['today', 'Due today'], ['unassigned', 'Unassigned'], ['review', 'Ready to review']] as const).map(([id, label]) => <button type="button" key={id} aria-pressed={focus === id} onClick={() => setFocus(id)}>{label}<span>{inScope.filter(c => taskMatchesFocus(c, id, today)).length}</span></button>)}
      </div>

      <div className="toolbar">
        {!lockVenture && (
          <div className="seg" role="group" aria-label="Filter by business">
            {[['all', 'All work'] as const, ...ventureList.map(v => [v.id, v.short] as const)].map(([id, label]) => (
              <button key={id} aria-pressed={business === id} onClick={() => setBusiness(id)}>
                {business === id && <motion.i layoutId="seg-business" className="seg-pill" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}
        <div className="seg" role="group" aria-label="Filter by person">
          {people.map(([value, label]) => (
            <button key={label} aria-pressed={assignee === value} onClick={() => setAssignee(value)}>
              {assignee === value && <motion.i layoutId={`seg-person-${lockVenture ?? 'all'}`} className="seg-pill" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
              <span>{label}</span>
            </button>
          ))}
        </div>
        <label className="searchbox"><Search size={16} aria-hidden="true" /><input aria-label="Search tasks" placeholder="Search tasks" value={query} onChange={e => setQuery(e.target.value)} /></label>
        {!readOnly && <button className="primary" onClick={() => newCard()} disabled={pending}><Plus size={16} aria-hidden="true" />New task</button>}
      </div>
      <div className="work-feedback"><p className="notice" role="status" aria-live="polite">{board.notice || `${filtered.length} task${filtered.length === 1 ? '' : 's'} shown`}</p>{board.undo && !readOnly && <button type="button" className="secondary small" disabled={pending} onClick={board.undoMove}>Undo move</button>}{(query || assignee || focus !== 'all' || (!lockVenture && business !== 'all')) && <button type="button" className="text-button" onClick={() => { setQuery(''); setAssignee(''); setFocus('all'); setBusiness(lockVenture ?? 'all'); }}>Clear filters</button>}</div>

      <div className="board" aria-label="Task board">
        {stages.map(stage => {
          const column = filtered.filter(c => c.stage === stage);
          return (
            <section key={stage} className={`column${dragging ? ' accepts-drop' : ''}`} data-stage={stage}
              onDragOver={e => { if (!readOnly && !pending && dragging) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; e.currentTarget.classList.add('is-over'); } }}
              onDragLeave={e => e.currentTarget.classList.remove('is-over')}
              onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('is-over'); setDragging(null); const card = filtered.find(c => c.id === e.dataTransfer.getData('text/plain')); if (card && !pending) board.move(card, stage); }}>
              <header>
                <i className="stage-dot" /><h2>{stage}</h2><span className="column-count">{column.length}</span>
                {!readOnly && <button aria-label={`Add a task to ${stage}`} className="icon-button" onClick={() => newCard(stage)}><Plus size={15} /></button>}
              </header>
              <div className="column-cards">
                {column.map(card => (
                  <motion.article layout layoutId={`card-${card.id}`} transition={{ type: 'spring', stiffness: 420, damping: 36 }} className="taskcard" key={card.id} data-venture-tag={card.business}
                    draggable={!readOnly && !pending} data-dragging={dragging === card.id || undefined} onDragStart={e => { const event = e as unknown as React.DragEvent; event.dataTransfer.setData('text/plain', card.id); event.dataTransfer.effectAllowed = 'move'; setDragging(card.id); }} onDragEnd={() => { setDragging(null); document.querySelectorAll('.column.is-over').forEach(el => el.classList.remove('is-over')); }}>
                    <button className="taskcard-open" onClick={() => board.openCard(card)}>
                      <div className="taskcard-tags">
                        <span className="tag" style={{ '--tag': `var(--c-${card.business})` } as React.CSSProperties}>{ventures[card.business].short}</span>
                        {card.priority === 'high' && <span className="tag tag-high">High</span>}
                      </div>
                      <h3>{card.title}</h3>
                      {card.description && <p>{card.description}</p>}
                      <div className="taskcard-meta">
                        {card.checklist.length > 0 && <span><CheckSquare size={13} aria-hidden="true" />{card.checklist.filter(i => i.done).length}/{card.checklist.length}</span>}
                        {data.comments.some(c => c.card_id === card.id) && <span><MessageSquare size={13} aria-hidden="true" />{data.comments.filter(c => c.card_id === card.id).length}</span>}
                        {card.due_date && <span className={`due${taskMatchesFocus(card, 'overdue', today) ? ' is-late' : ''}`}>{taskMatchesFocus(card, 'overdue', today) ? 'Overdue · ' : ''}{dateLabel(card.due_date)}</span>}
                        <span className="avatar" title={card.assignee || 'Unassigned'}>{card.assignee ? card.assignee.charAt(0).toUpperCase() : '-'}</span>
                      </div>
                    </button>
                    {!readOnly && (
                      <label className="move">Move to
                        <select disabled={pending} aria-label={`Move ${card.title}`} value={card.stage} onChange={e => board.move(card, e.target.value as typeof stages[number])}>{stages.map(s => <option key={s}>{s}</option>)}</select>
                      </label>
                    )}
                  </motion.article>
                ))}
                {column.length === 0 && <p className="column-empty">{query || assignee || focus !== 'all' ? 'No matching tasks' : 'Nothing here yet'}</p>}
              </div>
            </section>
          );
        })}
      </div>
      <p className="quiet board-foot">{readOnly ? 'You have view access.' : 'Drag a task to another column, or use its Move to menu.'}</p>
    </div>
  );
}

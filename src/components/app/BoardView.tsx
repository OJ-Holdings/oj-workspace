'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import NumberFlow from '@number-flow/react';
import { CheckSquare, MessageSquare, Plus, Search } from 'lucide-react';
import { matchesCard, stages, type Business } from '@/lib/board';
import { ventureList, ventures, type VentureId } from '@/lib/ventures';
import type { Board } from './useBoard';

function dateLabel(value: string) {
  return value ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`)) : '';
}

type Props = { board: Board; members: string[]; readOnly: boolean; displayName: string; lockVenture?: VentureId };

/** The task board. With `lockVenture` it shows one business only and new cards default to it. */
export function BoardView({ board, members, readOnly, displayName, lockVenture }: Props) {
  const [business, setBusiness] = useState<string>(lockVenture ?? 'all');
  const [query, setQuery] = useState('');
  const [assignee, setAssignee] = useState('');
  const { data, pending } = board;
  const scope = lockVenture ?? business;
  const filtered = data.cards.filter(c => matchesCard(c, scope, query, assignee));
  const inScope = data.cards.filter(c => scope === 'all' || c.business === scope);
  const count = (stage: string) => inScope.filter(c => c.stage === stage).length;
  const newCard = (stage = 'Backlog') => board.openCard(undefined, { business: (scope === 'all' ? 'exterior' : scope) as Business, stage: stage as typeof stages[number] });
  const people: [string, string][] = [['', 'Everyone'], ...(displayName && members.includes(displayName) ? [[displayName, 'Mine'] as [string, string]] : []), ...members.filter(m => m !== displayName).map(m => [m, m] as [string, string])];

  return (
    <div className="boardview">
      <div className="statstrip">
        <div><span>Open</span><strong><NumberFlow value={inScope.filter(c => c.stage !== 'Done').length} /></strong></div>
        <div><span>In progress</span><strong><NumberFlow value={count('In progress')} /></strong></div>
        <div><span>Needs review</span><strong><NumberFlow value={count('Review')} /></strong></div>
        <div><span>Done</span><strong><NumberFlow value={count('Done')} /></strong></div>
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
      <p className="notice" role="status" aria-live="polite">{board.notice}</p>

      <div className="board" aria-label="Task board">
        {stages.map(stage => {
          const column = filtered.filter(c => c.stage === stage);
          return (
            <section key={stage} className="column" data-stage={stage}
              onDragOver={e => { if (!readOnly) { e.preventDefault(); e.currentTarget.classList.add('is-over'); } }}
              onDragLeave={e => e.currentTarget.classList.remove('is-over')}
              onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('is-over'); const card = data.cards.find(c => c.id === e.dataTransfer.getData('text/plain')); if (card) board.move(card, stage); }}>
              <header>
                <i className="stage-dot" /><h2>{stage}</h2><span className="column-count">{column.length}</span>
                {!readOnly && <button aria-label={`Add a task to ${stage}`} className="icon-button" onClick={() => newCard(stage)}><Plus size={15} /></button>}
              </header>
              <div className="column-cards">
                {column.map(card => (
                  <motion.article layout layoutId={`card-${card.id}`} transition={{ type: 'spring', stiffness: 420, damping: 36 }} className="taskcard" key={card.id} data-venture-tag={card.business}
                    draggable={!readOnly && !pending} onDragStart={e => (e as unknown as React.DragEvent).dataTransfer.setData('text/plain', card.id)}>
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
                        {card.due_date && <span className="due">{dateLabel(card.due_date)}</span>}
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
                {column.length === 0 && <p className="column-empty">{query || assignee ? 'No matching tasks' : 'Nothing here yet'}</p>}
              </div>
            </section>
          );
        })}
      </div>
      <p className="quiet board-foot">{readOnly ? 'You have view access.' : 'Drag a task to another column, or use its Move to menu.'}</p>
    </div>
  );
}

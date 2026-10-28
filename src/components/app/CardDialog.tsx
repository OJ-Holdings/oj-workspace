'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Trash2, X } from 'lucide-react';
import { stages, type Business, type Card, type Stage } from '@/lib/board';
import { ventureList, ventures } from '@/lib/ventures';
import type { Board } from './useBoard';
import type { Dashboard } from '@/lib/dashboard';
import type { JobItem } from '@/app/workspace/exterior-actions';
import { AtlasTaskRelations } from './AtlasRelations';

type Props = { board: Board; members: string[]; readOnly: boolean; mode: 'preview' | 'live'; dashboard: Dashboard | null; jobs: JobItem[]; base: string };

/** Create or edit one task, with its checklist and conversation. Mounted once for the whole app. */
export function CardDialog({ board, members, readOnly, mode, dashboard, jobs, base }: Props) {
  const { editing, setEditing, data, pending, notice } = board;
  const dialog = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const [comment, setComment] = useState('');
  const [checkText, setCheckText] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isOpen = !!editing;

  useEffect(() => {
    if (isOpen) {
      previousFocus.current = document.activeElement as HTMLElement;
      setComment(''); setCheckText(''); setConfirmDelete(false);
      dialog.current?.showModal();
    } else if (dialog.current?.open) {
      dialog.current.close();
      previousFocus.current?.focus();
    }
  }, [isOpen]);

  const current = editing ? data.cards.find(c => c.id === editing.id) : undefined;
  const stale = Boolean(editing && current && current.revision !== editing.revision);
  const patch = (p: Partial<Card>) => setEditing(c => c ? { ...c, ...p } : c);
  const locked = readOnly || pending;
  const close = () => board.closeCard(Boolean(comment.trim() || checkText.trim()));
  const sourceLinks = editing?.description.split(/\r?\n/).filter(line => /^\/(workspace|preview)\/(crm\?lead=|tasks\?task=)[a-zA-Z0-9_%:-]+$/.test(line)) ?? [];

  return (
    <dialog ref={dialog} className="card-dialog" data-venture={editing?.business} onCancel={e => { e.preventDefault(); close(); }} onClick={e => { if (e.target === dialog.current) close(); }} aria-labelledby="card-dialog-title">
      {editing && <>
        <div className="dialog-header">
          <span className="tag" style={{ '--tag': `var(--c-${editing.business})` } as React.CSSProperties}>{ventures[editing.business].name}</span>
          <button className="icon-button" aria-label="Close" disabled={pending} onClick={close}><X size={20} /></button>
        </div>
        <h2 id="card-dialog-title">{current ? 'Task details' : 'New task'}</h2>
        {stale && (
          <div className="draft-warning" role="alert">
            <p>This task changed while you were editing. Your draft is kept. Load the current version before saving; that replaces your draft.</p>
            <button className="secondary" disabled={pending} onClick={() => { if (current && (!board.dirty || window.confirm('Replace your draft with the saved version?'))) board.openCard(current); }}>Load current version</button>
          </div>
        )}
        <form onSubmit={e => { e.preventDefault(); if (comment.trim() || checkText.trim()) return; board.persist(editing, true); }}>
          <label>Title<input autoFocus required maxLength={180} value={editing.title} disabled={locked} onChange={e => patch({ title: e.target.value })} placeholder="What needs to happen?" /></label>
          <label>Description<textarea rows={3} maxLength={8000} value={editing.description} disabled={locked} onChange={e => patch({ description: e.target.value })} placeholder="Add the context and what done looks like." /></label>
          {sourceLinks.map(link => <Link className="task-source-link" href={link} key={link} onClick={e => { if (!close()) e.preventDefault(); }}>Open linked {link.includes('/crm?') ? 'lead' : 'task'}</Link>)}
          <AtlasTaskRelations card={editing} dashboard={dashboard} jobs={jobs} base={base} onNavigate={close} />
          <div className="form-grid">
            <label>Business<select disabled={locked} value={editing.business} onChange={e => patch({ business: e.target.value as Business })}>{ventureList.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
            <label>Status<select disabled={locked} value={editing.stage} onChange={e => patch({ stage: e.target.value as Stage })}>{stages.map(s => <option key={s}>{s}</option>)}</select></label>
            <label>Assigned to<select disabled={locked} value={editing.assignee} onChange={e => patch({ assignee: e.target.value })}><option value="">Unassigned</option>{members.map(m => <option key={m}>{m}</option>)}</select></label>
            <label>Due date<input type="date" disabled={locked} value={editing.due_date} onChange={e => patch({ due_date: e.target.value })} /></label>
          </div>
          <label className="checkbox-row"><input type="checkbox" disabled={locked} checked={editing.priority === 'high'} onChange={e => patch({ priority: e.target.checked ? 'high' : 'normal' })} />High priority</label>

          <h3>Checklist</h3>
          {editing.checklist.map(item => (
            <div className="task-checklist-row" key={item.id}>
              <label className="checkbox-row"><input type="checkbox" disabled={locked} checked={item.done} onChange={e => patch({ checklist: editing.checklist.map(i => i.id === item.id ? { ...i, done: e.target.checked } : i) })} />{item.text}</label>
              {!readOnly && <button type="button" className="icon-button" disabled={locked} aria-label={`Remove checklist item: ${item.text}`} onClick={() => patch({ checklist: editing.checklist.filter(i => i.id !== item.id) })}><Trash2 size={15} /></button>}
            </div>
          ))}
          {!readOnly && (
            <div className="inline-input">
              <input aria-label="New checklist item" disabled={locked} maxLength={300} value={checkText} onChange={e => setCheckText(e.target.value)} placeholder="Add a checklist item" />
              <button type="button" className="secondary" disabled={pending || !checkText.trim() || editing.checklist.length >= 40} onClick={() => { patch({ checklist: [...editing.checklist, { id: crypto.randomUUID(), text: checkText.trim(), done: false }] }); setCheckText(''); }}>Add</button>
            </div>
          )}
          <div className="dialog-actions">
            {!readOnly && current && (confirmDelete
              ? <span className="delete-confirm" role="group" aria-label="Confirm delete">Delete this task and its comments?
                  <button type="button" className="secondary danger small" disabled={pending} onClick={() => board.remove(current)}>Delete</button>
                  <button type="button" className="secondary small" disabled={pending} onClick={() => setConfirmDelete(false)}>Keep</button></span>
              : <button type="button" className="secondary danger small" disabled={pending} onClick={() => setConfirmDelete(true)}><Trash2 size={14} aria-hidden="true" /> Delete task</button>)}
            <span>{mode === 'preview' ? 'Saved in this browser only' : 'Shared with your OJ team'}</span>
            {!readOnly && <button type="submit" className="primary" disabled={pending || stale || Boolean(comment.trim() || checkText.trim())}>{pending ? 'Saving' : 'Save task'}</button>}
          </div>
        </form>

        {(comment.trim() || checkText.trim()) && <p className="quiet" role="status">Add or clear the checklist item, and post or clear the comment before saving.</p>}
        <section className="comments">
          <h3>Conversation</h3>
          {data.comments.filter(c => c.card_id === editing.id).map(c => <div className="comment" key={c.id}><strong>{c.author}</strong><p>{c.body}</p></div>)}
          {!data.comments.some(c => c.card_id === editing.id) && <p className="quiet">Keep the discussion beside the work.</p>}
          {!readOnly && (
            <div className="inline-input">
              <textarea aria-label="Add a comment" disabled={pending || !current} maxLength={4000} rows={2} value={comment} onChange={e => setComment(e.target.value)} placeholder={current ? 'Add a comment' : 'Save this task to start its conversation'} />
              <button className="secondary" disabled={pending || !current || !comment.trim()} onClick={() => board.postComment(editing, comment, () => setComment(''))}>Post</button>
            </div>
          )}
        </section>
        <p className="dialog-notice" role="status">{notice}</p>
      </>}
    </dialog>
  );
}

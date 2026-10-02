'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { stages, type Business, type Card, type Stage } from '@/lib/board';
import { ventureList, ventures } from '@/lib/ventures';
import type { Board } from './useBoard';

type Props = { board: Board; members: string[]; readOnly: boolean; mode: 'preview' | 'live' };

/** Create or edit one task, with its checklist and conversation. Mounted once for the whole app. */
export function CardDialog({ board, members, readOnly, mode }: Props) {
  const { editing, setEditing, data, pending, notice } = board;
  const dialog = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const [comment, setComment] = useState('');
  const [checkText, setCheckText] = useState('');
  const isOpen = !!editing;

  useEffect(() => {
    if (isOpen) {
      previousFocus.current = document.activeElement as HTMLElement;
      setComment(''); setCheckText('');
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

  return (
    <dialog ref={dialog} className="card-dialog" data-venture={editing?.business} onCancel={() => setEditing(null)} onClick={e => { if (e.target === dialog.current) setEditing(null); }} aria-labelledby="card-dialog-title">
      {editing && <>
        <div className="dialog-header">
          <span className="tag" style={{ '--tag': `var(--c-${editing.business})` } as React.CSSProperties}>{ventures[editing.business].name}</span>
          <button className="icon-button" aria-label="Close" onClick={() => setEditing(null)}><X size={20} /></button>
        </div>
        <h2 id="card-dialog-title">{current ? 'Task details' : 'New task'}</h2>
        {stale && (
          <div className="draft-warning" role="alert">
            <p>This task changed while you were editing. Your draft is kept. Load the current version before saving; that replaces your draft.</p>
            <button className="secondary" onClick={() => { if (current) setEditing(structuredClone(current)); }}>Load current version</button>
          </div>
        )}
        <form onSubmit={e => { e.preventDefault(); board.persist(editing, true); }}>
          <label>Title<input autoFocus required maxLength={180} value={editing.title} disabled={locked} onChange={e => patch({ title: e.target.value })} placeholder="What needs to happen?" /></label>
          <label>Description<textarea rows={3} maxLength={8000} value={editing.description} disabled={locked} onChange={e => patch({ description: e.target.value })} placeholder="Add the context and what done looks like." /></label>
          <div className="form-grid">
            <label>Business<select disabled={locked} value={editing.business} onChange={e => patch({ business: e.target.value as Business })}>{ventureList.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
            <label>Status<select disabled={locked} value={editing.stage} onChange={e => patch({ stage: e.target.value as Stage })}>{stages.map(s => <option key={s}>{s}</option>)}</select></label>
            <label>Assigned to<select disabled={locked} value={editing.assignee} onChange={e => patch({ assignee: e.target.value })}><option value="">Unassigned</option>{members.map(m => <option key={m}>{m}</option>)}</select></label>
            <label>Due date<input type="date" disabled={locked} value={editing.due_date} onChange={e => patch({ due_date: e.target.value })} /></label>
          </div>
          <label className="checkbox-row"><input type="checkbox" disabled={locked} checked={editing.priority === 'high'} onChange={e => patch({ priority: e.target.checked ? 'high' : 'normal' })} />High priority</label>

          <h3>Checklist</h3>
          {editing.checklist.map(item => (
            <label className="checkbox-row" key={item.id}>
              <input type="checkbox" disabled={locked} checked={item.done} onChange={e => patch({ checklist: editing.checklist.map(i => i.id === item.id ? { ...i, done: e.target.checked } : i) })} />{item.text}
            </label>
          ))}
          {!readOnly && (
            <div className="inline-input">
              <input aria-label="New checklist item" maxLength={300} value={checkText} onChange={e => setCheckText(e.target.value)} placeholder="Add a checklist item" />
              <button type="button" className="secondary" disabled={pending || !checkText.trim() || editing.checklist.length >= 40} onClick={() => { patch({ checklist: [...editing.checklist, { id: crypto.randomUUID(), text: checkText.trim(), done: false }] }); setCheckText(''); }}>Add</button>
            </div>
          )}
          <div className="dialog-actions">
            <span>{mode === 'preview' ? 'Saved in this browser only' : 'Shared with your OJ team'}</span>
            {!readOnly && <button type="submit" className="primary" disabled={pending}>{pending ? 'Saving' : 'Save task'}</button>}
          </div>
        </form>

        <section className="comments">
          <h3>Conversation</h3>
          {data.comments.filter(c => c.card_id === editing.id).map(c => <div className="comment" key={c.id}><strong>{c.author}</strong><p>{c.body}</p></div>)}
          {!data.comments.some(c => c.card_id === editing.id) && <p className="quiet">Keep the discussion beside the work.</p>}
          {!readOnly && (
            <div className="inline-input">
              <textarea aria-label="Add a comment" maxLength={4000} rows={2} value={comment} onChange={e => setComment(e.target.value)} placeholder="Add a comment" />
              <button className="secondary" disabled={pending || !comment.trim()} onClick={() => board.postComment(editing, comment, () => setComment(''))}>Post</button>
            </div>
          )}
        </section>
        <p className="dialog-notice" role="status">{notice}</p>
      </>}
    </dialog>
  );
}

'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { updateCard, validateCard, type BoardData, type Business, type Card, type Stage } from '@/lib/board';
import { undoTaskMove } from '@/lib/task-workflows';
import { addComment, saveCard } from '@/app/workspace/actions';

const PREVIEW_KEY = 'oj-workspace-preview-v2';

/**
 * The shared task data and every way of changing it. In preview mode changes
 * stay in this browser; in live mode they go through the server actions, which
 * check membership and reject stale revisions.
 */
export function useBoard(initial: BoardData, mode: 'preview' | 'live', organizationId: string, readOnly: boolean) {
  const [data, setData] = useState(initial);
  const [editing, setEditing] = useState<Card | null>(null);
  const [notice, setNotice] = useState('');
  const [ready, setReady] = useState(false);
  const [pending, startTransition] = useTransition();
  const [undo, setUndo] = useState<{ id: string; title: string; stage: Stage; revision: number } | null>(null);
  const originalDraft = useRef<Card | null>(null);
  const dataRef = useRef(data);
  const mutation = useRef(false);
  useEffect(() => { dataRef.current = data; }, [data]);

  useEffect(() => { if (mode === 'live') setData(initial); }, [initial, mode]);

  useEffect(() => {
    if (mode === 'preview') {
      try {
        const stored = localStorage.getItem(PREVIEW_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as BoardData;
          if (!Array.isArray(parsed.cards) || !Array.isArray(parsed.comments)) throw new Error();
          parsed.cards.forEach(validateCard);
          if (parsed.cards.some(c => c.organization_id !== 'preview')) throw new Error();
          if (parsed.comments.some(c => typeof c.body !== 'string' || typeof c.author !== 'string')) throw new Error();
          setData(parsed);
        }
      } catch { setNotice('Saved preview could not be loaded. Sample records are shown.'); }
    }
    setReady(true);
  }, [mode]);

  useEffect(() => {
    if (mode === 'preview' && ready) {
      try { localStorage.setItem(PREVIEW_KEY, JSON.stringify(data)); }
      catch { setNotice('Your browser could not save this preview. Keep this tab open to retain your changes.'); }
    }
  }, [data, ready, mode]);

  function openCard(card?: Card, defaults: Partial<Card> = {}) {
    if (mutation.current) return;
    setNotice('');
    const draft: Card = card ? structuredClone(card) : {
      id: crypto.randomUUID(), organization_id: organizationId, title: '', description: '',
      business: 'exterior' as Business, stage: 'Backlog' as Stage, priority: 'normal', assignee: '', due_date: '', revision: 0, checklist: [],
      ...defaults,
    };
    originalDraft.current = structuredClone(draft);
    setEditing(draft);
  }

  const dirty = Boolean(editing && originalDraft.current && JSON.stringify(editing) !== JSON.stringify(originalDraft.current));
  function closeCard(extraDraft = false) {
    if (mutation.current) return false;
    if ((dirty || extraDraft) && !window.confirm('Discard your unsaved task changes?')) return false;
    setEditing(null);
    return true;
  }

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function previewActivity(d: BoardData, cardId: string, action: 'card_created' | 'card_updated' | 'comment_added') {
    return [{ id: crypto.randomUUID(), card_id: cardId, actor: 'You (preview)', action, created_at: new Date().toISOString() }, ...(d.activity || [])].slice(0, 50);
  }

  function persist(card: Card, close = false, movedFrom?: Stage) {
    if (readOnly || mutation.current) return;
    mutation.current = true;
    startTransition(async () => {
      try {
        validateCard(card);
        let saved: Card;
        if (mode === 'preview') {
          const d = dataRef.current;
          const cards = updateCard(d.cards, card);
          saved = cards.find(c => c.id === card.id)!;
          const next = { ...d, cards, activity: previewActivity(d, card.id, d.cards.some(c => c.id === card.id) ? 'card_updated' : 'card_created') };
          dataRef.current = next;
          setData(next);
        } else {
          saved = await saveCard(card);
          setData(d => ({ ...d, cards: d.cards.some(c => c.id === saved.id) ? d.cards.map(c => c.id === saved.id ? saved : c) : [...d.cards, saved] }));
        }
        setUndo(movedFrom ? { id: saved.id, title: saved.title, stage: movedFrom, revision: saved.revision } : null);
        setNotice(movedFrom ? `Moved to ${saved.stage}.` : 'Task saved.');
        if (close) setEditing(null);
      } catch (e) { setNotice(e instanceof Error ? e.message : 'Could not save this card. Try again.'); }
      finally { mutation.current = false; }
    });
  }

  function move(card: Card, stage: Stage) { if (!readOnly && card.stage !== stage) persist({ ...card, stage }, false, card.stage); }
  function undoMove() {
    if (!undo || readOnly || mutation.current) return;
    try {
      const current = dataRef.current.cards.find(c => c.id === undo.id);
      if (!current) throw new Error('This task is no longer available.');
      persist(undoTaskMove(current, undo.revision, undo.stage));
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not undo this move.'); setUndo(null); }
  }

  function postComment(target: Card, body: string, done: () => void) {
    if (readOnly || mutation.current || !body.trim()) return;
    mutation.current = true;
    startTransition(async () => {
      try {
        if (!data.cards.some(c => c.id === target.id)) throw new Error('Save the card before adding a comment.');
        if (body.length > 4000) throw new Error('Keep comments under 4,000 characters.');
        const next = mode === 'preview'
          ? { id: crypto.randomUUID(), card_id: target.id, body: body.trim(), author: 'You (preview)', created_at: new Date().toISOString() }
          : await addComment(target.id, organizationId, body.trim());
        setData(d => ({ ...d, comments: [...d.comments, next], activity: mode === 'preview' ? previewActivity(d, target.id, 'comment_added') : d.activity }));
        setNotice('Comment added.');
        done();
      } catch (e) { setNotice(e instanceof Error ? e.message : 'Could not add comment.'); }
      finally { mutation.current = false; }
    });
  }

  return { data, editing, setEditing, notice, pending, openCard, closeCard, dirty, ready, undo, undoMove, persist, move, postComment };
}

export type Board = ReturnType<typeof useBoard>;

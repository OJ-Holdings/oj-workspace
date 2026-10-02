'use client';

import { useEffect, useState, useTransition } from 'react';
import { updateCard, validateCard, type BoardData, type Business, type Card, type Stage } from '@/lib/board';
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
    setNotice('');
    setEditing(card ? structuredClone(card) : {
      id: crypto.randomUUID(), organization_id: organizationId, title: '', description: '',
      business: 'exterior' as Business, stage: 'Backlog' as Stage, priority: 'normal', assignee: '', due_date: '', revision: 0, checklist: [],
      ...defaults,
    });
  }

  function previewActivity(d: BoardData, cardId: string, action: 'card_created' | 'card_updated' | 'comment_added') {
    return [{ id: crypto.randomUUID(), card_id: cardId, actor: 'You (preview)', action, created_at: new Date().toISOString() }, ...(d.activity || [])].slice(0, 50);
  }

  function persist(card: Card, close = false) {
    startTransition(async () => {
      try {
        validateCard(card);
        if (mode === 'preview') {
          setData(d => ({ ...d, cards: updateCard(d.cards, card), activity: previewActivity(d, card.id, d.cards.some(c => c.id === card.id) ? 'card_updated' : 'card_created') }));
        } else {
          const saved = await saveCard(card);
          setData(d => ({ ...d, cards: d.cards.some(c => c.id === saved.id) ? d.cards.map(c => c.id === saved.id ? saved : c) : [...d.cards, saved] }));
        }
        setNotice('Card saved.');
        if (close) setEditing(null);
      } catch (e) { setNotice(e instanceof Error ? e.message : 'Could not save this card. Try again.'); }
    });
  }

  function move(card: Card, stage: Stage) { if (!readOnly && card.stage !== stage) persist({ ...card, stage }); }

  function postComment(target: Card, body: string, done: () => void) {
    if (!body.trim()) return;
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
    });
  }

  return { data, editing, setEditing, notice, pending, openCard, persist, move, postComment };
}

export type Board = ReturnType<typeof useBoard>;

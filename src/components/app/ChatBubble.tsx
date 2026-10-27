'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
import type { DashboardStore } from './useDashboard';

type Props = { store: DashboardStore; organizationId: string; displayName: string; readOnly: boolean; mode: 'preview' | 'live' };

const seenKey = (org: string) => `oj-chat-seen-v1:${org}`;
const time = (iso: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

/**
 * The founders' floating chat. It reads and writes the same shared messages as the Messages page (so history is one place), and new
 * messages arrive through the workspace's existing live updates. The unread count is kept on this device only.
 */
export function ChatBubble({ store, organizationId, displayName, readOnly, mode }: Props) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [seen, setSeen] = useState('');
  const list = useRef<HTMLUListElement>(null);
  const messages = store.data?.messages;

  useEffect(() => { try { setSeen(window.localStorage.getItem(seenKey(organizationId)) ?? ''); } catch { /* storage unavailable */ } }, [organizationId]);

  // Newest first in the store; show the last 30 oldest-to-newest.
  const recent = useMemo(() => (messages ?? []).slice(0, 30).reverse(), [messages]);
  const newest = messages?.[0]?.created_at ?? '';
  const mine = (author: string) => Boolean(displayName) && author === displayName;
  const unread = useMemo(() => (messages ?? []).filter(m => !mine(m.author) && m.created_at > seen).length, [messages, seen, displayName]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || !newest) return;
    setSeen(newest);
    try { window.localStorage.setItem(seenKey(organizationId), newest); } catch { /* storage unavailable */ }
  }, [open, newest, organizationId]);
  useEffect(() => { if (open) list.current?.scrollTo({ top: list.current.scrollHeight }); }, [open, recent.length]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!store.data) return null;
  const send = () => { if (body.trim()) store.sendMessage(null, body, () => setBody('')); };

  return (
    <div className="chat-bubble" data-open={open || undefined}>
      {open && (
        <section className="chat-panel" role="dialog" aria-label="Founder chat">
          <header>
            <h2>Chat</h2>
            <button type="button" className="icon-button" aria-label="Close chat" onClick={() => setOpen(false)}><X size={16} aria-hidden="true" /></button>
          </header>
          <ul ref={list} className="chat-list" aria-live="polite">
            {recent.length === 0 && <li className="chat-empty">No messages yet. Say something to {mode === 'preview' ? 'the sample team' : 'your partner'}.</li>}
            {recent.map(m => (
              <li key={m.id} className={mine(m.author) ? 'chat-msg is-mine' : 'chat-msg'}>
                <b>{mine(m.author) ? 'You' : m.author}</b>
                <p>{m.body}</p>
                <time dateTime={m.created_at}>{time(m.created_at)}</time>
              </li>
            ))}
          </ul>
          {!readOnly && (
            <form className="chat-form" onSubmit={e => { e.preventDefault(); send(); }}>
              <input aria-label="Write a message" maxLength={4000} value={body} onChange={e => setBody(e.target.value)} placeholder="Message" />
              <button className="icon-button" aria-label="Send message" disabled={store.pending || !body.trim()}><Send size={16} aria-hidden="true" /></button>
            </form>
          )}
        </section>
      )}
      <button type="button" className="chat-toggle" aria-expanded={open} aria-label={unread > 0 ? `Open chat, ${unread} unread` : 'Open chat'} onClick={() => setOpen(v => !v)}>
        <MessageCircle size={20} aria-hidden="true" />
        {unread > 0 && !open && <i className="chat-unread">{unread > 9 ? '9+' : unread}</i>}
      </button>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Check, CheckSquare, ChevronDown, Circle, LayoutDashboard, Columns3, MessageSquare, Plus, Search, SlidersHorizontal, Sparkles, Waves, X } from 'lucide-react';
import { stages, matchesCard, updateCard, validateCard, type BoardData, type Business, type Card, type Stage } from '@/lib/board';
import { saveCard, addComment, signOut } from '@/app/workspace/actions';
import { ActivityFeed } from '@/components/ActivityFeed';

type Props = { initial: BoardData; mode: 'preview' | 'live'; organizationId: string; members: string[]; readOnly?: boolean; owner?: boolean; displayName?: string; connectionStatus?: string; limited?: boolean };
const businessName = (b: Business) => b === 'exterior' ? 'Exterior Care' : 'OJ Solutions';
function dateLabel(value: string) {
  return value ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`)) : '';
}

export function Workspace({ initial, mode, organizationId, members, readOnly = false, owner = false, displayName = '', connectionStatus = '', limited = false }: Props) {
  const [data, setData] = useState(initial);
  const [business, setBusiness] = useState('all');
  const [query, setQuery] = useState('');
  const [assignee, setAssignee] = useState('');
  const [view, setView] = useState<'board' | 'overview' | 'activity'>('board');
  const [editing, setEditing] = useState<Card | null>(null);
  const [comment, setComment] = useState('');
  const [checkText, setCheckText] = useState('');
  const [notice, setNotice] = useState('');
  const [ready, setReady] = useState(false);
  const [pending, startTransition] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => { if (mode === 'live') setData(initial); }, [initial, mode]);

  useEffect(() => {
    if (mode === 'preview') {
      try {
        const stored = localStorage.getItem('oj-workspace-preview-v1');
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
      try { localStorage.setItem('oj-workspace-preview-v1', JSON.stringify(data)); }
      catch { setNotice('Your browser could not save this preview. Keep this tab open to retain your changes.'); }
    }
  }, [data, ready, mode]);
  useEffect(() => {
    if (editing) {
      previousFocus.current = document.activeElement as HTMLElement;
      dialog.current?.showModal();
    } else if (dialog.current?.open) {
      dialog.current.close();
      previousFocus.current?.focus();
    }
  }, [!!editing]);

  const filtered = data.cards.filter(c => matchesCard(c, business, query, assignee));
  const active = data.cards.filter(c => c.stage !== 'Done');
  const currentEditing = editing ? data.cards.find(c => c.id === editing.id) : undefined;
  const staleDraft = Boolean(editing && currentEditing && currentEditing.revision !== editing.revision);
  const title = view === 'activity' ? 'Team activity' : business === 'all' ? 'Shared work board' : business === 'exterior' ? 'Exterior Care' : 'OJ Solutions';
  function openCard(card?: Card) {
    setComment(''); setCheckText('');
    setEditing(card ? structuredClone(card) : {
      id: crypto.randomUUID(), organization_id: organizationId, title: '', description: '',
      business: business === 'solutions' ? 'solutions' : 'exterior', stage: 'Backlog',
      priority: 'normal', assignee: '', due_date: '', revision: 0, checklist: [],
    });
  }
  function patchCard(patch: Partial<Card>) { setEditing(c => c ? { ...c, ...patch } : c); }
  function persist(card: Card, close = false) {
    startTransition(async () => {
      try {
        validateCard(card);
        if (mode === 'preview') setData(d => ({ ...d, cards: updateCard(d.cards, card), activity: [{ id: crypto.randomUUID(), card_id: card.id, actor: 'You (preview)', action: d.cards.some(c => c.id === card.id) ? 'card_updated' as const : 'card_created' as const, created_at: new Date().toISOString() }, ...(d.activity || [])].slice(0, 50) }));
        else {
          const saved = await saveCard(card);
          setData(d => ({ ...d, cards: d.cards.some(c => c.id === saved.id) ? d.cards.map(c => c.id === saved.id ? saved : c) : [...d.cards, saved] }));
        }
        setNotice('Card saved.');
        if (close) setEditing(null);
      } catch (e) { setNotice(e instanceof Error ? e.message : 'Could not save this card. Try again.'); }
    });
  }
  function move(card: Card, stage: Stage) { if (!readOnly && card.stage !== stage) persist({ ...card, stage }); }
  function postComment() {
    if (!editing || !comment.trim()) return;
    const target = editing;
    startTransition(async () => {
      try {
        if (!data.cards.some(c => c.id === target.id)) throw new Error('Save the card before adding a comment.');
        if (comment.length > 4000) throw new Error('Keep comments under 4,000 characters.');
        const next = mode === 'preview' ? { id: crypto.randomUUID(), card_id: target.id, body: comment.trim(), author: 'You (preview)', created_at: new Date().toISOString() } : await addComment(target.id, organizationId, comment.trim());
        setData(d => ({ ...d, comments: [...d.comments, next], activity: mode === 'preview' ? [{ id: crypto.randomUUID(), card_id: target.id, actor: 'You (preview)', action: 'comment_added' as const, created_at: new Date().toISOString() }, ...(d.activity || [])].slice(0, 50) : d.activity })); setComment(''); setNotice('Comment added.');
      } catch (e) { setNotice(e instanceof Error ? e.message : 'Could not add comment.'); }
    });
  }

  return <div className="workspace">
    <a className="skip-link" href="#work-main">Skip to work board</a>
    <aside className="sidebar">
      <Link className="brand" href="/"><span className="brand-mark">OJ</span><span>Workspace<small>Build together.</small></span></Link>
      <div className="workspace-name"><span className="org-avatar">O</span><span>OJ businesses<small>Shared workspace</small></span><ChevronDown size={15} aria-hidden="true" /></div>
      <p className="nav-label">Workspace</p>
      <nav aria-label="Workspace navigation">
        <button className={view === 'overview' ? 'nav-item selected' : 'nav-item'} onClick={() => setView('overview')}><LayoutDashboard size={18} />Overview</button>
        <button className={view === 'board' && business === 'all' ? 'nav-item selected' : 'nav-item'} onClick={() => { setView('board'); setBusiness('all'); }}><Columns3 size={18} />Shared board<span className="nav-count">{active.length}</span></button>
        <button className={view === 'activity' ? 'nav-item selected' : 'nav-item'} onClick={() => setView('activity')}><MessageSquare size={18} />Activity</button>
        {mode === 'live' && owner && <Link className="nav-item" href="/workspace/team"><SlidersHorizontal size={18} />People &amp; access</Link>}
        <p className="nav-label">Businesses</p>
        <button className={business === 'exterior' && view === 'board' ? 'nav-item selected' : 'nav-item'} onClick={() => { setView('board'); setBusiness('exterior'); }}><Waves size={18} />Exterior Care</button>
        <button className={business === 'solutions' && view === 'board' ? 'nav-item selected' : 'nav-item'} onClick={() => { setView('board'); setBusiness('solutions'); }}><Sparkles size={18} />OJ Solutions</button>
      </nav>
      <div className="sidebar-note"><span className="small-dot" />One team. Clear ownership.<p>Customer work and shared projects, in one place.</p></div>
      <div className="team"><div className="avatar-stack">{members.slice(0, 2).map(m => <span key={m}>{m.charAt(0).toUpperCase()}</span>)}</div><div>{mode === 'preview' ? 'Oscar & Jacob' : displayName}<small>{mode === 'preview' ? 'Preview team' : owner ? 'Workspace owner' : readOnly ? 'View access' : 'OJ member'}</small></div></div>
      {mode === 'live' && <form action={signOut}><button className="nav-item">Sign out</button></form>}
    </aside>
    <div className="work-surface">
      <header className="topbar"><span>OJ businesses <span className="crumb">/</span> {view === 'overview' ? 'Overview' : title}</span><span className="access-badge">{mode === 'preview' ? 'Sample workspace' : readOnly ? 'View access' : 'Shared access'}</span></header>
      {mode === 'preview' && <div className="preview-banner"><span><strong>Interactive preview</strong> Sample records. Changes stay in this browser; no messages are sent.</span><Link href="/login">Business sign in <ArrowUpRight size={14} /></Link></div>}
      {mode === 'live' && <div className="sync-status" role="status">{connectionStatus}{limited && <span>Showing the first 1,000 cards and most recent 1,000 comments. Older records remain stored.</span>}</div>}
      <main id="work-main">
        <div className="page-heading"><div><p className="eyebrow">{view === 'overview' ? 'The bigger picture' : 'Plan it. Own it. Finish it.'}</p><h1>{view === 'overview' ? 'Good work starts here' : title}<span className="heading-dot">.</span></h1><p>{view === 'overview' ? 'A clear view of what your team is moving forward.' : business === 'solutions' ? 'AI receptionists and GoHighLevel services, from discovery to support.' : business === 'exterior' ? 'Sales, field work, and customer follow-through.' : 'Everything you and Jacob are moving forward, across both businesses.'}</p></div>{!readOnly && <button className="primary" onClick={() => openCard()} disabled={pending}><Plus size={17} />New card</button>}</div>
        <div className="stats-strip"><div><span>Open work</span><strong>{active.length}<small>cards</small></strong></div><div><span>In progress</span><strong>{data.cards.filter(c => c.stage === 'In progress').length}<small>underway</small></strong></div><div><span>Needs review</span><strong>{data.cards.filter(c => c.stage === 'Review').length}<small>to check</small></strong></div><div><span>Completed</span><strong>{data.cards.filter(c => c.stage === 'Done').length}<small>finished</small></strong></div></div>
        <div className="notice" role="status" aria-live="polite">{notice}</div>
        {view === 'overview' ? <section className="overview-grid" aria-label="Business overview">{(['exterior', 'solutions'] as Business[]).map(b => <button className="business-tile" key={b} onClick={() => { setBusiness(b); setView('board'); }}><span className={`business-icon ${b}`}>{b === 'exterior' ? <Waves /> : <Sparkles />}</span><ArrowUpRight className="tile-arrow" size={20} /><h2>{businessName(b)}</h2><p>{b === 'exterior' ? 'Keep sales and field work moving.' : 'Deliver AI receptionists and client automations.'}</p><div><strong>{active.filter(c => c.business === b).length}</strong> open cards <span>Open board</span></div></button>)}<div className="next-up"><h2>Ready for attention</h2>{active.filter(c => c.priority === 'high' || c.stage === 'Review').map(c => <button key={c.id} onClick={() => openCard(c)}><span className={`business-tag ${c.business}`}>{businessName(c.business)}</span><strong>{c.title}</strong><span>{c.assignee || 'Unassigned'}<ArrowUpRight size={15} /></span></button>)}</div></section> : view === 'activity' ? <ActivityFeed events={data.activity || []} cards={data.cards} openCard={openCard} /> : <>
          <div className="board-toolbar"><div className="tabs" aria-label="Filter by business">{[['all', 'All work'], ['exterior', 'Exterior Care'], ['solutions', 'OJ Solutions']].map(([id, label]) => <button aria-pressed={business === id} className={business === id ? 'active' : ''} key={id} onClick={() => setBusiness(id)}>{label}</button>)}</div><div className="board-filters"><label className="search"><Search size={16} /><input aria-label="Search cards" placeholder="Search cards…" value={query} onChange={e => setQuery(e.target.value)} /></label><label className="owner-filter"><SlidersHorizontal size={15} /><select aria-label="Filter by assignee" value={assignee} onChange={e => setAssignee(e.target.value)}><option value="">Everyone</option>{members.map(m => <option key={m}>{m}</option>)}</select></label></div></div>
          <div className="board" aria-label="Work board">{stages.map(stage => <section key={stage} className="column" onDragOver={e => { if (!readOnly) e.preventDefault(); }} onDrop={e => { e.preventDefault(); const card = data.cards.find(c => c.id === e.dataTransfer.getData('text/plain')); if (card) move(card, stage); }}>
            <div className="column-heading"><span className={`stage-dot stage-${stages.indexOf(stage)}`} /><h2>{stage}</h2><span className="column-count">{filtered.filter(c => c.stage === stage).length}</span>{!readOnly && <button aria-label={`Add card to ${stage}`} className="icon-button" onClick={() => { openCard(); setEditing(c => c ? { ...c, stage } : c); }}><Plus size={15} /></button>}</div>
            <div className="column-cards">{filtered.filter(c => c.stage === stage).map(card => <article className="work-card" key={card.id} draggable={!readOnly && !pending} onDragStart={e => e.dataTransfer.setData('text/plain', card.id)}>
              <button className="card-open" onClick={() => openCard(card)}><div className="card-tags"><span className={`business-tag ${card.business}`}>{businessName(card.business)}</span>{card.priority === 'high' && <span className="priority-tag">High</span>}</div><h3>{card.title}</h3>{card.description && <p>{card.description}</p>}<div className="card-details">{card.checklist.length > 0 && <span><CheckSquare size={13} />{card.checklist.filter(i => i.done).length}/{card.checklist.length}</span>}{data.comments.some(c => c.card_id === card.id) && <span><MessageSquare size={13} />{data.comments.filter(c => c.card_id === card.id).length}</span>}{card.due_date && <span className="due-date">{dateLabel(card.due_date)}</span>}</div><div className="card-footer"><span>{card.assignee || 'Unassigned'}</span><span className="avatar" aria-label={card.assignee || 'Unassigned'}>{card.assignee ? card.assignee.charAt(0).toUpperCase() : '–'}</span></div></button>
              {!readOnly && <label className="move-control">Move to<select disabled={pending} aria-label={`Move ${card.title}`} value={card.stage} onChange={e => move(card, e.target.value as Stage)}>{stages.map(s => <option key={s}>{s}</option>)}</select></label>}
            </article>)}{filtered.filter(c => c.stage === stage).length === 0 && <div className="empty-column"><Circle size={19} /><p>{query || assignee ? 'No matching cards' : 'Space for what’s next'}</p></div>}</div>
          </section>)}</div><div className="board-footnote"><span><Check size={14} />Clear owners. Shared progress.</span><span>{readOnly ? 'View access' : 'Drag a card or use its Move to menu.'}</span></div>
        </>}
      </main>
    </div>
    <dialog ref={dialog} className="card-dialog" onCancel={() => setEditing(null)} onClick={e => { if (e.target === dialog.current) setEditing(null); }} aria-labelledby="card-dialog-title">
      {editing && <><div className="dialog-header"><span className={`business-tag ${editing.business}`}>{businessName(editing.business)}</span><button className="icon-button" aria-label="Close card" onClick={() => setEditing(null)}><X size={20} /></button></div><h2 id="card-dialog-title">{data.cards.some(c => c.id === editing.id) ? 'Card details' : 'Create a card'}</h2>{staleDraft && <div className="draft-warning" role="alert"><p>This card changed while you were editing. Your draft is preserved. Load the current card before saving; this replaces your draft.</p><button className="secondary" onClick={() => { if (currentEditing) setEditing(structuredClone(currentEditing)); }}>Load current card</button></div>}
      <form onSubmit={e => { e.preventDefault(); persist(editing, true); }}><label>Title<input autoFocus required maxLength={180} value={editing.title} disabled={readOnly || pending} onChange={e => patchCard({ title: e.target.value })} placeholder="What needs to happen?" /></label><label>Description<textarea rows={3} maxLength={8000} value={editing.description} disabled={readOnly || pending} onChange={e => patchCard({ description: e.target.value })} placeholder="Add the context and what done looks like." /></label>
      <div className="form-grid"><label>Business<select disabled={readOnly || pending} value={editing.business} onChange={e => patchCard({ business: e.target.value as Business })}><option value="exterior">Exterior Care</option><option value="solutions">OJ Solutions</option></select></label><label>Status<select disabled={readOnly || pending} value={editing.stage} onChange={e => patchCard({ stage: e.target.value as Stage })}>{stages.map(s => <option key={s}>{s}</option>)}</select></label><label>Assigned to<select disabled={readOnly || pending} value={editing.assignee} onChange={e => patchCard({ assignee: e.target.value })}><option value="">Unassigned</option>{members.map(m => <option key={m}>{m}</option>)}</select></label><label>Due date<input type="date" disabled={readOnly || pending} value={editing.due_date} onChange={e => patchCard({ due_date: e.target.value })} /></label></div>
      <label className="checkbox-row"><input type="checkbox" disabled={readOnly || pending} checked={editing.priority === 'high'} onChange={e => patchCard({ priority: e.target.checked ? 'high' : 'normal' })} />High priority</label><h3>Checklist</h3>{editing.checklist.map(item => <label className="checkbox-row" key={item.id}><input type="checkbox" disabled={readOnly || pending} checked={item.done} onChange={e => patchCard({ checklist: editing.checklist.map(i => i.id === item.id ? { ...i, done: e.target.checked } : i) })} />{item.text}</label>)}{!readOnly && <div className="inline-input"><input aria-label="New checklist item" maxLength={300} value={checkText} onChange={e => setCheckText(e.target.value)} placeholder="Add a checklist item" /><button type="button" className="secondary" disabled={pending || !checkText.trim() || editing.checklist.length >= 40} onClick={() => { patchCard({ checklist: [...editing.checklist, { id: crypto.randomUUID(), text: checkText.trim(), done: false }] }); setCheckText(''); }}>Add</button></div>}
      <div className="dialog-actions"><span>{mode === 'preview' ? 'Saved in this browser only' : 'Shared with your OJ team'}</span>{!readOnly && <button type="submit" className="primary" disabled={pending}>{pending ? 'Saving…' : 'Save card'}</button>}</div></form>
      <section className="comments"><h3>Conversation</h3>{data.comments.filter(c => c.card_id === editing.id).map(c => <div className="comment" key={c.id}><strong>{c.author}</strong><p>{c.body}</p></div>)}{!data.comments.some(c => c.card_id === editing.id) && <p className="quiet">Keep the discussion beside the work.</p>}{!readOnly && <div className="inline-input"><textarea aria-label="Add a comment" maxLength={4000} rows={2} value={comment} onChange={e => setComment(e.target.value)} placeholder="Add a comment…" /><button className="secondary" disabled={pending || !comment.trim()} onClick={postComment}>Post</button></div>}</section><p className="dialog-notice" role="status">{notice}</p></>}
    </dialog>
  </div>;
}

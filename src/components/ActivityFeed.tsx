import type { Activity, Card } from '@/lib/board';
export function ActivityFeed({ events, cards, openCard }: { events: Activity[]; cards: Card[]; openCard: (card: Card) => void }) {
  const actions = { card_created: 'created', card_updated: 'updated', comment_added: 'commented on' };
  return <section className="activity-feed" aria-label="Workspace activity"><h2>Recent activity</h2><p className="quiet">The latest 50 changes, recorded beside your shared work.</p>{events.length === 0 && <p>No changes recorded yet. Create or update a card to get started.</p>}{events.map(event => {
    const card = cards.find(c => c.id === event.card_id);
    return <div className="activity-row" key={event.id}><span className="avatar">{event.actor.charAt(0).toUpperCase()}</span><div><p><strong>{event.actor}</strong> {actions[event.action]} {card ? <button className="text-button" onClick={() => openCard(card)}>{card.title}</button> : 'a workspace card'}</p><time dateTime={event.created_at}>{new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(event.created_at))} UTC</time></div></div>;
  })}</section>;
}

'use server';
import { redirect } from 'next/navigation';
import { requireMember, supabaseServer } from '@/lib/supabase';
import { validateCard, type Card, type Comment } from '@/lib/board';
export async function saveCard(input: Card): Promise<Card> {
  const card = validateCard(input);
  const { client, user } = await requireMember(card.organization_id, true);
  const { data: existing, error: readError } = await client.from('oj_cards').select('id,revision').eq('id', card.id).eq('organization_id', card.organization_id).maybeSingle();
  if (readError) throw new Error('Could not load this card. Try again.');
  if (existing && existing.revision !== card.revision) throw new Error('This card changed. Reload the board before saving.');
  if (!existing && card.revision !== 0) throw new Error('This card is no longer available. Reload the board.');
  if (card.assignee) {
    const { data: assigned } = await client.from('oj_memberships').select('user_id').eq('organization_id', card.organization_id).eq('display_name', card.assignee).maybeSingle();
    if (!assigned) throw new Error('Choose a current workspace member.');
  }
  const fields = { title: card.title.trim(), description: card.description, business: card.business, stage: card.stage, priority: card.priority, assignee: card.assignee, due_date: card.due_date || null, checklist: card.checklist, revision: card.revision };
  const query = existing
    ? client.from('oj_cards').update(fields).eq('id', card.id).eq('organization_id', card.organization_id).eq('revision', card.revision)
    : client.from('oj_cards').insert({ ...fields, id: card.id, organization_id: card.organization_id, created_by: user.id });
  const { data, error } = await query.select().single();
  if (error || !data) throw new Error('Could not save the card. It may have changed; reload the board and try again.');
  return { ...data, due_date: data.due_date || '' } as Card;
}
export async function addComment(cardId: string, organizationId: string, body: string): Promise<Comment> {
  if (!body.trim() || body.length > 4000) throw new Error('Write a comment of up to 4,000 characters.');
  const { client, user, member } = await requireMember(organizationId, true);
  const { data, error } = await client.from('oj_comments').insert({ card_id: cardId, organization_id: organizationId, body: body.trim(), author_id: user.id }).select().single();
  if (error || !data) throw new Error('Could not add the comment. Check your access and try again.');
  return { ...data, author: member.display_name } as Comment;
}
export async function signOut() {
  const client = await supabaseServer();
  await client.auth.signOut();
  redirect('/login');
}

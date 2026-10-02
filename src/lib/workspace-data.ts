import 'server-only';
import { requireMember } from '@/lib/supabase';
import type { Card, Comment, Activity, WorkspaceSnapshot } from '@/lib/board';
export async function loadWorkspace(org: string): Promise<WorkspaceSnapshot> {
  const { client, member } = await requireMember(org);
  const [cards, comments, members, activity] = await Promise.all([
    client.from('oj_cards').select('*').eq('organization_id', org).order('created_at').limit(1000),
    client.from('oj_comments').select('*').eq('organization_id', org).order('created_at', { ascending: false }).limit(1000),
    client.from('oj_memberships').select('user_id,display_name').eq('organization_id', org).order('display_name'),
    client.from('oj_activity').select('id,card_id,actor_id,action,created_at').eq('organization_id', org).order('created_at', { ascending: false }).limit(50),
  ]);
  if (cards.error || comments.error || members.error || activity.error) throw new Error('Could not load the workspace.');
  const names = new Map((members.data || []).map(m => [m.user_id, m.display_name]));
  return {
    members: [...names.values()], role: member.role as WorkspaceSnapshot['role'], displayName: member.display_name,
    limited: (cards.data?.length || 0) >= 1000 || (comments.data?.length || 0) >= 1000,
    data: {
      cards: (cards.data || []).map(c => ({ ...c, due_date: c.due_date || '' })) as Card[],
      comments: (comments.data || []).reverse().map(c => ({ ...c, author: names.get(c.author_id) || 'Former member' })) as Comment[],
      activity: (activity.data || []).map(a => ({ ...a, actor: names.get(a.actor_id) || 'Former member' })) as Activity[],
    },
  };
}

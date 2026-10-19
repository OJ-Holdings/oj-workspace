import 'server-only';
import { requireMember } from '@/lib/supabase';
import type { Card, Comment, Activity, WorkspaceSnapshot } from '@/lib/board';
import type { Dashboard } from '@/lib/dashboard';
import { addExternalFigures } from '@/lib/external';
import { loadWork } from '@/lib/work-data';

type Client = Awaited<ReturnType<typeof requireMember>>['client'];

/**
 * Everything beyond the task board. Returns null if any table cannot be read
 * (most likely the dashboard tables have not been added to the database yet),
 * so the board keeps working and the other pages say what is missing.
 */
async function loadDashboard(client: Client, org: string, names: Map<string, string>): Promise<Dashboard | null> {
  const [messages, leads, finance, metrics, events, documents] = await Promise.all([
    client.from('oj_messages').select('id,venture,author_id,body,created_at').eq('organization_id', org).order('created_at', { ascending: false }).limit(200),
    client.from('oj_leads').select('id,venture,name,contact,stage,value,source,notes,created_at').eq('organization_id', org).order('created_at', { ascending: false }).limit(1000),
    client.from('oj_finance_entries').select('id,venture,kind,amount,occurred_on,category,note').eq('organization_id', org).order('occurred_on', { ascending: false }).limit(2000),
    client.from('oj_metric_entries').select('id,venture,label,value,unit,measured_on,note').eq('organization_id', org).order('measured_on', { ascending: false }).limit(1000),
    client.from('oj_events').select('id,venture,title,starts_at,ends_at,all_day,location,notes,source').eq('organization_id', org).order('starts_at').limit(1000),
    client.from('oj_documents').select('id,venture,name,tag,storage_path,size_bytes,mime,uploaded_by,created_at').eq('organization_id', org).order('created_at', { ascending: false }).limit(500),
  ]);
  if (messages.error || leads.error || finance.error || metrics.error || events.error || documents.error) return null;
  const who = (id: string) => names.get(id) || 'Former member';
  return {
    messages: (messages.data || []).map(m => ({ id: m.id, venture: m.venture, body: m.body, created_at: m.created_at, author: who(m.author_id) })),
    leads: (leads.data || []).map(l => ({ ...l, value: l.value === null ? null : Number(l.value) })),
    finance: (finance.data || []).map(f => ({ ...f, amount: Number(f.amount) })),
    metricEntries: (metrics.data || []).map(m => ({ ...m, value: Number(m.value) })),
    events: events.data || [],
    documents: (documents.data || []).map(d => ({ ...d, size_bytes: Number(d.size_bytes), uploaded_by: who(d.uploaded_by) })),
  } as Dashboard;
}

export async function loadWorkspace(org: string): Promise<WorkspaceSnapshot> {
  const { client, member, user } = await requireMember(org);
  const [cards, comments, members, activity] = await Promise.all([
    client.from('oj_cards').select('*').eq('organization_id', org).order('created_at').limit(1000),
    client.from('oj_comments').select('*').eq('organization_id', org).order('created_at', { ascending: false }).limit(1000),
    client.from('oj_memberships').select('user_id,display_name').eq('organization_id', org).order('display_name'),
    client.from('oj_activity').select('id,card_id,actor_id,action,created_at').eq('organization_id', org).order('created_at', { ascending: false }).limit(50),
  ]);
  if (cards.error || comments.error || members.error || activity.error) throw new Error('Could not load the workspace.');
  const names = new Map((members.data || []).map(m => [m.user_id, m.display_name]));
  const [dashboard, work] = await Promise.all([
    loadDashboard(client, org, names),
    // Sessions and scores are for the partners; viewers get neither.
    member.role === 'viewer' ? null : loadWork(client, org, user.id),
  ]);
  return {
    members: [...names.values()], role: member.role as WorkspaceSnapshot['role'], displayName: member.display_name,
    limited: (cards.data?.length || 0) >= 1000 || (comments.data?.length || 0) >= 1000,
    dashboard: dashboard && await addExternalFigures(client, dashboard, member.role === 'owner'),
    work,
    data: {
      cards: (cards.data || []).map(c => ({ ...c, due_date: c.due_date || '' })) as Card[],
      comments: (comments.data || []).reverse().map(c => ({ ...c, author: names.get(c.author_id) || 'Former member' })) as Comment[],
      activity: (activity.data || []).map(a => ({ ...a, actor: names.get(a.actor_id) || 'Former member' })) as Activity[],
    },
  };
}

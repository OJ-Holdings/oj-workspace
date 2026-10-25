import 'server-only';
import type { GhlCall, GhlContact, GhlData, GhlOpportunity, GhlAppointment } from './ghl';

// Reads the OJ Solutions sub-account through GoHighLevel's API. GET requests
// only: nothing here creates, changes or sends anything. The token never
// leaves the server.

const host = 'https://services.leadconnectorhq.com';
const env = () => ({ token: process.env.GHL_ACCESS_TOKEN, location: process.env.GHL_LOCATION_ID });
export const ghlConfigured = () => { const e = env(); return Boolean(e.token && e.location); };

async function get<T>(path: string, version = '2021-07-28'): Promise<T> {
  const response = await fetch(`${host}${path}`, { cache: 'no-store', signal: AbortSignal.timeout(15000), headers: { Authorization: `Bearer ${env().token}`, Version: version, Accept: 'application/json' } });
  if (!response.ok) throw new Error(`GoHighLevel answered ${response.status} for ${path.split('?')[0]}.`);
  return await response.json() as T;
}

type RawContact = { id: string; contactName?: string; firstName?: string; lastName?: string; companyName?: string; type?: string; tags?: string[]; dateAdded?: string };
type RawOpportunity = { id: string; name?: string; monetaryValue?: number | null; status?: string; pipelineStageId?: string; updatedAt?: string; contact?: { name?: string; companyName?: string } };
type RawConversation = { id: string; fullName?: string; contactName?: string };
type RawMessage = { id: string; messageType?: string; direction?: string; status?: string; dateAdded?: string; meta?: { call?: { duration?: number; status?: string } } };

const conversationLimit = 50;
type RawEvent = { id?: string; title?: string; startTime?: string; endTime?: string; appointmentStatus?: string; contactId?: string; calendarId?: string };
async function readConsultations(location: string): Promise<{ appointments: GhlAppointment[]; configured: boolean }> {
  const calendarId = process.env.GHL_BOOKING_CALENDAR_ID?.trim();
  if (!calendarId) return { appointments: [], configured: false };
  // Read a bounded future window from the same calendar that the website uses.
  const start = Date.now();
  const end = start + 31 * 86400000;
  const query = new URLSearchParams({ locationId: env().location!, calendarId, startTime: String(start), endTime: String(end) });
  const response = await get<{ events?: RawEvent[] }>(`/calendars/events?${query}`, 'v3');
  return { configured: true, appointments: (response.events ?? []).filter(e => e.id && e.startTime).map(e => ({
    id: e.id!, title: e.title ?? '15-minute consultation', startsAt: e.startTime!, endsAt: e.endTime ?? '',
    status: e.appointmentStatus ?? 'scheduled', contactId: e.contactId ?? '', calendarId: e.calendarId ?? calendarId,
  })).sort((a, b) => a.startsAt.localeCompare(b.startsAt)) };
}
let cached: { data: GhlData; at: number } | null = null;

/** Contacts, the pipeline and calls. Cached for five minutes. */
export async function readGhl(): Promise<GhlData> {
  if (cached && Date.now() - cached.at < 300000) return cached.data;
  const location = encodeURIComponent(env().location!);
  // ponytail: first 100 contacts, 100 deals and the 50 most recent conversations; the screens say when there are more. Add paging when the account outgrows it.
  const [contacts, pipelines, opportunities, conversations, consultations] = await Promise.all([
    get<{ contacts?: RawContact[]; meta?: { total?: number } }>(`/contacts/?locationId=${location}&limit=100`),
    get<{ pipelines?: { stages?: { id: string; name: string }[] }[] }>(`/opportunities/pipelines?locationId=${location}`),
    get<{ opportunities?: RawOpportunity[]; meta?: { total?: number } }>(`/opportunities/search?location_id=${location}&limit=100`),
    get<{ conversations?: RawConversation[]; total?: number }>(`/conversations/search?locationId=${location}&limit=${conversationLimit}&sortBy=last_message_date&sort=desc`, '2021-04-15'),
    readConsultations(location).catch(() => ({ appointments: [] as GhlAppointment[], configured: true, error: true })),
  ]);
  const stageList = (pipelines.pipelines ?? []).flatMap(p => p.stages ?? []);
  const stageName = new Map(stageList.map(s => [s.id, s.name]));

  // A call is a message inside a conversation, so each conversation is read in turn, ten at a time.
  const calls: GhlCall[] = [];
  const list = conversations.conversations ?? [];
  for (let i = 0; i < list.length; i += 10) {
    const batch = await Promise.all(list.slice(i, i + 10).map(async c => {
      const body = await get<{ messages?: { messages?: RawMessage[] } }>(`/conversations/${encodeURIComponent(c.id)}/messages?limit=50`, '2021-04-15');
      return (body.messages?.messages ?? []).filter(m => m.messageType === 'TYPE_CALL').map((m): GhlCall => ({
        id: m.id, contact: c.fullName || c.contactName || 'Unknown caller', direction: m.direction ?? '', status: m.meta?.call?.status ?? m.status ?? '',
        seconds: typeof m.meta?.call?.duration === 'number' ? m.meta.call.duration : null, at: m.dateAdded ?? '',
      }));
    }));
    calls.push(...batch.flat());
  }

  const data: GhlData = {
    appointments: consultations.appointments,
    appointmentsConfigured: consultations.configured,
    appointmentsError: 'error' in consultations && consultations.error === true,
    contacts: (contacts.contacts ?? []).map((c): GhlContact => ({ id: c.id, name: c.contactName || [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Unnamed', company: c.companyName ?? '', type: c.type ?? '', tags: c.tags ?? [], added: c.dateAdded ?? '' })),
    contactsTotal: contacts.meta?.total ?? contacts.contacts?.length ?? 0,
    stages: stageList.map(s => s.name),
    opportunities: (opportunities.opportunities ?? []).map((o): GhlOpportunity => ({
      id: o.id, name: o.name ?? 'Untitled deal', value: typeof o.monetaryValue === 'number' ? o.monetaryValue : null, status: o.status ?? '',
      stage: stageName.get(o.pipelineStageId ?? '') ?? 'Unknown stage', contact: o.contact?.companyName || o.contact?.name || '', updated: o.updatedAt ?? '',
    })),
    opportunitiesTotal: opportunities.meta?.total ?? opportunities.opportunities?.length ?? 0,
    calls: calls.filter(c => c.at).sort((a, b) => b.at.localeCompare(a.at)),
    conversationsRead: list.length, conversationsTotal: conversations.total ?? list.length,
    fetchedAt: new Date().toISOString(),
  };
  cached = { data, at: Date.now() };
  return data;
}

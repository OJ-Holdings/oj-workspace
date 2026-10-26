import { effectiveOutreachStatus, outreachStatuses, type OutreachProspect, type OutreachStatus } from './outreach';

const contactedStatuses: OutreachStatus[] = ['Emailed', 'DMed', 'Emailed + DMed', 'Replied', 'Demo Booked', 'Not Interested'];

/** Where the imported prospects stand. Counts only: no rates are shown when the denominator is zero. */
export function funnel(prospects: Pick<OutreachProspect, 'outreach_status' | 'source_status'>[]) {
  const byStatus = Object.fromEntries(outreachStatuses.map(s => [s, 0])) as Record<OutreachStatus, number>;
  for (const p of prospects) byStatus[effectiveOutreachStatus(p)]++;
  const contacted = contactedStatuses.reduce((n, s) => n + byStatus[s], 0);
  const replied = byStatus.Replied + byStatus['Demo Booked'];
  return { total: prospects.length, contacted, replied, demos: byStatus['Demo Booked'], byStatus,
    replyRate: contacted ? replied / contacted : null, demoRate: replied ? byStatus['Demo Booked'] / replied : null };
}

export type NextAction = { id: string; text: string; tab: string; tone: 'urgent' | 'normal' };
/** The short list of what to do now, most pressing first. */
export function nextActions(input: {
  goal: number; done: number; hour: number; replies: number; consultationsRequested: number;
  email: { installed: boolean; running: boolean; label: string } | null; sundayOff?: boolean;
}): NextAction[] {
  const out: NextAction[] = [];
  if (input.replies > 0) out.push({ id: 'replies', tab: 'warm', tone: 'urgent', text: `${input.replies} ${input.replies === 1 ? 'person has' : 'people have'} replied. Answer them while it is warm.` });
  if (input.consultationsRequested > 0) out.push({ id: 'requests', tab: 'consultations', tone: 'urgent', text: `${input.consultationsRequested} website ${input.consultationsRequested === 1 ? 'request needs' : 'requests need'} a yes or no.` });
  const left = input.goal - input.done;
  if (left > 0 && !input.sundayOff) out.push({ id: 'dms', tab: 'dms', tone: input.hour >= 18 ? 'urgent' : 'normal', text: `${left} ${left === 1 ? 'DM' : 'DMs'} left for today's quest.` });
  if (input.email && !input.email.installed) out.push({ id: 'email-install', tab: 'email', tone: 'normal', text: 'Install the email engine tables to start automated outreach.' });
  else if (input.email && !input.email.running) out.push({ id: 'email-off', tab: 'email', tone: 'urgent', text: `Email engine: ${input.email.label.toLowerCase()}. Open it to fix.` });
  return out;
}

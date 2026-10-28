import type { JobItem } from '@/app/workspace/exterior-actions';

export type Intent = { id: string; label: string; href: string; external?: boolean };

const VERBS: Record<string, 'complete' | 'invoice' | 'cost' | 'directions'> = {
  complete: 'complete', done: 'complete', finish: 'complete', finished: 'complete',
  invoice: 'invoice', bill: 'invoice',
  log: 'cost', expense: 'cost', spent: 'cost', cost: 'cost',
  directions: 'directions', navigate: 'directions', map: 'directions',
};
const KINDS: [RegExp, string][] = [
  [/^(chem|chemical|chemicals|soap|sh|supplies|supply|materials|material)$/, 'materials'],
  [/^(gas|fuel|diesel)$/, 'fuel'],
  [/^(labor|labour|help|wage|wages|helper)$/, 'labor'],
  [/^(equipment|repair|part|parts|tool|tools)$/, 'equipment'],
];
const FILLER = new Set(['on', 'for', 'the', 'job', 'to', 'at', 'of', 'a', 'my', 'dollars', 'bucks']);
const dayNum = (iso: string) => Date.parse(`${iso}T12:00:00Z`) / 86_400_000;

/**
 * The command bar's "do it" lines. A leading verb (complete, invoice, log, directions) plus a customer name from the booked jobs gives a one-tap action:
 * open that job, start its invoice, log a cost on it, or get directions. Names match loosely; with several matches the job closest to today comes first.
 * Nothing here saves anything: each action only opens the screen where the person confirms it.
 */
export function commandIntents(query: string, jobs: JobItem[], today: string, base: string): Intent[] {
  const words = query.toLowerCase().replace(/[$,]/g, ' ').split(/\s+/).filter(Boolean);
  const verb = VERBS[words[0] ?? ''];
  if (!verb) return [];
  let amount: string | null = null, kind = 'other';
  const rest: string[] = [];
  for (const w of words.slice(1)) {
    if (amount === null && /^\d+(\.\d{1,2})?$/.test(w)) { amount = w; continue; }
    const k = KINDS.find(([re]) => re.test(w));
    if (verb === 'cost' && k) { kind = k[1]; continue; }
    if (!FILLER.has(w)) rest.push(w);
  }
  const needle = rest.join(' ');
  if (!needle) return [];
  const live = jobs.filter(j => j.status !== 'cancelled' && j.status !== 'denied' && j.name.toLowerCase().includes(needle));
  const near = [...live].sort((a, b) => Math.abs(dayNum(a.date) - dayNum(today)) - Math.abs(dayNum(b.date) - dayNum(today))).slice(0, 3);
  const when = (j: JobItem) => new Date(`${j.date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return near.flatMap((j): Intent[] => {
    if (verb === 'complete') return [{ id: `complete-${j.id}`, label: `Complete job: ${j.name} (${when(j)})`, href: `${base}/b/exterior/bookings?booking=${encodeURIComponent(j.id)}` }];
    if (verb === 'invoice') return [{ id: `invoice-${j.id}`, label: `Invoice ${j.name}`, href: `${base}/invoices?lead=${encodeURIComponent(j.lead_id)}` }];
    if (verb === 'directions') return j.address ? [{ id: `dir-${j.id}`, label: `Directions to ${j.name}`, href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(j.address)}`, external: true }] : [];
    if (amount === null) return [];
    return [{ id: `cost-${j.id}`, label: `Log $${amount} ${kind} on ${j.name} (${when(j)})`, href: `${base}/b/exterior/bookings?booking=${encodeURIComponent(j.id)}&cost=${amount}&kind=${kind}` }];
  });
}

// Reads Local Services Ads messages. Rule based and local: no AI or paid service.
// - extractLeadFields fills empty lead fields from the CUSTOMER's messages only.
//   Anything with the same input and output (an AI extractor later) can replace it;
//   the sync only calls it through the `Extractor` type.
// - findAmounts, findDates and confirms feed the one-tap Quoted and Scheduled
//   suggestions. They never change a lead by themselves.

import { services } from './exterior-ops';

/** The Workspace service list (the same one the lead form and reports use), plus Unknown. */
export const LEAD_SERVICES = services;
export const UNKNOWN_SERVICE = 'Unknown';

export type ExtractInput = { messages: string[] };
export type Field = 'address' | 'phone' | 'email' | 'name' | 'service';
export type Extracted = Partial<Record<Field, string>>;
/** What was found, the customer line each value came from, and guesses held back because they look wrong. */
export type ExtractResult = { fields: Extracted; from: Partial<Record<Field, string>>; flagged: { field: Field; value: string; line: string; why: string }[] };
export type Extractor = (input: ExtractInput) => ExtractResult;

/** The sentence around a position, for showing where a value came from. */
export function lineAround(text: string, at: number) {
  const starts = ['\n', '. ', '! ', '? '].map(s => { const i = text.lastIndexOf(s, Math.max(0, at - 1)); return i < 0 ? 0 : i + s.length; });
  const stops = ['\n', '. ', '! ', '? '].map(s => text.indexOf(s, at)).filter(i => i >= 0);
  return text.slice(Math.max(...starts), stops.length ? Math.min(...stops) + 1 : text.length).trim().slice(0, 160);
}
/** Towns and cities in and around the service area. */
export const TOWNS = ['Kenosha', 'Racine', 'Pleasant Prairie', 'Bristol', 'Somers', 'Salem', 'Paddock Lake', 'Twin Lakes', 'Silver Lake', 'Union Grove', 'Mount Pleasant', 'Sturtevant', 'Caledonia', 'Zion', 'Waukegan', 'Gurnee', 'Antioch', 'Lindenhurst', 'Winthrop Harbor', 'Lake Geneva', 'Burlington', 'Mukwonago', 'Waukesha', 'New Berlin', 'Muskego', 'Franklin', 'Oak Creek', 'Milwaukee', 'Chicago'];
const placeNames = new RegExp(`^(${[...TOWNS, 'Wisconsin', 'Illinois'].join('|')})$`, 'i');
const townPattern = new RegExp(`\\b(${TOWNS.join('|')})\\b`, 'gi');
/** The last service-area town named in a text ("1234 Sheridan Rd, Kenosha WI" -> Kenosha), as the list spells it. */
export function findTown(text: string | null | undefined): string | null {
  const last = [...(text ?? '').matchAll(townPattern)].at(-1)?.[1];
  return last ? TOWNS.find(t => t.toLowerCase() === last.toLowerCase().replace(/\s+/g, ' ')) ?? null : null;
}
const dayWords = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December|Today|Tomorrow|Noon|Midnight|AM|PM)$/i;

/* ------------------------------ Service ------------------------------ */

// Google's LSA service ids, as returned for this account (category xcat:service_area_business_window_cleaner).
const serviceIds: Record<string, string> = {
  window_cleaning: 'Window Cleaning', window_washing: 'Window Cleaning',
  power_pressure_washing: 'Pressure Washing', pressure_washing: 'Pressure Washing', power_washing: 'Pressure Washing',
  gutter_cleaning: 'Gutter Cleaning', roof_cleaning: 'Roof Cleaning', house_washing: 'House Washing', deck_cleaning: 'Deck Cleaning', driveway_cleaning: 'Driveway Cleaning',
};
// Words, checked in order: specific surfaces first, plain pressure washing last.
const serviceWords: [string, RegExp][] = [
  ['Roof Cleaning', /roof/i],
  ['Gutter Cleaning', /gutter/i],
  ['Window Cleaning', /window/i],
  ['Deck Cleaning', /\bdeck|fence|porch/i],
  ['Driveway Cleaning', /driveway|sidewalk|walkway|concrete|patio|paver|garage floor/i],
  ['House Washing', /\bhouse\b|siding|soft ?wash|exterior wash|vinyl|stucco/i],
  ['Pressure Washing', /pressure|power ?wash/i],
];
const byWords = (text: string) => serviceWords.find(([, pattern]) => pattern.test(text))?.[0] ?? null;

/** A Google service id (known ids first, then the words in an unknown id). */
export const serviceFromId = (id: string | null | undefined) => !id ? null : serviceIds[id.toLowerCase()] ?? byWords(id.replace(/[_:-]+/g, ' '));
/** The first message that names a service. */
export const serviceFromText = (...texts: (string | null | undefined)[]) => { for (const t of texts) { const s = t ? byWords(t) : null; if (s) return s; } return null; };

/**
 * Which service a lead is for: Google's service id first, then the customer's own
 * words, then the account category as a last resort. A call lead with no service id
 * is Unknown (a call has no words to read, and the category is the business, not the job).
 */
export function serviceFor(lead: { serviceId?: string | null; category?: string | null; type?: string | null; messages: string[] }): { service: string; from: 'service_id' | 'message' | 'category' | 'none' } {
  const fromId = serviceFromId(lead.serviceId);
  if (fromId) return { service: fromId, from: 'service_id' };
  if (lead.type === 'PHONE_CALL') return { service: UNKNOWN_SERVICE, from: 'none' };
  const fromText = serviceFromText(...lead.messages);
  if (fromText) return { service: fromText, from: 'message' };
  const fromCategory = lead.category ? byWords(lead.category.replace(/[_:-]+/g, ' ')) : null;
  return fromCategory ? { service: fromCategory, from: 'category' } : { service: UNKNOWN_SERVICE, from: 'none' };
}

/* ------------------------------ Address ------------------------------ */

const suffix = /^(St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Ln|Lane|Ct|Court|Cir|Circle|Blvd|Boulevard|Way|Pl|Place|Pkwy|Parkway|Ter|Terrace|Trl|Trail|Hwy|Highway)\.?$/i;
// A house number: a Wisconsin grid number (S94W23640, N12W34567, W240N3065) or a plain one.
const houseNumber = /\b([NSEW]\s?\d{1,4}\s?[NSEW]\s?\d{2,6}|\d{1,6})\b/gi;
// After the street: an optional capitalised town, then an optional WI or IL and ZIP.
const townWord = "(?!(?:WI|IL|Wisconsin|Illinois)\\b)[A-Z][a-zA-Z'.-]+";
const place = new RegExp(`^(?:,?\\s+(${townWord}(?:\\s+${townWord}){0,2}))?(?:,?\\s+(WI|IL|Wi|Il|wi|il|Wisconsin|Illinois)\\b)?(?:,?\\s+(\\d{5}))?`);
const states: Record<string, string> = { wi: 'WI', il: 'IL', wisconsin: 'WI', illinois: 'IL' };
const notStreetWords = new Set(['the', 'a', 'an', 'by', 'on', 'in', 'of', 'and', 'or', 'my', 'our', 'your', 'is', 'are', 'was', 'to', 'for', 'with', 'at', 'it', 'window', 'windows', 'gutter', 'gutters', 'house', 'home', 'story', 'stories', 'sq', 'ft', 'feet', 'hours', 'days', 'weeks', 'times', 'cars', 'dollars', 'years', 'minutes', 'panes', 'screens']);
const addressCue = /(?:address(?:\s+is)?|located at|live at|living at|(?:house|home|property|place) is at|we(?:'re| are) at|i'?m at|at)\s*:?\s*$/i;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A lone direction letter ("W", "N.") is not a street name.
const loneDirection = /^[NSEW]\.?$/i;

/**
 * Every street address in a customer message, in order: number (or Wisconsin grid
 * number), street name and suffix, then any town, WI or IL and ZIP. Without a suffix
 * it is taken only for a grid number, after "address is" / "at", or when a WI/IL, ZIP
 * or local town follows. A number with no street name word after it ("12345 W.") is
 * not an address: nothing is taken rather than a cut-off one.
 */
function* addressesIn(text: string): Generator<{ value: string; at: number }> {
  for (const m of text.matchAll(houseNumber)) {
    const at = m.index ?? 0, raw = m[1], grid = /^[NSEW]/i.test(raw);
    const before = text.slice(Math.max(0, at - 1), at), after = text.slice(at + raw.length);
    if (/[$\d/:.#,-]/.test(before) && before !== '') continue;
    // A ZIP (5 digits right after WI or IL) is not a house number.
    if (!grid && raw.length === 5 && /\b(?:WI|IL|Wisconsin|Illinois),?\s*$/i.test(text.slice(Math.max(0, at - 12), at))) continue;
    if (!grid && /^\s*(?:[:%/]|-\s*\d|x\s*\d|(?:am|pm|a\.m|p\.m|st|nd|rd|th|k|ft|sq|%)\b)/i.test(after)) continue;
    const cut = (stop: RegExp) => after.split(stop)[0].trim().split(/\s+/).filter(Boolean).slice(0, 6);
    const sentence = cut(/[,;!?\n]|\.\s|\.$/);
    // Street name words are plain words (any letters, ' or ’, a 1/2): no brackets or symbols, and no second house number inside.
    const plain = (w: string) => (/^[\p{L}0-9'’.-]+$/u.test(w) || /^\d\/\d$/.test(w)) && !/^\d{3,}$/.test(w) && !notStreetWords.has(w.toLowerCase().replace(/\.$/, ''));
    const suffixed = (words: string[], most: number) => { const i = words.findIndex((w, j) => j > 0 && suffix.test(w)); return i > 0 && i <= most && words.slice(0, i).every(plain) ? words.slice(0, i + 1) : null; };
    // Before a suffix, a period after a lone direction letter does not end the street ("12345 W. Main St"); without a suffix it ends the sentence ("12345 W. Thanks").
    const named = suffixed(sentence, 6) ?? suffixed(cut(/[,;!?\n]|(?<!\b[NSEWnsew])\.(?:\s|$)/), 4);
    let street: string[] = [], strong = false;
    if (named) { street = named; strong = true; }
    else {
      // Stop at a town or WI/IL so "1234 Sheridan Kenosha WI" keeps Kenosha as the town.
      for (const w of sentence) { if (street.length < 3 && (/^\p{Lu}[\p{L}'’.-]*$/u.test(w) || /^\d+(st|nd|rd|th)$/i.test(w)) && !dayWords.test(w) && !notStreetWords.has(w.toLowerCase()) && !/^(WI|IL)$/i.test(w) && !placeNames.test(w)) street.push(w); else break; }
      if (!street.length || (!grid && raw.length < 2)) continue;
    }
    if (!(strong ? street.slice(0, -1) : street).some(w => !loneDirection.test(w))) continue;
    const streetText = `${grid ? raw.replace(/\s+/g, '').toUpperCase() : raw} ${street.join(' ')}`;
    const end = at + raw.length + (new RegExp(`^\\s*${street.map(escape).join('\\s+')}`).exec(after)?.[0].length ?? 0);
    const rest = place.exec(text.slice(end));
    const town = rest?.[1] && !/^(I|We|And|But|Thanks|Thank|Please|Can|Could|Would)$/.test(rest[1].split(' ')[0]) ? rest[1].replace(/\.+$/, '') : null;
    const state = rest?.[2] ? states[rest[2].toLowerCase()] : null, zip = rest?.[3] ?? null;
    if (!strong && !grid && !addressCue.test(text.slice(Math.max(0, at - 30), at)) && !state && !zip && !(town && placeNames.test(town))) continue;
    yield { value: [streetText, town, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', '), at };
  }
}
/** The first street address in a customer message (see addressesIn). */
export function findAddress(text: string): { value: string; at: number } | null {
  for (const found of addressesIn(text)) return found;
  return null;
}
/** Every street address in a customer message, each once ("100 9th Ave ... 120 9th Ave" gives both). */
export function findAddresses(text: string): { value: string; at: number }[] {
  const out: { value: string; at: number }[] = [];
  for (const found of addressesIn(text)) if (!out.some(o => o.value === found.value)) out.push(found);
  return out;
}

/* ------------------------------ Phone, email, name ------------------------------ */

function findPhone(text: string) {
  const m = /(?:\+?1[\s.-]?)?\(?\b(\d{3})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})\b/.exec(text);
  return m ? { value: `+1${m[1]}${m[2]}${m[3]}`, at: m.index } : null;
}
function findEmail(text: string) {
  const m = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/.exec(text);
  return m ? { value: m[0].toLowerCase(), at: m.index } : null;
}

// Words that follow "I'm" / "this is" but are not names.
const notNames = new Set(['Interested', 'Looking', 'Wondering', 'Not', 'Just', 'Hoping', 'Trying', 'Available', 'Sorry', 'Here', 'Good', 'Free', 'Home', 'Getting', 'Also', 'Still', 'Ready', 'Out', 'In', 'At', 'On', 'The', 'A', 'An', 'Calling', 'Reaching', 'Messaging', 'Texting', 'Wanting', 'Needing', 'Curious', 'Thinking', 'Planning', 'Moving', 'Selling', 'Buying', 'Glad', 'Happy', 'Fine', 'Great', 'Okay', 'Ok', 'Sure', 'Going', 'Gonna', 'About', 'So', 'Very', 'Really', 'Actually', 'Currently', 'Usually', 'Back', 'Off', 'Done', 'Busy', 'Sending', 'Following', 'Checking', 'Asking', 'Located', 'Retired', 'Able', 'Unable', 'Assuming', 'Guessing']);
// A capitalised word after "this is" can still be clearly not a person: held back and shown, never saved.
const looksWrong: [RegExp, string][] = [
  [/^(Oscar|Jacob|OJ|Exterior|Care)\b/i, 'one of our own names'],
  [placeNames, 'a place, not a person'],
  [/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December)\b/i, 'a day or month'],
  [/^(Window|Windows|Gutter|Gutters|House|Roof|Deck|Driveway|Patio|Pressure|Power|Google|Local|Services|LSA|Ads)\b/i, 'a service or Google word'],
  [/^(Hi|Hello|Hey|Thanks|Thank|Yes|No|Yeah|Please|Dear|Mr|Mrs|Ms|Dr)$/i, 'a greeting or title, not a name'],
];
const namePattern = /(?:\b[Mm]y name is|\b[Tt]his is|\bI'?m|\bI am)\s+([A-Z][a-z'-]+(?:\s+[A-Z][a-z'-]+)?)/;
function findName(text: string): { name: string; at: number } | { flagged: string; at: number; why: string } | null {
  const m = namePattern.exec(text);
  if (!m) return null;
  const words = m[1].split(/\s+/);
  if (notNames.has(words[0])) return null;
  const name = words.filter(w => !notNames.has(w)).join(' ');
  const wrong = looksWrong.find(([pattern]) => pattern.test(name) || pattern.test(words[0]));
  return wrong ? { flagged: name, at: m.index, why: wrong[1] } : { name, at: m.index };
}

/** The first match in each field, earliest message first. Give it the customer's messages only. */
export const extractLeadFields: Extractor = ({ messages }) => {
  const result: ExtractResult = { fields: {}, from: {}, flagged: [] };
  const take = (field: Field, found: { value: string; at: number } | null, text: string) => {
    if (!found || result.fields[field]) return;
    result.fields[field] = found.value;
    result.from[field] = lineAround(text, found.at);
  };
  for (const text of messages) {
    if (!text) continue;
    take('address', findAddress(text), text);
    take('phone', findPhone(text), text);
    take('email', findEmail(text), text);
    if (!result.fields.name) {
      const found = findName(text);
      if (found && 'name' in found) take('name', { value: found.name, at: found.at }, text);
      else if (found) result.flagged.push({ field: 'name', value: found.flagged, line: lineAround(text, found.at), why: found.why });
    }
    const service = serviceFromText(text);
    if (service) take('service', { value: service, at: Math.max(0, text.search(serviceWords.find(([s]) => s === service)![1])) }, text);
  }
  return result;
};

/* ------------------------------ Quote and schedule suggestions ------------------------------ */

// An amount next to one of these words is not a quote ("$50 off", "$100 deposit", "minimum $150").
const notQuote = /^(off|discount|discounts|discounted|minimum|min|deposit|deposits|down|save|savings|coupon|credit|rebate)$/i;
/** Dollar amounts in a message ("$600", "$1,250.00", "600 dollars"), skipping discounts, minimums and deposits. */
export function findAmounts(text: string): { amount: number; line: string }[] {
  const out: { amount: number; line: string }[] = [];
  for (const m of text.matchAll(/\$\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{2}))?|\b(\d{1,3}(?:,\d{3})+|\d{2,6})(?:\.\d{2})?\s*(?:dollars|bucks)\b/gi)) {
    const amount = Number((m[1] ?? m[3]).replace(/,/g, '')) + (m[2] ? Number(m[2]) / 100 : 0);
    if (!(amount >= 20 && amount <= 50_000)) continue;
    const at = m.index ?? 0;
    const near = [
      ...text.slice(Math.max(0, at - 40), at).split(/[.!?\n;,]/).at(-1)!.trim().split(/\s+/).slice(-2),
      ...text.slice(at + m[0].length).split(/[.!?\n;,]/)[0].trim().split(/\s+/).slice(0, 2),
    ].map(w => w.replace(/[^a-z]/gi, ''));
    if (near.some(w => notQuote.test(w))) continue;
    if (!out.some(o => o.amount === amount)) out.push({ amount, line: lineAround(text, at) });
  }
  return out;
}

const pad = (n: number) => String(n).padStart(2, '0');
const addDays = (day: string, n: number) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
/** The next date on or after `from` with this month and day. */
const nextDate = (from: string, month: number, day: number, year?: number) => {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (year) return `${year < 100 ? 2000 + year : year}-${pad(month)}-${pad(day)}`;
  const y = Number(from.slice(0, 4));
  const same = `${y}-${pad(month)}-${pad(day)}`;
  return same >= from ? same : `${y + 1}-${pad(month)}-${pad(day)}`;
};
/** Days and dates a message names, read from the day it was sent (Chicago): "11/18", "Nov 18th", "Tuesday", "tomorrow", "the 18th". */
export function findDates(text: string, sentDay: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g)) { const d = nextDate(sentDay, +m[1], +m[2], m[3] ? +m[3] : undefined); if (d) out.add(d); }
  for (const m of text.matchAll(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b(?:,?\s+(\d{4}))?/gi)) { const d = nextDate(sentDay, monthNames.indexOf(m[1].slice(0, 3).toLowerCase()) + 1, +m[2], m[3] ? +m[3] : undefined); if (d) out.add(d); }
  const weekday = new Date(`${sentDay}T12:00:00Z`).getUTCDay();
  for (const m of text.matchAll(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday|tues|thurs)\b/gi)) {
    const name = m[1].toLowerCase(), target = weekdays.findIndex(w => w.startsWith(name.slice(0, 3)));
    out.add(addDays(sentDay, ((target - weekday + 7) % 7) || 7));
  }
  if (/\btomorrow\b/i.test(text)) out.add(addDays(sentDay, 1));
  if (/\btoday\b/i.test(text) && /\b(come|be there|stop by|swing by|start|arrive)\b/i.test(text)) out.add(sentDay);
  // "the 18th": this month if it is still ahead, else next month.
  for (const m of text.matchAll(/\bthe\s+(\d{1,2})(?:st|nd|rd|th)\b/gi)) {
    const day = +m[1], [y, mo, d] = sentDay.split('-').map(Number);
    if (day < 1 || day > 31) continue;
    const [year, month] = day >= d ? [y, mo] : mo === 12 ? [y + 1, 1] : [y, mo + 1];
    out.add(`${year}-${pad(month)}-${pad(day)}`);
  }
  return [...out].sort();
}
/** A customer reply that says yes to a proposed time ("Thursday works", "tomorrow is fine"), and not no. */
export const confirms = (text: string) =>
  (/\b(yes|yep|yeah|yup|sure|sounds good|sounds great|that works|works for me|that'?s fine|perfect|great|ok|okay|confirmed|see you then|see you|book it|let'?s do it|that day works|works great)\b/i.test(text)
    || /\b(\w+day|tues|thurs|tomorrow|today|that|this|it|either|both)\s+(works|would work|is (fine|good|great|perfect))\b/i.test(text))
  && !/\b(no|nope|not|can'?t|cannot|won'?t|doesn'?t work|does not work|busy|reschedule|cancel)\b/i.test(text);

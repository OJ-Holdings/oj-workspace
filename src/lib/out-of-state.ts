const STATES = new Set('AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WY DC'.split(' '));
const NAMES: Record<string, string> = { illinois: 'IL', michigan: 'MI', indiana: 'IN', iowa: 'IA', minnesota: 'MN' };

/**
 * The two-letter state when an address is outside Wisconsin, otherwise null (also null when no state can be read).
 * A comma before the state, or a ZIP after it, is required so "Oak CT" (court) is not read as Connecticut.
 * Master plan 1e: jobs outside Wisconsin need an insurance, registration and tax check until cleared.
 */
export function outOfState(address: string | null | undefined): string | null {
  const a = (address ?? '').trim();
  if (!a) return null;
  const abbr = a.match(/,\s*([A-Za-z]{2})\.?(?:\s+\d{5}(?:-\d{4})?)?\s*$/) ?? a.match(/\b([A-Z]{2})\s+\d{5}(?:-\d{4})?\s*$/);
  const code = abbr?.[1].toUpperCase();
  if (code && STATES.has(code)) return code === 'WI' ? null : code;
  const word = a.toLowerCase().match(/\b(wisconsin|illinois|michigan|indiana|iowa|minnesota)\b\.?(?:\s+\d{5}(?:-\d{4})?)?\s*$/);
  if (!word) return null;
  return word[1] === 'wisconsin' ? null : NAMES[word[1]];
}

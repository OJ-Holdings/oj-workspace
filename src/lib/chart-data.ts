/** Keep missing observations as gaps rather than reporting them as zero. */
export function chartValues(values: number[], count: number): (number | null)[] {
  return Array.from({ length: count }, (_, i) => Number.isFinite(values[i]) ? values[i] : null);
}

export function chartPath(values: (number | null)[], x: (i: number) => number, y: (v: number) => number): string {
  let connected = false;
  return values.map((value, index) => {
    if (value === null) { connected = false; return ''; }
    const command = connected ? 'L' : 'M'; connected = true;
    return `${command}${x(index).toFixed(1)} ${y(value).toFixed(1)}`;
  }).filter(Boolean).join(' ');
}

export function chartScale(values: (number | null)[]) {
  const known = values.filter((v): v is number => v !== null && Number.isFinite(v));
  const min = Math.min(0, ...known), max = Math.max(0, ...known);
  const range = max - min || 1;
  const unit = 10 ** Math.floor(Math.log10(range / 3));
  const step = [1, 2, 2.5, 5, 10].map(n => n * unit).find(n => n * 3 >= range) ?? unit * 10;
  const low = Math.floor(min / step) * step;
  const high = Math.max(low + step, Math.ceil(max / step) * step);
  const ticks = Array.from({ length: Math.round((high - low) / step) + 1 }, (_, i) => low + i * step);
  return { low, high, ticks };
}

export function chartX(index: number, count: number, left: number, right: number) {
  return count <= 1 ? (left + right) / 2 : left + index / (count - 1) * (right - left);
}

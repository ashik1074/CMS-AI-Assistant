/** Formatting and scale helpers shared by the report charts. */

export const seriesColor = (slot = 0) => (slot < 0 ? 'var(--series-other)' : `var(--series-${(slot % 8) + 1})`);

const fmt = new Intl.NumberFormat('en-US');
export const formatNumber = (n: number) => fmt.format(n);
export const formatCompact = (n: number) => (Math.abs(n) >= 10_000 ? new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n) : fmt.format(n));

/** Round axis ticks for whole-number data: 0, then 4–5 clean steps covering the max. */
export function niceTicks(max: number, target = 5): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / target;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  // Counts and amounts are whole numbers, so a step is never below 1.
  const step = Math.max(1, [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? 10 * magnitude);
  const ticks: number[] = [];
  for (let v = 0; v < max + step * 0.999; v += step) ticks.push(Math.round(v * 1000) / 1000);
  if (ticks.at(-1)! < max) ticks.push(ticks.at(-1)! + step);
  return ticks;
}

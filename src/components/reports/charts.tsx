import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { formatCompact, formatNumber, niceTicks, seriesColor } from '../../utils/chartFormat';

/*
 * Small SVG charts for the reports. Specs follow the data-viz guide: columns at most 24px thick with a
 * 4px rounded data end and a square baseline; histogram bins touch with a 2px surface gap; hairline
 * gridlines; text in ink colors (never the series color); a hover/keyboard tooltip on every mark.
 */

export interface Datum {
  key: string;
  label: string;
  /** Tooltip / table label when the axis label is abbreviated. */
  fullLabel?: string;
  value: number;
  /** Categorical color slot (0-based, fixed per entity); -1 = "Other". */
  slot?: number;
}

/** Width of an element, following resizes (falls back where ResizeObserver isn't available). */
function useWidth(fallback = 560) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.clientWidth) setWidth(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => entry.contentRect.width && setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** A path for a column with a 4px rounded top and a square baseline. */
function columnPath(x: number, y: number, w: number, h: number, r = 4) {
  if (h <= 0) return '';
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

interface Tip {
  x: number;
  y: number;
  content: ReactNode;
}

function Tooltip({ tip }: { tip: Tip | null }) {
  if (!tip) return null;
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs whitespace-nowrap shadow-md dark:border-zinc-700 dark:bg-zinc-900"
      style={{ left: tip.x, top: tip.y - 8 }}
    >
      {tip.content}
    </div>
  );
}

/** Roving focus across a chart's marks with the arrow keys. */
function useRovingMarks(count: number, onActivate: (i: number | null) => void) {
  const [active, setActive] = useState<number | null>(null);
  const onKeyDown = (e: KeyboardEvent) => {
    if (!count) return;
    const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (e.key === 'Escape') {
      setActive(null);
      onActivate(null);
      return;
    }
    if (!delta) return;
    e.preventDefault();
    const next = active === null ? 0 : (active + delta + count) % count;
    setActive(next);
    onActivate(next);
  };
  return { active, setActive, onKeyDown };
}

/* ---------- Columns (bar chart) and histogram ---------- */

interface ColumnChartProps {
  data: Datum[];
  /** Y-axis title, e.g. "Products". */
  valueLabel: string;
  /** X-axis title, e.g. "Scheme". */
  axisLabel: string;
  /** Histogram: bins touch (2px surface gap) instead of standing apart. */
  histogram?: boolean;
  format?: (n: number) => string;
  /** Extra tooltip line for a datum, e.g. a share or a second measure. */
  detail?: (d: Datum) => ReactNode;
  ariaLabel: string;
  height?: number;
}

export function ColumnChart({ data, valueLabel, axisLabel, histogram, format = formatNumber, detail, ariaLabel, height = 260 }: ColumnChartProps) {
  const [ref, width] = useWidth();
  const [tip, setTip] = useState<Tip | null>(null);
  const titleId = useId();
  const max = Math.max(0, ...data.map((d) => d.value));
  const ticks = niceTicks(max);
  const top = ticks.at(-1)!;
  const tickWidth = Math.max(...ticks.map((t) => formatCompact(t).length)) * 6.5;
  const m = { top: 20, right: 8, bottom: 46, left: Math.max(36, tickWidth + 20) };
  const plotW = Math.max(40, width - m.left - m.right);
  const plotH = height - m.top - m.bottom;
  const band = plotW / Math.max(1, data.length);
  const barW = histogram ? Math.max(1, band - 2) : Math.min(24, band * 0.6);
  const y = (v: number) => m.top + plotH - (v / top) * plotH;
  // Thin the x labels so they never collide.
  const longest = Math.max(...data.map((d) => d.label.length), 1) * 6.2 + 8;
  const every = Math.max(1, Math.ceil(longest / band));
  // Values on the caps only when they fit side by side; otherwise label the peak and let the tooltip carry the rest.
  const capLabels = !histogram && band >= 34;
  const peak = data.findIndex((d) => d.value === max && max > 0);

  const show = (i: number | null) => {
    if (i === null) return setTip(null);
    const d = data[i];
    const cx = m.left + band * i + band / 2;
    setTip({
      x: cx,
      y: y(d.value),
      content: (
        <>
          <span className="font-medium">{d.fullLabel ?? d.label}</span>
          <span className="block tabular-nums text-zinc-600 dark:text-zinc-300">
            {format(d.value)} {valueLabel.toLowerCase()}
          </span>
          {detail?.(d)}
        </>
      ),
    });
  };
  const { active, setActive, onKeyDown } = useRovingMarks(data.length, show);

  return (
    <div ref={ref} className="viz relative w-full" data-testid="column-chart">
      <svg
        width={width}
        height={height}
        role="img"
        aria-labelledby={titleId}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onBlur={() => {
          setActive(null);
          setTip(null);
        }}
        className="block overflow-visible outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
      >
        <title id={titleId}>{`${ariaLabel}. Use the arrow keys to read each value.`}</title>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.left} x2={m.left + plotW} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--viz-axis)' : 'var(--viz-grid)'} strokeWidth={1} shapeRendering="crispEdges" />
            <text x={m.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--viz-muted)" className="tabular-nums">
              {formatCompact(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x0 = m.left + band * i;
          const x = histogram ? x0 + 1 : x0 + (band - barW) / 2;
          const h = plotH - (y(d.value) - m.top);
          return (
            <g key={d.key}>
              <path d={columnPath(x, y(d.value), barW, h)} fill={seriesColor(0)} opacity={active === null || active === i ? 1 : 0.45} />
              {(capLabels || i === peak) && d.value > 0 && (
                <text x={x0 + band / 2} y={y(d.value) - 6} textAnchor="middle" fontSize={11} fill="var(--viz-ink-2)" className="tabular-nums">
                  {formatCompact(d.value)}
                </text>
              )}
              {i % every === 0 && (
                <text x={x0 + band / 2} y={m.top + plotH + 16} textAnchor="middle" fontSize={11} fill="var(--viz-muted)">
                  {d.label}
                </text>
              )}
              {/* Hit target: the whole band, taller than the mark. */}
              <rect
                x={x0}
                y={m.top}
                width={band}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => {
                  setActive(i);
                  show(i);
                }}
                onMouseLeave={() => {
                  setActive(null);
                  setTip(null);
                }}
              >
                <title>{`${d.fullLabel ?? d.label}: ${format(d.value)}`}</title>
              </rect>
            </g>
          );
        })}
        <text x={m.left + plotW / 2} y={height - 6} textAnchor="middle" fontSize={11} fill="var(--viz-ink-2)">
          {axisLabel}
        </text>
        <text transform={`translate(12 ${m.top + plotH / 2}) rotate(-90)`} textAnchor="middle" fontSize={11} fill="var(--viz-ink-2)">
          {valueLabel}
        </text>
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}

/* ---------- Donut (pie) ---------- */

interface PieChartProps {
  data: Datum[];
  /** Keys the user switched off in the legend. */
  hidden: Set<string>;
  onToggle: (key: string) => void;
  unit: string;
  ariaLabel: string;
}

function arcPath(cx: number, cy: number, r: number, inner: number, a0: number, a1: number) {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const p = (radius: number, a: number) => `${cx + radius * Math.sin(a)},${cy - radius * Math.cos(a)}`;
  if (a1 - a0 >= Math.PI * 2 - 1e-6) {
    // A full ring needs two arcs.
    return `M${p(r, 0)}A${r},${r} 0 1 1 ${p(r, Math.PI)}A${r},${r} 0 1 1 ${p(r, 0)}M${p(inner, 0)}A${inner},${inner} 0 1 0 ${p(inner, Math.PI)}A${inner},${inner} 0 1 0 ${p(inner, 0)}Z`;
  }
  return `M${p(r, a0)}A${r},${r} 0 ${large} 1 ${p(r, a1)}L${p(inner, a1)}A${inner},${inner} 0 ${large} 0 ${p(inner, a0)}Z`;
}

export function PieChart({ data, hidden, onToggle, unit, ariaLabel }: PieChartProps) {
  const [tip, setTip] = useState<Tip | null>(null);
  const titleId = useId();
  const shown = data.filter((d) => !hidden.has(d.key) && d.value > 0);
  const total = shown.reduce((n, d) => n + d.value, 0);
  const size = 220;
  const r = size / 2 - 4;
  const inner = r * 0.58;
  const c = size / 2;
  const arcs = shown.reduce<{ d: Datum; a0: number; a1: number }[]>((acc, d) => {
    const a0 = acc.at(-1)?.a1 ?? 0;
    return [...acc, { d, a0, a1: a0 + (d.value / total) * Math.PI * 2 }];
  }, []);
  const share = (v: number) => (total ? `${Math.round((v / total) * 1000) / 10}%` : '0%');

  const show = (i: number | null) => {
    if (i === null) return setTip(null);
    const { d, a0, a1 } = arcs[i];
    const mid = (a0 + a1) / 2;
    setTip({
      x: c + (r * 0.8) * Math.sin(mid),
      y: c - (r * 0.8) * Math.cos(mid),
      content: (
        <>
          <span className="font-medium">{d.label}</span>
          <span className="block tabular-nums text-zinc-600 dark:text-zinc-300">
            {formatNumber(d.value)} {unit} · {share(d.value)}
          </span>
        </>
      ),
    });
  };
  const { active, setActive, onKeyDown } = useRovingMarks(arcs.length, show);

  return (
    <div className="viz flex flex-col items-center gap-4 sm:flex-row sm:items-start" data-testid="pie-chart">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          role="img"
          aria-labelledby={titleId}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onBlur={() => {
            setActive(null);
            setTip(null);
          }}
          className="block rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          <title id={titleId}>{`${ariaLabel}. Use the arrow keys to read each slice.`}</title>
          {arcs.map(({ d, a0, a1 }, i) => (
            <path
              key={d.key}
              d={arcPath(c, c, active === i ? r + 3 : r, inner, a0, a1)}
              fill={seriesColor(d.slot)}
              // 2px surface gap between slices.
              stroke="var(--viz-surface)"
              strokeWidth={arcs.length > 1 ? 2 : 0}
              strokeLinejoin="round"
              onMouseEnter={() => {
                setActive(i);
                show(i);
              }}
              onMouseLeave={() => {
                setActive(null);
                setTip(null);
              }}
            >
              <title>{`${d.label}: ${formatNumber(d.value)} (${share(d.value)})`}</title>
            </path>
          ))}
          <text x={c} y={c - 6} textAnchor="middle" fontSize={26} fontWeight={600} fill="var(--viz-ink)">
            {formatNumber(total)}
          </text>
          <text x={c} y={c + 16} textAnchor="middle" fontSize={12} fill="var(--viz-muted)">
            {unit}
          </text>
        </svg>
        <Tooltip tip={tip} />
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-1" aria-label="Legend. Select an item to show or hide it.">
        {data.map((d) => {
          const off = hidden.has(d.key);
          return (
            <li key={d.key}>
              <button
                type="button"
                aria-pressed={!off}
                onClick={() => onToggle(d.key)}
                className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800', off && 'opacity-50')}
              >
                <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: off ? 'transparent' : seriesColor(d.slot), boxShadow: off ? `inset 0 0 0 1.5px ${seriesColor(d.slot)}` : undefined }} aria-hidden="true" />
                <span className={cn('min-w-0 flex-1 truncate', off && 'line-through')}>{d.label}</span>
                <span className="tabular-nums text-zinc-600 dark:text-zinc-300">{formatNumber(d.value)}</span>
                <span className="w-12 text-right tabular-nums text-zinc-500 dark:text-zinc-400">{off ? '—' : share(d.value)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------- Table view ---------- */

export function DataTable({ caption, headers, rows }: { caption: string; headers: string[]; rows: (string | number)[][] }) {
  return (
    <div className="max-h-64 overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-zinc-50 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          <tr>
            {headers.map((h, i) => (
              <th key={h} scope="col" className={cn('px-3 py-2 font-medium', i ? 'text-right' : 'text-left')}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="border-t border-zinc-200 dark:border-zinc-700">
              {row.map((cell, i) =>
                i ? (
                  <td key={i} className="px-3 py-1.5 text-right tabular-nums">
                    {typeof cell === 'number' ? formatNumber(cell) : cell}
                  </td>
                ) : (
                  <th key={i} scope="row" className="px-3 py-1.5 text-left font-normal">
                    {cell}
                  </th>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A labelled number for summary rows ("stat tile"). */
export function StatTile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-700">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
      {note && <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{note}</p>}
    </div>
  );
}

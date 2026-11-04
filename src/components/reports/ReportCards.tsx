import { useEffect, useMemo, useState } from 'react';
import { BarChart3, CheckCircle2, Loader2, Smartphone, Table2 } from 'lucide-react';
import type { ReportHandlers } from '../../hooks/useReports';
import type { ProductRecord } from '../../types/product';
import type { ProductGroupBy, ProductReportAction, ReportChart, TransactionReportAction, TxnMetric, TxnRange, TxnView } from '../../types/report';
import { cn } from '../../utils/cn';
import {
  binTransactions,
  CHART_LABELS,
  demoPortfolio,
  demoTransactions,
  fromRecord,
  groupingsFor,
  GROUPINGS,
  groupProducts,
  summarize,
  TXN_RANGES,
} from '../../utils/reportData';
import { Segmented } from '../agent/productFields';
import { formatCompact, formatNumber } from '../../utils/chartFormat';
import { ColumnChart, DataTable, PieChart, StatTile, type Datum } from './charts';

const cardClass = 'mt-3 rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900/60';

export function CardHeader({ icon, title, subtitle, badge }: { icon: React.ReactNode; title: string; subtitle: string; badge?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-t-2xl border-b border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/60">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</p>
      </div>
      {badge}
    </div>
  );
}

const CHART_CHOICES: { value: ReportChart; label: string; hint: string }[] = [
  { value: 'pie', label: 'Pie chart', hint: 'Each group’s share of all products' },
  { value: 'bar', label: 'Bar chart', hint: 'Compare product counts across groups' },
  { value: 'histogram', label: 'Histogram', hint: 'How a value spreads across ranges' },
];

/** A grouping that works for the chart: keep the current one if it fits. */
const fitGrouping = (chart: ReportChart | null, groupBy: ProductGroupBy | null) => (chart && groupBy && groupingsFor(chart).includes(groupBy) ? groupBy : null);

/* ---------- Products report ---------- */

export function ProductReportCard({ messageId, action, handlers, readOnly }: { messageId: string; action: ProductReportAction; handlers?: ReportHandlers; readOnly?: boolean }) {
  const live = readOnly ? undefined : handlers;
  if (action.status === 'choosing' || !action.chart) return <ChooseReport messageId={messageId} action={action} handlers={live} />;
  if (action.status === 'loading' && action.groupBy) return <BuildingReport chart={action.chart} groupBy={action.groupBy} durationMs={handlers?.delayMs ?? 0} />;
  return <ProductReport messageId={messageId} chart={action.chart} action={action} handlers={live} />;
}

export function RadioCards<T extends string>({ name, label, options, value, onChange, invalid, disabled }: { name: string; label: string; options: { value: T; label: string; hint: string }[]; value: T | null; onChange: (v: T) => void; invalid: boolean; disabled: boolean }) {
  return (
    <div className={cn('grid gap-2', options.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2')} role="radiogroup" aria-label={label} aria-invalid={invalid}>
      {options.map((o) => (
        <label
          key={o.value}
          className={cn(
            'flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
            value === o.value ? 'border-brand-400 bg-brand-50 dark:border-brand-400/60 dark:bg-brand-500/15' : 'border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800',
            invalid && 'border-red-400 dark:border-red-500/60',
            disabled && 'cursor-not-allowed opacity-60',
          )}
        >
          <input type="radio" name={name} className="mt-0.5 accent-brand-600" checked={value === o.value} disabled={disabled} onChange={() => onChange(o.value)} />
          <span>
            <span className="block font-medium">{o.label}</span>
            <span className="block text-xs text-zinc-500 dark:text-zinc-400">{o.hint}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

export const Required = () => (
  <span className="text-red-600 dark:text-red-400" aria-hidden="true">
    *
  </span>
);

/**
 * Asks what the report needs. A chart type named in the prompt is used as is; otherwise the user picks one
 * first (nothing pre-selected), and the groupings that suit it appear after.
 */
function ChooseReport({ messageId, action, handlers }: { messageId: string; action: ProductReportAction; handlers?: ReportHandlers }) {
  const askChart = !action.chartFromPrompt;
  const [chart, setChart] = useState<ReportChart | null>(action.chart);
  const [groupBy, setGroupBy] = useState<ProductGroupBy | null>(fitGrouping(action.chart, action.groupBy));
  const [tried, setTried] = useState(false);
  const disabled = !handlers;

  const generate = () => {
    if (!handlers) return;
    if (!chart || !groupBy) return setTried(true);
    handlers.generate(messageId, chart, groupBy);
  };

  return (
    <div className={cardClass} data-testid="product-report" data-status="choosing">
      <CardHeader
        icon={<BarChart3 className="h-4 w-4" />}
        title="Products report"
        subtitle={chart ? `${CHART_LABELS[chart]} · choose how to group` : 'Choose a chart type and grouping'}
        badge={<span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">Needs your input</span>}
      />
      <div className="space-y-4 px-4 py-4">
        {askChart ? (
          <fieldset>
            <legend className="mb-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Chart type <Required />
            </legend>
            <RadioCards
              name={`chart-${messageId}`}
              label="Chart type"
              options={CHART_CHOICES}
              value={chart}
              onChange={(next) => {
                setChart(next);
                setGroupBy((g) => fitGrouping(next, g));
              }}
              invalid={tried && !chart}
              disabled={disabled}
            />
            {tried && !chart && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
                Choose the type of chart for the report.
              </p>
            )}
          </fieldset>
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Chart type: <strong className="font-medium text-zinc-900 dark:text-zinc-100">{chart && CHART_LABELS[chart]}</strong>
          </p>
        )}

        {chart && (
          <fieldset>
            <legend className="mb-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Group products by <Required />
            </legend>
            {chart === 'histogram' && <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">A histogram shows how a number is spread, so products are grouped into ranges of the value you choose.</p>}
            <RadioCards
              name={`group-${messageId}`}
              label="Group products by"
              options={groupingsFor(chart).map((g) => ({ value: g, label: GROUPINGS[g].label, hint: GROUPINGS[g].hint }))}
              value={groupBy}
              onChange={setGroupBy}
              invalid={tried && !groupBy}
              disabled={disabled}
            />
            {tried && !groupBy && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
                Choose how the report should group the products.
              </p>
            )}
          </fieldset>
        )}
      </div>
      {handlers && (
        <div className="flex flex-col gap-2 rounded-b-2xl border-t border-zinc-200 bg-zinc-50 px-4 py-3 sm:flex-row sm:items-center dark:border-zinc-700 dark:bg-zinc-800/60">
          <p className="flex-1 text-xs text-zinc-500 dark:text-zinc-400">You can change the grouping again once the report is ready.</p>
          <button type="button" className="btn-primary min-h-9" onClick={generate}>
            <BarChart3 className="h-4 w-4" aria-hidden="true" />
            Generate report
          </button>
        </div>
      )}
    </div>
  );
}

function BuildingReport({ chart, groupBy, durationMs }: { chart: ReportChart; groupBy: ProductGroupBy; durationMs: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Date.now() - started), 150);
    return () => clearInterval(timer);
  }, []);
  const steps = ['Collecting products', `Grouping by ${GROUPINGS[groupBy].label.toLowerCase()}`, `Drawing the ${CHART_LABELS[chart].toLowerCase()}`];
  const share = durationMs / steps.length;
  const active = share ? Math.min(steps.length - 1, Math.floor(elapsed / share)) : steps.length - 1;
  const percent = durationMs ? Math.min(100, Math.round((elapsed / durationMs) * 100)) : 100;
  return (
    <div className={cardClass} data-testid="product-report" data-status="loading">
      <CardHeader
        icon={<BarChart3 className="h-4 w-4" />}
        title="Products report"
        subtitle="Building your report"
        badge={
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-800 dark:bg-brand-500/20 dark:text-brand-200">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            Processing…
          </span>
        }
      />
      <div className="space-y-3 rounded-b-2xl px-4 py-4">
        <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700" role="progressbar" aria-label="Building the report" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
          <div className="h-full rounded-full bg-brand-600 transition-[width] duration-150 ease-linear motion-reduce:transition-none" style={{ width: `${percent}%` }} />
        </div>
        <ol className="space-y-2 text-sm" aria-live="polite">
          {steps.map((label, i) => (
            <li key={label} className={cn('flex items-center gap-2', i > active && 'text-zinc-400 dark:text-zinc-500')}>
              {i < active ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              ) : i === active ? (
                <Loader2 className="h-4 w-4 animate-spin text-brand-600 dark:text-brand-300" aria-hidden="true" />
              ) : (
                <span className="h-4 w-4 rounded-full border border-current" aria-hidden="true" />
              )}
              {label}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function TableToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button type="button" aria-expanded={open} onClick={onToggle} className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline dark:text-brand-300">
      <Table2 className="h-3.5 w-3.5" aria-hidden="true" />
      {open ? 'Hide data table' : 'Show data table'}
    </button>
  );
}

/** The finished report: only the chart type the user asked for; the grouping can still be changed. */
function ProductReport({ messageId, chart, action, handlers }: { messageId: string; chart: ReportChart; action: ProductReportAction; handlers?: ReportHandlers }) {
  const [groupBy, setGroupBy] = useState<ProductGroupBy>(fitGrouping(chart, action.groupBy) ?? groupingsFor(chart)[0]);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [showTable, setShowTable] = useState(false);
  const [own, setOwn] = useState<ProductRecord[] | null>(handlers ? null : []);
  const [now] = useState(() => action.generatedAt ?? Date.now());

  useEffect(() => {
    if (!handlers) return;
    const controller = new AbortController();
    handlers
      .loadProducts(controller.signal)
      .then(setOwn)
      .catch(() => !controller.signal.aborted && setOwn([]));
    return () => controller.abort();
    // Load once per card; later view changes reuse the same products.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const products = useMemo(() => [...demoPortfolio(now), ...(own ?? []).map(fromRecord)], [now, own]);
  const data: Datum[] = useMemo(() => groupProducts(products, groupBy, now), [products, groupBy, now]);
  const grouping = GROUPINGS[groupBy];
  const total = products.length;
  const ownCount = own?.length ?? 0;

  const changeGroup = (next: ProductGroupBy) => {
    setGroupBy(next);
    setHidden(new Set());
    handlers?.updateProductReport(messageId, { groupBy: next });
  };

  const title = `Products by ${grouping.label.toLowerCase()}`;
  return (
    <div className={cardClass} data-testid="product-report" data-status="ready">
      <CardHeader
        icon={<BarChart3 className="h-4 w-4" />}
        title={title}
        subtitle={`${CHART_LABELS[chart]} · ${formatNumber(total)} products · generated ${new Date(now).toLocaleString()}`}
      />
      <div className="space-y-4 px-4 py-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2" role="group" aria-label="Report options">
          <label className="flex items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Group by
            <select value={groupBy} onChange={(e) => changeGroup(e.target.value as ProductGroupBy)} className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900">
              {groupingsFor(chart).map((g) => (
                <option key={g} value={g}>
                  {GROUPINGS[g].label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {own === null ? (
          <p className="flex items-center gap-2 py-10 text-sm text-zinc-500" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading products…
          </p>
        ) : chart === 'pie' ? (
          <PieChart data={data} hidden={hidden} onToggle={(key) => setHidden((h) => new Set(h.has(key) ? [...h].filter((k) => k !== key) : [...h, key]))} unit="products" ariaLabel={`${title}, pie chart`} />
        ) : (
          <ColumnChart
            data={data}
            histogram={chart === 'histogram'}
            valueLabel="Products"
            axisLabel={grouping.axis}
            ariaLabel={`${title}, ${CHART_LABELS[chart].toLowerCase()}`}
            detail={(d) => <span className="block text-zinc-500 dark:text-zinc-400">{total ? Math.round((d.value / total) * 1000) / 10 : 0}% of products</span>}
          />
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {formatNumber(total - ownCount)} demo portfolio products{ownCount ? ` and ${formatNumber(ownCount)} you created in this browser` : ''}.
            {chart === 'pie' && ' Select a legend item to hide or show it.'}
          </p>
          <TableToggle open={showTable} onToggle={() => setShowTable((s) => !s)} />
        </div>
        {showTable && <DataTable caption={title} headers={[grouping.axis, 'Products', 'Share']} rows={data.map((d) => [d.label, d.value, `${total ? Math.round((d.value / total) * 1000) / 10 : 0}%`])} />}
      </div>
    </div>
  );
}

/* ---------- Transactions for a phone number ---------- */

const VIEW_OPTIONS: { value: TxnView; label: string }[] = [
  { value: 'time', label: 'Over time' },
  { value: 'amount', label: 'By amount' },
];
const METRIC_OPTIONS: { value: TxnMetric; label: string }[] = [
  { value: 'count', label: 'Count' },
  { value: 'amount', label: 'Amount' },
];

const bdt = (n: number) => `BDT ${formatCompact(n)}`;

export function TransactionReportCard({ messageId, action, handlers, readOnly }: { messageId: string; action: TransactionReportAction; handlers?: ReportHandlers; readOnly?: boolean }) {
  const live = readOnly ? undefined : handlers;
  const [range, setRange] = useState<TxnRange>(action.range);
  const [view, setView] = useState<TxnView>(action.view);
  const [metric, setMetric] = useState<TxnMetric>(action.metric);
  const [showTable, setShowTable] = useState(false);

  const txns = useMemo(() => demoTransactions(action.phone, action.asOf), [action.phone, action.asOf]);
  const bins = useMemo(() => binTransactions(txns, range, view, action.asOf), [txns, range, view, action.asOf]);
  const stats = summarize(bins, metric);
  const rangeInfo = TXN_RANGES.find((r) => r.id === range)!;
  const data: Datum[] = bins.map((b) => ({ key: b.key, label: b.label, fullLabel: b.fullLabel, value: b[metric] }));

  const save = (changes: Partial<Pick<TransactionReportAction, 'range' | 'view' | 'metric'>>) => live?.updateTransactionReport(messageId, changes);
  const valueLabel = metric === 'count' ? 'Transactions' : 'Amount (BDT)';
  const axisLabel = view === 'time' ? rangeInfo.unit : 'Transaction amount (BDT)';
  const title = `Transactions for ${action.phone}`;

  return (
    <div className={cardClass} data-testid="transaction-report">
      <CardHeader icon={<Smartphone className="h-4 w-4" />} title={title} subtitle={`Histogram · ${rangeInfo.label} · ${view === 'time' ? 'over time' : 'by amount'}`} />
      <div className="space-y-4 px-4 py-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2" role="group" aria-label="Filters">
          <label className="flex items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Date range
            <select
              value={range}
              onChange={(e) => {
                const next = e.target.value as TxnRange;
                setRange(next);
                save({ range: next });
              }}
              className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              {TXN_RANGES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <Segmented
            label="View"
            value={view}
            options={VIEW_OPTIONS}
            onChange={(v) => {
              setView(v);
              save({ view: v });
            }}
          />
          <Segmented
            label="Measure"
            value={metric}
            options={METRIC_OPTIONS}
            onChange={(v) => {
              setMetric(v);
              save({ metric: v });
            }}
          />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile label="Transactions" value={formatNumber(stats.count)} />
          <StatTile label="Total amount" value={bdt(stats.amount)} />
          <StatTile label="Average amount" value={bdt(stats.average)} />
          <StatTile label={view === 'time' ? `Busiest ${rangeInfo.unit.toLowerCase()}` : 'Most common band'} value={stats.busiest?.label ?? '—'} note={stats.busiest ? (metric === 'count' ? `${formatNumber(stats.busiest.count)} transactions` : bdt(stats.busiest.amount)) : undefined} />
        </div>

        <ColumnChart
          data={data}
          histogram
          valueLabel={valueLabel}
          axisLabel={axisLabel}
          format={metric === 'amount' ? (n) => `BDT ${formatNumber(n)}` : formatNumber}
          detail={(d) => {
            const bin = bins.find((b) => b.key === d.key);
            return bin && <span className="block text-zinc-500 dark:text-zinc-400">{metric === 'count' ? `BDT ${formatNumber(bin.amount)} in total` : `${formatNumber(bin.count)} transactions`}</span>;
          }}
          ariaLabel={`${title}, ${rangeInfo.label.toLowerCase()}, ${valueLabel.toLowerCase()} ${view === 'time' ? `per ${rangeInfo.unit.toLowerCase()}` : 'by amount band'}`}
        />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Demo data generated for this number, up to {new Date(action.asOf).toLocaleString()}. No real account data is used.</p>
          <TableToggle open={showTable} onToggle={() => setShowTable((s) => !s)} />
        </div>
        {showTable && (
          <DataTable caption={title} headers={[axisLabel, 'Transactions', 'Amount (BDT)']} rows={bins.map((b) => [b.fullLabel, b.count, b.amount])} />
        )}
      </div>
    </div>
  );
}

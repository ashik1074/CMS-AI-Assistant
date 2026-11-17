import { Fragment, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Layers, Sparkles, ThumbsUp } from 'lucide-react';
import type { ReportHandlers } from '../../hooks/useReports';
import { SCHEMES } from '../../services/productCatalog';
import type { CardRangesAction } from '../../types/cardRange';
import type { ProductRecord } from '../../types/product';
import { cardRangeInventory, formatCount, percent, purposeLabel, rangesToAvoid, schemeLabel, STATUS_LABELS, suggestRanges, type CardRangeInfo, type RangeStatus } from '../../utils/cardRanges';
import { cn } from '../../utils/cn';
import { CardHeader } from '../reports/ReportCards';

const cardClass = 'mt-3 rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900/60';

const STATUS_STYLES: Record<RangeStatus, { pill: string; bar: string }> = {
  available: { pill: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/15 dark:text-emerald-300', bar: 'bg-emerald-500' },
  limited: { pill: 'bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-500/15 dark:text-amber-200', bar: 'bg-amber-500' },
  nearlyFull: { pill: 'bg-orange-50 text-orange-800 ring-orange-600/20 dark:bg-orange-500/15 dark:text-orange-200', bar: 'bg-orange-500' },
  full: { pill: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/15 dark:text-red-300', bar: 'bg-red-500' },
};

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const rangeTitle = (r: CardRangeInfo) => `${r.scheme} · ${r.binName} · ${r.rangeName}`;

/** Available card ranges in the chat, with the range the assistant suggests and the ones to avoid. */
export function CardRangesCard({ messageId, action, handlers, readOnly }: { messageId: string; action: CardRangesAction; handlers?: ReportHandlers; readOnly?: boolean }) {
  const live = readOnly ? undefined : handlers;
  const [products, setProducts] = useState<ProductRecord[] | null>(live ? null : []);
  const [schemes, setSchemes] = useState(action.schemes);

  useEffect(() => {
    if (!live) return;
    const controller = new AbortController();
    live
      .loadProducts(controller.signal)
      .then(setProducts)
      .catch(() => !controller.signal.aborted && setProducts([]));
    return () => controller.abort();
    // Load once per card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inventory = useMemo(() => cardRangeInventory(products ?? []), [products]);
  const shown = useMemo(() => (schemes.length ? inventory.filter((r) => schemes.includes(r.schemeId)) : inventory), [inventory, schemes]);
  const suggestions = useMemo(() => suggestRanges(shown, action.purpose), [shown, action.purpose]);
  const avoid = useMemo(() => rangesToAvoid(shown), [shown]);

  const pick = (next: number[]) => {
    setSchemes(next);
    live?.updateCardRanges(messageId, { schemes: next });
  };
  const toggle = (id: number) => pick(schemes.includes(id) ? schemes.filter((s) => s !== id) : SCHEMES.map((s) => s.id).filter((s) => s === id || schemes.includes(s)));

  const which = schemes.length ? schemes.map(schemeLabel).join(', ') : 'All schemes';
  const free = shown.reduce((n, r) => n + r.available, 0);
  const best = suggestions[0];
  // With several schemes on show, the alternatives are the best range of each other scheme; with one, the next best in it.
  const others = suggestions.filter((s, i) => i > 0 && s.range.schemeId !== best?.range.schemeId && suggestions.findIndex((x) => x.range.schemeId === s.range.schemeId) === i);
  const alternatives = (others.length ? others : suggestions.slice(1)).slice(0, 3);
  const groups = SCHEMES.filter((s) => shown.some((r) => r.schemeId === s.id));

  if (products === null) {
    return (
      <div className={cardClass} data-testid="card-ranges" data-status="loading" aria-busy="true">
        <CardHeader icon={<Layers className="h-4 w-4" />} title="Available card ranges" subtitle={which} />
        <div className="animate-pulse space-y-3 px-4 py-4" aria-hidden="true">
          <div className="h-20 rounded-xl bg-zinc-100 dark:bg-zinc-800" />
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-8 rounded bg-zinc-100 dark:bg-zinc-800" />
          ))}
        </div>
        <p className="sr-only" role="status">
          Checking which products use each card range…
        </p>
      </div>
    );
  }

  return (
    <div className={cardClass} data-testid="card-ranges" data-status="ready">
      <CardHeader
        icon={<Layers className="h-4 w-4" />}
        title="Available card ranges"
        subtitle={`${which} · ${shown.length} range${shown.length === 1 ? '' : 's'} · ${formatCount(free)} card numbers free`}
      />

      <div className="flex flex-wrap gap-1.5 border-b border-zinc-200 px-4 py-3 dark:border-zinc-700" role="group" aria-label="Schemes">
        <button type="button" aria-pressed={!schemes.length} onClick={() => pick([])} className={chipClass(!schemes.length)}>
          All schemes
        </button>
        {SCHEMES.map((s) => (
          <button key={s.id} type="button" aria-pressed={schemes.includes(s.id)} onClick={() => toggle(s.id)} className={chipClass(schemes.includes(s.id))}>
            {s.name}
          </button>
        ))}
      </div>

      <div className="space-y-3 px-4 py-4">
        {best ? (
          <section className="rounded-xl border border-brand-200 bg-brand-50/70 p-4 dark:border-brand-500/30 dark:bg-brand-500/10" aria-label="Suggested card range" data-testid="suggested-range">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Suggested{action.purpose ? ` for a ${purposeLabel(action.purpose)}` : ''}
            </p>
            <p className="mt-1 text-base font-semibold text-zinc-900 dark:text-zinc-50">
              {best.range.scheme} · {best.range.binName}
            </p>
            <p className="text-sm tabular-nums text-zinc-600 dark:text-zinc-300">{best.range.rangeName}</p>
            <ul className="mt-2 space-y-1 text-sm text-zinc-700 dark:text-zinc-200">
              {best.reasons.map((r) => (
                <li key={r} className="flex gap-2">
                  <ThumbsUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600 dark:text-brand-300" aria-hidden="true" />
                  {r}
                </li>
              ))}
            </ul>
            {alternatives.length > 0 && (
              <div className="mt-3 border-t border-brand-200/70 pt-2 text-sm dark:border-brand-500/20">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Also good</p>
                <ul className="mt-1 space-y-0.5">
                  {alternatives.map(({ range }) => (
                    <li key={range.rangeId} className="text-zinc-700 dark:text-zinc-300">
                      {range.scheme} · {range.binName} · <span className="tabular-nums">{range.rangeName}</span>
                      <span className="text-zinc-500 dark:text-zinc-400"> ({percent(range.freeShare)} free{range.products.length ? `, used by ${range.products.length}` : ', unused'})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        ) : (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100" data-testid="suggested-range">
            None of these ranges has card numbers to spare. A new range needs to be set up in the card management system first.
          </p>
        )}

        {avoid.length > 0 && (
          <section className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm dark:border-amber-500/30 dark:bg-amber-500/10" aria-label="Ranges to avoid">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
              Avoid
            </p>
            <ul className="mt-1 space-y-0.5 text-amber-900 dark:text-amber-100">
              {avoid.map(({ range, reason }) => (
                <li key={range.rangeId}>
                  {rangeTitle(range)}: {reason}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
          <table className="w-full min-w-[520px] text-left text-sm">
            <caption className="sr-only">Card ranges for {which}</caption>
            <thead className="bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400">
              <tr>
                <th scope="col" className="px-2.5 py-2 font-medium">
                  BIN
                </th>
                <th scope="col" className="px-2.5 py-2 font-medium">
                  Card range
                </th>
                <th scope="col" className="px-2.5 py-2 font-medium">
                  Free card numbers
                </th>
                <th scope="col" className="px-2.5 py-2 font-medium">
                  Used by
                </th>
                <th scope="col" className="px-2.5 py-2 font-medium">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {groups.map((s) => (
                <Fragment key={s.id}>
                  <tr className="border-t border-zinc-200 bg-zinc-50/60 dark:border-zinc-700 dark:bg-zinc-800/30">
                    <th scope="colgroup" colSpan={5} className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
                      {s.name}
                    </th>
                  </tr>
                  {shown
                    .filter((r) => r.schemeId === s.id)
                    .map((r) => {
                      const suggested = best?.range.rangeId === r.rangeId;
                      return (
                        <tr key={r.rangeId} className={cn('border-t border-zinc-200 dark:border-zinc-700', suggested && 'bg-brand-50/60 dark:bg-brand-500/10')} data-testid="card-range-row" data-suggested={suggested || undefined}>
                          <td className="px-2.5 py-2.5 align-top">
                            <span className="font-medium tabular-nums">{r.bin}</span>
                            <span className="block text-xs text-zinc-500 dark:text-zinc-400">{r.tier}</span>
                          </td>
                          <td className="whitespace-nowrap px-2.5 py-2.5 align-top tabular-nums">
                            {r.start} – {r.end}
                            {suggested && <span className="mt-1 block w-fit rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">Suggested</span>}
                          </td>
                          <td className="px-2.5 py-2.5 align-top">
                            <span className="whitespace-nowrap tabular-nums" title={`${formatCount(r.available)} of ${formatCount(r.capacity)}`}>
                              {compact.format(r.available)} of {compact.format(r.capacity)} · {percent(r.freeShare)}
                            </span>
                            <span className="mt-1 block h-1.5 w-24 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700" aria-hidden="true">
                              <span className={cn('block h-full rounded-full', STATUS_STYLES[r.status].bar)} style={{ width: `${Math.max(r.freeShare * 100, r.available ? 2 : 0)}%` }} />
                            </span>
                          </td>
                          <td className="px-2.5 py-2.5 align-top text-zinc-600 dark:text-zinc-300">
                            {r.products.length ? (
                              <span title={r.products.join(', ')}>
                                {r.products.length} product{r.products.length === 1 ? '' : 's'}
                                <span className="block max-w-36 truncate text-xs text-zinc-500 dark:text-zinc-400">{r.products.join(', ')}</span>
                              </span>
                            ) : (
                              <span className="text-zinc-400 dark:text-zinc-500">Not used</span>
                            )}
                          </td>
                          <td className="px-2.5 py-2.5 align-top">
                            <span className={cn('inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', STATUS_STYLES[r.status].pill)}>{STATUS_LABELS[r.status]}</span>
                          </td>
                        </tr>
                      );
                    })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="rounded-b-2xl border-t border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-400">
        Demo data: issued card numbers are sample figures; “Used by” lists the products saved in this browser.
      </p>
    </div>
  );
}

const chipClass = (on: boolean) =>
  cn(
    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
    on
      ? 'border-brand-600 bg-brand-600 text-white dark:border-brand-500 dark:bg-brand-500'
      : 'border-zinc-200 text-zinc-700 hover:border-brand-300 hover:bg-brand-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800',
  );

import { Fragment, type ReactNode } from 'react';
import type { ProductStatus } from '../../types/product';
import { cn } from '../../utils/cn';
import { PRODUCT_STATUS_LABELS } from '../../utils/productDraft';

export const portalCardClass = 'rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950/50';

export interface Crumb {
  label: string;
  href?: string;
}

/** A page's title and breadcrumb, with its main actions at the end of the row. */
export function PortalPageHeader({ title, crumbs, actions }: { title: string; crumbs: Crumb[]; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
        <nav aria-label="Breadcrumb" className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-zinc-400 dark:text-zinc-500">
          {crumbs.map((crumb, i) => {
            const last = i === crumbs.length - 1;
            return (
              <Fragment key={crumb.label}>
                {crumb.href ? (
                  <a href={crumb.href} className="hover:text-zinc-700 hover:underline dark:hover:text-zinc-200">
                    {crumb.label}
                  </a>
                ) : (
                  <span className={cn(last && 'text-zinc-700 dark:text-zinc-200')} aria-current={last ? 'page' : undefined}>
                    {crumb.label}
                  </span>
                )}
                {!last && <span aria-hidden="true">-</span>}
              </Fragment>
            );
          })}
        </nav>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-3">{actions}</div>}
    </div>
  );
}

const STATUS_CLASS: Record<ProductStatus, string> = {
  DRAFT: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200',
  PENDING_APPROVAL: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200',
  REJECTED: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
};

export function ProductStatusBadge({ status, testId }: { status: ProductStatus; testId?: string }) {
  return (
    <span className={cn('inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium', STATUS_CLASS[status])} data-testid={testId}>
      {PRODUCT_STATUS_LABELS[status]}
    </span>
  );
}

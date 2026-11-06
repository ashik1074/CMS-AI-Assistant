import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, Loader2, PackageOpen, Plus, Search, SlidersHorizontal, Trash2 } from 'lucide-react';
import { productErrorMessage } from '../../hooks/useProductSetup';
import type { ProductApi } from '../../services/productService';
import type { ProductRecord, ProductStatus } from '../../types/product';
import { cn } from '../../utils/cn';
import { draftFormHref, PRODUCT_STATUS_LABELS, productDetailsHref, titleCase } from '../../utils/productDraft';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { DropdownMenu, menuItemClass } from '../common/DropdownMenu';
import { useToast } from '../common/toastContext';
import { portalCardClass, PortalPageHeader, ProductStatusBadge } from './PortalPage';

type Loaded = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; products: ProductRecord[] };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** e.g. `02-Nov-2026 · 12:53 PM`. */
function formatUpdated(timestamp: number): string {
  const d = new Date(timestamp);
  const hours = d.getHours() % 12 || 12;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}-${MONTHS[d.getMonth()]}-${d.getFullYear()} · ${pad(hours)}:${pad(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}

const STATUSES = Object.keys(PRODUCT_STATUS_LABELS) as ProductStatus[];
const headClass = 'px-2.5 pb-3 text-left text-sm font-medium text-zinc-500 dark:text-zinc-400';
const cellClass = 'px-2.5 py-3.5 text-sm';

/** The portal's landing page: every product, newest first. */
export function ProductListPage({ api }: { api: ProductApi }) {
  const toast = useToast();
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<ProductStatus | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ProductRecord | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api
      .listProducts({ signal: controller.signal })
      .then((products) => setLoaded({ state: 'ready', products }))
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setLoaded({ state: 'error', message: productErrorMessage(e) });
      });
    return () => controller.abort();
  }, [api, attempt]);

  const all = loaded.state === 'ready' ? loaded.products : null;
  const shown = useMemo(() => {
    if (!all) return [];
    const q = query.trim().toLowerCase();
    return all.filter((p) => (!q || p.productName.toLowerCase().includes(q)) && (!status || p.status === status)).sort((a, b) => b.updatedAt - a.updatedAt);
  }, [all, query, status]);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const { productId, productName } = pendingDelete;
    setPendingDelete(null);
    try {
      await api.deleteProduct(productId);
      setLoaded((l) => (l.state === 'ready' ? { state: 'ready', products: l.products.filter((p) => p.productId !== productId) } : l));
      toast.show(`${productName || 'Product'} deleted.`, { kind: 'success' });
    } catch (e) {
      toast.show(productErrorMessage(e), { kind: 'error' });
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-8" data-testid="product-list">
      <PortalPageHeader
        title="Product List"
        crumbs={[{ label: 'Product Management' }, { label: 'Product List' }]}
        actions={
          <a href="#/products/new" className="btn-primary">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Product Setup
          </a>
        }
      />

      <div className={cn(portalCardClass, 'mt-4 p-4 sm:p-6')}>
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by Product"
            aria-label="Search by product"
            className="w-full rounded-lg border border-zinc-300 bg-transparent py-2.5 pl-10 pr-11 text-sm outline-none placeholder:text-zinc-400 focus:border-brand-400 focus:ring-3 focus:ring-brand-100 dark:border-zinc-700 dark:focus:ring-0 [&::-webkit-search-cancel-button]:hidden"
          />
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
            <DropdownMenu
              label="Filter by status"
              align="end"
              trigger={(props) => (
                <button {...props} type="button" aria-label={status ? `Filter by status: ${PRODUCT_STATUS_LABELS[status]}` : 'Filter by status'} className={cn('rounded-md p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800', status ? 'text-brand-600 dark:text-brand-300' : 'text-zinc-400')}>
                  <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            >
              {[null, ...STATUSES].map((s) => (
                <button key={s ?? 'all'} type="button" role="menuitemradio" aria-checked={status === s} className={menuItemClass} onClick={() => setStatus(s)}>
                  <Check className={cn('h-4 w-4', status !== s && 'invisible')} aria-hidden="true" />
                  {s ? PRODUCT_STATUS_LABELS[s] : 'All statuses'}
                </button>
              ))}
            </DropdownMenu>
          </div>
        </div>

        {loaded.state === 'loading' && (
          <p className="flex items-center justify-center gap-2 py-16 text-sm text-zinc-500 dark:text-zinc-400" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading products…
          </p>
        )}

        {loaded.state === 'error' && (
          <div className="flex flex-col items-center gap-3 py-16 text-center" role="alert">
            <AlertCircle className="h-7 w-7 text-red-500" aria-hidden="true" />
            <p className="text-sm text-zinc-600 dark:text-zinc-300">{loaded.message}</p>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setLoaded({ state: 'loading' });
                setAttempt((a) => a + 1);
              }}
            >
              Try again
            </button>
          </div>
        )}

        {all && !shown.length && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <PackageOpen className="h-8 w-8 text-zinc-400" aria-hidden="true" />
            <p className="text-sm font-medium">{all.length ? 'No products match your search.' : 'No products yet.'}</p>
            {!all.length && <p className="text-sm text-zinc-500 dark:text-zinc-400">Choose Product Setup to create the first one.</p>}
          </div>
        )}

        {shown.length > 0 && (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th scope="col" className={cn(headClass, 'w-[36%]')}>Product</th>
                  <th scope="col" className={headClass}>Product Type</th>
                  <th scope="col" className={headClass}>Status</th>
                  <th scope="col" className={headClass}>Last Updated</th>
                  <th scope="col" className={cn(headClass, 'text-center')}>Action</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => {
                  const draft = p.status === 'DRAFT';
                  const name = p.productName || 'Untitled product';
                  return (
                    <tr key={p.productId} className="border-b border-zinc-100 transition-colors last:border-0 hover:bg-zinc-50 dark:border-zinc-800/70 dark:hover:bg-zinc-800/40">
                      <td className={cellClass}>
                        <a href={draft ? draftFormHref(p.productId) : productDetailsHref(p.productId)} className="font-medium hover:text-brand-700 hover:underline dark:hover:text-brand-300">
                          {name}
                        </a>
                      </td>
                      <td className={cellClass}>{p.values.productType ? titleCase(p.values.productType) : '—'}</td>
                      <td className={cellClass}>
                        <ProductStatusBadge status={p.status} />
                      </td>
                      <td className={cn(cellClass, 'whitespace-nowrap')}>{formatUpdated(p.updatedAt)}</td>
                      <td className={cn(cellClass, 'text-center')}>
                        <button
                          type="button"
                          aria-label={`Delete ${name}`}
                          title={draft ? `Delete ${name}` : 'Only drafts can be deleted'}
                          disabled={!draft}
                          onClick={() => setPendingDelete(p)}
                          className="rounded-md p-1.5 text-brand-600 hover:bg-brand-50 disabled:pointer-events-none disabled:text-zinc-300 dark:text-brand-300 dark:hover:bg-brand-500/15 dark:disabled:text-zinc-600"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete draft?"
        description={`“${pendingDelete?.productName || 'Untitled product'}” will be permanently deleted.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

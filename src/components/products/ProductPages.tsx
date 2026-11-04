import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, Clock, FileEdit, Loader2, MessageSquare, PackageX } from 'lucide-react';
import type { ProductApi } from '../../services/productService';
import type { ProductForm, ProductRecord } from '../../types/product';
import { productErrorMessage } from '../../hooks/useProductSetup';
import { draftFormHref, productDetailsHref } from '../../utils/productDraft';
import { ProductSetupForm } from '../agent/ProductSetupCard';
import { ProductSummary } from '../agent/productSteps';

type Loaded = { state: 'loading' } | { state: 'missing' } | { state: 'error'; message: string } | { state: 'ready'; record: ProductRecord };

function useProduct(api: ProductApi, productId: string) {
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
  const [shownId, setShownId] = useState(productId);
  if (shownId !== productId) {
    setShownId(productId);
    setLoaded({ state: 'loading' });
  }
  useEffect(() => {
    const controller = new AbortController();
    api
      .getProduct(productId, { signal: controller.signal })
      .then((record) => setLoaded(record ? { state: 'ready', record } : { state: 'missing' }))
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setLoaded({ state: 'error', message: productErrorMessage(e) });
      });
    return () => controller.abort();
  }, [api, productId]);
  return [loaded, setLoaded] as const;
}

function PageShell({ title, children, testId }: { title: string; children: ReactNode; testId: string }) {
  return (
    <div className="chat-surface flex min-h-0 flex-1 flex-col overflow-y-auto pt-14" data-testid={testId}>
      <div className="mx-auto w-full max-w-4xl px-4 pb-10 pt-6 sm:px-6">
        <h1 className="sr-only">{title}</h1>
        {children}
      </div>
    </div>
  );
}

function StatusMessage({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-6 py-12 text-center dark:border-zinc-700 dark:bg-zinc-900/60">
      <span className="text-zinc-400" aria-hidden="true">
        {icon}
      </span>
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </div>
  );
}

const linkClass = 'inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline dark:text-brand-300';
const chatHref = (record: ProductRecord) => (record.origin ? `#/c/${encodeURIComponent(record.origin.conversationId)}` : '#/');

function Loading() {
  return (
    <StatusMessage icon={<Loader2 className="h-8 w-8 animate-spin" />} title="Loading product…">
      <span className="sr-only" role="status">
        Loading product
      </span>
    </StatusMessage>
  );
}

function NotFound({ productId, message }: { productId: string; message?: string }) {
  return (
    <StatusMessage icon={<PackageX className="h-8 w-8" />} title={message ? "The product couldn't be loaded" : `Product ${productId} was not found`}>
      <p className="max-w-md text-sm text-zinc-600 dark:text-zinc-400">{message ?? 'It may have been created in a different browser. Products in this demo are stored in this browser only.'}</p>
      <a href="#/" className={linkClass}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to the assistant
      </a>
    </StatusMessage>
  );
}

/* ---------- Product details ---------- */

export function ProductDetailsPage({ api, productId }: { api: ProductApi; productId: string }) {
  const [loaded] = useProduct(api, productId);
  if (loaded.state === 'loading') return <PageShell title="Product details" testId="product-details"><Loading /></PageShell>;
  if (loaded.state !== 'ready') return <PageShell title="Product details" testId="product-details"><NotFound productId={productId} message={loaded.state === 'error' ? loaded.message : undefined} /></PageShell>;

  const { record } = loaded;
  const draft = record.status === 'DRAFT';
  const when = new Date(record.submittedAt ?? record.updatedAt).toLocaleString();
  return (
    <PageShell title="Product details" testId="product-details">
      <a href={chatHref(record)} className={linkClass}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {record.origin ? 'Back to the chat' : 'Back to the assistant'}
      </a>
      <div className="mt-4 rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900/60">
        <div className="flex flex-wrap items-start gap-3 rounded-t-2xl border-b border-zinc-200 bg-zinc-50 px-5 py-4 dark:border-zinc-700 dark:bg-zinc-800/60">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Product details</p>
            <h2 className="text-xl font-semibold tracking-tight">{record.productName || 'Untitled product'}</h2>
            <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
              Product ID <strong>{record.productId}</strong> · {draft ? 'last saved' : 'submitted'} {when}
              {record.createdBy && <> by {record.createdBy}</>}
            </p>
          </div>
          <span
            className={
              draft
                ? 'rounded-full bg-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200'
                : 'rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-500/20 dark:text-amber-200'
            }
            data-testid="product-status"
          >
            {draft ? 'Draft' : 'Pending approval'}
          </span>
        </div>
        <div className="flex gap-2 border-b border-zinc-200 px-5 py-3 text-sm dark:border-zinc-700">
          {draft ? (
            <>
              <FileEdit className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" aria-hidden="true" />
              <p className="flex-1">
                This product is a draft and hasn&apos;t been submitted.{' '}
                <a href={draftFormHref(record.productId)} className={linkClass}>
                  Open draft product form
                </a>
              </p>
            </>
          ) : (
            <>
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
              <p className="flex-1">The product was submitted and is in <strong>Pending</strong> status. An approver needs to review and approve it before cards can be issued under it.</p>
            </>
          )}
        </div>
        <div className="px-5 py-5">
          <ProductSummary form={record.values} />
        </div>
      </div>
    </PageShell>
  );
}

/* ---------- Draft product form ---------- */

interface DraftProductPageProps {
  api: ProductApi;
  productId: string;
  userName: string;
  onSaved: (record: ProductRecord) => void;
  onSubmitted: (record: ProductRecord) => void;
}

export function DraftProductPage({ api, productId, userName, onSaved, onSubmitted }: DraftProductPageProps) {
  const [loaded, setLoaded] = useProduct(api, productId);
  const [busy, setBusy] = useState<'submit' | 'draft' | null>(null);
  const [error, setError] = useState<string>();

  if (loaded.state === 'loading') return <PageShell title="Draft product" testId="draft-product"><Loading /></PageShell>;
  if (loaded.state !== 'ready') return <PageShell title="Draft product" testId="draft-product"><NotFound productId={productId} message={loaded.state === 'error' ? loaded.message : undefined} /></PageShell>;

  const { record } = loaded;
  if (record.status !== 'DRAFT') {
    return (
      <PageShell title="Draft product" testId="draft-product">
        <StatusMessage icon={<Clock className="h-8 w-8" />} title="This product was already submitted">
          <p className="max-w-md text-sm text-zinc-600 dark:text-zinc-400">It is pending approval, so it can no longer be edited as a draft.</p>
          <a href={productDetailsHref(record.productId)} className={linkClass}>
            View product details
          </a>
        </StatusMessage>
      </PageShell>
    );
  }

  const save = async (values: ProductForm, kind: 'submit' | 'draft') => {
    setBusy(kind);
    setError(undefined);
    try {
      const next = kind === 'submit' ? await api.submitProduct(values, { productId }) : await api.saveDraft(values, { productId });
      if (kind === 'submit') onSubmitted(next);
      else {
        setLoaded({ state: 'ready', record: next });
        onSaved(next);
      }
    } catch (e) {
      setError(productErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <PageShell title="Draft product" testId="draft-product">
      <a href={chatHref(record)} className={linkClass}>
        {record.origin ? <MessageSquare className="h-4 w-4" aria-hidden="true" /> : <ArrowLeft className="h-4 w-4" aria-hidden="true" />}
        {record.origin ? 'Back to the chat' : 'Back to the assistant'}
      </a>
      <ProductSetupForm
        key={record.productId}
        initialValues={record.values}
        status="draft"
        busy={busy}
        error={error}
        userName={userName}
        subtitle={`Draft ${record.productId}`}
        onSubmit={(values) => void save(values, 'submit')}
        onSaveDraft={(values) => void save(values, 'draft')}
      />
    </PageShell>
  );
}

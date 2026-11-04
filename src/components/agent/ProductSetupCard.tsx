import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertCircle, ArrowRight, Check, CheckCircle2, CircleSlash, Clock, CreditCard, ExternalLink, FileEdit, Loader2, RotateCcw, Save } from 'lucide-react';
import { CURRENCIES, PIN_POLICIES, TXN_TYPES } from '../../services/productCatalog';
import type { ProductBasics, ProductField, ProductForm, ProductSetupAction } from '../../types/product';
import { cn } from '../../utils/cn';
import {
  basicsProgress,
  draftFormHref,
  MARKET_SEGMENTS,
  PRODUCT_STEPS,
  PRODUCT_TYPES,
  policyName,
  productDetailsHref,
  productProgress,
  schemeName,
  stepOfKey,
  titleCase,
  validateBasics,
  validateDraft,
  validateProduct,
  type ProductErrors,
  type ProductStep,
  type SetupProgress,
} from '../../utils/productDraft';
import { SchemeConfigSection } from './SchemeConfigSection';
import { Section, SelectField } from './productFields';
import { BasicsStep, FeesStep, LimitsStep, PermissionsStep, PoliciesStep, type StepProps } from './productSteps';

export interface ProductSetupHandlers {
  /** Fills "Created by" when the product has none. */
  userName: string;
  /** How long the "preparing" state lasts before the form appears. */
  prepareDelayMs: number;
  /** Confirms the basics and prepares the full setup. */
  continueSetup: (messageId: string, basics: ProductBasics) => void;
  submit: (messageId: string, values: ProductForm) => void;
  saveDraft: (messageId: string, values: ProductForm) => void;
  cancel: (messageId: string) => void;
  reopen: (messageId: string) => void;
}

interface ProductSetupCardProps {
  messageId: string;
  action: ProductSetupAction;
  handlers?: ProductSetupHandlers;
  readOnly?: boolean;
}

const cardClass = 'mt-3 rounded-2xl border bg-white shadow-sm dark:bg-zinc-900/60';
const headerClass = 'flex items-start gap-3 rounded-t-2xl border-b px-4 py-3';

/** An agentic "create product" flow rendered inside the chat. */
export function ProductSetupCard({ messageId, action, handlers, readOnly }: ProductSetupCardProps) {
  const live = readOnly ? undefined : handlers;
  switch (action.status) {
    case 'submitted':
      return <SubmittedCard action={action} />;
    case 'draft':
      return <DraftCard action={action} />;
    case 'preparing':
      return <PreparingCard durationMs={handlers?.prepareDelayMs ?? 0} />;
    case 'collecting':
      return <BasicsQuestions messageId={messageId} action={action} handlers={live} />;
    case 'cancelled':
      return (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-200 px-4 py-3 text-sm dark:border-zinc-700" data-testid="product-setup" data-status="cancelled">
          <CircleSlash className="h-4 w-4 text-zinc-400" aria-hidden="true" />
          <span className="flex-1 text-zinc-600 dark:text-zinc-400">Product setup cancelled. Nothing was created.</span>
          {live && (
            <button type="button" className="btn-secondary min-h-9" onClick={() => live.reopen(messageId)}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Reopen
            </button>
          )}
        </div>
      );
    default:
      return (
        <ProductSetupForm
          initialValues={action.values}
          userProvided={action.userProvided}
          status={action.status}
          busy={action.status === 'submitting' ? 'submit' : action.status === 'savingDraft' ? 'draft' : null}
          error={action.status === 'failed' ? action.error : undefined}
          userName={live?.userName ?? ''}
          onSubmit={live && ((values) => live.submit(messageId, values))}
          onSaveDraft={live && ((values) => live.saveDraft(messageId, values))}
          onCancel={live && (() => live.cancel(messageId))}
        />
      );
  }
}

/* ---------- The full setup form ---------- */

interface ProductSetupFormProps {
  initialValues: ProductForm;
  userProvided?: ProductField[];
  /** Shown as `data-status`, for the chat card's lifecycle. */
  status?: string;
  busy: 'submit' | 'draft' | null;
  error?: string;
  userName: string;
  /** Without handlers the form is read-only (e.g. in a shared chat). */
  onSubmit?: (values: ProductForm) => void;
  onSaveDraft?: (values: ProductForm) => void;
  onCancel?: () => void;
  cancelLabel?: string;
  /** Replaces "Review & complete" under the title; the title then shows the product name. */
  subtitle?: string;
}

const SECTION_BODIES: Record<Exclude<ProductStep, 'schemes'>, (p: StepProps) => ReactNode> = {
  basics: BasicsStep,
  policies: PoliciesStep,
  permissions: PermissionsStep,
  limits: LimitsStep,
  fees: FeesStep,
};

const count = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** One-line summaries shown on collapsed sections. */
function sectionSummary(id: ProductStep, form: ProductForm): string {
  switch (id) {
    case 'basics':
      return [form.productName, form.productType && titleCase(form.productType), form.currency].filter(Boolean).join(' · ');
    case 'policies':
      return [
        form.pinPolicyRequired === 'Y' ? `PIN: ${policyName(PIN_POLICIES, form.pinPolicyId) ?? 'not chosen'}` : 'No PIN',
        form.quotaPolicyRequired === 'Y' ? 'Quota required' : 'No quota',
        form.renewalType === 'RENEWABLE' ? 'Renewable' : 'One-time',
      ].join(' · ');
    case 'permissions': {
      const exceptions = form.countryControl.exceptions.length + form.currencyControl.exceptions.length + form.mccControl.exceptions.length;
      const all = (form.allowDomesticTxn === 'N' || form.domesticTxnTypes.length === Object.keys(TXN_TYPES).length) && (form.allowIntlTxn === 'N' || form.intlTxnTypes.length === Object.keys(TXN_TYPES).length);
      return `${all ? 'All transaction types' : 'Selected transaction types'} · ${exceptions ? count(exceptions, 'exception') : 'no exceptions'}`;
    }
    case 'limits':
      return [form.allowDomesticTxn === 'Y' && `${form.domesticLimits.length} domestic`, form.allowIntlTxn === 'Y' && `${form.intlLimits.length} international`].filter(Boolean).join(' · ') || 'No limits';
    case 'fees': {
      const others = (form.allowDomesticTxn === 'Y' ? form.domesticFees.length : 0) + (form.allowIntlTxn === 'Y' ? form.intlFees.length : 0);
      return [count(form.serviceFees.length, 'service fee'), others && count(others, 'transaction fee')].filter(Boolean).join(' · ');
    }
    case 'schemes':
      return form.schemes.map((s) => schemeName(s.schemeId)).filter(Boolean).join(', ') || 'Not selected yet';
  }
}

/** The full product setup as collapsible sections: Basics → Policies → Permissions → Limits → Fees → Scheme configuration. */
export function ProductSetupForm({ initialValues, userProvided = [], status = 'pending', busy, error, userName, onSubmit, onSaveDraft, onCancel, cancelLabel = 'Cancel', subtitle }: ProductSetupFormProps) {
  const [form, setForm] = useState<ProductForm>(initialValues);
  // Scheme configuration starts open: it is the part the user has to fill in.
  const [open, setOpen] = useState<Record<ProductStep, boolean>>({ basics: false, policies: false, permissions: false, limits: false, fees: false, schemes: true });
  /** Sections whose errors are shown: all of them after a submit attempt, or Basics after a draft without a name. */
  const [checked, setChecked] = useState<Set<ProductStep>>(() => new Set());
  const fromUser = useMemo(() => new Set(userProvided), [userProvided]);
  const disabled = !!busy || !onSubmit;

  const allErrors = useMemo(() => validateProduct(form), [form]);
  const errors: ProductErrors = useMemo(() => Object.fromEntries(Object.entries(allErrors).filter(([k]) => checked.has(stepOfKey(k)))), [allErrors, checked]);
  const errorKeys = Object.keys(errors);
  const incomplete = useMemo(() => new Set(Object.keys(allErrors).map(stepOfKey)), [allErrors]);
  const errorCount = (id: ProductStep) => errorKeys.filter((k) => stepOfKey(k) === id).length;
  const progress = useMemo(() => productProgress(form), [form]);

  /** Shows the errors of these sections and opens the ones that have any. */
  const reveal = (found: ProductErrors, sections: ProductStep[]) => {
    setChecked((c) => new Set([...c, ...sections]));
    setOpen((o) => {
      const next = { ...o };
      for (const key of Object.keys(found)) next[stepOfKey(key)] = true;
      return next;
    });
  };

  const withCreator = (values: ProductForm) => ({ ...values, createdBy: values.createdBy.trim() || userName });

  const submit = () => {
    if (!onSubmit) return;
    if (Object.keys(allErrors).length) return reveal(allErrors, PRODUCT_STEPS.map((s) => s.id));
    onSubmit(withCreator(form));
  };

  const saveDraft = () => {
    if (!onSaveDraft) return;
    const found = validateDraft(form);
    if (Object.keys(found).length) return reveal(found, ['basics']);
    onSaveDraft(withCreator(form));
  };

  const stepProps: StepProps = { form, setForm, errors, fromUser, disabled };

  return (
    <div className={cn(cardClass, 'border-zinc-200 dark:border-zinc-700')} data-testid="product-setup" data-status={status}>
      <div className={cn(headerClass, 'border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/60')}>
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white" aria-hidden="true">
          <CreditCard className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">{subtitle ? form.productName || 'Draft product' : 'Create card product'}</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{subtitle ?? 'Review & complete'}</p>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
            busy ? 'bg-brand-100 text-brand-800 dark:bg-brand-500/20 dark:text-brand-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200',
          )}
        >
          {busy === 'submit' ? 'Submitting…' : busy === 'draft' ? 'Saving draft…' : 'Needs your review'}
        </span>
      </div>

      <div className="sticky top-0 z-30 border-b border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
        <SetupProgressBar progress={progress} busy={busy} />
      </div>

      {error && (
        <div className="flex gap-2 border-b border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <strong className="font-medium">That didn&apos;t go through.</strong> {error}
          </span>
        </div>
      )}

      {PRODUCT_STEPS.map(({ id, label }) => {
        const Body = id === 'schemes' ? null : SECTION_BODIES[id];
        return (
          <Section key={id} title={label} summary={sectionSummary(id, form)} open={open[id]} onToggle={() => setOpen((o) => ({ ...o, [id]: !o[id] }))} errorCount={errorCount(id)} complete={!incomplete.has(id)}>
            <div className="pt-1">{Body ? <Body {...stepProps} /> : <SchemeConfigSection schemes={form.schemes} onChange={(schemes) => setForm((f) => ({ ...f, schemes }))} errors={errors} disabled={disabled} />}</div>
          </Section>
        );
      })}

      {onSubmit && (
        <div className="flex flex-col gap-3 rounded-b-2xl border-t border-zinc-200 bg-zinc-50 px-4 py-3 sm:flex-row sm:items-center dark:border-zinc-700 dark:bg-zinc-800/60">
          <p className="flex-1 text-xs text-zinc-500 dark:text-zinc-400" role={errorKeys.length ? 'alert' : undefined}>
            {errorKeys.length ? (
              <span className="text-red-700 dark:text-red-300">
                {errorKeys.length} field{errorKeys.length === 1 ? '' : 's'} need{errorKeys.length === 1 ? 's' : ''} attention before the product can be submitted.
              </span>
            ) : (
              <>
                Fields marked <span className="text-red-600 dark:text-red-400">*</span> are mandatory. Nothing is submitted until you choose Create Product.
              </>
            )}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            {onCancel && (
              <button type="button" className="btn-secondary min-h-9" disabled={!!busy} onClick={onCancel}>
                {cancelLabel}
              </button>
            )}
            {onSaveDraft && (
              <button type="button" className="btn-secondary min-h-9 whitespace-nowrap" disabled={!!busy} onClick={saveDraft}>
                {busy === 'draft' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4 max-sm:hidden" aria-hidden="true" />}
                Save as Draft
              </button>
            )}
            <button type="button" className="btn-primary order-first col-span-2 min-h-9 whitespace-nowrap sm:order-none" disabled={!!busy} onClick={submit}>
              {busy === 'submit' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
              {busy === 'submit' ? 'Submitting…' : 'Create Product'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Progress ---------- */

/** How much of the product is ready. It follows the form, so it goes down again when the user clears or adds something. */
function SetupProgressBar({ progress, busy, done }: { progress: SetupProgress; busy?: 'submit' | 'draft' | null; done?: string }) {
  const sending = busy === 'submit';
  const percent = done || sending ? 100 : progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  const left = progress.total - progress.done;
  const complete = !!done || percent === 100;
  const label = done
    ? done
    : sending
      ? 'Submitting the product for approval…'
      : busy === 'draft'
        ? 'Saving the draft…'
        : left === 0
          ? 'Everything is filled in. Ready to create.'
          : `${left} item${left === 1 ? '' : 's'} left to complete`;
  return (
    <div className="px-4 py-2.5" data-testid="setup-progress">
      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
        <span className="text-zinc-600 dark:text-zinc-300">{label}</span>
        <span className={cn('font-medium tabular-nums', complete ? 'text-emerald-700 dark:text-emerald-300' : 'text-zinc-700 dark:text-zinc-200')}>{percent}%</span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700"
        role="progressbar"
        aria-label="Product setup progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={done || sending ? label : `${percent}%, ${progress.done} of ${progress.total} items complete`}
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none', complete ? 'bg-emerald-500' : 'bg-brand-600', busy && 'animate-pulse')}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

/* ---------- After submitting or saving ---------- */

function ResultRows({ action }: { action: ProductSetupAction }) {
  const v = action.values;
  const rows: [string, string][] = [
    ['Name', v.productName || '—'],
    ['Type', [v.productType && titleCase(v.productType), titleCase(v.marketSegment)].filter(Boolean).join(' · ')],
    ['Currency', v.currency],
    ['Live from', v.effectiveDate || '—'],
  ];
  return (
    <dl className="grid gap-x-4 gap-y-2 px-4 py-3 text-sm sm:grid-cols-2">
      {rows.map(([k, val]) => (
        <div key={k} className="flex gap-2">
          <dt className="w-20 shrink-0 text-zinc-500 dark:text-zinc-400">{k}</dt>
          <dd className="min-w-0 break-words">{val}</dd>
        </div>
      ))}
    </dl>
  );
}

function SubmittedCard({ action }: { action: ProductSetupAction }) {
  const id = action.productId ?? '';
  return (
    <div className={cn(cardClass, 'border-amber-200 dark:border-amber-500/30')} data-testid="product-setup" data-status="submitted">
      <div className={cn(headerClass, 'items-center border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10')}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white" aria-hidden="true">
          <Clock className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">Product submitted</h3>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Product ID <strong data-testid="product-id">{id}</strong>
            {action.completedAt && <> · {new Date(action.completedAt).toLocaleString()}</>}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-500/20 dark:text-amber-200" data-testid="product-status">
          Pending approval
        </span>
      </div>
      <SetupProgressBar progress={productProgress(action.values)} done="Submitted · waiting for an approver" />
      <p className="px-4 pt-3 text-sm text-zinc-700 dark:text-zinc-300">
        The product is in <strong>Pending</strong> status. An approver needs to review and approve it before cards can be issued under it.
      </p>
      <ResultRows action={action} />
      {id && (
        <div className="rounded-b-2xl border-t border-zinc-200 px-4 py-2.5 dark:border-zinc-700">
          <a href={productDetailsHref(id)} className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
            View product details
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>
      )}
    </div>
  );
}

function DraftCard({ action }: { action: ProductSetupAction }) {
  const id = action.productId ?? '';
  return (
    <div className={cn(cardClass, 'border-zinc-200 dark:border-zinc-700')} data-testid="product-setup" data-status="draft">
      <div className={cn(headerClass, 'items-center border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/60')}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-500 text-white" aria-hidden="true">
          <FileEdit className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">Saved as draft</h3>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Draft ID <strong data-testid="product-id">{id}</strong>
            {action.completedAt && <> · {new Date(action.completedAt).toLocaleString()}</>}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200" data-testid="product-status">
          Draft
        </span>
      </div>
      <SetupProgressBar progress={productProgress(action.values)} />
      <p className="px-4 pt-3 text-sm text-zinc-700 dark:text-zinc-300">Nothing has been submitted yet. Open the draft whenever you&apos;re ready to finish it and choose Create Product.</p>
      <ResultRows action={action} />
      {id && (
        <div className="rounded-b-2xl border-t border-zinc-200 px-4 py-2.5 dark:border-zinc-700">
          <a href={draftFormHref(id)} className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
            Open draft product form
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>
      )}
    </div>
  );
}

/* ---------- Between the basics and the form ---------- */

const PREPARING_STEPS = ['Applying your product basics', 'Setting up policies and permissions', 'Suggesting limits and fees', 'Getting the form ready'];

/** The assistant's processing pause after the basics: a short, visible "building your setup" phase before the form appears. */
function PreparingCard({ durationMs }: { durationMs: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Date.now() - started), 200);
    return () => clearInterval(timer);
  }, []);
  const share = durationMs / PREPARING_STEPS.length;
  const active = share ? Math.min(PREPARING_STEPS.length - 1, Math.floor(elapsed / share)) : PREPARING_STEPS.length - 1;
  const percent = durationMs ? Math.min(100, Math.round((elapsed / durationMs) * 100)) : 100;
  return (
    <div className={cn(cardClass, 'border-zinc-200 dark:border-zinc-700')} data-testid="product-setup" data-status="preparing">
      <div className={cn(headerClass, 'border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/60')}>
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white" aria-hidden="true">
          <CreditCard className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">Create card product</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Preparing your product setup</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-800 dark:bg-brand-500/20 dark:text-brand-200">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          Processing…
        </span>
      </div>
      <div className="space-y-3 rounded-b-2xl px-4 py-4">
        <div
          className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700"
          role="progressbar"
          aria-label="Preparing the product setup"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <div className="h-full rounded-full bg-brand-600 transition-[width] duration-200 ease-linear motion-reduce:transition-none" style={{ width: `${percent}%` }} />
        </div>
        <ol className="space-y-2 text-sm" aria-live="polite">
          {PREPARING_STEPS.map((label, i) => (
            <li key={label} className={cn('flex items-center gap-2', i > active && 'text-zinc-400 dark:text-zinc-500')} aria-current={i === active ? 'step' : undefined}>
              {i < active ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              ) : i === active ? (
                <Loader2 className="h-4 w-4 animate-spin text-brand-600 dark:text-brand-300" aria-hidden="true" />
              ) : (
                <span className="h-4 w-4 rounded-full border border-current" aria-hidden="true" />
              )}
              {label}
              <span className="sr-only">{i < active ? ' (done)' : i === active ? ' (in progress)' : ''}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/* ---------- Before the setup: product basics ---------- */

const enumOptions = <T extends string>(values: readonly T[]) => values.map((v) => ({ value: v, label: titleCase(v) }));
const BASIC_OPTIONS = {
  productType: [{ value: '' as const, label: 'Select product type' }, ...enumOptions(PRODUCT_TYPES)],
  marketSegment: [{ value: '' as const, label: 'Select market segment' }, ...enumOptions(MARKET_SEGMENTS)],
  currency: (current: string) => [{ value: '', label: 'Select currency' }, ...[...new Set([...CURRENCIES, ...(current ? [current] : [])])].map((c) => ({ value: c, label: c }))],
};

/** Asks for product type, account currency and market segment before the assistant prepares the full setup. */
function BasicsQuestions({ messageId, action, handlers }: { messageId: string; action: ProductSetupAction; handlers?: ProductSetupHandlers }) {
  const [basics, setBasics] = useState<ProductBasics>(action.basics);
  const [showErrors, setShowErrors] = useState(false);
  const errors = showErrors ? validateBasics(basics) : {};
  const fromUser = new Set(action.userProvided);
  const disabled = !handlers;
  const set = <K extends keyof ProductBasics>(key: K, value: ProductBasics[K]) => setBasics((b) => ({ ...b, [key]: value }));
  const progress = useMemo(() => basicsProgress(basics, action.preferences), [basics, action.preferences]);

  const next = () => {
    if (!handlers) return;
    if (Object.keys(validateBasics(basics)).length) {
      setShowErrors(true);
      return;
    }
    handlers.continueSetup(messageId, basics);
  };

  return (
    <div className={cn(cardClass, 'border-zinc-200 dark:border-zinc-700')} data-testid="product-setup" data-status="collecting">
      <div className={cn(headerClass, 'border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/60')}>
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white" aria-hidden="true">
          <CreditCard className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">Create card product</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Before we start · Product basics</p>
        </div>
        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">Needs your input</span>
      </div>
      <div className="sticky top-0 z-30 border-b border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
        <SetupProgressBar progress={progress} />
      </div>
      <div className="grid gap-3 px-4 py-4 sm:grid-cols-3">
        <SelectField label="Product type" required value={basics.productType} options={BASIC_OPTIONS.productType} onChange={(v) => set('productType', v)} fromUser={fromUser.has('productType')} error={errors.productType} disabled={disabled} />
        <SelectField label="Account currency" required value={basics.currency} options={BASIC_OPTIONS.currency(basics.currency)} onChange={(v) => set('currency', v)} fromUser={fromUser.has('currency')} error={errors.currency} disabled={disabled} />
        <SelectField
          label="Market segment"
          required
          value={basics.marketSegment}
          options={BASIC_OPTIONS.marketSegment}
          onChange={(v) => set('marketSegment', v)}
          fromUser={fromUser.has('marketSegment')}
          error={errors.marketSegment}
          disabled={disabled}
        />
      </div>
      {handlers && (
        <div className="flex flex-col gap-2 rounded-b-2xl border-t border-zinc-200 bg-zinc-50 px-4 py-3 sm:flex-row sm:items-center dark:border-zinc-700 dark:bg-zinc-800/60">
          <p className="flex-1 text-xs text-zinc-500 dark:text-zinc-400">Next, I&apos;ll prepare the full product setup for you to review.</p>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <button type="button" className="btn-secondary min-h-9" onClick={() => handlers.cancel(messageId)}>
              Cancel
            </button>
            <button type="button" className="btn-primary min-h-9" onClick={next}>
              Continue
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

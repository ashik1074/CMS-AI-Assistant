import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, Check, Info, Loader2, X } from 'lucide-react';
import { productErrorMessage } from '../../hooks/useProductSetup';
import type { ProductApi } from '../../services/productService';
import type { ProductForm, ProductRecord } from '../../types/product';
import { cn } from '../../utils/cn';
import { stepOfKey, validateDraft, validateProduct, type ProductErrors, type ProductStep } from '../../utils/productDraft';
import { SchemeConfigSection } from '../agent/SchemeConfigSection';
import { BasicsStep, FeesStep, LimitsStep, PermissionsStep, PoliciesStep, ProductSummary, type StepProps } from '../agent/productSteps';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { portalCardClass, PortalPageHeader } from './PortalPage';

type WizardStep = ProductStep | 'review';

const STEP_GROUPS: { label: string; steps: { id: WizardStep; label: string }[] }[] = [
  { label: 'Setup', steps: [{ id: 'basics', label: 'Basics' }] },
  {
    label: 'Usage Rules',
    steps: [
      { id: 'policies', label: 'Policies' },
      { id: 'permissions', label: 'Permissions' },
      { id: 'limits', label: 'Limits' },
    ],
  },
  {
    label: 'Services & Benefits',
    steps: [
      { id: 'fees', label: 'Fees' },
      { id: 'schemes', label: 'Schemes' },
    ],
  },
  { label: 'Review', steps: [{ id: 'review', label: 'Preview & Submit' }] },
];

const STEP_ORDER = STEP_GROUPS.flatMap((g) => g.steps.map((s) => s.id));
const FORM_STEPS = STEP_ORDER.filter((s): s is ProductStep => s !== 'review');

interface ProductWizardProps {
  api: ProductApi;
  title: string;
  initialValues: ProductForm;
  /** Set when finishing a saved draft. */
  productId?: string;
  userName: string;
  testId: string;
  onCancel: () => void;
  onSaved: (record: ProductRecord) => void;
  onSubmitted: (record: ProductRecord) => void;
}

/** The Product Setup form, one step at a time: Basics → Policies → Permissions → Limits → Fees → Schemes → Preview & Submit. */
export function ProductWizard({ api, title, initialValues, productId, userName, testId, onCancel, onSaved, onSubmitted }: ProductWizardProps) {
  const [form, setForm] = useState(initialValues);
  const [index, setIndex] = useState(0);
  // A draft has been through the steps before, so all of them can be opened.
  const [reached, setReached] = useState(productId ? STEP_ORDER.length - 1 : 0);
  /** Steps whose errors are shown: the user tried to leave them, or to submit. */
  const [checked, setChecked] = useState<Set<ProductStep>>(() => new Set());
  const [bannerOpen, setBannerOpen] = useState(!productId);
  const [busy, setBusy] = useState<'submit' | 'draft' | null>(null);
  const [error, setError] = useState<string>();
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const request = useRef<AbortController | null>(null);

  // Leaving the page cancels a save that is still running, so it can't navigate the user away afterwards.
  useEffect(() => () => request.current?.abort(), []);

  const step = STEP_ORDER[index];
  const allErrors = useMemo(() => validateProduct(form), [form]);
  const errors: ProductErrors = useMemo(() => Object.fromEntries(Object.entries(allErrors).filter(([k]) => checked.has(stepOfKey(k)))), [allErrors, checked]);
  const stepHasErrors = (id: WizardStep) => id !== 'review' && checked.has(id) && Object.keys(allErrors).some((k) => stepOfKey(k) === id);
  const disabled = !!busy;
  const stepProps: StepProps = { form, setForm, errors, fromUser: useMemo(() => new Set(), []), disabled };

  const goTo = (next: number) => {
    setIndex(next);
    setReached((r) => Math.max(r, next));
    bodyRef.current?.scrollTo?.({ top: 0 });
  };

  const nextStep = () => {
    if (step !== 'review' && Object.keys(allErrors).some((k) => stepOfKey(k) === step)) {
      setChecked((c) => new Set(c).add(step));
      bodyRef.current?.scrollTo?.({ top: 0 });
      return;
    }
    goTo(index + 1);
  };

  const save = async (kind: 'submit' | 'draft') => {
    const controller = new AbortController();
    request.current = controller;
    const values = { ...form, createdBy: form.createdBy.trim() || userName };
    setBusy(kind);
    setError(undefined);
    try {
      const options = { productId, signal: controller.signal };
      const record = kind === 'submit' ? await api.submitProduct(values, options) : await api.saveDraft(values, options);
      if (kind === 'submit') onSubmitted(record);
      else onSaved(record);
    } catch (e) {
      if (controller.signal.aborted) return;
      setError(productErrorMessage(e));
      setBusy(null);
      bodyRef.current?.scrollTo?.({ top: 0 });
    }
  };

  const submit = () => {
    const keys = Object.keys(allErrors);
    if (keys.length) {
      setChecked(new Set(FORM_STEPS));
      goTo(Math.min(...keys.map((k) => STEP_ORDER.indexOf(stepOfKey(k)))));
      return;
    }
    void save('submit');
  };

  const saveAndExit = () => {
    if (Object.keys(validateDraft(form)).length) {
      setChecked((c) => new Set(c).add('basics'));
      setError('Enter a product name to save a draft.');
      goTo(0);
      return;
    }
    void save('draft');
  };

  const cancel = () => {
    if (JSON.stringify(form) === JSON.stringify(initialValues)) onCancel();
    else setConfirmingCancel(true);
  };

  const review = step === 'review';

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5 sm:px-8 md:overflow-hidden" data-testid={testId}>
      <PortalPageHeader
        title={title}
        crumbs={[{ label: 'Product Management' }, { label: 'Product List', href: '#/' }, { label: title }]}
        actions={
          <>
            <button type="button" className="btn-secondary border-transparent bg-brand-50 hover:bg-brand-100 dark:bg-brand-500/15 dark:hover:bg-brand-500/25" disabled={disabled} onClick={cancel}>
              Cancel
            </button>
            <button type="button" className="btn-primary" disabled={disabled} onClick={saveAndExit}>
              {busy === 'draft' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Save and Exit
            </button>
          </>
        }
      />

      <div className="mt-4 grid gap-4 md:min-h-0 md:flex-1 md:grid-cols-[230px_minmax(0,1fr)]">
        <nav aria-label="Product setup steps" className="max-md:flex max-md:gap-1 max-md:overflow-x-auto">
          <div className="contents md:block md:border-l md:border-zinc-200 md:dark:border-zinc-800">
            {STEP_GROUPS.map((group) => (
              <div key={group.label} className="contents md:mb-5 md:block">
                <p className="mb-2 px-3 text-xs font-medium uppercase text-zinc-500 max-md:hidden dark:text-zinc-400">{group.label}</p>
                <ul className="contents md:block md:space-y-1">
                  {group.steps.map(({ id, label }) => {
                    const i = STEP_ORDER.indexOf(id);
                    const current = i === index;
                    const done = id !== 'review' && i < reached && !Object.keys(allErrors).some((k) => stepOfKey(k) === id);
                    return (
                      <li key={id} className="contents md:block">
                        <button
                          type="button"
                          disabled={i > reached || disabled}
                          onClick={() => goTo(i)}
                          aria-current={current ? 'step' : undefined}
                          className={cn(
                            'flex w-full items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2.5 text-left text-sm transition-colors disabled:cursor-not-allowed',
                            current ? 'bg-brand-50 font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-200' : i > reached ? 'text-zinc-400 dark:text-zinc-500' : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800',
                            stepHasErrors(id) && !current && 'text-red-600 dark:text-red-400',
                          )}
                        >
                          {done ? (
                            <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                          ) : (
                            <span className={cn('h-3.5 w-3.5 shrink-0 rounded-full border-2', current ? 'border-brand-600 dark:border-brand-300' : 'border-transparent')} aria-hidden="true" />
                          )}
                          {label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        <div className={cn(portalCardClass, 'flex flex-col md:min-h-0')}>
          <div ref={bodyRef} className="portal-form min-h-0 flex-1 space-y-5 p-4 sm:p-7 md:overflow-y-auto">
            {error && (
              <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200" role="alert">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            {step === 'basics' && bannerOpen && (
              <div className="flex gap-3 rounded-lg border border-dashed border-brand-400 bg-brand-50/60 px-4 py-4 dark:bg-brand-500/10" data-testid="prerequisites">
                <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand-600 dark:text-brand-300" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <h2 className="font-medium">Prerequisites Required</h2>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                    Creating a product links various system configurations together. Please make sure your BINs, Schemes, Policies, Rewards, and Notification templates are already set up in the platform before continuing.
                  </p>
                </div>
                <button type="button" aria-label="Dismiss prerequisites" onClick={() => setBannerOpen(false)} className="h-fit rounded-md p-1 hover:bg-brand-100 dark:hover:bg-brand-500/20">
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            )}

            {step === 'basics' && <BasicsStep {...stepProps} />}
            {step === 'policies' && <PoliciesStep {...stepProps} />}
            {step === 'permissions' && <PermissionsStep {...stepProps} />}
            {step === 'limits' && <LimitsStep {...stepProps} />}
            {step === 'fees' && <FeesStep {...stepProps} />}
            {step === 'schemes' && <SchemeConfigSection schemes={form.schemes} onChange={(schemes) => setForm((f) => ({ ...f, schemes }))} errors={errors} disabled={disabled} />}
            {review && (
              <>
                <p className="text-sm text-zinc-600 dark:text-zinc-300">Check the details below. Once submitted, the product waits for an approver and can no longer be edited.</p>
                <ProductSummary form={form} />
              </>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-zinc-200 px-4 py-3 sm:px-7 dark:border-zinc-800">
            {index > 0 ? (
              <button type="button" className="btn-secondary" disabled={disabled} onClick={() => goTo(index - 1)}>
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Previous
              </button>
            ) : (
              <span />
            )}
            {review ? (
              <button type="button" className="btn-primary" disabled={disabled} onClick={submit}>
                {busy === 'submit' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
                {busy === 'submit' ? 'Submitting…' : 'Submit Product'}
              </button>
            ) : (
              <button type="button" className="btn-primary" disabled={disabled} onClick={nextStep}>
                Next Step
              </button>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmingCancel}
        title="Discard your changes?"
        description="What you entered on this form will be lost. To keep it, choose Save and Exit instead."
        confirmLabel="Discard"
        destructive
        onConfirm={() => {
          setConfirmingCancel(false);
          onCancel();
        }}
        onCancel={() => setConfirmingCancel(false)}
      />
    </div>
  );
}

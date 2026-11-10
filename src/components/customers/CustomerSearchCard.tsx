import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Search, UserSearch } from 'lucide-react';
import type { ReportHandlers } from '../../hooks/useReports';
import type { CustomerSearchAction, CustomerSearchValues } from '../../types/customer';
import { cn } from '../../utils/cn';
import { searchCustomers, searchedBy, SEARCH_FIELDS, validateCustomerSearch } from '../../utils/customerData';
import { inputClass } from '../agent/productFields';
import { CardHeader } from '../reports/ReportCards';
import { cardClass, CustomerProfileCard, SearchingCard } from './CustomerLookupCard';

interface CustomerSearchCardProps {
  messageId: string;
  action: CustomerSearchAction;
  handlers?: ReportHandlers;
  readOnly?: boolean;
  /** When the form was added; a form that was just opened takes focus. */
  createdAt: number;
}

/** Customer Search in the chat: a form with phone number, CIF ID and NID, then the customer it finds. */
export function CustomerSearchCard({ messageId, action, handlers, readOnly, createdAt }: CustomerSearchCardProps) {
  const live = readOnly ? undefined : handlers;
  const by = searchedBy(action.values);

  if (action.status === 'searching') {
    return <SearchingCard title="Customer Search" subtitle={by.map((f) => `${f.label} ${f.value}`).join(' · ')} searchingBy={by.map((f) => f.label).join(', ')} testId="customer-search" />;
  }
  const customer = action.status === 'found' ? searchCustomers(action.values) : null;
  if (customer) {
    return (
      <CustomerProfileCard
        customer={customer}
        foundBy={by}
        testId="customer-search"
        footerAction={
          live?.startCustomerSearch && (
            <button type="button" onClick={live.startCustomerSearch} className="inline-flex shrink-0 items-center gap-1 font-medium text-brand-700 hover:underline dark:text-brand-300">
              <Search className="h-3.5 w-3.5" aria-hidden="true" />
              Search another customer
            </button>
          )
        }
      />
    );
  }
  return <SearchForm messageId={messageId} initial={action.values} handlers={live} createdAt={createdAt} />;
}

function SearchForm({ messageId, initial, handlers, createdAt }: { messageId: string; initial: CustomerSearchValues; handlers?: ReportHandlers; createdAt: number }) {
  const [values, setValues] = useState(initial);
  const [tried, setTried] = useState(false);
  const fieldRefs = useRef<Partial<Record<keyof CustomerSearchValues, HTMLInputElement | null>>>({});
  const focused = useRef(false);
  const id = useId();
  const errors = tried ? validateCustomerSearch(values) : {};

  // A form the user just opened is ready to type into.
  useEffect(() => {
    if (focused.current || !handlers) return;
    focused.current = true;
    if (Date.now() - createdAt < 5000) fieldRefs.current.phone?.focus();
  }, [handlers, createdAt]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!handlers) return;
    const found = validateCustomerSearch(values);
    setTried(true);
    if (Object.keys(found).length) {
      const firstBad = SEARCH_FIELDS.find((f) => found[f.key]) ?? SEARCH_FIELDS[0];
      fieldRefs.current[firstBad.key]?.focus();
      return;
    }
    handlers.submitCustomerSearch(messageId, values);
  };

  const noteId = `${id}-note`;
  return (
    <form className={cardClass} data-testid="customer-search" data-status="collecting" onSubmit={submit} noValidate aria-label="Customer Search">
      <CardHeader
        icon={<UserSearch className="h-4 w-4" />}
        title="Customer Search"
        subtitle="Phone number, CIF ID or NID"
        badge={<span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">Needs your input</span>}
      />
      <div className="grid gap-3 px-4 pt-4 sm:grid-cols-3">
        {SEARCH_FIELDS.map((f) => {
          const errorId = `${id}-${f.key}-error`;
          const error = errors[f.key];
          return (
            <div key={f.key}>
              <label htmlFor={`${id}-${f.key}`} className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                {f.label}
              </label>
              <input
                id={`${id}-${f.key}`}
                ref={(el) => {
                  fieldRefs.current[f.key] = el;
                }}
                value={values[f.key]}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                inputMode={f.key === 'cif' ? 'text' : 'numeric'}
                autoComplete="off"
                maxLength={32}
                disabled={!handlers}
                aria-invalid={!!error || !!errors.form}
                aria-describedby={error ? errorId : noteId}
                className={inputClass}
              />
              {error && (
                <p id={errorId} className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {error}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <p id={noteId} className={cn('px-4 pb-4 pt-2 text-xs', errors.form ? 'text-red-600 dark:text-red-400' : 'text-zinc-500 dark:text-zinc-400')} role={errors.form ? 'alert' : undefined}>
        {errors.form ?? 'Each field is optional, but fill in at least one.'}
      </p>
      {handlers && (
        <div className="flex flex-col gap-2 rounded-b-2xl border-t border-zinc-200 bg-zinc-50 px-4 py-3 sm:flex-row sm:items-center dark:border-zinc-700 dark:bg-zinc-800/60">
          <p className="flex-1 text-xs text-zinc-500 dark:text-zinc-400">Demo data: profiles are generated in this browser, not read from a customer system.</p>
          <button type="submit" className="btn-primary min-h-9">
            <Search className="h-4 w-4" aria-hidden="true" />
            Search
          </button>
        </div>
      )}
    </form>
  );
}

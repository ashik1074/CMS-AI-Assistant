import { useState, type ReactNode } from 'react';
import { Cake, CalendarClock, Loader2, Mail, RotateCcw, SearchX, ShieldCheck, Smartphone, User, UserRound, UserSearch } from 'lucide-react';
import type { ReportHandlers } from '../../hooks/useReports';
import type { CustomerIdType, CustomerLookupAction, CustomerProfile, CustomerStatus } from '../../types/customer';
import { cn } from '../../utils/cn';
import { findCustomer, formatDay, formatDayTime, ID_TYPE_CHOICES, ID_TYPE_LABELS, idRule, initials, maskEmail } from '../../utils/customerData';
import { CardHeader, RadioCards, Required } from '../reports/ReportCards';

const cardClass = 'mt-3 rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900/60';

interface CardProps {
  messageId: string;
  action: CustomerLookupAction;
  handlers?: ReportHandlers;
  readOnly?: boolean;
}

/** Customer lookup in the chat: ask what kind of ID the value is (if needed), search, then show the profile. */
export function CustomerLookupCard({ messageId, action, handlers, readOnly }: CardProps) {
  const live = readOnly ? undefined : handlers;
  if (action.status === 'choosing' || !action.idType) return <ChooseIdType messageId={messageId} query={action.query} handlers={live} />;
  if (action.status === 'searching') return <Searching query={action.query} idType={action.idType} />;
  const customer = action.status === 'found' ? findCustomer(action.query, action.idType) : null;
  if (!customer) return <NotValid messageId={messageId} query={action.query} idType={action.idType} handlers={live} />;
  return <CustomerProfileCard customer={customer} query={action.query} idType={action.idType} />;
}

function ChooseIdType({ messageId, query, handlers }: { messageId: string; query: string; handlers?: ReportHandlers }) {
  const [idType, setIdType] = useState<CustomerIdType | null>(null);
  const [tried, setTried] = useState(false);
  const search = () => {
    if (!handlers) return;
    if (!idType) return setTried(true);
    handlers.searchCustomer(messageId, idType);
  };
  return (
    <div className={cardClass} data-testid="customer-lookup" data-status="choosing">
      <CardHeader
        icon={<UserSearch className="h-4 w-4" />}
        title="Customer lookup"
        subtitle={`Searching for ${query}`}
        badge={<span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">Needs your input</span>}
      />
      <div className="px-4 py-4">
        <fieldset>
          <legend className="mb-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">
            What is <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{query}</span>? <Required />
          </legend>
          <RadioCards name={`id-type-${messageId}`} label="Identifier type" options={ID_TYPE_CHOICES} value={idType} onChange={setIdType} invalid={tried && !idType} disabled={!handlers} />
          {tried && !idType && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
              Choose whether this is a phone number, CIF ID or customer ID.
            </p>
          )}
        </fieldset>
      </div>
      {handlers && (
        <div className="flex flex-col gap-2 rounded-b-2xl border-t border-zinc-200 bg-zinc-50 px-4 py-3 sm:flex-row sm:items-center dark:border-zinc-700 dark:bg-zinc-800/60">
          <p className="flex-1 text-xs text-zinc-500 dark:text-zinc-400">Demo data: profiles are generated in this browser, not read from a customer system.</p>
          <button type="button" className="btn-primary min-h-9" onClick={search}>
            <UserSearch className="h-4 w-4" aria-hidden="true" />
            Search customer
          </button>
        </div>
      )}
    </div>
  );
}

function Searching({ query, idType }: { query: string; idType: CustomerIdType }) {
  return (
    <div className={cardClass} data-testid="customer-lookup" data-status="searching" aria-busy="true">
      <CardHeader
        icon={<UserSearch className="h-4 w-4" />}
        title="Customer lookup"
        subtitle={`${ID_TYPE_LABELS[idType]} · ${query}`}
        badge={
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-800 dark:bg-brand-500/20 dark:text-brand-200">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            Searching…
          </span>
        }
      />
      {/* Skeleton in the shape of the profile, so the result doesn't jump in. */}
      <div className="animate-pulse px-5 py-5" aria-hidden="true">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-zinc-200 dark:bg-zinc-700" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-48 rounded bg-zinc-200 dark:bg-zinc-700" />
            <div className="h-3 w-28 rounded bg-zinc-200 dark:bg-zinc-700" />
          </div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-2.5 w-20 rounded bg-zinc-200 dark:bg-zinc-700" />
              <div className="h-3.5 w-36 rounded bg-zinc-200 dark:bg-zinc-700" />
            </div>
          ))}
        </div>
      </div>
      <p className="sr-only" role="status">
        Searching customer records by {ID_TYPE_LABELS[idType]}…
      </p>
    </div>
  );
}

function NotValid({ messageId, query, idType, handlers }: { messageId: string; query: string; idType: CustomerIdType; handlers?: ReportHandlers }) {
  return (
    <div className={cardClass} data-testid="customer-lookup" data-status="invalid">
      <CardHeader icon={<SearchX className="h-4 w-4" />} title="Customer lookup" subtitle={`${ID_TYPE_LABELS[idType]} · ${query}`} />
      <div className="px-4 py-4 text-sm">
        <p className="font-medium text-zinc-900 dark:text-zinc-100">
          No customer found: <span className="tabular-nums">{query}</span> isn't a valid {ID_TYPE_LABELS[idType]}.
        </p>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">{idRule(idType)}</p>
      </div>
      {handlers && (
        <div className="flex justify-end rounded-b-2xl border-t border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/60">
          <button type="button" className="btn-secondary min-h-9" onClick={() => handlers.rechooseCustomerIdType(messageId)}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Search as a different ID type
          </button>
        </div>
      )}
    </div>
  );
}

const STATUS_STYLES: Record<CustomerStatus, { pill: string; dot: string }> = {
  Active: { pill: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/25', dot: 'bg-emerald-500' },
  Inactive: { pill: 'bg-zinc-100 text-zinc-700 ring-zinc-500/20 dark:bg-zinc-700/60 dark:text-zinc-200 dark:ring-zinc-400/25', dot: 'bg-zinc-400' },
  Dormant: { pill: 'bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-400/25', dot: 'bg-amber-500' },
};

function CustomerProfileCard({ customer, query, idType }: { customer: CustomerProfile; query: string; idType: CustomerIdType }) {
  const status = STATUS_STYLES[customer.status];
  const fullName = `${customer.salutation} ${customer.name}`;
  return (
    <article className={cn(cardClass, 'overflow-hidden')} data-testid="customer-lookup" data-status="found" aria-label={`Customer profile: ${fullName}`}>
      <header className="flex flex-wrap items-center gap-4 border-b border-zinc-200 bg-gradient-to-r from-brand-50 via-white to-white px-5 py-4 dark:border-zinc-700 dark:from-brand-500/15 dark:via-zinc-900/40 dark:to-zinc-900/40">
        <span
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-lg font-semibold tracking-wide text-white shadow-sm ring-4 ring-white dark:ring-zinc-900"
          aria-hidden="true"
        >
          {initials(customer.name)}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-lg font-semibold leading-tight tracking-tight text-zinc-900 dark:text-zinc-50">{fullName}</h3>
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            <span className="whitespace-nowrap">
              Customer ID: <span className="font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">{customer.customerId}</span>
            </span>
            <span className="whitespace-nowrap">
              CIF: <span className="font-medium tabular-nums text-zinc-700 dark:text-zinc-300">{customer.cifId}</span>
            </span>
          </p>
        </div>
        <span className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset', status.pill)} data-testid="customer-status">
          <span className={cn('h-1.5 w-1.5 rounded-full', status.dot)} aria-hidden="true" />
          {customer.status}
        </span>
      </header>

      <dl className="grid gap-x-8 gap-y-5 px-5 py-5 sm:grid-cols-2">
        <Detail icon={<User />} label="Father's Name" value={customer.fatherName} />
        <Detail icon={<UserRound />} label="Mother's Name" value={customer.motherName} />
        <Detail icon={<Cake />} label="Date of Birth" value={formatDay(customer.dateOfBirth)} numeric />
        <Detail icon={<Smartphone />} label="Mobile Number" value={customer.mobile} numeric />
        <Detail icon={<Mail />} label="Email Address" value={maskEmail(customer.email)} hint="Partly hidden for privacy" />
        <Detail icon={<CalendarClock />} label="Registered On" value={formatDayTime(customer.registeredOn)} numeric />
      </dl>

      <footer className="flex items-center gap-1.5 border-t border-zinc-200 bg-zinc-50 px-5 py-2.5 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-400">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          Found by {ID_TYPE_LABELS[idType]} <span className="font-medium tabular-nums text-zinc-700 dark:text-zinc-300">{query}</span> · demo data
        </span>
      </footer>
    </article>
  );
}

function Detail({ icon, label, value, hint, numeric }: { icon: ReactNode; label: string; value: string; hint?: string; numeric?: boolean }) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300 [&>svg]:h-4 [&>svg]:w-4" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</dt>
        <dd className={cn('mt-0.5 break-words text-[0.9375rem] font-medium text-zinc-900 dark:text-zinc-100', numeric && 'tabular-nums')} title={hint}>
          {value}
        </dd>
      </div>
    </div>
  );
}

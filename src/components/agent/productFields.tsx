import { useId, type ReactNode } from 'react';
import { CheckCircle2, ChevronDown, Info, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { cn } from '../../utils/cn';

export const inputClass =
  'w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:border-brand-400 focus:ring-3 focus:ring-brand-100 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-red-500 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-500 dark:focus:ring-0';

interface FieldShellProps {
  label: string;
  required?: boolean;
  /** The value came from the user's own message. */
  fromUser?: boolean;
  hint?: string;
  error?: string;
  className?: string;
  /** Shown at the end of the label row, e.g. a character count. */
  aside?: ReactNode;
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
}

export function Field({ label, required, fromUser, hint, error, className, aside, children }: FieldShellProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={className}>
      <div className="mb-1 flex items-center gap-2">
        <label htmlFor={id} className="flex flex-1 flex-wrap items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">
          {label}
          {required && (
            <span className="text-red-600 dark:text-red-400" aria-hidden="true">
              *
            </span>
          )}
          {fromUser && <FromUserBadge />}
        </label>
        {aside}
      </div>
      {children({ id, describedBy, invalid: !!error })}
      {hint && !error && (
        <p id={hintId} className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

export function FromUserBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-brand-50 px-1.5 py-px text-[10px] font-medium text-brand-700 dark:bg-brand-500/20 dark:text-brand-300" title="Taken from your message">
      <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
      From you
    </span>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  fromUser?: boolean;
  error?: string;
  hint?: string;
  type?: 'text' | 'date';
  placeholder?: string;
  /** Also shows a "used / max" counter. */
  maxLength?: number;
  min?: string;
  disabled?: boolean;
  className?: string;
  uppercase?: boolean;
  /** Hides the "used / max" counter. */
  hideCounter?: boolean;
}

export function TextField({ label, value, onChange, type = 'text', placeholder, maxLength, min, disabled, uppercase, hideCounter, ...shell }: TextFieldProps) {
  const counted = !!maxLength && !hideCounter;
  return (
    <Field label={label} {...shell}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          <input
            id={id}
            type={type}
            value={value}
            placeholder={placeholder}
            maxLength={maxLength}
            min={min}
            disabled={disabled}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            aria-required={shell.required}
            autoComplete="off"
            onChange={(e) => onChange(uppercase ? e.target.value.toUpperCase() : e.target.value)}
            className={cn(inputClass, counted && 'pr-16')}
          />
          {counted && (
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs tabular-nums text-zinc-400" aria-hidden="true">
              {value.length}/{maxLength}
            </span>
          )}
        </div>
      )}
    </Field>
  );
}

interface NumberFieldProps {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  required?: boolean;
  fromUser?: boolean;
  error?: string;
  hint?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  step?: number;
}

export function NumberField({ label, value, onChange, disabled, step, placeholder, ...shell }: NumberFieldProps) {
  return (
    <Field label={label} {...shell}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={0}
          step={step ?? 'any'}
          value={value ?? ''}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          aria-required={shell.required}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
          className={inputClass}
        />
      )}
    </Field>
  );
}

interface SelectFieldProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  required?: boolean;
  fromUser?: boolean;
  error?: string;
  hint?: string;
  disabled?: boolean;
  className?: string;
}

export function SelectField<T extends string>({ label, value, options, onChange, disabled, ...shell }: SelectFieldProps<T>) {
  return (
    <Field label={label} {...shell}>
      {({ id, describedBy, invalid }) => (
        <select
          id={id}
          value={value}
          disabled={disabled}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          aria-required={shell.required}
          onChange={(e) => onChange(e.target.value as T)}
          className={inputClass}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

/** An on/off switch with a visible state label, e.g. "Configured" / "Not Required". */
export function Toggle({ label, checked, onChange, disabled, onText, offText }: { label: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean; onText?: string; offText?: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      {(onText || offText) && <span className={cn('text-xs', checked ? 'text-emerald-700 dark:text-emerald-300' : 'text-zinc-500 dark:text-zinc-400')}>{checked ? onText : offText}</span>}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60',
          checked ? 'bg-brand-600 dark:bg-brand-500' : 'bg-zinc-300 dark:bg-zinc-600',
        )}
      >
        <span className={cn('inline-block h-5 w-5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none', checked ? 'translate-x-5.5' : 'translate-x-0.5')} />
      </button>
    </span>
  );
}

/** A small set of mutually exclusive choices shown side by side. */
export function Segmented<T extends string>({ label, value, options, onChange, disabled }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (value: T) => void; disabled?: boolean }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-700">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm transition-colors disabled:opacity-60',
            value === o.value ? 'bg-brand-600 text-white dark:bg-brand-500' : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

interface ChipChecklistProps {
  label: string;
  items: { value: string; label: string }[];
  value: string[];
  onChange: (value: string[]) => void;
  required?: boolean;
  error?: string;
  disabled?: boolean;
}

/** Checkbox chips with a select-all switch, e.g. the transaction types a product allows. */
export function ChipChecklist({ label, items, value, onChange, required, error, disabled }: ChipChecklistProps) {
  const errorId = useId();
  const all = items.every((i) => value.includes(i.value));
  return (
    <fieldset aria-describedby={error ? errorId : undefined}>
      <div className="mb-1.5 flex items-center gap-2">
        <legend className="flex-1 text-xs font-medium text-zinc-700 dark:text-zinc-300">
          {label}
          {required && (
            <span className="ml-1 text-red-600 dark:text-red-400" aria-hidden="true">
              *
            </span>
          )}
        </legend>
        <RowButton onClick={() => onChange(all ? [] : items.map((i) => i.value))} disabled={disabled}>
          {all ? 'Clear all' : 'Select all'}
        </RowButton>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => {
          const checked = value.includes(item.value);
          return (
            <label
              key={item.value}
              className={cn(
                'flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors',
                checked ? 'border-brand-300 bg-brand-50 text-brand-800 dark:border-brand-400/50 dark:bg-brand-500/15 dark:text-brand-200' : 'border-zinc-200 dark:border-zinc-700',
                disabled && 'cursor-not-allowed opacity-60',
              )}
            >
              <input
                type="checkbox"
                className="accent-brand-600"
                checked={checked}
                disabled={disabled}
                onChange={() => onChange(checked ? value.filter((v) => v !== item.value) : items.map((i) => i.value).filter((v) => v === item.value || value.includes(v)))}
              />
              {item.label}
            </label>
          );
        })}
      </div>
      {error && (
        <p id={errorId} className="mt-1 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </fieldset>
  );
}

interface ChipPickerProps {
  label: string;
  placeholder: string;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  invalid?: boolean;
}

/** Pick items one at a time from a dropdown; picked items show as removable chips. */
export function ChipPicker({ label, placeholder, options, value, onChange, disabled, invalid }: ChipPickerProps) {
  const name = (v: string) => options.find((o) => o.value === v)?.label ?? v;
  const left = options.filter((o) => !value.includes(o.value));
  return (
    <div>
      <select
        aria-label={label}
        value=""
        disabled={disabled || !left.length}
        aria-invalid={invalid}
        onChange={(e) => e.target.value && onChange([...value, e.target.value])}
        className={inputClass}
      >
        <option value="">{left.length ? placeholder : 'Everything is selected'}</option>
        {left.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {value.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={`${label}: selected`}>
          {value.map((v) => (
            <li key={v} className="inline-flex items-center gap-1 rounded-full bg-zinc-100 py-0.5 pl-2.5 pr-1 text-xs dark:bg-zinc-800">
              {name(v)}
              <button type="button" aria-label={`Remove ${name(v)}`} disabled={disabled} onClick={() => onChange(value.filter((x) => x !== v))} className="rounded-full p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700">
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** A bordered block with a title row (icon, title, description, controls on the right). */
export function Panel({ icon, title, description, actions, children }: { icon?: ReactNode; title: string; description?: string; actions?: ReactNode; children?: ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-700" aria-label={title}>
      <div className={cn('flex flex-wrap items-center gap-3 px-3 py-3', !!children && 'border-b border-zinc-200 dark:border-zinc-700')}>
        {icon && (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300" aria-hidden="true">
            {icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h5 className="text-sm font-medium">{title}</h5>
          {description && <p className="text-xs text-zinc-500 dark:text-zinc-400">{description}</p>}
        </div>
        {actions}
      </div>
      {children && <div className="space-y-3 p-3">{children}</div>}
    </section>
  );
}

export function InfoNote({ tone = 'neutral', children }: { tone?: 'neutral' | 'success' | 'warning'; children: ReactNode }) {
  return (
    <div
      className={cn(
        'flex gap-2 rounded-lg px-3 py-2 text-xs',
        tone === 'success' && 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200',
        tone === 'warning' && 'bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200',
        tone === 'neutral' && 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
      )}
    >
      <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function StepHeading({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-zinc-200 pb-1.5 dark:border-zinc-700">
      <h4 className="text-sm font-semibold">{title}</h4>
      {aside && <span className="text-xs text-zinc-500 dark:text-zinc-400">{aside}</span>}
    </div>
  );
}

interface SectionProps {
  title: string;
  summary?: string;
  open: boolean;
  onToggle: () => void;
  errorCount?: number;
  /** All mandatory fields in the section are filled in. */
  complete?: boolean;
  children: ReactNode;
}

/** A collapsible part of the product form. Collapsed, it shows a one-line summary of its values. */
export function Section({ title, summary, open, onToggle, errorCount = 0, complete, children }: SectionProps) {
  const contentId = useId();
  return (
    <section className="border-t border-zinc-200 first:border-t-0 dark:border-zinc-700/70">
      <h4>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={onToggle}
          className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
        >
          <span className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1.5 align-middle">
              {title}
              {complete && (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" data-testid="section-complete" />
                  <span className="sr-only">(complete)</span>
                </>
              )}
            </span>
            {summary && !open && <span className="ml-2 truncate text-xs font-normal text-zinc-500 dark:text-zinc-400">{summary}</span>}
          </span>
          {errorCount > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-500/20 dark:text-red-300">
              {errorCount} to fix
            </span>
          )}
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-zinc-400 transition-transform', open && 'rotate-180')} aria-hidden="true" />
        </button>
      </h4>
      <div id={contentId} hidden={!open} className="px-4 pb-4">
        {children}
      </div>
    </section>
  );
}

export function RowButton({ onClick, disabled, children, label }: { onClick: () => void; disabled?: boolean; children: ReactNode; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50 dark:text-brand-300 dark:hover:bg-zinc-800"
    >
      {children}
    </button>
  );
}

export const AddIcon = () => <Plus className="h-3.5 w-3.5" aria-hidden="true" />;
export const RemoveIcon = () => <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />;

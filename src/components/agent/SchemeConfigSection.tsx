import { Minus, Plus, X } from 'lucide-react';
import { SCHEMES } from '../../services/productCatalog';
import type { SchemeConfig, SchemeRangeRow } from '../../types/product';
import { cn } from '../../utils/cn';
import { binsForScheme, emptyScheme, rangesForBin, schemeName, templatesFor, type ProductErrors } from '../../utils/productDraft';
import { FieldAssist } from './FieldAssist';
import { AddIcon, Field, inputClass, RowButton } from './productFields';

interface SchemeConfigSectionProps {
  schemes: SchemeConfig[];
  onChange: (schemes: SchemeConfig[]) => void;
  errors: ProductErrors;
  disabled: boolean;
}

const toId = (v: string) => (v === '' ? null : Number(v));

/** Scheme, card templates and BIN / BIN range rows. Nothing here is pre-selected: the user picks every value. */
export function SchemeConfigSection({ schemes, onChange, errors, disabled }: SchemeConfigSectionProps) {
  const update = (i: number, next: SchemeConfig) => onChange(schemes.map((s, j) => (j === i ? next : s)));

  return (
    <div className="space-y-3" data-testid="scheme-config">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">Choose these yourself. The assistant doesn&apos;t pre-select schemes, BINs, card ranges or card templates.</p>
      {schemes.map((scheme, i) => (
        <SchemeBlock key={i} index={i} scheme={scheme} onChange={(next) => update(i, next)} onRemove={schemes.length > 1 ? () => onChange(schemes.filter((_, j) => j !== i)) : undefined} errors={errors} disabled={disabled} />
      ))}
      {errors.schemes && <p className="text-xs text-red-600 dark:text-red-400">{errors.schemes}</p>}
      <RowButton onClick={() => onChange([...schemes, emptyScheme()])} disabled={disabled}>
        <AddIcon />
        Add another scheme
      </RowButton>
    </div>
  );
}

interface SchemeBlockProps {
  index: number;
  scheme: SchemeConfig;
  onChange: (next: SchemeConfig) => void;
  onRemove?: () => void;
  errors: ProductErrors;
  disabled: boolean;
}

function SchemeBlock({ index, scheme, onChange, onRemove, errors, disabled }: SchemeBlockProps) {
  const err = (name: string) => errors[`schemes.${index}.${name}`];
  const named = templatesFor(scheme.schemeId, 'NAMED');
  const anonymous = templatesFor(scheme.schemeId, 'ANONYMOUS');
  const bins = binsForScheme(scheme.schemeId);
  const noScheme = scheme.schemeId === null;
  const templateError = err('templates');
  const templateNoteId = `scheme-${index}-templates-note`;

  const setRow = (j: number, row: SchemeRangeRow) => onChange({ ...scheme, ranges: scheme.ranges.map((r, k) => (k === j ? row : r)) });

  return (
    <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700" role="group" aria-label={`Scheme ${index + 1}`}>
      <div className="mb-2 flex items-center justify-between">
        <h5 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Scheme {index + 1}
          {scheme.schemeId !== null && <span className="ml-1 normal-case tracking-normal text-zinc-700 dark:text-zinc-200">· {schemeName(scheme.schemeId)}</span>}
        </h5>
        {onRemove && (
          <RowButton label={`Remove scheme ${index + 1}`} onClick={onRemove} disabled={disabled}>
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            Remove
          </RowButton>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Scheme" required error={err('schemeId')} assistKey={`schemes.${index}.schemeId`}>
          {({ id, describedBy, invalid }) => (
            <select
              id={id}
              value={scheme.schemeId ?? ''}
              disabled={disabled}
              aria-invalid={invalid}
              aria-describedby={describedBy}
              aria-required
              // A new scheme has its own templates and BINs, so earlier picks no longer apply.
              onChange={(e) => onChange({ schemeId: toId(e.target.value), namedTemplateId: null, anonymousTemplateId: null, ranges: scheme.ranges.map(() => ({ binId: null, cardRangeId: null })) })}
              className={inputClass}
            >
              <option value="">Select scheme</option>
              {SCHEMES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Named card template" required assistKey={`schemes.${index}.namedTemplateId`}>
          {({ id, describedBy }) => (
            <select
              id={id}
              value={scheme.namedTemplateId ?? ''}
              disabled={disabled || noScheme}
              aria-invalid={!!templateError}
              aria-describedby={[describedBy, templateNoteId].filter(Boolean).join(' ')}
              onChange={(e) => onChange({ ...scheme, namedTemplateId: toId(e.target.value) })}
              className={inputClass}
            >
              <option value="">{noScheme ? 'Select a scheme first' : 'Select personalization template'}</option>
              {named.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Anonymous card template" required assistKey={`schemes.${index}.anonymousTemplateId`}>
          {({ id, describedBy }) => (
            <select
              id={id}
              value={scheme.anonymousTemplateId ?? ''}
              disabled={disabled || noScheme}
              aria-invalid={!!templateError}
              aria-describedby={[describedBy, templateNoteId].filter(Boolean).join(' ')}
              onChange={(e) => onChange({ ...scheme, anonymousTemplateId: toId(e.target.value) })}
              className={inputClass}
            >
              <option value="">{noScheme ? 'Select a scheme first' : 'Select anonymous template'}</option>
              {anonymous.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
      <p id={templateNoteId} className={cn('mt-1 text-xs', templateError ? 'text-red-600 dark:text-red-400' : 'text-zinc-500 dark:text-zinc-400')}>
        Select at least one Named Card or Anonymous Card template.
      </p>

      <div className="mt-3 rounded-lg border border-zinc-200 dark:border-zinc-700">
        <div className="hidden grid-cols-[1fr_1.6fr_auto] rounded-t-lg bg-zinc-50 text-xs font-medium text-zinc-600 sm:grid dark:bg-zinc-800/60 dark:text-zinc-300" aria-hidden="true">
          <span className="px-3 py-2">
            BIN <span className="text-red-600 dark:text-red-400">*</span>
          </span>
          <span className="border-l border-zinc-200 px-3 py-2 dark:border-zinc-700">
            BIN range <span className="text-red-600 dark:text-red-400">*</span>
          </span>
          <span className="w-24 border-l border-zinc-200 px-3 py-2 text-center dark:border-zinc-700">Actions</span>
        </div>
        {scheme.ranges.map((row, j) => {
          const binError = err(`ranges.${j}.binId`);
          const rangeError = err(`ranges.${j}.cardRangeId`);
          return (
            <div key={j} className="grid grid-cols-1 gap-2 border-t border-zinc-200 p-2 first:border-t-0 sm:grid-cols-[1fr_1.6fr_auto] sm:gap-0 sm:p-0 dark:border-zinc-700" role="group" aria-label={`BIN row ${j + 1}`}>
              <div className="group/field sm:p-2" data-assist-field="">
                <label className="mb-1 block text-xs font-medium text-zinc-700 sm:sr-only dark:text-zinc-300" htmlFor={`scheme-${index}-bin-${j}`}>
                  BIN
                </label>
                <div className="flex items-center gap-1.5">
                  <select
                    id={`scheme-${index}-bin-${j}`}
                    value={row.binId ?? ''}
                    disabled={disabled || noScheme}
                    aria-invalid={!!binError}
                    aria-required
                    onChange={(e) => setRow(j, { binId: toId(e.target.value), cardRangeId: null })}
                    className={inputClass}
                  >
                    <option value="">{noScheme ? 'Select a scheme first' : 'Choose BIN'}</option>
                    {bins.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  <FieldAssist fieldKey={`schemes.${index}.ranges.${j}.binId`} label="BIN" className="relative shrink-0" />
                </div>
                {binError && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{binError}</p>}
              </div>
              <div className="group/field sm:border-l sm:border-zinc-200 sm:p-2 dark:sm:border-zinc-700" data-assist-field="">
                <label className="mb-1 block text-xs font-medium text-zinc-700 sm:sr-only dark:text-zinc-300" htmlFor={`scheme-${index}-range-${j}`}>
                  BIN range
                </label>
                <div className="flex items-center gap-1.5">
                  <select
                    id={`scheme-${index}-range-${j}`}
                    value={row.cardRangeId ?? ''}
                    disabled={disabled || row.binId === null}
                    aria-invalid={!!rangeError}
                    aria-required
                    onChange={(e) => setRow(j, { ...row, cardRangeId: toId(e.target.value) })}
                    className={inputClass}
                  >
                    <option value="">{row.binId === null ? 'Choose a BIN first' : 'Choose BIN range'}</option>
                    {rangesForBin(row.binId).map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  <FieldAssist fieldKey={`schemes.${index}.ranges.${j}.cardRangeId`} label="BIN range" className="relative shrink-0" />
                </div>
                {rangeError && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{rangeError}</p>}
              </div>
              <div className="flex items-start justify-end gap-1 sm:w-24 sm:justify-center sm:border-l sm:border-zinc-200 sm:p-2 sm:pt-3.5 dark:sm:border-zinc-700">
                <IconSquare
                  label={`Add a BIN row after row ${j + 1}`}
                  disabled={disabled}
                  onClick={() => onChange({ ...scheme, ranges: [...scheme.ranges.slice(0, j + 1), { binId: null, cardRangeId: null }, ...scheme.ranges.slice(j + 1)] })}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                </IconSquare>
                <IconSquare label={`Remove BIN row ${j + 1}`} disabled={disabled || scheme.ranges.length === 1} onClick={() => onChange({ ...scheme, ranges: scheme.ranges.filter((_, k) => k !== j) })}>
                  <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                </IconSquare>
              </div>
            </div>
          );
        })}
      </div>
      {err('ranges') && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{err('ranges')}</p>}
    </div>
  );
}

function IconSquare({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn('flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800')}
    >
      {children}
    </button>
  );
}

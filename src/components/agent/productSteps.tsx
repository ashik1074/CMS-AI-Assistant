import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { BadgePercent, Lock, RefreshCw } from 'lucide-react';
import { COUNTRIES, CURRENCIES, MCCS, PIN_POLICIES, QUOTA_POLICIES, REISSUE_POLICIES, SERVICE_FEE_TYPES, TXN_TYPES, type PolicyItem } from '../../services/productCatalog';
import type { AccessControl, ControlMode, FeeRule, FeeTier, ProductField, ProductForm, TxnLimit } from '../../types/product';
import {
  binName,
  countryName,
  describeControl,
  emptyFee,
  emptyLimit,
  emptyTier,
  feeTypeName,
  MARKET_SEGMENTS,
  MAX_DEFAULT_NAME,
  MAX_DESCRIPTION,
  mccName,
  policyName,
  PRODUCT_STEPS,
  PRODUCT_TYPES,
  rangeName,
  schemeName,
  templateName,
  titleCase,
  txnTypeName,
  VALIDITY_YEARS,
  type ProductErrors,
  type ProductStep,
} from '../../utils/productDraft';
import { AddIcon, ChipChecklist, ChipPicker, Field, InfoNote, inputClass, NumberField, Panel, RemoveIcon, RowButton, Segmented, SelectField, StepHeading, TextField, Toggle } from './productFields';

export interface StepProps {
  form: ProductForm;
  setForm: Dispatch<SetStateAction<ProductForm>>;
  errors: ProductErrors;
  fromUser: Set<ProductField>;
  disabled: boolean;
}

const set =
  (setForm: StepProps['setForm']) =>
  <K extends ProductField>(key: K, value: ProductForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

const enumOptions = <T extends string>(values: readonly T[]) => values.map((v) => ({ value: v, label: titleCase(v) }));
const currencyOptions = (current: string) => [...(current ? [] : [{ value: '', label: 'Select Currency' }]), ...[...new Set([...CURRENCIES, ...(current ? [current] : [])])].map((c) => ({ value: c, label: c }))];
const idOptions = (items: PolicyItem[], placeholder: string) => [{ value: '', label: placeholder }, ...items.map((i) => ({ value: String(i.id), label: i.name }))];
const toId = (v: string) => (v === '' ? null : Number(v));
const TXN_OPTIONS = Object.entries(TXN_TYPES).map(([value, label]) => ({ value, label }));

/* ---------- Basics ---------- */

export function BasicsStep({ form, setForm, errors, fromUser, disabled }: StepProps) {
  const update = set(setForm);
  const common = (key: ProductField) => ({ fromUser: fromUser.has(key), error: errors[key], disabled, assistKey: key });
  const validity = [...new Set([...VALIDITY_YEARS, ...(form.validityYears ? [form.validityYears] : [])])].sort((a, b) => a - b);
  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <StepHeading title="Product Information" />
        {/* Wide containers (the Product Setup page) fit four fields in a row; the chat card keeps two. */}
        <div className="@container">
          <div className="grid gap-3 sm:grid-cols-2 @3xl:grid-cols-4">
            <TextField label="Product Name" required value={form.productName} onChange={(v) => update('productName', v)} placeholder="Enter Product Name" maxLength={100} hideCounter className="@3xl:col-span-2" {...common('productName')} />
            <TextField label="Description" value={form.shortDesc} onChange={(v) => update('shortDesc', v)} placeholder="Enter Description" maxLength={MAX_DESCRIPTION} className="@3xl:col-span-2" {...common('shortDesc')} />
            <SelectField label="Market Segment" required value={form.marketSegment} options={[{ value: '', label: 'Select Market Segment' }, ...enumOptions(MARKET_SEGMENTS)]} onChange={(v) => update('marketSegment', v)} {...common('marketSegment')} />
            <SelectField label="Product Type" required value={form.productType} options={[{ value: '', label: 'Select Product Type' }, ...enumOptions(PRODUCT_TYPES)]} onChange={(v) => update('productType', v)} {...common('productType')} />
            <SelectField
              label="Account Currency"
              required
              value={form.currency}
              options={currencyOptions(form.currency)}
              // Domestic settlement follows the account currency until the user chooses one.
              onChange={(v) => setForm((f) => ({ ...f, currency: v, domesticSettlementCurrency: f.domesticSettlementCurrency || v }))}
              {...common('currency')}
            />
            <SelectField
              label="Card Validity Duration (in years)"
              required
              value={form.validityYears === null ? '' : String(form.validityYears)}
              options={[{ value: '', label: 'Select Card Validity Duration' }, ...validity.map((y) => ({ value: String(y), label: String(y) }))]}
              onChange={(v) => update('validityYears', v ? Number(v) : null)}
              {...common('validityYears')}
            />
            <TextField label="Default Cardholder Name (Anonymous Card)" value={form.defaultName} onChange={(v) => update('defaultName', v)} placeholder="Enter Default Name" className="@3xl:col-span-2" maxLength={MAX_DEFAULT_NAME} uppercase {...common('defaultName')} />
            <TextField label="Live From" required type="date" value={form.effectiveDate} onChange={(v) => update('effectiveDate', v)} className="@3xl:col-span-2" {...common('effectiveDate')} />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <StepHeading title="Transaction Scope" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Panel title="Domestic transaction" actions={<Toggle label="Domestic transaction" checked={form.allowDomesticTxn === 'Y'} onChange={(on) => update('allowDomesticTxn', on ? 'Y' : 'N')} disabled={disabled} />}>
            {form.allowDomesticTxn === 'Y' ? (
              <SelectField label="Settlement currency" required value={form.domesticSettlementCurrency} options={currencyOptions(form.domesticSettlementCurrency)} onChange={(v) => update('domesticSettlementCurrency', v)} {...common('domesticSettlementCurrency')} />
            ) : (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Domestic transactions are turned off.</p>
            )}
          </Panel>
          <Panel title="International transaction" actions={<Toggle label="International transaction" checked={form.allowIntlTxn === 'Y'} onChange={(on) => update('allowIntlTxn', on ? 'Y' : 'N')} disabled={disabled} />}>
            {form.allowIntlTxn === 'Y' ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <SelectField label="Settlement currency" required value={form.intlSettlementCurrency} options={currencyOptions(form.intlSettlementCurrency)} onChange={(v) => update('intlSettlementCurrency', v)} {...common('intlSettlementCurrency')} />
                <SelectField
                  label="International usage"
                  required
                  value={form.intlUsage}
                  options={[
                    { value: 'ENABLED_BY_DEFAULT', label: 'Enabled by Default' },
                    { value: 'DISABLED_BY_DEFAULT', label: 'Disabled by Default' },
                  ]}
                  onChange={(v) => update('intlUsage', v)}
                  {...common('intlUsage')}
                />
              </div>
            ) : (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">International transactions are turned off.</p>
            )}
          </Panel>
        </div>
        {errors.allowDomesticTxn && <p className="text-xs text-red-600 dark:text-red-400">{errors.allowDomesticTxn}</p>}
      </section>
    </div>
  );
}

/* ---------- Policies ---------- */

function PolicySelect({ label, items, value, onChange, error, disabled, assistKey }: { label: string; items: PolicyItem[]; value: number | null; onChange: (id: number | null) => void; error?: string; disabled: boolean; assistKey: string }) {
  const chosen = items.find((i) => i.id === value);
  return (
    <>
      <SelectField label={label} required value={value === null ? '' : String(value)} options={idOptions(items, `Select ${label.toLowerCase()}`)} onChange={(v) => onChange(toId(v))} error={error} disabled={disabled} assistKey={assistKey} />
      {chosen && (
        <InfoNote>
          {chosen.name}: {chosen.description}
        </InfoNote>
      )}
    </>
  );
}

export function PoliciesStep({ form, setForm, errors, disabled }: StepProps) {
  const pinOn = form.pinPolicyRequired === 'Y';
  const quotaOn = form.quotaPolicyRequired === 'Y';
  return (
    <div className="space-y-3">
      <Panel
        icon={<Lock className="h-4 w-4" />}
        title="PIN policy"
        description="Define whether this product requires a PIN."
        actions={<Toggle label="PIN policy" checked={pinOn} onText="Configured" offText="Not Required" onChange={(on) => setForm((f) => ({ ...f, pinPolicyRequired: on ? 'Y' : 'N', pinPolicyId: on ? (f.pinPolicyId ?? PIN_POLICIES[0].id) : f.pinPolicyId }))} disabled={disabled} />}
      >
        {pinOn && <PolicySelect label="PIN policy" items={PIN_POLICIES} value={form.pinPolicyId} onChange={(id) => setForm((f) => ({ ...f, pinPolicyId: id }))} error={errors.pinPolicyId} disabled={disabled} assistKey="pinPolicyId" />}
      </Panel>
      <Panel
        icon={<BadgePercent className="h-4 w-4" />}
        title="Quota policy"
        description="Define whether endorsement / quota is required for this product."
        actions={
          <Toggle
            label="Quota policy"
            checked={quotaOn}
            onText="Configured"
            offText="Not Required"
            onChange={(on) => setForm((f) => ({ ...f, quotaPolicyRequired: on ? 'Y' : 'N', quotaPolicyId: on ? (f.quotaPolicyId ?? QUOTA_POLICIES[0].id) : f.quotaPolicyId }))}
            disabled={disabled}
          />
        }
      >
        {quotaOn && <PolicySelect label="Quota policy" items={QUOTA_POLICIES} value={form.quotaPolicyId} onChange={(id) => setForm((f) => ({ ...f, quotaPolicyId: id }))} error={errors.quotaPolicyId} disabled={disabled} assistKey="quotaPolicyId" />}
      </Panel>
      <Panel
        icon={<RefreshCw className="h-4 w-4" />}
        title="Renewal policy"
        description="Define how cards under this product are renewed."
        actions={
          <Segmented
            label="Renewal"
            value={form.renewalType}
            options={[
              { value: 'RENEWABLE', label: 'Renewable' },
              { value: 'ONE_TIME', label: 'One-time' },
            ]}
            onChange={(v) => setForm((f) => ({ ...f, renewalType: v, reissuePolicyId: v === 'RENEWABLE' ? (f.reissuePolicyId ?? REISSUE_POLICIES[0].id) : f.reissuePolicyId }))}
            disabled={disabled}
          />
        }
      >
        {form.renewalType === 'RENEWABLE' ? (
          <PolicySelect label="Renewal policy" items={REISSUE_POLICIES} value={form.reissuePolicyId} onChange={(id) => setForm((f) => ({ ...f, reissuePolicyId: id }))} error={errors.reissuePolicyId} disabled={disabled} assistKey="reissuePolicyId" />
        ) : (
          <InfoNote>Cards under this product are not renewable.</InfoNote>
        )}
      </Panel>
    </div>
  );
}

/* ---------- Permissions ---------- */

const CONTROL_OPTIONS: { value: ControlMode; label: string }[] = [
  { value: 'ALLOW_ALL_EXCEPT', label: 'Allow All Except' },
  { value: 'DISALLOW_ALL_EXCEPT', label: 'Disallow All Except' },
];

function ControlBlock({ title, noun, plural, options, value, onChange, error, disabled }: { title: string; noun: string; plural: string; options: { value: string; label: string }[]; value: AccessControl; onChange: (c: AccessControl) => void; error?: string; disabled: boolean }) {
  const count = value.exceptions.length;
  const allow = value.mode === 'ALLOW_ALL_EXCEPT';
  return (
    <section className="space-y-2" aria-label={title}>
      <StepHeading title={title} aside={`${count} exception${count === 1 ? '' : 's'}`} />
      <div className="grid gap-2 sm:grid-cols-[auto_1fr] sm:items-start">
        <Segmented label={`${title} mode`} value={value.mode} options={CONTROL_OPTIONS} onChange={(mode) => onChange({ ...value, mode })} disabled={disabled} />
        <ChipPicker label={`${title} exceptions`} placeholder={`Choose ${plural}`} options={options} value={value.exceptions} onChange={(exceptions) => onChange({ ...value, exceptions })} disabled={disabled} invalid={!!error} />
      </div>
      {error ? (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : (
        <InfoNote tone={allow && !count ? 'success' : 'neutral'}>
          {allow ? (count ? `All ${plural} are allowed except the ${count} selected.` : `No exceptions configured. All ${plural} are allowed.`) : `Only the ${count} selected ${count === 1 ? noun : plural} ${count === 1 ? 'is' : 'are'} allowed.`}
        </InfoNote>
      )}
    </section>
  );
}

export function PermissionsStep({ form, setForm, errors, disabled }: StepProps) {
  const update = set(setForm);
  const summary = (types: string[]) => (types.length === TXN_OPTIONS.length ? 'All Selected' : types.length ? types.map(txnTypeName).join(', ') : 'None');
  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <StepHeading title="Transaction access control" />
        {form.allowDomesticTxn === 'Y' ? (
          <ChipChecklist label="Domestic transactions" required items={TXN_OPTIONS} value={form.domesticTxnTypes} onChange={(v) => update('domesticTxnTypes', v)} error={errors.domesticTxnTypes} disabled={disabled} />
        ) : (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Domestic transactions are turned off in Basics.</p>
        )}
        {form.allowIntlTxn === 'Y' ? (
          <ChipChecklist label="International transactions" required items={TXN_OPTIONS} value={form.intlTxnTypes} onChange={(v) => update('intlTxnTypes', v)} error={errors.intlTxnTypes} disabled={disabled} />
        ) : (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">International transactions are turned off in Basics.</p>
        )}
        <InfoNote>
          <p className="italic">Transactions are allowed only for the selected types. All others remain blocked by default.</p>
          {form.allowDomesticTxn === 'Y' && <p>Domestic: {summary(form.domesticTxnTypes)}</p>}
          {form.allowIntlTxn === 'Y' && <p>International: {summary(form.intlTxnTypes)}</p>}
        </InfoNote>
      </section>
      <ControlBlock
        title="Country controls"
        noun="country"
        plural="countries"
        options={Object.entries(COUNTRIES).map(([value, label]) => ({ value, label }))}
        value={form.countryControl}
        onChange={(c) => update('countryControl', c)}
        error={errors.countryControl}
        disabled={disabled}
      />
      <ControlBlock title="Currency controls" noun="currency" plural="currencies" options={CURRENCIES.map((c) => ({ value: c, label: c }))} value={form.currencyControl} onChange={(c) => update('currencyControl', c)} error={errors.currencyControl} disabled={disabled} />
      <ControlBlock title="MCC controls" noun="MCC" plural="MCCs" options={Object.keys(MCCS).map((code) => ({ value: code, label: mccName(code) }))} value={form.mccControl} onChange={(c) => update('mccControl', c)} error={errors.mccControl} disabled={disabled} />
    </div>
  );
}

/* ---------- Limits ---------- */

const LIMIT_COLUMNS: { key: Exclude<keyof TxnLimit, 'txnType'>; label: string; count?: boolean }[] = [
  { key: 'perTxMin', label: 'Per transaction · min amount' },
  { key: 'perTxMax', label: 'Per transaction · max amount' },
  { key: 'dailyCount', label: 'Daily · count', count: true },
  { key: 'dailyAmount', label: 'Daily · amount' },
  { key: 'monthlyCount', label: 'Monthly · count', count: true },
  { key: 'monthlyAmount', label: 'Monthly · amount' },
];

function LimitsTable({ title, field, currency, rows, onChange, errors, disabled }: { title: string; field: 'domesticLimits' | 'intlLimits'; currency: string; rows: TxnLimit[]; onChange: (rows: TxnLimit[]) => void; errors: ProductErrors; disabled: boolean }) {
  const update = (i: number, patch: Partial<TxnLimit>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <section className="space-y-2" aria-label={title}>
      <StepHeading title={`${title} (${currency})`} aside={`${rows.length} transaction type${rows.length === 1 ? '' : 's'}`} />
      {!rows.length && <p className="rounded-lg border border-dashed border-zinc-300 px-3 py-4 text-center text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">No limits found.</p>}
      {rows.map((row, i) => (
        <div key={i} className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/60" role="group" aria-label={`${title} ${i + 1}`}>
          <div className="mb-2 flex items-end gap-2">
            <Field label="Transaction type" required error={errors[`${field}.${i}.txnType`]} className="flex-1" assistKey={`${field}.${i}.txnType`}>
              {({ id, describedBy, invalid }) => (
                <select id={id} value={row.txnType} disabled={disabled} aria-invalid={invalid} aria-describedby={describedBy} onChange={(e) => update(i, { txnType: e.target.value })} className={inputClass}>
                  <option value="">Select transaction type</option>
                  {TXN_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <RowButton label={`Remove limit ${i + 1}`} onClick={() => onChange(rows.filter((_, j) => j !== i))} disabled={disabled}>
              <RemoveIcon />
            </RowButton>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {LIMIT_COLUMNS.map((c) => (
              <NumberField key={c.key} label={c.label} value={row[c.key]} step={c.count ? 1 : undefined} placeholder="No limit" onChange={(v) => update(i, { [c.key]: v })} error={errors[`${field}.${i}.${c.key}`]} disabled={disabled} assistKey={`${field}.${i}.${c.key}`} />
            ))}
          </div>
        </div>
      ))}
      <RowButton onClick={() => onChange([...rows, emptyLimit()])} disabled={disabled}>
        <AddIcon />
        Add {title.toLowerCase().replace(' limits', '')} limit
      </RowButton>
    </section>
  );
}

export function LimitsStep({ form, setForm, errors, disabled }: StepProps) {
  const update = set(setForm);
  return (
    <div className="space-y-5">
      {form.allowDomesticTxn === 'Y' ? (
        <LimitsTable title="Domestic transaction limits" field="domesticLimits" currency={form.domesticSettlementCurrency} rows={form.domesticLimits} onChange={(v) => update('domesticLimits', v)} errors={errors} disabled={disabled} />
      ) : (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Domestic transactions are turned off, so no domestic limits apply.</p>
      )}
      {form.allowIntlTxn === 'Y' ? (
        <LimitsTable title="International transaction limits" field="intlLimits" currency={form.intlSettlementCurrency} rows={form.intlLimits} onChange={(v) => update('intlLimits', v)} errors={errors} disabled={disabled} />
      ) : (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">International transactions are turned off, so no international limits apply.</p>
      )}
      <InfoNote tone="warning">
        Transaction types with <strong>defined limits</strong> are restricted by this product configuration. Unconfigured or unlisted transaction types are treated as <strong>No Limit</strong>. Leave a value empty for no limit.
      </InfoNote>
    </div>
  );
}

/* ---------- Fees ---------- */

type FeeField = 'serviceFees' | 'domesticFees' | 'intlFees';

function FeeTierRow({
  tier,
  index,
  count,
  currency,
  prefix,
  onChange,
  onAdd,
  onRemove,
  errors,
  disabled,
}: {
  tier: FeeTier;
  index: number;
  count: number;
  currency: string;
  prefix: string;
  onChange: (t: FeeTier) => void;
  onAdd: () => void;
  onRemove: () => void;
  errors: ProductErrors;
  disabled: boolean;
}) {
  const err = (k: keyof FeeTier) => errors[`${prefix}.tiers.${index}.${k}`];
  const num = (key: Exclude<keyof FeeTier, 'vatIncluded'>, label: string, placeholder?: string) => (
    <NumberField label={label} value={tier[key]} placeholder={placeholder} onChange={(v) => onChange({ ...tier, [key]: v })} error={err(key)} disabled={disabled} assistKey={`${prefix}.tiers.${index}.${key}`} />
  );
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900" role="group" aria-label={`Fee tier ${index + 1}`}>
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded bg-brand-50 text-xs font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">{index + 1}</span>
        <span className="flex-1 text-xs italic text-zinc-500 dark:text-zinc-400">Fee applies for transactions {tier.amountTo === null ? `from ${tier.amountFrom ?? 0} ${currency} and above` : `from ${tier.amountFrom ?? 0} to ${tier.amountTo} ${currency}`}.</span>
        <RowButton label={`Add a fee tier after tier ${index + 1}`} onClick={onAdd} disabled={disabled}>
          <AddIcon />
        </RowButton>
        <RowButton label={`Remove fee tier ${index + 1}`} onClick={onRemove} disabled={disabled || count === 1}>
          <RemoveIcon />
        </RowButton>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {num('amountFrom', `Amount from (${currency})`)}
        {num('amountTo', `Amount to (${currency})`, '∞')}
        {num('rate', 'Variable rate %')}
        {num('fixedFee', `Fixed fee (${currency})`, 'Enter fixed fee')}
        {num('minFee', `Min fee (${currency})`)}
        {num('maxFee', `Max fee (${currency})`, 'Max')}
        {num('vatRate', 'VAT rate %', 'VAT rate')}
        <label className="flex items-center gap-2 self-end pb-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">
          <input type="checkbox" className="accent-brand-600" checked={tier.vatIncluded} disabled={disabled} onChange={(e) => onChange({ ...tier, vatIncluded: e.target.checked })} />
          VAT included
        </label>
      </div>
    </div>
  );
}

function FeeCard({ field, fee, index, currency, onChange, onRemove, errors, disabled }: { field: FeeField; fee: FeeRule; index: number; currency: string; onChange: (f: FeeRule) => void; onRemove: () => void; errors: ProductErrors; disabled: boolean }) {
  const prefix = `${field}.${index}`;
  const service = field === 'serviceFees';
  const options = service ? Object.entries(SERVICE_FEE_TYPES).map(([value, label]) => ({ value, label })) : TXN_OPTIONS;
  const typeLabel = service ? 'Service type' : 'Transaction type';
  const setTiers = (tiers: FeeTier[]) => onChange({ ...fee, tiers });
  return (
    <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700" role="group" aria-label={`${fee.title || feeTypeName(field, fee.feeType) || 'New fee'}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h6 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Fee {index + 1}
          {fee.feeType && <span className="ml-1 normal-case tracking-normal text-zinc-700 dark:text-zinc-200">· {feeTypeName(field, fee.feeType)}</span>}
        </h6>
        <RowButton label={`Remove fee ${index + 1}`} onClick={onRemove} disabled={disabled}>
          <RemoveIcon />
          Remove
        </RowButton>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label={typeLabel}
          required
          value={fee.feeType}
          options={[{ value: '', label: `Select ${typeLabel.toLowerCase()}` }, ...options]}
          // Name the policy after the fee type until the user gives it their own title.
          onChange={(v) => onChange({ ...fee, feeType: v, title: !fee.title || fee.title === feeTypeName(field, fee.feeType) ? feeTypeName(field, v) : fee.title })}
          error={errors[`${prefix}.feeType`]}
          disabled={disabled}
          assistKey={`${prefix}.feeType`}
        />
        <TextField label="Policy title" required value={fee.title} onChange={(v) => onChange({ ...fee, title: v })} placeholder="Enter policy title" error={errors[`${prefix}.title`]} disabled={disabled} assistKey={`${prefix}.title`} />
        <TextField label="Effective date" required type="date" value={fee.effectiveDate} onChange={(v) => onChange({ ...fee, effectiveDate: v })} error={errors[`${prefix}.effectiveDate`]} disabled={disabled} assistKey={`${prefix}.effectiveDate`} />
        <TextField label="Expiry date" type="date" value={fee.expiryDate} min={fee.effectiveDate || undefined} onChange={(v) => onChange({ ...fee, expiryDate: v })} error={errors[`${prefix}.expiryDate`]} disabled={disabled} assistKey={`${prefix}.expiryDate`} />
      </div>
      <div className="mt-3 space-y-2 rounded-lg bg-zinc-50 p-2 dark:bg-zinc-800/60">
        <p className="px-1 text-xs font-medium text-zinc-700 dark:text-zinc-300">Fee tiers by usage</p>
        {fee.tiers.map((tier, j) => (
          <FeeTierRow
            key={j}
            tier={tier}
            index={j}
            count={fee.tiers.length}
            currency={currency}
            prefix={prefix}
            onChange={(t) => setTiers(fee.tiers.map((x, k) => (k === j ? t : x)))}
            // A new tier starts where the one before it ends.
            onAdd={() => setTiers([...fee.tiers.slice(0, j + 1), { ...emptyTier(), amountFrom: tier.amountTo }, ...fee.tiers.slice(j + 1)])}
            onRemove={() => setTiers(fee.tiers.filter((_, k) => k !== j))}
            errors={errors}
            disabled={disabled}
          />
        ))}
        {errors[`${prefix}.tiers`] && <p className="text-xs text-red-600 dark:text-red-400">{errors[`${prefix}.tiers`]}</p>}
        <RowButton onClick={() => setTiers([...fee.tiers, { ...emptyTier(), amountFrom: fee.tiers.at(-1)?.amountTo ?? 0 }])} disabled={disabled}>
          <AddIcon />
          Add another fee tier
        </RowButton>
      </div>
    </div>
  );
}

function FeeGroup({ field, title, description, form, setForm, errors, disabled, currency }: StepProps & { field: FeeField; title: string; description: string; currency: string }) {
  const fees = form[field];
  const update = (next: FeeRule[]) => setForm((f) => ({ ...f, [field]: next }));
  return (
    <section className="space-y-2" aria-label={title}>
      <StepHeading title={title} aside={`${fees.length} fee${fees.length === 1 ? '' : 's'}`} />
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{description}</p>
      {fees.map((fee, i) => (
        <FeeCard key={i} field={field} fee={fee} index={i} currency={currency} onChange={(next) => update(fees.map((x, j) => (j === i ? next : x)))} onRemove={() => update(fees.filter((_, j) => j !== i))} errors={errors} disabled={disabled} />
      ))}
      <button type="button" className="btn-secondary min-h-8 text-xs" onClick={() => update([...fees, emptyFee(form.effectiveDate)])} disabled={disabled}>
        <AddIcon />
        {fees.length ? 'Add another fee' : 'Add fee'}
      </button>
    </section>
  );
}

export function FeesStep(props: StepProps) {
  const { form } = props;
  return (
    <div className="space-y-5">
      <InfoNote tone="warning">
        Fees apply <strong>only</strong> to the transaction types added here. All others will have <strong>no fees</strong>.
      </InfoNote>
      <FeeGroup {...props} field="serviceFees" title="Service fees" description="Fees applied to service-related transactions." currency={form.currency} />
      {form.allowDomesticTxn === 'Y' && <FeeGroup {...props} field="domesticFees" title="Domestic transaction fees" description="Fees applied for transactions within the home country." currency={form.domesticSettlementCurrency} />}
      {form.allowIntlTxn === 'Y' && <FeeGroup {...props} field="intlFees" title="International transaction fees" description="Fees applied for cross-border or foreign transactions." currency={form.intlSettlementCurrency} />}
    </div>
  );
}

/* ---------- Review / details summary ---------- */

function Rows({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
      {rows.map(([k, v]) => (
        <div key={k} className="flex gap-2">
          <dt className="w-36 shrink-0 text-zinc-500 dark:text-zinc-400">{k}</dt>
          <dd className="min-w-0 break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

const limitText = (l: TxnLimit) => {
  const v = (n: number | null) => (n === null ? 'No limit' : String(n));
  return `${txnTypeName(l.txnType)}: per txn ${v(l.perTxMin)}–${v(l.perTxMax)} · daily ${v(l.dailyCount)} / ${v(l.dailyAmount)} · monthly ${v(l.monthlyCount)} / ${v(l.monthlyAmount)}`;
};

const feeText = (field: FeeField, f: FeeRule) => {
  const tier = f.tiers[0];
  const charge = tier ? [tier.fixedFee !== null && `fixed ${tier.fixedFee}`, tier.rate !== null && `${tier.rate}%`, tier.vatRate !== null && `VAT ${tier.vatRate}%`].filter(Boolean).join(', ') : '';
  return `${f.title || feeTypeName(field, f.feeType)}${charge ? ` (${charge}${f.tiers.length > 1 ? `, ${f.tiers.length} tiers` : ''})` : ''} · from ${f.effectiveDate || '—'}`;
};

/** Everything in a product, grouped by section (the product details page). */
export function ProductSummary({ form }: { form: ProductForm }) {
  const yes = (v: 'Y' | 'N', on: string, off: string) => (v === 'Y' ? on : off);
  const feeList = (field: FeeField) => (form[field].length ? form[field].map((f) => feeText(field, f)).join('; ') : 'None');
  const groups: [ProductStep, [string, ReactNode][]][] = [
    [
      'basics',
      [
        ['Product name', form.productName || '—'],
        ['Description', form.shortDesc || '—'],
        ['Type', [form.productType && titleCase(form.productType), titleCase(form.marketSegment)].filter(Boolean).join(' · ')],
        ['Account currency', form.currency],
        ['Card validity', form.validityYears ? `${form.validityYears} year${form.validityYears === 1 ? '' : 's'}` : '—'],
        ['Default cardholder name', form.defaultName || '—'],
        ['Live from', form.effectiveDate || '—'],
        ['Domestic', yes(form.allowDomesticTxn, `Allowed · settles in ${form.domesticSettlementCurrency}`, 'Not allowed')],
        ['International', yes(form.allowIntlTxn, `Allowed · settles in ${form.intlSettlementCurrency} · ${titleCase(form.intlUsage)}`, 'Not allowed')],
      ],
    ],
    [
      'policies',
      [
        ['PIN policy', yes(form.pinPolicyRequired, policyName(PIN_POLICIES, form.pinPolicyId) ?? '—', 'Not required')],
        ['Quota policy', yes(form.quotaPolicyRequired, policyName(QUOTA_POLICIES, form.quotaPolicyId) ?? '—', 'Not required')],
        ['Renewal', form.renewalType === 'RENEWABLE' ? `Renewable · ${policyName(REISSUE_POLICIES, form.reissuePolicyId) ?? '—'}` : 'One-time'],
      ],
    ],
    [
      'permissions',
      [
        ['Domestic types', form.allowDomesticTxn === 'Y' ? (form.domesticTxnTypes.length === TXN_OPTIONS.length ? 'All selected' : form.domesticTxnTypes.map(txnTypeName).join(', ') || 'None') : '—'],
        ['International types', form.allowIntlTxn === 'Y' ? (form.intlTxnTypes.length === TXN_OPTIONS.length ? 'All selected' : form.intlTxnTypes.map(txnTypeName).join(', ') || 'None') : '—'],
        ['Countries', describeControl(form.countryControl, 'countries', countryName)],
        ['Currencies', describeControl(form.currencyControl, 'currencies')],
        ['MCCs', describeControl(form.mccControl, 'MCCs', mccName)],
      ],
    ],
    [
      'limits',
      [
        ['Domestic', form.allowDomesticTxn === 'Y' ? form.domesticLimits.map(limitText).join('; ') || 'No limits' : '—'],
        ['International', form.allowIntlTxn === 'Y' ? form.intlLimits.map(limitText).join('; ') || 'No limits' : '—'],
      ],
    ],
    [
      'fees',
      [
        ['Service fees', feeList('serviceFees')],
        ['Domestic fees', form.allowDomesticTxn === 'Y' ? feeList('domesticFees') : '—'],
        ['International fees', form.allowIntlTxn === 'Y' ? feeList('intlFees') : '—'],
      ],
    ],
    [
      'schemes',
      form.schemes.map((s, i): [string, ReactNode] => [
        `Scheme ${i + 1}`,
        s.schemeId === null
          ? 'Not selected'
          : `${schemeName(s.schemeId)} · ${[templateName(s.namedTemplateId), templateName(s.anonymousTemplateId)].filter(Boolean).join(' / ') || 'no template'} · ${s.ranges.map((r) => `${binName(r.binId) ?? '—'} (${rangeName(r.cardRangeId) ?? '—'})`).join(', ')}`,
      ]),
    ],
  ];
  return (
    <div className="space-y-4" data-testid="product-summary">
      {groups.map(([step, rows]) => (
        <section key={step} className="space-y-2" aria-label={PRODUCT_STEPS.find((s) => s.id === step)?.label}>
          <StepHeading title={PRODUCT_STEPS.find((s) => s.id === step)?.label ?? step} />
          <Rows rows={rows} />
        </section>
      ))}
    </div>
  );
}

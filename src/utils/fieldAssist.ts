import { CURRENCIES, HOME_CURRENCY, PIN_POLICIES, QUOTA_POLICIES, REISSUE_POLICIES, SCHEMES, SERVICE_FEE_TYPES } from '../services/productCatalog';
import type { FeeRule, FeeTier, ProductForm, SchemeConfig, TxnLimit } from '../types/product';
import {
  binName,
  binsForScheme,
  feeTypeName,
  MAX_DESCRIPTION,
  PER_USD,
  policyName,
  rangeName,
  rangesForBin,
  schemeName,
  templateName,
  templatesFor,
  titleCase,
  toIsoDate,
  txnTypeName,
  validateProduct,
} from './productDraft';

/**
 * The AI help on each Product Setup field: a suggested value for the field ("Auto-fill"),
 * and answers to questions about it ("Ask AI"). Like the rest of the demo, the answers come
 * from local rules, using what is already filled in on the form as context.
 */

type LimitField = 'domesticLimits' | 'intlLimits';
type FeeField = 'serviceFees' | 'domesticFees' | 'intlFees';
type LimitCol = Exclude<keyof TxnLimit, 'txnType'>;
type TierCol = Exclude<keyof FeeTier, 'vatIncluded'>;
type FeeCol = 'feeType' | 'title' | 'effectiveDate' | 'expiryDate';
type SchemeCol = 'schemeId' | 'namedTemplateId' | 'anonymousTemplateId';
type RangeCol = 'binId' | 'cardRangeId';

/** A field of the form, addressed like the validation errors: `productName`, `domesticLimits.0.perTxMax`, `schemes.0.ranges.1.binId`. */
type FieldPath =
  | { kind: 'top'; field: keyof ProductForm }
  | { kind: 'limit'; field: LimitField; i: number; col: keyof TxnLimit }
  | { kind: 'fee'; field: FeeField; i: number; col: FeeCol }
  | { kind: 'tier'; field: FeeField; i: number; j: number; col: TierCol }
  | { kind: 'scheme'; i: number; col: SchemeCol }
  | { kind: 'range'; i: number; j: number; col: RangeCol };

export type FieldSuggestion = { ok: true; form: ProductForm; display: string; reason: string } | { ok: false; reason: string };

export interface FieldAnswer {
  paragraphs: string[];
  /** A value the user can apply with one click. */
  suggestion?: { display: string; reason: string };
}

const LIMIT_FIELDS: LimitField[] = ['domesticLimits', 'intlLimits'];
const FEE_FIELDS: FeeField[] = ['serviceFees', 'domesticFees', 'intlFees'];
const isIndex = (s: string | undefined) => s !== undefined && /^\d+$/.test(s);

function parseKey(key: string, form: ProductForm): FieldPath | null {
  const [a, b, c, d, e] = key.split('.');
  if (b === undefined) return a in form ? { kind: 'top', field: a as keyof ProductForm } : null;
  if (!isIndex(b)) return null;
  const i = Number(b);
  if (LIMIT_FIELDS.includes(a as LimitField) && form[a as LimitField][i] && c && c in form[a as LimitField][i]) return { kind: 'limit', field: a as LimitField, i, col: c as keyof TxnLimit };
  if (FEE_FIELDS.includes(a as FeeField)) {
    const fee = form[a as FeeField][i];
    if (!fee) return null;
    if (c === 'tiers' && isIndex(d) && fee.tiers[Number(d)] && e && e !== 'vatIncluded' && e in fee.tiers[Number(d)]) return { kind: 'tier', field: a as FeeField, i, j: Number(d), col: e as TierCol };
    if (c === 'feeType' || c === 'title' || c === 'effectiveDate' || c === 'expiryDate') return { kind: 'fee', field: a as FeeField, i, col: c };
    return null;
  }
  if (a === 'schemes' && form.schemes[i]) {
    if (c === 'schemeId' || c === 'namedTemplateId' || c === 'anonymousTemplateId') return { kind: 'scheme', i, col: c };
    if (c === 'ranges' && isIndex(d) && form.schemes[i].ranges[Number(d)] && (e === 'binId' || e === 'cardRangeId')) return { kind: 'range', i, j: Number(d), col: e };
  }
  return null;
}

/* ---------- Reading and writing one field ---------- */

function getValue(form: ProductForm, p: FieldPath): unknown {
  switch (p.kind) {
    case 'top':
      return form[p.field];
    case 'limit':
      return form[p.field][p.i][p.col];
    case 'fee':
      return form[p.field][p.i][p.col];
    case 'tier':
      return form[p.field][p.i].tiers[p.j][p.col];
    case 'scheme':
      return form.schemes[p.i][p.col];
    case 'range':
      return form.schemes[p.i].ranges[p.j][p.col];
  }
}

const replaceAt = <T>(list: T[], i: number, item: T) => list.map((x, k) => (k === i ? item : x));

function withLimit(form: ProductForm, field: LimitField, i: number, patch: Partial<TxnLimit>): ProductForm {
  return { ...form, [field]: replaceAt(form[field], i, { ...form[field][i], ...patch }) };
}

function withFee(form: ProductForm, field: FeeField, i: number, patch: Partial<FeeRule>): ProductForm {
  return { ...form, [field]: replaceAt(form[field], i, { ...form[field][i], ...patch }) };
}

function withTier(form: ProductForm, field: FeeField, i: number, j: number, patch: Partial<FeeTier>): ProductForm {
  const fee = form[field][i];
  return withFee(form, field, i, { tiers: replaceAt(fee.tiers, j, { ...fee.tiers[j], ...patch }) });
}

function withScheme(form: ProductForm, i: number, patch: Partial<SchemeConfig>): ProductForm {
  return { ...form, schemes: replaceAt(form.schemes, i, { ...form.schemes[i], ...patch }) };
}

/* ---------- Context from the rest of the form ---------- */

const typeOf = (f: ProductForm) => f.productType || 'DEBIT';
const segmentOf = (f: ProductForm) => f.marketSegment || 'CONSUMER';
const currencyOf = (f: ProductForm) => f.currency || HOME_CURRENCY;
const describedAs = (f: ProductForm) => `${f.productName} ${f.shortDesc}`;
const isGift = (f: ProductForm) => /\bgift\b/i.test(describedAs(f));

function nextMonth(today: Date): string {
  return toIsoDate(new Date(today.getFullYear(), today.getMonth() + 1, 1));
}

function plusYear(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return toIsoDate(new Date(y + 1, m - 1, d));
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const month = new Date(y, m - 1, d).toLocaleString('en-US', { month: 'short' });
  return `${String(d).padStart(2, '0')}-${month}-${y}`;
}

/** A USD amount in another currency, rounded to a sensible figure. */
function amountIn(usd: number, currency: string): number {
  const value = usd * (PER_USD[currency] ?? 1);
  if (value < 10) return Math.round(value * 100) / 100;
  const magnitude = 10 ** Math.floor(Math.log10(value) - 1);
  return Math.round(value / magnitude) * magnitude;
}

const money = (n: number, currency: string) => `${n.toLocaleString('en-US')} ${currency}`;

function limitCurrency(f: ProductForm, field: LimitField | FeeField): string {
  if (field === 'domesticLimits' || field === 'domesticFees') return f.domesticSettlementCurrency || currencyOf(f);
  if (field === 'intlLimits' || field === 'intlFees') return f.intlSettlementCurrency || 'USD';
  return currencyOf(f);
}

/* ---------- Names shown to the user ---------- */

const LIMIT_LABELS: Record<LimitCol, string> = {
  perTxMin: 'per-transaction minimum',
  perTxMax: 'per-transaction maximum',
  dailyCount: 'daily count',
  dailyAmount: 'daily amount',
  monthlyCount: 'monthly count',
  monthlyAmount: 'monthly amount',
};

function display(form: ProductForm, p: FieldPath, value: unknown): string {
  if (value === null || value === undefined || value === '') return 'empty';
  const v = value as never;
  switch (p.kind) {
    case 'top':
      if (p.field === 'pinPolicyId') return policyName(PIN_POLICIES, v) ?? String(v);
      if (p.field === 'quotaPolicyId') return policyName(QUOTA_POLICIES, v) ?? String(v);
      if (p.field === 'reissuePolicyId') return policyName(REISSUE_POLICIES, v) ?? String(v);
      if (p.field === 'validityYears') return `${v} year${v === 1 ? '' : 's'}`;
      if (p.field === 'effectiveDate') return formatDate(v);
      if (p.field === 'marketSegment' || p.field === 'productType' || p.field === 'intlUsage') return titleCase(v);
      break;
    case 'limit':
      if (p.col === 'txnType') return txnTypeName(v);
      if (p.col.endsWith('Count')) return String(v);
      return money(v, limitCurrency(form, p.field));
    case 'fee':
      if (p.col === 'feeType') return feeTypeName(p.field, v);
      if (p.col === 'effectiveDate' || p.col === 'expiryDate') return formatDate(v);
      break;
    case 'tier':
      if (p.col === 'rate' || p.col === 'vatRate') return `${v}%`;
      return money(v, limitCurrency(form, p.field));
    case 'scheme':
      return p.col === 'schemeId' ? (schemeName(v) ?? String(v)) : (templateName(v) ?? String(v));
    case 'range':
      return p.col === 'binId' ? (binName(v) ?? String(v)) : (rangeName(v) ?? String(v));
  }
  return String(v);
}

/** The field's current value, as the user would read it. */
export function describeFieldValue(form: ProductForm, key: string): string {
  const p = parseKey(key, form);
  return p ? display(form, p, getValue(form, p)) : 'empty';
}

/* ---------- Suggestions ---------- */

const ok = (form: ProductForm, p: FieldPath, reason: string): FieldSuggestion => ({ ok: true, form, display: display(form, p, getValue(form, p)), reason });
const no = (reason: string): FieldSuggestion => ({ ok: false, reason });

function suggestName(f: ProductForm): { value: string; reason: string } {
  const type = f.productType ? titleCase(f.productType) : 'Debit';
  const commercial = segmentOf(f) === 'COMMERCIAL';
  const names = commercial
    ? [`Business ${type} Card`, `Corporate ${type} Card`, `${type} Business Plus`, `SME ${type} Card`]
    : [`Consumer ${type} Card`, `Everyday ${type} Card`, `${type} Classic`, `${type} Plus`];
  // Asking again gives the next idea.
  const at = names.findIndex((n) => n.toLowerCase() === f.productName.trim().toLowerCase());
  return {
    value: names[(at + 1) % names.length],
    reason: f.productType ? `Based on the product type (${type}) and market segment (${titleCase(segmentOf(f))}).` : 'A general name. Choose a product type first for a more specific one.',
  };
}

function suggestTop(f: ProductForm, field: keyof ProductForm, today: Date): { value: unknown; reason: string } | string {
  const type = typeOf(f);
  const segment = segmentOf(f);
  const text = describedAs(f);
  switch (field) {
    case 'productName':
      return suggestName(f);
    case 'shortDesc': {
      const typeWord = titleCase(type);
      const who = segment === 'COMMERCIAL' ? 'business customers' : 'individual customers';
      const where = f.allowIntlTxn === 'Y' ? 'local and international spending' : 'local spending';
      return {
        value: `${typeWord} card for ${who}, issued in ${currencyOf(f)}, for ${where}.`.slice(0, MAX_DESCRIPTION),
        reason: 'Summarises the type, segment, currency and transaction scope you chose.',
      };
    }
    case 'marketSegment':
      return /\b(business|corporate|commercial|company|sme|expense)\b/i.test(text)
        ? { value: 'COMMERCIAL', reason: 'The product name suggests it is for businesses.' }
        : { value: 'CONSUMER', reason: 'Most card products are for individual customers.' };
    case 'productType':
      if (/\b(prepaid|gift|travel)\b/i.test(text)) return { value: 'PREPAID', reason: 'The product name suggests a loaded-balance card.' };
      if (/\bcredit\b/i.test(text)) return { value: 'CREDIT', reason: 'The product name mentions credit.' };
      return { value: 'DEBIT', reason: /\bdebit\b/i.test(text) ? 'The product name mentions debit.' : 'Debit is the most common card type.' };
    case 'currency': {
      const code = CURRENCIES.find((c) => new RegExp(`\\b${c}\\b`, 'i').test(text));
      if (code) return { value: code, reason: `The product name mentions ${code}.` };
      if (/\b(travel|global|international)\b/i.test(text)) return { value: 'USD', reason: 'Travel cards are usually held in USD.' };
      return { value: HOME_CURRENCY, reason: `${HOME_CURRENCY} is the home currency.` };
    }
    case 'validityYears':
      if (isGift(f)) return { value: 1, reason: 'Gift cards are usually valid for a year.' };
      if (type === 'DEBIT') return { value: 5, reason: 'Debit cards are usually valid for 5 years.' };
      return { value: 3, reason: `${titleCase(type)} cards are usually valid for 3 years.` };
    case 'defaultName':
      if (isGift(f)) return { value: 'GIFT CARD HOLDER', reason: 'A neutral name for gift cards.' };
      if (segment === 'COMMERCIAL') return { value: 'BUSINESS CARDHOLDER', reason: 'A neutral name for business cards issued without a name.' };
      if (type === 'PREPAID') return { value: 'PREPAID CARDHOLDER', reason: 'A neutral name for prepaid cards issued without a name.' };
      return { value: 'VALUED CUSTOMER', reason: 'A neutral name for cards issued without a cardholder name.' };
    case 'effectiveDate':
      return { value: nextMonth(today), reason: 'The first day of next month leaves time for approval.' };
    case 'domesticSettlementCurrency':
      return { value: currencyOf(f), reason: 'Domestic transactions usually settle in the account currency.' };
    case 'intlSettlementCurrency':
      return { value: 'USD', reason: 'Card schemes usually settle cross-border transactions in USD.' };
    case 'intlUsage':
      return type === 'CREDIT' || segment === 'COMMERCIAL'
        ? { value: 'ENABLED_BY_DEFAULT', reason: 'Credit and business cardholders usually expect to use their cards abroad straight away.' }
        : { value: 'DISABLED_BY_DEFAULT', reason: 'Cardholders switch it on when they travel, which reduces fraud on cards that stay at home.' };
    case 'pinPolicyId':
      return type === 'CREDIT' ? { value: 31, reason: 'A 6-digit PIN suits a credit line.' } : { value: 29, reason: 'The standard 4-digit PIN.' };
    case 'quotaPolicyId':
      return f.allowIntlTxn === 'Y'
        ? { value: 41, reason: 'International use is on, so a travel endorsement quota applies.' }
        : { value: 42, reason: 'The only quota that applies without international use.' };
    case 'reissuePolicyId':
      return type === 'PREPAID'
        ? { value: 14, reason: 'Prepaid cards are often renewed only when the customer asks.' }
        : { value: 12, reason: 'Renewing automatically avoids gaps when cards expire.' };
    default:
      return "This field can't be filled in automatically.";
  }
}

const LIMIT_PROFILES: Record<string, Record<LimitCol, number | null>> = {
  ATM_CWD: { perTxMin: 1, perTxMax: 200, dailyCount: 5, dailyAmount: 500, monthlyCount: 60, monthlyAmount: 5000 },
  NPSB_ATM_CWD: { perTxMin: 1, perTxMax: 200, dailyCount: 5, dailyAmount: 500, monthlyCount: 60, monthlyAmount: 5000 },
  POS: { perTxMin: 1, perTxMax: 1000, dailyCount: 20, dailyAmount: 2000, monthlyCount: 300, monthlyAmount: 20000 },
  ECOM: { perTxMin: 1, perTxMax: 500, dailyCount: 10, dailyAmount: 1000, monthlyCount: 150, monthlyAmount: 10000 },
  ATM_BI: { perTxMin: null, perTxMax: null, dailyCount: 10, dailyAmount: null, monthlyCount: 100, monthlyAmount: null },
  NPSB_FT: { perTxMin: 1, perTxMax: 500, dailyCount: 5, dailyAmount: 1000, monthlyCount: 50, monthlyAmount: 10000 },
  REFUND: { perTxMin: 1, perTxMax: 1000, dailyCount: 10, dailyAmount: 2000, monthlyCount: 100, monthlyAmount: 20000 },
};

const LIMIT_ORDER: [LimitCol, LimitCol][] = [
  ['perTxMin', 'perTxMax'],
  ['perTxMax', 'dailyAmount'],
  ['dailyAmount', 'monthlyAmount'],
  ['dailyCount', 'monthlyCount'],
];

const TXN_PREFERENCE = ['ATM_CWD', 'POS', 'ECOM', 'NPSB_FT', 'ATM_BI', 'NPSB_ATM_CWD', 'REFUND'];

function suggestLimit(f: ProductForm, p: Extract<FieldPath, { kind: 'limit' }>): FieldSuggestion {
  const rows = f[p.field];
  const row = rows[p.i];
  const domestic = p.field === 'domesticLimits';
  if (p.col === 'txnType') {
    const allowed = domestic ? f.domesticTxnTypes : f.intlTxnTypes;
    const taken = rows.filter((_, k) => k !== p.i).map((r) => r.txnType);
    const pick = TXN_PREFERENCE.find((t) => (!allowed.length || allowed.includes(t)) && !taken.includes(t));
    if (!pick) return no('Every allowed transaction type already has a limit in this section.');
    return ok(
      withLimit(f, p.field, p.i, { txnType: pick }),
      p,
      pick === 'ATM_CWD' ? 'Cash withdrawals carry the most risk, so they are usually limited first.' : 'An allowed transaction type that has no limit yet.',
    );
  }
  const txn = row.txnType || 'ATM_CWD';
  const usd = (LIMIT_PROFILES[txn] ?? LIMIT_PROFILES.ATM_CWD)[p.col];
  if (usd === null) return no(`${txnTypeName(txn)} usually has no ${LIMIT_LABELS[p.col]}, so leave it empty for no limit.`);
  const currency = limitCurrency(f, p.field);
  const scale = (segmentOf(f) === 'COMMERCIAL' ? 3 : 1) * (typeOf(f) === 'PREPAID' ? 0.5 : typeOf(f) === 'CREDIT' ? 1.5 : 1);
  let value = p.col.endsWith('Count') ? usd : amountIn(usd * scale, currency);
  // Stay consistent with the values already on the row.
  for (const [low, high] of LIMIT_ORDER) {
    if (p.col === high && row[low] !== null) value = Math.max(value, row[low]);
    if (p.col === low && row[high] !== null) value = Math.min(value, row[high]);
  }
  const forWhat = `${titleCase(segmentOf(f)).toLowerCase()} ${titleCase(typeOf(f)).toLowerCase()} card`;
  return ok(withLimit(f, p.field, p.i, { [p.col]: value }), p, `A typical ${txnTypeName(txn)} ${LIMIT_LABELS[p.col]} for a ${forWhat}${p.col.endsWith('Count') ? '' : ` in ${currency}`}.`);
}

interface FeeProfile {
  fixedUsd?: number;
  rate?: number;
  minUsd?: number;
  maxUsd?: number;
}

const SERVICE_FEE_PROFILES: Record<string, FeeProfile> = {
  ANNUAL_MAINTENANCE: { fixedUsd: 5 },
  CARD_ISSUANCE: { fixedUsd: 2 },
  CARD_REPLACEMENT: { fixedUsd: 3 },
  PIN_REISSUE: { fixedUsd: 1 },
  STATEMENT: { fixedUsd: 0.5 },
  ATM_CWD: { fixedUsd: 0.25 },
};
const DOMESTIC_FEE_PROFILES: Record<string, FeeProfile> = { ATM_CWD: { fixedUsd: 0.1 }, NPSB_ATM_CWD: { fixedUsd: 0.15 }, NPSB_FT: { fixedUsd: 0.1 }, ATM_BI: { fixedUsd: 0.05 } };
const INTL_FEE_PROFILES: Record<string, FeeProfile> = { ATM_CWD: { rate: 2, minUsd: 3, maxUsd: 25 }, ECOM: { rate: 1.5, minUsd: 1, maxUsd: 10 }, POS: { rate: 1.5, minUsd: 1, maxUsd: 10 } };

function feeProfile(field: FeeField, feeType: string): FeeProfile {
  if (field === 'serviceFees') return SERVICE_FEE_PROFILES[feeType] ?? { fixedUsd: 1 };
  if (field === 'domesticFees') return DOMESTIC_FEE_PROFILES[feeType] ?? { fixedUsd: 0.1 };
  return INTL_FEE_PROFILES[feeType] ?? { rate: 1 };
}

const FEE_PREFERENCE: Record<FeeField, string[]> = {
  serviceFees: ['ANNUAL_MAINTENANCE', 'CARD_ISSUANCE', 'CARD_REPLACEMENT', 'PIN_REISSUE', 'ATM_CWD', 'STATEMENT'],
  domesticFees: ['ATM_CWD', 'NPSB_ATM_CWD', 'NPSB_FT', 'ATM_BI', 'POS', 'ECOM', 'REFUND'],
  intlFees: ['ATM_CWD', 'ECOM', 'POS', 'ATM_BI', 'NPSB_ATM_CWD', 'NPSB_FT', 'REFUND'],
};

function suggestFee(f: ProductForm, p: Extract<FieldPath, { kind: 'fee' }>, today: Date): FieldSuggestion {
  const fees = f[p.field];
  const fee = fees[p.i];
  switch (p.col) {
    case 'feeType': {
      const allowed = p.field === 'serviceFees' ? Object.keys(SERVICE_FEE_TYPES) : p.field === 'domesticFees' ? f.domesticTxnTypes : f.intlTxnTypes;
      const taken = fees.filter((_, k) => k !== p.i).map((x) => x.feeType);
      const pick = FEE_PREFERENCE[p.field].find((t) => allowed.includes(t) && !taken.includes(t));
      if (!pick) return no('Every fee type that applies here is already added.');
      // The title follows the type until the user gives the policy a title of their own.
      const title = !fee.title || fee.title === feeTypeName(p.field, fee.feeType) ? feeTypeName(p.field, pick) : fee.title;
      const reason =
        p.field === 'serviceFees'
          ? pick === 'ANNUAL_MAINTENANCE'
            ? 'Almost every card product charges a yearly maintenance fee.'
            : 'A common service fee that is not added yet.'
          : 'Cash withdrawals are the transaction most often charged for.';
      return ok(withFee(f, p.field, p.i, { feeType: pick, title }), p, pick === 'ATM_CWD' || p.field === 'serviceFees' ? reason : 'A transaction type that has no fee yet.');
    }
    case 'title':
      if (!fee.feeType) return no('Choose the fee type first, then I can name the policy after it.');
      return ok(withFee(f, p.field, p.i, { title: feeTypeName(p.field, fee.feeType) }), p, 'Named after the fee type, so it is easy to find on reports.');
    case 'effectiveDate':
      return ok(withFee(f, p.field, p.i, { effectiveDate: f.effectiveDate || nextMonth(today) }), p, f.effectiveDate ? "The same as the product's Live From date." : 'The first day of next month.');
    case 'expiryDate': {
      const from = fee.effectiveDate || f.effectiveDate || nextMonth(today);
      return ok(withFee(f, p.field, p.i, { expiryDate: plusYear(from) }), p, 'One year after the effective date, when fees are usually reviewed. Leave it empty if the fee has no end date.');
    }
  }
}

function suggestTier(f: ProductForm, p: Extract<FieldPath, { kind: 'tier' }>): FieldSuggestion {
  const fee = f[p.field][p.i];
  const tier = fee.tiers[p.j];
  const currency = limitCurrency(f, p.field);
  const profile = feeProfile(p.field, fee.feeType);
  const name = fee.feeType ? feeTypeName(p.field, fee.feeType) : 'this fee';
  const set = (patch: Partial<FeeTier>, reason: string) => ok(withTier(f, p.field, p.i, p.j, patch), p, reason);
  switch (p.col) {
    case 'amountFrom': {
      const from = p.j > 0 ? (fee.tiers[p.j - 1].amountTo ?? 0) : 0;
      return set({ amountFrom: from }, p.j > 0 ? 'Starts where the previous tier ends.' : 'The first tier starts at 0.');
    }
    case 'amountTo': {
      const next = fee.tiers[p.j + 1]?.amountFrom;
      if (next !== undefined && next !== null && next > (tier.amountFrom ?? 0)) return set({ amountTo: next }, 'Ends where the next tier starts.');
      return no('This is the last tier, so leave Amount to empty: the tier then covers every amount above Amount from.');
    }
    case 'fixedFee':
      if (profile.fixedUsd === undefined) return no(`${titleCase(name)} is usually a percentage, so set the variable rate and leave the fixed fee empty.`);
      return set({ fixedFee: amountIn(profile.fixedUsd, currency) }, `A typical ${name.toLowerCase()} in ${currency}.`);
    case 'rate':
      if (profile.rate === undefined) return no(`${titleCase(name)} is usually a fixed amount, so leave the rate empty.`);
      return set({ rate: profile.rate }, `A typical rate for ${name.toLowerCase()}.`);
    case 'minFee':
      if (profile.minUsd === undefined) return no('A minimum fee is only needed for percentage fees, so leave it empty.');
      return set({ minFee: Math.min(amountIn(profile.minUsd, currency), tier.maxFee ?? Infinity) }, 'Makes small transactions still cover their cost.');
    case 'maxFee':
      if (profile.maxUsd === undefined) return no('A maximum fee is only needed for percentage fees, so leave it empty.');
      return set({ maxFee: Math.max(amountIn(profile.maxUsd, currency), tier.minFee ?? 0) }, 'Caps the fee on large transactions.');
    case 'vatRate':
      return currency === HOME_CURRENCY
        ? set({ vatRate: 15 }, 'The standard VAT rate in Bangladesh is 15%.')
        : set({ vatRate: 0 }, `Fees charged in ${currency} usually carry no local VAT. Check with your finance team.`);
  }
}

function suggestScheme(f: ProductForm, p: Extract<FieldPath, { kind: 'scheme' }>): FieldSuggestion {
  const scheme = f.schemes[p.i];
  if (p.col === 'schemeId') {
    const taken = f.schemes.filter((_, k) => k !== p.i).map((s) => s.schemeId);
    const pick = [5, 6, 7].find((id) => !taken.includes(id) && SCHEMES.some((s) => s.id === id));
    if (pick === undefined) return no('Every scheme is already configured on this product.');
    // A new scheme has its own templates and BINs.
    const next = scheme.schemeId === pick ? scheme : { schemeId: pick, namedTemplateId: null, anonymousTemplateId: null, ranges: scheme.ranges.map(() => ({ binId: null, cardRangeId: null })) };
    return ok(withScheme(f, p.i, next), p, pick === 5 ? 'VISA is the most widely accepted scheme.' : 'Adds a second card network to the product.');
  }
  if (scheme.schemeId === null) return no('Choose a scheme first. Templates depend on it.');
  if (p.col === 'namedTemplateId') {
    const named = templatesFor(scheme.schemeId, 'NAMED');
    const pick = (typeOf(f) === 'CREDIT' && named.find((t) => /platinum/i.test(t.name))) || named[0];
    if (!pick) return no(`${schemeName(scheme.schemeId)} has no named card templates.`);
    return ok(withScheme(f, p.i, { namedTemplateId: pick.id }), p, 'Named cards carry the cardholder name, which most products issue.');
  }
  const anonymous = templatesFor(scheme.schemeId, 'ANONYMOUS')[0];
  if (!anonymous) return no(`${schemeName(scheme.schemeId)} has no anonymous card templates.`);
  return ok(withScheme(f, p.i, { anonymousTemplateId: anonymous.id }), p, 'Lets you issue cards without a cardholder name, such as gift or instant cards.');
}

function suggestRange(f: ProductForm, p: Extract<FieldPath, { kind: 'range' }>): FieldSuggestion {
  const scheme = f.schemes[p.i];
  const row = scheme.ranges[p.j];
  const used = f.schemes.flatMap((s, i) => s.ranges.filter((_, j) => !(i === p.i && j === p.j)).map((r) => r.cardRangeId));
  const free = (binId: number) => rangesForBin(binId).filter((r) => !used.includes(r.id));
  const setRow = (patch: Partial<SchemeConfig['ranges'][number]>) => withScheme(f, p.i, { ranges: replaceAt(scheme.ranges, p.j, { ...row, ...patch }) });
  if (scheme.schemeId === null) return no('Choose a scheme first. BINs depend on it.');
  if (p.col === 'binId') {
    const bins = binsForScheme(scheme.schemeId).filter((b) => free(b.id).length);
    const prefer = segmentOf(f) === 'COMMERCIAL' ? /business/i : typeOf(f) === 'CREDIT' ? /platinum|world|gold/i : null;
    const pick = (prefer && bins.find((b) => prefer.test(b.name))) || bins[0];
    if (!pick) return no(`Every card range of the ${schemeName(scheme.schemeId)} BINs is already mapped.`);
    const keepRange = row.binId === pick.id ? row.cardRangeId : null;
    return ok(
      setRow({ binId: pick.id, cardRangeId: keepRange }),
      p,
      prefer && prefer.test(pick.name) ? 'This BIN matches the card tier of the product.' : 'A BIN of the chosen scheme with card ranges still free.',
    );
  }
  if (row.binId === null) return no('Choose a BIN first. Card ranges depend on it.');
  const range = free(row.binId)[0];
  if (!range) return no('Every range of this BIN is already mapped. Choose another BIN.');
  return ok(setRow({ cardRangeId: range.id }), p, 'The first range of this BIN that is not mapped yet.');
}

/** A value for one field, chosen from what is already on the form, or the reason there is none. */
export function suggestField(form: ProductForm, key: string, today = new Date()): FieldSuggestion {
  const p = parseKey(key, form);
  if (!p) return no("This field can't be filled in automatically.");
  switch (p.kind) {
    case 'top': {
      const s = suggestTop(form, p.field, today);
      if (typeof s === 'string') return no(s);
      return ok({ ...form, [p.field]: s.value }, p, s.reason);
    }
    case 'limit':
      return suggestLimit(form, p);
    case 'fee':
      return suggestFee(form, p, today);
    case 'tier':
      return suggestTier(form, p);
    case 'scheme':
      return suggestScheme(form, p);
    case 'range':
      return suggestRange(form, p);
  }
}

/* ---------- Answers ---------- */

interface Help {
  about: string;
  rules: string;
}

const list = (items: { name: string }[]) => items.map((i) => i.name).join(', ');

const TOP_HELP: Partial<Record<keyof ProductForm, Help>> = {
  productName: {
    about: "The name staff see in the Product List and on reports. Cardholders don't see it.",
    rules: 'Required, up to 100 characters. Two products with the same name cannot both wait for approval.',
  },
  shortDesc: { about: 'A short summary of who the product is for and how it is used.', rules: `Optional, up to ${MAX_DESCRIPTION} characters.` },
  marketSegment: { about: 'Who the cards are for: Consumer for individual customers, Commercial for businesses. It also scales the suggested limits.', rules: 'Required.' },
  productType: { about: 'Debit cards spend from a bank account, Credit cards from a credit line, and Prepaid cards from a balance loaded in advance.', rules: 'Required.' },
  currency: { about: 'The currency the card account is held in. Service fees are charged in it.', rules: 'Required. Domestic settlement follows it unless you choose another currency.' },
  validityYears: { about: 'How long a card stays valid after it is issued. It sets the expiry date printed on the card.', rules: 'Required, from 1 to 10 years.' },
  defaultName: { about: 'The name printed on anonymous cards, which are issued without a cardholder name.', rules: 'Optional, up to 26 characters, in capital letters.' },
  effectiveDate: { about: 'The date from which cards can be issued under this product.', rules: 'Required. Approval takes time, so choose a date that leaves room for it.' },
  domesticSettlementCurrency: { about: 'The currency that transactions inside the home country are settled in.', rules: 'Required while domestic transactions are on.' },
  intlSettlementCurrency: { about: 'The currency that cross-border transactions are settled in with the card scheme.', rules: 'Required while international transactions are on.' },
  intlUsage: {
    about: 'Whether international use is on when a card is issued. If it is disabled by default, cardholders switch it on themselves, for example before travelling.',
    rules: 'Required while international transactions are on.',
  },
  pinPolicyId: { about: `The PIN rules the cards follow, such as the PIN length. Options: ${list(PIN_POLICIES)}.`, rules: 'Required while the PIN policy is configured.' },
  quotaPolicyId: { about: `The endorsement or quota cardholders need for some transactions. Options: ${list(QUOTA_POLICIES)}.`, rules: 'Required while the quota policy is configured.' },
  reissuePolicyId: { about: `How cards are renewed when they expire. Options: ${list(REISSUE_POLICIES)}.`, rules: 'Required for renewable products.' },
};

const LIMIT_HELP: Record<keyof TxnLimit, Help> = {
  txnType: { about: 'The transaction type these limits apply to. Types without a limit row have no limit.', rules: 'Required. Each transaction type can have one limit row per section.' },
  perTxMin: { about: 'The smallest amount allowed in one transaction.', rules: 'Empty means no limit. Otherwise 0 or more, and no more than the per-transaction maximum.' },
  perTxMax: { about: 'The largest amount allowed in one transaction.', rules: 'Empty means no limit. At least the minimum, and no more than the daily amount.' },
  dailyCount: { about: 'How many transactions of this type a card can make in a day.', rules: 'Empty means no limit. A whole number, no more than the monthly count.' },
  dailyAmount: {
    about: 'The total amount a card can spend on this transaction type in a day.',
    rules: 'Empty means no limit. At least the per-transaction maximum, and no more than the monthly amount.',
  },
  monthlyCount: { about: 'How many transactions of this type a card can make in a month.', rules: 'Empty means no limit. A whole number, at least the daily count.' },
  monthlyAmount: { about: 'The total amount a card can spend on this transaction type in a month.', rules: 'Empty means no limit. At least the daily amount.' },
};

const FEE_HELP: Record<FeeCol, Help> = {
  feeType: { about: 'What the fee is charged for: a service, such as yearly card maintenance, or a transaction type.', rules: 'Required. Each type can be added once per section.' },
  title: { about: 'The name of the fee policy, shown on statements and reports.', rules: 'Required.' },
  effectiveDate: { about: 'The date the fee starts to apply.', rules: 'Required.' },
  expiryDate: { about: 'The date the fee stops applying.', rules: 'Optional. It must be after the effective date. Empty means the fee has no end date.' },
};

const TIER_HELP: Record<TierCol, Help> = {
  amountFrom: { about: 'Where this tier starts: the fee applies to transactions from this amount.', rules: '0 or more.' },
  amountTo: { about: 'Where this tier ends. Use more tiers to charge different fees for different amounts.', rules: 'Must be above Amount from. Empty means "and above".' },
  rate: { about: 'A percentage of the transaction amount.', rules: 'Between 0 and 100. Each tier needs a rate, a fixed fee, or both.' },
  fixedFee: { about: 'A flat amount charged each time.', rules: '0 or more. Each tier needs a fixed fee, a rate, or both.' },
  minFee: { about: 'The lowest fee charged when the fee is a percentage.', rules: '0 or more, and no more than the maximum fee.' },
  maxFee: { about: 'The highest fee charged when the fee is a percentage.', rules: 'At least the minimum fee.' },
  vatRate: { about: 'The VAT added on top of the fee.', rules: 'Between 0 and 100.' },
};

const SCHEME_HELP: Record<SchemeCol | RangeCol, Help> = {
  schemeId: { about: 'The card network the cards are issued on, such as VISA or Mastercard.', rules: 'Required. Each scheme can be configured once.' },
  namedTemplateId: { about: "The card design used for personalised cards that carry the cardholder's name.", rules: 'Choose a named template, an anonymous template, or both.' },
  anonymousTemplateId: { about: 'The card design used for cards issued without a cardholder name, such as gift or instant cards.', rules: 'Choose a named template, an anonymous template, or both.' },
  binId: { about: 'The Bank Identification Number: the first digits of the card number, which identify the issuer and the card tier.', rules: 'Required, from the BINs of the chosen scheme.' },
  cardRangeId: { about: 'The block of card numbers under the BIN that this product issues cards from.', rules: 'Required. A range can be mapped only once.' },
};

function helpFor(p: FieldPath): Help {
  switch (p.kind) {
    case 'top':
      return TOP_HELP[p.field] ?? { about: 'Part of the product setup.', rules: 'See the field label for whether it is required.' };
    case 'limit':
      return LIMIT_HELP[p.col];
    case 'fee':
      return FEE_HELP[p.col];
    case 'tier':
      return TIER_HELP[p.col];
    case 'scheme':
    case 'range':
      return SCHEME_HELP[p.col];
  }
}

const ASKS_FOR_VALUE = /\b(suggest|recommend|should|best|good|ideal|fill|example|which|typical|enter|put|value|use|choose|pick)\b/i;
const ASKS_FOR_RULES = /\b(rules?|requir\w*|mandatory|optional|valid\w*|allowed|max\w*|min\w*|format|length|characters?|errors?|wrong|invalid|empty|blank)\b/i;
const ASKS_WHAT = /\b(what (is|does|are)|mean\w*|explain|purpose|why|used for|how does)\b/i;

/** Answers a question about one field, with a value to apply when there is one. */
export function answerFieldQuestion(form: ProductForm, key: string, label: string, question: string, today = new Date()): FieldAnswer {
  const p = parseKey(key, form);
  if (!p) return { paragraphs: [`I don't have details about ${label} yet.`] };
  const help = helpFor(p);
  const wantsValue = ASKS_FOR_VALUE.test(question);
  const wantsRules = ASKS_FOR_RULES.test(question);
  const wantsAbout = ASKS_WHAT.test(question);
  const general = !wantsValue && !wantsRules && !wantsAbout;

  const paragraphs: string[] = [];
  if (wantsAbout || general) paragraphs.push(help.about);
  if (wantsRules || general) paragraphs.push(help.rules);

  const errors = validateProduct(form);
  const error = errors[key] ?? (p.kind === 'scheme' && p.col !== 'schemeId' ? errors[`schemes.${p.i}.templates`] : undefined);
  const current = display(form, p, getValue(form, p));
  if (error) paragraphs.push(`Right now: ${error}`);
  else if (current !== 'empty') paragraphs.push(`It is currently set to ${current}.`);

  const s = suggestField(form, key, today);
  if (!s.ok) {
    if (wantsValue || general) paragraphs.push(s.reason);
    return { paragraphs };
  }
  if (JSON.stringify(getValue(s.form, p)) === JSON.stringify(getValue(form, p))) {
    paragraphs.push(`${current} is what I would suggest too. ${s.reason}`);
    return { paragraphs };
  }
  if (wantsValue) paragraphs.push(`I suggest ${s.display}. ${s.reason}`);
  return { paragraphs, suggestion: { display: s.display, reason: s.reason } };
}

/** Example questions offered in the Ask AI panel. */
export const QUICK_QUESTIONS = ['What is this field?', 'What should I enter?', 'What are the rules?'];

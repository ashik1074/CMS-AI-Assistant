import {
  BINS,
  CARD_RANGES,
  CARD_TEMPLATES,
  COUNTRIES,
  CURRENCIES,
  DEFAULT_ASP_ID,
  HOME_CURRENCY,
  MCCS,
  PIN_POLICIES,
  QUOTA_POLICIES,
  REISSUE_POLICIES,
  SCHEMES,
  SERVICE_FEE_TYPES,
  TXN_TYPES,
} from '../services/productCatalog';
import type {
  AccessControl,
  ControlMode,
  FeeRule,
  FeeTier,
  IntlUsage,
  MarketSegment,
  ProductBasics,
  ProductField,
  ProductForm,
  ProductType,
  RenewalType,
  SchemeConfig,
  TxnLimit,
  YesNo,
  ProductStatus,
} from '../types/product';

export const MARKET_SEGMENTS: MarketSegment[] = ['CONSUMER', 'COMMERCIAL'];
export const PRODUCT_TYPES: ProductType[] = ['DEBIT', 'CREDIT', 'PREPAID'];
export const INTL_USAGES: IntlUsage[] = ['ENABLED_BY_DEFAULT', 'DISABLED_BY_DEFAULT'];
export const RENEWAL_TYPES: RenewalType[] = ['RENEWABLE', 'ONE_TIME'];
export const CONTROL_MODES: ControlMode[] = ['ALLOW_ALL_EXCEPT', 'DISALLOW_ALL_EXCEPT'];
export const VALIDITY_YEARS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
export const MAX_DESCRIPTION = 250;
export const MAX_DEFAULT_NAME = 26;

export const FIELD_LABELS: Record<ProductField, string> = {
  aspId: 'ASP ID',
  productName: 'Product name',
  shortDesc: 'Description',
  marketSegment: 'Market segment',
  productType: 'Product type',
  currency: 'Account currency',
  validityYears: 'Card validity',
  defaultName: 'Default cardholder name',
  effectiveDate: 'Live from',
  allowDomesticTxn: 'Domestic transactions',
  domesticSettlementCurrency: 'Domestic settlement currency',
  allowIntlTxn: 'International transactions',
  intlSettlementCurrency: 'International settlement currency',
  intlUsage: 'International usage',
  pinPolicyRequired: 'PIN policy',
  pinPolicyId: 'PIN policy',
  quotaPolicyRequired: 'Quota policy',
  quotaPolicyId: 'Quota policy',
  renewalType: 'Renewal',
  reissuePolicyId: 'Renewal policy',
  domesticTxnTypes: 'Domestic transaction types',
  intlTxnTypes: 'International transaction types',
  countryControl: 'Country controls',
  currencyControl: 'Currency controls',
  mccControl: 'MCC controls',
  domesticLimits: 'Domestic transaction limits',
  intlLimits: 'International transaction limits',
  serviceFees: 'Service fees',
  domesticFees: 'Domestic transaction fees',
  intlFees: 'International transaction fees',
  schemes: 'Scheme configuration',
  createdBy: 'Created by',
};

export const titleCase = (value: string) => value.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/* ---------- Steps ---------- */

export type ProductStep = 'basics' | 'policies' | 'permissions' | 'limits' | 'fees' | 'schemes';

/** The form's sections, in the KONA PARTNER product setup order. */
export const PRODUCT_STEPS: { id: ProductStep; label: string }[] = [
  { id: 'basics', label: 'Basics' },
  { id: 'policies', label: 'Policies' },
  { id: 'permissions', label: 'Permissions' },
  { id: 'limits', label: 'Limits' },
  { id: 'fees', label: 'Fees' },
  { id: 'schemes', label: 'Scheme configuration' },
];

const STEP_OF: Record<ProductField, ProductStep> = {
  aspId: 'basics',
  productName: 'basics',
  shortDesc: 'basics',
  marketSegment: 'basics',
  productType: 'basics',
  currency: 'basics',
  validityYears: 'basics',
  defaultName: 'basics',
  effectiveDate: 'basics',
  allowDomesticTxn: 'basics',
  domesticSettlementCurrency: 'basics',
  allowIntlTxn: 'basics',
  intlSettlementCurrency: 'basics',
  intlUsage: 'basics',
  createdBy: 'basics',
  pinPolicyRequired: 'policies',
  pinPolicyId: 'policies',
  quotaPolicyRequired: 'policies',
  quotaPolicyId: 'policies',
  renewalType: 'policies',
  reissuePolicyId: 'policies',
  domesticTxnTypes: 'permissions',
  intlTxnTypes: 'permissions',
  countryControl: 'permissions',
  currencyControl: 'permissions',
  mccControl: 'permissions',
  domesticLimits: 'limits',
  intlLimits: 'limits',
  serviceFees: 'fees',
  domesticFees: 'fees',
  intlFees: 'fees',
  schemes: 'schemes',
};

/** The step an error key (e.g. `serviceFees.0.tiers.1.rate`) belongs to. */
export const stepOfKey = (key: string): ProductStep => STEP_OF[key.split('.')[0] as ProductField] ?? 'basics';

/** Links to the product pages (hash routes, see app/routes). */
export const productDetailsHref = (productId: string) => `#/products/${encodeURIComponent(productId)}`;
export const draftFormHref = (productId: string) => `#/products/${encodeURIComponent(productId)}/edit`;

export const PRODUCT_STATUS_LABELS = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending approval',
  REJECTED: 'Rejected',
} as const satisfies Record<ProductStatus, string>;

/* ---------- Intent ---------- */

export const CREATE_PRODUCT_PATTERN = /\b(create|creating|set\s*up|setup|onboard|add|make|launch|configure|build|register|new)\b[^.?!\n]{0,40}?\bproducts?\b/i;

/** True for prompts such as "Create a product" or "Set up a new prepaid card product named X". */
export function isCreateProductRequest(text: string): boolean {
  return CREATE_PRODUCT_PATTERN.test(text);
}

/* ---------- Reading the user's choices ---------- */

export interface ProductPreferences {
  values: Partial<ProductForm>;
  /** Fields in the order the user mentioned them. */
  fields: ProductField[];
}

type LabelKey = ProductField | 'allowedCountries' | 'blockedCountries' | 'blockedCurrencies' | 'blockedMccs';

/** Labels a user might write before a value, e.g. "Product Name: Platinum". Longer phrases first. */
const LABELS: [LabelKey, string][] = [
  ['domesticSettlementCurrency', 'domestic\\s+settlement\\s+currency'],
  ['intlSettlementCurrency', '(?:intl|international)\\s+settlement\\s+currency'],
  ['blockedCurrencies', '(?:blacklist(?:ed)?|block(?:ed)?)\\s+currenc(?:y|ies)'],
  ['blockedMccs', '(?:blacklist(?:ed)?|block(?:ed)?)\\s+mccs?'],
  ['blockedCountries', '(?:blacklist(?:ed)?|block(?:ed)?)\\s+countr(?:y|ies)'],
  ['allowedCountries', 'allowed\\s+countr(?:y|ies)|countries'],
  ['intlUsage', '(?:intl|international)\\s+usage'],
  ['allowDomesticTxn', '(?:allow\\s+)?domestic\\s+(?:txns?|transactions?)'],
  ['allowIntlTxn', '(?:allow\\s+)?(?:intl|international)\\s+(?:txns?|transactions?)'],
  ['pinPolicyRequired', 'pin\\s+(?:policy\\s+)?required|pin\\s+policy'],
  ['quotaPolicyRequired', 'quota\\s+(?:policy\\s+)?required|quota\\s+policy'],
  ['renewalType', 'renewal(?:\\s+policy)?|renewable'],
  ['productName', 'product\\s*name|name\\s+of\\s+the\\s+product'],
  ['shortDesc', 'short\\s*desc(?:ription)?|description'],
  ['marketSegment', 'market\\s*segment|segment'],
  ['productType', 'product\\s*type|card\\s*type'],
  ['effectiveDate', 'live\\s*from|go[-\\s]*live\\s*date|effective\\s*date|start\\s*date|launch\\s*date'],
  ['validityYears', 'card\\s+validity(?:\\s+duration)?|validity|duration'],
  ['defaultName', 'default\\s*(?:cardholder\\s*)?name|name\\s+on\\s+(?:the\\s+)?card|embossed\\s+name'],
  ['currency', 'account\\s+currency|product\\s+currency|currency'],
];

const LABEL_SOURCE = LABELS.map(([, source]) => `(?:${source})`).join('|');
/** A label followed by ":" / "=" / "is" / "as". */
const LABELED = new RegExp(`\\b(${LABEL_SOURCE})\\s*(?::|=|\\bis\\b|\\bas\\b|\\bshould\\s+be\\b|\\bof\\b)\\s*`, 'gi');
/** Where a value stops: a new clause that starts with another label. */
const NEXT_CLAUSE = new RegExp(`(?:[,;]|\\band\\b|\\bwith\\b)\\s+(?:the\\s+|a\\s+)?(?:${LABEL_SOURCE})\\b`, 'i');
const LABEL_TESTS = LABELS.map(([key, source]) => [key, new RegExp(`^(?:${source})$`, 'i')] as const);

const COUNTRY_CODES = new Map(Object.entries(COUNTRIES).flatMap(([code, name]) => [[code, code], [name.toUpperCase(), code]]));

function clean(value: string): string {
  return value
    .trim()
    .replace(/^["“'`]+|["”'`]+$/g, '')
    .replace(/[.。!]+$/, '')
    .trim();
}

function toYesNo(value: string): YesNo | undefined {
  if (/^(y|yes|true|allow(ed)?|enabled?|on|required|needed|with|configured)\b/i.test(value)) return 'Y';
  if (/^(n|no|none|false|disallow(ed)?|disabled?|off|not|without|block(ed)?)\b/i.test(value)) return 'N';
  return undefined;
}

function toCurrency(value: string): string | undefined {
  const code = /\b([A-Za-z]{3})\b/.exec(value)?.[1]?.toUpperCase();
  return code && (CURRENCIES.includes(code) || /^[A-Z]{3}$/.test(code)) ? code : undefined;
}

function toCodeList(value: string, pattern: RegExp): string[] | undefined {
  const items = value
    .split(/[\s,/]+|\band\b/i)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const valid = items.filter((s) => pattern.test(s));
  return valid.length ? [...new Set(valid)] : undefined;
}

function toCountries(value: string): string[] | undefined {
  const parts = value
    .split(/,|\/|\band\b/i)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const codes = parts.map((p) => COUNTRY_CODES.get(p) ?? (/^[A-Z]{3}$/.test(p) ? p : undefined)).filter((c): c is string => !!c);
  return codes.length ? [...new Set(codes)] : undefined;
}

/** "5 years" → 5, "36 months" → 3, "3" → 3. */
function toYears(value: string): number | undefined {
  const match = /(\d{1,3})\s*-?\s*(years?|yrs?|y|months?|mos?|m)?\b/i.exec(value);
  if (!match) return undefined;
  const n = Number(match[1]);
  const years = match[2] && /^m/i.test(match[2]) ? Math.round(n / 12) : n;
  return years > 0 ? years : undefined;
}

export function toIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toDate(value: string, today: Date): string | undefined {
  if (/\btoday\b/i.test(value)) return toIsoDate(today);
  if (/\btomorrow\b/i.test(value)) return toIsoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1));
  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(value);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : toIsoDate(new Date(parsed));
}

const control = (mode: ControlMode, exceptions: string[]): AccessControl => ({ mode, exceptions });

function parseValue(key: LabelKey, raw: string, today: Date): Partial<ProductForm> | undefined {
  const value = clean(raw);
  if (!value) return undefined;
  const set = <K extends ProductField>(field: K, v: ProductForm[K] | undefined) => (v === undefined ? undefined : ({ [field]: v } as Partial<ProductForm>));
  const list = <T>(v: T[] | undefined, make: (items: T[]) => Partial<ProductForm>) => (v ? make(v) : undefined);
  switch (key) {
    case 'productName':
      return set('productName', value.slice(0, 100));
    case 'shortDesc':
      return set('shortDesc', value.slice(0, MAX_DESCRIPTION));
    case 'defaultName':
      return set('defaultName', value.toUpperCase().slice(0, MAX_DEFAULT_NAME));
    case 'marketSegment':
      if (/\b(commercial|corporates?|business(?:es)?|smes?)\b/i.test(value)) return set('marketSegment', 'COMMERCIAL');
      if (/\b(consumers?|retail|personal|individuals?)\b/i.test(value)) return set('marketSegment', 'CONSUMER');
      return undefined;
    case 'productType': {
      const type = /\b(debit|credit|prepaid)\b/i.exec(value)?.[1];
      return set('productType', type ? (type.toUpperCase() as ProductType) : undefined);
    }
    case 'validityYears':
      return set('validityYears', toYears(value));
    case 'effectiveDate':
      return set('effectiveDate', toDate(value, today));
    case 'currency':
    case 'domesticSettlementCurrency':
    case 'intlSettlementCurrency':
      return set(key, toCurrency(value));
    case 'allowDomesticTxn':
    case 'allowIntlTxn':
    case 'pinPolicyRequired':
    case 'quotaPolicyRequired':
      return set(key, toYesNo(value));
    case 'intlUsage':
      if (/disabled?|off|no\b/i.test(value)) return set('intlUsage', 'DISABLED_BY_DEFAULT');
      if (/enabled?|on|yes\b/i.test(value)) return set('intlUsage', 'ENABLED_BY_DEFAULT');
      return undefined;
    case 'renewalType':
      if (/one[-\s]?time|not\s+renewable|no\b|none/i.test(value)) return set('renewalType', 'ONE_TIME');
      if (/renew|auto|yes\b/i.test(value)) return set('renewalType', 'RENEWABLE');
      return undefined;
    case 'allowedCountries':
      return list(toCountries(value), (codes) => ({ countryControl: control('DISALLOW_ALL_EXCEPT', codes) }));
    case 'blockedCountries':
      return list(toCountries(value), (codes) => ({ countryControl: control('ALLOW_ALL_EXCEPT', codes) }));
    case 'blockedCurrencies':
      return list(toCodeList(value, /^[A-Z]{3}$/), (codes) => ({ currencyControl: control('ALLOW_ALL_EXCEPT', codes) }));
    case 'blockedMccs':
      return list(toCodeList(value, /^\d{4}$/), (codes) => ({ mccControl: control('ALLOW_ALL_EXCEPT', codes) }));
    default:
      return undefined;
  }
}

/** Reads the product choices stated in one message. */
export function extractProductPreferences(text: string, today = new Date()): ProductPreferences {
  const values: Partial<ProductForm> = {};
  const fields: ProductField[] = [];
  const record = (patch: Partial<ProductForm> | undefined) => {
    if (!patch) return;
    for (const key of Object.keys(patch) as ProductField[]) {
      if (!fields.includes(key)) fields.push(key);
    }
    Object.assign(values, patch);
  };

  // 1. Explicit "Label: value" pairs.
  const matches = [...text.matchAll(LABELED)];
  matches.forEach((match, i) => {
    const label = match[1];
    const key = LABEL_TESTS.find(([, test]) => test.test(label.replace(/\s+/g, ' ')))?.[0];
    if (!key) return;
    const start = match.index + match[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    let raw = text.slice(start, end);
    const lineEnd = raw.search(/[;\n]/);
    if (lineEnd !== -1) raw = raw.slice(0, lineEnd);
    const clause = NEXT_CLAUSE.exec(raw);
    if (clause) raw = raw.slice(0, clause.index);
    if (!/[\n;]/.test(raw)) raw = raw.replace(/,\s*$/, '');
    record(parseValue(key, raw, today));
  });

  // 2. Plain wording, for anything not given explicitly.
  const has = (f: ProductField) => fields.includes(f);
  if (!has('productName')) {
    const named = /\b(?:named|called|titled)\s+["“']?(.+?)["”']?(?=\s*(?:[,;.!\n]|$|\s+(?:with|for|and|in|that|which|using|under|on)\b))/i.exec(text);
    const quoted = /["“]([^"”\n]{2,80})["”]/.exec(text);
    record(parseValue('productName', named?.[1] ?? quoted?.[1] ?? '', today));
  }
  if (!has('productType')) {
    const type = /\b(debit|credit|prepaid)\b/i.exec(text)?.[1];
    if (type) record({ productType: type.toUpperCase() as ProductType });
  }
  if (!has('marketSegment')) {
    if (/\b(commercial|corporates?|business(?:es)?|smes?)\b/i.test(text)) record({ marketSegment: 'COMMERCIAL' });
    else if (/\b(consumers?|retail|personal|individuals?)\b/i.test(text)) record({ marketSegment: 'CONSUMER' });
  }
  if (!has('currency')) {
    const code = /\b(?:in|currency|denominated\s+in)\s+([A-Za-z]{3})\b/i.exec(text)?.[1]?.toUpperCase();
    if (code && CURRENCIES.includes(code)) record({ currency: code });
  }
  if (!has('validityYears')) {
    const validity = /\b(\d{1,2})\s*-?\s*(years?|months?)\b(?:\s+(?:validity|valid|expiry))?/i.exec(text);
    if (validity) record({ validityYears: toYears(validity[0]) });
  }
  if (!has('allowIntlTxn')) {
    if (/\b(no|without|disable|block|disallow)\s+international\b|\bdomestic[-\s]only\b/i.test(text)) record({ allowIntlTxn: 'N' });
    else if (/\b(with|allow|enable|support|plus|including)\s+international\b|\binternational\s+(use|usage|transactions?|enabled)\b|\btravel\b/i.test(text))
      record({ allowIntlTxn: 'Y' });
  }
  if (!has('pinPolicyRequired') && /\b(no|without)\s+pin\b/i.test(text)) record({ pinPolicyRequired: 'N' });
  if (!has('effectiveDate')) {
    const date = /\b(?:effective|starting|start|from|live|launch(?:ing)?)\s+(?:on\s+|from\s+)?(today|tomorrow|\d{4}-\d{2}-\d{2})\b/i.exec(text)?.[1];
    if (date) record(parseValue('effectiveDate', date, today));
  }
  return { values, fields };
}

/**
 * Collects choices from the user's messages for the current product request: the messages since the
 * previous "create a product" request (that one belonged to an earlier product), with later ones winning.
 */
export function collectProductPreferences(userMessages: string[], today = new Date()): ProductPreferences {
  let start = 0;
  for (let i = userMessages.length - 2; i >= 0; i--) {
    if (isCreateProductRequest(userMessages[i])) {
      start = i + 1;
      break;
    }
  }
  const merged: ProductPreferences = { values: {}, fields: [] };
  for (const text of userMessages.slice(start)) {
    const prefs = extractProductPreferences(text, today);
    Object.assign(merged.values, prefs.values);
    for (const f of prefs.fields) if (!merged.fields.includes(f)) merged.fields.push(f);
  }
  return merged;
}

/* ---------- Proposed configuration ---------- */

/** Rough units per USD so suggested limits and fees make sense in the product's currency. */
export const PER_USD: Record<string, number> = { BDT: 120, INR: 85, JPY: 150, SAR: 4, AED: 4, MYR: 5, SGD: 1, AUD: 1.5, CAD: 1.4, EUR: 1, GBP: 1, USD: 1 };

function roundNice(n: number): number {
  if (n < 10) return Math.round(n);
  const magnitude = 10 ** Math.floor(Math.log10(n) - 1);
  return Math.round(n / magnitude) * magnitude;
}

const inCurrency = (usd: number, currency: string) => roundNice(usd * (PER_USD[currency] ?? 1));

export const emptyLimit = (txnType = ''): TxnLimit => ({ txnType, perTxMin: null, perTxMax: null, dailyCount: null, dailyAmount: null, monthlyCount: null, monthlyAmount: null });

/** A cash withdrawal limit sized for the currency, segment and product type. */
function suggestCashLimit(currency: string, segment: MarketSegment, type: ProductType | ''): TxnLimit {
  const scale = (segment === 'COMMERCIAL' ? 3 : 1) * (type === 'PREPAID' ? 0.5 : type === 'CREDIT' ? 1.5 : 1);
  const amt = (usd: number) => inCurrency(usd * scale, currency);
  return { txnType: 'ATM_CWD', perTxMin: amt(1), perTxMax: amt(200), dailyCount: 5, dailyAmount: amt(500), monthlyCount: 60, monthlyAmount: amt(5000) };
}

export const emptyTier = (): FeeTier => ({ amountFrom: 0, amountTo: null, rate: null, minFee: null, maxFee: null, fixedFee: null, vatRate: null, vatIncluded: false });

export const emptyFee = (effectiveDate = ''): FeeRule => ({ feeType: '', title: '', effectiveDate, expiryDate: '', tiers: [emptyTier()] });

/** The two service fees every new product starts with. */
function defaultServiceFees(currency: string, effectiveDate: string): FeeRule[] {
  const vatRate = currency === HOME_CURRENCY ? 15 : null;
  const fee = (feeType: string, usd: number): FeeRule => ({
    feeType,
    title: SERVICE_FEE_TYPES[feeType],
    effectiveDate,
    expiryDate: '',
    tiers: [{ ...emptyTier(), fixedFee: inCurrency(usd, currency), vatRate }],
  });
  return [fee('ANNUAL_MAINTENANCE', 5), fee('ATM_CWD', 0.25)];
}

export interface DraftContext {
  createdBy?: string;
  today?: Date;
}

/**
 * The assistant's proposal: every mandatory field is filled except the scheme configuration,
 * the user's stated choices win, and dependent fields (settlement currency, limits, fees…) follow from them.
 */
export function buildProductDraft(preferences: Partial<ProductForm> = {}, { createdBy = '', today = new Date() }: DraftContext = {}): ProductForm {
  const p = preferences;
  const marketSegment = p.marketSegment ?? 'CONSUMER';
  const productType = p.productType ?? 'DEBIT';
  const currency = p.currency ?? HOME_CURRENCY;
  const intlSettlementCurrency = p.intlSettlementCurrency ?? 'USD';
  const effectiveDate = p.effectiveDate ?? toIsoDate(today);
  const pinPolicyRequired = p.pinPolicyRequired ?? 'Y';
  const quotaPolicyRequired = p.quotaPolicyRequired ?? 'N';
  const renewalType = p.renewalType ?? 'RENEWABLE';
  const typeWord = productType ? titleCase(productType) : 'Card';
  const allTxnTypes = Object.keys(TXN_TYPES);
  // `null` is a real choice ("not chosen") for these, so only a missing key falls back to the default.
  const keep = <K extends 'validityYears' | 'pinPolicyId' | 'quotaPolicyId' | 'reissuePolicyId'>(key: K, fallback: ProductForm[K]) => (key in p ? (p[key] as ProductForm[K]) : fallback);

  return {
    aspId: p.aspId ?? DEFAULT_ASP_ID,
    productName: p.productName ?? `${titleCase(marketSegment)} ${typeWord} Card`,
    shortDesc: p.shortDesc ?? `${typeWord} card for ${marketSegment === 'CONSUMER' ? 'individual customers' : 'business customers'}, issued in ${currency}.`,
    marketSegment,
    productType,
    currency,
    validityYears: keep('validityYears', 5),
    defaultName: p.defaultName ?? 'VALUED CUSTOMER',
    effectiveDate,
    allowDomesticTxn: p.allowDomesticTxn ?? 'Y',
    domesticSettlementCurrency: p.domesticSettlementCurrency ?? currency,
    allowIntlTxn: p.allowIntlTxn ?? 'Y',
    intlSettlementCurrency,
    intlUsage: p.intlUsage ?? 'ENABLED_BY_DEFAULT',
    pinPolicyRequired,
    pinPolicyId: keep('pinPolicyId', pinPolicyRequired === 'Y' ? PIN_POLICIES[0].id : null),
    quotaPolicyRequired,
    quotaPolicyId: keep('quotaPolicyId', quotaPolicyRequired === 'Y' ? QUOTA_POLICIES[0].id : null),
    renewalType,
    reissuePolicyId: keep('reissuePolicyId', renewalType === 'RENEWABLE' ? REISSUE_POLICIES[0].id : null),
    // Every transaction type is allowed and every country, currency and MCC is open until the user narrows them.
    domesticTxnTypes: p.domesticTxnTypes ?? allTxnTypes,
    intlTxnTypes: p.intlTxnTypes ?? allTxnTypes,
    countryControl: p.countryControl ?? control('ALLOW_ALL_EXCEPT', []),
    currencyControl: p.currencyControl ?? control('ALLOW_ALL_EXCEPT', []),
    mccControl: p.mccControl ?? control('ALLOW_ALL_EXCEPT', []),
    domesticLimits: p.domesticLimits ?? [suggestCashLimit(currency, marketSegment || 'CONSUMER', productType)],
    intlLimits: p.intlLimits ?? [suggestCashLimit(intlSettlementCurrency, marketSegment || 'CONSUMER', productType)],
    serviceFees: p.serviceFees ?? defaultServiceFees(currency, effectiveDate),
    domesticFees: p.domesticFees ?? [],
    intlFees: p.intlFees ?? [],
    // Scheme, BIN, card range and templates are always chosen by the user, never pre-selected.
    schemes: p.schemes ?? [emptyScheme()],
    createdBy: p.createdBy ?? createdBy,
  };
}

/** The Product Setup form's starting point: the user fills in the basics, and no limits or fees are suggested. */
export function blankProductForm(createdBy = ''): ProductForm {
  return buildProductDraft(
    {
      productName: '',
      shortDesc: '',
      marketSegment: '',
      productType: '',
      currency: '',
      validityYears: null,
      defaultName: '',
      effectiveDate: '',
      domesticSettlementCurrency: '',
      domesticLimits: [],
      intlLimits: [],
      serviceFees: [],
    },
    { createdBy },
  );
}

/* ---------- Validation ---------- */

export type ProductErrors = Partial<Record<string, string>>;

const CURRENCY_CODE = /^[A-Z]{3}$/;
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const negative = (v: number | null) => v !== null && (!Number.isFinite(v) || v < 0);
const notWhole = (v: number | null) => v !== null && (!Number.isInteger(v) || v < 0);

type LimitField = 'domesticLimits' | 'intlLimits';
type FeeField = 'serviceFees' | 'domesticFees' | 'intlFees';
export const FEE_FIELDS: FeeField[] = ['serviceFees', 'domesticFees', 'intlFees'];

function validateLimits(errors: ProductErrors, field: LimitField, rows: TxnLimit[]) {
  const seen = new Set<string>();
  rows.forEach((row, i) => {
    const key = (name: keyof TxnLimit) => `${field}.${i}.${name}`;
    if (!row.txnType) errors[key('txnType')] = 'Choose a transaction type.';
    else if (seen.has(row.txnType)) errors[key('txnType')] = 'This transaction type already has a limit.';
    else seen.add(row.txnType);
    for (const name of ['perTxMin', 'perTxMax', 'dailyAmount', 'monthlyAmount'] as const) if (negative(row[name])) errors[key(name)] = 'Must be 0 or more.';
    for (const name of ['dailyCount', 'monthlyCount'] as const) if (notWhole(row[name])) errors[key(name)] = 'Must be a whole number.';
    const below = (low: keyof TxnLimit, high: keyof TxnLimit, message: string) => {
      const a = row[low] as number | null;
      const b = row[high] as number | null;
      if (a !== null && b !== null && b < a && !errors[key(high)]) errors[key(high)] = message;
    };
    below('perTxMin', 'perTxMax', 'Must be at least the minimum.');
    below('perTxMax', 'dailyAmount', 'Below the per-transaction maximum.');
    below('dailyAmount', 'monthlyAmount', 'Below the daily amount.');
    below('dailyCount', 'monthlyCount', 'Below the daily count.');
  });
}

function validateFees(errors: ProductErrors, field: FeeField, fees: FeeRule[]) {
  const seen = new Set<string>();
  fees.forEach((fee, i) => {
    const key = (name: string) => `${field}.${i}.${name}`;
    if (!fee.feeType) errors[key('feeType')] = field === 'serviceFees' ? 'Service type is required.' : 'Transaction type is required.';
    else if (seen.has(fee.feeType)) errors[key('feeType')] = 'This fee is already added.';
    else seen.add(fee.feeType);
    if (!fee.title.trim()) errors[key('title')] = 'Policy title is required.';
    if (!isDate(fee.effectiveDate)) errors[key('effectiveDate')] = 'Effective date is required.';
    if (fee.expiryDate && (!isDate(fee.expiryDate) || fee.expiryDate <= fee.effectiveDate)) errors[key('expiryDate')] = 'Must be after the effective date.';
    if (!fee.tiers.length) errors[key('tiers')] = 'Add at least one fee tier.';
    fee.tiers.forEach((t, j) => {
      const tier = (name: keyof FeeTier) => key(`tiers.${j}.${name}`);
      for (const name of ['amountFrom', 'amountTo', 'minFee', 'maxFee', 'fixedFee'] as const) if (negative(t[name])) errors[tier(name)] = 'Must be 0 or more.';
      for (const name of ['rate', 'vatRate'] as const) if (negative(t[name]) || (t[name] ?? 0) > 100) errors[tier(name)] = 'Between 0 and 100.';
      if (t.amountFrom !== null && t.amountTo !== null && t.amountTo <= t.amountFrom && !errors[tier('amountTo')]) errors[tier('amountTo')] = 'Must be above the starting amount.';
      if (t.minFee !== null && t.maxFee !== null && t.maxFee < t.minFee && !errors[tier('maxFee')]) errors[tier('maxFee')] = 'Must be at least the minimum.';
      if (t.fixedFee === null && t.rate === null) errors[tier('fixedFee')] = 'Enter a fixed fee or a rate.';
    });
  });
}

function validateControl(errors: ProductErrors, field: 'countryControl' | 'currencyControl' | 'mccControl', c: AccessControl, noun: string) {
  if (c.mode === 'DISALLOW_ALL_EXCEPT' && !c.exceptions.length) errors[field] = `Choose at least one ${noun} to allow, or switch to Allow All Except.`;
}

export function validateProduct(form: ProductForm): ProductErrors {
  const errors: ProductErrors = {};
  // Basics
  if (!form.productName.trim()) errors.productName = 'Product name is required.';
  if (!form.marketSegment) errors.marketSegment = 'Choose a market segment.';
  if (!form.productType) errors.productType = 'Choose a product type.';
  if (!CURRENCY_CODE.test(form.currency)) errors.currency = 'Choose the account currency.';
  if (form.validityYears === null || !Number.isInteger(form.validityYears) || form.validityYears <= 0) errors.validityYears = 'Choose the card validity.';
  if (!isDate(form.effectiveDate)) errors.effectiveDate = 'Choose the live-from date.';
  if (!form.aspId.trim() || form.aspId.length > 15) errors.aspId = 'ASP ID must be 1–15 characters.';
  if (form.allowDomesticTxn === 'N' && form.allowIntlTxn === 'N') errors.allowDomesticTxn = 'Allow domestic or international transactions.';
  if (form.allowDomesticTxn === 'Y' && !CURRENCY_CODE.test(form.domesticSettlementCurrency)) errors.domesticSettlementCurrency = 'Choose a settlement currency.';
  if (form.allowIntlTxn === 'Y' && !CURRENCY_CODE.test(form.intlSettlementCurrency)) errors.intlSettlementCurrency = 'Choose a settlement currency.';
  // Policies
  if (form.pinPolicyRequired === 'Y' && form.pinPolicyId === null) errors.pinPolicyId = 'Choose a PIN policy.';
  if (form.quotaPolicyRequired === 'Y' && form.quotaPolicyId === null) errors.quotaPolicyId = 'Choose a quota policy.';
  if (form.renewalType === 'RENEWABLE' && form.reissuePolicyId === null) errors.reissuePolicyId = 'Choose a renewal policy.';
  // Permissions
  if (form.allowDomesticTxn === 'Y' && !form.domesticTxnTypes.length) errors.domesticTxnTypes = 'Choose at least one transaction type.';
  if (form.allowIntlTxn === 'Y' && !form.intlTxnTypes.length) errors.intlTxnTypes = 'Choose at least one transaction type.';
  validateControl(errors, 'countryControl', form.countryControl, 'country');
  validateControl(errors, 'currencyControl', form.currencyControl, 'currency');
  validateControl(errors, 'mccControl', form.mccControl, 'MCC');
  // Limits
  if (form.allowDomesticTxn === 'Y') validateLimits(errors, 'domesticLimits', form.domesticLimits);
  if (form.allowIntlTxn === 'Y') validateLimits(errors, 'intlLimits', form.intlLimits);
  // Fees
  validateFees(errors, 'serviceFees', form.serviceFees);
  if (form.allowDomesticTxn === 'Y') validateFees(errors, 'domesticFees', form.domesticFees);
  if (form.allowIntlTxn === 'Y') validateFees(errors, 'intlFees', form.intlFees);
  // Schemes
  validateSchemes(errors, form.schemes);
  return errors;
}

/** A draft only needs a name, so it can be found again. */
export function validateDraft(form: ProductForm): ProductErrors {
  return form.productName.trim() ? {} : { productName: 'Enter a product name to save a draft.' };
}

/* ---------- Progress ---------- */

export interface SetupProgress {
  done: number;
  total: number;
}

/**
 * Counts the things a product needs before it can be submitted and how many are in place.
 * Every scheme, BIN row, limit, fee and switched-on option adds items, so progress moves both ways as the user fills in or clears data.
 */
export function productProgress(form: ProductForm): SetupProgress {
  const errorKeys = Object.keys(validateProduct(form));
  const keys = ['productName', 'productType', 'currency', 'validityYears', 'effectiveDate', 'allowDomesticTxn', 'countryControl', 'currencyControl', 'mccControl'];
  if (form.allowDomesticTxn === 'Y') {
    keys.push('domesticSettlementCurrency', 'domesticTxnTypes', ...form.domesticLimits.map((_, i) => `domesticLimits.${i}`), ...form.domesticFees.map((_, i) => `domesticFees.${i}`));
  }
  if (form.allowIntlTxn === 'Y') keys.push('intlSettlementCurrency', 'intlTxnTypes', ...form.intlLimits.map((_, i) => `intlLimits.${i}`), ...form.intlFees.map((_, i) => `intlFees.${i}`));
  if (form.pinPolicyRequired === 'Y') keys.push('pinPolicyId');
  if (form.quotaPolicyRequired === 'Y') keys.push('quotaPolicyId');
  if (form.renewalType === 'RENEWABLE') keys.push('reissuePolicyId');
  keys.push(...form.serviceFees.map((_, i) => `serviceFees.${i}`));
  form.schemes.forEach((scheme, i) => {
    keys.push(`schemes.${i}.schemeId`, `schemes.${i}.templates`);
    scheme.ranges.forEach((_, j) => keys.push(`schemes.${i}.ranges.${j}.binId`, `schemes.${i}.ranges.${j}.cardRangeId`));
  });
  const ok = (key: string) => !errorKeys.some((k) => k === key || k.startsWith(`${key}.`));
  return { done: keys.filter(ok).length, total: keys.length };
}

/**
 * Progress while the basics are being answered. Only the answered basics count as done;
 * the rest of the setup is sized from the draft the assistant would prepare next.
 */
export function basicsProgress(basics: ProductBasics, preferences: Partial<ProductForm>): SetupProgress {
  const { total } = productProgress(buildProductDraft({ ...preferences, ...Object.fromEntries(Object.entries(basics).filter(([, v]) => v)) }));
  return { done: BASIC_FIELDS.filter((f) => basics[f] !== '').length, total };
}

/* ---------- Names for display ---------- */

export const txnTypeName = (code: string) => TXN_TYPES[code] ?? code;
export const feeTypeName = (field: FeeField, code: string) => (field === 'serviceFees' ? SERVICE_FEE_TYPES[code] : TXN_TYPES[code]) ?? code;
export const policyName = (items: { id: number; name: string }[], id: number | null) => items.find((i) => i.id === id)?.name;
export const countryName = (code: string) => COUNTRIES[code] ?? code;
export const mccName = (code: string) => (MCCS[code] ? `${code} · ${MCCS[code]}` : code);

export function describeControl(c: AccessControl, all: string, name: (code: string) => string = (code) => code): string {
  if (!c.exceptions.length) return c.mode === 'ALLOW_ALL_EXCEPT' ? `All ${all} allowed` : `No ${all} allowed`;
  const list = c.exceptions.map(name).join(', ');
  return c.mode === 'ALLOW_ALL_EXCEPT' ? `All ${all} except ${list}` : `Only ${list}`;
}

/* ---------- Text for the chat ---------- */

/** Human-readable value of a field the user named, for "I'll also use" summaries. */
export function describeValue(field: ProductField, form: ProductForm): string {
  const value = form[field];
  if (field === 'countryControl') return describeControl(form.countryControl, 'countries', countryName);
  if (field === 'currencyControl') return describeControl(form.currencyControl, 'currencies');
  if (field === 'mccControl') return describeControl(form.mccControl, 'MCCs', mccName);
  if (field === 'validityYears') return value === null ? '—' : `${value} year${value === 1 ? '' : 's'}`;
  if (Array.isArray(value)) return value.length ? value.map((v) => (typeof v === 'object' ? '…' : String(v))).join(', ') : 'none';
  if (value === null || value === '') return '—';
  if (value === 'Y') return field.endsWith('Required') ? 'Required' : 'Allowed';
  if (value === 'N') return field.endsWith('Required') ? 'Not required' : 'Not allowed';
  if (typeof value === 'string' && /^[A-Z_]+$/.test(value) && value.length > 3) return titleCase(value);
  return String(value);
}

export function basicsIntroText(preferences: ProductPreferences): string {
  const form = buildProductDraft(preferences.values);
  const used = preferences.fields.filter((f) => f in FIELD_LABELS);
  const lines = [
    "Let's create a new card product. First, choose the **product type**, **account currency** and **market segment**. I'll use them to prepare the rest of the setup for you to review.",
  ];
  if (used.length) lines.push('', "**I'll also use what you told me:**", ...used.map((f) => `- ${FIELD_LABELS[f]}: **${describeValue(f, form)}**`));
  return lines.join('\n');
}

function summaryRows(form: ProductForm, productId: string): string[] {
  return [
    `- Product ID: **${productId}**`,
    `- Name: **${form.productName.trim() || 'Untitled product'}**`,
    `- Type: ${form.productType ? titleCase(form.productType) : '—'} · ${titleCase(form.marketSegment)} · ${form.currency}`,
    `- Live from: ${form.effectiveDate || '—'}`,
    `- Schemes: ${form.schemes.map((s) => schemeName(s.schemeId)).filter(Boolean).join(', ') || '—'}`,
  ];
}

export function submittedSummaryText(form: ProductForm, productId: string): string {
  return [
    '📨 The card product has been **submitted** and is now **Pending approval**.',
    '',
    ...summaryRows(form, productId),
    '',
    'An approver needs to review and approve it before it can be used. Open the product details from the card above to follow its status.',
  ].join('\n');
}

export function draftSavedText(form: ProductForm, productId: string): string {
  return ['💾 The card product has been **saved as a draft**. Nothing has been submitted yet.', '', ...summaryRows(form, productId), '', 'Open the draft product form from the card above whenever you want to finish and submit it.'].join(
    '\n',
  );
}

/* ---------- Restoring saved data ---------- */

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const numOrNull = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const strList = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : undefined);
const idOrNull = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) ? v : null);
const str = (v: unknown) => (typeof v === 'string' ? v : '');

function parseLimits(v: unknown): TxnLimit[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v.filter(isObj).map((r) => ({
    txnType: str(r.txnType),
    perTxMin: numOrNull(r.perTxMin),
    perTxMax: numOrNull(r.perTxMax),
    dailyCount: numOrNull(r.dailyCount),
    dailyAmount: numOrNull(r.dailyAmount),
    monthlyCount: numOrNull(r.monthlyCount),
    monthlyAmount: numOrNull(r.monthlyAmount),
  }));
}

function parseFees(v: unknown): FeeRule[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v.filter(isObj).map((r) => ({
    feeType: str(r.feeType),
    title: str(r.title),
    effectiveDate: str(r.effectiveDate),
    expiryDate: str(r.expiryDate),
    tiers: Array.isArray(r.tiers)
      ? r.tiers.filter(isObj).map((t) => ({
          amountFrom: numOrNull(t.amountFrom),
          amountTo: numOrNull(t.amountTo),
          rate: numOrNull(t.rate),
          minFee: numOrNull(t.minFee),
          maxFee: numOrNull(t.maxFee),
          fixedFee: numOrNull(t.fixedFee),
          vatRate: numOrNull(t.vatRate),
          vatIncluded: t.vatIncluded === true,
        }))
      : [],
  }));
}

function parseControl(v: unknown): AccessControl | undefined {
  if (!isObj(v) || !CONTROL_MODES.includes(v.mode as ControlMode)) return undefined;
  return { mode: v.mode as ControlMode, exceptions: strList(v.exceptions) ?? [] };
}

/** Keeps only the well-formed fields of a stored (partial) form. Fields from older versions are dropped. */
export function parseProductPreferences(raw: unknown): Partial<ProductForm> {
  if (!isObj(raw)) return {};
  const text = (k: ProductField) => (typeof raw[k] === 'string' ? (raw[k] as string) : undefined);
  const oneOf = <T extends string>(k: ProductField, options: readonly T[]) => (options.includes(raw[k] as T) ? (raw[k] as T) : undefined);
  const yn = (k: ProductField) => oneOf<YesNo>(k, ['Y', 'N']);
  const id = (k: ProductField) => (k in raw ? idOrNull(raw[k]) : undefined);
  const p: Partial<ProductForm> = {
    aspId: text('aspId'),
    productName: text('productName'),
    shortDesc: text('shortDesc'),
    marketSegment: raw.marketSegment === '' ? '' : oneOf('marketSegment', MARKET_SEGMENTS),
    productType: raw.productType === '' ? '' : oneOf('productType', PRODUCT_TYPES),
    currency: text('currency'),
    validityYears: 'validityYears' in raw ? numOrNull(raw.validityYears) : undefined,
    defaultName: text('defaultName'),
    effectiveDate: text('effectiveDate'),
    allowDomesticTxn: yn('allowDomesticTxn'),
    domesticSettlementCurrency: text('domesticSettlementCurrency'),
    allowIntlTxn: yn('allowIntlTxn'),
    intlSettlementCurrency: text('intlSettlementCurrency'),
    intlUsage: oneOf('intlUsage', INTL_USAGES),
    pinPolicyRequired: yn('pinPolicyRequired'),
    pinPolicyId: id('pinPolicyId'),
    quotaPolicyRequired: yn('quotaPolicyRequired'),
    quotaPolicyId: id('quotaPolicyId'),
    renewalType: oneOf('renewalType', RENEWAL_TYPES),
    reissuePolicyId: id('reissuePolicyId'),
    domesticTxnTypes: strList(raw.domesticTxnTypes),
    intlTxnTypes: strList(raw.intlTxnTypes),
    countryControl: parseControl(raw.countryControl),
    currencyControl: parseControl(raw.currencyControl),
    mccControl: parseControl(raw.mccControl),
    domesticLimits: parseLimits(raw.domesticLimits),
    intlLimits: parseLimits(raw.intlLimits),
    serviceFees: parseFees(raw.serviceFees),
    domesticFees: parseFees(raw.domesticFees),
    intlFees: parseFees(raw.intlFees),
    schemes: Array.isArray(raw.schemes)
      ? raw.schemes.filter(isObj).map((r) => ({
          schemeId: idOrNull(r.schemeId),
          namedTemplateId: idOrNull(r.namedTemplateId),
          anonymousTemplateId: idOrNull(r.anonymousTemplateId),
          ranges: Array.isArray(r.ranges) ? r.ranges.filter(isObj).map((x) => ({ binId: idOrNull(x.binId), cardRangeId: idOrNull(x.cardRangeId) })) : [],
        }))
      : undefined,
    createdBy: text('createdBy'),
  };
  return Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined)) as Partial<ProductForm>;
}

/** Validates a stored form field by field; anything unusable falls back to the default proposal. */
export function parseProductForm(raw: unknown): ProductForm | null {
  if (!isObj(raw)) return null;
  const parsed = parseProductPreferences(raw);
  return buildProductDraft(parsed);
}

export function parseBasics(raw: unknown): ProductBasics {
  const r = isObj(raw) ? raw : {};
  return {
    productType: PRODUCT_TYPES.includes(r.productType as ProductType) ? (r.productType as ProductType) : '',
    currency: typeof r.currency === 'string' ? r.currency : '',
    marketSegment: MARKET_SEGMENTS.includes(r.marketSegment as MarketSegment) ? (r.marketSegment as MarketSegment) : '',
  };
}

/* ---------- Product basics (asked first) ---------- */

export const BASIC_FIELDS = ['productType', 'currency', 'marketSegment'] as const;

/** Pre-fills the basics questions with anything the user already said; the rest stays empty. */
export function basicsFromPreferences(p: Partial<ProductForm>): ProductBasics {
  return { productType: p.productType ?? '', currency: p.currency ?? '', marketSegment: p.marketSegment ?? '' };
}

export function validateBasics(b: ProductBasics): ProductErrors {
  const errors: ProductErrors = {};
  if (!b.productType) errors.productType = 'Choose a product type.';
  if (!CURRENCY_CODE.test(b.currency)) errors.currency = 'Choose the account currency.';
  if (!b.marketSegment) errors.marketSegment = 'Choose a market segment.';
  return errors;
}

/* ---------- Scheme configuration (chosen by the user) ---------- */

export const emptyScheme = (): SchemeConfig => ({ schemeId: null, namedTemplateId: null, anonymousTemplateId: null, ranges: [{ binId: null, cardRangeId: null }] });

export const binsForScheme = (schemeId: number | null) => BINS.filter((b) => b.schemeId === schemeId);
export const rangesForBin = (binId: number | null) => CARD_RANGES.filter((r) => r.binId === binId);
export const templatesFor = (schemeId: number | null, kind: 'NAMED' | 'ANONYMOUS') => CARD_TEMPLATES.filter((t) => t.schemeId === schemeId && t.kind === kind);
export const schemeName = (id: number | null) => SCHEMES.find((s) => s.id === id)?.name;
export const binName = (id: number | null) => BINS.find((b) => b.id === id)?.name;
export const rangeName = (id: number | null) => CARD_RANGES.find((r) => r.id === id)?.name;
export const templateName = (id: number | null) => CARD_TEMPLATES.find((t) => t.id === id)?.name;

function validateSchemes(errors: ProductErrors, schemes: SchemeConfig[]) {
  if (!schemes.length) {
    errors.schemes = 'Add at least one scheme.';
    return;
  }
  const seenSchemes = new Set<number>();
  const seenRanges = new Set<number>();
  schemes.forEach((s, i) => {
    const key = (name: string) => `schemes.${i}.${name}`;
    if (s.schemeId === null) errors[key('schemeId')] = 'Select a scheme.';
    else if (seenSchemes.has(s.schemeId)) errors[key('schemeId')] = 'This scheme is already configured above.';
    else seenSchemes.add(s.schemeId);
    if (s.namedTemplateId === null && s.anonymousTemplateId === null) errors[key('templates')] = 'Select at least one Named Card or Anonymous Card template.';
    if (!s.ranges.length) errors[key('ranges')] = 'Add at least one BIN and card range.';
    s.ranges.forEach((r, j) => {
      if (r.binId === null) errors[key(`ranges.${j}.binId`)] = 'Select a BIN.';
      if (r.cardRangeId === null) errors[key(`ranges.${j}.cardRangeId`)] = 'Select a BIN range.';
      else if (seenRanges.has(r.cardRangeId)) errors[key(`ranges.${j}.cardRangeId`)] = 'This range is already mapped.';
      else seenRanges.add(r.cardRangeId);
    });
  });
}

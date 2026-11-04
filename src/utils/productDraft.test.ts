import { describe, expect, it } from 'vitest';
import {
  basicsFromPreferences,
  basicsProgress,
  buildProductDraft,
  collectProductPreferences,
  extractProductPreferences,
  isCreateProductRequest,
  parseProductForm,
  productProgress,
  stepOfKey,
  validateBasics,
  validateDraft,
  validateProduct,
} from './productDraft';
import type { ProductForm } from '../types/product';
import { matchScenario } from './mockResponses';

const today = new Date(2026, 9, 28);

/** The scheme section is never pre-filled, so tests choose one like a user would. */
const withScheme = (form: ProductForm): ProductForm => ({
  ...form,
  schemes: [{ schemeId: 5, namedTemplateId: 101, anonymousTemplateId: null, ranges: [{ binId: 14, cardRangeId: 33 }] }],
});

describe('isCreateProductRequest', () => {
  it.each(['Create a Product', 'create product', 'Please set up a new prepaid card product', 'Onboard a product named Gold', 'I want to add a new product'])('detects %s', (p) =>
    expect(isCreateProductRequest(p)).toBe(true),
  );
  it.each(['What products do you support?', 'Hello', 'Write a TypeScript debounce function'])('ignores %s', (p) => expect(isCreateProductRequest(p)).toBe(false));
  it('wins over other scenarios', () => {
    expect(matchScenario('Create a product').scenario?.id).toBe('createProduct');
    expect(matchScenario('Help me plan and create a product launch').scenario?.id).toBe('createProduct');
  });
});

describe('extractProductPreferences', () => {
  it('finds nothing in a bare request', () => {
    expect(extractProductPreferences('Create a Product', today)).toEqual({ values: {}, fields: [] });
  });

  it('reads "Label: value" pairs', () => {
    const { values, fields } = extractProductPreferences('Create a product with Product Name: Platinum Product', today);
    expect(values).toEqual({ productName: 'Platinum Product' });
    expect(fields).toEqual(['productName']);
  });

  it('reads several labels in one sentence and stops each value at the next clause', () => {
    const { values } = extractProductPreferences(
      'Create a product with Product Name: Platinum Product, currency: USD, market segment: commercial and quota policy: required; validity: 3 years. Live from: 2026-12-01',
      today,
    );
    expect(values).toMatchObject({ productName: 'Platinum Product', currency: 'USD', marketSegment: 'COMMERCIAL', quotaPolicyRequired: 'Y', validityYears: 3, effectiveDate: '2026-12-01' });
  });

  it('understands plain wording', () => {
    const { values } = extractProductPreferences('Create a prepaid product called Student Saver in BDT with international transactions, valid for 24 months', today);
    expect(values).toMatchObject({ productName: 'Student Saver', productType: 'PREPAID', currency: 'BDT', allowIntlTxn: 'Y', validityYears: 2 });
  });

  it('turns country, currency and MCC lists into access controls', () => {
    const { values } = extractProductPreferences('Countries: Bangladesh, India\nPIN required: no\nBlocked currencies: AUD, EUR\nBlocked MCCs: 7995', today);
    expect(values).toMatchObject({
      countryControl: { mode: 'DISALLOW_ALL_EXCEPT', exceptions: ['BGD', 'IND'] },
      currencyControl: { mode: 'ALLOW_ALL_EXCEPT', exceptions: ['AUD', 'EUR'] },
      mccControl: { mode: 'ALLOW_ALL_EXCEPT', exceptions: ['7995'] },
      pinPolicyRequired: 'N',
    });
  });
});

describe('collectProductPreferences', () => {
  it('remembers choices from earlier messages, with later ones winning', () => {
    const prefs = collectProductPreferences(['Product name should be Gold Plus', 'Currency: USD', 'Actually currency: EUR', 'Create a product'], today);
    expect(prefs.values).toMatchObject({ productName: 'Gold Plus', currency: 'EUR' });
  });

  it('does not reuse choices that belonged to an earlier product', () => {
    const prefs = collectProductPreferences(['Create a product named Gold', 'Create a product'], today);
    expect(prefs.values).toEqual({});
  });
});

describe('buildProductDraft', () => {
  const draft = buildProductDraft({}, { today, createdBy: 'Demo User' });

  it('turns on domestic and international transactions with PIN required and quota not required', () => {
    expect(draft).toMatchObject({
      productName: 'Consumer Debit Card',
      currency: 'BDT',
      validityYears: 5,
      effectiveDate: '2026-10-28',
      allowDomesticTxn: 'Y',
      allowIntlTxn: 'Y',
      intlSettlementCurrency: 'USD',
      pinPolicyRequired: 'Y',
      quotaPolicyRequired: 'N',
      renewalType: 'RENEWABLE',
      createdBy: 'Demo User',
    });
  });

  it('allows every transaction type and leaves countries, currencies and MCCs open', () => {
    expect(draft.domesticTxnTypes.length).toBeGreaterThan(3);
    expect(draft.intlTxnTypes).toEqual(draft.domesticTxnTypes);
    for (const c of [draft.countryControl, draft.currencyControl, draft.mccControl]) expect(c).toEqual({ mode: 'ALLOW_ALL_EXCEPT', exceptions: [] });
  });

  it('imposes one domestic and one international limit, in each settlement currency', () => {
    expect(draft.domesticLimits).toHaveLength(1);
    expect(draft.intlLimits).toHaveLength(1);
    expect(draft.domesticLimits[0].perTxMax).toBeGreaterThan(draft.intlLimits[0].perTxMax!);
  });

  it('starts with exactly two service fees: annual maintenance and ATM cash withdrawal', () => {
    expect(draft.serviceFees.map((f) => f.title)).toEqual(['Card Annual Maintenance Fee', 'ATM Cash Withdrawal Fee']);
    expect(draft.serviceFees.every((f) => f.effectiveDate === '2026-10-28' && f.tiers[0].fixedFee! > 0)).toBe(true);
    expect(draft.domesticFees).toEqual([]);
    expect(draft.intlFees).toEqual([]);
  });

  it('never pre-selects scheme, BIN, card range or templates, and requires them', () => {
    expect(draft.schemes).toEqual([{ schemeId: null, namedTemplateId: null, anonymousTemplateId: null, ranges: [{ binId: null, cardRangeId: null }] }]);
    expect(Object.keys(validateProduct(draft)).sort()).toEqual(['schemes.0.ranges.0.binId', 'schemes.0.ranges.0.cardRangeId', 'schemes.0.schemeId', 'schemes.0.templates']);
    expect(validateProduct(withScheme(draft))).toEqual({});
  });

  it("uses the user's choices and derives dependent fields from them", () => {
    const d = buildProductDraft({ productName: 'Platinum Product', currency: 'USD', allowIntlTxn: 'N' }, { today });
    expect(d.productName).toBe('Platinum Product');
    expect(d.domesticSettlementCurrency).toBe('USD');
    expect(d.serviceFees[0].tiers[0].vatRate).toBeNull();
    expect(validateProduct(withScheme(d))).toEqual({});
  });
});

describe('validateProduct', () => {
  const draft = withScheme(buildProductDraft({}, { today }));

  it('requires the mandatory basics and at least one transaction scope', () => {
    const errors = validateProduct({ ...draft, productName: ' ', validityYears: null, effectiveDate: '', allowDomesticTxn: 'N', allowIntlTxn: 'N' });
    expect(Object.keys(errors).sort()).toEqual(['allowDomesticTxn', 'effectiveDate', 'productName', 'validityYears']);
  });

  it('requires a policy when PIN, quota or renewal is switched on', () => {
    const errors = validateProduct({ ...draft, pinPolicyId: null, quotaPolicyRequired: 'Y', quotaPolicyId: null, reissuePolicyId: null });
    expect(Object.keys(errors).sort()).toEqual(['pinPolicyId', 'quotaPolicyId', 'reissuePolicyId']);
    expect(validateProduct({ ...draft, pinPolicyRequired: 'N', pinPolicyId: null, renewalType: 'ONE_TIME', reissuePolicyId: null })).toEqual({});
  });

  it('needs at least one exception when only listed items are allowed', () => {
    expect(validateProduct({ ...draft, countryControl: { mode: 'DISALLOW_ALL_EXCEPT', exceptions: [] } })).toHaveProperty('countryControl');
    expect(validateProduct({ ...draft, domesticTxnTypes: [] })).toHaveProperty('domesticTxnTypes');
  });

  it('checks limit rows', () => {
    const row = { ...draft.domesticLimits[0], perTxMin: 500, perTxMax: 100 };
    expect(validateProduct({ ...draft, domesticLimits: [row] })).toHaveProperty(['domesticLimits.0.perTxMax']);
    expect(validateProduct({ ...draft, domesticLimits: [draft.domesticLimits[0], draft.domesticLimits[0]] })).toHaveProperty(['domesticLimits.1.txnType']);
  });

  it('checks fees: type, title, dates and a charge on every tier', () => {
    const fee = { feeType: '', title: '', effectiveDate: '', expiryDate: '', tiers: [{ ...draft.serviceFees[0].tiers[0], fixedFee: null, rate: null }] };
    expect(Object.keys(validateProduct({ ...draft, serviceFees: [fee] })).sort()).toEqual([
      'serviceFees.0.effectiveDate',
      'serviceFees.0.feeType',
      'serviceFees.0.tiers.0.fixedFee',
      'serviceFees.0.title',
    ]);
    expect(validateProduct({ ...draft, serviceFees: [{ ...draft.serviceFees[0], expiryDate: '2026-01-01' }] })).toHaveProperty(['serviceFees.0.expiryDate']);
  });

  it('skips sections that are switched off', () => {
    expect(validateProduct({ ...draft, allowIntlTxn: 'N', intlTxnTypes: [], intlLimits: [{ ...draft.intlLimits[0], txnType: '' }] })).toEqual({});
  });

  it('rejects a duplicate scheme or card range', () => {
    const errors = validateProduct({ ...draft, schemes: [draft.schemes[0], { ...draft.schemes[0] }] });
    expect(errors).toHaveProperty(['schemes.1.schemeId']);
    expect(errors).toHaveProperty(['schemes.1.ranges.0.cardRangeId']);
  });

  it('maps each error to its step', () => {
    expect(['productName', 'pinPolicyId', 'mccControl', 'intlLimits.0.perTxMax', 'serviceFees.1.tiers.0.rate', 'schemes.0.templates'].map(stepOfKey)).toEqual([
      'basics',
      'policies',
      'permissions',
      'limits',
      'fees',
      'schemes',
    ]);
  });

  it('only needs a name to save a draft', () => {
    expect(validateDraft(buildProductDraft({}, { today }))).toEqual({});
    expect(validateDraft({ ...draft, productName: '' })).toHaveProperty('productName');
  });
});

describe('progress', () => {
  it('rises as the user fills things in and falls as they clear or add them', () => {
    const draft = buildProductDraft({ productName: 'Gold' }, { today });
    const start = productProgress(draft);
    expect(start.done).toBe(start.total - 4); // scheme, template, BIN and BIN range are left to the user

    const filled = productProgress(withScheme(draft));
    expect(filled).toEqual({ done: start.total, total: start.total });
    expect(productProgress({ ...withScheme(draft), productName: '' }).done).toBe(filled.done - 1);

    // A new empty BIN row adds two items to do; a new empty fee adds one.
    const scheme = withScheme(draft).schemes[0];
    expect(productProgress({ ...draft, schemes: [{ ...scheme, ranges: [...scheme.ranges, { binId: null, cardRangeId: null }] }] })).toEqual({ done: filled.total, total: filled.total + 2 });
    const withFee = withScheme({ ...draft, serviceFees: [...draft.serviceFees, { ...draft.serviceFees[0], feeType: '' }] });
    expect(productProgress(withFee)).toEqual({ done: filled.total, total: filled.total + 1 });
  });

  it('counts only the answered basics before the setup is prepared', () => {
    const empty = basicsProgress({ productType: '', currency: '', marketSegment: '' }, {});
    expect(empty.done).toBe(0);
    expect(basicsProgress({ productType: 'PREPAID', currency: 'USD', marketSegment: '' }, {})).toEqual({ done: 2, total: empty.total });
  });
});

describe('product basics', () => {
  it('pre-fills only what the user said and requires all three', () => {
    const basics = basicsFromPreferences(extractProductPreferences('Create a prepaid product', today).values);
    expect(basics).toEqual({ productType: 'PREPAID', currency: '', marketSegment: '' });
    expect(Object.keys(validateBasics(basics)).sort()).toEqual(['currency', 'marketSegment']);
  });
});

describe('parseProductForm', () => {
  it('restores valid fields, keeps cleared choices and replaces invalid ones with defaults', () => {
    const form = parseProductForm({ productName: 'Saved', currency: 'USD', renewalType: 'NOPE', pinPolicyId: null, serviceFees: [], formFactor: 'VIRTUAL' })!;
    expect(form).toMatchObject({ productName: 'Saved', currency: 'USD', renewalType: 'RENEWABLE', pinPolicyId: null, serviceFees: [] });
    expect(form).not.toHaveProperty('formFactor');
    expect(parseProductForm('junk')).toBeNull();
  });
});

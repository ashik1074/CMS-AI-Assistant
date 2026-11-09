import { describe, expect, it } from 'vitest';
import { answerFieldQuestion, describeFieldValue, suggestField } from './fieldAssist';
import { blankProductForm, emptyFee, emptyLimit, emptyScheme, validateProduct } from './productDraft';
import type { ProductForm } from '../types/product';

const today = new Date(2026, 10, 9);
const prepaid = (): ProductForm => ({ ...blankProductForm('Tester'), productName: 'Smart Prepaid', marketSegment: 'CONSUMER', productType: 'PREPAID', currency: 'BDT' });

function filled(form: ProductForm, key: string) {
  const s = suggestField(form, key, today);
  if (!s.ok) throw new Error(s.reason);
  return s;
}

describe('suggestField', () => {
  it('suggests basics from the rest of the form', () => {
    const form = prepaid();
    expect(filled({ ...form, productName: '' }, 'productName').form.productName).toBe('Consumer Prepaid Card');
    expect(filled(form, 'validityYears').form.validityYears).toBe(3);
    expect(filled(form, 'defaultName').form.defaultName).toBe('PREPAID CARDHOLDER');
    expect(filled(form, 'effectiveDate')).toMatchObject({ display: '01-Dec-2026' });
    expect(filled(form, 'intlUsage').form.intlUsage).toBe('DISABLED_BY_DEFAULT');
    expect(filled(form, 'reissuePolicyId').display).toBe('Renew on Request');
  });

  it('reads the type and segment from the product name', () => {
    const form = { ...blankProductForm(), productName: 'Corporate Credit Card' };
    expect(filled(form, 'productType').form.productType).toBe('CREDIT');
    expect(filled(form, 'marketSegment').form.marketSegment).toBe('COMMERCIAL');
  });

  it('gives a different name each time it is asked again', () => {
    const first = filled({ ...prepaid(), productName: '' }, 'productName').form;
    const second = filled(first, 'productName').form;
    expect(second.productName).not.toBe(first.productName);
  });

  it('keeps a suggested limit consistent with the rest of the row', () => {
    const form = { ...prepaid(), domesticLimits: [{ ...emptyLimit('ATM_CWD'), perTxMax: 100 }] };
    const s = filled(form, 'domesticLimits.0.perTxMin');
    expect(s.form.domesticLimits[0].perTxMin).toBeLessThanOrEqual(100);
    const daily = filled(s.form, 'domesticLimits.0.dailyAmount').form;
    expect(validateProduct(daily)['domesticLimits.0.dailyAmount']).toBeUndefined();
  });

  it('suggests a transaction type that has no limit yet', () => {
    const form = { ...prepaid(), domesticLimits: [emptyLimit('ATM_CWD'), emptyLimit()] };
    expect(filled(form, 'domesticLimits.1.txnType').form.domesticLimits[1].txnType).toBe('POS');
  });

  it('fills in fees with the fee type, title and VAT', () => {
    const form = { ...prepaid(), serviceFees: [emptyFee()] };
    const typed = filled(form, 'serviceFees.0.feeType').form;
    expect(typed.serviceFees[0]).toMatchObject({ feeType: 'ANNUAL_MAINTENANCE', title: 'Card Annual Maintenance Fee' });
    expect(filled(typed, 'serviceFees.0.tiers.0.fixedFee').form.serviceFees[0].tiers[0].fixedFee).toBe(600);
    expect(filled(typed, 'serviceFees.0.tiers.0.vatRate').form.serviceFees[0].tiers[0].vatRate).toBe(15);
    // An annual fee is a fixed amount, not a rate.
    expect(suggestField(typed, 'serviceFees.0.tiers.0.rate', today)).toMatchObject({ ok: false });
  });

  it('needs a scheme before templates and BINs, and skips card ranges already mapped', () => {
    const form = { ...prepaid(), schemes: [emptyScheme()] };
    expect(suggestField(form, 'schemes.0.namedTemplateId', today)).toEqual({ ok: false, reason: 'Choose a scheme first. Templates depend on it.' });
    const visa = filled(form, 'schemes.0.schemeId').form;
    expect(visa.schemes[0].schemeId).toBe(5);
    const bin = filled(visa, 'schemes.0.ranges.0.binId').form;
    const ranged = filled(bin, 'schemes.0.ranges.0.cardRangeId').form;
    expect(describeFieldValue(ranged, 'schemes.0.ranges.0.cardRangeId')).toBe('Range 0000000 to 4999999');

    const twoRows = { ...ranged, schemes: [{ ...ranged.schemes[0], ranges: [...ranged.schemes[0].ranges, { binId: ranged.schemes[0].ranges[0].binId, cardRangeId: null }] }] };
    expect(describeFieldValue(filled(twoRows, 'schemes.0.ranges.1.cardRangeId').form, 'schemes.0.ranges.1.cardRangeId')).toBe('Range 5000000 to 9999999');
  });

  it('does not fill in unknown fields', () => {
    expect(suggestField(prepaid(), 'nope.0.x', today)).toMatchObject({ ok: false });
  });
});

describe('answerFieldQuestion', () => {
  it('explains the field, its rules and the current problem, with a value to apply', () => {
    const answer = answerFieldQuestion({ ...prepaid(), productName: '' }, 'productName', 'Product Name', 'What is this field?', today);
    expect(answer.paragraphs[0]).toMatch(/Product List/);
    expect(answer.paragraphs).toContain('Right now: Product name is required.');
    expect(answer.suggestion?.display).toBe('Consumer Prepaid Card');
  });

  it('answers rule questions with the rules', () => {
    const answer = answerFieldQuestion(prepaid(), 'defaultName', 'Default Cardholder Name', 'What are the rules?', today);
    expect(answer.paragraphs.join(' ')).toMatch(/up to 26 characters/);
  });

  it('says so when the current value is already the suggestion', () => {
    const form = { ...prepaid(), validityYears: 3 };
    const answer = answerFieldQuestion(form, 'validityYears', 'Card Validity', 'What should I enter?', today);
    expect(answer.suggestion).toBeUndefined();
    expect(answer.paragraphs.at(-1)).toMatch(/^3 years is what I would suggest too/);
  });
});

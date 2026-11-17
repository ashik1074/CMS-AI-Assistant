import { describe, expect, it } from 'vitest';
import type { ProductRecord } from '../types/product';
import { cardRangeInventory, cardRangeReply, purposeFromPrompt, rangesToAvoid, schemesFromPrompt, suggestRanges } from './cardRanges';
import { matchScenario } from './mockResponses';
import { buildProductDraft } from './productDraft';

const NOW = new Date(2026, 10, 16);
const product = (name: string, cardRangeId: number): ProductRecord => {
  const values = buildProductDraft({ productName: name, schemes: [{ schemeId: 5, namedTemplateId: 101, anonymousTemplateId: null, ranges: [{ binId: 14, cardRangeId }] }] });
  return { productId: name, aspId: values.aspId, productName: name, status: 'DRAFT', values, createdBy: '', createdAt: 0, updatedAt: 0 };
};

describe('card range requests', () => {
  it.each([
    ['Show me available card range', []],
    ['Show me available card range for UnionPay', [7]],
    ['card ranges for Visa and Master Card', [5, 6]],
    ['Which BIN range is free on TakaPay?', [8]],
  ])('%s → schemes %j', (prompt, schemes) => {
    expect(matchScenario(prompt).scenario?.id).toBe('cardRanges');
    expect(schemesFromPrompt(prompt)).toEqual(schemes);
  });

  it('wins over product creation when the question is about card ranges', () => {
    expect(matchScenario('Which card range should I use for a new credit product?').scenario?.id).toBe('cardRanges');
    expect(purposeFromPrompt('Which card range should I use for a new credit product?')).toEqual({ productType: 'CREDIT' });
    expect(purposeFromPrompt('card range for corporate prepaid cards')).toEqual({ productType: 'PREPAID', segment: 'COMMERCIAL' });
  });

  it('replies with the ranges to show, and says when a scheme is not offered', () => {
    expect(cardRangeReply('Show me available card range for UnionPay', NOW).action).toEqual({ type: 'cardRanges', schemes: [7], asOf: NOW.getTime() });
    const amex = cardRangeReply('card ranges for Amex', NOW);
    expect(amex.content).toMatch(/I don't have card ranges for Amex/);
    expect(amex.action.schemes).toEqual([]);
  });
});

describe('card range inventory', () => {
  const inventory = cardRangeInventory();

  it('covers every scheme, with free card numbers and a status', () => {
    expect(new Set(inventory.map((r) => r.scheme))).toEqual(new Set(['VISA', 'Mastercard', 'UnionPay', 'TakaPay']));
    const tiny = inventory.find((r) => r.rangeId === 50)!;
    expect(tiny).toMatchObject({ capacity: 3, available: 0, status: 'full', bin: '621234', tier: 'Classic' });
    expect(inventory.find((r) => r.rangeId === 40)!.status).toBe('nearlyFull');
    for (const r of inventory) expect(r.issued + r.available).toBe(r.capacity);
  });

  it('lists the products that use each range', () => {
    const [a] = cardRangeInventory([product('Gold Saver', 34), product('Student Card', 34)]).filter((r) => r.rangeId === 34);
    expect(a.products).toEqual(['Gold Saver', 'Student Card']);
  });

  it('suggests the range with the most room that no product uses, and never a full one', () => {
    const [best] = suggestRanges(inventory);
    expect(best.range).toMatchObject({ scheme: 'TakaPay', rangeId: 61 });
    expect(best.reasons[1]).toMatch(/No product uses it yet/);
    expect(suggestRanges(inventory).some((s) => s.range.status === 'full' || s.range.status === 'nearlyFull')).toBe(false);
  });

  it('suggests within the chosen scheme, and names the ranges to avoid', () => {
    const unionPay = inventory.filter((r) => r.schemeId === 7);
    expect(suggestRanges(unionPay).map((s) => s.range.rangeId)).toEqual([51]);
    expect(rangesToAvoid(unionPay)).toEqual([{ range: expect.objectContaining({ rangeId: 50 }), reason: 'No card numbers left.' }]);
  });

  it('prefers a BIN tier that suits the product', () => {
    const visa = inventory.filter((r) => r.schemeId === 5);
    expect(suggestRanges(visa, { productType: 'CREDIT' })[0].range.tier).toBe('Platinum');
    expect(suggestRanges(visa, { segment: 'COMMERCIAL' })[0].range.tier).toBe('Business');
    expect(suggestRanges(visa, { segment: 'COMMERCIAL', productType: 'CREDIT' })[0].range.tier).toBe('Business');
    expect(suggestRanges(visa, { productType: 'DEBIT' })[0].range.tier).toBe('Classic');
    // A range other products already share ranks below a free one.
    const shared = cardRangeInventory([product('Gold Saver', 34)]).filter((r) => r.schemeId === 5);
    expect(suggestRanges(shared)[0].range.rangeId).not.toBe(34);
  });
});

describe('card range suggestion without a fitting BIN', () => {
  it('says so when no BIN of the scheme suits the product', () => {
    const unionPay = cardRangeInventory().filter((r) => r.schemeId === 7);
    expect(suggestRanges(unionPay, { segment: 'COMMERCIAL' })[0].reasons.at(-1)).toBe('None of these BINs is made for a commercial product, so this is the closest fit.');
  });
});

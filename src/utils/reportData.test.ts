import { describe, expect, it } from 'vitest';
import { niceTicks } from './chartFormat';
import { matchScenario } from './mockResponses';
import { buildProductDraft } from './productDraft';
import {
  binTransactions,
  chartFromPrompt,
  demoPortfolio,
  demoTransactions,
  extractPhone,
  fromRecord,
  groupingsFor,
  groupProducts,
  summarize,
  timeBins,
} from './reportData';

const NOW = new Date(2026, 10, 2, 14, 30).getTime();

describe('report prompts', () => {
  it.each([
    ['Show me Products in PIE Chart', 'productReport', 'pie'],
    ['Show me products in a bar chart', 'productReport', 'bar'],
    ['Show me Products in Histogram', 'productReport', 'histogram'],
    ['Bar graph of products', 'productReport', 'bar'],
    ['Show me visual report of products', 'productReport', null],
    ['Show me a chart of products', 'productReport', null],
  ])('%s → %s (%s)', (prompt, scenario, chart) => {
    expect(matchScenario(prompt).scenario?.id).toBe(scenario);
    expect(chartFromPrompt(prompt)).toBe(chart);
  });

  it('still creates a product when no chart is asked for', () => {
    expect(matchScenario('Create a product').scenario?.id).toBe('createProduct');
  });

  it('recognises transaction requests and any phone number', () => {
    expect(matchScenario('Show me visual transaction data for 01712345678').scenario?.id).toBe('transactionReport');
    expect(extractPhone('Show me visual transaction data for 01712345678')).toBe('01712345678');
    expect(extractPhone('transactions for +880 1712-345678 please')).toBe('+8801712345678');
    expect(extractPhone('transactions for 12')).toBeNull();
  });

  it('asks for the number when there is none', () => {
    const result = matchScenario('Show me visual transaction data').scenario!.agent!('Show me visual transaction data', [], new Date(NOW));
    expect(result.action).toBeUndefined();
    expect(result.content).toMatch(/phone number/);
  });
});

describe('product report data', () => {
  const portfolio = demoPortfolio(NOW);

  it('offers category groupings for pie and bar charts, and binned values for histograms', () => {
    expect(groupingsFor('pie')).toEqual(['scheme', 'currency', 'productType', 'marketSegment', 'status']);
    expect(groupingsFor('bar')).toEqual(groupingsFor('pie'));
    expect(groupingsFor('histogram')).toEqual(['liveMonth', 'validity', 'annualFee']);
  });

  it('is the same every time and counts every product once', () => {
    expect(demoPortfolio(NOW)).toEqual(portfolio);
    for (const g of [...groupingsFor('bar'), ...groupingsFor('histogram')].filter((g) => g !== 'liveMonth')) {
      expect(groupProducts(portfolio, g, NOW).reduce((n, d) => n + d.value, 0)).toBe(portfolio.length);
    }
  });

  it('keeps categories in a fixed order (so colors follow the category, not its rank)', () => {
    const schemes = groupProducts(portfolio, 'scheme', NOW);
    expect(schemes.map((d) => d.key)).toEqual(['Mastercard', 'VISA', 'UnionPay']);
    expect(schemes.map((d) => d.slot)).toEqual([0, 1, 2]);
  });

  it('bins live-from dates into the last 12 months, empty months included', () => {
    const months = groupProducts(portfolio, 'liveMonth', NOW);
    expect(months).toHaveLength(12);
    expect(months.at(-1)!.label).toBe('Nov 26');
  });

  it("includes the user's own products", () => {
    const record = { productId: '1001', aspId: 'A', productName: 'Mine', status: 'DRAFT' as const, values: buildProductDraft({ currency: 'USD' }), createdBy: '', createdAt: 0, updatedAt: 0 };
    const row = fromRecord(record);
    expect(row).toMatchObject({ name: 'Mine', status: 'Draft', scheme: 'Not set', currency: 'USD', own: true, validityYears: 5 });
    expect(row.annualFeeUsd).toBe(5);
    expect(groupProducts([...portfolio, row], 'status', NOW).find((d) => d.key === 'Draft')?.value).toBe(1);
  });
});

describe('transaction data', () => {
  const txns = demoTransactions('01712345678', NOW);

  it('is seeded by the phone number', () => {
    expect(demoTransactions('01712345678', NOW)).toEqual(txns);
    expect(demoTransactions('01811111111', NOW)).not.toEqual(txns);
    expect(txns.every((t) => t.at <= NOW && t.amount >= 10)).toBe(true);
  });

  it.each([
    ['24h', 24, '14:00'],
    ['7d', 7, 'Mon 2'],
    ['30d', 30, 'Nov 2'],
    ['1y', 12, 'Nov 26'],
  ] as const)('%s has %i contiguous bins ending now', (range, count, last) => {
    const bins = timeBins(range, NOW);
    expect(bins).toHaveLength(count);
    expect(bins.at(-1)!.label).toBe(last);
    bins.slice(1).forEach((b, i) => expect(b.start).toBe(bins[i].end));
  });

  it('counts the same transactions over time and by amount', () => {
    const overTime = binTransactions(txns, '30d', 'time', NOW);
    const byAmount = binTransactions(txns, '30d', 'amount', NOW);
    const total = (bins: typeof overTime) => bins.reduce((n, b) => n + b.count, 0);
    expect(total(overTime)).toBeGreaterThan(0);
    expect(total(byAmount)).toBe(total(overTime));
    const stats = summarize(overTime, 'count');
    expect(stats.count).toBe(total(overTime));
    expect(stats.busiest!.count).toBe(Math.max(...overTime.map((b) => b.count)));
  });
});

describe('niceTicks', () => {
  it('gives round, whole-number steps covering the maximum', () => {
    expect(niceTicks(7)).toEqual([0, 2, 4, 6, 8]);
    expect(niceTicks(1)).toEqual([0, 1]);
    expect(niceTicks(43_000)).toEqual([0, 10_000, 20_000, 30_000, 40_000, 50_000]);
  });
});

import { CURRENCIES, SCHEMES } from '../services/productCatalog';
import type { ProductRecord } from '../types/product';
import type { ProductGroupBy, ReportChart, TxnMetric, TxnRange, TxnView } from '../types/report';
import { PER_USD, PRODUCT_STATUS_LABELS, schemeName, titleCase } from './productDraft';

/*
 * Reporting data. Everything here is generated in the browser: a fixed demo portfolio of card products
 * (plus the products the user created), and seeded demo transactions for a phone number.
 */

/* ---------- Seeded randomness (same input → same data) ---------- */

export function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32: a small, fast seeded PRNG returning [0, 1). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- Intent ---------- */

const CHART_WORDS = /\b(pie|donut|doughnut|bar|column|histogram|chart|graph|report|visuali[sz](e|ation))\b/i;

/** "Show me products in a pie chart", "Bar chart of products", "Show me visual report of products". */
export const PRODUCT_REPORT_PATTERN =
  /\bproducts?\b[^.?!\n]*\b(pie|donut|doughnut|bar|column|histogram|chart|graph|report|visuali[sz](e|ation))\b|\b(pie|donut|doughnut|bar|column|histogram|chart|graph|report|visual|visuali[sz](e|ation))\b[^.?!\n]*\bproducts?\b/i;

export const isProductReportRequest = (text: string) => PRODUCT_REPORT_PATTERN.test(text) && CHART_WORDS.test(text);

/** The chart type the prompt names, or `null` when it doesn't say ("Show me visual report of products"). */
export function chartFromPrompt(text: string): ReportChart | null {
  if (/\b(pie|donut|doughnut)\b/i.test(text)) return 'pie';
  if (/\b(histogram|distribution)\b/i.test(text)) return 'histogram';
  if (/\b(bar|column)\b/i.test(text)) return 'bar';
  return null;
}

/** "Show me visual transaction data for 01712345678". */
export const TRANSACTION_REPORT_PATTERN = /\btransactions?\b[^\n]*\b(visual|chart|graph|histogram|data|history|activity|report)\b|\b(visual|chart|graph|histogram)\b[^\n]*\btransactions?\b/i;

/** A phone number in the text (7–15 digits, optional + and separators), as written. */
export function extractPhone(text: string): string | null {
  const match = /(\+?\d[\d\s-]{5,17}\d)/.exec(text);
  if (!match) return null;
  const digits = match[1].replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15 ? match[1].replace(/\s+/g, '').replace(/-/g, '') : null;
}

/* ---------- Product report ---------- */

export const CHART_LABELS: Record<ReportChart, string> = { pie: 'Pie chart', bar: 'Bar chart', histogram: 'Histogram' };

export interface Grouping {
  label: string;
  /** Categories suit pie and bar charts; numeric values are binned into ranges for histograms. */
  kind: 'category' | 'numeric';
  /** Axis title for the grouped values. */
  axis: string;
  hint: string;
}

export const GROUPINGS: Record<ProductGroupBy, Grouping> = {
  scheme: { label: 'Scheme', kind: 'category', axis: 'Scheme', hint: 'Mastercard, VISA, UnionPay' },
  currency: { label: 'Account currency', kind: 'category', axis: 'Currency', hint: 'BDT, USD, …' },
  productType: { label: 'Product type', kind: 'category', axis: 'Product type', hint: 'Debit, Credit, Prepaid' },
  marketSegment: { label: 'Market segment', kind: 'category', axis: 'Market segment', hint: 'Consumer, Commercial' },
  status: { label: 'Status', kind: 'category', axis: 'Status', hint: 'Active, Pending approval, Draft, Inactive' },
  liveMonth: { label: 'Live-from date', kind: 'numeric', axis: 'Live-from month', hint: 'Products per month, last 12 months' },
  validity: { label: 'Card validity', kind: 'numeric', axis: 'Card validity (years)', hint: '1 to 10 years' },
  annualFee: { label: 'Annual maintenance fee', kind: 'numeric', axis: 'Annual fee (USD equivalent)', hint: 'In $2 ranges' },
};

/** The groupings a chart type offers: categories for pie and bar charts, binned numbers for histograms. */
export const groupingsFor = (chart: ReportChart) => (Object.keys(GROUPINGS) as ProductGroupBy[]).filter((g) => (GROUPINGS[g].kind === 'numeric') === (chart === 'histogram'));

export type ProductStatusLabel = 'Active' | 'Pending approval' | 'Draft' | 'Rejected' | 'Inactive';

/** One product as the report sees it. */
export interface ReportProduct {
  name: string;
  scheme: string;
  currency: string;
  productType: string;
  marketSegment: string;
  status: ProductStatusLabel;
  liveFrom: Date;
  validityYears: number;
  annualFeeUsd: number;
  /** Created by the user in this browser (rather than part of the demo portfolio). */
  own: boolean;
}

const DAY = 86_400_000;

/** A fixed demo portfolio of 36 card products, with live-from dates spread over the last two years. */
export function demoPortfolio(now: number): ReportProduct[] {
  const rand = seededRandom(20261102);
  const pick = <T>(items: readonly T[], weights?: number[]) => {
    if (!weights) return items[Math.floor(rand() * items.length)];
    let r = rand() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < items.length; i++) if ((r -= weights[i]) < 0) return items[i];
    return items[items.length - 1];
  };
  const tiers = ['Classic', 'Gold', 'Platinum', 'Signature', 'Titanium', 'Everyday', 'Student', 'Travel', 'Business', 'Corporate', 'Smart', 'Rewards'];
  return Array.from({ length: 36 }, (_, i) => {
    const productType = pick(['Debit', 'Credit', 'Prepaid'], [5, 3, 3]);
    const marketSegment = pick(['Consumer', 'Commercial'], [3, 1]);
    const scheme = pick(['VISA', 'Mastercard', 'UnionPay'], [5, 4, 2]);
    const currency = pick(['BDT', 'USD', 'EUR', 'GBP', 'SGD'], [12, 5, 2, 1, 1]);
    const feeUsd = Math.round((productType === 'Credit' ? 6 : productType === 'Prepaid' ? 2 : 4) + rand() * 6 - 1.5);
    return {
      name: `${tiers[i % tiers.length]} ${productType}${i >= tiers.length ? ` ${Math.floor(i / tiers.length) + 1}` : ''}`,
      scheme,
      currency,
      productType,
      marketSegment,
      status: pick<ProductStatusLabel>(['Active', 'Pending approval', 'Inactive'], [8, 1, 1]),
      liveFrom: new Date(now - Math.floor(rand() * 720) * DAY),
      validityYears: pick([3, 4, 5, 5, 5, 6, 8, 10]),
      annualFeeUsd: Math.max(0, feeUsd),
      own: false,
    };
  });
}

/** A product the user created (draft or submitted) as a report row. */
export function fromRecord(record: ProductRecord): ReportProduct {
  const v = record.values;
  const annual = v.serviceFees.find((f) => f.feeType === 'ANNUAL_MAINTENANCE')?.tiers[0]?.fixedFee ?? 0;
  return {
    name: record.productName,
    scheme: schemeName(v.schemes[0]?.schemeId ?? null) ?? 'Not set',
    currency: v.currency,
    productType: v.productType ? titleCase(v.productType) : 'Not set',
    marketSegment: titleCase(v.marketSegment),
    status: PRODUCT_STATUS_LABELS[record.status],
    liveFrom: new Date(`${v.effectiveDate}T00:00:00`),
    validityYears: v.validityYears ?? 0,
    annualFeeUsd: Math.round((annual / (PER_USD[v.currency] ?? 1)) * 100) / 100,
    own: true,
  };
}

export interface ChartDatum {
  /** Stable identity, so a category keeps its color when others are hidden or re-sorted. */
  key: string;
  label: string;
  value: number;
  /** Position in the grouping's fixed order (drives the categorical color slot). */
  slot: number;
}

const CATEGORY_DOMAINS: Partial<Record<ProductGroupBy, string[]>> = {
  scheme: [...SCHEMES.map((s) => s.name), 'Not set'],
  currency: CURRENCIES,
  productType: ['Debit', 'Credit', 'Prepaid', 'Not set'],
  marketSegment: ['Consumer', 'Commercial'],
  status: ['Active', 'Pending approval', 'Draft', 'Inactive'],
};

const monthLabel = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

/**
 * Groups products for a chart. Categories come back in their fixed order (empty ones dropped, at most
 * eight shown, the rest folded into "Other"); numeric groupings come back as contiguous bins, empty ones kept.
 */
export function groupProducts(products: ReportProduct[], groupBy: ProductGroupBy, now: number): ChartDatum[] {
  const domain = CATEGORY_DOMAINS[groupBy];
  if (domain) {
    const field = groupBy as 'scheme' | 'currency' | 'productType' | 'marketSegment' | 'status';
    const counts = new Map<string, number>();
    for (const p of products) counts.set(p[field], (counts.get(p[field]) ?? 0) + 1);
    const keys = [...domain, ...[...counts.keys()].filter((k) => !domain.includes(k)).sort()];
    const rows = keys.map((key, slot) => ({ key, label: key, value: counts.get(key) ?? 0, slot })).filter((d) => d.value > 0);
    if (rows.length <= 8) return rows;
    // Eight categorical colors at most: the rest becomes one "Other" slice.
    const kept = [...rows].sort((a, b) => b.value - a.value).slice(0, 7);
    const keptKeys = new Set(kept.map((r) => r.key));
    return [...rows.filter((r) => keptKeys.has(r.key)), { key: 'other', label: 'Other', value: rows.filter((r) => !keptKeys.has(r.key)).reduce((n, r) => n + r.value, 0), slot: -1 }];
  }
  if (groupBy === 'liveMonth') {
    const end = new Date(now);
    const bins = Array.from({ length: 12 }, (_, i) => new Date(end.getFullYear(), end.getMonth() - 11 + i, 1));
    return bins.map((start, i) => {
      const next = new Date(start.getFullYear(), start.getMonth() + 1, 1);
      return { key: start.toISOString(), label: monthLabel(start), value: products.filter((p) => p.liveFrom >= start && p.liveFrom < next).length, slot: i };
    });
  }
  if (groupBy === 'validity') {
    return Array.from({ length: 10 }, (_, i) => ({ key: String(i + 1), label: String(i + 1), value: products.filter((p) => p.validityYears === i + 1).length, slot: i }));
  }
  // Annual fee, in $2 ranges up to $12 and an open "$12+" range.
  return Array.from({ length: 7 }, (_, i) => {
    const lo = i * 2;
    const last = i === 6;
    return { key: `fee-${lo}`, label: last ? `$${lo}+` : `$${lo}–${lo + 2}`, value: products.filter((p) => p.annualFeeUsd >= lo && (last || p.annualFeeUsd < lo + 2)).length, slot: i };
  });
}

/* ---------- Transactions for a phone number ---------- */

export const TXN_TYPES_DEMO = ['Send money', 'Cash out', 'Cash in', 'Payment', 'Mobile recharge'] as const;

export interface DemoTransaction {
  at: number;
  amount: number;
  type: (typeof TXN_TYPES_DEMO)[number];
}

const HOUR_WEIGHTS = [1, 0.5, 0.3, 0.2, 0.2, 0.4, 1, 2, 3.5, 4.5, 5, 5, 5.5, 5, 4.5, 4.5, 5, 5.5, 6, 6.5, 6, 4.5, 3, 1.8];

/** A year of seeded demo transactions ending at `asOf`; the same phone number always gets the same history. */
export function demoTransactions(phone: string, asOf: number): DemoTransaction[] {
  const rand = seededRandom(hashString(phone.replace(/\D/g, '')));
  const perDay = 4 + rand() * 8;
  const medianAmount = 300 + rand() * 900;
  const hourTotal = HOUR_WEIGHTS.reduce((a, b) => a + b, 0);
  const startOfToday = new Date(asOf);
  startOfToday.setHours(0, 0, 0, 0);
  const out: DemoTransaction[] = [];
  for (let d = 365; d >= 0; d--) {
    const dayStart = startOfToday.getTime() - d * DAY;
    const weekday = new Date(dayStart).getDay();
    const busy = (weekday === 5 ? 0.7 : weekday === 4 ? 1.25 : 1) * (1 + 0.25 * Math.sin((d / 365) * Math.PI * 4));
    const count = Math.max(0, Math.round(perDay * busy + (rand() - 0.5) * perDay));
    for (let i = 0; i < count; i++) {
      let r = rand() * hourTotal;
      let hour = 0;
      while ((r -= HOUR_WEIGHTS[hour]) > 0 && hour < 23) hour++;
      const at = dayStart + hour * 3_600_000 + Math.floor(rand() * 3_600_000);
      if (at > asOf) continue;
      // Log-normal amounts: mostly small, a long tail of large transfers.
      const normal = Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
      const amount = Math.min(50_000, Math.max(10, Math.round(medianAmount * Math.exp(normal * 0.9))));
      out.push({ at, amount, type: TXN_TYPES_DEMO[Math.floor(rand() * TXN_TYPES_DEMO.length)] });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

export const TXN_RANGES: { id: TxnRange; label: string; unit: string }[] = [
  { id: '24h', label: 'Last 24 hours', unit: 'Hour' },
  { id: '7d', label: 'Last 1 week', unit: 'Day' },
  { id: '30d', label: 'Last 1 month', unit: 'Day' },
  { id: '1y', label: 'Last 1 year', unit: 'Month' },
];

export interface TimeBin {
  key: string;
  label: string;
  /** Longer label for tooltips and the table, e.g. "Mon, Oct 27". */
  fullLabel: string;
  start: number;
  end: number;
}

/** Contiguous time bins covering the range and ending at `asOf`. */
export function timeBins(range: TxnRange, asOf: number): TimeBin[] {
  const now = new Date(asOf);
  if (range === '24h') {
    const top = new Date(now);
    top.setMinutes(0, 0, 0);
    return Array.from({ length: 24 }, (_, i) => {
      const start = top.getTime() - (23 - i) * 3_600_000;
      const d = new Date(start);
      const label = `${String(d.getHours()).padStart(2, '0')}:00`;
      return { key: String(start), label, fullLabel: `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${label}–${String((d.getHours() + 1) % 24).padStart(2, '0')}:00`, start, end: start + 3_600_000 };
    });
  }
  if (range === '1y') {
    return Array.from({ length: 12 }, (_, i) => {
      const s = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      const e = new Date(s.getFullYear(), s.getMonth() + 1, 1);
      return { key: s.toISOString(), label: monthLabel(s), fullLabel: s.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), start: s.getTime(), end: e.getTime() };
    });
  }
  const days = range === '7d' ? 7 : 30;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: days }, (_, i) => {
    const s = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1 - i));
    const e = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 1);
    return {
      key: s.toISOString(),
      label: range === '7d' ? `${s.toLocaleDateString('en-US', { weekday: 'short' })} ${s.getDate()}` : s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      fullLabel: s.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      start: s.getTime(),
      end: e.getTime(),
    };
  });
}

/** Amount bands (BDT) for the amount-distribution view. */
export const AMOUNT_BANDS = [0, 100, 250, 500, 1000, 2500, 5000, 10000, Infinity];

const compact = (n: number) => (n >= 1000 ? `${n / 1000}K` : String(n));

export interface TxnBin {
  key: string;
  label: string;
  fullLabel: string;
  count: number;
  amount: number;
}

export function binTransactions(txns: DemoTransaction[], range: TxnRange, view: TxnView, asOf: number): TxnBin[] {
  const bins = timeBins(range, asOf);
  const inRange = txns.filter((t) => t.at >= bins[0].start && t.at <= asOf);
  if (view === 'time') {
    return bins.map((b) => {
      const hits = inRange.filter((t) => t.at >= b.start && t.at < b.end);
      return { key: b.key, label: b.label, fullLabel: b.fullLabel, count: hits.length, amount: hits.reduce((n, t) => n + t.amount, 0) };
    });
  }
  return AMOUNT_BANDS.slice(0, -1).map((lo, i) => {
    const hi = AMOUNT_BANDS[i + 1];
    const hits = inRange.filter((t) => t.amount >= lo && t.amount < hi);
    const label = hi === Infinity ? `${compact(lo)}+` : `${compact(lo)}–${compact(hi)}`;
    return { key: `band-${lo}`, label, fullLabel: `${label} BDT`, count: hits.length, amount: hits.reduce((n, t) => n + t.amount, 0) };
  });
}

export interface TxnSummary {
  count: number;
  amount: number;
  average: number;
  busiest: TxnBin | null;
}

export function summarize(bins: TxnBin[], metric: TxnMetric): TxnSummary {
  const count = bins.reduce((n, b) => n + b.count, 0);
  const amount = bins.reduce((n, b) => n + b.amount, 0);
  const busiest = bins.reduce<TxnBin | null>((best, b) => (b[metric] > (best?.[metric] ?? 0) ? b : best), null);
  return { count, amount, average: count ? Math.round(amount / count) : 0, busiest };
}

/* ---------- Chat text ---------- */

export function productReportIntro(chart: ReportChart | null): string {
  if (!chart) return "I'll build a visual report of your card products. First, choose the **type of chart** (pie chart, bar chart or histogram), then how the report should group the products.";
  return chart === 'histogram'
    ? "I'll build a **histogram** of your card products. A histogram shows how a numeric value is spread, so first choose which value to group the products into ranges by."
    : `I'll build a **${CHART_LABELS[chart].toLowerCase()}** of your card products. First, choose how the report should group them.`;
}

export const transactionIntro = (phone: string) =>
  `Here's the transaction activity for **${phone}** as a histogram. Use the filter to change the period, or switch between transaction count and amount.`;

export const NO_PHONE_TEXT =
  "I can chart a wallet's transactions, but I need the phone number. Try: **Show me visual transaction data for 01712345678**.";

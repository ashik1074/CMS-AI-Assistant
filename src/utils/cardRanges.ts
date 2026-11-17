import { BINS, CARD_RANGES, SCHEMES } from '../services/productCatalog';
import type { CardRangePurpose, CardRangesAction } from '../types/cardRange';
import type { ProductRecord } from '../types/product';
import { titleCase } from './productDraft';

/*
 * Card ranges: the blocks of card numbers under each BIN that products issue cards from.
 * There is no card management system behind the demo, so how many numbers each range has issued
 * is fixed demo data. Which products use a range comes from the products saved in this browser.
 */

/* ---------- Intent ---------- */

/** "Show me available card range", "card ranges for UnionPay", "Which BIN range should I use?". */
export const CARD_RANGE_PATTERN = /\b(card|bin)[\s-]*(number\s+)?ranges?\b|\bavailable\s+bins?\b/i;

const SCHEME_WORDS: [number, RegExp][] = [
  [5, /\bvisa\b/i],
  [6, /\bmaster\s*card\b/i],
  [7, /\bunion\s*pay\b/i],
  [8, /\btaka\s*pay\b/i],
];

/** Schemes the demo doesn't issue on, so the reply can say so. */
const OTHER_SCHEMES = /\b(amex|american\s+express|jcb|discover|diners(\s+club)?|rupay)\b/i;

/** The schemes named in the prompt, in catalog order; empty for "all schemes". */
export function schemesFromPrompt(text: string): number[] {
  return SCHEME_WORDS.filter(([, re]) => re.test(text)).map(([id]) => id);
}

export function purposeFromPrompt(text: string): CardRangePurpose | undefined {
  const type = /\b(debit|credit|prepaid)\b/i.exec(text)?.[1];
  const commercial = /\b(commercial|corporate|business|sme)\b/i.test(text);
  const consumer = /\b(consumer|retail|personal)\b/i.test(text);
  const purpose: CardRangePurpose = {
    ...(type ? { productType: type.toUpperCase() as CardRangePurpose['productType'] } : {}),
    ...(commercial ? { segment: 'COMMERCIAL' as const } : consumer ? { segment: 'CONSUMER' as const } : {}),
  };
  return Object.keys(purpose).length ? purpose : undefined;
}

export const schemeLabel = (id: number) => SCHEMES.find((s) => s.id === id)?.name ?? `Scheme ${id}`;

const list = (names: string[]) => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);

export const purposeLabel = (p?: CardRangePurpose) =>
  p ? [p.segment && titleCase(p.segment).toLowerCase(), p.productType && titleCase(p.productType).toLowerCase(), 'product'].filter(Boolean).join(' ') : undefined;

/** The assistant's reply for a card range request, with the action that shows the ranges. */
export function cardRangeReply(prompt: string, now: Date): { content: string; action: CardRangesAction } {
  const schemes = schemesFromPrompt(prompt);
  const purpose = purposeFromPrompt(prompt);
  const other = OTHER_SCHEMES.exec(prompt)?.[0];
  const which = schemes.length ? `**${list(schemes.map(schemeLabel))}**` : `**all schemes** (${list(SCHEMES.map((s) => s.name))})`;
  const lines = [
    ...(other && !schemes.length ? [`I don't have card ranges for ${other}: products here are issued on ${list(SCHEMES.map((s) => s.name))}.`, ''] : []),
    `Here are the card ranges for ${which}, with how many card numbers each one has left and which products already use it.`,
    '',
    purpose ? `I've marked the range that suits a **${purposeLabel(purpose)}** best, and why.` : "I've marked the range I'd use for a new product, and why.",
  ];
  return { content: lines.join('\n'), action: { type: 'cardRanges', schemes, ...(purpose ? { purpose } : {}), asOf: now.getTime() } };
}

/* ---------- Inventory ---------- */

/** Share of each range's card numbers already issued (demo data). */
const ISSUED_SHARE: Record<number, number> = {
  33: 0.92,
  34: 0.18,
  35: 0.41,
  36: 0.63,
  40: 0.97,
  41: 0.35,
  42: 0.12,
  50: 1,
  51: 0.22,
  60: 0.08,
  61: 0,
  62: 0.05,
};

export type RangeStatus = 'available' | 'limited' | 'nearlyFull' | 'full';

export const STATUS_LABELS: Record<RangeStatus, string> = { available: 'Available', limited: 'Limited', nearlyFull: 'Nearly full', full: 'Full' };

export interface CardRangeInfo {
  rangeId: number;
  schemeId: number;
  scheme: string;
  binId: number;
  /** e.g. "Visa Classic BIN 421234" */
  binName: string;
  /** The 6-digit BIN. */
  bin: string;
  /** Card tier named by the BIN: Classic, Platinum, Business… */
  tier: string;
  /** e.g. "Range 0000000 to 4999999" */
  rangeName: string;
  start: string;
  end: string;
  capacity: number;
  issued: number;
  available: number;
  /** 0–1 */
  freeShare: number;
  status: RangeStatus;
  /** Names of the products in this browser that issue from the range. */
  products: string[];
}

const statusOf = (available: number, freeShare: number): RangeStatus => (available === 0 ? 'full' : freeShare < 0.05 ? 'nearlyFull' : freeShare < 0.25 ? 'limited' : 'available');

/** Every card range with its usage, in catalog order. */
export function cardRangeInventory(products: ProductRecord[] = []): CardRangeInfo[] {
  const usedBy = new Map<number, string[]>();
  for (const p of products) {
    const ids = new Set(p.values.schemes.flatMap((s) => s.ranges.map((r) => r.cardRangeId)));
    for (const id of ids) if (id !== null) usedBy.set(id, [...(usedBy.get(id) ?? []), p.productName || 'Untitled product']);
  }
  return CARD_RANGES.flatMap((range) => {
    const bin = BINS.find((b) => b.id === range.binId);
    if (!bin) return [];
    const [, start = '0', end = '0'] = /(\d+)\s+to\s+(\d+)/.exec(range.name) ?? [];
    const capacity = Number(end) - Number(start) + 1;
    const issued = Math.round(capacity * (ISSUED_SHARE[range.id] ?? 0.5));
    const available = capacity - issued;
    const freeShare = capacity ? available / capacity : 0;
    return [
      {
        rangeId: range.id,
        schemeId: bin.schemeId,
        scheme: schemeLabel(bin.schemeId),
        binId: bin.id,
        binName: bin.name,
        bin: /\b(\d{6})\b/.exec(bin.name)?.[1] ?? '',
        tier: /\b(Classic|Platinum|Business|Standard|World|Gold)\b/.exec(bin.name)?.[1] ?? 'Standard',
        rangeName: range.name,
        start,
        end,
        capacity,
        issued,
        available,
        freeShare,
        status: statusOf(available, freeShare),
        products: usedBy.get(range.id) ?? [],
      },
    ];
  });
}

/* ---------- Suggestion ---------- */

/** BIN tiers that suit each kind of product. */
const TIER_FIT: { test: (p: CardRangePurpose) => boolean; tiers: RegExp; why: string }[] = [
  { test: (p) => p.segment === 'COMMERCIAL', tiers: /^Business$/, why: 'a Business BIN, made for company cards' },
  { test: (p) => p.productType === 'CREDIT', tiers: /^(Platinum|World|Gold)$/, why: 'a premium BIN, which suits credit cards' },
  { test: (p) => p.productType === 'DEBIT' || p.productType === 'PREPAID' || p.segment === 'CONSUMER', tiers: /^(Classic|Standard)$/, why: 'an everyday BIN, which suits debit and prepaid cards' },
];

export interface RangeSuggestion {
  range: CardRangeInfo;
  reasons: string[];
}

export const formatCount = (n: number) => n.toLocaleString('en-US');
export const percent = (share: number) => `${Math.round(share * 100)}%`;

function fitFor(range: CardRangeInfo, purpose?: CardRangePurpose) {
  // The first rule that applies decides: a corporate credit card belongs on a Business BIN.
  const rule = purpose ? TIER_FIT.find((t) => t.test(purpose)) : undefined;
  return rule?.tiers.test(range.tier) ? rule : undefined;
}

/**
 * Ranks the usable ranges: plenty of free numbers first, then ranges no product uses yet
 * (so each product has its own block). A BIN tier that fits the purpose counts most: schemes expect
 * business cards on business BINs and premium credit cards on premium BINs.
 */
export function suggestRanges(ranges: CardRangeInfo[], purpose?: CardRangePurpose): RangeSuggestion[] {
  const score = (r: CardRangeInfo) => r.freeShare * 60 + Math.min(Math.log10(r.available + 1), 7) * 3 + (r.products.length ? 0 : 15) + (fitFor(r, purpose) ? 40 : 0);
  return ranges
    .filter((r) => r.status === 'available' || r.status === 'limited')
    .sort((a, b) => score(b) - score(a))
    .map((range, i) => {
      const fit = fitFor(range, purpose);
      const reasons = [
        `${percent(range.freeShare)} of its ${formatCount(range.capacity)} card numbers are still free (${formatCount(range.available)} left).`,
        range.products.length ? `Shared with ${range.products.length} product${range.products.length === 1 ? '' : 's'} (${list(range.products.slice(0, 3))}${range.products.length > 3 ? '…' : ''}).` : 'No product uses it yet, so a new product gets its own block of numbers.',
        ...(fit ? [`${range.binName} is ${fit.why}.`] : i === 0 && purpose ? [`None of these BINs is made for a ${purposeLabel(purpose)}, so this is the closest fit.`] : []),
      ];
      return { range, reasons };
    });
}

/** Ranges to steer away from, with the reason. */
export function rangesToAvoid(ranges: CardRangeInfo[]): { range: CardRangeInfo; reason: string }[] {
  return ranges
    .filter((r) => r.status === 'full' || r.status === 'nearlyFull')
    .map((range) => ({
      range,
      reason: range.status === 'full' ? 'No card numbers left.' : `Only ${formatCount(range.available)} card numbers left (${percent(range.freeShare)}).`,
    }));
}

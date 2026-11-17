import type { MarketSegment, ProductType } from './product';

/** What the card range is for, read from the prompt ("for a credit product"), to pick the best fit. */
export interface CardRangePurpose {
  productType?: ProductType;
  segment?: MarketSegment;
}

/** Available card ranges, shown in the chat with the range the assistant suggests. */
export interface CardRangesAction {
  type: 'cardRanges';
  /** Scheme IDs to show; empty means every scheme. */
  schemes: number[];
  purpose?: CardRangePurpose;
  /** When the inventory was read. */
  asOf: number;
}

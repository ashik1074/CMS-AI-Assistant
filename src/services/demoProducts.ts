import type { MarketSegment, ProductRecord, ProductStatus, ProductType } from '../types/product';
import { buildProductDraft } from '../utils/productDraft';
import { DEFAULT_ASP_ID } from './productCatalog';
import { PRODUCTS_KEY } from './productService';

const HOUR = 60 * 60 * 1000;

const SAMPLES: { name: string; type: ProductType; segment: MarketSegment; status: ProductStatus; hoursAgo: number }[] = [
  { name: 'Agent Product', type: 'PREPAID', segment: 'CONSUMER', status: 'DRAFT', hoursAgo: 2 },
  { name: 'Credit Product Test', type: 'CREDIT', segment: 'CONSUMER', status: 'DRAFT', hoursAgo: 26 },
  { name: 'Platinum Credit Card', type: 'CREDIT', segment: 'CONSUMER', status: 'PENDING_APPROVAL', hoursAgo: 30 },
  { name: 'Debit Product 2', type: 'DEBIT', segment: 'CONSUMER', status: 'REJECTED', hoursAgo: 52 },
  { name: 'Debit Product 3', type: 'DEBIT', segment: 'COMMERCIAL', status: 'REJECTED', hoursAgo: 53 },
  { name: 'Prepaid Product', type: 'PREPAID', segment: 'CONSUMER', status: 'REJECTED', hoursAgo: 75 },
  { name: 'Automation Product 1', type: 'CREDIT', segment: 'COMMERCIAL', status: 'DRAFT', hoursAgo: 120 },
];

/** Fills an empty demo with sample products, so the Product List has something to show on first visit. */
export function seedDemoProducts(storage: Storage = localStorage, now = Date.now()) {
  try {
    // Once the key exists the list belongs to the user, even if they deleted everything.
    if (storage.getItem(PRODUCTS_KEY) !== null) return;
    const records = SAMPLES.map(({ name, type, segment, status, hoursAgo }, i): ProductRecord => {
      const at = now - hoursAgo * HOUR;
      const values = buildProductDraft(
        {
          productName: name,
          productType: type,
          marketSegment: segment,
          currency: 'BDT',
          createdBy: 'Demo data',
          schemes: [{ schemeId: 5, namedTemplateId: 101, anonymousTemplateId: null, ranges: [{ binId: 14, cardRangeId: 33 }] }],
        },
        { today: new Date(at) },
      );
      const record: ProductRecord = { productId: String(1001 + i), aspId: DEFAULT_ASP_ID, productName: name, status, values, createdBy: values.createdBy, createdAt: at, updatedAt: at };
      if (status !== 'DRAFT') record.submittedAt = at;
      return record;
    });
    storage.setItem(PRODUCTS_KEY, JSON.stringify(records));
  } catch {
    /* Storage is unavailable: the list just starts empty. */
  }
}

import type { ProductForm, ProductOrigin, ProductRecord } from '../types/product';
import { parseProductForm } from '../utils/productDraft';

export interface ProductSaveOptions {
  /** Updates this product (a saved draft) instead of creating a new one. */
  productId?: string;
  /** The chat message the product was started from. */
  origin?: ProductOrigin;
  signal?: AbortSignal;
}

/** Contract for the card management system's product API. Swap the mock for a real HTTP client. */
export interface ProductApi {
  /** Submits a product for approval. It stays `PENDING_APPROVAL` until an approver acts on it. */
  submitProduct(values: ProductForm, options?: ProductSaveOptions): Promise<ProductRecord>;
  /** Saves a product as a draft to finish later. */
  saveDraft(values: ProductForm, options?: ProductSaveOptions): Promise<ProductRecord>;
  getProduct(productId: string, options?: { signal?: AbortSignal }): Promise<ProductRecord | null>;
  /** Every product (drafts included), for reporting. */
  listProducts(options?: { signal?: AbortSignal }): Promise<ProductRecord[]>;
  /** Deletes a draft. Products that were submitted are kept. */
  deleteProduct(productId: string, options?: { signal?: AbortSignal }): Promise<void>;
}

export class ProductApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = 'ProductApiError';
  }
}

export const PRODUCTS_KEY = 'ai-chat:products:v2';

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function parseRecord(raw: unknown): ProductRecord | null {
  if (!isObj(raw) || typeof raw.productId !== 'string' || (raw.status !== 'DRAFT' && raw.status !== 'PENDING_APPROVAL' && raw.status !== 'REJECTED')) return null;
  const values = parseProductForm(raw.values);
  if (!values) return null;
  const record: ProductRecord = {
    productId: raw.productId,
    aspId: typeof raw.aspId === 'string' ? raw.aspId : values.aspId,
    productName: typeof raw.productName === 'string' ? raw.productName : values.productName,
    status: raw.status,
    values,
    createdBy: typeof raw.createdBy === 'string' ? raw.createdBy : '',
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : 0,
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : 0,
  };
  if (typeof raw.submittedAt === 'number') record.submittedAt = raw.submittedAt;
  if (isObj(raw.origin) && typeof raw.origin.conversationId === 'string' && typeof raw.origin.messageId === 'string') {
    record.origin = { conversationId: raw.origin.conversationId, messageId: raw.origin.messageId };
  }
  return record;
}

/**
 * Browser-only stand-in for the product API. It keeps products in localStorage, numbers them from 1001,
 * and rejects submitting a second product with the same name under the same ASP (HTTP 409).
 */
export class MockProductApi implements ProductApi {
  constructor(
    private readonly storage: Storage | null = safeStorage(),
    private readonly latencyMs = 900,
  ) {}

  private load(): ProductRecord[] {
    try {
      const parsed: unknown = JSON.parse(this.storage?.getItem(PRODUCTS_KEY) ?? '[]');
      return Array.isArray(parsed) ? parsed.map(parseRecord).filter((r): r is ProductRecord => r !== null) : [];
    } catch {
      return [];
    }
  }

  private save(products: ProductRecord[]) {
    try {
      this.storage?.setItem(PRODUCTS_KEY, JSON.stringify(products));
    } catch {
      throw new ProductApiError("The product couldn't be stored. Free up browser storage and try again.", 507, 'STORAGE_FULL');
    }
  }

  private wait(signal?: AbortSignal, ms = this.latencyMs) {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      });
    });
  }

  private async write(values: ProductForm, status: ProductRecord['status'], { productId, origin, signal }: ProductSaveOptions): Promise<ProductRecord> {
    await this.wait(signal);
    const products = this.load();
    const existing = productId ? products.find((p) => p.productId === productId) : undefined;
    if (productId && !existing) throw new ProductApiError(`Product ${productId} was not found.`, 404, 'NOT_FOUND');
    if (existing && existing.status !== 'DRAFT') throw new ProductApiError(`Product ${productId} was already submitted and can no longer be changed.`, 409, 'ALREADY_SUBMITTED');

    const name = values.productName.trim();
    if (status === 'PENDING_APPROVAL') {
      const duplicate = products.some((p) => p.productId !== productId && p.status === 'PENDING_APPROVAL' && p.aspId === values.aspId && p.productName.toLowerCase() === name.toLowerCase());
      if (duplicate) throw new ProductApiError(`A product named “${name}” already exists under ${values.aspId}.`, 409, 'DUPLICATE_PRODUCT');
    }

    const now = Date.now();
    const id = existing?.productId ?? String(products.reduce((max, p) => Math.max(max, Number(p.productId) || 0), 1000) + 1);
    const record: ProductRecord = {
      productId: id,
      aspId: values.aspId,
      productName: name,
      status,
      values,
      createdBy: values.createdBy,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    if (status === 'PENDING_APPROVAL') record.submittedAt = now;
    const from = origin ?? existing?.origin;
    if (from) record.origin = from;
    this.save(existing ? products.map((p) => (p.productId === id ? record : p)) : [...products, record]);
    return record;
  }

  submitProduct(values: ProductForm, options: ProductSaveOptions = {}) {
    return this.write(values, 'PENDING_APPROVAL', options);
  }

  saveDraft(values: ProductForm, options: ProductSaveOptions = {}) {
    return this.write(values, 'DRAFT', options);
  }

  async deleteProduct(productId: string, { signal }: { signal?: AbortSignal } = {}): Promise<void> {
    await this.wait(signal, Math.min(this.latencyMs, 250));
    const products = this.load();
    const existing = products.find((p) => p.productId === productId);
    if (!existing) throw new ProductApiError(`Product ${productId} was not found.`, 404, 'NOT_FOUND');
    if (existing.status !== 'DRAFT') throw new ProductApiError(`Product ${productId} was already submitted and can't be deleted.`, 409, 'ALREADY_SUBMITTED');
    this.save(products.filter((p) => p.productId !== productId));
  }

  async getProduct(productId: string, { signal }: { signal?: AbortSignal } = {}): Promise<ProductRecord | null> {
    // Reads are quicker than writes.
    await this.wait(signal, Math.min(this.latencyMs, 250));
    return this.load().find((p) => p.productId === productId) ?? null;
  }

  async listProducts({ signal }: { signal?: AbortSignal } = {}): Promise<ProductRecord[]> {
    await this.wait(signal, Math.min(this.latencyMs, 250));
    return this.load();
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export const mockProductApi = new MockProductApi();

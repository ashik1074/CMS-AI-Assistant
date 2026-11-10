import type { Attachment, ChatMode, Message, MessageStatus, ProcessingStep } from '../types/chat';
import type { Conversation, ConversationService, StorageError, StorageResult } from '../types/conversation';
import type { MessageAction, ProductField, ProductSetupAction, ProductSetupStatus } from '../types/product';
import type { ProductGroupBy, ProductReportAction, ProductReportStatus, ReportAction, ReportChart, TxnRange } from '../types/report';
import { GROUPINGS } from '../utils/reportData';
import type { CustomerIdType, CustomerLookupAction, CustomerSearchAction, CustomerSearchValues } from '../types/customer';
import { isValidId, validateCustomerSearch } from '../utils/customerData';
import { FIELD_LABELS, parseBasics, parseProductForm, parseProductPreferences } from '../utils/productDraft';

export const STORAGE_VERSION = 1;
export const CONVERSATIONS_KEY = `ai-chat:conversations:v${STORAGE_VERSION}`;

interface StoredPayload {
  version: number;
  conversations: unknown[];
}

const MESSAGE_STATUSES: MessageStatus[] = ['pending', 'streaming', 'completed', 'cancelled', 'failed'];
const MAX_TITLE = 120;
const CHAT_MODES: ChatMode[] = ['customerSearch', 'agentic', 'analytics'];

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function parseStep(raw: unknown): ProcessingStep | null {
  if (!isObj(raw) || !isStr(raw.id) || !isStr(raw.label)) return null;
  const status = raw.status === 'completed' || raw.status === 'active' || raw.status === 'pending' ? raw.status : 'pending';
  return { id: raw.id, label: raw.label, status };
}

function parseAttachment(raw: unknown): Attachment | null {
  if (!isObj(raw) || !isStr(raw.id) || !isStr(raw.name) || !isStr(raw.mimeType) || !isNum(raw.size)) return null;
  const attachment: Attachment = { id: raw.id, name: raw.name, mimeType: raw.mimeType, size: raw.size };
  if (isStr(raw.previewUrl) && raw.previewUrl.startsWith('data:image/')) attachment.previewUrl = raw.previewUrl;
  return attachment;
}

const SETUP_STATUSES: ProductSetupStatus[] = ['collecting', 'preparing', 'pending', 'submitting', 'savingDraft', 'submitted', 'draft', 'cancelled', 'failed'];

const CHARTS: ReportChart[] = ['pie', 'bar', 'histogram'];
const RANGES: TxnRange[] = ['24h', '7d', '30d', '1y'];

function parseReport(raw: Record<string, unknown>): ReportAction | null {
  if (raw.type === 'productReport') {
    const chart = CHARTS.includes(raw.chart as ReportChart) ? (raw.chart as ReportChart) : null;
    const groupBy = isStr(raw.groupBy) && raw.groupBy in GROUPINGS ? (raw.groupBy as ProductGroupBy) : null;
    // A report interrupted while "building" is simply shown; one missing a choice asks again.
    const status: ProductReportStatus = !chart || !groupBy || raw.status === 'choosing' ? 'choosing' : 'ready';
    const action: ProductReportAction = { type: 'productReport', status, chart, chartFromPrompt: raw.chartFromPrompt === true && chart !== null, groupBy };
    if (isNum(raw.generatedAt)) action.generatedAt = raw.generatedAt;
    return action;
  }
  if (raw.type === 'transactionReport' && isStr(raw.phone) && raw.phone && isNum(raw.asOf)) {
    return {
      type: 'transactionReport',
      phone: raw.phone.slice(0, 20),
      range: RANGES.includes(raw.range as TxnRange) ? (raw.range as TxnRange) : '7d',
      view: raw.view === 'amount' ? 'amount' : 'time',
      metric: raw.metric === 'amount' ? 'amount' : 'count',
      asOf: raw.asOf,
    };
  }
  return null;
}

const ID_TYPES: CustomerIdType[] = ['phone', 'cif', 'customerId', 'nid'];

function parseCustomerSearch(raw: Record<string, unknown>): CustomerSearchAction {
  const v = isObj(raw.values) ? raw.values : {};
  const values: CustomerSearchValues = { phone: isStr(v.phone) ? v.phone.slice(0, 32) : '', cif: isStr(v.cif) ? v.cif.slice(0, 32) : '', nid: isStr(v.nid) ? v.nid.slice(0, 32) : '' };
  // A search interrupted by a reload is simply finished, if the details are valid; otherwise the form is shown again.
  const searched = (raw.status === 'searching' || raw.status === 'found') && !Object.keys(validateCustomerSearch(values)).length;
  const action: CustomerSearchAction = { type: 'customerSearch', status: searched ? 'found' : 'collecting', values };
  if (searched && isNum(raw.searchedAt)) action.searchedAt = raw.searchedAt;
  return action;
}

function parseCustomerLookup(raw: Record<string, unknown>): CustomerLookupAction | null {
  if (!isStr(raw.query) || !raw.query) return null;
  const query = raw.query.slice(0, 32);
  const idType = ID_TYPES.includes(raw.idType as CustomerIdType) ? (raw.idType as CustomerIdType) : null;
  // A search interrupted by a reload is simply finished; without a known ID type, ask again.
  const status = !idType || raw.status === 'choosing' ? 'choosing' : isValidId(query, idType) ? 'found' : 'invalid';
  const action: CustomerLookupAction = { type: 'customerLookup', query, idType: status === 'choosing' ? null : idType, idTypeFromPrompt: raw.idTypeFromPrompt === true && status !== 'choosing', status };
  if (isNum(raw.searchedAt)) action.searchedAt = raw.searchedAt;
  return action;
}

function parseAction(raw: unknown): MessageAction | null {
  if (isObj(raw) && raw.type === 'customerLookup') return parseCustomerLookup(raw);
  if (isObj(raw) && raw.type === 'customerSearch') return parseCustomerSearch(raw);
  if (isObj(raw) && raw.type !== 'createProduct') return parseReport(raw);
  // Products "created" by older versions went through the same submission, so they read as submitted.
  const rawStatus = raw && isObj(raw) && raw.status === 'created' ? 'submitted' : isObj(raw) ? raw.status : undefined;
  if (!isObj(raw) || raw.type !== 'createProduct' || !SETUP_STATUSES.includes(rawStatus as ProductSetupStatus)) return null;
  const values = parseProductForm(raw.values);
  if (!values) return null;
  const userProvided = Array.isArray(raw.userProvided) ? raw.userProvided.filter((f): f is ProductField => isStr(f) && f in FIELD_LABELS) : [];
  // A save interrupted by a reload may or may not have reached the API, so ask the user to check before retrying.
  const interrupted = rawStatus === 'submitting' || rawStatus === 'savingDraft';
  const action: ProductSetupAction = {
    type: 'createProduct',
    // The setup is already built while it is "preparing"; after a reload there is nothing left to wait for.
    status: interrupted ? 'failed' : rawStatus === 'preparing' ? 'pending' : (rawStatus as ProductSetupStatus),
    values,
    userProvided,
    preferences: parseProductPreferences(raw.preferences),
    basics: parseBasics(raw.basics),
    // Older drafts had no basics step and went straight to review.
    basicsConfirmed: raw.basicsConfirmed === undefined ? rawStatus !== 'collecting' : raw.basicsConfirmed === true,
  };
  if (interrupted) action.error = 'The page was closed while the product was being saved. Check whether it exists before trying again.';
  else if (isStr(raw.error)) action.error = raw.error;
  if (isStr(raw.productId)) action.productId = raw.productId;
  if (isNum(raw.completedAt)) action.completedAt = raw.completedAt;
  return action;
}

/** Validates a stored message. In-flight messages are restored as cancelled — never as streaming. */
/** A whole number of tokens. */
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

export function parseMessage(raw: unknown, conversationId: string): Message | null {
  if (!isObj(raw)) return null;
  if (!isStr(raw.id) || !raw.id || (raw.role !== 'user' && raw.role !== 'assistant') || !isStr(raw.content) || !isNum(raw.createdAt)) return null;
  let status: MessageStatus = MESSAGE_STATUSES.includes(raw.status as MessageStatus) ? (raw.status as MessageStatus) : 'completed';
  if (status === 'pending' || status === 'streaming') status = 'cancelled';

  const message: Message = {
    id: raw.id,
    conversationId,
    role: raw.role,
    content: raw.content,
    createdAt: raw.createdAt,
    status,
  };
  if (isNum(raw.durationMs) && raw.durationMs >= 0) message.durationMs = raw.durationMs;
  if (isObj(raw.usage) && isCount(raw.usage.inputTokens) && isCount(raw.usage.outputTokens)) {
    message.usage = { inputTokens: raw.usage.inputTokens, outputTokens: raw.usage.outputTokens, ...(raw.usage.estimated === true ? { estimated: true } : {}) };
  }
  if (Array.isArray(raw.steps)) {
    const steps = raw.steps.map(parseStep).filter((s): s is ProcessingStep => s !== null);
    // An interrupted step must not look active after a reload.
    message.steps = steps.map((s) => (s.status === 'active' ? { ...s, status: 'pending' } : s));
  }
  if (raw.feedback === 'up' || raw.feedback === 'down') message.feedback = raw.feedback;
  if (isStr(raw.error)) message.error = raw.error;
  if (isNum(raw.revision)) message.revision = raw.revision;
  if (isNum(raw.editedAt)) message.editedAt = raw.editedAt;
  if (Array.isArray(raw.attachments)) {
    const attachments = raw.attachments.map(parseAttachment).filter((a): a is Attachment => a !== null);
    if (attachments.length) message.attachments = attachments;
  }
  if (CHAT_MODES.includes(raw.mode as ChatMode)) message.mode = raw.mode as ChatMode;
  if (raw.role === 'assistant' && raw.action !== undefined) {
    const action = parseAction(raw.action);
    if (action) message.action = action;
  }
  return message;
}

export function parseConversation(raw: unknown): Conversation | null {
  if (!isObj(raw) || !isStr(raw.id) || !raw.id || !isNum(raw.createdAt) || !isNum(raw.updatedAt) || !Array.isArray(raw.messages)) return null;
  const id = raw.id;
  const messages = raw.messages.map((m) => parseMessage(m, id)).filter((m): m is Message => m !== null);
  const title = isStr(raw.title) && raw.title.trim() ? raw.title.trim().slice(0, MAX_TITLE) : 'Untitled chat';
  const conversation: Conversation = { id, title, createdAt: raw.createdAt, updatedAt: raw.updatedAt, messages, status: 'idle' };
  if (isStr(raw.projectId) && raw.projectId) conversation.projectId = raw.projectId;
  return conversation;
}

function toStorageError(e: unknown): StorageError {
  if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22)) {
    return { code: 'quota_exceeded', message: 'Browser storage is full. Delete some conversations to keep saving new messages.' };
  }
  if (e instanceof DOMException && e.name === 'SecurityError') {
    return { code: 'unavailable', message: 'Browser storage is unavailable, so conversations will not be saved.' };
  }
  return { code: 'unknown', message: 'Conversations could not be saved to browser storage.' };
}

/** Strips runtime-only fields before writing. */
function serialize(conversation: Conversation): Conversation {
  const { status: _status, ...rest } = conversation;
  void _status;
  return rest;
}

export class LocalConversationService implements ConversationService {
  private cache: Conversation[] | null = null;
  private warnings: string[] = [];
  private readonly storage: Storage | null;

  constructor(storage?: Storage | null) {
    this.storage = storage === undefined ? safeLocalStorage() : storage;
  }

  getLoadWarnings(): string[] {
    this.load();
    return [...this.warnings];
  }

  private load(): Conversation[] {
    if (this.cache) return this.cache;
    this.warnings = [];
    if (!this.storage) {
      this.warnings.push('Browser storage is unavailable, so conversations will not be saved.');
      this.cache = [];
      return this.cache;
    }
    let raw: string | null;
    try {
      raw = this.storage.getItem(CONVERSATIONS_KEY);
    } catch (e) {
      if (import.meta.env.DEV) console.error('[conversationService] read failed', e);
      this.warnings.push('Saved conversations could not be read.');
      this.cache = [];
      return this.cache;
    }
    if (!raw) {
      this.cache = [];
      return this.cache;
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isObj(parsed) || !Array.isArray((parsed as unknown as StoredPayload).conversations)) throw new Error('Invalid payload shape');
      const items = (parsed as unknown as StoredPayload).conversations;
      const valid = items.map(parseConversation).filter((c): c is Conversation => c !== null);
      const seen = new Set<string>();
      this.cache = valid.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
      if (this.cache.length < items.length) {
        this.warnings.push(`${items.length - this.cache.length} saved conversation(s) were invalid and have been skipped.`);
      }
    } catch (e) {
      if (import.meta.env.DEV) console.warn('[conversationService] corrupted storage, starting fresh', e);
      this.warnings.push('Saved conversation data was corrupted and has been reset.');
      this.cache = [];
      // Keep a copy of the unreadable payload so data isn't silently destroyed.
      try {
        this.storage.setItem(`${CONVERSATIONS_KEY}:corrupted-backup`, raw);
        this.storage.removeItem(CONVERSATIONS_KEY);
      } catch {
        /* ignore */
      }
    }
    return this.cache;
  }

  private persist(next: Conversation[]): StorageResult<void> {
    this.cache = next;
    if (!this.storage) return { ok: false, error: { code: 'unavailable', message: 'Browser storage is unavailable, so conversations will not be saved.' } };
    try {
      const payload: StoredPayload = { version: STORAGE_VERSION, conversations: next.map(serialize) };
      this.storage.setItem(CONVERSATIONS_KEY, JSON.stringify(payload));
      return { ok: true, value: undefined };
    } catch (e) {
      if (import.meta.env.DEV) console.error('[conversationService] write failed', e);
      return { ok: false, error: toStorageError(e) };
    }
  }

  listConversations(): Conversation[] {
    return [...this.load()].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  getConversation(conversationId: string): Conversation | undefined {
    return this.load().find((c) => c.id === conversationId);
  }

  saveConversation(conversation: Conversation): StorageResult<void> {
    const list = this.load();
    const index = list.findIndex((c) => c.id === conversation.id);
    const next = index === -1 ? [...list, conversation] : list.map((c, i) => (i === index ? conversation : c));
    return this.persist(next);
  }

  /** Writes several conversations in one storage operation. */
  saveMany(conversations: Conversation[]): StorageResult<void> {
    const byId = new Map(this.load().map((c) => [c.id, c]));
    for (const c of conversations) byId.set(c.id, c);
    return this.persist([...byId.values()]);
  }

  /** Replaces the whole stored list (the in-memory app state is the source of truth). */
  replaceAll(conversations: Conversation[]): StorageResult<void> {
    return this.persist([...conversations]);
  }

  renameConversation(conversationId: string, title: string): StorageResult<Conversation> {
    const trimmed = title.trim().slice(0, MAX_TITLE);
    if (!trimmed) return { ok: false, error: { code: 'unknown', message: 'Title cannot be empty.' } };
    const existing = this.getConversation(conversationId);
    if (!existing) return { ok: false, error: { code: 'unknown', message: 'Conversation not found.' } };
    const updated = { ...existing, title: trimmed };
    const result = this.saveConversation(updated);
    return result.ok ? { ok: true, value: updated } : result;
  }

  deleteConversation(conversationId: string): StorageResult<void> {
    return this.persist(this.load().filter((c) => c.id !== conversationId));
  }

  clearAll(): StorageResult<void> {
    this.cache = [];
    if (!this.storage) return { ok: true, value: undefined };
    try {
      this.storage.removeItem(CONVERSATIONS_KEY);
      return { ok: true, value: undefined };
    } catch (e) {
      return { ok: false, error: toStorageError(e) };
    }
  }

  /** Drops the in-memory cache (used by tests to simulate a reload). */
  reload(): void {
    this.cache = null;
  }
}

function safeLocalStorage(): Storage | null {
  try {
    const s = window.localStorage;
    const probe = '__ai-chat-probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export const conversationService = new LocalConversationService();

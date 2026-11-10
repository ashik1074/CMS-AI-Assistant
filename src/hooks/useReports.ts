import { useCallback, useEffect, useMemo, useRef, type Dispatch } from 'react';
import type { ProductApi } from '../services/productService';
import type { Conversation } from '../types/conversation';
import type { MessageAction, ProductRecord } from '../types/product';
import type { ProductGroupBy, ProductReportAction, ReportAction, ReportChart, TransactionReportAction } from '../types/report';
import type { CustomerIdType, CustomerLookupAction, CustomerSearchAction, CustomerSearchValues } from '../types/customer';
import { isValidId, validateCustomerSearch } from '../utils/customerData';
import type { ConversationsAction } from './conversationReducer';

export interface ReportHandlers {
  /** Length of the "building your report" pause. */
  delayMs: number;
  loadProducts: (signal?: AbortSignal) => Promise<ProductRecord[]>;
  /** The user picked a grouping: show the build pause, then the chart. */
  generate: (messageId: string, chart: ReportChart, groupBy: ProductGroupBy) => void;
  /** Saves a view change (chart type, grouping, period, metric) so the chat reopens on it. */
  updateProductReport: (messageId: string, patch: Partial<Pick<ProductReportAction, 'groupBy'>>) => void;
  updateTransactionReport: (messageId: string, patch: Partial<Pick<TransactionReportAction, 'range' | 'view' | 'metric'>>) => void;
  /** Length of the "searching customer records" pause. */
  customerSearchMs: number;
  /** The user said what kind of ID the value is: search, then show the customer (or say the value can't be that ID). */
  searchCustomer: (messageId: string, idType: CustomerIdType) => void;
  /** Go back to choosing the kind of ID, e.g. after a value didn't fit the first choice. */
  rechooseCustomerIdType: (messageId: string) => void;
  /** The Customer Search form was filled in: search, then show the customer. */
  submitCustomerSearch: (messageId: string, values: CustomerSearchValues) => void;
  /** Opens a new, empty Customer Search form in the chat. */
  startCustomerSearch?: () => void;
}

export const REPORT_DELAY_MS = 3000;
export const CUSTOMER_SEARCH_MS = 1800;

const reportOf = <T extends ReportAction['type']>(action: MessageAction | undefined, type: T) => (action?.type === type ? (action as Extract<ReportAction, { type: T }>) : undefined);

interface UseReportsParams {
  productApi: ProductApi;
  dispatch: Dispatch<ConversationsAction>;
  getConversation: (id: string | null | undefined) => Conversation | undefined;
  conversationId: string | null;
  delayMs?: number;
  customerSearchMs?: number;
}

const lookupOf = (action: MessageAction | undefined) => (action?.type === 'customerLookup' ? action : undefined);
const searchOf = (action: MessageAction | undefined) => (action?.type === 'customerSearch' ? action : undefined);

export function useReports({ productApi, dispatch, getConversation, conversationId, delayMs = REPORT_DELAY_MS, customerSearchMs = CUSTOMER_SEARCH_MS }: UseReportsParams) {
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);
  const getLatest = useRef(getConversation);
  useEffect(() => {
    getLatest.current = getConversation;
  }, [getConversation]);

  const patch = useCallback(
    <T extends ReportAction['type']>(cid: string, messageId: string, type: T, changes: Partial<Extract<ReportAction, { type: T }>>) =>
      dispatch({ type: 'updateMessage', conversationId: cid, messageId, patch: (m) => (m.action?.type === type ? { action: { ...m.action, ...changes } as MessageAction } : {}) }),
    [dispatch],
  );

  const generate = useCallback(
    (messageId: string, chart: ReportChart, groupBy: ProductGroupBy) => {
      const cid = conversationId;
      const action = reportOf(getConversation(cid)?.messages.find((m) => m.id === messageId)?.action, 'productReport');
      if (!cid || !action || action.status !== 'choosing') return;
      patch(cid, messageId, 'productReport', { status: 'loading', chart, groupBy });
      const timer = setTimeout(() => {
        timers.current.delete(timer);
        const current = reportOf(getLatest.current(cid)?.messages.find((m) => m.id === messageId)?.action, 'productReport');
        if (current?.status === 'loading') patch(cid, messageId, 'productReport', { status: 'ready', generatedAt: Date.now() });
      }, delayMs);
      timers.current.add(timer);
    },
    [conversationId, delayMs, getConversation, patch],
  );

  const patchLookup = useCallback(
    (cid: string, messageId: string, changes: Partial<CustomerLookupAction>) =>
      dispatch({ type: 'updateMessage', conversationId: cid, messageId, patch: (m) => (m.action?.type === 'customerLookup' ? { action: { ...m.action, ...changes } } : {}) }),
    [dispatch],
  );

  const searchCustomer = useCallback(
    (messageId: string, idType: CustomerIdType) => {
      const cid = conversationId;
      const action = lookupOf(getConversation(cid)?.messages.find((m) => m.id === messageId)?.action);
      if (!cid || !action || action.status !== 'choosing') return;
      patchLookup(cid, messageId, { status: 'searching', idType });
      const timer = setTimeout(() => {
        timers.current.delete(timer);
        const current = lookupOf(getLatest.current(cid)?.messages.find((m) => m.id === messageId)?.action);
        if (current?.status === 'searching') patchLookup(cid, messageId, { status: isValidId(current.query, idType) ? 'found' : 'invalid', searchedAt: Date.now() });
      }, customerSearchMs);
      timers.current.add(timer);
    },
    [conversationId, customerSearchMs, getConversation, patchLookup],
  );

  const patchSearch = useCallback(
    (cid: string, messageId: string, changes: Partial<CustomerSearchAction>) =>
      dispatch({ type: 'updateMessage', conversationId: cid, messageId, patch: (m) => (m.action?.type === 'customerSearch' ? { action: { ...m.action, ...changes } } : {}) }),
    [dispatch],
  );

  const submitCustomerSearch = useCallback(
    (messageId: string, values: CustomerSearchValues) => {
      const cid = conversationId;
      const action = searchOf(getConversation(cid)?.messages.find((m) => m.id === messageId)?.action);
      if (!cid || !action || action.status !== 'collecting' || Object.keys(validateCustomerSearch(values)).length) return;
      patchSearch(cid, messageId, { status: 'searching', values });
      const timer = setTimeout(() => {
        timers.current.delete(timer);
        const current = searchOf(getLatest.current(cid)?.messages.find((m) => m.id === messageId)?.action);
        if (current?.status === 'searching') patchSearch(cid, messageId, { status: 'found', searchedAt: Date.now() });
      }, customerSearchMs);
      timers.current.add(timer);
    },
    [conversationId, customerSearchMs, getConversation, patchSearch],
  );

  const handlers: ReportHandlers = useMemo(
    () => ({
      delayMs,
      loadProducts: (signal) => productApi.listProducts({ signal }),
      generate,
      updateProductReport: (messageId, changes) => conversationId && patch(conversationId, messageId, 'productReport', changes),
      updateTransactionReport: (messageId, changes) => conversationId && patch(conversationId, messageId, 'transactionReport', changes),
      customerSearchMs,
      searchCustomer,
      rechooseCustomerIdType: (messageId) => conversationId && patchLookup(conversationId, messageId, { status: 'choosing', idType: null, idTypeFromPrompt: false }),
      submitCustomerSearch,
    }),
    [conversationId, customerSearchMs, delayMs, generate, patch, patchLookup, productApi, searchCustomer, submitCustomerSearch],
  );

  return handlers;
}

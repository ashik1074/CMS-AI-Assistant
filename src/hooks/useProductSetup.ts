import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch } from 'react';
import type { ProductSetupHandlers } from '../components/agent/ProductSetupCard';
import { ProductApiError, type ProductApi } from '../services/productService';
import type { Conversation } from '../types/conversation';
import type { MessageAction, ProductBasics, ProductField, ProductForm, ProductRecord, ProductSetupAction } from '../types/product';
import { createId } from '../utils/id';
import { BASIC_FIELDS, buildProductDraft, draftSavedText, submittedSummaryText } from '../utils/productDraft';
import type { ConversationsAction } from './conversationReducer';

interface UseProductSetupParams {
  productApi: ProductApi;
  dispatch: Dispatch<ConversationsAction>;
  getConversation: (id: string | null | undefined) => Conversation | undefined;
  conversationId: string | null;
  userName: string;
  onSubmitted?: (record: ProductRecord) => void;
  onDraftSaved?: (record: ProductRecord) => void;
  /** How long the assistant "prepares" the setup after the basics are answered. */
  prepareDelayMs?: number;
}

export const PREPARE_DELAY_MS = 5000;

/** The product setup attached to a message, if that is the kind of action it carries. */
const setupOf = (action: MessageAction | undefined): ProductSetupAction | undefined => (action?.type === 'createProduct' ? action : undefined);

export const productErrorMessage = (e: unknown) =>
  e instanceof ProductApiError ? `${e.message} (HTTP ${e.status} ${e.code})` : 'The product service could not be reached. Your choices are kept, so you can try again.';

/** Submit / save as draft / cancel / reopen for products the assistant prepares in a chat. */
export function useProductSetup({ productApi, dispatch, getConversation, conversationId, userName, onSubmitted, onDraftSaved, prepareDelayMs = PREPARE_DELAY_MS }: UseProductSetupParams) {
  const [announcement, setAnnouncement] = useState('');
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);
  const getLatest = useRef(getConversation);
  useEffect(() => {
    getLatest.current = getConversation;
  }, [getConversation]);

  const patchAction = useCallback(
    (cid: string, messageId: string, patch: Partial<ProductSetupAction>) =>
      dispatch({ type: 'updateMessage', conversationId: cid, messageId, patch: (m) => (m.action?.type === 'createProduct' ? { action: { ...m.action, ...patch } } : {}) }),
    [dispatch],
  );

  const addAssistantMessage = useCallback(
    (cid: string, content: string) => dispatch({ type: 'addMessages', conversationId: cid, messages: [{ id: createId(), conversationId: cid, role: 'assistant', content, createdAt: Date.now(), status: 'completed' }] }),
    [dispatch],
  );

  const save = useCallback(
    async (messageId: string, values: ProductForm, kind: 'submit' | 'draft') => {
      const cid = conversationId;
      const action = setupOf(getConversation(cid)?.messages.find((m) => m.id === messageId)?.action);
      if (!cid || !action || action.status === 'submitting' || action.status === 'savingDraft' || action.status === 'submitted') return;

      patchAction(cid, messageId, { status: kind === 'submit' ? 'submitting' : 'savingDraft', values, error: undefined });
      setAnnouncement(kind === 'submit' ? 'Submitting the product…' : 'Saving the draft…');
      try {
        const options = { productId: action.productId, origin: { conversationId: cid, messageId } };
        const record = kind === 'submit' ? await productApi.submitProduct(values, options) : await productApi.saveDraft(values, options);
        patchAction(cid, messageId, { status: kind === 'submit' ? 'submitted' : 'draft', productId: record.productId, completedAt: Date.now() });
        addAssistantMessage(cid, kind === 'submit' ? submittedSummaryText(values, record.productId) : draftSavedText(values, record.productId));
        if (kind === 'submit') {
          setAnnouncement(`Product ${record.productId} submitted. It is pending approval.`);
          onSubmitted?.(record);
        } else {
          setAnnouncement(`Draft ${record.productId} saved.`);
          onDraftSaved?.(record);
        }
      } catch (e) {
        const message = productErrorMessage(e);
        patchAction(cid, messageId, { status: 'failed', error: message });
        setAnnouncement(`${kind === 'submit' ? 'Submitting the product' : 'Saving the draft'} failed. ${message}`);
      }
    },
    [addAssistantMessage, conversationId, getConversation, onDraftSaved, onSubmitted, patchAction, productApi],
  );

  /** Builds the full proposal from the basics answers plus everything else the user said. */
  const continueSetup = useCallback(
    (messageId: string, basics: ProductBasics) => {
      const cid = conversationId;
      const action = setupOf(getConversation(cid)?.messages.find((m) => m.id === messageId)?.action);
      if (!cid || !action || action.status !== 'collecting' || !basics.productType || !basics.marketSegment) return;
      const values = buildProductDraft(
        { ...action.preferences, productType: basics.productType, currency: basics.currency, marketSegment: basics.marketSegment },
        { createdBy: userName },
      );
      const userProvided = [...new Set<ProductField>([...action.userProvided, ...BASIC_FIELDS])];
      patchAction(cid, messageId, { status: 'preparing', basics, basicsConfirmed: true, values, userProvided });
      setAnnouncement('Preparing the product setup…');
      // Show the form once the processing pause is over, unless the user cancelled meanwhile.
      const timer = setTimeout(() => {
        timers.current.delete(timer);
        const current = setupOf(getLatest.current(cid)?.messages.find((m) => m.id === messageId)?.action);
        if (current?.status !== 'preparing') return;
        patchAction(cid, messageId, { status: 'pending' });
        setAnnouncement('Product setup ready for review');
      }, prepareDelayMs);
      timers.current.add(timer);
    },
    [conversationId, getConversation, patchAction, prepareDelayMs, userName],
  );

  /** Mirrors a product saved or submitted outside the chat (on its draft page) onto the chat card it came from. */
  const syncFromRecord = useCallback(
    (record: ProductRecord) => {
      const origin = record.origin;
      if (!origin || !getConversation(origin.conversationId)?.messages.some((m) => m.id === origin.messageId && m.action)) return;
      patchAction(origin.conversationId, origin.messageId, {
        status: record.status === 'DRAFT' ? 'draft' : 'submitted',
        values: record.values,
        productId: record.productId,
        completedAt: record.updatedAt,
        error: undefined,
      });
    },
    [getConversation, patchAction],
  );

  const handlers: ProductSetupHandlers = useMemo(
    () => ({
      userName,
      prepareDelayMs,
      continueSetup,
      submit: (messageId, values) => void save(messageId, values, 'submit'),
      saveDraft: (messageId, values) => void save(messageId, values, 'draft'),
      cancel: (messageId) => conversationId && patchAction(conversationId, messageId, { status: 'cancelled', error: undefined }),
      reopen: (messageId) => {
        if (!conversationId) return;
        const action = setupOf(getConversation(conversationId)?.messages.find((m) => m.id === messageId)?.action);
        patchAction(conversationId, messageId, { status: action?.basicsConfirmed ? 'pending' : 'collecting' });
      },
    }),
    [continueSetup, conversationId, getConversation, patchAction, prepareDelayMs, save, userName],
  );

  return { handlers, announcement, syncFromRecord };
}

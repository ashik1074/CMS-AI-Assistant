import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import type { LocalConversationService } from '../services/conversationService';
import type { StorageError } from '../types/conversation';
import { conversationsReducer } from './conversationReducer';

const STREAMING_SAVE_DEBOUNCE_MS = 500;

/**
 * Conversation state with local persistence. In-memory state is the source of truth;
 * it's written to storage immediately when idle and debounced while a response streams.
 */
export function useConversations(service: LocalConversationService, onStorageError: (error: StorageError) => void) {
  const [state, dispatch] = useReducer(conversationsReducer, undefined, () => ({ conversations: service.listConversations() }));
  const loadWarnings = useMemo(() => service.getLoadWarnings(), [service]);

  const latest = useRef(state);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastErrorCode = useRef<string | null>(null);
  const onErrorRef = useRef(onStorageError);
  useEffect(() => {
    onErrorRef.current = onStorageError;
  }, [onStorageError]);

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = undefined;
    const result = service.replaceAll(latest.current.conversations);
    if (result.ok) {
      lastErrorCode.current = null;
    } else if (lastErrorCode.current !== result.error.code) {
      // Report each distinct failure once instead of on every streamed token.
      lastErrorCode.current = result.error.code;
      onErrorRef.current(result.error);
    }
    return result.ok;
  }, [service]);

  useEffect(() => {
    latest.current = state;
    const generating = state.conversations.some((c) => c.status === 'generating');
    if (!generating) {
      flush();
    } else if (timer.current === undefined) {
      timer.current = setTimeout(flush, STREAMING_SAVE_DEBOUNCE_MS);
    }
  }, [state, flush]);

  useEffect(() => {
    const onHide = () => flush();
    window.addEventListener('pagehide', onHide);
    window.addEventListener('beforeunload', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('beforeunload', onHide);
      clearTimeout(timer.current);
    };
  }, [flush]);

  const conversations = useMemo(() => [...state.conversations].sort((a, b) => b.updatedAt - a.updatedAt), [state.conversations]);

  const getConversation = useCallback((id: string | null | undefined) => (id ? state.conversations.find((c) => c.id === id) : undefined), [state.conversations]);

  /** Renames and saves immediately. Returns false for an empty title. */
  const rename = useCallback((id: string, title: string) => {
    if (!title.trim()) return false;
    dispatch({ type: 'rename', conversationId: id, title });
    return true;
  }, []);

  /** Deletes and returns whether the change was persisted. */
  const remove = useCallback(
    (id: string) => {
      latest.current = conversationsReducer(latest.current, { type: 'delete', conversationId: id });
      dispatch({ type: 'delete', conversationId: id });
      return flush();
    },
    [flush],
  );

  const clearAll = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = undefined;
    const result = service.clearAll();
    latest.current = { conversations: [] };
    dispatch({ type: 'clearAll' });
    if (!result.ok) onErrorRef.current(result.error);
    return result.ok;
  }, [service]);

  return { conversations, getConversation, dispatch, rename, remove, clearAll, loadWarnings, flush };
}

import { useCallback, useState, type Dispatch } from 'react';
import type { AIService, Attachment, ChatHistoryEntry, ChatMode, Feedback, GenerationEvent, Message } from '../types/chat';
import type { Conversation, Settings } from '../types/conversation';
import { SPEED_PRESETS } from '../services/settingsService';
import { promptWithAttachments } from '../utils/attachments';
import { createId } from '../utils/id';
import { titleFromPrompt } from '../utils/markdown';
import { estimateUsage } from '../utils/tokens';
import type { ConversationsAction } from './conversationReducer';
import { useStreamingMock } from './useStreamingMock';

export interface SendOptions {
  attachments?: Attachment[];
  mode?: ChatMode;
  /** Project for a newly created conversation. Ignored when sending into an existing one. */
  projectId?: string;
}

export type SendResult = { ok: true; conversationId: string } | { ok: false; reason: 'empty' | 'busy' | 'missing' };

interface UseChatParams {
  aiService: AIService;
  dispatch: Dispatch<ConversationsAction>;
  getConversation: (id: string | null | undefined) => Conversation | undefined;
  settings: Settings;
  onConversationCreated: (conversationId: string) => void;
}

const toHistory = (messages: Message[]): ChatHistoryEntry[] =>
  messages.filter((m) => m.role === 'user' || m.status === 'completed').map((m) => ({ role: m.role, content: promptWithAttachments(m.content, m.attachments) }));

const NBSP = String.fromCharCode(160);

function newAssistantMessage(conversationId: string): Message {
  return { id: createId(), conversationId, role: 'assistant', content: '', createdAt: Date.now(), status: 'pending', steps: [], revision: 0 };
}

/** Orchestrates the send → think → steps → stream → complete lifecycle on top of the conversation store. */
export function useChat({ aiService, dispatch, getConversation, settings, onConversationCreated }: UseChatParams) {
  const streaming = useStreamingMock(aiService);
  /** Polite screen-reader announcement for meaningful state changes (never per token). */
  const [announcement, setAnnouncement] = useState('');
  // Toggle a trailing no-break space so an identical message is announced again.
  const announce = useCallback((text: string) => setAnnouncement((prev) => (prev === text ? text + NBSP : text)), []);

  const runGeneration = useCallback(
    (conversationId: string, messageId: string, prompt: string, history: ChatHistoryEntry[], variant: number, mode?: ChatMode) => {
      const update = (patch: Partial<Message> | ((m: Message) => Partial<Message>)) =>
        dispatch({ type: 'updateMessage', conversationId, messageId, patch });
      const settleSteps = (m: Message) => m.steps?.map((s) => (s.status === 'active' ? { ...s, status: 'pending' as const } : s));

      const onEvent = (event: GenerationEvent) => {
        switch (event.type) {
          case 'started':
            update({ status: 'pending', steps: event.steps.map((s) => ({ ...s, status: 'pending' })), usage: event.usage ?? estimateUsage(history, prompt, '') });
            announce('Assistant is thinking');
            break;
          case 'step_started':
          case 'step_completed': {
            const status = event.type === 'step_started' ? 'active' : 'completed';
            update((m) => ({ steps: m.steps?.map((s) => (s.id === event.stepId ? { ...s, status } : s)) }));
            break;
          }
          case 'token':
            dispatch({ type: 'appendToken', conversationId, messageId, token: event.token });
            break;
          case 'completed':
            update({ status: 'completed', content: event.content, durationMs: event.durationMs, usage: event.usage ?? estimateUsage(history, prompt, event.content), ...(event.action ? { action: event.action } : {}) });
            announce('Response complete');
            break;
          case 'cancelled':
            update((m) => ({ status: 'cancelled', durationMs: event.durationMs, steps: settleSteps(m), usage: event.usage ?? estimateUsage(history, prompt, m.content) }));
            announce('Response stopped');
            break;
          case 'error':
            update((m) => ({ status: 'failed', error: event.error.message, durationMs: event.durationMs, steps: settleSteps(m) }));
            announce(`Response failed. ${event.error.message}`);
            break;
        }
      };

      const options = { ...SPEED_PRESETS[settings.streamingSpeed], enableSteps: settings.enableSteps };
      const request = { requestId: createId(), conversationId, prompt, history, variant, mode: mode ?? 'general' };
      const run = streaming.start(conversationId, request, options, onEvent);
      if (!run) return false;
      dispatch({ type: 'setStatus', conversationId, status: 'generating' });
      void run.finally(() => dispatch({ type: 'setStatus', conversationId, status: 'idle' }));
      return true;
    },
    [announce, dispatch, settings.enableSteps, settings.streamingSpeed, streaming],
  );

  const sendMessage = useCallback(
    (text: string, conversationId: string | null, { attachments = [], mode = 'general', projectId }: SendOptions = {}): SendResult => {
      const content = text.trim();
      if (!content && attachments.length === 0) return { ok: false, reason: 'empty' };
      const prompt = promptWithAttachments(content, attachments);

      let conversation = conversationId ? getConversation(conversationId) : undefined;
      if (conversationId && !conversation) return { ok: false, reason: 'missing' };
      if (conversation && streaming.isRunning(conversation.id)) return { ok: false, reason: 'busy' };

      if (!conversation) {
        const now = Date.now();
        conversation = { id: createId(), title: titleFromPrompt(content || attachments[0].name), createdAt: now, updatedAt: now, messages: [], status: 'idle' };
        if (projectId) conversation.projectId = projectId;
        dispatch({ type: 'create', conversation });
      }
      const id = conversation.id;
      const userMessage: Message = { id: createId(), conversationId: id, role: 'user', content, createdAt: Date.now(), status: 'completed' };
      if (attachments.length) userMessage.attachments = attachments;
      if (mode !== 'general') userMessage.mode = mode;
      const assistant = newAssistantMessage(id);
      dispatch({ type: 'addMessages', conversationId: id, messages: [userMessage, assistant] });
      if (!conversationId) onConversationCreated(id);

      runGeneration(id, assistant.id, prompt, toHistory([...conversation.messages, userMessage]), 0, mode);
      return { ok: true, conversationId: id };
    },
    [dispatch, getConversation, onConversationCreated, runGeneration, streaming],
  );

  const stop = useCallback((conversationId: string) => streaming.stop(conversationId), [streaming]);

  /** Re-runs an assistant response using the preceding user prompt; later messages are discarded. */
  const regenerate = useCallback(
    (conversationId: string, assistantMessageId: string) => {
      const conversation = getConversation(conversationId);
      if (!conversation || streaming.isRunning(conversationId)) return false;
      const index = conversation.messages.findIndex((m) => m.id === assistantMessageId);
      const target = conversation.messages[index];
      if (!target || target.role !== 'assistant') return false;
      const userIndex = conversation.messages.slice(0, index).findLastIndex((m) => m.role === 'user');
      if (userIndex === -1) return false;
      const userMessage = conversation.messages[userIndex];
      const prompt = promptWithAttachments(userMessage.content, userMessage.attachments);

      dispatch({ type: 'truncateAfter', conversationId, messageId: assistantMessageId });
      const revision = (target.revision ?? 0) + 1;
      dispatch({
        type: 'updateMessage',
        conversationId,
        messageId: assistantMessageId,
        patch: { content: '', status: 'pending', steps: [], durationMs: undefined, error: undefined, feedback: undefined, action: undefined, usage: undefined, revision, createdAt: Date.now() },
      });
      return runGeneration(conversationId, assistantMessageId, prompt, toHistory(conversation.messages.slice(0, userIndex + 1)), revision, userMessage.mode);
    },
    [dispatch, getConversation, runGeneration, streaming],
  );

  /** Updates a user message, discards everything after it, and generates a fresh response. */
  const editAndResubmit = useCallback(
    (conversationId: string, userMessageId: string, text: string) => {
      const content = text.trim();
      const conversation = getConversation(conversationId);
      if (!conversation || streaming.isRunning(conversationId)) return false;
      const index = conversation.messages.findIndex((m) => m.id === userMessageId);
      const target = conversation.messages[index];
      if (!target || target.role !== 'user') return false;
      // A message may be emptied only if it still carries attachments.
      if (!content && !target.attachments?.length) return false;

      dispatch({ type: 'updateMessage', conversationId, messageId: userMessageId, patch: { content, editedAt: Date.now() } });
      dispatch({ type: 'truncateAfter', conversationId, messageId: userMessageId });
      const assistant = newAssistantMessage(conversationId);
      dispatch({ type: 'addMessages', conversationId, messages: [assistant] });
      const history = toHistory([...conversation.messages.slice(0, index), { ...target, content }]);
      return runGeneration(conversationId, assistant.id, promptWithAttachments(content, target.attachments), history, 0, target.mode);
    },
    [dispatch, getConversation, runGeneration, streaming],
  );

  const setFeedback = useCallback(
    (conversationId: string, messageId: string, feedback: Feedback) => {
      dispatch({ type: 'updateMessage', conversationId, messageId, patch: (m) => ({ feedback: m.feedback === feedback ? undefined : feedback }) });
    },
    [dispatch],
  );

  return {
    sendMessage,
    stop,
    stopAll: streaming.stopAll,
    regenerate,
    editAndResubmit,
    setFeedback,
    isGenerating: streaming.isRunning,
    announcement,
  };
}

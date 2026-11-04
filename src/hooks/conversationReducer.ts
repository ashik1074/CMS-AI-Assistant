import type { Message } from '../types/chat';
import type { Conversation, ConversationStatus } from '../types/conversation';

export interface ConversationsState {
  conversations: Conversation[];
}

export type ConversationsAction =
  | { type: 'create'; conversation: Conversation }
  | { type: 'addMessages'; conversationId: string; messages: Message[] }
  | { type: 'updateMessage'; conversationId: string; messageId: string; patch: Partial<Message> | ((m: Message) => Partial<Message>) }
  | { type: 'appendToken'; conversationId: string; messageId: string; token: string }
  /** Removes all messages after `messageId` (exclusive). */
  | { type: 'truncateAfter'; conversationId: string; messageId: string }
  | { type: 'setStatus'; conversationId: string; status: ConversationStatus }
  | { type: 'rename'; conversationId: string; title: string }
  | { type: 'delete'; conversationId: string }
  /** Moves a chat into a project, or out of any project when `projectId` is null. */
  | { type: 'setProject'; conversationId: string; projectId: string | null }
  /** Takes every chat out of a deleted project (the chats themselves are kept). */
  | { type: 'detachProject'; projectId: string }
  | { type: 'clearAll' };

function mapConversation(state: ConversationsState, id: string, fn: (c: Conversation) => Conversation): ConversationsState {
  let changed = false;
  const conversations = state.conversations.map((c) => {
    if (c.id !== id) return c;
    const next = fn(c);
    if (next !== c) changed = true;
    return next;
  });
  // Unknown ids (e.g. a conversation deleted mid-stream) are a no-op and never recreate data.
  return changed ? { conversations } : state;
}

export function conversationsReducer(state: ConversationsState, action: ConversationsAction): ConversationsState {
  const now = Date.now();
  switch (action.type) {
    case 'create':
      if (state.conversations.some((c) => c.id === action.conversation.id)) return state;
      return { conversations: [action.conversation, ...state.conversations] };

    case 'addMessages':
      return mapConversation(state, action.conversationId, (c) => ({
        ...c,
        messages: [...c.messages, ...action.messages],
        updatedAt: now,
      }));

    case 'updateMessage':
      return mapConversation(state, action.conversationId, (c) => {
        const index = c.messages.findIndex((m) => m.id === action.messageId);
        if (index === -1) return c;
        const current = c.messages[index];
        const patch = typeof action.patch === 'function' ? action.patch(current) : action.patch;
        const messages = c.messages.slice();
        messages[index] = { ...current, ...patch };
        return { ...c, messages };
      });

    case 'appendToken':
      return mapConversation(state, action.conversationId, (c) => {
        const index = c.messages.findIndex((m) => m.id === action.messageId);
        if (index === -1) return c;
        const current = c.messages[index];
        // Ignore late tokens once a message reached a terminal state.
        if (current.status !== 'pending' && current.status !== 'streaming') return c;
        const messages = c.messages.slice();
        messages[index] = { ...current, status: 'streaming', content: current.content + action.token };
        return { ...c, messages };
      });

    case 'truncateAfter':
      return mapConversation(state, action.conversationId, (c) => {
        const index = c.messages.findIndex((m) => m.id === action.messageId);
        if (index === -1 || index === c.messages.length - 1) return c;
        return { ...c, messages: c.messages.slice(0, index + 1), updatedAt: now };
      });

    case 'setStatus':
      return mapConversation(state, action.conversationId, (c) =>
        c.status === action.status ? c : { ...c, status: action.status, updatedAt: action.status === 'idle' ? now : c.updatedAt },
      );

    case 'rename': {
      const title = action.title.trim();
      if (!title) return state;
      return mapConversation(state, action.conversationId, (c) => (c.title === title ? c : { ...c, title }));
    }

    case 'delete':
      return { conversations: state.conversations.filter((c) => c.id !== action.conversationId) };

    case 'setProject':
      return mapConversation(state, action.conversationId, (c) => {
        if ((c.projectId ?? null) === action.projectId) return c;
        const { projectId: _old, ...rest } = c;
        void _old;
        return action.projectId ? { ...rest, projectId: action.projectId } : rest;
      });

    case 'detachProject': {
      if (!state.conversations.some((c) => c.projectId === action.projectId)) return state;
      return {
        conversations: state.conversations.map((c) => {
          if (c.projectId !== action.projectId) return c;
          const { projectId: _old, ...rest } = c;
          void _old;
          return rest;
        }),
      };
    }

    case 'clearAll':
      return { conversations: [] };
  }
}

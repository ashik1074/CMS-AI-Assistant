import { describe, expect, it } from 'vitest';
import type { Message } from '../types/chat';
import type { Conversation } from '../types/conversation';
import { conversationsReducer, type ConversationsState } from './conversationReducer';

const msg = (id: string, overrides: Partial<Message> = {}): Message => ({
  id,
  conversationId: 'c',
  role: 'assistant',
  content: '',
  createdAt: 1,
  status: 'streaming',
  ...overrides,
});
const conversation = (messages: Message[]): Conversation => ({ id: 'c', title: 'T', createdAt: 1, updatedAt: 1, messages });
const state = (messages: Message[]): ConversationsState => ({ conversations: [conversation(messages)] });

describe('conversationsReducer', () => {
  it('appends tokens to an in-flight message', () => {
    const next = conversationsReducer(state([msg('a', { content: 'Hel' })]), { type: 'appendToken', conversationId: 'c', messageId: 'a', token: 'lo' });
    expect(next.conversations[0].messages[0].content).toBe('Hello');
  });

  it('ignores late tokens after a terminal status', () => {
    const s = state([msg('a', { content: 'Hi', status: 'cancelled' })]);
    expect(conversationsReducer(s, { type: 'appendToken', conversationId: 'c', messageId: 'a', token: '!' })).toBe(s);
  });

  it('is a no-op for unknown conversations (e.g. deleted mid-stream)', () => {
    const s = state([]);
    expect(conversationsReducer(s, { type: 'appendToken', conversationId: 'gone', messageId: 'a', token: 'x' })).toBe(s);
    expect(conversationsReducer(s, { type: 'updateMessage', conversationId: 'gone', messageId: 'a', patch: { status: 'completed' } })).toBe(s);
  });

  it('truncates messages after a given message', () => {
    const s = state([msg('1', { role: 'user' }), msg('2'), msg('3', { role: 'user' }), msg('4')]);
    const next = conversationsReducer(s, { type: 'truncateAfter', conversationId: 'c', messageId: '2' });
    expect(next.conversations[0].messages.map((m) => m.id)).toEqual(['1', '2']);
  });

  it('rejects empty renames', () => {
    const s = state([]);
    expect(conversationsReducer(s, { type: 'rename', conversationId: 'c', title: '  ' })).toBe(s);
    expect(conversationsReducer(s, { type: 'rename', conversationId: 'c', title: ' New ' }).conversations[0].title).toBe('New');
  });

  it('deletes and clears', () => {
    const s = state([]);
    expect(conversationsReducer(s, { type: 'delete', conversationId: 'c' }).conversations).toEqual([]);
    expect(conversationsReducer(s, { type: 'clearAll' }).conversations).toEqual([]);
  });

  it('moves a chat into and out of a project', () => {
    const inProject = conversationsReducer(state([]), { type: 'setProject', conversationId: 'c', projectId: 'p1' });
    expect(inProject.conversations[0].projectId).toBe('p1');
    expect(conversationsReducer(inProject, { type: 'setProject', conversationId: 'c', projectId: 'p1' })).toBe(inProject);
    const out = conversationsReducer(inProject, { type: 'setProject', conversationId: 'c', projectId: null });
    expect(out.conversations[0]).not.toHaveProperty('projectId');
  });

  it('detaches every chat from a deleted project but keeps the chats', () => {
    const s: ConversationsState = {
      conversations: [
        { ...conversation([]), id: 'a', projectId: 'p1' },
        { ...conversation([]), id: 'b', projectId: 'p2' },
      ],
    };
    const next = conversationsReducer(s, { type: 'detachProject', projectId: 'p1' });
    expect(next.conversations).toHaveLength(2);
    expect(next.conversations[0]).not.toHaveProperty('projectId');
    expect(next.conversations[1].projectId).toBe('p2');
    expect(conversationsReducer(next, { type: 'detachProject', projectId: 'missing' })).toBe(next);
  });

  it('does not create duplicate conversations', () => {
    const s = state([]);
    expect(conversationsReducer(s, { type: 'create', conversation: conversation([]) })).toBe(s);
  });
});

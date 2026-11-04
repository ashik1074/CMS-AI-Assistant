import { beforeEach, describe, expect, it } from 'vitest';
import type { Conversation } from '../types/conversation';
import { CONVERSATIONS_KEY, LocalConversationService } from './conversationService';

const conv = (id: string, overrides: Partial<Conversation> = {}): Conversation => ({
  id,
  title: `Chat ${id}`,
  createdAt: 1,
  updatedAt: 2,
  messages: [{ id: `${id}-m1`, conversationId: id, role: 'user', content: 'Hello', createdAt: 1, status: 'completed' }],
  ...overrides,
});

describe('LocalConversationService', () => {
  beforeEach(() => localStorage.clear());

  it('saves and restores conversations', () => {
    const a = new LocalConversationService(localStorage);
    expect(a.saveConversation(conv('1')).ok).toBe(true);
    const b = new LocalConversationService(localStorage);
    expect(b.listConversations()).toHaveLength(1);
    expect(b.getConversation('1')?.messages[0].content).toBe('Hello');
  });

  it('uses a versioned key', () => {
    new LocalConversationService(localStorage).saveConversation(conv('1'));
    expect(CONVERSATIONS_KEY).toMatch(/:v\d+$/);
    expect(JSON.parse(localStorage.getItem(CONVERSATIONS_KEY)!).version).toBe(1);
  });

  it('never restores a message as streaming or pending', () => {
    const c = conv('1', {
      messages: [
        { id: 'a', conversationId: '1', role: 'assistant', content: 'Partial', createdAt: 1, status: 'streaming', steps: [{ id: 's', label: 'Step', status: 'active' }] },
        { id: 'b', conversationId: '1', role: 'assistant', content: '', createdAt: 1, status: 'pending' },
      ],
    });
    new LocalConversationService(localStorage).saveConversation(c);
    const restored = new LocalConversationService(localStorage).getConversation('1')!;
    expect(restored.messages.map((m) => m.status)).toEqual(['cancelled', 'cancelled']);
    expect(restored.messages[0].steps?.[0].status).toBe('pending');
  });

  it('handles corrupted JSON gracefully and keeps a backup', () => {
    localStorage.setItem(CONVERSATIONS_KEY, '{not json');
    const s = new LocalConversationService(localStorage);
    expect(s.listConversations()).toEqual([]);
    expect(s.getLoadWarnings()[0]).toMatch(/corrupted/);
    expect(localStorage.getItem(`${CONVERSATIONS_KEY}:corrupted-backup`)).toBe('{not json');
  });

  it('skips invalid entries but keeps valid ones', () => {
    localStorage.setItem(
      CONVERSATIONS_KEY,
      JSON.stringify({ version: 1, conversations: [conv('ok'), { id: 5 }, null, { ...conv('bad-msg'), messages: [{ role: 'hacker' }, conv('x').messages[0]] }] }),
    );
    const s = new LocalConversationService(localStorage);
    const list = s.listConversations();
    expect(list.map((c) => c.id).sort()).toEqual(['bad-msg', 'ok']);
    expect(s.getConversation('bad-msg')!.messages).toHaveLength(1);
    expect(s.getLoadWarnings()[0]).toMatch(/2 saved conversation/);
  });

  it('handles a wrong payload shape', () => {
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(['array instead of object']));
    expect(new LocalConversationService(localStorage).listConversations()).toEqual([]);
  });

  it('renames with validation', () => {
    const s = new LocalConversationService(localStorage);
    s.saveConversation(conv('1'));
    expect(s.renameConversation('1', '   ').ok).toBe(false);
    expect(s.renameConversation('1', 'New name').ok).toBe(true);
    expect(new LocalConversationService(localStorage).getConversation('1')!.title).toBe('New name');
  });

  it('deletes permanently', () => {
    const s = new LocalConversationService(localStorage);
    s.saveConversation(conv('1'));
    s.saveConversation(conv('2'));
    s.deleteConversation('1');
    expect(new LocalConversationService(localStorage).listConversations().map((c) => c.id)).toEqual(['2']);
  });

  it('clears all conversations', () => {
    const s = new LocalConversationService(localStorage);
    s.saveConversation(conv('1'));
    s.clearAll();
    expect(new LocalConversationService(localStorage).listConversations()).toEqual([]);
  });

  it('reports quota errors without throwing', () => {
    const full: Storage = {
      ...localStorage,
      length: 0,
      getItem: () => null,
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError');
      },
      removeItem: () => {},
      clear: () => {},
      key: () => null,
    };
    const result = new LocalConversationService(full).saveConversation(conv('1'));
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe('quota_exceeded');
  });

  it('works when storage is unavailable', () => {
    const s = new LocalConversationService(null);
    expect(s.listConversations()).toEqual([]);
    expect(s.saveConversation(conv('1')).ok).toBe(false);
    expect(s.getLoadWarnings()[0]).toMatch(/unavailable/);
  });
});

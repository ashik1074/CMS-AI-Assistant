import { describe, expect, it } from 'vitest';
import { chunkText, isSafeUrl, titleFromPrompt } from './markdown';
import { formatDuration, getDateGroup, groupConversations } from './formatTime';
import { summarizeText } from './mockResponses';
import { searchConversations } from './search';
import { collectLibraryItems, filterLibraryItems } from './library';
import { parseHash, routeToHash } from '../app/routes';
import type { Conversation } from '../types/conversation';
import { buildSharedChat, decodeSharedChat, encodeSharedChat, sharedChatToMarkdown } from './share';

describe('chunkText', () => {
  it('preserves the original text exactly', () => {
    const text = 'Hello  world.\n\n```ts\nconst x = 1;\n```\n  trailing  ';
    for (const size of [1, 2, 5, 100]) expect(chunkText(text, size).join('')).toBe(text);
  });
  it('groups words by chunk size', () => {
    expect(chunkText('a b c d e', 2)).toEqual(['a b', ' c d', ' e']);
  });
});

describe('isSafeUrl', () => {
  it.each(['https://example.com', 'http://x.y', 'mailto:a@b.c', '#anchor', '/path', 'relative/page'])('allows %s', (u) => expect(isSafeUrl(u)).toBe(true));
  it.each(['javascript:alert(1)', 'JaVaScRiPt:alert(1)', ' javascript:alert(1)', 'java\tscript:alert(1)', 'data:text/html,<script>', 'vbscript:x', '//evil.com', ''])(
    'blocks %s',
    (u) => expect(isSafeUrl(u)).toBe(false),
  );
});

describe('titleFromPrompt', () => {
  it('uses the first non-empty line, collapsed and truncated', () => {
    expect(titleFromPrompt('\n  Hello   there \nsecond')).toBe('Hello there');
    expect(titleFromPrompt('x'.repeat(100)).length).toBeLessThanOrEqual(60);
    expect(titleFromPrompt('   ')).toBe('New chat');
  });
});

describe('date grouping', () => {
  const now = new Date(2026, 9, 13, 15, 0).getTime();
  it('buckets by local day', () => {
    expect(getDateGroup(new Date(2026, 9, 13, 0, 1).getTime(), now)).toBe('Today');
    expect(getDateGroup(new Date(2026, 9, 12, 23, 59).getTime(), now)).toBe('Yesterday');
    expect(getDateGroup(new Date(2026, 9, 8).getTime(), now)).toBe('Previous 7 Days');
    expect(getDateGroup(new Date(2026, 8, 1).getTime(), now)).toBe('Older');
  });
  it('sorts by recent activity and omits empty groups', () => {
    const c = (id: string, updatedAt: number): Conversation => ({ id, title: id, createdAt: 0, updatedAt, messages: [] });
    const groups = groupConversations([c('old', new Date(2026, 0, 1).getTime()), c('a', now - 1000), c('b', now - 10)], now);
    expect(groups.map((g) => g.group)).toEqual(['Today', 'Older']);
    expect(groups[0].conversations.map((x) => x.id)).toEqual(['b', 'a']);
  });
});

describe('formatDuration', () => {
  it('formats measured durations', () => {
    expect(formatDuration(300)).toBe('1 second');
    expect(formatDuration(4200)).toBe('4 seconds');
    expect(formatDuration(65_000)).toBe('1m 5s');
  });
});

describe('summarizeText', () => {
  it('extracts representative sentences in original order', () => {
    const text =
      'Cats are popular pets around the world. Cats sleep for most of the day and cats are curious. Dogs bark loudly at night sometimes. Many people love cats because cats are independent.';
    const { points, sentences } = summarizeText(text, 2);
    expect(sentences).toBe(4);
    expect(points).toHaveLength(2);
    expect(text.indexOf(points[0])).toBeLessThan(text.indexOf(points[1]));
  });
});

describe('searchConversations', () => {
  const convs: Conversation[] = [
    { id: '1', title: 'Debounce in TS', createdAt: 0, updatedAt: 0, messages: [] },
    { id: '2', title: 'Other', createdAt: 0, updatedAt: 0, messages: [{ id: 'm', conversationId: '2', role: 'assistant', content: 'The event loop runs tasks', createdAt: 0, status: 'completed' }] },
  ];
  it('matches titles and message content case-insensitively', () => {
    expect(searchConversations(convs, 'debounce').map((r) => r.conversation.id)).toEqual(['1']);
    const r = searchConversations(convs, 'EVENT LOOP');
    expect(r.map((x) => x.conversation.id)).toEqual(['2']);
    expect(r[0].snippet).toContain('event loop');
    expect(searchConversations(convs, 'nothing here')).toEqual([]);
  });
});

describe('library', () => {
  const att = (name: string, mimeType: string) => ({ id: name, name, mimeType, size: 10 });
  const conversations: Conversation[] = [
    {
      id: 'c1',
      title: 'Fees',
      createdAt: 1,
      updatedAt: 1,
      messages: [
        { id: 'm1', conversationId: 'c1', role: 'user', content: '', createdAt: 5, status: 'completed', attachments: [att('chart.png', 'image/png'), att('fees.pdf', 'application/pdf')] },
        { id: 'm2', conversationId: 'c1', role: 'assistant', content: 'ok', createdAt: 6, status: 'completed' },
      ],
    },
    { id: 'c2', title: 'Schemes', createdAt: 2, updatedAt: 2, messages: [{ id: 'm3', conversationId: 'c2', role: 'user', content: 'x', createdAt: 9, status: 'completed', attachments: [att('visa.csv', 'text/csv')] }] },
  ];

  it('collects every user attachment, newest first, with its chat', () => {
    const items = collectLibraryItems(conversations);
    expect(items.map((i) => i.attachment.name)).toEqual(['visa.csv', 'chart.png', 'fees.pdf']);
    expect(items[0]).toMatchObject({ conversationId: 'c2', conversationTitle: 'Schemes' });
  });

  it('filters by kind and searches file names and chat titles', () => {
    const items = collectLibraryItems(conversations);
    expect(filterLibraryItems(items, 'images', '').map((i) => i.attachment.name)).toEqual(['chart.png']);
    expect(filterLibraryItems(items, 'documents', '').map((i) => i.attachment.name)).toEqual(['visa.csv', 'fees.pdf']);
    expect(filterLibraryItems(items, 'all', 'SCHEMES').map((i) => i.attachment.name)).toEqual(['visa.csv']);
  });
});

describe('routes', () => {
  it('parses and builds library and project routes', () => {
    expect(parseHash('#/library')).toEqual({ name: 'library' });
    expect(parseHash('#/p/abc-1')).toEqual({ name: 'project', projectId: 'abc-1' });
    expect(parseHash('#/c/abc-1')).toEqual({ name: 'conversation', conversationId: 'abc-1' });
    expect(parseHash('#/p/bad id')).toEqual({ name: 'home' });
    expect(routeToHash({ name: 'project', projectId: 'abc-1' })).toBe('#/p/abc-1');
    expect(routeToHash({ name: 'library' })).toBe('#/library');
  });
});

describe('share links', () => {
  const conversation: Conversation = {
    id: 'c1',
    title: 'Café ☕ plans',
    createdAt: 1,
    updatedAt: 2,
    messages: [
      { id: 'm1', conversationId: 'c1', role: 'user', content: 'Hi there', createdAt: 1, status: 'completed', mode: 'analytics', attachments: [{ id: 'a', name: 'x.png', mimeType: 'image/png', size: 1 }] },
      { id: 'm2', conversationId: 'c1', role: 'assistant', content: '**Hello** ünïcode', createdAt: 2, status: 'completed', feedback: 'up' },
      { id: 'm3', conversationId: 'c1', role: 'assistant', content: '', createdAt: 3, status: 'failed', error: 'boom' },
    ],
  };

  it('keeps finished text only and round-trips through a URL payload', async () => {
    const shared = buildSharedChat(conversation, 100);
    expect(shared.messages).toEqual([
      { role: 'user', content: 'Hi there', mode: 'analytics' },
      { role: 'assistant', content: '**Hello** ünïcode' },
    ]);
    const payload = await encodeSharedChat(shared);
    expect(payload).toMatch(/^[zj][A-Za-z0-9_-]+$/);
    expect(await decodeSharedChat(payload)).toEqual(shared);
    expect(parseHash(`#/s/${payload}`)).toEqual({ name: 'shared', payload });
  });

  it('rejects malformed payloads', async () => {
    expect(await decodeSharedChat('')).toBeNull();
    expect(await decodeSharedChat('jnot-json')).toBeNull();
    expect(await decodeSharedChat(`j${btoa(JSON.stringify({ v: 1, title: 't', sharedAt: 1, messages: [{ role: 'system', content: 'x' }] }))}`)).toBeNull();
  });

  it('exports Markdown', () => {
    expect(sharedChatToMarkdown(buildSharedChat(conversation))).toBe('# Café ☕ plans\n\n## You\n\nHi there\n\n## Assistant\n\n**Hello** ünïcode\n');
  });
});

import type { Conversation } from '../types/conversation';

export interface SearchResult {
  conversation: Conversation;
  snippet?: string;
}

function makeSnippet(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 20);
  const end = Math.min(text.length, index + length + 40);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).replace(/\s+/g, ' ').trim()}${end < text.length ? '…' : ''}`;
}

export function searchConversations(conversations: Conversation[], query: string): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return conversations.map((conversation) => ({ conversation }));
  const results: SearchResult[] = [];
  for (const conversation of conversations) {
    if (conversation.title.toLowerCase().includes(q)) {
      results.push({ conversation });
      continue;
    }
    for (const m of conversation.messages) {
      const i = m.content.toLowerCase().indexOf(q);
      if (i !== -1) {
        results.push({ conversation, snippet: makeSnippet(m.content, i, q.length) });
        break;
      }
    }
  }
  return results;
}

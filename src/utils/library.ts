import type { Attachment } from '../types/chat';
import type { Conversation } from '../types/conversation';
import { isImage } from './attachments';

export interface LibraryItem {
  attachment: Attachment;
  conversationId: string;
  conversationTitle: string;
  messageId: string;
  createdAt: number;
}

export type LibraryFilter = 'all' | 'images' | 'documents';

/** Every file the user has attached, newest first. Derived from saved chats, so nothing extra is stored. */
export function collectLibraryItems(conversations: Conversation[]): LibraryItem[] {
  const items: LibraryItem[] = [];
  for (const c of conversations) {
    for (const m of c.messages) {
      if (m.role !== 'user' || !m.attachments) continue;
      for (const attachment of m.attachments) {
        items.push({ attachment, conversationId: c.id, conversationTitle: c.title, messageId: m.id, createdAt: m.createdAt });
      }
    }
  }
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

export function filterLibraryItems(items: LibraryItem[], filter: LibraryFilter, query: string): LibraryItem[] {
  const q = query.trim().toLowerCase();
  return items.filter((item) => {
    const image = isImage(item.attachment.mimeType);
    if (filter === 'images' && !image) return false;
    if (filter === 'documents' && image) return false;
    return !q || item.attachment.name.toLowerCase().includes(q) || item.conversationTitle.toLowerCase().includes(q);
  });
}

import type { Message } from './chat';

export type ConversationStatus = 'idle' | 'generating';

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
  status?: ConversationStatus;
  /** Project this chat belongs to, if any. */
  projectId?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
}

export type Theme = 'light' | 'dark';
export type StreamingSpeed = 'slow' | 'normal' | 'fast';

export interface Settings {
  theme: Theme;
  streamingSpeed: StreamingSpeed;
  enableSteps: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'light',
  streamingSpeed: 'normal',
  enableSteps: true,
};

export type StorageResult<T> = { ok: true; value: T } | { ok: false; error: StorageError };

export interface StorageError {
  code: 'quota_exceeded' | 'unavailable' | 'corrupted' | 'unknown';
  message: string;
}

export interface ConversationService {
  listConversations(): Conversation[];
  getConversation(conversationId: string): Conversation | undefined;
  saveConversation(conversation: Conversation): StorageResult<void>;
  renameConversation(conversationId: string, title: string): StorageResult<Conversation>;
  deleteConversation(conversationId: string): StorageResult<void>;
  clearAll(): StorageResult<void>;
  /** Issues detected while loading stored data (e.g. corrupted entries were discarded). */
  getLoadWarnings(): string[];
}

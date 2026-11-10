import type { ChatMode, Message, MessageRole } from '../types/chat';
import type { Conversation } from '../types/conversation';

/**
 * A read-only snapshot of a chat, small enough to live in a URL.
 * There is no backend, so a share link carries the whole conversation in its hash.
 */
export interface SharedChat {
  v: 1;
  title: string;
  sharedAt: number;
  messages: SharedMessage[];
}

export interface SharedMessage {
  role: MessageRole;
  content: string;
  mode?: ChatMode;
}

const MODES = new Set<ChatMode>(['general', 'customerSearch', 'agentic', 'analytics']);
/** Rejects absurd payloads before decompressing or parsing them. */
const MAX_PAYLOAD_LENGTH = 2_000_000;
const MAX_DECODED_BYTES = 5_000_000;

/** Keeps only finished text; attachments, feedback and failed responses are not shared. */
export function buildSharedChat(conversation: Conversation, now = Date.now()): SharedChat {
  const messages: SharedMessage[] = conversation.messages
    .filter((m) => m.content.trim() && m.status !== 'failed' && m.status !== 'pending')
    .map((m) => ({ role: m.role, content: m.content, ...(m.mode && m.mode !== 'general' ? { mode: m.mode } : {}) }));
  return { v: 1, title: conversation.title, sharedAt: now, messages };
}

/** Whether the chat has attachments that a share link leaves out. */
export function hasUnsharedAttachments(conversation: Conversation): boolean {
  return conversation.messages.some((m) => m.attachments?.length);
}

export function sharedChatToMarkdown(chat: SharedChat): string {
  const parts = [`# ${chat.title}`];
  for (const m of chat.messages) parts.push(`## ${m.role === 'user' ? 'You' : 'Assistant'}`, m.content.trim());
  return `${parts.join('\n\n')}\n`;
}

/** Turns a snapshot into messages the regular message list can render. */
export function sharedChatToMessages(chat: SharedChat, conversationId: string, createId: () => string): Message[] {
  return chat.messages.map((m, i) => ({
    id: createId(),
    conversationId,
    role: m.role,
    content: m.content,
    createdAt: chat.sharedAt + i,
    status: 'completed',
    ...(m.mode ? { mode: m.mode } : {}),
  }));
}

/* ---------- URL encoding ---------- */

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(text: string): Uint8Array {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function pipe(bytes: Uint8Array, transform: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const writer = transform.writable.getWriter();
  void writer.write(bytes as Uint8Array<ArrayBuffer>);
  void writer.close();
  return new Uint8Array(await new Response(transform.readable).arrayBuffer());
}

/** `z` + deflated JSON when the browser can compress, otherwise `j` + plain JSON. Both are base64url. */
export async function encodeSharedChat(chat: SharedChat): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(chat));
  if (typeof CompressionStream === 'function') {
    try {
      return `z${bytesToBase64Url(await pipe(json, new CompressionStream('deflate-raw')))}`;
    } catch {
      /* fall back to uncompressed */
    }
  }
  return `j${bytesToBase64Url(json)}`;
}

/** Returns null for anything that isn't a valid share payload. */
export async function decodeSharedChat(payload: string): Promise<SharedChat | null> {
  if (payload.length > MAX_PAYLOAD_LENGTH || !/^[zj][A-Za-z0-9_-]+$/.test(payload)) return null;
  try {
    let bytes = base64UrlToBytes(payload.slice(1));
    if (payload[0] === 'z') {
      if (typeof DecompressionStream !== 'function') return null;
      bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
    }
    if (bytes.length > MAX_DECODED_BYTES) return null;
    return parseSharedChat(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}

function parseSharedChat(value: unknown): SharedChat | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (v.v !== 1 || typeof v.title !== 'string' || typeof v.sharedAt !== 'number' || !Array.isArray(v.messages)) return null;
  const messages: SharedMessage[] = [];
  for (const raw of v.messages) {
    if (!raw || typeof raw !== 'object') return null;
    const m = raw as Record<string, unknown>;
    if ((m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') return null;
    const mode = typeof m.mode === 'string' && MODES.has(m.mode as ChatMode) ? (m.mode as ChatMode) : undefined;
    messages.push({ role: m.role, content: m.content, ...(mode ? { mode } : {}) });
  }
  return { v: 1, title: v.title.slice(0, 200) || 'Shared chat', sharedAt: v.sharedAt, messages };
}

export function shareUrl(payload: string, base: string = window.location.href): string {
  const url = new URL(base);
  url.hash = `/s/${payload}`;
  return url.toString();
}

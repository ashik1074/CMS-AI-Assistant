import type { ChatHistoryEntry, TokenUsage } from '../types/chat';

/**
 * Token counts for the demo. There is no model behind it, so tokens are estimated the way
 * GPT-style tokenizers roughly split English: words of up to 6 letters are one token, longer words
 * about one more token per 4 letters, and each punctuation mark or symbol is a token of its own.
 * A real backend would report its own counts in the generation events instead.
 */

/** Tokens added by the chat format: a system prompt, and a few per message for roles and separators. */
export const SYSTEM_PROMPT_TOKENS = 24;
export const TOKENS_PER_MESSAGE = 4;

export function estimateTokens(text: string): number {
  let tokens = 0;
  for (const piece of text.match(/[A-Za-z0-9_]+|[^\sA-Za-z0-9_]/g) ?? []) {
    tokens += /^[A-Za-z0-9_]/.test(piece) ? Math.max(1, Math.ceil((piece.length - 2) / 4)) : 1;
  }
  return tokens;
}

/** Input tokens for a request: the system prompt and the conversation so far, including the new prompt. */
export function estimateInputTokens(history: ChatHistoryEntry[], prompt: string): number {
  const entries = history.at(-1)?.role === 'user' ? [...history.slice(0, -1), { role: 'user' as const, content: prompt }] : [...history, { role: 'user' as const, content: prompt }];
  return SYSTEM_PROMPT_TOKENS + entries.reduce((sum, e) => sum + estimateTokens(e.content) + TOKENS_PER_MESSAGE, 0);
}

export function estimateUsage(history: ChatHistoryEntry[], prompt: string, output: string): TokenUsage {
  return { inputTokens: estimateInputTokens(history, prompt), outputTokens: estimateTokens(output), estimated: true };
}

export const totalTokens = (usage: TokenUsage) => usage.inputTokens + usage.outputTokens;

export const formatTokens = (n: number) => n.toLocaleString('en-US');

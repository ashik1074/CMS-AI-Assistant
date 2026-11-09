import { describe, expect, it } from 'vitest';
import { estimateInputTokens, estimateTokens, estimateUsage, formatTokens, SYSTEM_PROMPT_TOKENS, TOKENS_PER_MESSAGE, totalTokens } from './tokens';

describe('estimateTokens', () => {
  it('counts short words and punctuation as one token each, and long words by length', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('Hello, world!')).toBe(4);
    expect(estimateTokens('internationalization')).toBe(5);
  });

  it('grows with the text', () => {
    const short = estimateTokens('Explain closures');
    expect(estimateTokens('Explain closures in JavaScript with an example.')).toBeGreaterThan(short);
  });
});

describe('estimateInputTokens', () => {
  it('adds the system prompt and a few tokens per message', () => {
    expect(estimateInputTokens([], 'Hello')).toBe(SYSTEM_PROMPT_TOKENS + 1 + TOKENS_PER_MESSAGE);
  });

  it('counts the whole conversation, with the prompt in place of the last user message', () => {
    const history = [
      { role: 'user' as const, content: 'Hello' },
      { role: 'assistant' as const, content: 'Hi there!' },
      { role: 'user' as const, content: 'Thanks' },
    ];
    const withAttachment = estimateInputTokens(history, 'Thanks\n\n[Attached file: notes.txt]');
    expect(estimateInputTokens(history, 'Thanks')).toBe(SYSTEM_PROMPT_TOKENS + (1 + 4) + (3 + 4) + (1 + 4));
    expect(withAttachment).toBeGreaterThan(estimateInputTokens(history, 'Thanks'));
  });
});

describe('usage', () => {
  it('adds input and output and formats the totals', () => {
    const usage = estimateUsage([], 'Hello', 'Hi there!');
    expect(usage).toEqual({ inputTokens: SYSTEM_PROMPT_TOKENS + 5, outputTokens: 3, estimated: true });
    expect(totalTokens(usage)).toBe(SYSTEM_PROMPT_TOKENS + 8);
    expect(formatTokens(12345)).toBe('12,345');
  });
});

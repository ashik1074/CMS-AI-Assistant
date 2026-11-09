import { Coins } from 'lucide-react';
import type { Message, TokenUsage } from '../../types/chat';
import { estimateTokens, formatTokens, totalTokens } from '../../utils/tokens';

const ESTIMATE_NOTE = 'Estimated: the demo has no real model, so tokens are counted in the browser.';

const count = (n: number, usage: TokenUsage) => `${usage.estimated ? '~' : ''}${formatTokens(n)}`;

/** The tokens of a response that is still being generated: the input, and the output so far. */
export function LiveTokenCount({ message }: { message: Message }) {
  const usage = message.usage;
  if (!usage) return null;
  const output = Math.max(usage.outputTokens, estimateTokens(message.content));
  return (
    <p
      className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs tabular-nums text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
      data-testid="live-token-count"
      title={usage.estimated ? ESTIMATE_NOTE : undefined}
    >
      <Coins className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>
        {count(usage.inputTokens, usage)} in · {count(output, usage)} out
      </span>
      <span className="text-zinc-400 dark:text-zinc-500">· {count(usage.inputTokens + output, usage)} tokens</span>
    </p>
  );
}

/** The tokens a finished (or stopped) response used. */
export function TokenUsageBadge({ usage }: { usage: TokenUsage }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs tabular-nums text-zinc-400 dark:text-zinc-500" data-testid="token-usage" title={usage.estimated ? ESTIMATE_NOTE : undefined}>
      <Coins className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{count(totalTokens(usage), usage)} tokens</span>
      <span className="max-sm:sr-only">
        ({count(usage.inputTokens, usage)} in · {count(usage.outputTokens, usage)} out)
      </span>
    </span>
  );
}

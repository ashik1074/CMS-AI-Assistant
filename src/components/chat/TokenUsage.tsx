import { Coins } from 'lucide-react';
import type { Message, TokenUsage } from '../../types/chat';
import { cn } from '../../utils/cn';
import { estimateTokens, formatTokens } from '../../utils/tokens';

const ESTIMATE_NOTE = 'Estimated: the demo has no real model, so tokens are counted in the browser.';

function Part({ label, value }: { label: string; value: number }) {
  return (
    <span className="whitespace-nowrap">
      {label} <span className="font-semibold text-zinc-700 dark:text-zinc-200">{formatTokens(value)}</span>
    </span>
  );
}

const Divider = () => <span className="h-3 w-px shrink-0 bg-zinc-300 dark:bg-zinc-600" aria-hidden="true" />;

/** Input, output and total tokens in one pill, with an "Estimated" tag when the counts are estimates. */
function TokenPill({ input, output, estimated, live, testId }: { input: number; output: number; estimated?: boolean; live?: boolean; testId: string }) {
  return (
    <span
      className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs tabular-nums text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-400"
      data-testid={testId}
      title={estimated ? ESTIMATE_NOTE : undefined}
    >
      <Coins className={cn('h-3.5 w-3.5 shrink-0 text-amber-500', live && 'animate-pulse')} aria-hidden="true" />
      <Part label="Input" value={input} />
      <Divider />
      <Part label="Output" value={output} />
      <Divider />
      <span className="whitespace-nowrap">
        Total <span className="font-semibold text-zinc-900 dark:text-white">{formatTokens(input + output)}</span> tokens
      </span>
      {estimated && (
        <span className="rounded bg-zinc-200 px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:bg-zinc-700 dark:text-zinc-300">
          <span className="max-sm:hidden">Estimated</span>
          <span className="sm:hidden">Est.</span>
        </span>
      )}
    </span>
  );
}

/** The tokens of a response that is still being generated: the input, and the output so far. */
export function LiveTokenCount({ message }: { message: Message }) {
  const usage = message.usage;
  if (!usage) return null;
  const output = Math.max(usage.outputTokens, estimateTokens(message.content));
  return (
    <div className="mt-2">
      <TokenPill input={usage.inputTokens} output={output} estimated={usage.estimated} live testId="live-token-count" />
    </div>
  );
}

/** The tokens a finished (or stopped) response used. */
export function TokenUsageBadge({ usage }: { usage: TokenUsage }) {
  return <TokenPill input={usage.inputTokens} output={usage.outputTokens} estimated={usage.estimated} testId="token-usage" />;
}

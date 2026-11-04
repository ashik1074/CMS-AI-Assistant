import { useId, useState } from 'react';
import { ChevronDown, CircleStop, Sparkles } from 'lucide-react';
import type { Message } from '../../types/chat';
import { getProcessingPhase } from './processingPhase';
import { formatDuration } from '../../utils/formatTime';
import { cn } from '../../utils/cn';
import { TaskProgress } from './TaskProgress';
import { TypingIndicator } from './TypingIndicator';

interface ProcessingIndicatorProps {
  message: Message;
}

export function ProcessingIndicator({ message }: ProcessingIndicatorProps) {
  const phase = getProcessingPhase(message);
  const steps = message.steps ?? [];
  const hasSteps = steps.length > 0;
  const listId = useId();
  // Expanded while steps are running; collapsed into a summary afterwards (user can toggle).
  const [userExpanded, setUserExpanded] = useState<boolean | null>(null);
  const expanded = userExpanded ?? phase === 'steps';

  if (phase === 'thinking') {
    return (
      <div className="flex h-7 items-center gap-2 text-sm" data-testid="processing-indicator" data-phase="thinking">
        <TypingIndicator />
        <span className="shimmer-text font-medium">Thinking</span>
      </div>
    );
  }

  if (phase === 'failed') return null;

  let label: string;
  let live = false;
  if (phase === 'steps') {
    const active = steps.find((s) => s.status === 'active');
    label = active ? active.label : 'Thinking';
    live = true;
  } else if (phase === 'streaming') {
    if (!hasSteps) return null;
    label = `Completed ${steps.length} steps`;
  } else if (phase === 'completed') {
    if (message.durationMs === undefined) return null;
    label = `Thought for ${formatDuration(message.durationMs)}`;
  } else {
    // cancelled
    label = message.durationMs !== undefined ? `Stopped after ${formatDuration(message.durationMs)}` : 'Stopped';
  }

  const Icon = phase === 'cancelled' ? CircleStop : Sparkles;
  const header = (
    <>
      {live ? (
        <TypingIndicator />
      ) : (
        <Icon className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" aria-hidden="true" />
      )}
      <span className={cn(live ? 'shimmer-text font-medium' : 'text-zinc-500 dark:text-zinc-400')}>{label}</span>
    </>
  );

  return (
    <div className="mb-1 text-sm" data-testid="processing-indicator" data-phase={phase}>
      {hasSteps ? (
        <button
          type="button"
          className="-ml-1 flex h-7 items-center gap-2 rounded-md px-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          aria-expanded={expanded}
          aria-controls={listId}
          onClick={() => setUserExpanded(!expanded)}
        >
          {header}
          <ChevronDown className={cn('h-3.5 w-3.5 text-zinc-400 transition-transform', expanded && 'rotate-180')} aria-hidden="true" />
          <span className="sr-only">{expanded ? 'Hide steps' : 'Show steps'}</span>
        </button>
      ) : (
        <div className="flex h-7 items-center gap-2">{header}</div>
      )}
      {hasSteps && expanded && (
        <div className="animate-fade-in pb-1">
          <TaskProgress id={listId} steps={steps} live={live} />
        </div>
      )}
    </div>
  );
}

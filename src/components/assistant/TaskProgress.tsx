import { Check, Circle, Loader2 } from 'lucide-react';
import type { ProcessingStep } from '../../types/chat';
import { cn } from '../../utils/cn';

const STATUS_TEXT = { completed: 'completed', active: 'in progress', pending: 'not started' } as const;

interface TaskProgressProps {
  steps: ProcessingStep[];
  /** When false, the "active" spinner is frozen (e.g. after cancellation). */
  live?: boolean;
  id?: string;
}

/** Timeline of simulated processing steps, reflecting events emitted by the mock service. */
export function TaskProgress({ steps, live = true, id }: TaskProgressProps) {
  return (
    <ol id={id} className="relative mt-2 space-y-0.5 pl-0.5" aria-label="Processing steps">
      {steps.map((step, i) => {
        const active = step.status === 'active' && live;
        return (
          <li key={step.id} className="relative flex items-center gap-3 py-1 text-sm" data-status={step.status}>
            {i < steps.length - 1 && (
              <span
                aria-hidden="true"
                className={cn(
                  'absolute left-[9px] top-[22px] h-[calc(100%-12px)] w-px transition-colors duration-300',
                  step.status === 'completed' ? 'bg-zinc-400 dark:bg-zinc-500' : 'bg-zinc-200 dark:bg-zinc-700',
                )}
              />
            )}
            <span
              aria-hidden="true"
              className={cn(
                'relative z-10 flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full transition-colors duration-300',
                step.status === 'completed' && 'bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900',
                step.status !== 'completed' && 'bg-white dark:bg-zinc-900',
              )}
            >
              {step.status === 'completed' ? (
                <Check className="h-3 w-3" strokeWidth={3} />
              ) : active ? (
                <Loader2 className="h-4 w-4 animate-spin text-zinc-700 dark:text-zinc-200" />
              ) : (
                <Circle className="h-3.5 w-3.5 text-zinc-300 dark:text-zinc-600" />
              )}
            </span>
            <span
              className={cn(
                'transition-colors duration-300',
                step.status === 'completed' && 'text-zinc-600 dark:text-zinc-400',
                active && 'font-medium text-zinc-900 dark:text-zinc-100',
                step.status === 'pending' && 'text-zinc-400 dark:text-zinc-500',
                step.status === 'active' && !live && 'text-zinc-400 dark:text-zinc-500',
              )}
            >
              {step.label}
              <span className="sr-only"> — {STATUS_TEXT[step.status]}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

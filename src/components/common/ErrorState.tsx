import { AlertTriangle, RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

interface ErrorStateProps {
  title: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  retryDisabled?: boolean;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}

/** Reusable error / empty-state block with an optional retry action. */
export function ErrorState({ title, message, onRetry, retryLabel = 'Retry', retryDisabled, action, className, compact }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'rounded-xl border border-red-200 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200',
        compact ? 'px-3 py-2.5' : 'px-4 py-3',
        className,
      )}
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{title}</p>
          {message && <p className="mt-0.5 text-sm opacity-90">{message}</p>}
          {(onRetry || action) && (
            <div className="mt-2 flex flex-wrap gap-2">
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  disabled={retryDisabled}
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 text-sm font-medium text-red-900 hover:bg-red-100 disabled:opacity-50 dark:border-red-800 dark:bg-transparent dark:text-red-100 dark:hover:bg-red-900/40"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  {retryLabel}
                </button>
              )}
              {action}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

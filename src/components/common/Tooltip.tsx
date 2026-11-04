import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

interface TooltipProps {
  label: string;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'right';
  className?: string;
}

/** Lightweight tooltip shown on hover and keyboard focus. Purely visual — the control keeps its own accessible name. */
export function Tooltip({ label, children, side = 'top', className }: TooltipProps) {
  return (
    <span className={cn('group/tip relative inline-flex', className)}>
      {children}
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute z-50 whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-sm transition-opacity delay-300 duration-150 dark:bg-zinc-100 dark:text-zinc-900',
          'group-hover/tip:opacity-100 group-has-[:focus-visible]/tip:opacity-100 [@media(hover:none)]:hidden',
          side === 'top' && 'bottom-full left-1/2 mb-1.5 -translate-x-1/2',
          side === 'bottom' && 'top-full left-1/2 mt-1.5 -translate-x-1/2',
          side === 'right' && 'left-full top-1/2 ml-1.5 -translate-y-1/2',
        )}
      >
        {label}
      </span>
    </span>
  );
}

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { Tooltip } from './Tooltip';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name; also shown as the tooltip. */
  label: string;
  children: ReactNode;
  size?: 'sm' | 'md';
  tooltip?: boolean;
  tooltipSide?: 'top' | 'bottom' | 'right';
  active?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, children, size = 'md', tooltip = true, tooltipSide = 'top', active, className, type = 'button', ...rest },
  ref,
) {
  const button = (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors',
        'hover:bg-zinc-100 hover:text-zinc-900 active:bg-zinc-200 disabled:pointer-events-none disabled:opacity-40',
        'dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:active:bg-zinc-700',
        size === 'sm' ? 'h-8 w-8 [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-10' : 'h-10 w-10',
        active && 'text-zinc-900 dark:text-zinc-100',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
  return tooltip ? (
    <Tooltip label={label} side={tooltipSide}>
      {button}
    </Tooltip>
  ) : (
    button
  );
});

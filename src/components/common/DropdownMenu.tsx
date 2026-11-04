import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode, type Ref } from 'react';
import { cn } from '../../utils/cn';

interface DropdownMenuProps {
  /** Renders the trigger; spread `props` onto a <button>. */
  trigger: (props: { ref: Ref<HTMLButtonElement>; 'aria-haspopup': 'menu'; 'aria-expanded': boolean; 'aria-controls': string; onClick: () => void }) => ReactNode;
  label: string;
  /** Menu items. Activating any menu item closes the menu. */
  children: ReactNode;
  align?: 'start' | 'end';
  side?: 'top' | 'bottom';
  className?: string;
}

const ITEM_SELECTOR = '[role="menuitem"], [role="menuitemradio"]';

/** Accessible popup menu: opens from a trigger, closes on item click / outside click / Escape / Tab, arrow keys move focus. */
export function DropdownMenu({ trigger, label, children, align = 'start', side = 'bottom', className }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const items = menuRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR);
    const checked = menuRef.current?.querySelector<HTMLElement>('[aria-checked="true"]');
    (checked ?? items?.[0])?.focus();
    const onPointerDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !triggerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? []);
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(index + 1) % items.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(index - 1 + items.length) % items.length]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items.at(-1)?.focus();
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div className="relative inline-flex">
      {trigger({ ref: triggerRef, 'aria-haspopup': 'menu', 'aria-expanded': open, 'aria-controls': id, onClick: () => setOpen((o) => !o) })}
      {open && (
        <div
          id={id}
          ref={menuRef}
          role="menu"
          aria-label={label}
          onKeyDown={onKeyDown}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest(ITEM_SELECTOR)) close();
          }}
          className={cn(
            'absolute z-40 min-w-48 animate-fade-in rounded-xl border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800',
            side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
            align === 'start' ? 'left-0' : 'right-0',
            className,
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export const menuItemClass =
  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-zinc-100 focus:bg-zinc-100 focus:outline-none dark:hover:bg-zinc-700 dark:focus:bg-zinc-700';

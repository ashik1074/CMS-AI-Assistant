import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { clampSidebarWidth, SIDEBAR_DEFAULT_WIDTH, SIDEBAR_MAX_WIDTH, SIDEBAR_MIN_WIDTH } from '../../utils/sidebarWidth';
import { AmbientBackground } from './AmbientBackground';

const KEYBOARD_STEP = 16;

interface MainLayoutProps {
  sidebar: ReactNode;
  header: ReactNode;
  children: ReactNode;
  mobile: boolean;
  /** Desktop: sidebar expanded. Mobile: drawer open. */
  sidebarOpen: boolean;
  onCloseSidebar: () => void;
  /** Desktop sidebar width in px; the user can drag the edge to change it. */
  sidebarWidth: number;
  onSidebarWidthChange: (width: number) => void;
}

export function MainLayout({ sidebar, header, children, mobile, sidebarOpen, onCloseSidebar, sidebarWidth, onSidebarWidthChange }: MainLayoutProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);
  const [resizing, setResizing] = useState(false);

  // Mobile drawer: Escape closes, focus moves into the drawer while open.
  useEffect(() => {
    if (!mobile || !sidebarOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    drawerRef.current?.querySelector<HTMLElement>('button, input')?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => {
      // Open modals handle Escape in the capture phase and stop propagation, so this only fires for the drawer.
      if (e.key === 'Escape') onCloseSidebar();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (previous && document.contains(previous)) previous.focus();
    };
  }, [mobile, sidebarOpen, onCloseSidebar]);

  // While dragging, keep the resize cursor everywhere and stop text from being selected.
  useEffect(() => {
    if (!resizing) return;
    const { cursor, userSelect } = document.body.style;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.body.style.cursor = cursor;
      document.body.style.userSelect = userSelect;
    };
  }, [resizing]);

  const onResizeStart = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { startX: e.clientX, startWidth: sidebarWidth };
    setResizing(true);
  };
  const onResizeMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    onSidebarWidthChange(clampSidebarWidth(drag.current.startWidth + e.clientX - drag.current.startX));
  };
  const onResizeEnd = () => {
    drag.current = null;
    setResizing(false);
  };
  const onResizeKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const next =
      e.key === 'ArrowLeft' ? sidebarWidth - KEYBOARD_STEP
      : e.key === 'ArrowRight' ? sidebarWidth + KEYBOARD_STEP
      : e.key === 'Home' ? SIDEBAR_MIN_WIDTH
      : e.key === 'End' ? SIDEBAR_MAX_WIDTH
      : null;
    if (next === null) return;
    e.preventDefault();
    onSidebarWidthChange(clampSidebarWidth(next));
  };

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-zinc-50 dark:bg-zinc-900">
      {mobile ? (
        <>
          <div
            aria-hidden="true"
            onClick={onCloseSidebar}
            className={cn('fixed inset-0 z-30 bg-black/40 transition-opacity duration-200', sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0')}
          />
          <div
            ref={drawerRef}
            data-testid="sidebar-drawer"
            className={cn('fixed inset-y-0 left-0 z-40 shadow-xl transition-transform duration-200', sidebarOpen ? 'translate-x-0' : '-translate-x-full')}
            inert={!sidebarOpen}
            role="dialog"
            aria-modal={sidebarOpen || undefined}
            aria-label="Sidebar"
          >
            {sidebar}
          </div>
        </>
      ) : (
        <div className="relative flex shrink-0">
          <div
            data-testid="sidebar"
            // The sidebar reads `--sidebar-width`, so its content keeps its size while the wrapper animates to 0.
            style={{ '--sidebar-width': `${sidebarWidth}px`, width: sidebarOpen ? sidebarWidth : 0 } as CSSProperties}
            className={cn(
              'shrink-0 overflow-hidden border-r border-zinc-200 dark:border-zinc-800',
              !resizing && 'transition-[width] duration-200',
              !sidebarOpen && 'border-r-0',
            )}
            inert={!sidebarOpen}
          >
            {sidebar}
          </div>
          {sidebarOpen && (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize sidebar"
              aria-valuenow={sidebarWidth}
              aria-valuemin={SIDEBAR_MIN_WIDTH}
              aria-valuemax={SIDEBAR_MAX_WIDTH}
              tabIndex={0}
              title="Drag to resize · double-click to reset"
              data-testid="sidebar-resizer"
              onPointerDown={onResizeStart}
              onPointerMove={onResizeMove}
              onPointerUp={onResizeEnd}
              onPointerCancel={onResizeEnd}
              onDoubleClick={() => onSidebarWidthChange(SIDEBAR_DEFAULT_WIDTH)}
              onKeyDown={onResizeKey}
              className="group absolute inset-y-0 -right-1.5 z-30 flex w-3 cursor-col-resize justify-center outline-none"
            >
              {/* Thin accent line that appears on hover, focus and while dragging. */}
              <span
                aria-hidden="true"
                className={cn(
                  'h-full w-0.5 rounded-full bg-brand-500 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100',
                  resizing && 'opacity-100',
                )}
              />
            </div>
          )}
        </div>
      )}
      {/* `isolate` keeps the ambient layer's negative z-index inside <main>, behind its content. */}
      <main className="relative isolate flex min-w-0 flex-1 flex-col">
        <AmbientBackground />
        {header}
        {children}
      </main>
    </div>
  );
}

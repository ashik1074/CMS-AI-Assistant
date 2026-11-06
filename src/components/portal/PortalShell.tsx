import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, CreditCard, List, Menu, Moon, Search, Sparkles, Sun, X } from 'lucide-react';
import type { CurrentUser } from '../../config/currentUser';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import type { Theme } from '../../types/conversation';
import { cn } from '../../utils/cn';
import { IconButton } from '../common/IconButton';
import { UserMenu } from '../layout/UserMenu';

export const PORTAL_NAME = 'KONA CMS';
export const MODULE_NAME = 'Card Management';

const COLLAPSED_KEY = 'portal:nav-collapsed:v1';

export type PortalSection = 'products' | 'assistant';

interface PortalShellProps {
  section: PortalSection;
  mobile: boolean;
  theme: Theme;
  user: CurrentUser;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  /** Phones: the navigation drawer. The chat header has its own button to open it. */
  drawerOpen: boolean;
  onDrawerOpenChange: (open: boolean) => void;
  children: ReactNode;
}

function loadCollapsed(): boolean | null {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY);
    return raw === null ? null : raw === 'true';
  } catch {
    return null;
  }
}

function Logo({ compact }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2 text-white">
      <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" aria-hidden="true">
        <path d="M12 2 22 12 12 22 2 12Z" fill="#818cf8" />
        <path d="M12 2 12 22 2 12Z" fill="#4f46e5" />
      </svg>
      {!compact && <span className="whitespace-nowrap text-lg font-semibold tracking-wide">{PORTAL_NAME}</span>}
    </span>
  );
}

function PortalNav({ section, compact, onNavigate }: { section: PortalSection; compact: boolean; onNavigate: () => void }) {
  const [query, setQuery] = useState('');
  const [productsOpen, setProductsOpen] = useState(true);
  const q = query.trim().toLowerCase();
  const matches = (label: string) => !q || label.toLowerCase().includes(q);
  const showAssistant = matches('AI Assistant');
  const showList = matches('Product List');
  const showGroup = showList || matches('Product Management');
  const inProducts = section === 'products';

  const assistantLink = (
    <a
      href="#/assistant"
      onClick={onNavigate}
      title={compact ? 'AI Assistant' : undefined}
      aria-label={compact ? 'AI Assistant' : undefined}
      aria-current={section === 'assistant' ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-lg border text-sm font-medium text-white transition-colors',
        compact ? 'h-11 w-11 justify-center' : 'px-3.5 py-3',
        section === 'assistant' ? 'border-brand-400 bg-brand-600/30' : 'border-brand-500/40 bg-gradient-to-r from-[#1b1a45] to-transparent hover:border-brand-400',
      )}
    >
      <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
      {!compact && 'AI Assistant'}
    </a>
  );

  if (compact) {
    return (
      <nav aria-label="Main" className="flex flex-col items-center gap-2 px-2 py-4">
        {assistantLink}
        <a
          href="#/"
          onClick={onNavigate}
          title="Product List"
          aria-label="Product List"
          aria-current={inProducts ? 'page' : undefined}
          className={cn('flex h-11 w-11 items-center justify-center rounded-lg transition-colors', inProducts ? 'bg-brand-600 text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-white')}
        >
          <List className="h-4 w-4" aria-hidden="true" />
        </a>
      </nav>
    );
  }

  return (
    <nav aria-label="Main" className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 py-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Menu Items"
          aria-label="Search menu items"
          className="w-full rounded-lg bg-transparent py-2.5 pl-9 pr-3 text-sm text-zinc-200 outline-none placeholder:text-zinc-400 focus:bg-white/5"
        />
      </div>

      {showAssistant && assistantLink}

      {showGroup && (
        <div>
          <p className="mb-3 px-3 text-xs font-medium uppercase tracking-wider text-zinc-400">Operations</p>
          <button
            type="button"
            onClick={() => setProductsOpen((o) => !o)}
            aria-expanded={productsOpen || !!q}
            className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-white/5', inProducts ? 'text-white' : 'text-zinc-400 hover:text-white')}
          >
            <CreditCard className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="flex-1 text-left">Product Management</span>
            <ChevronDown className={cn('h-4 w-4 transition-transform', !(productsOpen || q) && '-rotate-90')} aria-hidden="true" />
          </button>
          {(productsOpen || q) && showList && (
            <a
              href="#/"
              onClick={onNavigate}
              aria-current={inProducts ? 'page' : undefined}
              className={cn(
                'mt-1 flex items-center gap-3 rounded-lg py-2.5 pl-10 pr-3 text-sm font-medium transition-colors',
                inProducts ? 'bg-brand-600 text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-white',
              )}
            >
              <span className="h-1 w-1 shrink-0 rounded-full bg-current" aria-hidden="true" />
              Product List
            </a>
          )}
        </div>
      )}

      {!showAssistant && !showGroup && <p className="px-3 text-sm text-zinc-400">No menu items found.</p>}
    </nav>
  );
}

/** The portal's frame: the dark navigation on every page, and a top bar on the portal's own pages. */
export function PortalShell({ section, mobile, theme, user, onToggleTheme, onOpenSettings, drawerOpen, onDrawerOpenChange: setDrawerOpen, children }: PortalShellProps) {
  const assistant = section === 'assistant';
  const narrow = useMediaQuery('(max-width: 1279px)');
  /** The user's own choice, once they have made one. Until then the chat gets more room on narrower screens. */
  const [collapsedChoice, setCollapsedChoice] = useState<boolean | null>(loadCollapsed);
  const collapsed = collapsedChoice ?? (assistant && narrow);
  const dark = theme === 'dark';

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsedChoice(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, String(next));
    } catch {
      /* non-critical */
    }
  };

  useEffect(() => {
    if (!mobile || !drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobile, drawerOpen, setDrawerOpen]);

  const version = <p className="whitespace-nowrap border-t border-white/10 px-4 py-3 text-xs text-zinc-400">Demo data · v1.0.0</p>;

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-zinc-50 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
      {mobile ? (
        <>
          <div aria-hidden="true" onClick={() => setDrawerOpen(false)} className={cn('fixed inset-0 z-40 bg-black/50 transition-opacity', drawerOpen ? 'opacity-100' : 'pointer-events-none opacity-0')} />
          <aside
            data-testid="portal-drawer"
            inert={!drawerOpen}
            className={cn('fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-[#10112b] transition-transform duration-200', drawerOpen ? 'translate-x-0' : '-translate-x-full')}
          >
            <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
              <Logo />
              <button type="button" aria-label="Close navigation" onClick={() => setDrawerOpen(false)} className="rounded-md p-1 text-zinc-300 hover:bg-white/10">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <PortalNav section={section} compact={false} onNavigate={() => setDrawerOpen(false)} />
            {version}
          </aside>
        </>
      ) : (
        <aside data-testid="portal-sidebar" className={cn('relative z-30 flex shrink-0 flex-col bg-[#10112b] transition-[width] duration-200', collapsed ? 'w-[60px]' : 'w-[272px]')}>
          <div className={cn('flex h-14 shrink-0 items-center border-b border-white/10', collapsed ? 'justify-center' : 'px-5')}>
            <Logo compact={collapsed} />
          </div>
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            className="absolute -right-2.5 top-4 flex h-6 w-5 items-center justify-center rounded border border-zinc-200 bg-white text-brand-600 shadow-sm hover:bg-brand-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-brand-300"
          >
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />}
          </button>
          <PortalNav section={section} compact={collapsed} onNavigate={() => undefined} />
          {!collapsed && <div className="mt-auto">{version}</div>}
        </aside>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* In the chat, the assistant's own header has the theme, account and menu controls. */}
        {!assistant && (
          <header className="flex h-14 shrink-0 items-center gap-2 border-b border-zinc-200 bg-white px-3 sm:px-6 dark:border-zinc-800 dark:bg-zinc-950">
            {mobile && (
              <button type="button" aria-label="Open navigation" onClick={() => setDrawerOpen(true)} className="rounded-md p-1.5 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">
                <Menu className="h-5 w-5" aria-hidden="true" />
              </button>
            )}
            <div className="min-w-0 flex-1" />
                <span className="mr-1 inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-brand-50 px-3 py-1.5 text-sm font-medium text-zinc-800 max-sm:hidden dark:bg-brand-500/15 dark:text-zinc-100">
                  <CreditCard className="h-4 w-4 text-brand-600 dark:text-brand-300" aria-hidden="true" />
                  {MODULE_NAME}
                </span>
                <IconButton label={dark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={onToggleTheme} tooltipSide="bottom" data-testid="theme-toggle">
                  {dark ? <Sun className="h-5 w-5" aria-hidden="true" /> : <Moon className="h-5 w-5" aria-hidden="true" />}
                </IconButton>
                <UserMenu user={user} onOpenSettings={onOpenSettings} />
          </header>
        )}
        <div className="flex min-h-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

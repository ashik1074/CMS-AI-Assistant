import { PanelLeftOpen, Menu, Moon, Share, SquarePen, Sun } from 'lucide-react';
import type { CurrentUser } from '../../config/currentUser';
import type { Theme } from '../../types/conversation';
import { IconButton } from '../common/IconButton';
import { UserMenu } from './UserMenu';

interface HeaderProps {
  title?: string;
  /** Project the open chat belongs to; shown as a breadcrumb before the title. */
  project?: { name: string; onOpen: () => void };
  sidebarVisible: boolean;
  mobile: boolean;
  theme: Theme;
  user: CurrentUser;
  onOpenSidebar: () => void;
  onNewChat: () => void;
  onOpenSettings: () => void;
  onToggleTheme: () => void;
  /** Shown when there is a chat to share. */
  onShare?: () => void;
  shareDisabled?: boolean;
}

export function Header({ title, project, sidebarVisible, mobile, theme, user, onOpenSidebar, onNewChat, onOpenSettings, onToggleTheme, onShare, shareDisabled }: HeaderProps) {
  const showSidebarControls = mobile || !sidebarVisible;
  const dark = theme === 'dark';
  return (
    <header className="app-header absolute inset-x-0 top-0 z-20 flex h-14 items-center gap-1 px-2 sm:px-3">
      {showSidebarControls && (
        <>
          <IconButton label={mobile ? 'Open sidebar' : 'Expand sidebar'} onClick={onOpenSidebar} tooltipSide="bottom">
            {mobile ? <Menu className="h-5 w-5" aria-hidden="true" /> : <PanelLeftOpen className="h-5 w-5" aria-hidden="true" />}
          </IconButton>
          <IconButton label="New chat" onClick={onNewChat} tooltipSide="bottom">
            <SquarePen className="h-5 w-5" aria-hidden="true" />
          </IconButton>
        </>
      )}
      <div className="min-w-0 flex-1 px-1">
        {title && (
          <div className="flex min-w-0 items-center gap-1.5 text-base">
            {project && (
              <>
                <button
                  type="button"
                  onClick={project.onOpen}
                  className="max-w-[40%] shrink-0 truncate rounded-md px-1 py-0.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                  title={`Open project ${project.name}`}
                  data-testid="breadcrumb-project"
                >
                  {project.name}
                </button>
                <span className="text-zinc-400" aria-hidden="true">
                  /
                </span>
              </>
            )}
            <h2 className="min-w-0 truncate font-medium" title={title} data-testid="chat-title">
              {title}
            </h2>
          </div>
        )}
      </div>
      {onShare && (
        <button
          type="button"
          onClick={onShare}
          disabled={shareDisabled}
          title={shareDisabled ? 'Wait for the response to finish before sharing' : undefined}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900 active:bg-zinc-200 disabled:pointer-events-none disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:active:bg-zinc-700"
          data-testid="share-button"
        >
          <Share className="h-4 w-4" aria-hidden="true" />
          <span className="max-sm:sr-only">Share</span>
        </button>
      )}
      <IconButton label={dark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={onToggleTheme} tooltipSide="bottom" data-testid="theme-toggle">
        {dark ? <Sun className="h-5 w-5" aria-hidden="true" /> : <Moon className="h-5 w-5" aria-hidden="true" />}
      </IconButton>
      <UserMenu user={user} onOpenSettings={onOpenSettings} />
    </header>
  );
}

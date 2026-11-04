import { useState } from 'react';
import { ChevronDown, Settings } from 'lucide-react';
import type { CurrentUser } from '../../config/currentUser';
import { cn } from '../../utils/cn';
import { DropdownMenu, menuItemClass } from '../common/DropdownMenu';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');

export function Avatar({ user, className }: { user: CurrentUser; className?: string }) {
  const [failed, setFailed] = useState(false);
  const base = cn('shrink-0 rounded-full ring-2 ring-white dark:ring-zinc-800', className);
  return user.photoUrl && !failed ? (
    <img src={user.photoUrl} alt="" className={cn(base, 'object-cover')} onError={() => setFailed(true)} />
  ) : (
    <span className={cn(base, 'flex items-center justify-center bg-brand-600 text-xs font-semibold text-white')} aria-hidden="true">
      {initials(user.name)}
    </span>
  );
}

interface UserMenuProps {
  user: CurrentUser;
  onOpenSettings: () => void;
}

/** Profile button showing who is using the assistant, with a menu for account-level actions. */
export function UserMenu({ user, onOpenSettings }: UserMenuProps) {
  return (
    <DropdownMenu
      label="Account"
      align="end"
      className="w-60"
      trigger={(props) => (
        <button
          {...props}
          type="button"
          aria-label={`${user.name}, ${user.role}. Account menu`}
          data-testid="user-menu"
          className="flex h-10 items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-zinc-100 sm:pr-3 dark:hover:bg-zinc-800"
        >
          <Avatar user={user} className="h-8 w-8" />
          <span className="hidden max-w-[160px] truncate text-sm font-medium sm:inline">{user.role}</span>
          <ChevronDown className="hidden h-4 w-4 text-zinc-500 sm:block dark:text-zinc-400" aria-hidden="true" />
        </button>
      )}
    >
      <>
        <div className="flex items-center gap-3 border-b border-zinc-200 px-2.5 pb-3 pt-2 dark:border-zinc-700">
          <Avatar user={user} className="h-10 w-10" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{user.role}</p>
          </div>
        </div>
        <div className="pt-1">
          <button
            type="button"
            role="menuitem"
            className={menuItemClass}
            onClick={onOpenSettings}
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
            Settings
          </button>
        </div>
      </>
    </DropdownMenu>
  );
}

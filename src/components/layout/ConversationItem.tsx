import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { FolderInput, FolderMinus, Loader2, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import type { Conversation } from '../../types/conversation';
import { cn } from '../../utils/cn';

interface ConversationItemProps {
  conversation: Conversation;
  active: boolean;
  generating: boolean;
  snippet?: string;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => boolean;
  onDelete: (id: string) => void;
  onMoveToProject?: (id: string) => void;
  onRemoveFromProject?: (id: string) => void;
}

export function ConversationItem({ conversation, active, generating, snippet, onSelect, onRename, onDelete, onMoveToProject, onRemoveFromProject }: ConversationItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(conversation.title);
  const [renameError, setRenameError] = useState('');
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = `rename-error-${conversation.id}`;

  useEffect(() => {
    if (!menuOpen) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onPointerDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !menuButtonRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [menuOpen]);

  useEffect(() => {
    if (renaming) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [renaming]);

  const closeMenu = (restoreFocus = true) => {
    setMenuOpen(false);
    if (restoreFocus) menuButtonRef.current?.focus();
  };

  const onMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeMenu();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(index + 1) % items.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(index - 1 + items.length) % items.length]?.focus();
    } else if (e.key === 'Tab') {
      setMenuOpen(false);
    }
  };

  const startRename = () => {
    setDraft(conversation.title);
    setRenameError('');
    setMenuOpen(false);
    setRenaming(true);
  };

  const commitRename = () => {
    if (!draft.trim()) {
      setRenameError('Title cannot be empty.');
      inputRef.current?.focus();
      return;
    }
    if (draft.trim() !== conversation.title) onRename(conversation.id, draft);
    setRenaming(false);
    requestAnimationFrame(() => menuButtonRef.current?.focus());
  };

  const cancelRename = () => {
    setRenaming(false);
    setRenameError('');
    requestAnimationFrame(() => menuButtonRef.current?.focus());
  };

  if (renaming) {
    return (
      <li className="px-1 py-0.5">
        <label htmlFor={`rename-${conversation.id}`} className="sr-only">
          Rename conversation
        </label>
        <input
          id={`rename-${conversation.id}`}
          ref={inputRef}
          value={draft}
          maxLength={120}
          onChange={(e) => {
            setDraft(e.target.value);
            if (renameError) setRenameError('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitRename();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              cancelRename();
            }
          }}
          onBlur={() => (draft.trim() ? commitRename() : cancelRename())}
          aria-invalid={!!renameError}
          aria-describedby={renameError ? errorId : undefined}
          className={cn(
            'w-full rounded-lg border bg-white px-2.5 py-1.5 text-sm outline-none dark:bg-zinc-900',
            renameError ? 'border-red-500' : 'border-brand-400 dark:border-zinc-500',
          )}
        />
        {renameError && (
          <p id={errorId} className="mt-1 px-1 text-xs text-red-600 dark:text-red-400" role="alert">
            {renameError}
          </p>
        )}
      </li>
    );
  }

  return (
    <li className="relative">
      <div
        className={cn(
          'group flex items-center rounded-lg transition-colors',
          active ? 'bg-brand-50 text-brand-700 dark:bg-zinc-800 dark:text-zinc-100' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800/60',
        )}
      >
        <button
          type="button"
          onClick={() => onSelect(conversation.id)}
          aria-current={active ? 'page' : undefined}
          className="min-w-0 flex-1 rounded-lg px-2.5 py-2 text-left text-sm [@media(pointer:coarse)]:py-2.5"
          title={conversation.title}
        >
          <span className="flex items-center gap-2">
            <span className="truncate">{conversation.title}</span>
            {generating && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-zinc-400" aria-label="Generating" />}
          </span>
          {snippet && <span className="mt-0.5 block truncate text-xs text-zinc-500 dark:text-zinc-400">{snippet}</span>}
        </button>
        <button
          ref={menuButtonRef}
          type="button"
          aria-label={`More options for ${conversation.title}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
          className={cn(
            'mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100',
            'opacity-0 focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100',
            (menuOpen || active) && 'opacity-100',
          )}
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {menuOpen && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={`Options for ${conversation.title}`}
          onKeyDown={onMenuKeyDown}
          className="absolute right-1 top-full z-30 mt-1 w-52 animate-fade-in rounded-xl border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
        >
          <button type="button" role="menuitem" onClick={startRename} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-zinc-100 focus:bg-zinc-100 focus:outline-none dark:hover:bg-zinc-700 dark:focus:bg-zinc-700">
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Rename
          </button>
          {onMoveToProject && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                closeMenu(false);
                onMoveToProject(conversation.id);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-zinc-100 focus:bg-zinc-100 focus:outline-none dark:hover:bg-zinc-700 dark:focus:bg-zinc-700"
            >
              <FolderInput className="h-4 w-4" aria-hidden="true" />
              {conversation.projectId ? 'Change project' : 'Add to project'}
            </button>
          )}
          {conversation.projectId && onRemoveFromProject && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                closeMenu(false);
                onRemoveFromProject(conversation.id);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-zinc-100 focus:bg-zinc-100 focus:outline-none dark:hover:bg-zinc-700 dark:focus:bg-zinc-700"
            >
              <FolderMinus className="h-4 w-4" aria-hidden="true" />
              Remove from project
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              closeMenu(false);
              onDelete(conversation.id);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-red-600 hover:bg-red-50 focus:bg-red-50 focus:outline-none dark:text-red-400 dark:hover:bg-red-950/50 dark:focus:bg-red-950/50"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete
          </button>
        </div>
      )}
    </li>
  );
}

import { useMemo, useState } from 'react';
import { FolderOpen, Library, PanelLeftClose, Plus, Search, Settings, SquarePen, Sparkles, X } from 'lucide-react';
import type { Conversation, Project } from '../../types/conversation';
import { groupConversations } from '../../utils/formatTime';
import { cn } from '../../utils/cn';
import { IconButton } from '../common/IconButton';
import { searchConversations } from '../../utils/search';
import { ConversationItem } from './ConversationItem';

interface SidebarProps {
  conversations: Conversation[];
  projects: Project[];
  activeId: string | null;
  /** Highlights a project (when its page or one of its chats is open). */
  activeProjectId: string | null;
  libraryActive: boolean;
  isGenerating: (id: string) => boolean;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onRename: (id: string, title: string) => boolean;
  onDelete: (id: string) => void;
  onMoveToProject: (id: string) => void;
  onRemoveFromProject: (id: string) => void;
  onOpenLibrary: () => void;
  onOpenProject: (id: string) => void;
  onNewProject: () => void;
  onOpenSettings: () => void;
  /** Collapses the desktop sidebar or closes the mobile drawer. */
  onClose: () => void;
  mobile: boolean;
}

const navItemClass = (active: boolean) =>
  cn(
    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
    active ? 'bg-brand-50 font-medium text-brand-700 dark:bg-zinc-800 dark:text-zinc-100' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800/60',
  );

export function Sidebar(props: SidebarProps) {
  const { conversations, projects, activeId, activeProjectId, libraryActive, isGenerating, onSelect, onNewChat, onRename, onDelete, onMoveToProject, onRemoveFromProject } = props;
  const { onOpenLibrary, onOpenProject, onNewProject, onOpenSettings, onClose, mobile } = props;
  const [query, setQuery] = useState('');
  const searching = query.trim().length > 0;
  const results = useMemo(() => searchConversations(conversations, query), [conversations, query]);
  const groups = useMemo(() => (searching ? [] : groupConversations(conversations)), [conversations, searching]);

  const item = (c: Conversation, snippet?: string) => (
    <ConversationItem
      key={c.id}
      conversation={c}
      active={c.id === activeId}
      generating={c.status === 'generating' || isGenerating(c.id)}
      snippet={snippet}
      onSelect={onSelect}
      onRename={onRename}
      onDelete={onDelete}
      onMoveToProject={onMoveToProject}
      onRemoveFromProject={onRemoveFromProject}
    />
  );

  return (
    <nav aria-label="Chat history" className="flex h-full w-[var(--sidebar-width,272px)] flex-col bg-white dark:bg-zinc-950">
      <div className="flex items-center justify-between px-3 pb-1 pt-3">
        <div className="flex items-center gap-2 px-1">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-white dark:bg-brand-500" aria-hidden="true">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold">AI Assistant</span>
        </div>
        <IconButton label={mobile ? 'Close sidebar' : 'Collapse sidebar'} onClick={onClose} tooltipSide="bottom">
          {mobile ? <X className="h-5 w-5" aria-hidden="true" /> : <PanelLeftClose className="h-5 w-5" aria-hidden="true" />}
        </IconButton>
      </div>

      <div className="space-y-2 px-3 py-2">
        <button type="button" onClick={onNewChat} className="btn-primary min-h-9 w-full">
          <SquarePen className="h-4 w-4" aria-hidden="true" />
          New chat
        </button>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
          <label htmlFor="conversation-search" className="sr-only">
            Search conversations
          </label>
          <input
            id="conversation-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && query && (e.stopPropagation(), setQuery(''))}
            placeholder="Search chats"
            autoComplete="off"
            className="w-full rounded-lg border border-zinc-200 bg-white py-1.5 pl-8 pr-2.5 text-sm outline-none placeholder:text-zinc-400 focus:border-brand-400 dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-zinc-600"
          />
        </div>
        <button type="button" onClick={onOpenLibrary} aria-current={libraryActive ? 'page' : undefined} className={navItemClass(libraryActive)}>
          <Library className="h-4 w-4" aria-hidden="true" />
          Library
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 pb-2">
        {!searching && (
          <section aria-labelledby="projects-heading" className="pb-1">
            <div className="flex items-center justify-between pl-2.5 pr-1 pt-2">
              <h3 id="projects-heading" className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Projects
              </h3>
              <IconButton label="New project" size="sm" tooltip={false} title="New project" onClick={onNewProject} className="h-7 w-7">
                <Plus className="h-4 w-4" aria-hidden="true" />
              </IconButton>
            </div>
            {projects.length === 0 ? (
              <button type="button" onClick={onNewProject} className="w-full rounded-lg px-2.5 py-2 text-left text-sm text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/60">
                Create a project to group related chats
              </button>
            ) : (
              <ul>
                {projects.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => onOpenProject(p.id)}
                      aria-current={p.id === activeProjectId && !activeId ? 'page' : undefined}
                      className={navItemClass(p.id === activeProjectId)}
                      title={p.name}
                    >
                      <FolderOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">{p.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {conversations.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">No conversations yet.</p>
        ) : searching ? (
          <section aria-label="Search results">
            <h3 className="px-2.5 pb-1 pt-3 text-xs font-medium text-zinc-500 dark:text-zinc-400" aria-live="polite">
              {results.length === 0 ? 'No results' : `${results.length} result${results.length === 1 ? '' : 's'}`}
            </h3>
            {results.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">No conversations match “{query.trim()}”.</p>
            ) : (
              <ul>{results.map((r) => item(r.conversation, r.snippet))}</ul>
            )}
          </section>
        ) : (
          groups.map((g) => (
            <section key={g.group} aria-labelledby={`group-${g.group}`}>
              <h3 id={`group-${g.group}`} className="px-2.5 pb-1 pt-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {g.group}
              </h3>
              <ul>{g.conversations.map((c) => item(c))}</ul>
            </section>
          ))
        )}
      </div>

      <div className="border-t border-zinc-200 p-2 dark:border-zinc-800">
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <Settings className="h-4 w-4" aria-hidden="true" />
          Settings
        </button>
      </div>
    </nav>
  );
}

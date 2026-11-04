import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { Conversation, Project } from '../../types/conversation';
import { Modal } from '../common/Modal';

interface AddChatsDialogProps {
  open: boolean;
  project: Project;
  /** All chats; those already in this project are hidden. */
  conversations: Conversation[];
  projectName: (id: string) => string | undefined;
  onAdd: (conversationIds: string[]) => void;
  onClose: () => void;
}

/** Lets the user pick existing chats to include in a project. */
export function AddChatsDialog({ open, project, conversations, projectName, onAdd, onClose }: AddChatsDialogProps) {
  return (
    <Modal open={open} title={`Add chats to ${project.name}`} description="Choose existing chats to include in this project." onClose={onClose} className="max-w-lg">
      {open && <AddChatsForm project={project} conversations={conversations} projectName={projectName} onAdd={onAdd} onClose={onClose} />}
    </Modal>
  );
}

function AddChatsForm({ project, conversations, projectName, onAdd, onClose }: Omit<AddChatsDialogProps, 'open'>) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations.filter((c) => c.projectId !== project.id && (!q || c.title.toLowerCase().includes(q)));
  }, [conversations, project.id, query]);
  const available = conversations.some((c) => c.projectId !== project.id);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (!available) {
    return (
      <div className="mt-2">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">All of your chats are already in this project.</p>
        <div className="mt-5 flex justify-end">
          <button type="button" onClick={onClose} className="btn-secondary">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search chats"
          aria-label="Search chats to add"
          autoComplete="off"
          className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-8 pr-3 text-sm outline-none placeholder:text-zinc-400 focus:border-brand-400 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-500"
        />
      </div>
      <ul className="-mx-1 mt-2 max-h-72 overflow-y-auto" aria-label="Chats">
        {candidates.map((c) => {
          const other = c.projectId ? projectName(c.projectId) : undefined;
          return (
            <li key={c.id}>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700">
                <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} className="h-4 w-4 shrink-0 accent-brand-600" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{c.title}</span>
                  {other && <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">Currently in {other}</span>}
                </span>
              </label>
            </li>
          );
        })}
        {candidates.length === 0 && <li className="px-3 py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">No chats match “{query.trim()}”.</li>}
      </ul>
      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        <button type="button" onClick={onClose} className="btn-secondary">
          Cancel
        </button>
        <button type="button" onClick={() => onAdd([...selected])} disabled={selected.size === 0} className="btn-primary">
          {selected.size === 0 ? 'Add chats' : `Add ${selected.size} chat${selected.size === 1 ? '' : 's'}`}
        </button>
      </div>
    </div>
  );
}

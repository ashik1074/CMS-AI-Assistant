import { Check, FolderMinus, FolderOpen, FolderPlus } from 'lucide-react';
import type { Conversation, Project } from '../../types/conversation';
import { cn } from '../../utils/cn';
import { Modal } from '../common/Modal';

interface MoveToProjectDialogProps {
  conversation: Conversation | undefined;
  projects: Project[];
  onMove: (projectId: string | null) => void;
  onCreateProject: () => void;
  onClose: () => void;
}

const rowClass = 'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-700';

/** Picks the project a chat belongs to. */
export function MoveToProjectDialog({ conversation, projects, onMove, onCreateProject, onClose }: MoveToProjectDialogProps) {
  const current = conversation?.projectId ?? null;
  return (
    <Modal open={!!conversation} title={current ? 'Change project' : 'Add to project'} description={conversation ? `“${conversation.title}”` : undefined} onClose={onClose} className="max-w-md">
      <ul className="-mx-1 max-h-72 overflow-y-auto" aria-label="Projects">
        {projects.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => onMove(p.id)} className={cn(rowClass, p.id === current && 'bg-brand-50 text-brand-700 dark:bg-zinc-700 dark:text-zinc-100')} aria-current={p.id === current || undefined}>
              <FolderOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              {p.id === current && <Check className="h-4 w-4 shrink-0" aria-label="Current project" />}
            </button>
          </li>
        ))}
      </ul>
      {projects.length === 0 && <p className="py-2 text-sm text-zinc-500 dark:text-zinc-400">You don&apos;t have any projects yet.</p>}
      <div className="mt-2 space-y-1 border-t border-zinc-200 pt-2 dark:border-zinc-700">
        <button type="button" onClick={onCreateProject} className={cn(rowClass, '-mx-1 w-[calc(100%+0.5rem)] text-brand-700 dark:text-brand-300')}>
          <FolderPlus className="h-4 w-4 shrink-0" aria-hidden="true" />
          New project
        </button>
        {current && (
          <button type="button" onClick={() => onMove(null)} className={cn(rowClass, '-mx-1 w-[calc(100%+0.5rem)]')}>
            <FolderMinus className="h-4 w-4 shrink-0" aria-hidden="true" />
            Remove from project
          </button>
        )}
      </div>
    </Modal>
  );
}

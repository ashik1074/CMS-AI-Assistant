import { FolderMinus, FolderOpen, FolderX, MessageSquareText, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Ref } from 'react';
import type { Attachment, ChatMode } from '../../types/chat';
import type { Conversation, Project } from '../../types/conversation';
import { ChatInput, type ChatInputHandle } from '../chat/ChatInput';
import { IconButton } from '../common/IconButton';

interface ProjectViewProps {
  project: Project | undefined;
  conversations: Conversation[];
  inputRef: Ref<ChatInputHandle>;
  onStartChat: (text: string, attachments: Attachment[], mode: ChatMode) => boolean;
  onOpenChat: (id: string) => void;
  onRemoveChat: (id: string) => void;
  onAddChats: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onNewChat: () => void;
}

const dateFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export function ProjectView({ project, conversations, inputRef, onStartChat, onOpenChat, onRemoveChat, onAddChats, onEdit, onDelete, onNewChat }: ProjectViewProps) {
  if (!project) {
    return (
      <div className="chat-surface flex flex-1 flex-col items-center justify-center px-6 pt-14 text-center" role="alert">
        <FolderX className="h-10 w-10 text-zinc-400" aria-hidden="true" />
        <h1 className="mt-4 text-xl font-semibold">Project not found</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">It may have been deleted, or it was created in a different browser.</p>
        <button type="button" className="btn-primary mt-5" onClick={onNewChat}>
          Start a new chat
        </button>
      </div>
    );
  }

  return (
    <div className="chat-surface flex min-h-0 flex-1 flex-col overflow-y-auto pt-14" data-testid="project-view">
      <div className="mx-auto w-full max-w-3xl px-4 pb-10 pt-6 sm:px-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/20 dark:text-brand-300" aria-hidden="true">
            <FolderOpen className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-2xl font-semibold tracking-tight">{project.name}</h1>
            {project.description && <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">{project.description}</p>}
          </div>
          <div className="flex shrink-0 items-center">
            <IconButton label="Edit project" onClick={onEdit} tooltipSide="bottom">
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </IconButton>
            <IconButton label="Delete project" onClick={onDelete} tooltipSide="bottom" className="hover:text-red-600 dark:hover:text-red-400">
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </IconButton>
          </div>
        </div>

        <div className="-mx-3 mt-6 sm:-mx-6">
          <ChatInput ref={inputRef} onSend={onStartChat} onStop={() => {}} generating={false} />
        </div>

        <section aria-labelledby="project-chats-heading" className="mt-6">
          <div className="flex items-center justify-between gap-3 border-b border-zinc-200 pb-2 dark:border-zinc-700">
            <h2 id="project-chats-heading" className="text-sm font-semibold">
              Chats in this project <span className="font-normal text-zinc-500 dark:text-zinc-400">({conversations.length})</span>
            </h2>
            <button type="button" onClick={onAddChats} className="btn-secondary min-h-8 px-3">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add chats
            </button>
          </div>

          {conversations.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <MessageSquareText className="h-8 w-8 text-zinc-400" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium">No chats in this project yet</p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Start a chat above, or add your existing chats.</p>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800" aria-label="Project chats">
              {conversations.map((c) => {
                const lastUser = [...c.messages].reverse().find((m) => m.role === 'user')?.content;
                return (
                  <li key={c.id} className="group flex items-center gap-2">
                    <button type="button" onClick={() => onOpenChat(c.id)} className="min-w-0 flex-1 rounded-lg px-2 py-3 text-left transition-colors hover:bg-white dark:hover:bg-zinc-800">
                      <span className="block truncate text-sm font-medium">{c.title}</span>
                      <span className="mt-0.5 block truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {lastUser && lastUser !== c.title ? `${lastUser} · ` : ''}
                        {dateFormat.format(c.updatedAt)}
                      </span>
                    </button>
                    <IconButton
                      label={`Remove ${c.title} from project`}
                      tooltip={false}
                      size="sm"
                      onClick={() => onRemoveChat(c.id)}
                      className="opacity-0 focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                    >
                      <FolderMinus className="h-4 w-4" aria-hidden="true" />
                    </IconButton>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

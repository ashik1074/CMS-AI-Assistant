import { useEffect, useMemo, useState } from 'react';
import { Eye, LinkIcon, MessageSquarePlus } from 'lucide-react';
import { decodeSharedChat, sharedChatToMessages, type SharedChat } from '../../utils/share';
import { MessageList } from '../chat/MessageList';

interface SharedChatViewProps {
  payload: string;
  /** Saves a copy of the shared chat to this browser and opens it. */
  onContinue: (chat: SharedChat) => void;
  onNewChat: () => void;
}

const noop = () => {};
const noopSubmit = () => false;

/** Read-only view of a chat opened from a share link. */
export function SharedChatView({ payload, onContinue, onNewChat }: SharedChatViewProps) {
  const [state, setState] = useState<{ payload: string; chat: SharedChat | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    decodeSharedChat(payload).then((chat) => {
      if (!cancelled) setState({ payload, chat });
    });
    return () => {
      cancelled = true;
    };
  }, [payload]);

  const chat = state?.payload === payload ? state.chat : undefined;
  const messages = useMemo(() => {
    let n = 0;
    return chat ? sharedChatToMessages(chat, 'shared', () => `shared-${n++}`) : [];
  }, [chat]);

  useEffect(() => {
    if (chat) document.title = `${chat.title} · Shared · AI Assistant (Demo)`;
  }, [chat]);

  if (chat === undefined) {
    return (
      <div className="flex flex-1 items-center justify-center pt-14 text-sm text-zinc-500 dark:text-zinc-400" role="status">
        Opening shared chat…
      </div>
    );
  }

  if (chat === null) {
    return (
      <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center px-6 pt-14 text-center" role="alert">
        <LinkIcon className="h-10 w-10 text-zinc-400" aria-hidden="true" />
        <h1 className="mt-4 text-xl font-semibold">This share link doesn&apos;t work</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">The link may be incomplete. Ask whoever sent it to copy it again.</p>
        <button type="button" className="btn-primary mt-5" onClick={onNewChat}>
          Start a new chat
        </button>
      </div>
    );
  }

  return (
    <div className="chat-surface relative flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pt-14" data-testid="shared-chat">
        <div className="mx-auto w-full max-w-3xl px-4 pt-4 sm:px-6">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            Shared chat · read-only
          </div>
          <h1 className="mt-1 text-2xl font-semibold" data-testid="shared-title">
            {chat.title}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Shared {new Date(chat.sharedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
          </p>
        </div>
        {messages.length ? (
          <MessageList messages={messages} busy={false} onRegenerate={noop} onEditSubmit={noopSubmit} onFeedback={noop} readOnly />
        ) : (
          <p className="mx-auto mt-8 text-sm text-zinc-500 dark:text-zinc-400">This shared chat has no messages.</p>
        )}
      </div>
      <div className="shrink-0 border-t border-zinc-200 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-zinc-800">
        <div className="mx-auto flex max-w-3xl flex-col items-center justify-between gap-2 sm:flex-row">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Want to pick up where this left off?</p>
          <button type="button" className="btn-primary" onClick={() => onContinue(chat)}>
            <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
            Continue this chat
          </button>
        </div>
      </div>
    </div>
  );
}

import { useCallback, useLayoutEffect, useRef, useState, type Ref } from 'react';
import { ArrowDown, SearchX } from 'lucide-react';
import type { Attachment, ChatMode, Feedback } from '../../types/chat';
import type { Conversation } from '../../types/conversation';
import type { ProductSetupHandlers } from '../agent/ProductSetupCard';
import type { ReportHandlers } from '../../hooks/useReports';
import { ChatInput, type ChatInputHandle } from './ChatInput';
import { MessageList } from './MessageList';
import { WelcomeScreen } from './WelcomeScreen';
import { Mascot } from '../mascot/Mascot';
import { MascotLauncher, MascotRideProvider } from '../mascot/RocketRide';

interface ChatContainerProps {
  conversation: Conversation | undefined;
  missing: boolean;
  generating: boolean;
  inputRef: Ref<ChatInputHandle>;
  onSend: (text: string, attachments: Attachment[], mode: ChatMode) => boolean;
  onStop: () => void;
  onRegenerate: (messageId: string) => void;
  onEditSubmit: (messageId: string, content: string) => boolean;
  onFeedback: (messageId: string, feedback: Feedback) => void;
  onNewChat: () => void;
  productSetup?: ProductSetupHandlers;
  reports?: ReportHandlers;
  /** Fixed length for the mascot's tricks when it is clicked. */
  mascotRideMs?: number;
}

const BOTTOM_THRESHOLD = 80;

export function ChatContainer({ conversation, missing, generating, inputRef, onSend, onStop, onRegenerate, onEditSubmit, onFeedback, onNewChat, productSetup, reports, mascotRideMs }: ChatContainerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  /** Follow new content only while the user is at (or near) the bottom. */
  const stickToBottom = useRef(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const messages = conversation?.messages;

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current = true;
    if (typeof el.scrollTo === 'function') el.scrollTo({ top: el.scrollHeight, behavior });
    else el.scrollTop = el.scrollHeight;
  }, []);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD;
    stickToBottom.current = atBottom;
    setShowScrollButton(!atBottom);
  };

  // Jump to the latest message when switching conversations.
  useLayoutEffect(() => {
    scrollToBottom();
  }, [conversation?.id, scrollToBottom]);

  // Keep following streamed content if the user hasn't scrolled away.
  useLayoutEffect(() => {
    if (stickToBottom.current) scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = (text: string, attachments: Attachment[] = [], mode: ChatMode = 'general') => {
    const ok = onSend(text, attachments, mode);
    if (ok) {
      stickToBottom.current = true;
      requestAnimationFrame(() => scrollToBottom('smooth'));
    }
    return ok;
  };

  const hasMessages = !!messages && messages.length > 0;
  const streaming = generating && messages?.at(-1)?.status === 'streaming';
  // The mascot rests beside the message box once a chat has started. While a new answer is being
  // prepared it leaves to "think" in the chat, then flies back down as the answer is written.
  const perched = hasMessages && (!generating || streaming);

  return (
    <MascotRideProvider durationMs={mascotRideMs}>
      <div className="chat-surface relative flex min-h-0 flex-1 flex-col">
        <div ref={scrollRef} onScroll={onScroll} className="flex min-h-0 flex-1 flex-col overflow-y-auto pt-14" data-testid="chat-scroll">
          {missing ? (
            <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center px-6 text-center" role="alert">
              <SearchX className="h-10 w-10 text-zinc-400" aria-hidden="true" />
              <h1 className="mt-4 text-xl font-semibold">Conversation not found</h1>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">It may have been deleted, or it was saved in a different browser.</p>
              <button type="button" className="btn-primary mt-5" onClick={onNewChat}>
                Start a new chat
              </button>
            </div>
          ) : hasMessages ? (
            <MessageList messages={messages} busy={generating} onRegenerate={onRegenerate} onEditSubmit={onEditSubmit} onFeedback={onFeedback} productSetup={productSetup} reports={reports} />
          ) : (
            <WelcomeScreen onSuggestion={(p) => void handleSend(p)} disabled={generating} />
          )}
        </div>

        {showScrollButton && hasMessages && (
          <button
            type="button"
            onClick={() => scrollToBottom('smooth')}
            aria-label="Scroll to latest message"
            className="absolute bottom-28 left-1/2 z-10 flex h-9 w-9 -translate-x-1/2 animate-fade-in items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-md hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            <ArrowDown className="h-4 w-4" aria-hidden="true" />
          </button>
        )}

        {!missing && (
          <div className="relative shrink-0 pb-[env(safe-area-inset-bottom)] pt-1">
            {perched && (
              <div className="pointer-events-none absolute inset-x-0 top-1 mx-auto w-full max-w-3xl px-3 sm:px-6">
                <div className="mascot-land absolute bottom-full right-6 -mb-2 sm:right-10 xl:bottom-auto xl:-right-10 xl:top-6 xl:mb-0" data-testid="composer-mascot">
                  <MascotLauncher>
                    <Mascot size={44} mood={streaming ? 'working' : 'idle'} className="block text-zinc-900 dark:text-white" />
                  </MascotLauncher>
                </div>
              </div>
            )}
            <ChatInput ref={inputRef} onSend={handleSend} onStop={onStop} generating={generating} />
          </div>
        )}
      </div>
    </MascotRideProvider>
  );
}

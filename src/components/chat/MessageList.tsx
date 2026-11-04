import type { Feedback, Message } from '../../types/chat';
import type { ProductSetupHandlers } from '../agent/ProductSetupCard';
import type { ReportHandlers } from '../../hooks/useReports';
import { MessageBubble } from './MessageBubble';

interface MessageListProps {
  messages: Message[];
  busy: boolean;
  onRegenerate: (messageId: string) => void;
  onEditSubmit: (messageId: string, content: string) => boolean;
  onFeedback: (messageId: string, feedback: Feedback) => void;
  /** Hides edit, regenerate and feedback (e.g. a shared chat). Copy stays available. */
  readOnly?: boolean;
  productSetup?: ProductSetupHandlers;
  reports?: ReportHandlers;
}

export function MessageList({ messages, busy, onRegenerate, onEditSubmit, onFeedback, readOnly, productSetup, reports }: MessageListProps) {
  const lastAssistantId = messages.findLast((m) => m.role === 'assistant')?.id;
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pb-6 pt-6 sm:px-6" data-testid="message-list">
      <h2 className="sr-only">Conversation</h2>
      {messages.map((m) => (
        <MessageBubble
          key={m.id}
          message={m}
          isLast={m.id === lastAssistantId && messages[messages.length - 1]?.id === m.id}
          busy={busy}
          onRegenerate={onRegenerate}
          onEditSubmit={onEditSubmit}
          onFeedback={onFeedback}
          readOnly={readOnly}
          productSetup={productSetup}
          reports={reports}
        />
      ))}
    </div>
  );
}

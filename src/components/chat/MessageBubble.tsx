import { memo, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { FileText, Sparkles } from 'lucide-react';
import type { Attachment, Feedback, Message } from '../../types/chat';
import { formatFileSize } from '../../utils/attachments';
import { chatModeOption } from './chatModes';
import { formatFullDate } from '../../utils/formatTime';
import { cn } from '../../utils/cn';
import { ProcessingIndicator } from '../assistant/ProcessingIndicator';
import { ErrorState } from '../common/ErrorState';
import { ProductSetupCard, type ProductSetupHandlers } from '../agent/ProductSetupCard';
import { ProductReportCard, TransactionReportCard } from '../reports/ReportCards';
import { CustomerLookupCard } from '../customers/CustomerLookupCard';
import type { ReportHandlers } from '../../hooks/useReports';
import { Markdown } from './Markdown';
import { ThinkingMascot } from '../mascot/ThinkingMascot';
import { MessageActions } from './MessageActions';

interface MessageBubbleProps {
  message: Message;
  isLast: boolean;
  busy: boolean;
  onRegenerate: (messageId: string) => void;
  onEditSubmit: (messageId: string, content: string) => boolean;
  onFeedback: (messageId: string, feedback: Feedback) => void;
  readOnly?: boolean;
  productSetup?: ProductSetupHandlers;
  reports?: ReportHandlers;
}

export const MessageBubble = memo(function MessageBubble(props: MessageBubbleProps) {
  return props.message.role === 'user' ? <UserMessage {...props} /> : <AssistantMessage {...props} />;
});

function ModeTag({ mode }: { mode: NonNullable<Message['mode']> }) {
  const option = chatModeOption(mode);
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-500/20 dark:text-brand-300" data-testid="message-mode">
      <option.icon className="h-3 w-3" aria-hidden="true" />
      {option.label}
    </span>
  );
}

function AttachmentList({ attachments }: { attachments: Attachment[] }) {
  return (
    <ul className="flex max-w-[85%] flex-wrap justify-end gap-2" aria-label="Attachments" data-testid="message-attachments">
      {attachments.map((a) => (
        <li key={a.id}>
          {a.previewUrl ? (
            <img src={a.previewUrl} alt={a.name} title={a.name} className="h-32 max-w-[240px] rounded-xl border border-zinc-200 object-cover dark:border-zinc-700" />
          ) : (
            <div className="flex max-w-[260px] items-center gap-2.5 rounded-xl border border-zinc-200 bg-white p-2 pr-3 dark:border-zinc-700 dark:bg-zinc-800" title={a.name}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white" aria-hidden="true">
                <FileText className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{a.name}</span>
                <span className="block text-xs text-zinc-500 dark:text-zinc-400">{formatFileSize(a.size)}</span>
              </span>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function UserMessage({ message, busy, onEditSubmit, readOnly }: MessageBubbleProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) return;
    const el = textareaRef.current;
    if (el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
    }
  }, [editing]);

  const startEdit = () => {
    setDraft(message.content);
    setEditing(true);
  };
  const hasAttachments = !!message.attachments?.length;
  const canSubmit = (!!draft.trim() || hasAttachments) && !busy;
  const submit = () => {
    if (!canSubmit) return;
    if (draft.trim() === message.content) {
      setEditing(false);
      return;
    }
    if (onEditSubmit(message.id, draft)) setEditing(false);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setEditing(false);
    } else if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  if (editing) {
    return (
      <article aria-label="Editing your message" className="flex justify-end">
        <div className="w-full max-w-[85%] rounded-3xl border border-zinc-200 bg-white p-3 dark:border-transparent dark:bg-zinc-800">
          <label className="sr-only" htmlFor={`edit-${message.id}`}>
            Edit message
          </label>
          <textarea
            id={`edit-${message.id}`}
            ref={textareaRef}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 320)}px`;
            }}
            onKeyDown={onKeyDown}
            rows={1}
            className="w-full resize-none bg-transparent px-2 py-1 leading-relaxed outline-none"
          />
          <p className="px-2 pb-1 text-xs text-zinc-500 dark:text-zinc-400">Submitting replaces the responses after this message.</p>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary min-h-9 rounded-full" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button type="button" className="btn-primary min-h-9 rounded-full" onClick={submit} disabled={!canSubmit}>
              Send
            </button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article aria-label="Your message" className="group flex flex-col items-end gap-1">
      {message.mode && <ModeTag mode={message.mode} />}
      {hasAttachments && <AttachmentList attachments={message.attachments!} />}
      {message.content && (
        <div
          data-testid="user-message"
          className="max-w-[85%] whitespace-pre-wrap rounded-3xl bg-brand-50 px-4 py-2.5 leading-relaxed [overflow-wrap:anywhere] dark:bg-zinc-800"
          title={formatFullDate(message.createdAt)}
        >
          {message.content}
        </div>
      )}
      <div className="flex items-center gap-1">
        {message.editedAt && <span className="text-xs text-zinc-400 dark:text-zinc-500">Edited</span>}
        <MessageActions message={message} busy={busy} onEdit={readOnly ? undefined : startEdit} />
      </div>
    </article>
  );
}

function AssistantMessage({ message, isLast, busy, onRegenerate, onFeedback, readOnly, productSetup, reports }: MessageBubbleProps) {
  const streaming = message.status === 'streaming';
  const inFlight = message.status === 'pending' || streaming;
  const showActions = !inFlight && message.status !== 'failed' && message.content.length > 0;

  return (
    <article
      aria-label="Assistant response"
      aria-busy={inFlight}
      className="group flex gap-3 sm:gap-4"
      data-testid="assistant-message"
      data-status={message.status}
    >
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-brand-50 dark:border-zinc-700 dark:bg-zinc-900" aria-hidden="true">
        <Sparkles className="h-4 w-4 text-brand-600 dark:text-zinc-300" />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        {/* Key resets the expand/collapse state for each regeneration. */}
        <ProcessingIndicator key={message.revision ?? 0} message={message} />
        {message.status === 'pending' && <ThinkingMascot />}

        {message.content && <Markdown content={message.content} streaming={streaming} />}

        {message.action?.type === 'createProduct' && message.status === 'completed' && (
          <ProductSetupCard messageId={message.id} action={message.action} handlers={productSetup} readOnly={readOnly} />
        )}
        {message.action?.type === 'productReport' && message.status === 'completed' && <ProductReportCard messageId={message.id} action={message.action} handlers={reports} readOnly={readOnly} />}
        {message.action?.type === 'transactionReport' && message.status === 'completed' && (
          <TransactionReportCard messageId={message.id} action={message.action} handlers={reports} readOnly={readOnly} />
        )}
        {message.action?.type === 'customerLookup' && message.status === 'completed' && (
          <CustomerLookupCard messageId={message.id} action={message.action} handlers={reports} readOnly={readOnly} />
        )}

        {message.status === 'cancelled' && (
          <p className={cn('text-sm italic text-zinc-500 dark:text-zinc-400', message.content && 'mt-2')}>
            {message.content ? 'Response stopped before completion.' : 'You stopped this response before it started.'}
          </p>
        )}

        {message.status === 'failed' && (
          <ErrorState
            className="mt-1"
            compact
            title="The response couldn't be generated"
            message={message.error ?? 'An unknown error occurred.'}
            onRetry={isLast ? () => onRegenerate(message.id) : undefined}
            retryDisabled={busy}
          />
        )}

        {(showActions || (message.revision ?? 0) > 0) && (
          <div className="mt-2 flex items-center gap-2">
            {showActions && (
              <MessageActions
                message={message}
                busy={busy}
                canRegenerate={isLast && !readOnly}
                onRegenerate={() => onRegenerate(message.id)}
                onFeedback={readOnly ? undefined : (f) => onFeedback(message.id, f)}
                alwaysVisible={isLast}
                className="-ml-1.5"
              />
            )}
            {(message.revision ?? 0) > 0 && !inFlight && (
              <span className="text-xs text-zinc-400 dark:text-zinc-500" data-testid="regenerated-label">
                Regenerated{message.revision! > 1 ? ` ×${message.revision}` : ''}
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

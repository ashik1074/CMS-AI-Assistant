import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Pencil, RefreshCw, ThumbsDown, ThumbsUp } from 'lucide-react';
import type { Feedback, Message } from '../../types/chat';
import { copyToClipboard } from '../../utils/clipboard';
import { cn } from '../../utils/cn';
import { IconButton } from '../common/IconButton';
import { useToast } from '../common/toastContext';

interface MessageActionsProps {
  message: Message;
  /** Disables regenerate/edit while the conversation is generating. */
  busy: boolean;
  canRegenerate?: boolean;
  onRegenerate?: () => void;
  onEdit?: () => void;
  onFeedback?: (feedback: Feedback) => void;
  alwaysVisible?: boolean;
  className?: string;
}

export function MessageActions({ message, busy, canRegenerate, onRegenerate, onEdit, onFeedback, alwaysVisible, className }: MessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const onCopy = async () => {
    const ok = await copyToClipboard(message.content);
    if (ok) {
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } else {
      toast.show("Couldn't copy to the clipboard. Your browser may have blocked access.", { kind: 'error' });
    }
  };

  const isAssistant = message.role === 'assistant';

  return (
    <div
      className={cn(
        'flex items-center gap-0.5 transition-opacity',
        !alwaysVisible && 'opacity-0 group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100',
        className,
      )}
      role="toolbar"
      aria-label={isAssistant ? 'Response actions' : 'Message actions'}
    >
      <IconButton size="sm" label={copied ? 'Copied' : 'Copy'} onClick={onCopy} disabled={!message.content}>
        {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
      </IconButton>
      {!isAssistant && onEdit && (
        <IconButton size="sm" label="Edit message" onClick={onEdit} disabled={busy}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </IconButton>
      )}
      {isAssistant && canRegenerate && onRegenerate && (
        <IconButton size="sm" label="Regenerate response" onClick={onRegenerate} disabled={busy}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
        </IconButton>
      )}
      {isAssistant && onFeedback && message.status === 'completed' && (
        <>
          <IconButton
            size="sm"
            label={message.feedback === 'up' ? 'Remove good response rating' : 'Good response'}
            aria-pressed={message.feedback === 'up'}
            active={message.feedback === 'up'}
            onClick={() => onFeedback('up')}
          >
            <ThumbsUp className="h-4 w-4" aria-hidden="true" fill={message.feedback === 'up' ? 'currentColor' : 'none'} />
          </IconButton>
          <IconButton
            size="sm"
            label={message.feedback === 'down' ? 'Remove bad response rating' : 'Bad response'}
            aria-pressed={message.feedback === 'down'}
            active={message.feedback === 'down'}
            onClick={() => onFeedback('down')}
          >
            <ThumbsDown className="h-4 w-4" aria-hidden="true" fill={message.feedback === 'down' ? 'currentColor' : 'none'} />
          </IconButton>
        </>
      )}
    </div>
  );
}

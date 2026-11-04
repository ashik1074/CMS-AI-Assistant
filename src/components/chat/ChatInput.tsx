import {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { ArrowUp, Check, ChevronDown, FileText, Plus, Square, X } from 'lucide-react';
import type { Attachment, ChatMode } from '../../types/chat';
import { ACCEPTED_FILE_TYPES, formatFileSize, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS, toAttachment } from '../../utils/attachments';
import { cn } from '../../utils/cn';
import { DropdownMenu, menuItemClass } from '../common/DropdownMenu';
import { IconButton } from '../common/IconButton';
import { CHAT_MODES, chatModeOption } from './chatModes';

export interface ChatInputHandle {
  focus: () => void;
  setValue: (value: string) => void;
}

interface ChatInputProps {
  /** Returns true if the message was accepted (the composer is then cleared). */
  onSend: (text: string, attachments: Attachment[], mode: ChatMode) => boolean;
  onStop: () => void;
  generating: boolean;
  disabled?: boolean;
}

const MAX_HEIGHT = 200;
export const MAX_MESSAGE_LENGTH = 8000;

export const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(function ChatInput({ onSend, onStop, generating, disabled }, ref) {
  const [value, setValue] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachError, setAttachError] = useState('');
  // The mode sticks across messages until the user changes it.
  const [mode, setMode] = useState<ChatMode>('general');
  const currentMode = chatModeOption(mode);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
    setValue: (v: string) => {
      setValue(v);
      textareaRef.current?.focus();
    },
  }));

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? 'auto' : 'hidden';
  }, [value]);

  const tooLong = value.length > MAX_MESSAGE_LENGTH;
  const hasContent = value.trim().length > 0 || attachments.length > 0;
  const canSend = hasContent && !generating && !disabled && !tooLong;

  const addFiles = async (files: File[]) => {
    if (files.length === 0) return;
    const room = MAX_ATTACHMENTS - attachments.length;
    const tooBig = files.filter((f) => f.size > MAX_ATTACHMENT_BYTES);
    const accepted = files.filter((f) => f.size <= MAX_ATTACHMENT_BYTES).slice(0, Math.max(0, room));
    if (tooBig.length) setAttachError(`${tooBig.map((f) => f.name).join(', ')} ${tooBig.length === 1 ? 'is' : 'are'} larger than ${formatFileSize(MAX_ATTACHMENT_BYTES)}.`);
    else if (files.length > room) setAttachError(`You can attach up to ${MAX_ATTACHMENTS} files per message.`);
    else setAttachError('');
    if (accepted.length === 0) return;
    const added = await Promise.all(accepted.map(toAttachment));
    setAttachments((prev) => [...prev, ...added].slice(0, MAX_ATTACHMENTS));
    textareaRef.current?.focus();
  };

  const onFilesChosen = (e: ChangeEvent<HTMLInputElement>) => {
    void addFiles(Array.from(e.target.files ?? []));
    // Reset so choosing the same file again still fires `change`.
    e.target.value = '';
  };

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(e.clipboardData.files);
    if (files.length === 0) return;
    e.preventDefault();
    void addFiles(files);
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
    setAttachError('');
    textareaRef.current?.focus();
  };

  const submit = () => {
    if (!canSend) return;
    if (onSend(value, attachments, mode)) {
      setValue('');
      setAttachments([]);
      setAttachError('');
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <form onSubmit={onSubmit} className="mx-auto w-full max-w-3xl px-3 sm:px-6" aria-label="Send a message">
      <div
        className={cn(
          'flex flex-col rounded-2xl border bg-white px-2 pb-2 pt-1.5 shadow-sm transition-colors dark:bg-zinc-800',
          'border-zinc-200 focus-within:border-brand-400 focus-within:ring-3 focus-within:ring-brand-100 dark:border-zinc-700 dark:focus-within:border-zinc-500 dark:focus-within:ring-0',
          tooLong && 'border-red-400 focus-within:border-red-500 dark:border-red-500',
        )}
      >
        {attachments.length > 0 && (
          <ul className="flex flex-wrap gap-2 px-1.5 pb-1 pt-1.5" aria-label="Attachments">
            {attachments.map((a) => (
              <li key={a.id} className="relative">
                {a.previewUrl ? (
                  <img src={a.previewUrl} alt={a.name} title={a.name} className="h-16 w-16 rounded-lg border border-zinc-200 object-cover dark:border-zinc-700" />
                ) : (
                  <div className="flex h-16 max-w-[220px] items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 py-2 pl-2 pr-6 dark:border-zinc-700 dark:bg-zinc-900" title={a.name}>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-600 text-white" aria-hidden="true">
                      <FileText className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{a.name}</span>
                      <span className="block text-xs text-zinc-500 dark:text-zinc-400">{formatFileSize(a.size)}</span>
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeAttachment(a.id)}
                  aria-label={`Remove ${a.name}`}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-white shadow hover:bg-zinc-900 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-white"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <label htmlFor="chat-input" className="sr-only">
          Message AI Assistant
        </label>
        <textarea
          id="chat-input"
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          rows={1}
          placeholder="Ask anything..."
          disabled={disabled}
          aria-describedby="chat-input-hint"
          aria-invalid={tooLong || undefined}
          className="max-h-[200px] min-h-[40px] w-full resize-none bg-transparent px-2 py-2 leading-6 outline-none placeholder:text-zinc-400 disabled:opacity-60 dark:placeholder:text-zinc-500"
        />

        <div className="flex items-center justify-between">
          <input ref={fileInputRef} type="file" multiple accept={ACCEPTED_FILE_TYPES} onChange={onFilesChosen} className="hidden" data-testid="attachment-input" tabIndex={-1} />
          <div className="flex items-center gap-1">
            <IconButton
              label="Add files or images"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || attachments.length >= MAX_ATTACHMENTS}
            >
              <Plus className="h-5 w-5" aria-hidden="true" />
            </IconButton>
            <DropdownMenu
              label="Assistant mode"
              side="top"
              className="w-64"
              trigger={(props) => (
                <button
                  {...props}
                  type="button"
                  disabled={disabled}
                  aria-label={`Assistant mode: ${currentMode.label}`}
                  data-testid="mode-trigger"
                  className={cn(
                    'inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-colors disabled:opacity-50',
                    mode === 'general'
                      ? 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-zinc-100'
                      : 'bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-500/20 dark:text-brand-300 dark:hover:bg-brand-500/30',
                  )}
                >
                  <currentMode.icon className="h-4 w-4" aria-hidden="true" />
                  {currentMode.label}
                  <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
                </button>
              )}
            >
              {CHAT_MODES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={m.value === mode}
                  onClick={() => setMode(m.value)}
                  className={cn(menuItemClass, 'items-start')}
                >
                  <m.icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-300" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{m.label}</span>
                    <span className="block text-xs text-zinc-500 dark:text-zinc-400">{m.description}</span>
                  </span>
                  {m.value === mode && <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-300" aria-hidden="true" />}
                </button>
              ))}
            </DropdownMenu>
          </div>
          {generating ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop generating"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white transition-colors hover:bg-brand-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              <Square className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSend}
              aria-label="Send message"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white transition-colors hover:bg-brand-700 disabled:bg-brand-200 disabled:text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-500"
            >
              <ArrowUp className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      <p id="chat-input-hint" className="px-2 py-2 text-center text-xs text-zinc-500 dark:text-zinc-400">
        {tooLong ? (
          <span className="text-red-600 dark:text-red-400" role="alert">
            Message is too long ({value.length.toLocaleString()} / {MAX_MESSAGE_LENGTH.toLocaleString()} characters).
          </span>
        ) : attachError ? (
          <span className="text-red-600 dark:text-red-400" role="alert">
            {attachError}
          </span>
        ) : (
          <>Demo mode — responses are pre-written mock content, not a real AI model.</>
        )}
      </p>
    </form>
  );
});

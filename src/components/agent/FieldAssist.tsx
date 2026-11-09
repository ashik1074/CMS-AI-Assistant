import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUp, Loader2, MessageCircleQuestion, Sparkles, WandSparkles, X } from 'lucide-react';
import { cn } from '../../utils/cn';
import { QUICK_QUESTIONS, type FieldAnswer } from '../../utils/fieldAssist';
import { menuItemClass } from '../common/DropdownMenu';
import { useFieldAssist } from './fieldAssistContext';

type Mode = 'closed' | 'menu' | 'ask';

const SIZES: Record<Exclude<Mode, 'closed'>, { width: number; height: number }> = { menu: { width: 256, height: 150 }, ask: { width: 320, height: 380 } };
const EDGE = 8;
const GAP = 6;
const FOCUSABLE = 'button:not(:disabled), input:not(:disabled)';

interface Reply {
  question: string;
  answer: FieldAnswer;
  text: string;
  /** Characters revealed so far; -1 while "thinking". */
  shown: number;
}

interface FieldAssistProps {
  /** The field's key, as in the validation errors, e.g. `productName` or `domesticLimits.0.perTxMax`. */
  fieldKey: string;
  label: string;
  /** Placement of the button. By default, the end of the field's label row. */
  className?: string;
}

const popoverClass =
  'fixed z-50 flex animate-fade-in flex-col rounded-xl border border-zinc-200 bg-white text-left text-sm font-normal text-zinc-900 shadow-lg dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100';

/**
 * The AI button of a form field. It shows while the field has focus, and offers to fill in the field
 * or to answer questions about it. Renders nothing outside a FieldAssistContext provider.
 *
 * The menu and the question panel float above the page, next to the button, so the scrolling form
 * doesn't cut them off. They open upwards when there is more room above the field.
 */
export function FieldAssist({ fieldKey, label, className = 'absolute -top-1 right-0' }: FieldAssistProps) {
  const api = useFieldAssist();
  const [mode, setMode] = useState<Mode>('closed');
  const [question, setQuestion] = useState('');
  const [reply, setReply] = useState<Reply | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timers = useRef<number[]>([]);
  const id = useId();

  const stopTyping = useCallback(() => {
    timers.current.forEach((t) => {
      clearTimeout(t);
      clearInterval(t);
    });
    timers.current = [];
  }, []);

  const close = useCallback(
    (refocus = true) => {
      stopTyping();
      setMode('closed');
      setReply(null);
      setQuestion('');
      if (refocus) buttonRef.current?.focus();
    },
    [stopTyping],
  );

  useEffect(() => stopTyping, [stopTyping]);

  // Places the popover next to the button, and keeps it there while the page scrolls.
  useLayoutEffect(() => {
    if (mode === 'closed') return;
    const place = () => {
      const button = buttonRef.current;
      const popover = popoverRef.current;
      if (!button || !popover) return;
      const r = button.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const size = SIZES[mode];
      const width = Math.min(size.width, vw - 2 * EDGE);
      // End-aligned with the button, unless that runs off the left edge.
      let left = r.right - width;
      if (left < EDGE) left = r.left;
      left = Math.max(EDGE, Math.min(left, vw - width - EDGE));
      // The question panel opens beside the whole field, so it doesn't cover the value being asked about.
      const field = mode === 'ask' ? rootRef.current?.closest('[data-assist-field]') : null;
      const a = field?.getBoundingClientRect() ?? r;
      const below = vh - a.bottom - GAP - EDGE;
      const above = Math.min(a.top, r.top) - GAP - EDGE;
      const down = below >= size.height || below >= above;
      Object.assign(popover.style, {
        width: `${width}px`,
        left: `${left}px`,
        top: down ? `${a.bottom + GAP}px` : '',
        bottom: down ? '' : `${vh - Math.min(a.top, r.top) + GAP}px`,
        maxHeight: `${Math.max(120, down ? below : above)}px`,
      });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [mode]);

  useEffect(() => {
    if (mode === 'closed') return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!rootRef.current?.contains(target) && !popoverRef.current?.contains(target)) close(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [mode, close]);

  useEffect(() => {
    if (mode === 'menu') popoverRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    if (mode === 'ask') inputRef.current?.focus();
  }, [mode]);

  // The answer is fully shown: stop the typing effect.
  useEffect(() => {
    if (reply && reply.shown >= reply.text.length) stopTyping();
  }, [reply, stopTyping]);

  if (!api || api.disabled) return null;

  const open = mode !== 'closed';
  const typing = !!reply && reply.shown < reply.text.length;

  const fill = () => {
    const filled = api.autofill(fieldKey, label);
    close(false);
    const field = rootRef.current?.closest<HTMLElement>('[data-assist-field]');
    field?.querySelector<HTMLElement>('input, select, textarea')?.focus();
    if (filled && field) {
      field.dataset.aiFilled = '';
      window.setTimeout(() => delete field.dataset.aiFilled, 1200);
    }
  };

  const ask = (text: string) => {
    const q = text.trim();
    if (!q || typing) return;
    stopTyping();
    const answer = api.answer(fieldKey, label, q);
    const full = answer.paragraphs.join('\n\n');
    setQuestion('');
    const instant = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    setReply({ question: q, answer, text: full, shown: instant ? full.length : -1 });
    if (instant) return;
    timers.current.push(
      window.setTimeout(() => {
        setReply((r) => r && { ...r, shown: 0 });
        timers.current.push(window.setInterval(() => setReply((r) => r && { ...r, shown: Math.min(r.text.length, r.shown + 6) }), 16));
      }, 450),
    );
  };

  // Keyboard inside the popover. React passes these events up through the portal.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    const popover = popoverRef.current;
    if (!popover || !popover.contains(e.target as Node)) return;
    if (mode === 'menu') {
      if (e.key === 'Tab') {
        e.preventDefault();
        close();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const items = Array.from(popover.querySelectorAll<HTMLElement>('[role="menuitem"]'));
        const at = items.indexOf(document.activeElement as HTMLElement);
        items[(at + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
      }
    } else if (e.key === 'Tab') {
      // Keep Tab inside the panel while it is open.
      const items = Array.from(popover.querySelectorAll<HTMLElement>(FOCUSABLE));
      const first = items[0];
      const last = items.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  };

  // Focus moved somewhere else on the page (not just a click on the panel's text).
  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    const next = e.relatedTarget as Node | null;
    if (next && !popoverRef.current?.contains(next) && !rootRef.current?.contains(next)) close(false);
  };

  const popover =
    mode === 'menu' ? (
      <div id={id} ref={popoverRef} role="menu" aria-label={`AI help for ${label}`} className={cn(popoverClass, 'p-1')} onBlur={onBlur}>
        <button type="button" role="menuitem" className={menuItemClass} onClick={fill}>
          <WandSparkles className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-300" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block font-medium">Auto-fill this field</span>
            <span className="block text-xs text-zinc-500 dark:text-zinc-400">AI picks a value from your other answers</span>
          </span>
        </button>
        <button type="button" role="menuitem" className={menuItemClass} onClick={() => setMode('ask')}>
          <MessageCircleQuestion className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-300" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block font-medium">Ask AI about this field</span>
            <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">Questions about {label}</span>
          </span>
        </button>
      </div>
    ) : mode === 'ask' ? (
      <div id={id} ref={popoverRef} role="dialog" aria-label={`Ask AI about ${label}`} className={popoverClass} onBlur={onBlur} data-testid="field-assist-panel">
        <div className="flex shrink-0 items-center gap-2 border-b border-zinc-200 px-3 py-2 dark:border-zinc-700">
          <Sparkles className="h-4 w-4 text-brand-600 dark:text-brand-300" aria-hidden="true" />
          <p className="flex-1 font-medium">Ask AI</p>
          <button type="button" aria-label="Close" onClick={() => close()} className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
          <div className="rounded-lg border-l-2 border-brand-400 bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900/60">
            <p className="font-medium text-zinc-700 dark:text-zinc-200">{label}</p>
            <p className="text-zinc-500 dark:text-zinc-400">Current value: {api.currentValue(fieldKey)}</p>
          </div>

          {reply && (
            <div className="space-y-2" aria-live="polite">
              <p className="ml-auto w-fit max-w-[85%] rounded-lg bg-brand-50 px-3 py-1.5 text-brand-900 dark:bg-brand-500/20 dark:text-brand-100">{reply.question}</p>
              {reply.shown < 0 ? (
                <p className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  Thinking…
                </p>
              ) : (
                <div className="space-y-2 leading-relaxed text-zinc-700 dark:text-zinc-200" data-testid="field-assist-answer">
                  {reply.text
                    .slice(0, reply.shown)
                    .split('\n\n')
                    .map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                </div>
              )}
              {!typing && reply.shown >= 0 && reply.answer.suggestion && (
                <div className="rounded-lg border border-brand-200 bg-brand-50/60 p-2.5 dark:border-brand-500/30 dark:bg-brand-500/10">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Suggested value</p>
                  <p className="font-medium">{reply.answer.suggestion.display}</p>
                  <button type="button" className="btn-primary mt-2 min-h-8 w-full text-xs" onClick={fill}>
                    Use this value
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            {QUICK_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                disabled={typing}
                onClick={() => ask(q)}
                className="rounded-full border border-zinc-200 px-2.5 py-1 text-xs text-zinc-700 hover:border-brand-300 hover:bg-brand-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(question);
          }}
          className="flex shrink-0 items-center gap-2 border-t border-zinc-200 px-3 py-2 dark:border-zinc-700"
        >
          <input
            ref={inputRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            aria-label={`Ask about ${label}`}
            placeholder="Ask AI about this field…"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-zinc-400"
          />
          <button type="submit" aria-label="Send question" disabled={!question.trim() || typing} className="rounded-md bg-brand-600 p-1.5 text-white hover:bg-brand-700 disabled:opacity-40">
            <ArrowUp className="h-4 w-4" aria-hidden="true" />
          </button>
        </form>
      </div>
    ) : null;

  return (
    <div ref={rootRef} className={cn(className, 'z-10')} onKeyDown={onKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`AI help for ${label}`}
        title="AI help"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        // Keeps the field focused while the button is clicked, so the button stays visible.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => (open ? close() : setMode('menu'))}
        className={cn(
          'flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-fuchsia-500 text-white shadow-sm transition-opacity hover:from-brand-600 hover:to-fuchsia-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
          open ? 'opacity-100' : 'pointer-events-none opacity-0 group-focus-within/field:pointer-events-auto group-focus-within/field:opacity-100',
        )}
      >
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {popover && createPortal(popover, document.body)}
    </div>
  );
}

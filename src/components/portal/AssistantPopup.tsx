import type { KeyboardEvent, ReactNode, Ref } from 'react';
import { Sparkles, X } from 'lucide-react';

export const ASSISTANT_POPUP_ID = 'assistant-popup';

/** The round AI Assistant button in the bottom-right corner. While the popup is open it shows an X that closes it. */
export function AssistantLauncher({ open, onToggle, buttonRef }: { open: boolean; onToggle: () => void; buttonRef?: Ref<HTMLButtonElement> }) {
  const label = open ? 'Close AI Assistant' : 'Open AI Assistant';
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onToggle}
      aria-label={label}
      title={label}
      aria-expanded={open}
      aria-controls={open ? ASSISTANT_POPUP_ID : undefined}
      data-testid="assistant-launcher"
      className="fixed bottom-5 right-5 z-[45] flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-fuchsia-500 text-white shadow-lg shadow-brand-600/30 transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 motion-reduce:transition-none motion-reduce:hover:scale-100"
    >
      {open ? <X className="h-6 w-6" aria-hidden="true" /> : <Sparkles className="h-6 w-6" aria-hidden="true" />}
    </button>
  );
}

/** The AI Assistant in a full-screen popup over the current page. Escape closes it, unless something inside handled the key. */
export function AssistantPopup({ onClose, escapeCloses, children }: { onClose: () => void; escapeCloses: boolean; children: ReactNode }) {
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && escapeCloses && !e.defaultPrevented) {
      e.preventDefault();
      onClose();
    }
  };
  return (
    <div
      id={ASSISTANT_POPUP_ID}
      role="dialog"
      aria-modal="true"
      aria-label="AI Assistant"
      onKeyDown={onKeyDown}
      data-testid="assistant-popup"
      className="assistant-popup fixed inset-0 z-40 flex animate-fade-in bg-zinc-50 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
    >
      {children}
    </div>
  );
}

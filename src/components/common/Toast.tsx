import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '../../utils/cn';
import { createId } from '../../utils/id';
import { ToastContext, type ToastKind, type ToastOptions } from './toastContext';

interface ToastItem {
  id: string;
  message: string;
  kind: ToastKind;
  action?: ToastOptions['action'];
}

const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);

  const show = useCallback(
    (message: string, options: ToastOptions = {}) => {
      const id = createId();
      const kind = options.kind ?? 'info';
      setToasts((t) => [...t.slice(-2), { id, message, kind, action: options.action }]);
      timers.current.set(id, setTimeout(() => dismiss(id), options.durationMs ?? (kind === 'error' ? 6000 : 3500)));
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((t) => clearTimeout(t));
  }, []);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite" role="status">
        {toasts.map((t) => {
          const Icon = ICONS[t.kind];
          return (
            <div
              key={t.id}
              className="pointer-events-auto flex w-full max-w-sm animate-slide-up items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
            >
              <Icon
                aria-hidden="true"
                className={cn('h-4 w-4 shrink-0', t.kind === 'success' && 'text-emerald-600', t.kind === 'error' && 'text-red-600 dark:text-red-400', t.kind === 'info' && 'text-zinc-500')}
              />
              <p className="flex-1">{t.message}</p>
              {t.action && (
                <button
                  type="button"
                  className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                  onClick={() => {
                    t.action?.onClick();
                    dismiss(t.id);
                  }}
                >
                  {t.action.label}
                </button>
              )}
              <button type="button" aria-label="Dismiss notification" onClick={() => dismiss(t.id)} className="rounded p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

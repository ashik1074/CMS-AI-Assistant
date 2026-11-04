import { createContext, useContext } from 'react';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastOptions {
  kind?: ToastKind;
  action?: { label: string; onClick: () => void };
  durationMs?: number;
}

export interface ToastApi {
  show: (message: string, options?: ToastOptions) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

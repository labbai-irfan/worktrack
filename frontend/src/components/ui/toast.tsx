import { create } from 'zustand';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastKind = 'success' | 'error' | 'info';
interface ToastItem { id: number; kind: ToastKind; message: string }

interface ToastState {
  toasts: ToastItem[];
  push: (kind: ToastKind, message: string) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;
export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (kind, message) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4500);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (m: string) => useToastStore.getState().push('success', m),
  error: (m: string) => useToastStore.getState().push('error', m),
  info: (m: string) => useToastStore.getState().push('info', m),
};

export function ToastViewport() {
  const { toasts, dismiss } = useToastStore();
  if (toasts.length === 0) return null;
  const icons = {
    success: <CheckCircle2 className="h-4 w-4 text-success-main shrink-0" />,
    error: <AlertCircle className="h-4 w-4 text-error-main shrink-0" />,
    info: <Info className="h-4 w-4 text-info-main shrink-0" />,
  };
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)]" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={cn('card flex items-start gap-2.5 px-3.5 py-3 shadow-overlay text-sm')}>
          {icons[t.kind]}
          <span className="grow text-xs leading-relaxed">{t.message}</span>
          <button onClick={() => dismiss(t.id)} className="text-ink-faint hover:text-ink" aria-label="Dismiss">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

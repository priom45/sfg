import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { Check, AlertCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'error') => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextToastIdRef = useRef(1);
  const timeoutMapRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const clearToastTimeout = useCallback((id: number) => {
    const timeout = timeoutMapRef.current[id];
    if (!timeout) return;
    clearTimeout(timeout);
    delete timeoutMapRef.current[id];
  }, []);

  const removeToast = useCallback((id: number) => {
    clearToastTimeout(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, [clearToastTimeout]);

  const scheduleToastRemoval = useCallback((id: number) => {
    clearToastTimeout(id);
    timeoutMapRef.current[id] = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      delete timeoutMapRef.current[id];
    }, 3000);
  }, [clearToastTimeout]);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    let nextToastId: number | null = null;
    let existingToastId: number | null = null;

    setToasts((prev) => {
      const existingToast = prev.find((toast) => toast.message === message && toast.type === type);
      if (existingToast) {
        existingToastId = existingToast.id;
        return prev;
      }

      nextToastId = nextToastIdRef.current++;
      return [...prev, { id: nextToastId, message, type }];
    });

    if (existingToastId !== null) {
      scheduleToastRemoval(existingToastId);
      return;
    }

    if (nextToastId !== null) {
      scheduleToastRemoval(nextToastId);
    }
  }, [scheduleToastRemoval]);

  useEffect(() => () => {
    Object.values(timeoutMapRef.current).forEach(clearTimeout);
    timeoutMapRef.current = {};
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="pointer-events-none fixed left-1/2 top-3 z-[130] flex w-[calc(100%-1rem)] max-w-md -translate-x-1/2 flex-col gap-2 sm:top-5 sm:w-full">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: -18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.96, transition: { duration: 0.18 } }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className={`pointer-events-auto relative overflow-hidden flex items-start gap-3 rounded-[22px] border px-4 py-3.5 text-[14px] font-semibold shadow-[0_24px_64px_rgba(0,0,0,0.42)] backdrop-blur-2xl ${
                toast.type === 'success'
                  ? 'border-emerald-400/30 bg-brand-surface/96 text-white ring-1 ring-emerald-400/10'
                  : 'border-rose-400/30 bg-brand-surface/96 text-white ring-1 ring-rose-400/10'
              }`}
              role="status"
              aria-live="polite"
            >
              <div
                className={`pointer-events-none absolute inset-x-0 top-0 h-px ${
                  toast.type === 'success'
                    ? 'bg-gradient-to-r from-transparent via-emerald-300/80 to-transparent'
                    : 'bg-gradient-to-r from-transparent via-rose-300/80 to-transparent'
                }`}
              />
              <span
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
                  toast.type === 'success'
                    ? 'border-emerald-400/25 bg-emerald-500/14 text-emerald-200'
                    : 'border-rose-400/25 bg-rose-500/14 text-rose-200'
                }`}
              >
                {toast.type === 'success' ? <Check size={16} strokeWidth={2.2} /> : <AlertCircle size={16} strokeWidth={2.2} />}
              </span>
              <span className="min-w-0 flex-1 pr-1 leading-snug">{toast.message}</span>
              <button
                onClick={() => removeToast(toast.id)}
                className="shrink-0 rounded-full border border-white/8 bg-white/[0.03] p-1.5 text-white/75 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Dismiss notification"
              >
                <X size={14} strokeWidth={2.2} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}

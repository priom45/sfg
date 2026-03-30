import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
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

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="pointer-events-none fixed left-1/2 top-3 z-[70] flex w-[calc(100%-1rem)] max-w-md -translate-x-1/2 flex-col gap-2 sm:top-5 sm:w-full">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: -18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.96, transition: { duration: 0.18 } }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className={`pointer-events-auto flex items-center gap-3 rounded-2xl border px-4 py-3 text-[14px] font-semibold shadow-[0_18px_42px_rgba(0,0,0,0.28)] backdrop-blur-xl ${
                toast.type === 'success'
                  ? 'border-emerald-400/30 bg-emerald-500/92 text-white'
                  : 'border-red-400/30 bg-red-500/92 text-white'
              }`}
              role="status"
              aria-live="polite"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/14">
                {toast.type === 'success' ? <Check size={16} strokeWidth={2.2} /> : <AlertCircle size={16} strokeWidth={2.2} />}
              </span>
              <span className="min-w-0 flex-1 truncate pr-1">{toast.message}</span>
              <button
                onClick={() => removeToast(toast.id)}
                className="shrink-0 rounded-full p-1 text-white/90 transition-colors hover:bg-white/10 hover:text-white"
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

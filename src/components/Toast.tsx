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
      <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-[60] space-y-2">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95, transition: { duration: 0.15 } }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-elevated text-[14px] font-semibold border ${
                toast.type === 'success'
                  ? 'bg-emerald-600 text-white border-emerald-500/30'
                  : 'bg-red-600 text-white border-red-500/30'
              }`}
            >
              {toast.type === 'success' ? <Check size={16} strokeWidth={2.2} /> : <AlertCircle size={16} strokeWidth={2.2} />}
              <span>{toast.message}</span>
              <button onClick={() => removeToast(toast.id)} className="ml-2 hover:opacity-70 transition-opacity">
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

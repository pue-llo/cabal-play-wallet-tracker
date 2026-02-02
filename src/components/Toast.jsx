import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { Check, X, AlertTriangle, Info } from 'lucide-react';

// Toast Context
const ToastContext = createContext(null);

// Toast types and their styling
const toastTypes = {
  success: {
    icon: Check,
    bg: 'bg-accent-success/10 border-accent-success/30',
    iconBg: 'bg-accent-success/20',
    iconColor: 'text-accent-success',
    textColor: 'text-accent-success',
  },
  error: {
    icon: X,
    bg: 'bg-accent-danger/10 border-accent-danger/30',
    iconBg: 'bg-accent-danger/20',
    iconColor: 'text-accent-danger',
    textColor: 'text-accent-danger',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-accent-warning/10 border-accent-warning/30',
    iconBg: 'bg-accent-warning/20',
    iconColor: 'text-accent-warning',
    textColor: 'text-accent-warning',
  },
  info: {
    icon: Info,
    bg: 'bg-accent-primary/10 border-accent-primary/30',
    iconBg: 'bg-accent-primary/20',
    iconColor: 'text-accent-primary',
    textColor: 'text-accent-primary',
  },
};

// Individual Toast Component
function ToastItem({ toast, onDismiss }) {
  const [isExiting, setIsExiting] = useState(false);
  const type = toastTypes[toast.type] || toastTypes.info;
  const Icon = type.icon;

  useEffect(() => {
    if (toast.duration > 0) {
      const timer = setTimeout(() => {
        setIsExiting(true);
        setTimeout(() => onDismiss(toast.id), 200);
      }, toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast.id, toast.duration, onDismiss]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => onDismiss(toast.id), 200);
  };

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg
        ${type.bg}
        ${isExiting ? 'animate-toast-exit' : 'animate-toast-enter'}
      `}
    >
      <div className={`flex-shrink-0 p-1.5 rounded-lg ${type.iconBg}`}>
        <Icon className={`h-4 w-4 ${type.iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        {toast.title && (
          <p className={`text-sm font-medium ${type.textColor}`}>{toast.title}</p>
        )}
        {toast.message && (
          <p className="text-sm text-gray-300">{toast.message}</p>
        )}
      </div>
      <button
        onClick={handleDismiss}
        className="flex-shrink-0 p-1 hover:bg-dark-600 rounded transition-colors text-gray-500 hover:text-gray-300"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// Toast Container
function ToastContainer({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}

// Toast Provider
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((options) => {
    const id = Date.now().toString();
    const toast = {
      id,
      type: options.type || 'info',
      title: options.title,
      message: options.message,
      duration: options.duration ?? 3000,
    };
    setToasts((prev) => [...prev, toast]);
    return id;
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    {
      success: (title, message) => addToast({ type: 'success', title, message }),
      error: (title, message) => addToast({ type: 'error', title, message }),
      warning: (title, message) => addToast({ type: 'warning', title, message }),
      info: (title, message) => addToast({ type: 'info', title, message }),
    },
    [addToast]
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

// Hook to use toast
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

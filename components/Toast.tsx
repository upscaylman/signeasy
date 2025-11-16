
import React, { useState, useCallback, createContext, useContext, ReactNode } from 'react';
import { X, CheckCircle, XCircle, Info, AlertTriangle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  addToast: (message: string, type: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

let id = 0;

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((message: string, type: ToastType) => {
    setToasts((prevToasts) => [...prevToasts, { id: id++, message, type }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <Toaster toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastProps {
  toast: ToastMessage;
  onDismiss: (id: number) => void;
}

const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  React.useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 5000);

    return () => {
      clearTimeout(timer);
    };
  }, [toast.id, onDismiss]);

  const icons = {
    success: <CheckCircle className="h-6 w-6 text-onTertiaryContainer" />,
    error: <XCircle className="h-6 w-6 text-onErrorContainer" />,
    info: <Info className="h-6 w-6 text-onSecondaryContainer" />,
    warning: <AlertTriangle className="h-6 w-6 text-onTertiaryContainer" />,
  };
  
  const bgColors = {
      success: 'bg-tertiaryContainer text-onTertiaryContainer',
      error: 'bg-errorContainer text-onErrorContainer',
      info: 'bg-secondaryContainer text-onSecondaryContainer',
      warning: 'bg-tertiaryContainer text-onTertiaryContainer',
  }

  return (
    <div className={`
      max-w-sm w-full ${bgColors[toast.type]}
      elevation-3 rounded-xl pointer-events-auto
      ring-1 ring-black ring-opacity-5 overflow-hidden
      notification-enter
    `.trim().replace(/\s+/g, ' ')}>
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">{icons[toast.type]}</div>
          <div className="ml-3 w-0 flex-1 pt-0.5">
            <p className="text-sm font-medium">{toast.message}</p>
          </div>
          <div className="ml-4 flex-shrink-0 flex">
            <button
              onClick={() => onDismiss(toast.id)}
              className="
                inline-flex rounded-md min-h-[40px] min-w-[40px] items-center justify-center
                text-current/70 hover:text-current/100
                state-layer press-effect transition-all
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary
                hover:scale-110
              "
              aria-label="Fermer la notification"
            >
              <span className="sr-only">Fermer</span>
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ToasterProps {
    toasts: ToastMessage[];
    removeToast: (id: number) => void;
}

export const Toaster: React.FC<ToasterProps> = ({toasts, removeToast}) => {
  return (
    <div className="fixed inset-0 flex items-end px-4 py-6 pointer-events-none sm:p-6 sm:items-start z-50">
      <div className="w-full flex flex-col items-center space-y-4 sm:items-end">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={removeToast} />
        ))}
      </div>
    </div>
  );
};

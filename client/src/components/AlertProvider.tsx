import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { AlertCircle, CheckCircle2, XCircle, Info, X, LucideIcon } from 'lucide-react';

type AlertType = 'success' | 'error' | 'warning' | 'info';

interface AlertStyle {
  bg: string;
  border: string;
  text: string;
  icon: LucideIcon;
  iconColor: string;
}

interface Alert {
  id: string;
  message: string;
  type: AlertType;
  isConfirm?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface AlertContextType {
  addAlert: (message: string, type?: AlertType, duration?: number) => string;
  removeAlert: (id: string) => void;
  showSuccess: (message: string, duration?: number) => void;
  showError: (message: string, duration?: number) => void;
  showWarning: (message: string, duration?: number) => void;
  showInfo: (message: string, duration?: number) => void;
  confirm: (message: string) => Promise<boolean>;
}

interface AlertProviderProps {
  children: ReactNode;
}

interface AlertContainerProps {
  alerts: Alert[];
  onRemove: (id: string) => void;
}

interface AlertComponentProps {
  alert: Alert;
  onRemove: (id: string) => void;
}

interface ConfirmDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ALERT_STYLES: Record<AlertType, AlertStyle> = {
  success: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-800',
    icon: CheckCircle2,
    iconColor: 'text-emerald-500'
  },
  error: {
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    text: 'text-rose-800',
    icon: XCircle,
    iconColor: 'text-rose-500'
  },
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-800',
    icon: AlertCircle,
    iconColor: 'text-amber-500'
  },
  info: {
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    text: 'text-sky-800',
    icon: Info,
    iconColor: 'text-sky-500'
  }
};

const AlertContext = createContext<AlertContextType | null>(null);

// Stil tanımlamaları
const styles = `
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(30px) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
}

@keyframes slideOut {
  from {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateX(30px) scale(0.9);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.animate-slide-in {
  animation: slideIn 0.2s ease-out forwards;
}

.animate-slide-out {
  animation: slideOut 0.2s ease-in forwards;
}

.animate-fade-in {
  animation: fadeIn 0.2s ease-out forwards;
}
`;

// Stilleri head'e ekle
const styleSheet = document.createElement("style");
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);

// Confirm Dialog Component
const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ message, onConfirm, onCancel }) => {
  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/25 backdrop-blur-sm" 
        onClick={onCancel} 
      />
      
      {/* Dialog */}
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-auto p-6 border-2 border-amber-100 animate-fade-in">
          {/* Icon ve Mesaj */}
          <div className="flex gap-3 items-start">
            <div className="p-2 bg-amber-50 rounded-lg">
              <AlertCircle className="w-6 h-6 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Onay Gerekiyor</h3>
              <p className="text-gray-600">{message}</p>
            </div>
          </div>

          {/* Butonlar */}
          <div className="mt-6 flex gap-3 justify-end">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium rounded-lg
                text-gray-700 bg-gray-100 hover:bg-gray-200
                transform transition-all duration-200
                hover:shadow active:scale-95
                focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
            >
              İptal
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 text-sm font-medium rounded-lg
                text-white bg-amber-500 hover:bg-amber-600
                transform transition-all duration-200
                hover:shadow active:scale-95
                focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
            >
              Onayla
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Normal Alert Component
const Alert: React.FC<AlertComponentProps> = ({ alert, onRemove }) => {
  const style = ALERT_STYLES[alert.type];
  const Icon = style.icon;

  if (alert.isConfirm) return null;

  return (
    <div 
      className={`
        flex items-start p-4 rounded-xl border-2 
        ${style.bg} ${style.border} ${style.text} 
        shadow-lg shadow-gray-200/50 backdrop-blur-sm
        transform transition-all duration-200 ease-out
        hover:scale-[1.02] hover:shadow-xl
        animate-slide-in
        relative
      `}
      role="alert"
    >
      <div className={`
        absolute inset-0 rounded-xl opacity-25 
        ${style.bg} blur-sm -z-10
      `} />

      <Icon className={`w-5 h-5 ${style.iconColor} mt-0.5 shrink-0`} />
      
      <div className="ml-3 flex-1">
        <p className="text-sm font-medium leading-relaxed">{alert.message}</p>
      </div>
      
      <button
        onClick={() => onRemove(alert.id)}
        className={`
          ml-4 p-1.5 rounded-full ${style.text}
          hover:bg-white/50
          transform transition-all duration-200
          hover:scale-110
          focus:outline-none focus:ring-2 focus:ring-offset-1
          active:scale-95
        `}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

// Alert Container Component
const AlertContainer: React.FC<AlertContainerProps> = ({ alerts, onRemove }) => {
  const normalAlerts = alerts.filter(alert => !alert.isConfirm);
  const confirmAlert = alerts.find(alert => alert.isConfirm);

  return (
    <>
      {/* Normal Alertler */}
      <div className="fixed top-4 right-4 z-[9999] space-y-3 min-w-[320px] max-w-[420px] p-4">
        {normalAlerts.map(alert => (
          <Alert key={alert.id} alert={alert} onRemove={onRemove} />
        ))}
      </div>

      {/* Confirm Dialog */}
      {confirmAlert && confirmAlert.isConfirm && (
        <ConfirmDialog
          message={confirmAlert.message}
          onConfirm={confirmAlert.onConfirm!}
          onCancel={confirmAlert.onCancel!}
        />
      )}
    </>
  );
};

// Alert Provider Component
export const AlertProvider: React.FC<AlertProviderProps> = ({ children }) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  const addAlert = useCallback((message: string, type: AlertType = 'info', duration = 5000) => {
    const id = Math.random().toString(36).substring(7);
    
    setAlerts(prev => [...prev, { id, message, type }]);

    if (duration) {
      setTimeout(() => {
        removeAlert(id);
      }, duration);
    }
    
    return id;
  }, []);

  const removeAlert = useCallback((id: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== id));
  }, []);

  const showSuccess = useCallback((message: string, duration?: number) => 
    addAlert(message, 'success', duration), [addAlert]);
    
  const showError = useCallback((message: string, duration?: number) => 
    addAlert(message, 'error', duration), [addAlert]);
    
  const showWarning = useCallback((message: string, duration?: number) => 
    addAlert(message, 'warning', duration), [addAlert]);
    
  const showInfo = useCallback((message: string, duration?: number) => 
    addAlert(message, 'info', duration), [addAlert]);

  const confirm = useCallback((message: string) => {
    return new Promise<boolean>((resolve) => {
      const id = addAlert(message, 'warning', 0);
      
      const handleConfirm = () => {
        removeAlert(id);
        resolve(true);
      };
      
      const handleCancel = () => {
        removeAlert(id);
        resolve(false);
      };
      
      setAlerts(prev => prev.map(alert => 
        alert.id === id 
          ? { ...alert, onConfirm: handleConfirm, onCancel: handleCancel, isConfirm: true }
          : alert
      ));
    });
  }, [addAlert, removeAlert]);

  return (
    <AlertContext.Provider value={{ 
      addAlert, 
      removeAlert, 
      showSuccess, 
      showError, 
      showWarning, 
      showInfo,
      confirm 
    }}>
      {children}
      <AlertContainer alerts={alerts} onRemove={removeAlert} />
    </AlertContext.Provider>
  );
};

export const useAlert = (): AlertContextType => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
};

export default AlertProvider;
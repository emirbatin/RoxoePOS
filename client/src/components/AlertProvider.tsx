import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Info,
  X,
  LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion } from 'framer-motion';

// Alert Types
type AlertType = "success" | "error" | "warning" | "info";

// Alert Style Interface
interface AlertStyle {
  bg: string;
  border: string;
  text: string;
  icon: LucideIcon;
  iconColor: string;
}

// Alert Interface
interface Alert {
  id: string;
  message: string;
  type: AlertType;
  isConfirm?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
}

// Alert Context Interface
interface AlertContextType {
  addAlert: (message: string, type?: AlertType, duration?: number) => string;
  removeAlert: (id: string) => void;
  showSuccess: (message: string, duration?: number) => void;
  showError: (message: string, duration?: number) => void;
  showWarning: (message: string, duration?: number) => void;
  showInfo: (message: string, duration?: number) => void;
  confirm: (message: string) => Promise<boolean>;
}

// Props Interfaces
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

// Premium Minimal Alert Styles
const ALERT_STYLES: Record<AlertType, AlertStyle> = {
  success: {
    bg: "bg-white",
    border: "border-emerald-100",
    text: "text-gray-800",
    icon: CheckCircle2,
    iconColor: "text-emerald-500",
  },
  error: {
    bg: "bg-white",
    border: "border-rose-100",
    text: "text-gray-800",
    icon: XCircle,
    iconColor: "text-rose-500",
  },
  warning: {
    bg: "bg-white",
    border: "border-amber-100",
    text: "text-gray-800",
    icon: AlertCircle,
    iconColor: "text-amber-500",
  },
  info: {
    bg: "bg-white",
    border: "border-sky-100",
    text: "text-gray-800",
    icon: Info,
    iconColor: "text-sky-500",
  },
};

// Create Alert Context
const AlertContext = createContext<AlertContextType | null>(null);

// Confirmation Dialog Component
const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  message,
  onConfirm,
  onCancel,
}) => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/10 backdrop-blur-sm z-[9999]">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-lg shadow-xl max-w-md w-full mx-auto p-6 border border-gray-100"
      >
        <div className="flex gap-4 items-start">
          <div className="p-1.5 bg-amber-50 rounded-full">
            <AlertCircle className="w-5 h-5 text-amber-500" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-medium text-gray-900">
              Onay Gerekiyor
            </h3>
            <p className="text-sm text-gray-600 mt-1">{message}</p>
          </div>
        </div>
        <div className="mt-6 flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs font-medium rounded-md text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-colors"
          >
            İptal
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-xs font-medium rounded-md text-white bg-gray-900 hover:bg-gray-800 transition-colors"
          >
            Onayla
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// Alert Component
const Alert: React.FC<AlertComponentProps> = ({ alert, onRemove }) => {
  const style = ALERT_STYLES[alert.type];
  const Icon = style.icon;

  if (alert.isConfirm) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className={`flex items-start p-3.5 rounded-md border ${style.bg} ${style.border} ${style.text} shadow-sm relative`}
      role="alert"
    >
      <Icon className={`w-4 h-4 ${style.iconColor} mt-0.5 shrink-0`} />
      <div className="ml-3 flex-1">
        <p className="text-xs font-medium leading-relaxed">{alert.message}</p>
      </div>
      <button
        onClick={() => onRemove(alert.id)}
        className="ml-2 p-1 rounded-full hover:bg-gray-100 transition-colors"
      >
        <X className="w-3 h-3 text-gray-400" />
      </button>
    </motion.div>
  );
};

// Alert Container Component
const AlertContainer: React.FC<AlertContainerProps> = ({
  alerts,
  onRemove,
}) => {
  // Normal alerts filtering
  const normalAlerts = alerts.filter((alert) => !alert.isConfirm);
  // Find confirmation alert
  const confirmAlert = alerts.find((alert) => alert.isConfirm);

  return (
    <>
      {/* Normal alerts container */}
      <div className="fixed top-4 right-4 space-y-2 min-w-[280px] max-w-[320px] p-2 z-[9998] pointer-events-none">
        <AnimatePresence>
          {normalAlerts.map((alert) => (
            <div key={alert.id} className="pointer-events-auto">
              <Alert alert={alert} onRemove={onRemove} />
            </div>
          ))}
        </AnimatePresence>
      </div>

      {/* Confirmation dialog */}
      <AnimatePresence>
        {confirmAlert && confirmAlert.isConfirm && (
          <ConfirmDialog
            message={confirmAlert.message}
            onConfirm={() => {
              confirmAlert.onConfirm?.();
              onRemove(confirmAlert.id);
            }}
            onCancel={() => {
              confirmAlert.onCancel?.();
              onRemove(confirmAlert.id);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
};

// Alert Provider Component
export const AlertProvider: React.FC<AlertProviderProps> = ({ children }) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  const addAlert = useCallback(
    (message: string, type: AlertType = "info", duration = 5000) => {
      const id = Math.random().toString(36).substring(7);
      setAlerts((prev) => [...prev, { id, message, type }]);
      if (duration) setTimeout(() => removeAlert(id), duration);
      return id;
    },
    []
  );

  const removeAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((alert) => alert.id !== id));
  }, []);

  const showSuccess = useCallback(
    (message: string, duration?: number) =>
      addAlert(message, "success", duration),
    [addAlert]
  );
  
  const showError = useCallback(
    (message: string, duration?: number) =>
      addAlert(message, "error", duration),
    [addAlert]
  );
  
  const showWarning = useCallback(
    (message: string, duration?: number) =>
      addAlert(message, "warning", duration),
    [addAlert]
  );
  
  const showInfo = useCallback(
    (message: string, duration?: number) => 
      addAlert(message, "info", duration),
    [addAlert]
  );

  const confirm = useCallback(
    (message: string) => {
      return new Promise<boolean>((resolve) => {
        const id = addAlert(message, "warning", 0);
        const handleConfirm = () => {
          removeAlert(id);
          resolve(true);
        };
        const handleCancel = () => {
          removeAlert(id);
          resolve(false);
        };
        setAlerts((prev) =>
          prev.map((alert) =>
            alert.id === id
              ? {
                  ...alert,
                  onConfirm: handleConfirm,
                  onCancel: handleCancel,
                  isConfirm: true,
                }
              : alert
          )
        );
      });
    },
    [addAlert, removeAlert]
  );

  return (
    <AlertContext.Provider
      value={{
        addAlert,
        removeAlert,
        showSuccess,
        showError,
        showWarning,
        showInfo,
        confirm,
      }}
    >
      {children}
      <AlertContainer alerts={alerts} onRemove={removeAlert} />
    </AlertContext.Provider>
  );
};

// Custom Hook
export const useAlert = (): AlertContextType => {
  const context = useContext(AlertContext);
  if (!context)
    throw new Error("useAlert must be used within an AlertProvider");
  return context;
};

export default AlertProvider;
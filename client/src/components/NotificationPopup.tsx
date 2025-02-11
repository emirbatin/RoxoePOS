import React from 'react';
import { Package, X } from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

interface NotificationPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

const NotificationPopup: React.FC<NotificationPopupProps> = ({ isOpen, onClose }) => {
  const { notifications, markAsRead, markAllAsRead } = useNotifications();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div 
        className="absolute right-0 top-[4rem] mr-4 w-80 bg-white rounded-lg shadow-xl border overflow-hidden z-50"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-900">Stok Bildirimleri</h3>
          </div>
          <div>
            <button 
              className="text-sm text-gray-500 hover:text-primary-600"
              onClick={onClose}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Bildirimler Listesi */}
        <div className="divide-y max-h-[32rem] overflow-y-auto">
          {notifications.map(notification => (
            <div 
              key={notification.id}
              className={`p-4 hover:bg-gray-50 cursor-pointer ${notification.isRead ? 'bg-white' : 'bg-blue-50/50'}`}
              onClick={() => markAsRead(notification.id)}
            >
              <div className="flex gap-3">
                <div className="shrink-0 w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <Package className="text-red-600 w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {notification.productName}
                  </p>
                  <p className="text-sm text-red-600 font-medium">
                    Stok: {notification.currentStock} adet kaldı!
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatDistanceToNow(notification.createdAt, { 
                      addSuffix: true,
                      locale: tr 
                    })}
                  </p>
                </div>
                <div className={`shrink-0 p-1 rounded ${notification.isRead ? 'bg-gray-300' : 'bg-primary-500'} w-2 h-2`}></div>
              </div>
            </div>
          ))}

          {notifications.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              Bildirim bulunmuyor
            </div>
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="p-4 border-t">
            <button
              onClick={markAllAsRead}
              className="w-full py-2 px-3 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm text-gray-600"
            >
              Tümünü Okundu İşaretle
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationPopup;

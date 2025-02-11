// contexts/NotificationContext.tsx
import React, { createContext, useContext, useState, useEffect } from "react";
import { Product } from "../types/product";
import { productService } from "../services/productDB";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";

interface StockNotification {
  id: number;
  productId: number;
  productName: string;
  currentStock: number;
  isRead: boolean;
  createdAt: Date;
}

interface NotificationContextType {
  notifications: StockNotification[];
  unreadCount: number;
  markAsRead: (id: number) => void;
  markAllAsRead: () => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [notifications, setNotifications] = useState<StockNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [previousStock, setPreviousStock] = useState<Record<number, number>>(
    {}
  );

  useEffect(() => {
    const handleStockChange = (product: Product) => {
      if (product.stock <= 4) {
        // Aynı ürün için aynı stok seviyesinde bildirim kontrolü
        const existingNotification = notifications.find(
          (notif) =>
            notif.productId === product.id &&
            notif.currentStock === product.stock
        );

        if (!existingNotification) {
          addNotification(product); // Stok seviyesi farklıysa yeni bildirim oluştur
        }
      } else {
        // Stok 4'ün üzerine çıkarsa ürünle ilgili tüm bildirimleri sil
        removeNotificationsForProduct(product.id);
      }
    };

    // Stok değişikliklerini dinle
    productService.onStockChange(handleStockChange);

    // Temizlik yaparak çift dinlemeyi engelle
    return () => {
      productService.offStockChange(handleStockChange);
    };
  }, [notifications]); // Bildirimler değiştiğinde tekrar çalışır

  const addNotification = (product: Product) => {
    const newNotification: StockNotification = {
      id: Date.now() + Math.random(), // Her bildirim için benzersiz ID
      productId: product.id,
      productName: product.name,
      currentStock: product.stock, // Mevcut stok seviyesini kaydet
      isRead: false,
      createdAt: new Date(),
    };

    setNotifications((prev) => [newNotification, ...prev]);
    setUnreadCount((prev) => prev + 1);
  };

  const removeNotificationsForProduct = (productId: number) => {
    setNotifications((prev) =>
      prev.filter((notif) => notif.productId !== productId)
    );
  };

  const markAsRead = (id: number) => {
    setNotifications((prev) =>
      prev.map((notif) =>
        notif.id === id ? { ...notif, isRead: true } : notif
      )
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const markAllAsRead = () => {
    setNotifications((prev) =>
      prev.map((notif) => ({ ...notif, isRead: true }))
    );
    setUnreadCount(0);
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotifications must be used within a NotificationProvider"
    );
  }
  return context;
};

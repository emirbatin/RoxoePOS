// contexts/NotificationContext.tsx

import React, { createContext, useContext, useState, useEffect } from "react";
import { Product } from "../types/product";
import { productService } from "../services/productDB";

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

  // unreadCount değerini doğrudan notifications üzerinden türet
  const unreadCount = notifications.reduce(
    (count, notif) => (notif.isRead ? count : count + 1),
    0
  );

  useEffect(() => {
    const handleStockChange = (product: Product) => {
      // setNotifications içine callback vererek her zaman güncel 'prev' değerine erişiyoruz
      setNotifications((prev) => {
        // Stok 4'ün altına (veya eşit) inmişse henüz ekli olmayan bildirim ekle
        if (product.stock <= 4) {
          const existingNotification = prev.find(
            (notif) =>
              notif.productId === product.id &&
              notif.currentStock === product.stock
          );
          if (!existingNotification) {
            const newNotification: StockNotification = {
              id: Date.now() + Math.random(),
              productId: product.id,
              productName: product.name,
              currentStock: product.stock,
              isRead: false,
              createdAt: new Date(),
            };
            return [newNotification, ...prev];
          }
          return prev;
        } else {
          // Stok 4'ün üzerine çıkarsa o ürüne ait tüm bildirimleri sil
          return prev.filter((notif) => notif.productId !== product.id);
        }
      });
    };

    // Uygulama ilk yüklendiğinde tüm ürünlerin stoklarını kontrol et
    const checkAllProductsForLowStock = async () => {
      const products = await productService.getAllProducts();
      setNotifications((prev) => {
        let updated = [...prev];

        products.forEach((product) => {
          if (product.stock <= 4) {
            const existingNotification = updated.find(
              (notif) =>
                notif.productId === product.id &&
                notif.currentStock === product.stock
            );
            if (!existingNotification) {
              updated = [
                {
                  id: Date.now() + Math.random(),
                  productId: product.id,
                  productName: product.name,
                  currentStock: product.stock,
                  isRead: false,
                  createdAt: new Date(),
                },
                ...updated,
              ];
            }
          } else {
            // Stok 4'ün üzerindeyse ilgili bildirimi sil
            updated = updated.filter(
              (notif) => notif.productId !== product.id
            );
          }
        });

        return updated;
      });
    };

    checkAllProductsForLowStock();
    productService.onStockChange(handleStockChange);

    return () => {
      productService.offStockChange(handleStockChange);
    };
  }, []);

  // Tek bir bildirimi "okundu" olarak işaretle
  const markAsRead = (id: number) => {
    setNotifications((prev) =>
      prev.map((notif) =>
        notif.id === id ? { ...notif, isRead: true } : notif
      )
    );
  };

  // Tüm bildirimleri "okundu" yap
  const markAllAsRead = () => {
    setNotifications((prev) =>
      prev.map((notif) => ({ ...notif, isRead: true }))
    );
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
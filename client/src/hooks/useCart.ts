// hooks/useCart.ts

import { useState } from "react";
import { CartTab, CartItem } from "../types/pos";
import { Product } from "../types/product";
import { calculateCartItemTotals } from "../utils/vatUtils";

/**
 * Birden fazla sepet sekmesi yönetmek, ürün eklemek, miktar değiştirmek
 * gibi tüm sepet (cart) mantığını tek yerde toplar.
 */
export function useCart() {
  // Birden fazla sepet sekmesi
  const [cartTabs, setCartTabs] = useState<CartTab[]>([
    { id: "1", cart: [], title: "Sepet 1" },
  ]);

  const [activeTabId, setActiveTabId] = useState("1");

  // Aktif seketi kolay erişebilmek için:
  const activeTab = cartTabs.find((tab) => tab.id === activeTabId);

  // Yeni sepet sekmesi ekle
  function addNewTab() {
    const newId = (
      Math.max(...cartTabs.map((tab) => parseInt(tab.id))) + 1
    ).toString();

    setCartTabs((prev) => [
      ...prev,
      { id: newId, cart: [], title: `Sepet ${newId}` },
    ]);
    setActiveTabId(newId);
  }

  // Sepet sekmesini kaldır
  function removeTab(tabId: string) {
    if (cartTabs.length === 1) return; // Tek sepet varsa silme
    setCartTabs((prev) => prev.filter((tab) => tab.id !== tabId));
    // Eğer aktif sekme silinirse, ilk sekmeye geç
    if (activeTabId === tabId && cartTabs.length > 1) {
      setActiveTabId(cartTabs[0].id);
    }
  }

  // Sepete ürün ekle
  function addToCart(product: Product) {
    if (!activeTab) return;
    setCartTabs((prev) =>
      prev.map((tab) => {
        if (tab.id !== activeTabId) return tab;

        const existingItem = tab.cart.find((item) => item.id === product.id);
        if (existingItem) {
          // stok kontrolü örneği
          if (existingItem.quantity >= product.stock) {
            // stok yok, eklenmesin
            return tab;
          }
          const updatedCart = tab.cart.map((item) =>
            item.id === product.id
              ? {
                  ...item,
                  quantity: item.quantity + 1,
                  totalWithVat: (item.quantity + 1) * product.priceWithVat,
                  total: (item.quantity + 1) * product.salePrice,
                }
              : item
          );
          return { ...tab, cart: updatedCart };
        } else {
          // Yeni ürün ekle
          const newItem: CartItem = {
            ...product,
            quantity: 1,
            totalWithVat: product.priceWithVat,
            total: product.salePrice,
          };
          return { ...tab, cart: [...tab.cart, newItem] };
        }
      })
    );
  }

  function updateQuantity(productId: number, change: number): boolean {
    if (!activeTab) return false;
  
    const tab = cartTabs.find((t) => t.id === activeTabId);
    if (!tab) return false;
  
    const item = tab.cart.find((i) => i.id === productId);
    if (!item) return false;
  
    const newQuantity = item.quantity + change;
  
    // Check if new quantity exceeds stock
    if (newQuantity > item.stock) {
      return false;  // Indicate failure due to stock limit
    }
  
    // Prevent quantity from going below 1
    if (newQuantity <= 0) {
      return false;  // Or you can handle item removal here if needed
    }
  
    // If stock is sufficient, update the cart
    setCartTabs((prev) =>
      prev.map((tab) => {
        if (tab.id !== activeTabId) return tab;
        const updatedCart = tab.cart.map((i) =>
          i.id === productId
            ? calculateCartItemTotals({ ...i, quantity: newQuantity })
            : i
        );
        return { ...tab, cart: updatedCart };
      })
    );
  
    return true;  // Update was successful
  }

  // Sepetten ürün kaldır
  function removeFromCart(productId: number) {
    if (!activeTab) return;
    setCartTabs((prev) =>
      prev.map((tab) => {
        if (tab.id !== activeTabId) return tab;
        return {
          ...tab,
          cart: tab.cart.filter((item) => item.id !== productId),
        };
      })
    );
  }

  // Sepeti tamamen temizle
  async function clearCart(): Promise<void> {
    if (!activeTab) return;
    setCartTabs((prev) =>
      prev.map((tab) => (tab.id === activeTabId ? { ...tab, cart: [] } : tab))
    );
  }

  return {
    cartTabs,
    activeTabId,
    setActiveTabId,
    activeTab,
    addNewTab,
    removeTab,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
  };
}
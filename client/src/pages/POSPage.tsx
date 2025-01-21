import React, { useState, useRef } from "react";
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  X,
  CreditCard,
  Tag,
  AlertTriangle,
} from "lucide-react";

import { useHotkeys, HotkeysHelper } from "../hooks/useHotkeys";

import { Product, CartItem, Category, PaymentMethod } from "../types/pos";
import { ReceiptInfo } from "../types/receipt";

import ReceiptModal from "../components/ReceiptModal";
import PaymentModal from "../components/PaymentModal";
import PrinterDebug from "../components/PrinterDebug";

import { receiptService } from "../services/receiptService";
import { salesService } from "../services/salesService";

import { 
  calculateCartTotals, 
  calculateCartItemTotals,
  formatCurrency, 
  formatVatRate 
} from "../utils/vatUtils";

// Örnek kategori ve ürün verileri
const categories: Category[] = [
  { id: 1, name: "Tümü", icon: "🏪" },
  { id: 2, name: "İçecekler", icon: "🥤" },
  { id: 3, name: "Atıştırmalık", icon: "🍪" },
  { id: 4, name: "Süt Ürünleri", icon: "🥛" },
  { id: 5, name: "Temel Gıda", icon: "🥖" },
  { id: 6, name: "Şarküteri", icon: "🧀" },
];

export const sampleProducts: Product[] = [
  {
    id: 1,
    name: "Cola 1L",
    price: 13.55,        // KDV'siz fiyat
    vatRate: 18,         // %18 KDV
    priceWithVat: 15.99, // KDV'li fiyat
    category: "İçecekler",
    stock: 24,
    barcode: "8690000000001"
  },
  {
    id: 2,
    name: "Ekmek",
    price: 7.43,        // KDV'siz fiyat
    vatRate: 1,         // %1 KDV
    priceWithVat: 7.50, // KDV'li fiyat
    category: "Temel Gıda",
    stock: 50,
    barcode: "8690000000002"
  },
  {
    id: 3,
    name: "Süt 1L",
    price: 23.06,        // KDV'siz fiyat
    vatRate: 8,          // %8 KDV
    priceWithVat: 24.90, // KDV'li fiyat
    category: "Süt Ürünleri",
    stock: 15,
    barcode: "8690000000003"
  },
  {
    id: 4,
    name: "Çikolata",
    price: 10.59,        // KDV'siz fiyat
    vatRate: 18,         // %18 KDV
    priceWithVat: 12.50, // KDV'li fiyat
    category: "Atıştırmalık",
    stock: 30,
    barcode: "8690000000004"
  },
  {
    id: 5,
    name: "Peynir 500g",
    price: 51.76,        // KDV'siz fiyat
    vatRate: 8,          // %8 KDV
    priceWithVat: 55.90, // KDV'li fiyat
    category: "Şarküteri",
    stock: 8,
    barcode: "8690000000005"
  },
  {
    id: 6,
    name: "Maden Suyu",
    price: 5.08,        // KDV'siz fiyat
    vatRate: 18,        // %18 KDV
    priceWithVat: 5.99, // KDV'li fiyat
    category: "İçecekler",
    stock: 3,
    barcode: "8690000000006"
  },
  {
    id: 7,
    name: "Cips",
    price: 15.68,        // KDV'siz fiyat
    vatRate: 18,         // %18 KDV
    priceWithVat: 18.50, // KDV'li fiyat
    category: "Atıştırmalık",
    stock: 45,
    barcode: "8690000000007"
  },
  {
    id: 8,
    name: "Yoğurt 1kg",
    price: 30.46,        // KDV'siz fiyat
    vatRate: 8,          // %8 KDV
    priceWithVat: 32.90, // KDV'li fiyat
    category: "Süt Ürünleri",
    stock: 12,
    barcode: "8690000000008"
  }
];

const POSPage: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Tümü");
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [showHotkeysHelper, setShowHotkeysHelper] = useState<boolean>(true);
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);
  const [currentReceipt, setCurrentReceipt] = useState<ReceiptInfo | null>(
    null
  );
  const [printerLogs, setPrinterLogs] = useState<string[]>([]);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sepeti temizle
  const clearCart = (): void => {
    if (cart.length > 0) {
      const confirmed = window.confirm(
        "Sepeti temizlemek istediğinize emin misiniz?"
      );
      if (confirmed) {
        setCart([]);
      }
    }
  };

  // Yeni satış başlat
  const startNewSale = (): void => {
    if (cart.length > 0) {
      const confirmed = window.confirm(
        "Mevcut satışı iptal edip yeni satış başlatmak istiyor musunuz?"
      );
      if (confirmed) {
        setCart([]);
        setSearchQuery("");
        searchInputRef.current?.focus();
      }
    } else {
      searchInputRef.current?.focus();
    }
  };

  // Barkod arama işlemi
  const handleBarcodeSearch = (): void => {
    if (searchQuery) {
      const product = sampleProducts.find((p) => p.barcode === searchQuery);
      if (product) {
        addToCart(product);
        setSearchQuery("");
      }
    }
  };

  // Fiş yazdırma işlemi
  const handlePrintReceipt = async (): Promise<void> => {
    if (!currentReceipt) return;

    try {
      setPrinterLogs((prev) => [...prev, "Yazdırma işlemi başlatılıyor..."]);
      const result = await receiptService.printReceipt(currentReceipt);

      if (result) {
        setPrinterLogs((prev) => [...prev, "✅ İşlem başarılı"]);
      } else {
        setPrinterLogs((prev) => [...prev, "❌ Yazdırma hatası!"]);
        alert("Fiş yazdırılırken bir hata oluştu!");
      }
    } catch (error: unknown) {
      let errorMessage = "Bilinmeyen bir hata oluştu";

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      } else if (error && typeof error === "object" && "message" in error) {
        errorMessage = String(error.message);
      }

      setPrinterLogs((prev) => [...prev, `❌ Hata: ${errorMessage}`]);
      console.error("Yazdırma hatası:", error);
      alert("Fiş yazdırılırken bir hata oluştu!");
    }
  };

  // Fiş modalını kapat
  const handleReceiptClose = (): void => {
    setShowReceiptModal(false);
    setCart([]); // Sepeti temizle
  };

  // Kısayol tuşlarını tanımla
  useHotkeys([
    // Yeni Satış (Ctrl/Cmd + N)
    {
      key: "n",
      ctrlKey: true,
      callback: (e?: KeyboardEvent) => {
        e?.preventDefault();
        startNewSale();
      },
    },
    // Ödeme (Ctrl/Cmd + P)
    {
      key: "p",
      ctrlKey: true,
      callback: (e?: KeyboardEvent) => {
        e?.preventDefault();
        if (cart.length > 0) setShowPaymentModal(true);
      },
    },
    // İptal/Kapat (ESC)
    {
      key: "Escape",
      callback: () => {
        if (showPaymentModal) {
          setShowPaymentModal(false);
        } else if (searchQuery) {
          setSearchQuery("");
        } else {
          clearCart();
        }
      },
    },
    // Barkod Arama (Enter)
    {
      key: "Enter",
      callback: handleBarcodeSearch,
    },
    // Ürün Arama (Ctrl/Cmd + K)
    {
      key: "k",
      ctrlKey: true,
      callback: (e?: KeyboardEvent) => {
        e?.preventDefault();
        searchInputRef.current?.focus();
      },
    },
    // Kısayol Yardımı (Ctrl/Cmd + /)
    {
      key: "/",
      ctrlKey: true,
      callback: (e?: KeyboardEvent) => {
        e?.preventDefault();
        setShowHotkeysHelper((prev) => !prev);
      },
    },
    // Debug modu (Ctrl/Cmd + D)
    {
      key: "d",
      ctrlKey: true,
      callback: (e?: KeyboardEvent) => {
        e?.preventDefault();
        setShowHotkeysHelper((prev) => !prev);
        setPrinterLogs([]);
      },
    },
  ]);

  const filteredProducts = sampleProducts.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.barcode.includes(searchQuery);
    const matchesCategory =
      selectedCategory === "Tümü" || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const addToCart = (product: Product): void => {
    if (product.stock === 0) {
      return;
    }
  
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.id === product.id);
      if (existingItem) {
        if (existingItem.quantity >= product.stock) {
          return prevCart;
        }
        const updatedItem = {
          ...existingItem,
          quantity: existingItem.quantity + 1
        };
        // KDV dahil hesaplamaları yap
        const itemWithTotals = calculateCartItemTotals(updatedItem);
        
        return prevCart.map((item) =>
          item.id === product.id ? itemWithTotals : item
        );
      }
      // Yeni ürün için KDV dahil hesaplamaları yap
      const newItem = calculateCartItemTotals({ ...product, quantity: 1 });
      return [...prevCart, newItem];
    });
  };

  const removeFromCart = (productId: number): void => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== productId));
  };

  const updateQuantity = (productId: number, change: number): void => {
    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.id === productId) {
          const product = sampleProducts.find((p) => p.id === productId);
          if (!product) return item;
          
          const newQuantity = item.quantity + change;
          if (newQuantity > product.stock) return item;
          if (newQuantity <= 0) return item;
  
          const updatedItem = {
            ...item,
            quantity: newQuantity
          };
          // KDV dahil hesaplamaları yap
          return calculateCartItemTotals(updatedItem);
        }
        return item;
      })
    );
  };

  const handlePaymentComplete = (paymentMethod: PaymentMethod, cashReceived?: number): void => {
    // Yeni satışı kaydet
    const sale = salesService.addSale({
      items: cart,
      total: totalAmount,
      paymentMethod,
      cashReceived,
      changeAmount: cashReceived ? cashReceived - totalAmount : undefined,
      date: new Date()
    });
  
    // Fiş için mevcut satış verisini kullan
    const receiptData: ReceiptInfo = {
      receiptNo: sale.receiptNo,
      date: sale.date,
      items: sale.items,
      subtotal: sale.total,
      total: sale.total,
      paymentMethod: sale.paymentMethod,
      cashReceived: sale.cashReceived,
      changeAmount: sale.changeAmount
    };
  
    setCurrentReceipt(receiptData);
    setShowReceiptModal(true);
    setShowPaymentModal(false);
  };

  const totalAmount = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-6">
      {/* Sol Panel - Ürün Arama ve Hızlı Erişim */}
      <div className="flex-1 flex flex-col bg-white rounded-lg shadow-sm overflow-hidden">
        {/* Arama Çubuğu */}
        <div className="p-4 border-b">
          <div className="relative">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Ürün ara veya barkod okut... (Ctrl+K)"
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleBarcodeSearch();
                }
              }}
            />
            <Search
              className="absolute left-3 top-2.5 text-gray-400"
              size={20}
            />
          </div>
        </div>

        {/* Kategori Seçimi */}
        <div className="p-4 border-b overflow-x-auto">
          <div className="flex gap-2">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.name)}
                className={`px-4 py-2 rounded-lg whitespace-nowrap ${
                  selectedCategory === category.name
                    ? "bg-primary-50 text-primary-600"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <span className="mr-2">{category.icon}</span>
                {category.name}
              </button>
            ))}
          </div>
        </div>

        {/* Ürün Grid */}
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                className={`p-4 border rounded-lg hover:shadow-md transition-shadow text-left relative ${
                  product.stock === 0 ? "opacity-50" : ""
                }`}
              >
                <div className="font-medium text-gray-900">{product.name}</div>
                <div className="text-sm text-gray-500 flex items-center gap-1">
                  <Tag size={14} />
                  {product.category}
                </div>
                <div className="mt-2 font-semibold text-primary-600">
                  ₺{product.price.toFixed(2)}
                </div>
                {/* Stok Durumu */}
                <div
                  className={`text-sm mt-1 ${
                    product.stock < 5 ? "text-red-500" : "text-gray-500"
                  }`}
                >
                  Stok: {product.stock}
                  {product.stock < 5 && (
                    <AlertTriangle size={14} className="inline ml-1" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sağ Panel - Sepet */}
      <div className="w-96 bg-white rounded-lg shadow-sm flex flex-col">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <ShoppingCart size={20} />
            Sepet ({cart.reduce((sum, item) => sum + item.quantity, 0)} Ürün)
          </h2>
        </div>

        {/* Sepet Öğeleri */}
        <div className="flex-1 p-4 overflow-y-auto">
          {cart.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 py-3 border-b last:border-0"
            >
              <div className="flex-1">
                <div className="font-medium">{item.name}</div>
                <div className="text-sm text-gray-500">
                  ₺{item.price.toFixed(2)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateQuantity(item.id, -1)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <Minus size={16} />
                </button>
                <span className="w-8 text-center">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.id, 1)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <Plus size={16} />
                </button>
                <button
                  onClick={() => removeFromCart(item.id)}
                  className="p-1 hover:bg-gray-100 rounded text-red-500"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Toplam ve Ödeme */}
        <div className="border-t p-4">
          <div className="flex justify-between items-center mb-4">
            <span className="font-semibold text-gray-900">Toplam</span>
            <span className="text-2xl font-bold text-primary-600">
              ₺{totalAmount.toFixed(2)}
            </span>
          </div>
          <button
            onClick={() => setShowPaymentModal(true)}
            disabled={cart.length === 0}
            className="w-full py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <CreditCard size={20} />
            Ödeme Yap
          </button>
        </div>
      </div>

      {/* Ödeme Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        total={totalAmount}
        onComplete={handlePaymentComplete}
      />

      {/* Fiş Modal */}
      {currentReceipt && (
        <ReceiptModal
          isOpen={showReceiptModal}
          onClose={handleReceiptClose}
          receiptData={currentReceipt}
          onPrint={handlePrintReceipt}
        />
      )}

      {/* Klavye Kısayolları Yardımcısı */}
      {showHotkeysHelper && <HotkeysHelper />}

      {/* Debug Panel */}
      {printerLogs.length > 0 && (
        <PrinterDebug 
        isVisible={isVisible} 
        logs={printerLogs} 
        onClose={() => setIsVisible(false)} 
      />
      )}
    </div>
  );
};

export default POSPage;

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
import { CartItem, PaymentMethod, Product } from "../types/pos";
import { ReceiptInfo } from "../types/receipt";
import { categories, sampleProducts } from "../data/sampleProducts";
import {
  calculateCartTotals,
  calculateCartItemTotals,
  formatCurrency,
  formatVatRate,
} from "../utils/vatUtils";
import PaymentModal from "../components/PaymentModal";
import ReceiptModal from "../components/ReceiptModal";
import { salesService } from "../services/salesService";

const POSPage: React.FC = () => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Tümü");
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [showHotkeysHelper, setShowHotkeysHelper] = useState<boolean>(true);
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);
  const [currentReceipt, setCurrentReceipt] = useState<ReceiptInfo | null>(
    null
  );

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sepet hesaplamaları
  const cartTotals = calculateCartTotals(cart);

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

  // Ürün ekleme
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
          quantity: existingItem.quantity + 1,
        };
        const itemWithTotals = calculateCartItemTotals(updatedItem);

        return prevCart.map((item) =>
          item.id === product.id ? itemWithTotals : item
        );
      }
      const newItem = calculateCartItemTotals({ ...product, quantity: 1 });
      return [...prevCart, newItem];
    });
  };

  // Miktar güncelleme
  const updateQuantity = (productId: number, change: number): void => {
    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.id === productId) {
          const product = sampleProducts.find((p) => p.id === productId);
          if (!product) return item;

          const newQuantity = item.quantity + change;
          if (newQuantity > product.stock || newQuantity <= 0) return item;

          const updatedItem = {
            ...item,
            quantity: newQuantity,
          };
          return calculateCartItemTotals(updatedItem);
        }
        return item;
      })
    );
  };

  // Ürün kaldırma
  const removeFromCart = (productId: number): void => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== productId));
  };

  // Stok güncelleme fonksiyonu
  const updateStock = (): void => {
    cart.forEach((cartItem) => {
      const productIndex = sampleProducts.findIndex(
        (product) => product.id === cartItem.id
      );
      if (productIndex !== -1) {
        // Stok miktarını düşür
        sampleProducts[productIndex].stock -= cartItem.quantity;
      }
    });
  };

  // Ödeme tamamlama
  const handlePaymentComplete = (
    paymentMethod: PaymentMethod,
    cashReceived?: number
  ): void => {
    // KDV oranı hesaplaması için cart üzerinden subtotal ve vatAmount hesapla
    const subtotal = cart.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    ); // KDV'siz toplam
    const vatAmount = cart.reduce(
      (sum, item) => sum + item.price * item.quantity * (item.vatRate / 100),
      0
    ); // KDV toplamı

    // Toplam tutar
    const totalAmount = subtotal + vatAmount;

    // Stokları güncelle
    updateStock();

    // Yeni satışı ekle
    const sale = salesService.addSale({
      items: cart,
      subtotal,
      vatAmount,
      total: totalAmount,
      paymentMethod,
      cashReceived,
      changeAmount: cashReceived ? cashReceived - totalAmount : undefined,
      date: new Date(),
    });

    // Fiş verilerini ayarla
    const receiptData: ReceiptInfo = {
      receiptNo: sale.receiptNo,
      date: sale.date,
      items: sale.items,
      subtotal: sale.subtotal,
      vatAmount: sale.vatAmount,
      total: sale.total,
      paymentMethod: sale.paymentMethod,
      cashReceived: sale.cashReceived,
      changeAmount: sale.changeAmount,
    };

    setCurrentReceipt(receiptData);
    setShowReceiptModal(true);
    setShowPaymentModal(false);
  };

  // Fiş modalını kapat
  const handleReceiptClose = (): void => {
    setShowReceiptModal(false);
    setCart([]);
  };

  // Kısayol tuşları
  useHotkeys([
    {
      key: "n",
      ctrlKey: true,
      callback: (e?: KeyboardEvent) => {
        e?.preventDefault();
        startNewSale();
      },
    },
    {
      key: "p",
      ctrlKey: true,
      callback: (e?: KeyboardEvent) => {
        e?.preventDefault();
        if (cart.length > 0) setShowPaymentModal(true);
      },
    },
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
    {
      key: "Enter",
      callback: handleBarcodeSearch,
    },
    {
      key: "k",
      ctrlKey: true,
      callback: (e?: KeyboardEvent) => {
        e?.preventDefault();
        searchInputRef.current?.focus();
      },
    },
    {
      key: "/",
      ctrlKey: true,
      callback: (e?: KeyboardEvent) => {
        e?.preventDefault();
        setShowHotkeysHelper((prev) => !prev);
      },
    },
  ]);

  // Ürün filtreleme
  const filteredProducts = sampleProducts.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.barcode.includes(searchQuery);
    const matchesCategory =
      selectedCategory === "Tümü" || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

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
                disabled={product.stock === 0}
                className={`p-4 border rounded-lg hover:shadow-md transition-shadow text-left relative 
                  ${product.stock === 0 ? "opacity-50 cursor-not-allowed" : ""}
                `}
              >
                <div className="font-medium text-gray-900">{product.name}</div>
                <div className="text-sm text-gray-500 flex items-center gap-1">
                  <Tag size={14} />
                  {product.category}
                </div>
                {/* Fiyat Bilgisi */}
                <div className="mt-2">
                  <div className="font-semibold text-primary-600">
                    {formatCurrency(product.priceWithVat)}
                  </div>
                  <div className="text-xs text-gray-500">
                    +{formatVatRate(product.vatRate)} KDV
                  </div>
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
                <div className="text-sm space-y-0.5">
                  <div className="text-gray-500">
                    {formatCurrency(item.price)} + {formatVatRate(item.vatRate)}{" "}
                    KDV
                  </div>
                  <div className="text-gray-900 font-medium">
                    Toplam: {formatCurrency(item.totalWithVat || 0)}
                  </div>
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
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Ara Toplam:</span>
              <span>{formatCurrency(cartTotals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>KDV:</span>
              <span>{formatCurrency(cartTotals.vatAmount)}</span>
            </div>
            <div className="flex justify-between font-semibold text-lg">
              <span>Toplam:</span>
              <span className="text-primary-600">
                {formatCurrency(cartTotals.total)}
              </span>
            </div>
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
        total={cartTotals.total}
        subtotal={cartTotals.subtotal}
        vatAmount={cartTotals.vatAmount}
        onComplete={handlePaymentComplete}
      />

      {/* Fiş Modal */}
      {currentReceipt && (
        <ReceiptModal
          isOpen={showReceiptModal}
          onClose={handleReceiptClose}
          receiptData={currentReceipt}
        />
      )}

      {/* Klavye Kısayolları Yardımcısı */}
      {showHotkeysHelper && <HotkeysHelper />}
    </div>
  );
};

export default POSPage;

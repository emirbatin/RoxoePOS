// pages/POSPage.tsx

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  ShoppingCart,
  Plus,
  Minus,
  X,
  CreditCard,
  Trash2,
} from "lucide-react";
import { useHotkeys, HotkeysHelper } from "../hooks/useHotkeys";
import { CartTab, PaymentMethod, PaymentResult } from "../types/pos";
import { Product } from "../types/product";
import { ReceiptInfo } from "../types/receipt";
import { Customer } from "../types/credit";
import { productService } from "../services/productDB";
import { creditService } from "../services/creditServices";
import { salesDB } from "../services/salesDB";
import { Sale } from "../types/sales";
import {
  calculateCartTotals,
  calculateCartItemTotals,
  formatCurrency,
  formatVatRate,
} from "../utils/vatUtils";
import PaymentModal from "../components/modals/PaymentModal";
import ReceiptModal from "../components/modals/ReceiptModal";
import Button from "../components/ui/Button";
import { useAlert } from "../components/AlertProvider";
import PageLayout from "../components/layout/PageLayout";
import SearchFilterPanel from "../components/SearchFilterPanel";
import Card from "../components/ui/Card";
import SelectProductsModal from "../components/modals/SelectProductModal";
import ProductGroupTabs from "../components/ProductGroupTabs";

// --- Yeni eklenen custom hook importları ---
import { useProducts } from "../hooks/useProducts";
import { useCart } from "../hooks/useCart";
import { useProductGroups } from "../hooks/useProductGroups";

/**
 * POSPage: Satış ekranı
 *  - Ürünleri ve kategorileri useProducts() ile çekiyor.
 *  - Sepet (çoklu sekme) mantığını useCart() ile yönetiyor.
 *  - Barkod, kısayollar, ödeme, veresiye, vb. önceki mantıklar aynı.
 */
const POSPage: React.FC = () => {
  const { showError, showSuccess, confirm } = useAlert();

  // 1) Ürün/kategori yönetimi: useProducts
  const {
    products,
    categories,
    loading: productsLoading,
    searchTerm,
    setSearchTerm,
    selectedCategory,
    setSelectedCategory,
    filteredProducts, // arama + kategori ile otomatik filtrelenmiş
  } = useProducts({ enableCategories: true });

  // 2) Sepet yönetimi: useCart
  const {
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
  } = useCart();

  // 3) Müşteri verileri (veresiye için)
  const [customers, setCustomers] = useState<Customer[]>([]);
  useEffect(() => {
    // Müşteri listesini yükle
    const loadCustomers = async () => {
      try {
        const allCustomers = await creditService.getAllCustomers();
        setCustomers(allCustomers);
      } catch (error) {
        console.error("Müşteriler yüklenirken hata:", error);
      }
    };
    loadCustomers();
  }, []);

  // 4) Seçili müşteri (veresiye satış için)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );

  // 5) Diğer UI state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [currentReceipt, setCurrentReceipt] = useState<ReceiptInfo | null>(null);
  const [showHotkeysHelper, setShowHotkeysHelper] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [showSelectProductsModal, setShowSelectProductsModal] = useState(false);

  // 6) Ürün grupları (isteğe bağlı)
  const {
    groups: productGroups,
    addGroup,
    renameGroup,
    addProductToGroup,
    removeProductFromGroup,
    refreshGroups,
  } = useProductGroups();
  const [activeGroupId, setActiveGroupId] = useState<number>(1);

  // Barkod config (LocalStorage’dan okunuyor, opsiyonel)
  const [barcodeConfig] = useState(() => {
    const saved = localStorage.getItem("barcodeConfig");
    return saved ? JSON.parse(saved) : { enabled: true, suffix: "\n" };
  });

  // Arama input referansı
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filtre sıfırlama
  const resetFilters = () => {
    setSearchTerm("");
    setSelectedCategory("Tümü");
    setShowFilters(false);
  };

  // Barkod araması
  const handleBarcodeSearch = async (): Promise<void> => {
    if (searchTerm) {
      const product = products.find((p) => p.barcode === searchTerm);
      if (product) {
        addToCart(product);
        setSearchTerm("");
      }
    }
  };

  // Yeni satış başlatma (sepeti temizleme)
  const startNewSale = async (): Promise<void> => {
    if (!activeTab?.cart.length) {
      searchInputRef.current?.focus();
      return;
    }
    const confirmed = await confirm(
      "Mevcut satışı iptal edip yeni satış başlatmak istiyor musunuz?"
    );
    if (confirmed) {
      clearCart();
      setSearchTerm("");
      searchInputRef.current?.focus();
    }
  };

  // Kısayollar
  useHotkeys({
    hotkeys: [
      {
        key: "n",
        ctrlKey: true,
        callback: (e) => {
          e?.preventDefault();
          startNewSale();
        },
      },
      {
        key: "p",
        ctrlKey: true,
        callback: (e) => {
          e?.preventDefault();
          if (activeTab && activeTab.cart.length > 0) setShowPaymentModal(true);
        },
      },
      {
        key: "Escape",
        callback: () => {
          if (showPaymentModal) {
            setShowPaymentModal(false);
          } else if (searchTerm) {
            setSearchTerm("");
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
        callback: (e) => {
          e?.preventDefault();
          searchInputRef.current?.focus();
        },
      },
      {
        key: "/",
        ctrlKey: true,
        callback: (e) => {
          e?.preventDefault();
          setShowHotkeysHelper((prev) => !prev);
        },
      },
      {
        key: "t",
        ctrlKey: true,
        callback: (e) => {
          e?.preventDefault();
          addNewTab();
        },
      },
      {
        key: "w",
        ctrlKey: true,
        callback: (e) => {
          e?.preventDefault();
          if (cartTabs.length > 1) removeTab(activeTabId);
        },
      },
      {
        key: "Tab",
        ctrlKey: true,
        callback: (e) => {
          e?.preventDefault();
          const currentIndex = cartTabs.findIndex((tab) => tab.id === activeTabId);
          const nextIndex = (currentIndex + 1) % cartTabs.length;
          setActiveTabId(cartTabs[nextIndex].id);
        },
      },
    ],
    onQuantityUpdate: (newQuantity) => {
      if (!activeTab?.cart.length) return;
      const lastItem = activeTab.cart[activeTab.cart.length - 1];
      updateQuantity(lastItem.id, newQuantity - lastItem.quantity);
    },
  });

  // Gruplara özel ek fonksiyonlar (örn. yeni grup ekle)
  const handleAddGroup = async () => {
    try {
      const newGroup = await addGroup("Yeni Grup");
      setActiveGroupId(newGroup.id);
    } catch (error) {
      console.error("Grup eklenirken hata:", error);
    }
  };

  // Çoklu ürün ekleme (SelectProductsModal kapanırken tetikleniyor)
  const handleAddMultipleProducts = async (productIds: number[]) => {
    if (activeGroupId === 1) return; // Varsayılan gruba ekleme yok
    try {
      await Promise.all(
        productIds.map((pid) =>
          productService.addProductToGroup(activeGroupId, pid)
        )
      );
      await refreshGroups();
      showSuccess("Ürünler gruba eklendi");
    } catch (error) {
      showError("Ürünler eklenirken bir hata oluştu");
    }
  };

  // Arama+kategori filtreli ürünlerin, grup filtreli son hâli
  const finalFilteredProducts = useMemo(() => {
    if (activeGroupId === 1) {
      // Varsayılan grup (hepsi)
      return filteredProducts;
    }
    const group = productGroups.find((g) => g.id === activeGroupId);
  
    // `group?.productIds ?? []` => Eğer group yoksa veya productIds tanımsızsa boş dizi dön
    return filteredProducts.filter((p) => (group?.productIds ?? []).includes(p.id));
  }, [filteredProducts, activeGroupId, productGroups]);


  // Sepetin Toplamları
  const cartTotals = activeTab
    ? calculateCartTotals(activeTab.cart)
    : { subtotal: 0, vatAmount: 0, total: 0, vatBreakdown: [] };

  // Ödeme tamamlandığında
  const handlePaymentComplete = async (paymentResult: PaymentResult) => {
    if (!activeTab) return;
    const { subtotal, vatAmount, total } = calculateCartTotals(activeTab.cart);

    let paymentMethodForSale: PaymentMethod = "nakit";
    let cashReceived: number | undefined;
    let splitDetails: Sale["splitDetails"] | undefined = undefined;

    if (paymentResult.mode === "normal") {
      paymentMethodForSale = paymentResult.paymentMethod;
      cashReceived = paymentResult.received;
    } else {
      paymentMethodForSale = "mixed";
      splitDetails = {
        productPayments: paymentResult.productPayments,
        equalPayments: paymentResult.equalPayments,
      };
    }

    const saleData: Omit<Sale, "id"> = {
      items: activeTab.cart.map((item) => ({
        ...item,
        salePrice: item.salePrice,
        priceWithVat: item.priceWithVat,
        total: item.salePrice * item.quantity,
        totalWithVat: item.priceWithVat * item.quantity,
        vatAmount: (item.priceWithVat - item.salePrice) * item.quantity,
      })),
      subtotal,
      vatAmount,
      total,
      paymentMethod: paymentMethodForSale,
      cashReceived,
      changeAmount:
        paymentResult.mode === "normal" &&
        (paymentResult.paymentMethod === "nakit" ||
          paymentResult.paymentMethod === "nakitpos")
          ? (cashReceived || 0) - total
          : undefined,
      date: new Date(),
      status: "completed",
      receiptNo: salesDB.generateReceiptNo(),
      splitDetails,
    };

    try {
      const newSale = await salesDB.addSale(saleData);
      // Veresiye işlemi
      if (paymentResult.mode === "normal") {
        if (paymentResult.paymentMethod === "veresiye" && selectedCustomer) {
          await creditService.addTransaction({
            customerId: selectedCustomer.id,
            type: "debt",
            amount: total,
            date: new Date(),
            description: `Fiş No: ${newSale.receiptNo}`,
          });
        }
      } else {
        // split => item bazında ya da equalPayments veresiye kısımları
        if (paymentResult.productPayments) {
          for (const pp of paymentResult.productPayments) {
            if (pp.paymentMethod === "veresiye" && pp.customer) {
              await creditService.addTransaction({
                customerId: pp.customer.id,
                type: "debt",
                amount: pp.received,
                date: new Date(),
                description: `Fiş No: ${newSale.receiptNo} (Ürün ID: ${pp.itemId})`,
              });
            }
          }
        }
        if (paymentResult.equalPayments) {
          for (let i = 0; i < paymentResult.equalPayments.length; i++) {
            const eq = paymentResult.equalPayments[i];
            if (eq.paymentMethod === "veresiye" && eq.customer) {
              await creditService.addTransaction({
                customerId: eq.customer.id,
                type: "debt",
                amount: eq.received,
                date: new Date(),
                description: `Fiş No: ${newSale.receiptNo} (Kişi ${i + 1})`,
              });
            }
          }
        }
      }

      // Stok güncelle
      for (const cartItem of activeTab.cart) {
        await productService.updateStock(cartItem.id, -cartItem.quantity);
      }

      // Sepeti temizle
      clearCart();
      setSelectedCustomer(null);
      setShowPaymentModal(false);
      showSuccess(`Satış başarıyla tamamlandı! Fiş No: ${newSale.receiptNo}`);
    } catch (error) {
      console.error("Satış kaydedilirken hata:", error);
      showError("Satış sırasında bir hata oluştu!");
    }
  };

  return (
    <PageLayout title="Satış">
      <div className="flex h-[calc(100vh-11rem)] gap-6">
        {/* Sol Panel - Arama, Filtre, Gruplar, Ürün Grid */}
        <div className="flex-1 flex flex-col bg-white rounded-lg shadow-sm overflow-hidden h-full">
          {/* Arama + Filtre Butonu */}
          <div className="p-4 border-b">
            <SearchFilterPanel
              searchTerm={searchTerm}
              onSearchTermChange={setSearchTerm}
              onReset={resetFilters}
              showFilter={showFilters}
              toggleFilter={() => setShowFilters((prev) => !prev)}
              inputRef={searchInputRef} // Barkod/kısayol için odak
            />

            {/* Kategori Filtreleri */}
            {showFilters && (
              <div className="mt-4">
                <div className="flex flex-wrap gap-2 items-center">
                  <button
                    onClick={() => setSelectedCategory("Tümü")}
                    className={`px-3 py-1.5 rounded-lg ${
                      selectedCategory === "Tümü"
                        ? "bg-primary-50 text-primary-600"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    Tümü
                  </button>
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategory(category.name)}
                      className={`px-3 py-1.5 rounded-lg ${
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
            )}
          </div>

          {/* Ürün Grup Sekmeleri */}
          <ProductGroupTabs
            groups={productGroups}
            activeGroupId={activeGroupId}
            onGroupChange={setActiveGroupId}
            onAddGroup={handleAddGroup}
            onRenameGroup={renameGroup}
            onDeleteGroup={async (groupId: number) => {
              const confirmed = await confirm(
                "Bu grubu silmek istediğinize emin misiniz?"
              );
              if (confirmed) {
                await productService.deleteProductGroup(groupId);
                await refreshGroups();
                if (activeGroupId === groupId) {
                  setActiveGroupId(1);
                }
                showSuccess("Grup başarıyla silindi");
              }
            }}
          />

          {/* Ürün Grid */}
          <div className="flex-1 p-4 overflow-y-auto">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {/* Grup için çoklu ürün ekleme butonu (Varsayılan grup değilse) */}
              {activeGroupId !== 1 && (
                <Card
                  variant="addProduct"
                  onClick={() => setShowSelectProductsModal(true)}
                />
              )}

              {/* Filtrelenmiş + Grup bazlı ürünler */}
              {finalFilteredProducts.map((product) => (
                <Card
                  key={product.id}
                  variant="product"
                  title={product.name}
                  imageUrl={product.imageUrl}
                  category={product.category}
                  price={formatCurrency(product.priceWithVat)}
                  vatRate={formatVatRate(product.vatRate)}
                  stock={product.stock}
                  onClick={() => addToCart(product)}
                  disabled={product.stock === 0}
                  // Grup'a ekle / çıkar butonları
                  onAddToGroup={
                    activeGroupId !== 1 &&
                    !productGroups
                      .find((g) => g.id === activeGroupId)
                      ?.productIds?.includes(product.id)
                      ? () => addProductToGroup(activeGroupId, product.id)
                      : undefined
                  }
                  onRemoveFromGroup={
                    activeGroupId !== 1 &&
                    productGroups
                      .find((g) => g.id === activeGroupId)
                      ?.productIds?.includes(product.id)
                      ? () => removeProductFromGroup(activeGroupId, product.id)
                      : undefined
                  }
                />
              ))}
            </div>
          </div>
        </div>

        {/* Sağ Panel - Sepet */}
        <div className="w-96 bg-white rounded-lg shadow-sm flex flex-col h-full">
          {/* Sepet Sekmeleri */}
          <div className="flex items-center gap-2 p-2 border-b overflow-x-auto">
            {cartTabs.map((tab) => {
              const itemCount = tab.cart.reduce((acc, i) => acc + i.quantity, 0);
              return (
                <div
                  key={tab.id}
                  className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer ${
                    activeTabId === tab.id
                      ? "bg-primary-50 text-primary-600"
                      : "hover:bg-gray-50"
                  }`}
                  onClick={() => setActiveTabId(tab.id)}
                >
                  <div className="flex items-center gap-2">
                    <ShoppingCart size={14} />
                    <span>{tab.title}</span>
                    <span className="text-xs text-gray-500">({itemCount})</span>
                  </div>
                  {/* Sekme kapatma butonu */}
                  {cartTabs.length > 1 && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (tab.cart.length > 0) {
                          const confirmed = await confirm(
                            `${tab.title} sepetini silmek istediğinize emin misiniz?`
                          );
                          if (confirmed) removeTab(tab.id);
                        } else {
                          removeTab(tab.id);
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 rounded"
                    >
                      <X size={14} className="text-red-500" />
                    </button>
                  )}
                </div>
              );
            })}
            <button
              onClick={addNewTab}
              className="p-2 rounded-lg hover:bg-gray-50 text-primary-600"
              title="Yeni Sepet"
            >
              <Plus size={20} />
            </button>
          </div>

          {/* Aktif Sepet İçeriği */}
          {activeTab && (
            <>
              <div className="p-4 border-b">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <ShoppingCart size={20} />
                    {activeTab.cart.reduce((sum, i) => sum + i.quantity, 0)} Ürün
                  </h2>
                  {activeTab.cart.length > 0 && (
                    <button
                      onClick={() => clearCart()}
                      className="text-red-500 hover:text-red-600"
                      title="Sepeti Temizle"
                    >
                      <Trash2 size={20} />
                    </button>
                  )}
                </div>
              </div>

              {/* Sepet Öğeleri */}
              <div className="flex-1 p-4 overflow-y-auto">
                {activeTab.cart.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    <ShoppingCart
                      size={40}
                      className="mx-auto mb-2 opacity-50"
                    />
                    <p>Sepet boş</p>
                  </div>
                ) : (
                  activeTab.cart.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 py-3 border-b last:border-0"
                    >
                      <div className="flex-1">
                        <div className="font-medium">{item.name}</div>
                        <div className="text-sm space-y-0.5">
                          <div className="text-gray-500">
                            {formatCurrency(item.salePrice)} +{" "}
                            {formatVatRate(item.vatRate)} KDV
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
                  ))
                )}
              </div>

              {/* Toplam & Ödeme Butonu */}
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
                <Button
                  onClick={() => setShowPaymentModal(true)}
                  disabled={!activeTab.cart.length}
                  variant="primary"
                  icon={CreditCard}
                >
                  Ödeme Yap
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Kısayol Yardımcısı */}
        <HotkeysHelper />
      </div>

      {/* Ödeme Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        total={cartTotals.total}
        subtotal={cartTotals.subtotal}
        vatAmount={cartTotals.vatAmount}
        onComplete={handlePaymentComplete}
        customers={customers}
        selectedCustomer={selectedCustomer}
        setSelectedCustomer={setSelectedCustomer}
        items={
          activeTab
            ? activeTab.cart.map((item) => ({
                id: item.id,
                name: item.name,
                amount: item.totalWithVat ?? item.salePrice * item.quantity,
              }))
            : []
        }
      />

      {/* Fiş Modal */}
      {currentReceipt && (
        <ReceiptModal
          isOpen={showReceiptModal}
          onClose={() => {
            setShowReceiptModal(false);
            setCurrentReceipt(null);
          }}
          receiptData={currentReceipt}
        />
      )}

      {/* Ürünleri gruba çoklu ekleme Modal */}
      <SelectProductsModal
        isOpen={showSelectProductsModal}
        onClose={() => setShowSelectProductsModal(false)}
        onSelect={handleAddMultipleProducts}
        products={products}
        existingProductIds={
          productGroups.find((g) => g.id === activeGroupId)?.productIds || []
        }
      />
    </PageLayout>
  );
};

export default POSPage;
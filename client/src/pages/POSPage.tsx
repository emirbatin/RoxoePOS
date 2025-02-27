// pages/POSPage.tsx
import React, { useState, useRef, useMemo, useEffect } from "react";
import { ShoppingCart, Plus, Minus, X, CreditCard, Trash2 } from "lucide-react";
import { useHotkeys } from "../hooks/useHotkeys";
import { CartTab, PaymentMethod, PaymentResult } from "../types/pos";
import { ReceiptInfo } from "../types/receipt";
import { Customer } from "../types/credit";
import { productService } from "../services/productDB";
import { creditService } from "../services/creditServices";
import { salesDB } from "../services/salesDB";
import { Sale } from "../types/sales";
import {
  calculateCartTotals,
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

import { useProducts } from "../hooks/useProducts";
import { useCart } from "../hooks/useCart";
import { useProductGroups } from "../hooks/useProductGroups";
import { posService } from "../services/posServices";

const POSPage: React.FC = () => {
  const { showError, showSuccess, confirm } = useAlert();

  // 1) Ürün / Kategori Yönetimi
  const {
    products,
    categories,
    loading: productsLoading,
    searchTerm,
    setSearchTerm,
    selectedCategory,
    setSelectedCategory,
    filteredProducts,
  } = useProducts({ enableCategories: true });

  // 2) Sepet Yönetimi
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

  // 3) Müşteriler (veresiye için)
  const [customers, setCustomers] = useState<Customer[]>([]);
  useEffect(() => {
    creditService
      .getAllCustomers()
      .then(setCustomers)
      .catch((e) => console.error("Müşteriler yüklenemedi:", e));
  }, []);

  // 4) Seçili müşteri (veresiye vs.)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );

  // 5) UI state'leri (Payment, Receipt, Filtre, SelectProductsModal)
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [currentReceipt, setCurrentReceipt] = useState<ReceiptInfo | null>(
    null
  );
  const [showFilters, setShowFilters] = useState(false);
  const [showSelectProductsModal, setShowSelectProductsModal] = useState(false);

  // 6) Ürün Grupları
  const {
    groups: productGroups,
    addGroup,
    renameGroup,
    addProductToGroup,
    removeProductFromGroup,
    refreshGroups,
  } = useProductGroups();

  // activeGroupId'yi başlangıçta 0 olarak ayarla
  const [activeGroupId, setActiveGroupId] = useState<number>(0);

  // Grupları yükledikten sonra varsayılan grubu (Tümü) bul ve aktif yap
  useEffect(() => {
    if (productGroups.length > 0) {
      const defaultGroup = productGroups.find((g) => g.isDefault);
      if (defaultGroup) {
        console.log("Setting default group as active:", defaultGroup);
        setActiveGroupId(defaultGroup.id);
      }
    }
  }, [productGroups]);

  // 7) Barkod config + input ref
  const [barcodeConfig] = useState(() => {
    const saved = localStorage.getItem("barcodeConfig");
    return saved ? JSON.parse(saved) : { enabled: true, suffix: "\n" };
  });
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filtre reset
  const resetFilters = () => {
    setSearchTerm("");
    setSelectedCategory("Tümü");
    setShowFilters(false);
  };

  // POSPage.tsx içinde, useHotkeys hook'unu çağırmadan önce aşağıdaki fonksiyonları ekleyin:

  // Hızlı Nakit Ödeme Fonksiyonu (F7)
  const handleQuickCashPayment = async () => {
    if (!activeTab?.cart.length) {
      showError("Sepet boş! Ödeme yapılamaz");
      return;
    }

    try {
      // Nakit ödeme için PaymentResult oluştur
      const paymentResult: PaymentResult = {
        mode: "normal",
        paymentMethod: "nakit",
        received: cartTotals.total, // Tam tutarı nakit olarak al
      };

      // Bilgi mesajı göster
      showSuccess("Nakit ödeme işlemi başlatıldı...");

      // Ödeme işlemini tamamla
      await handlePaymentComplete(paymentResult);
      
      // Başarılı ödeme bildirimi
      showSuccess("Nakit ödeme başarıyla tamamlandı");
    } catch (error) {
      console.error("Hızlı nakit ödeme hatası:", error);
      showError("Ödeme işlemi sırasında bir hata oluştu");
    }
  };

  // Hızlı Kredi Kartı Ödeme Fonksiyonu (F8)
  const handleQuickCardPayment = async () => {
    if (!activeTab?.cart.length) {
      showError("Sepet boş! Ödeme yapılamaz");
      return;
    }

    try {
      // POS işleminin manuel modda olup olmadığını kontrol et
      const isManualMode = await posService.isManualMode();
      
      if (!isManualMode) {
        // Manuel mod değilse, POS cihazına bağlan
        showSuccess("Kredi kartı işlemi başlatılıyor...");
        const connected = await posService.connect("Ingenico");
        
        if (!connected) {
          showError("POS cihazına bağlanılamadı!");
          return;
        }
        
        // POS işlemini başlat
        const result = await posService.processPayment(cartTotals.total);
        
        // Bağlantıyı kapat
        await posService.disconnect();
        
        if (!result.success) {
          showError(result.message);
          return;
        }
      }
      
      // Kredi kartı ödeme için PaymentResult oluştur
      const paymentResult: PaymentResult = {
        mode: "normal",
        paymentMethod: "kart", // Düzeltildi: "kredikarti" -> "kart"
        received: cartTotals.total, // Tam tutarı kredi kartı ile öde
      };

      // Ödeme işlemini tamamla
      await handlePaymentComplete(paymentResult);
      
      // Başarılı ödeme bildirimi
      showSuccess("Kredi kartı ile ödeme başarıyla tamamlandı");
    } catch (error) {
      console.error("Hızlı kredi kartı ödeme hatası:", error);
      showError("Ödeme işlemi sırasında bir hata oluştu");
    }
  };

  // Start new sale
  async function startNewSale(): Promise<void> {
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
  }

  // Yeni grup ekleme işlemi - geliştirilmiş hata yakalama ile
  const handleAddGroup = async () => {
    console.log("Add group handler triggered");
    try {
      // Sabit isim kullan
      const groupName = "Yeni Grup";
      console.log(`Adding new group: ${groupName}`);

      const g = await addGroup(groupName);
      console.log("Group added successfully:", g);

      setActiveGroupId(g.id);
      showSuccess(`'${groupName}' grubu başarıyla eklendi`);
    } catch (error) {
      console.error("Grup eklenirken hata oluştu:", error);
      showError("Grup eklenirken bir hata oluştu. Lütfen tekrar deneyin.");
    }
  };

  // POSPage bileşeninde handleBarcodeDetected fonksiyonunu bu şekilde güncelleyin
  const handleBarcodeDetected = (barcode: string) => {
    console.log("Barkod algılandı:", barcode);
    console.log("Toplam ürün sayısı:", products.length);
    console.log("Filtrelenmiş ürün sayısı:", filteredProducts.length);

    // 1. Adım: Önce barkod alanına göre eşleşme ara
    let matchingProduct = products.find((p) => p.barcode === barcode);

    if (matchingProduct) {
      console.log("Barkod ile tam eşleşme bulundu:", matchingProduct);
    } else {
      // 2. Adım: Barkod sayısal ise, ID ile eşleşme ara
      const numericBarcode = parseInt(barcode);
      if (!isNaN(numericBarcode)) {
        matchingProduct = products.find((p) => p.id === numericBarcode);
        if (matchingProduct) {
          console.log("ID ile tam eşleşme bulundu:", matchingProduct);
        }
      }

      // 3. Adım: Hala bulunamadıysa, isim ile tam eşleşme ara
      if (!matchingProduct) {
        matchingProduct = products.find(
          (p) => p.name.toLowerCase() === barcode.toLowerCase()
        );

        if (matchingProduct) {
          console.log("İsim ile tam eşleşme bulundu:", matchingProduct);
        }
      }
    }

    // 4. Adım: Eşleşme varsa ve stok yeterliyse sepete ekle
    if (matchingProduct) {
      if (matchingProduct.stock > 0) {
        console.log(
          "Ürün bulundu ve stokta var, sepete ekleniyor:",
          matchingProduct
        );
        addToCart(matchingProduct);
        showSuccess(`${matchingProduct.name} sepete eklendi`);
      } else {
        console.log("Ürün bulundu fakat stokta yok:", matchingProduct);
        showError(`${matchingProduct.name} stokta yok`);
      }
      return;
    }

    // 5. Adım: Hiçbir eşleşme bulunamadıysa, kısmi eşleşmeleri kontrol et
    console.log("Tam eşleşme bulunamadı, kısmi eşleşmeler aranıyor...");

    // Barkodu içeren ürünleri bul
    const partialMatches = products.filter(
      (p) =>
        p.barcode.includes(barcode) || // Barkod içinde geçiyorsa
        p.name.toLowerCase().includes(barcode.toLowerCase()) // İsim içinde geçiyorsa
    );

    console.log(`${partialMatches.length} kısmi eşleşme bulundu`);

    if (partialMatches.length === 1) {
      // Tek kısmi eşleşme varsa
      const match = partialMatches[0];
      if (match.stock > 0) {
        console.log("Tek kısmi eşleşme ekleniyor:", match);
        addToCart(match);
        showSuccess(`${match.name} sepete eklendi`);
        return;
      } else {
        console.log("Kısmi eşleşen ürün stokta yok:", match);
        showError(`${match.name} stokta yok`);
        return;
      }
    } else if (partialMatches.length > 1) {
      // Birden çok kısmi eşleşme varsa, arama terimini güncelle ve sonuçları göster
      console.log(
        "Birden çok kısmi eşleşme bulundu, arama terimi güncelleniyor"
      );
      setSearchTerm(barcode);
      return;
    }

    // 6. Adım: Hiçbir eşleşme bulunamadıysa
    console.log(
      "Hiçbir eşleşme bulunamadı, arama terimi güncelleniyor:",
      barcode
    );
    setSearchTerm(barcode);
  };

  // Hotkeys setup
  const { quantityMode, tempQuantity } = useHotkeys({
    hotkeys: [
      {
        key: "n",
        ctrlKey: true,
        callback: startNewSale,
      },
      {
        key: "p",
        ctrlKey: true,
        callback: () => activeTab?.cart.length && setShowPaymentModal(true),
      },
      {
        key: "Escape",
        callback: async () => {
          if (showPaymentModal) {
            setShowPaymentModal(false);
          } else if (searchTerm) {
            setSearchTerm("");
          } else {
            const confirmed = await confirm(
              "Sepeti tamamen temizlemek istediğinize emin misiniz?"
            );
            if (confirmed) clearCart();
          }
        },
      },
      {
        key: "k",
        ctrlKey: true,
        callback: () => searchInputRef.current?.focus(),
      },
      {
        key: "t",
        ctrlKey: true,
        callback: addNewTab,
      },
      {
        key: "w",
        ctrlKey: true,
        callback: () => cartTabs.length > 1 && removeTab(activeTabId),
      },
      {
        key: "Tab",
        ctrlKey: true,
        callback: () => {
          const currentIndex = cartTabs.findIndex(
            (tab) => tab.id === activeTabId
          );
          const nextIndex = (currentIndex + 1) % cartTabs.length;
          setActiveTabId(cartTabs[nextIndex].id);
        },
      },
      {
        key: "F7",
        callback: handleQuickCashPayment,
      },
      {
        key: "F8",
        callback: handleQuickCardPayment,
      },
    ],
    onQuantityUpdate: (newQuantity) => {
      if (!activeTab?.cart.length) return;
      const lastItem = activeTab.cart[activeTab.cart.length - 1];

      if (newQuantity > lastItem.stock) {
        showError(`Stokta sadece ${lastItem.stock} tane ürün var.`);
        return;
      }

      updateQuantity(lastItem.id, newQuantity - lastItem.quantity);
    },
  });

  // Grup için geliştirilen özelliklerin durumu hakkında ek log
  useEffect(() => {
    console.log("Product groups loaded:", productGroups);
  }, [productGroups]);

  // Çoklu ürün ekleme (SelectProductsModal)
  const handleAddMultipleProducts = async (productIds: number[]) => {
    if (activeGroupId === 0) return;
    try {
      await Promise.all(
        productIds.map((pid) =>
          productService.addProductToGroup(activeGroupId, pid)
        )
      );
      await refreshGroups();
      showSuccess("Ürünler gruba eklendi");
    } catch (error) {
      showError("Ürün eklenirken hata oluştu");
      console.error("Multiple products add error:", error);
    }
  };

  // Group'a göre filtre - Tümü grubu için tüm ürünleri göster
  const finalFilteredProducts = useMemo(() => {
    const defaultGroup = productGroups.find((g) => g.isDefault);

    // Eğer aktif grup varsayılan grup ise tüm filtrelenmiş ürünleri göster
    if (defaultGroup && activeGroupId === defaultGroup.id) {
      return filteredProducts;
    }

    // Diğer gruplar için sadece o gruba ait ürünleri göster
    const group = productGroups.find((g) => g.id === activeGroupId);
    return filteredProducts.filter((p) =>
      (group?.productIds ?? []).includes(p.id)
    );
  }, [filteredProducts, activeGroupId, productGroups]);

  // Sepet toplamları
  const cartTotals = activeTab
    ? calculateCartTotals(activeTab.cart)
    : { subtotal: 0, vatAmount: 0, total: 0, vatBreakdown: [] };

  // Ödeme tamamlandığında
  const handlePaymentComplete = async (paymentResult: PaymentResult) => {
    if (!activeTab) return;
    const { subtotal, vatAmount, total } = cartTotals;

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

      // Veresiye işlemleri
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
        {/* Sol Panel */}
        <div className="flex-1 flex flex-col bg-white rounded-lg shadow-sm overflow-hidden h-full">
          {/* Arama & Filtre */}
          <div className="p-4 border-b">
            <SearchFilterPanel
              searchTerm={searchTerm}
              onSearchTermChange={setSearchTerm}
              onReset={resetFilters}
              showFilter={showFilters}
              toggleFilter={() => setShowFilters((prev) => !prev)}
              inputRef={searchInputRef}
              onBarcodeDetected={handleBarcodeDetected}
              inputActive={document.activeElement === searchInputRef.current}
            />
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
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCategory(c.name)}
                      className={`px-3 py-1.5 rounded-lg ${
                        selectedCategory === c.name
                          ? "bg-primary-50 text-primary-600"
                          : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <span className="mr-2">{c.icon}</span>
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Grup Sekmeleri */}
          <ProductGroupTabs
            groups={productGroups}
            activeGroupId={activeGroupId}
            onGroupChange={setActiveGroupId}
            onAddGroup={handleAddGroup} // Geliştirilmiş fonksiyon kullanıyoruz
            onRenameGroup={renameGroup}
            onDeleteGroup={async (gid) => {
              const c = await confirm(
                "Bu grubu silmek istediğinize emin misiniz?"
              );
              if (!c) return;
              try {
                await productService.deleteProductGroup(gid);
                await refreshGroups();

                // Eğer silinen grup aktif grupsa, varsayılan gruba dön
                if (activeGroupId === gid) {
                  const defaultGroup = productGroups.find((g) => g.isDefault);
                  if (defaultGroup) {
                    setActiveGroupId(defaultGroup.id);
                  }
                }

                showSuccess("Grup başarıyla silindi");
              } catch (error) {
                console.error("Delete group error:", error);
                showError("Grup silinirken bir hata oluştu");
              }
            }}
          />

          {/* Ürün Grid */}
          <div className="flex-1 p-4 overflow-y-auto">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-lg:grid-cols-4 gap-4">
              {/* Grup'a çoklu ekleme butonu - varsayılan grup değilse göster */}
              {activeGroupId !== 0 &&
                !productGroups.find((g) => g.id === activeGroupId)
                  ?.isDefault && (
                  <Card
                    variant="addProduct"
                    onClick={() => setShowSelectProductsModal(true)}
                  />
                )}
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
                  onAddToGroup={
                    !productGroups.find((g) => g.id === activeGroupId)
                      ?.isDefault &&
                    !productGroups
                      .find((g) => g.id === activeGroupId)
                      ?.productIds?.includes(product.id)
                      ? () => addProductToGroup(activeGroupId, product.id)
                      : undefined
                  }
                  onRemoveFromGroup={
                    !productGroups.find((g) => g.id === activeGroupId)
                      ?.isDefault &&
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
              const itemCount = tab.cart.reduce(
                (sum, i) => sum + i.quantity,
                0
              );
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
                  <ShoppingCart size={14} />
                  <span>{tab.title}</span>
                  <span className="text-xs text-gray-500">({itemCount})</span>
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
                    {activeTab.cart.reduce(
                      (sum, i) => sum + i.quantity,
                      0
                    )}{" "}
                    Ürün
                  </h2>
                  {activeTab.cart.length > 0 && (
                    <button
                      onClick={async () => {
                        const confirmed = await confirm(
                          "Sepeti tamamen temizlemek istediğinize emin misiniz?"
                        );
                        if (confirmed) {
                          clearCart();
                        }
                      }}
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

              {/* Toplam & Ödeme */}
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

        {process.env.NODE_ENV === "development" && (
          <div className="fixed bottom-4 left-4 z-50">
            <div className="bg-white p-4 rounded-lg shadow-lg border space-y-3">
              <h3 className="font-bold">Barkod Test Araçları</h3>

              <div className="flex gap-2">
                <input
                  type="text"
                  id="testBarcode"
                  defaultValue=""
                  className="border rounded px-2 py-1"
                  placeholder="Barkod/ID giriniz"
                />
                <button
                  onClick={() => {
                    const barcodeInput = document.getElementById(
                      "testBarcode"
                    ) as HTMLInputElement;
                    const barcode = barcodeInput?.value || "";
                    if (!barcode) {
                      showError("Lütfen test için bir barkod veya ID girin");
                      return;
                    }
                    console.log("Test Et butonuna tıklandı, barkod:", barcode);
                    handleBarcodeDetected(barcode);
                  }}
                  className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                >
                  Test Et
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    console.log("****** ÜRÜN LISTESI DEBUG ******");
                    console.log("Toplam ürün sayısı:", products.length);

                    // Tüm ürünleri listele
                    products.forEach((product) => {
                      console.log(
                        `Ürün: ${product.name}, ID: ${product.id}, Barkod: ${product.barcode}, Stok: ${product.stock}`
                      );
                    });

                    console.log("********************************");
                  }}
                  className="bg-purple-500 text-white px-3 py-1 rounded hover:bg-purple-600 w-full"
                >
                  Ürünleri Listele
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    // İlk ürünü test et
                    if (products.length > 0) {
                      const firstProduct = products[0];
                      console.log("İlk ürün test ediliyor:", firstProduct);

                      // Barkod ile test et
                      if (firstProduct.barcode) {
                        console.log(
                          `Barkod kullanılıyor: ${firstProduct.barcode}`
                        );
                        handleBarcodeDetected(firstProduct.barcode);
                      } else {
                        // ID ile test et
                        console.log(`ID kullanılıyor: ${firstProduct.id}`);
                        handleBarcodeDetected(firstProduct.id.toString());
                      }
                    } else {
                      showError("Ürün listesi boş");
                    }
                  }}
                  className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 w-full"
                >
                  İlk Ürünü Test Et
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    // Manuel ürün ekleme testi
                    if (products.length > 0) {
                      const firstProduct = products[0];
                      console.log(
                        "İlk ürün doğrudan sepete ekleniyor:",
                        firstProduct
                      );

                      if (firstProduct.stock > 0) {
                        addToCart(firstProduct);
                        showSuccess(`${firstProduct.name} sepete eklendi`);
                      } else {
                        showError(`${firstProduct.name} stokta yok!`);
                      }
                    } else {
                      showError("Ürün listesi boş");
                    }
                  }}
                  className="bg-orange-500 text-white px-3 py-1 rounded hover:bg-orange-600 w-full"
                >
                  İlk Ürünü Sepete Ekle
                </button>
              </div>

              <div className="text-xs text-gray-500">
                Bu panel sadece geliştirme ortamında görünür
              </div>
            </div>
          </div>
        )}

        {/* Star Mode Göstergesi */}
        {quantityMode && (
          <div className="fixed bottom-4 right-4 bg-gray-200 text-gray-800 p-2 rounded shadow-md">
            <div>Yıldız Modu Aktif</div>
            <div>Miktar: {tempQuantity || "?"}</div>
            <div className="text-xs text-gray-500">(Enter ile onayla)</div>
          </div>
        )}
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

      {/* Çoklu ürün ekleme Modal */}
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

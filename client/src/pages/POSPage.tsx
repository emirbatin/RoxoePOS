// pages/POSPage.tsx
import React, { useState, useRef, useMemo, useEffect } from "react";
import {
  ShoppingCart,
  Plus,
  Minus,
  X,
  CreditCard,
  Trash2,
  Banknote,
} from "lucide-react";
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

// YENİ: Kasa yönetimi
import { cashRegisterService } from "../services/cashRegisterDB";

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
    if (productGroups.length > 0 && activeGroupId === 0) {
      // Yalnızca activeGroupId sıfır ise
      const defaultGroup = productGroups.find((g) => g.isDefault);
      if (defaultGroup) {
        console.log("Setting default group as active:", defaultGroup);
        setActiveGroupId(defaultGroup.id);
      }
    }
  }, [productGroups, activeGroupId]);

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

  // **KASA AÇIK MI?** Durumu
  const [isRegisterOpen, setIsRegisterOpen] = useState<boolean>(false);

  // Sayfa yüklendiğinde kasa oturumunu kontrol et
  useEffect(() => {
    const checkCashRegister = async () => {
      try {
        const activeSession = await cashRegisterService.getActiveSession();
        setIsRegisterOpen(!!activeSession); // session varsa true, yoksa false
      } catch (error) {
        console.error("Kasa durumu sorgulanırken hata:", error);
        showError("Kasa durumu sorgulanırken bir hata oluştu!");
      }
    };
    checkCashRegister();
  }, [showError]);

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

  // Yeni grup ekleme işlemi
  const handleAddGroup = async () => {
    console.log("Add group handler triggered");
    try {
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

  // Barkod algılama
  const handleBarcodeDetected = (barcode: string) => {
    console.log("Barkod algılandı:", barcode);
    console.log("Toplam ürün sayısı:", products.length);
    console.log("Filtrelenmiş ürün sayısı:", filteredProducts.length);

    // 1) Barkod alanı ile tam eşleşme
    let matchingProduct = products.find((p) => p.barcode === barcode);

    if (!matchingProduct) {
      // 2) Barkod sayısal ise ID ile dene
      const numericBarcode = parseInt(barcode);
      if (!isNaN(numericBarcode)) {
        matchingProduct = products.find((p) => p.id === numericBarcode);
      }

      // 3) İsim ile tam eşleşme
      if (!matchingProduct) {
        matchingProduct = products.find(
          (p) => p.name.toLowerCase() === barcode.toLowerCase()
        );
      }
    }

    if (matchingProduct) {
      // Stok kontrol
      if (matchingProduct.stock > 0) {
        addToCart(matchingProduct);
        showSuccess(`${matchingProduct.name} sepete eklendi`);
      } else {
        showError(`${matchingProduct.name} stokta yok`);
      }
      return;
    }

    // 4) Kısmi eşleşme ara
    const partialMatches = products.filter(
      (p) =>
        p.barcode.includes(barcode) ||
        p.name.toLowerCase().includes(barcode.toLowerCase())
    );

    if (partialMatches.length === 1) {
      // Tek kısmi eşleşme
      const match = partialMatches[0];
      if (match.stock > 0) {
        addToCart(match);
        showSuccess(`${match.name} sepete eklendi`);
      } else {
        showError(`${match.name} stokta yok`);
      }
    } else if (partialMatches.length > 1) {
      // Birden çok kısmi eşleşme ⇒ arama terimi
      setSearchTerm(barcode);
    } else {
      // Hiç eşleşme yok
      setSearchTerm(barcode);
    }
  };

  // Hızlı Nakit Ödeme
  const handleQuickCashPayment = async () => {
    if (!activeTab?.cart.length) {
      showError("Sepet boş! Ödeme yapılamaz");
      return;
    }
    if (!isRegisterOpen) {
      showError("Kasa henüz açılmadı! Lütfen önce kasayı açın.");
      return;
    }

    try {
      const paymentResult: PaymentResult = {
        mode: "normal",
        paymentMethod: "nakit",
        received: cartTotals.total,
      };
      showSuccess("Nakit ödeme işlemi başlatıldı...");
      await handlePaymentComplete(paymentResult);
      showSuccess("Nakit ödeme başarıyla tamamlandı");
    } catch (error) {
      console.error("Hızlı nakit ödeme hatası:", error);
      showError("Ödeme işlemi sırasında bir hata oluştu");
    }
  };

  // Hızlı Kart Ödeme
  const handleQuickCardPayment = async () => {
    if (!activeTab?.cart.length) {
      showError("Sepet boş! Ödeme yapılamaz");
      return;
    }
    if (!isRegisterOpen) {
      showError("Kasa henüz açılmadı! Lütfen önce kasayı açın.");
      return;
    }

    try {
      const isManualMode = await posService.isManualMode();
      if (!isManualMode) {
        showSuccess("Kredi kartı işlemi başlatılıyor...");
        const connected = await posService.connect("Ingenico");
        if (!connected) {
          showError("POS cihazına bağlanılamadı!");
          return;
        }
        const result = await posService.processPayment(cartTotals.total);
        await posService.disconnect();
        if (!result.success) {
          showError(result.message);
          return;
        }
      }

      const paymentResult: PaymentResult = {
        mode: "normal",
        paymentMethod: "kart",
        received: cartTotals.total,
      };

      await handlePaymentComplete(paymentResult);
      showSuccess("Kredi kartı ile ödeme başarıyla tamamlandı");
    } catch (error) {
      console.error("Hızlı kredi kartı ödeme hatası:", error);
      showError("Ödeme işlemi sırasında bir hata oluştu");
    }
  };

  // Hotkeys
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

  // Çoklu ürün ekleme
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

  // Grup filtre
  const finalFilteredProducts = useMemo(() => {
    const defaultGroup = productGroups.find((g) => g.isDefault);

    // Varsayılan grupta => filteredProducts'ı olduğu gibi göster
    if (defaultGroup && activeGroupId === defaultGroup.id) {
      return filteredProducts;
    }

    // Diğer gruplarda => o gruba ait productIds'e sahip ürünleri göster
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
  // Ödeme tamamlandığında
  const handlePaymentComplete = async (paymentResult: PaymentResult) => {
    if (!activeTab) return;
    const { subtotal, vatAmount, total } = cartTotals;

    let paymentMethodForSale: PaymentMethod = "nakit";
    let cashReceived: number | undefined;
    let splitDetails: Sale["splitDetails"] | undefined = undefined;

    // İndirim bilgisini al
    const discount = paymentResult.discount;

    // Toplam tutarları belirle (indirimli veya indirimsiz)
    let finalTotal = total;
    let originalTotal: number | undefined = undefined;

    // Eğer indirim uygulanmışsa
    if (discount) {
      finalTotal = discount.discountedTotal; // indirimli tutar
      originalTotal = total; // orijinal tutar (indirimsiz)
      console.log("İndirim uygulandı:", {
        originalTotal,
        finalTotal,
        discountType: discount.type,
        discountValue: discount.value,
      });
    }

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
      total: finalTotal, // İndirimli tutar
      originalTotal, // İndirimsiz tutar (indirim varsa)
      discount, // İndirim bilgisi
      paymentMethod: paymentMethodForSale,
      cashReceived,
      changeAmount:
        paymentResult.mode === "normal" &&
        (paymentResult.paymentMethod === "nakit" ||
          paymentResult.paymentMethod === "nakitpos")
          ? (cashReceived || 0) - finalTotal // Para üstü hesaplaması indirimli tutara göre
          : undefined,
      date: new Date(),
      status: "completed",
      receiptNo: salesDB.generateReceiptNo(),
      splitDetails,
    };

    try {
      const newSale = await salesDB.addSale(saleData);

      // Kasa entegrasyonu
      try {
        const activeSession = await cashRegisterService.getActiveSession();
        if (activeSession) {
          if (paymentResult.mode === "normal") {
            if (paymentResult.paymentMethod === "nakit") {
              await cashRegisterService.recordSale(finalTotal, 0); // İndirimli tutar
            } else if (paymentResult.paymentMethod === "kart") {
              await cashRegisterService.recordSale(0, finalTotal); // İndirimli tutar
            } else if (paymentResult.paymentMethod === "nakitpos") {
              await cashRegisterService.recordSale(finalTotal, 0); // İndirimli tutar
            }
            // veresiye kasayı etkilemez
          } else {
            // split
            let totalCash = 0;
            let totalCard = 0;
            if (paymentResult.productPayments) {
              for (const payment of paymentResult.productPayments) {
                if (
                  payment.paymentMethod === "nakit" ||
                  payment.paymentMethod === "nakitpos"
                ) {
                  totalCash += payment.received;
                } else if (payment.paymentMethod === "kart") {
                  totalCard += payment.received;
                }
              }
            }
            if (paymentResult.equalPayments) {
              for (let i = 0; i < paymentResult.equalPayments.length; i++) {
                const eq = paymentResult.equalPayments[i];
                if (
                  eq.paymentMethod === "nakit" ||
                  eq.paymentMethod === "nakitpos"
                ) {
                  totalCash += eq.received;
                } else if (eq.paymentMethod === "kart") {
                  totalCard += eq.received;
                }
              }
            }
            await cashRegisterService.recordSale(totalCash, totalCard);
          }
        } else {
          console.warn(
            "Satış yapıldı, ancak kasa kapalı görüldü. Kasa kaydı güncellenmedi."
          );
        }
      } catch (cashError) {
        console.error("Kasa kaydı güncellenirken hata:", cashError);
        // Ana satış tamamlandı. Kasa hatası ekrana yansıtıp yansıtmayacağımıza siz karar verin.
      }

      // Veresiye
      if (paymentResult.mode === "normal") {
        if (paymentResult.paymentMethod === "veresiye" && selectedCustomer) {
          await creditService.addTransaction({
            customerId: selectedCustomer.id,
            type: "debt",
            amount: finalTotal, // İndirimli tutar
            date: new Date(),
            description: `Fiş No: ${newSale.receiptNo}`,
          });
        }
      } else {
        // productPayments
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
        // equalPayments
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

      clearCart();
      setSelectedCustomer(null);
      setShowPaymentModal(false);

      showSuccess(`Satış başarıyla tamamlandı! Fiş No: ${newSale.receiptNo}`);

      // (İsteğe bağlı) Kasa durumunu tekrar sorgulayabilirsiniz:
      const activeAgain = await cashRegisterService.getActiveSession();
      setIsRegisterOpen(!!activeAgain);
    } catch (error) {
      console.error("Satış kaydedilirken hata:", error);
      showError("Satış sırasında bir hata oluştu!");
    }
  };

  return (
    <PageLayout>
      <div className="flex h-[calc(85vh)] gap-6">
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
                        ? "bg-indigo-50 text-indigo-600"
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
                          ? "bg-indigo-50 text-indigo-600"
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
            onAddGroup={handleAddGroup}
            onRenameGroup={renameGroup}
            onDeleteGroup={async (gid) => {
              const c = await confirm(
                "Bu grubu silmek istediğinize emin misiniz?"
              );
              if (!c) return;
              try {
                await productService.deleteProductGroup(gid);
                await refreshGroups();

                // Silinen grup aktif grupsa, varsayılan gruba dön
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
            {/* Gruba Ürün Ekle butonu (varsayılan değilse) */}
            {activeGroupId !== 0 &&
              !productGroups.find((g) => g.id === activeGroupId)?.isDefault && (
                <div className="mb-4">
                  <button
                    onClick={() => setShowSelectProductsModal(true)}
                    className="w-full py-2 px-4 bg-indigo-50 text-indigo-600 flex items-center justify-center gap-2 rounded-lg hover:bg-indigo-100 transition-colors"
                  >
                    <Plus size={18} />
                    Gruba Ürün Ekle
                  </button>
                </div>
              )}

            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
              {finalFilteredProducts.map((product) => (
                <Card
                  key={product.id}
                  variant="product"
                  title={product.name}
                  imageUrl={product.imageUrl}
                  category={product.category}
                  price={formatCurrency(product.priceWithVat)}
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
                  size="small"
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
                      ? "bg-indigo-50 text-indigo-600"
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
              className="p-2 rounded-lg hover:bg-gray-50 text-indigo-600"
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
                    <span className="text-indigo-600">
                      {formatCurrency(cartTotals.total)}
                    </span>
                  </div>
                </div>

                {/* ÖDEME YAP BUTONU */}
                <Button
                  onClick={() => {
                    if (!isRegisterOpen) {
                      showError(
                        "Kasa henüz açılmadı! Lütfen önce kasayı açın."
                      );
                      return;
                    }
                    setShowPaymentModal(true);
                  }}
                  disabled={!activeTab.cart.length}
                  variant="primary"
                  icon={CreditCard}
                >
                  Ödeme Yap
                </Button>

                <div className="flex flex-row justify-between my-4">
                  <Button
                    className="mr-2 red"
                    onClick={() => {
                      if (!isRegisterOpen) {
                        showError(
                          "Kasa henüz açılmadı! Lütfen önce kasayı açın."
                        );
                        return;
                      }
                      handleQuickCashPayment();
                    }}
                    disabled={!activeTab.cart.length}
                    variant="primary"
                    icon={Banknote}
                  >
                    Hızlı Nakit
                  </Button>

                  <Button
                    className="ml-2"
                    onClick={() => {
                      if (!isRegisterOpen) {
                        showError(
                          "Kasa henüz açılmadı! Lütfen önce kasayı açın."
                        );
                        return;
                      }
                      handleQuickCardPayment();
                    }}
                    disabled={!activeTab.cart.length}
                    variant="primary"
                    icon={CreditCard}
                  >
                    Hızlı Kart
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Debug panel */}
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
                    if (products.length > 0) {
                      const firstProduct = products[0];
                      console.log("İlk ürün test ediliyor:", firstProduct);
                      if (firstProduct.barcode) {
                        handleBarcodeDetected(firstProduct.barcode);
                      } else {
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
                    if (products.length > 0) {
                      const firstProduct = products[0];
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
                quantity: item.quantity,
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

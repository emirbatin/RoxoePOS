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

  // Görünüm tercihlerini localStorage'dan yükle ve kaydet
  const [compactCartView, setCompactCartView] = useState<boolean>(() => {
    const saved = localStorage.getItem("compactCartView");
    return saved ? JSON.parse(saved) === true : false;
  });

  const [compactProductView, setCompactProductView] = useState<boolean>(() => {
    const saved = localStorage.getItem("compactProductView");
    return saved ? JSON.parse(saved) === true : false;
  });

  // Görünüm tercihlerini kaydet
  useEffect(() => {
    localStorage.setItem("compactCartView", JSON.stringify(compactCartView));
  }, [compactCartView]);

  useEffect(() => {
    localStorage.setItem(
      "compactProductView",
      JSON.stringify(compactProductView)
    );
  }, [compactProductView]);

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

  // YENİ: Yıldız modu görünürlüğü ve barkod tarama modu
  const [showQuantityModeToast, setShowQuantityModeToast] =
    useState<boolean>(false);
  const [barcodeScanMode, setBarcodeScanMode] = useState<boolean>(false);

  // YENİ: Sepet paneli yeniden boyutlandırma
  const [cartPanelWidth, setCartPanelWidth] = useState(() => {
    const savedWidth = localStorage.getItem("cartPanelWidth");
    return savedWidth ? parseInt(savedWidth, 10) : 320;
  }); // Başlangıç için daha küçük: 320
  const [isDragging, setIsDragging] = useState(false);
  const dragHandleRef = useRef<HTMLDivElement>(null);
  const MIN_CART_WIDTH = 250; // Minimum sepet genişliği (piksel)
  const MAX_CART_WIDTH = 600; // Maksimum sepet genişliği (piksel)

  // Mouse sürükleme işlemlerini yönetmek için event handler'ları ekleyin
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      // Sürükleme sırasında panel genişliğini hesapla
      // Ekranın sağ kenarından fare pozisyonunu çıkarıyoruz
      const newWidth = window.innerWidth - e.clientX;

      // Minimum ve maksimum sınırlar içinde kalmayı sağla
      const clampedWidth = Math.max(
        MIN_CART_WIDTH,
        Math.min(MAX_CART_WIDTH, newWidth)
      );

      setCartPanelWidth(clampedWidth);
      localStorage.setItem("cartPanelWidth", String(clampedWidth));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = "default";
      document.body.style.userSelect = "auto";
    };

    // Event listener'ları ekle ve temizle
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none"; // Sürükleme sırasında metin seçimini engelle
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  // Sürükleme işlemini başlatmak için handler
  const handleDragStart = () => {
    setIsDragging(true);
  };

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

  // Barkod algılama - YENİ GÜNCELLENMİŞ VERSİYON
  const handleBarcodeDetected = (barcode: string) => {
    console.log("🔍 Barkod algılandı:", barcode);
    
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
      console.log("✅ Eşleşen ürün bulundu:", matchingProduct.name, "ID:", matchingProduct.id);
      
      // Stok kontrol
      if (matchingProduct.stock <= 0) {
        console.log("❌ Ürün stokta yok!");
        showError(`${matchingProduct.name} stokta kalmadı!`);
        return;
      }
      
      // Aktif sepette BARKOD TARAMASI ile eklenen aynı ürün var mı?
      const existingBarcodeItem = activeTab?.cart.find(item => 
        item.id === matchingProduct!.id && item.source === 'barcode'
      );
      
      console.log("🛒 Sepette barkodla eklenmiş aynı ürün var mı?", 
        existingBarcodeItem 
          ? `EVET - Miktarı: ${existingBarcodeItem.quantity}` 
          : "HAYIR - Yeni eklenecek"
      );
      
      if (existingBarcodeItem) {
        // Eğer barkod ile eklenmiş aynı ürün varsa, stok kontrolü yap
        if (existingBarcodeItem.quantity + 1 > matchingProduct.stock) {
          console.log("⚠️ Stok yetersiz!", `Stokta ${matchingProduct.stock}, Sepette ${existingBarcodeItem.quantity}`);
          showError(`${matchingProduct.name} için stok yetersiz! Stokta ${matchingProduct.stock} adet var ve barkod ile eklenmiş ${existingBarcodeItem.quantity} adet mevcut.`);
          return;
        }
        
        console.log("📈 Barkodla eklenmiş ürünün miktarı artırılıyor:", 
          existingBarcodeItem.quantity, " -> ", existingBarcodeItem.quantity + 1);
        
        // Barkodla eklenmiş ürünün miktarını artır
        updateQuantity(existingBarcodeItem.id, 1);
        showSuccess(`${matchingProduct.name} miktarı güncellendi`);
        
        // Güncellenmiş sepeti göster
        setTimeout(() => {
          console.log("🧾 Güncellenmiş sepet:", activeTab?.cart.map(item => ({
            name: item.name,
            id: item.id,
            quantity: item.quantity,
            source: item.source || "bilinmiyor"
          })));
        }, 100);
        
        return;
      }
      
      // Yeni bir ürün olarak ekle, source olarak "barcode" işaretle
      const barcodeProduct = {
        ...matchingProduct,
        source: 'barcode', // Özel bir özellik ekle
      };
      
      console.log("➕ Barkod ile sepete YENİ ürün ekleniyor:", barcodeProduct.name, "kaynak: barcode");
      addToCart(barcodeProduct);
      showSuccess(`${barcodeProduct.name} sepete eklendi`);
      
      // Güncellenmiş sepeti göster
      setTimeout(() => {
        console.log("🧾 Güncellenmiş sepet:", activeTab?.cart.map(item => ({
          name: item.name,
          id: item.id,
          quantity: item.quantity,
          source: item.source || "bilinmiyor"
        })));
      }, 100);
      
      return;
    }
  
    // 4) Kısmi eşleşme ara
    const partialMatches = products.filter(
      (p) =>
        p.barcode.includes(barcode) ||
        p.name.toLowerCase().includes(barcode.toLowerCase())
    );
  
    console.log("🔍 Kısmi eşleşme sayısı:", partialMatches.length);
  
    if (partialMatches.length === 1) {
      // Tek kısmi eşleşme
      const match = partialMatches[0];
      console.log("✅ Kısmi eşleşen ürün bulundu:", match.name, "ID:", match.id);
      
      if (match.stock <= 0) {
        console.log("❌ Ürün stokta yok!");
        showError(`${match.name} stokta kalmadı!`);
        return;
      }
      
      // Aktif sepette BARKOD TARAMASI ile eklenen aynı ürün var mı?
      const existingBarcodeItem = activeTab?.cart.find(item => 
        item.id === match.id && item.source === 'barcode'
      );
      
      console.log("🛒 Sepette barkodla eklenmiş aynı ürün var mı?", 
        existingBarcodeItem 
          ? `EVET - Miktarı: ${existingBarcodeItem.quantity}` 
          : "HAYIR - Yeni eklenecek"
      );
      
      if (existingBarcodeItem) {
        // Eğer barkod ile eklenmiş aynı ürün varsa, stok kontrolü yap
        if (existingBarcodeItem.quantity + 1 > match.stock) {
          console.log("⚠️ Stok yetersiz!", `Stokta ${match.stock}, Sepette ${existingBarcodeItem.quantity}`);
          showError(`${match.name} için stok yetersiz! Stokta ${match.stock} adet var ve barkod ile eklenmiş ${existingBarcodeItem.quantity} adet mevcut.`);
          return;
        }
        
        console.log("📈 Barkodla eklenmiş ürünün miktarı artırılıyor:", 
          existingBarcodeItem.quantity, " -> ", existingBarcodeItem.quantity + 1);
        
        // Barkodla eklenmiş ürünün miktarını artır
        updateQuantity(existingBarcodeItem.id, 1);
        showSuccess(`${match.name} miktarı güncellendi`);
        
        // Güncellenmiş sepeti göster
        setTimeout(() => {
          console.log("🧾 Güncellenmiş sepet:", activeTab?.cart.map(item => ({
            name: item.name,
            id: item.id,
            quantity: item.quantity,
            source: item.source || "bilinmiyor"
          })));
        }, 100);
        
        return;
      }
      
      // Yeni bir ürün olarak ekle
      const barcodeProduct = {
        ...match,
        source: 'barcode',
      };
      
      console.log("➕ Kısmi eşleşen ürün sepete YENİ ekleniyor:", barcodeProduct.name, "kaynak: barcode");
      addToCart(barcodeProduct);
      showSuccess(`${match.name} sepete eklendi`);
      
      // Güncellenmiş sepeti göster
      setTimeout(() => {
        console.log("🧾 Güncellenmiş sepet:", activeTab?.cart.map(item => ({
          name: item.name,
          id: item.id,
          quantity: item.quantity,
          source: item.source || "bilinmiyor"
        })));
      }, 100);
    } else if (partialMatches.length > 1) {
      // Birden çok kısmi eşleşme ⇒ arama terimi
      console.log("ℹ️ Birden çok eşleşme bulundu, arama terimini güncelliyorum:", barcode);
      setSearchTerm(barcode);
    } else {
      // Hiç eşleşme yok
      console.log("❓ Hiç eşleşme bulunamadı, arama terimini güncelliyorum:", barcode);
      setSearchTerm(barcode);
    }
  };

  // YENİ: SearchFilterPanel için tarama modu değişikliği yönetimi
  const handleSearchPanelModeChange = (isScanMode: boolean) => {
    setBarcodeScanMode(isScanMode);

    // Barkod tarama modu aktifleştiğinde yıldız modunu devre dışı bırak
    if (isScanMode && quantityMode) {
      resetQuantityMode();
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
      //showSuccess("Nakit ödeme işlemi başlatıldı...");
      await handlePaymentComplete(paymentResult);
      //showSuccess("Nakit ödeme başarıyla tamamlandı");
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
      //showSuccess("Kredi kartı ile ödeme başarıyla tamamlandı");
    } catch (error) {
      console.error("Hızlı kredi kartı ödeme hatası:", error);
      showError("Ödeme işlemi sırasında bir hata oluştu");
    }
  };

  // Hotkeys - GÜNCELLENDİ
  const { quantityMode, tempQuantity, resetQuantityMode } = useHotkeys({
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
      if (!activeTab?.cart.length) {
        showError("Sepet boş! Miktar güncellenemez.");
        return;
      }

      const lastItem = activeTab.cart[activeTab.cart.length - 1];

      if (newQuantity > lastItem.stock) {
        showError(`Stokta sadece ${lastItem.stock} adet ${lastItem.name} var.`);
        return;
      }

      updateQuantity(lastItem.id, newQuantity - lastItem.quantity);
      showSuccess(`${lastItem.name} miktarı ${newQuantity} olarak güncellendi`);
    },
    shouldHandleEvent: (event) => {
      // Barkod tarama modu aktifse, kısayol işlemeyi devre dışı bırak
      if (barcodeScanMode) {
        return false;
      }

      // Diğer durumlarda işlemeye devam et
      return true;
    },
  });

  // YENİ: Yıldız modunu izle ve toast görünümünü kontrol et
  useEffect(() => {
    if (quantityMode) {
      setShowQuantityModeToast(true);
    } else {
      // Yıldız modu kapandığında 0.5 saniye sonra toast'u kapat
      const timeout = setTimeout(() => {
        setShowQuantityModeToast(false);
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [quantityMode]);

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

      products.forEach((product) => {
        const cartItem = activeTab.cart.find((item) => item.id === product.id);
        if (cartItem) {
          product.stock -= cartItem.quantity;
        }
      });

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
      {/* YENİ: Sepeti yeniden boyutlandırılabilir yapı için değiştirildi */}
      <div className="flex h-[calc(90vh)] relative">
        {/* Sol Panel */}
        <div className="flex-1 flex flex-col bg-white rounded-lg shadow-sm overflow-hidden h-full mr-2">
          {/* Arama & Filtre - YENİ: inputId ve onScanModeChange eklendi */}
          <div className="p-3 border-b">
            <SearchFilterPanel
              searchTerm={searchTerm}
              onSearchTermChange={setSearchTerm}
              onReset={resetFilters}
              showFilter={showFilters}
              toggleFilter={() => setShowFilters((prev) => !prev)}
              inputRef={searchInputRef}
              onBarcodeDetected={handleBarcodeDetected}
              inputActive={document.activeElement === searchInputRef.current}
              onScanModeChange={handleSearchPanelModeChange}
              inputId="searchInput"
              quantityModeActive={quantityMode}
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
            viewToggleIcon={
              <button
                onClick={() => setCompactProductView(!compactProductView)}
                className={`p-1.5 rounded-lg ${
                  compactProductView
                    ? "bg-indigo-50 text-indigo-600"
                    : "text-gray-500 hover:bg-gray-50"
                }`}
                title={compactProductView ? "Kart Görünümü" : "Liste Görünümü"}
              >
                {compactProductView ? (
                  // Grid ikonu
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                  </svg>
                ) : (
                  // Liste ikonu
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="8" y1="6" x2="21" y2="6" />
                    <line x1="8" y1="12" x2="21" y2="12" />
                    <line x1="8" y1="18" x2="21" y2="18" />
                    <line x1="3" y1="6" x2="3.01" y2="6" />
                    <line x1="3" y1="12" x2="3.01" y2="12" />
                    <line x1="3" y1="18" x2="3.01" y2="18" />
                  </svg>
                )}
              </button>
            }
          />
          {/* Ürün Grid / Liste */}
          <div className="flex-1 p-3 overflow-y-auto">
            {/* Ürün listesi başlık ve filtreler */}
            <div className="flex justify-between items-center mb-2">
              {/* Sol taraf: Aktif grup adı ve bilgisi */}
              <div className="text-gray-700 font-normal">
                {productGroups.find((g) => g.id === activeGroupId)?.name ||
                  "Tüm Ürünler"}
                <span className="ml-2 text-sm text-gray-500">
                  ({finalFilteredProducts.length} ürün)
                </span>
              </div>

              {/* Sağ taraf: Butonlar */}
              <div className="flex items-center gap-2">
                {/* Gruba Ürün Ekle butonu - Daha kompakt ve şık */}
                {activeGroupId !== 0 &&
                  !productGroups.find((g) => g.id === activeGroupId)
                    ?.isDefault && (
                    <button
                      onClick={() => setShowSelectProductsModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors text-sm"
                    >
                      <Plus size={16} />
                      <span>Gruba Ekle</span>
                    </button>
                  )}
              </div>
            </div>

            {/* Ürün Listesi - Kompakt veya Kart Görünümü */}
            {compactProductView ? (
              // Liste Görünümü
              <div className="border rounded-lg overflow-hidden">
                {finalFilteredProducts.length === 0 ? (
                  <div className="py-8 text-center text-gray-500">
                    <p>Ürün bulunamadı</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {finalFilteredProducts.map((product) => (
                      <div
                        key={product.id}
                        className={`flex items-center px-3 py-2 hover:bg-indigo-50 transition-colors cursor-pointer ${
                          product.stock === 0 ? "opacity-50" : ""
                        }`}
                        onClick={() => {
                          if (product.stock > 0) {
                            const manualProduct = {
                              ...product,
                              source: "manual",
                            };
                            addToCart(manualProduct);
                          }
                        }}
                      >
                        {/* Ürün Resmi */}
                        <div className="w-12 h-12 flex-shrink-0 mr-3 bg-gray-50 rounded-md overflow-hidden border border-gray-100">
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="w-full h-full object-"
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="text-gray-300"
                              >
                                <rect
                                  width="18"
                                  height="18"
                                  x="3"
                                  y="3"
                                  rx="2"
                                  ry="2"
                                />
                                <circle cx="9" cy="9" r="2" />
                                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                              </svg>
                            </div>
                          )}
                        </div>

                        {/* Ürün İsmi ve Kategori */}
                        <div className="flex-1 min-w-0 mr-2">
                          <div className="font-medium text-gray-900 truncate">
                            {product.name}
                          </div>
                          <div className="text-xs text-gray-500 flex items-center">
                            {product.category && (
                              <span className="inline-flex items-center gap-1 mr-2">
                                <span className="w-2 h-2 bg-indigo-400 rounded-full"></span>
                                {product.category}
                              </span>
                            )}
                            <span
                              className={`inline-flex items-center gap-0.5 ${
                                product.stock === 0
                                  ? "text-red-500"
                                  : product.stock < 5
                                  ? "text-orange-500"
                                  : "text-gray-500"
                              }`}
                            >
                              <span>Stok: {product.stock}</span>
                              {product.stock < 5 && product.stock > 0 && (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="10"
                                  height="10"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  className="text-orange-500"
                                >
                                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                                  <path d="M12 9v4" />
                                  <path d="M12 17h.01" />
                                </svg>
                              )}
                            </span>
                          </div>
                        </div>

                        {/* Stok ve Fiyat */}
                        <div className="flex flex-col items-end mr-3">
                          <div className="text-indigo-600 font-medium">
                            {formatCurrency(product.priceWithVat)}
                          </div>
                        </div>

                        {/* Sepete Ekle Butonu */}
                        <button
                          className={`p-1.5 rounded-full ${
                            product.stock > 0
                              ? "bg-indigo-100 text-indigo-600 hover:bg-indigo-200"
                              : "bg-gray-100 text-gray-400 cursor-not-allowed"
                          }`}
                          disabled={product.stock === 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (product.stock > 0) {
                              const manualProduct = {
                                ...product,
                                source: "manual",
                              };
                              addToCart(manualProduct);
                            }
                          }}
                          title={
                            product.stock > 0 ? "Sepete Ekle" : "Stokta Yok"
                          }
                        >
                          <Plus size={16} />
                        </button>

                        {/* Grup Ekle/Çıkar Butonları */}
                        {!productGroups.find((g) => g.id === activeGroupId)
                          ?.isDefault && (
                          <div className="ml-2">
                            {!productGroups
                              .find((g) => g.id === activeGroupId)
                              ?.productIds?.includes(product.id) ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  addProductToGroup(activeGroupId, product.id);
                                }}
                                className="p-1 text-green-600 hover:bg-green-50 rounded-full"
                                title="Gruba Ekle"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
                                  <path d="M12 8v8" />
                                  <path d="M8 12h8" />
                                </svg>
                              </button>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeProductFromGroup(
                                    activeGroupId,
                                    product.id
                                  );
                                }}
                                className="p-1 text-red-500 hover:bg-red-50 rounded-full"
                                title="Gruptan Çıkar"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
                                  <path d="M8 12h8" />
                                </svg>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              // Kart Görünümü (Orijinal)
              <div className="grid xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-2">
                {finalFilteredProducts.map((product) => (
                  <Card
                    key={product.id}
                    variant="product"
                    title={product.name}
                    imageUrl={product.imageUrl}
                    category={product.category}
                    price={formatCurrency(product.priceWithVat)}
                    stock={product.stock}
                    onClick={() => {
                      if (product.stock > 0) {
                        const manualProduct = {
                          ...product,
                          source: "manual",
                        };
                        addToCart(manualProduct);
                      }
                    }}
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
                        ? () =>
                            removeProductFromGroup(activeGroupId, product.id)
                        : undefined
                    }
                    size="small"
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* YENİ: Sürükleme Kolu */}
        <div
          ref={dragHandleRef}
          className="absolute top-0 bottom-0 w-6 cursor-col-resize flex items-center justify-center z-10"
          style={{
            left: `calc(100% - ${cartPanelWidth}px - 12px)`,
            borderRadius: "4px",
          }}
          onMouseDown={handleDragStart}
        >
          <div className="h-16 w-1 bg-gray-300 rounded-full hover:bg-indigo-400 transition-colors"></div>
        </div>

        {/* YENİ: Yeniden boyutlandırılabilir Sepet Paneli */}
        <div
          className="bg-white rounded-lg shadow-sm flex flex-col h-full"
          style={{ width: `${cartPanelWidth}px` }}
        >
          {/* Sepet Sekmeleri */}
          <div className="flex items-center justify-between p-3 border-b overflow-x-auto">
            <div className="flex items-center gap-2 overflow-x-auto">
              {cartTabs.map((tab) => {
                const itemCount = tab.cart.reduce(
                  (sum, i) => sum + i.quantity,
                  0
                );
                return (
                  <div
                    key={tab.id}
                    className={`group flex items-center gap-1 px-2 py-1 rounded-lg cursor-pointer ${
                      activeTabId === tab.id
                        ? "bg-indigo-50 text-indigo-600"
                        : "hover:bg-gray-50"
                    }`}
                    onClick={() => setActiveTabId(tab.id)}
                  >
                    <ShoppingCart size={14} />
                    <span className="truncate max-w-[60px]">{tab.title}</span>
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
                        <X size={12} className="text-red-500" />
                      </button>
                    )}
                  </div>
                );
              })}
              <button
                onClick={addNewTab}
                className="p-1 rounded-lg hover:bg-gray-50 text-indigo-600"
                title="Yeni Sepet"
              >
                <Plus size={18} />
              </button>
            </div>

            {/* Kompakt görünüm butonu */}
            <button
              onClick={() => setCompactCartView(!compactCartView)}
              className={`p-1 rounded-lg ${
                compactCartView
                  ? "bg-indigo-50 text-indigo-600"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
              title={compactCartView ? "Normal Görünüm" : "Kompakt Görünüm"}
            >
              {compactCartView ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect width="18" height="18" x="3" y="3" rx="2" />
                  <path d="M8 16h.01" />
                  <path d="M12 16h.01" />
                  <path d="M16 16h.01" />
                  <path d="M8 12h.01" />
                  <path d="M12 12h.01" />
                  <path d="M16 12h.01" />
                  <path d="M8 8h.01" />
                  <path d="M12 8h.01" />
                  <path d="M16 8h.01" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              )}
            </button>
          </div>

          {/* Aktif Sepet İçeriği */}
          {activeTab && (
            <>
              <div className="p-3 border-b">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                    <ShoppingCart size={18} />
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
                      className="text-red-500 hover:text-red-600 p-1"
                      title="Sepeti Temizle"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>

              {/* Sepet Öğeleri */}
              <div className="flex-1 overflow-y-auto">
                {activeTab.cart.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    <ShoppingCart
                      size={40}
                      className="mx-auto mb-2 opacity-50"
                    />
                    <p>Sepet boş</p>
                  </div>
                ) : compactCartView ? (
                  // Kompakt Görünüm
                  <div className="py-1">
                    {activeTab.cart.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center px-2 py-1 hover:bg-gray-50"
                      >
                        <div className="flex-1 mr-1 truncate">
                          <div className="font-medium text-sm truncate">
                            {item.name}
                          </div>
                        </div>
                        <div className="text-gray-900 text-sm font-medium whitespace-nowrap">
                          {formatCurrency(item.totalWithVat || 0)}
                        </div>
                        <div className="flex items-center ml-1">
                          <button
                            onClick={() => updateQuantity(item.id, -1)}
                            className="p-0.5 hover:bg-gray-200 rounded"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="w-6 text-center text-sm">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.id, 1)}
                            className="p-0.5 hover:bg-gray-200 rounded"
                          >
                            <Plus size={14} />
                          </button>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="p-0.5 hover:bg-gray-200 rounded text-red-500 ml-1"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  // Normal Görünüm
                  <div className="p-3">
                    {activeTab.cart.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 py-2 border-b last:border-0"
                      >
                        <div className="flex-1">
                          <div className="font-medium">{item.name}</div>
                          <div className="text-sm space-y-0.5">
                            <div className="text-gray-900 font-normal">
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
                          <span className="w-8 text-center">
                            {item.quantity}
                          </span>
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
                )}
              </div>

              {/* Toplam & Ödeme */}
              <div className="border-t p-3">
                <div className="space-y-2 mb-3">
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

                <div className="flex flex-row justify-between mt-3">
                  <Button
                    className="mr-1"
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
                    variant="cash"
                    icon={Banknote}
                  >
                    {compactCartView ? "Hızlı Nakit" : "Hızlı Nakit"}
                  </Button>

                  <Button
                    className="ml-1"
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
                    variant="card"
                    icon={CreditCard}
                  >
                    {compactCartView ? "Hızlı Kart" : "Hızlı Kart"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Debug panel */}
      {process.env.NODE_ENV === "development" && (
        <div className="fixed bottom-4 left-4 z-50">
          <div className="bg-white p-4 rounded-lg shadow-lg border space-y-3">
            <h3 className="font-bold">Barkod Test Araçları</h3>

            <div className="flex gap-3">
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
                      const manualProduct = {
                        ...firstProduct,
                        source: "manual",
                      };
                      addToCart(manualProduct);
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

      {/* YENİ: İyileştirilmiş Yıldız Modu Göstergesi */}
      {showQuantityModeToast && (
        <div
          className={`fixed top-4 right-4 bg-indigo-600 text-white p-3 rounded-lg shadow-lg z-50 transition-all duration-300 ease-in-out ${
            quantityMode
              ? "opacity-100 translate-y-0"
              : "opacity-0 -translate-y-4"
          }`}
        >
          <div className="font-bold text-center mb-1">Yıldız Modu Aktif</div>
          <div className="text-2xl text-center font-mono">
            {tempQuantity || "0"}
          </div>
          <div className="text-xs text-center mt-1">
            Enter ile onaylayın, ESC ile iptal edin
          </div>
        </div>
      )}

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

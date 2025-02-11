// POSPage.tsx
import React, { useState, useRef, useEffect, useMemo } from "react";
import { ShoppingCart, Plus, Minus, X, CreditCard, Trash2 } from "lucide-react";
import { useHotkeys, HotkeysHelper } from "../hooks/useHotkeys";
import { CartItem, CartTab, PaymentMethod, PaymentResult } from "../types/pos";
import { Category, Product } from "../types/product";
import { ReceiptInfo } from "../types/receipt";
import { Customer } from "../types/credit";
import { ProductGroup, productService } from "../services/productDB";
import {
  calculateCartTotals,
  calculateCartItemTotals,
  formatCurrency,
  formatVatRate,
} from "../utils/vatUtils";
import PaymentModal from "../components/modals/PaymentModal";
import ReceiptModal from "../components/modals/ReceiptModal";
import Button from "../components/ui/Button";
import { salesDB } from "../services/salesDB";
import { creditService } from "../services/creditServices";
import { Sale } from "../types/sales";
import { BarcodeConfig } from "../types/barcode";
import { useAlert } from "../components/AlertProvider";
import PageLayout from "../components/layout/PageLayout";
import SearchFilterPanel from "../components/SearchFilterPanel";
import Card from "../components/ui/Card";
import { useProductGroups } from "../hooks/useProductGroups";
import AddProductToGroupCard from "../components/AddProductToGroupCard";
import ProductGroupTabs from "../components/ProductGroupTabs";
import SelectProductsModal from "../components/modals/SelectProductModal";

const POSPage: React.FC = () => {
  // Temel state'ler
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Tümü");
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);
  const [currentReceipt, setCurrentReceipt] = useState<ReceiptInfo | null>(
    null
  );
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [showHotkeysHelper, setShowHotkeysHelper] = useState<boolean>(true);
  const [barcodeConfig] = useState<BarcodeConfig>(() => {
    const saved = localStorage.getItem("barcodeConfig");
    return saved ? JSON.parse(saved) : { enabled: true, suffix: "\n" };
  });

  const { showError, showSuccess, confirm } = useAlert();

  const [showFilters, setShowFilters] = useState(false);

  const [showSelectProductsModal, setShowSelectProductsModal] = useState(false);

  const {
    groups: productGroups,
    loading: groupsLoading,
    addGroup,
    renameGroup,
    addProductToGroup,
    removeProductFromGroup,
    refreshGroups,
  } = useProductGroups();

  const [activeGroupId, setActiveGroupId] = useState<number>(1);

  // Sepet sekmeleri için state'ler
  const [cartTabs, setCartTabs] = useState<CartTab[]>([
    { id: "1", cart: [], title: "Sepet 1" },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>("1");

  const searchInputRef = useRef<HTMLInputElement>(null);
  const activeTab = cartTabs.find((tab) => tab.id === activeTabId);

  // Veri yükleme
  useEffect(() => {
    const loadData = async () => {
      try {
        const dbProducts = await productService.getAllProducts();
        const dbCategories = await productService.getCategories();
        const dbCustomers = await creditService.getAllCustomers();
        setProducts(dbProducts);
        setCategories(dbCategories);
        setCustomers(dbCustomers);
      } catch (error) {
        console.error("Veri yüklenirken hata:", error);
      }
    };
    loadData();
  }, []);

  // useEffect güncellemesi
  useEffect(() => {
    const loadData = async () => {
      try {
        const [dbProducts, dbCategories, dbCustomers] = await Promise.all([
          productService.getAllProducts(),
          productService.getCategories(),
          creditService.getAllCustomers(),
        ]);
        setProducts(dbProducts);
        setCategories(dbCategories);
        setCustomers(dbCustomers);
      } catch (error) {
        console.error("Veri yüklenirken hata:", error);
      }
    };
    loadData();
  }, []);

  // Grup işlemleri için fonksiyonlar
  const handleAddGroup = async () => {
    try {
      const newGroup = await addGroup("Yeni Grup");
      setActiveGroupId(newGroup.id);
    } catch (error) {
      console.error("Grup eklenirken hata:", error);
    }
  };

  const handleAddMultipleProducts = async (productIds: number[]) => {
    if (activeGroupId === 1) return; // Varsayılan gruba ekleme yapılamaz

    try {
      // Seçilen tüm ürünleri gruba ekle
      await Promise.all(
        productIds.map((productId) =>
          productService.addProductToGroup(activeGroupId, productId)
        )
      );

      // Grupları yenile
      await refreshGroups();

      showSuccess("Ürünler gruba eklendi");
    } catch (error) {
      showError("Ürünler eklenirken bir hata oluştu");
    }
  };

  const handleRenameGroup = async (groupId: number, newName: string) => {
    try {
      await renameGroup(groupId, newName);
    } catch (error) {
      console.error("Grup adı değiştirilirken hata:", error);
    }
  };

  const handleAddProductToGroup = async (productId: number) => {
    if (activeGroupId === 1) return; // Varsayılan gruba ekleme yapılamaz

    try {
      await addProductToGroup(activeGroupId, productId);
      showSuccess("Ürün gruba eklendi");
    } catch (error) {
      showError("Ürün eklenirken hata oluştu");
    }
  };

  const handleDeleteGroup = async (groupId: number) => {
    try {
      await confirm(
        "Bu grubu silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
      );
      await productService.deleteProductGroup(groupId);
      await refreshGroups();
      if (activeGroupId === groupId) {
        setActiveGroupId(1); // Varsayılan gruba dön
      }
      showSuccess("Grup başarıyla silindi");
    } catch (error) {
      showError("Grup silinirken bir hata oluştu");
    }
  };

  const handleRemoveProductFromGroup = async (productId: number) => {
    if (activeGroupId === 1) return;

    try {
      await removeProductFromGroup(activeGroupId, productId);
      showSuccess("Ürün gruptan çıkarıldı");
    } catch (error) {
      showError("Ürün çıkarılırken hata oluştu");
    }
  };

  // Sepet sekmesi işlemleri
  const addNewTab = () => {
    const newId = (
      Math.max(...cartTabs.map((tab) => parseInt(tab.id))) + 1
    ).toString();
    setCartTabs((prev: CartTab[]) => [
      ...prev,
      { id: newId, cart: [], title: `Sepet ${newId}` },
    ]);
    setActiveTabId(newId);
  };

  const removeTab = (tabId: string) => {
    if (cartTabs.length === 1) return;
    setCartTabs((prev: CartTab[]) => prev.filter((tab) => tab.id !== tabId));
    if (activeTabId === tabId) {
      setActiveTabId(cartTabs[0].id);
    }
  };

  const cartTotals = activeTab
    ? calculateCartTotals(activeTab.cart)
    : { subtotal: 0, vatAmount: 0, total: 0, vatBreakdown: [] };

  const clearCart = async (): Promise<void> => {
    if (!activeTab || activeTab.cart.length === 0) return;
    const confirmed = await confirm(
      "Sepeti temizlemek istediğinize emin misiniz?"
    );
    if (confirmed) {
      setCartTabs((prev: CartTab[]) =>
        prev.map((tab) => (tab.id === activeTabId ? { ...tab, cart: [] } : tab))
      );
    }
  };

  const startNewSale = async (): Promise<void> => {
    if (!activeTab?.cart.length) {
      searchInputRef.current?.focus();
      return;
    }
    const confirmed = await confirm(
      "Mevcut satışı iptal edip yeni satış başlatmak istiyor musunuz?"
    );
    if (confirmed) {
      setCartTabs((prev: CartTab[]) =>
        prev.map((tab) => (tab.id === activeTabId ? { ...tab, cart: [] } : tab))
      );
      setSearchQuery("");
      searchInputRef.current?.focus();
    }
  };

  // Barkod arama işlemi
  const handleBarcodeSearch = async (): Promise<void> => {
    if (searchQuery) {
      const product = products.find((p) => p.barcode === searchQuery);
      if (product) {
        addToCart(product);
        setSearchQuery("");
      }
    }
  };

  const addToCart = async (product: Product): Promise<void> => {
    if (product.stock === 0) return;
    setCartTabs((prev: CartTab[]) =>
      prev.map((tab) => {
        if (tab.id !== activeTabId) return tab;
        const existingItem = tab.cart.find((item) => item.id === product.id);
        if (existingItem) {
          if (existingItem.quantity >= product.stock) return tab;
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
        }
        return {
          ...tab,
          cart: [
            ...tab.cart,
            {
              ...product,
              quantity: 1,
              totalWithVat: product.priceWithVat,
              total: product.salePrice,
            },
          ],
        };
      })
    );
  };

  const updateQuantity = (productId: number, change: number): void => {
    setCartTabs((prev: CartTab[]) =>
      prev.map((tab) => {
        if (tab.id !== activeTabId) return tab;
        const updatedCart = tab.cart.map((item) => {
          if (item.id !== productId) return item;
          const product = products.find((p) => p.id === productId);
          if (!product) return item;
          const newQuantity = item.quantity + change;
          if (newQuantity > product.stock || newQuantity <= 0) return item;
          return calculateCartItemTotals({ ...item, quantity: newQuantity });
        });
        return { ...tab, cart: updatedCart };
      })
    );
  };

  const removeFromCart = (productId: number): void => {
    setCartTabs((prev: CartTab[]) =>
      prev.map((tab) => {
        if (tab.id !== activeTabId) return tab;
        return {
          ...tab,
          cart: tab.cart.filter((item) => item.id !== productId),
        };
      })
    );
  };

  const updateStock = async (): Promise<void> => {
    if (!activeTab) return;
    try {
      for (const cartItem of activeTab.cart) {
        await productService.updateStock(cartItem.id, -cartItem.quantity);
      }
      const dbProducts = await productService.getAllProducts();
      setProducts(dbProducts);
    } catch (error) {
      console.error("Stok güncellenirken hata:", error);
    }
  };

  const handlePaymentComplete = async (paymentResult: PaymentResult) => {
    if (!activeTab) return;
    const subtotal = activeTab.cart.reduce(
      (acc, item) => acc + item.salePrice * item.quantity,
      0
    );
    const total = activeTab.cart.reduce(
      (acc, item) => acc + item.priceWithVat * item.quantity,
      0
    );
    const vatAmount = total - subtotal;
    let paymentMethodForSale: PaymentMethod = "nakit";
    let cashReceived: number | undefined;
    let splitDetails: Sale["splitDetails"] | undefined = undefined;
    if (paymentResult.mode === "normal") {
      paymentMethodForSale = paymentResult.paymentMethod;
      cashReceived = paymentResult.received;
    } else if (paymentResult.mode === "split") {
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
      status: "completed" as "completed",
      receiptNo: salesDB.generateReceiptNo(),
      splitDetails,
    };
    try {
      const newSale = await salesDB.addSale(saleData);
      console.log("Satış kaydedildi:", newSale);
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
      await updateStock();
      setCartTabs((prev: CartTab[]) =>
        prev.map((tab) => (tab.id === activeTabId ? { ...tab, cart: [] } : tab))
      );
      setSelectedCustomer(null);
      setShowPaymentModal(false);
      showSuccess(`Satış başarıyla tamamlandı! Fiş No: ${newSale.receiptNo}`);
    } catch (error) {
      console.error("Satış kaydedilirken hata:", error);
      showError("Satış sırasında bir hata oluştu!");
    }
  };

  const handleReceiptClose = (): void => {
    setShowReceiptModal(false);
  };

  const handleQuantityUpdate = (newQuantity: number) => {
    if (!activeTab?.cart.length) return;
    const lastItem = activeTab.cart[activeTab.cart.length - 1];
    updateQuantity(lastItem.id, newQuantity - lastItem.quantity);
  };

  useHotkeys({
    hotkeys: [
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
          if (activeTab && activeTab.cart.length > 0) setShowPaymentModal(true);
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
          setShowHotkeysHelper((prev: boolean) => !prev);
        },
      },
      {
        key: "t",
        ctrlKey: true,
        callback: (e?: KeyboardEvent) => {
          e?.preventDefault();
          addNewTab();
        },
      },
      {
        key: "w",
        ctrlKey: true,
        callback: (e?: KeyboardEvent) => {
          e?.preventDefault();
          if (cartTabs.length > 1) {
            removeTab(activeTabId);
          }
        },
      },
      {
        key: "Tab",
        ctrlKey: true,
        callback: (e?: KeyboardEvent) => {
          e?.preventDefault();
          const currentIndex = cartTabs.findIndex(
            (tab) => tab.id === activeTabId
          );
          const nextIndex = (currentIndex + 1) % cartTabs.length;
          setActiveTabId(cartTabs[nextIndex].id);
        },
      },
    ],
    onQuantityUpdate: handleQuantityUpdate,
  });

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.barcode.includes(searchQuery);
      const matchesCategory =
        selectedCategory === "Tümü" || product.category === selectedCategory;

      if (activeGroupId === 1) {
        // Varsayılan grup (Tümü)
        return matchesSearch && matchesCategory;
      } else {
        const activeGroup = productGroups.find((g) => g.id === activeGroupId);
        return (
          matchesSearch &&
          matchesCategory &&
          activeGroup?.productIds?.includes(product.id)
        );
      }
    });
  }, [products, searchQuery, selectedCategory, activeGroupId, productGroups]);

  useEffect(() => {
    if (!barcodeConfig.enabled) return;
    const handleBarcodeScan = (event: KeyboardEvent) => {
      if (event.key === barcodeConfig.suffix && searchQuery) {
        event.preventDefault();
        handleBarcodeSearch();
      }
    };
    window.addEventListener("keydown", handleBarcodeScan);
    return () => window.removeEventListener("keydown", handleBarcodeScan);
  }, [searchQuery, barcodeConfig]);

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const allCustomers = await creditService.getAllCustomers();
        setCustomers(allCustomers);
      } catch (error) {
        console.error("Müşteriler yüklenirken bir hata oluştu:", error);
      }
    };
    fetchCustomers();
  }, []);

  return (
    <PageLayout title="Satış">
      <div className="flex h-[calc(100vh-11rem)] gap-6">
        {/* Sol Panel - Ürün Arama ve Hızlı Erişim */}
        <div className="flex-1 flex flex-col bg-white rounded-lg shadow-sm overflow-hidden h-full">
          {/* Arama ve Filtre Alanı */}
          <div className="p-4 border-b">
            <SearchFilterPanel
              searchTerm={searchQuery}
              onSearchTermChange={setSearchQuery}
              onReset={() => {
                setSearchQuery("");
                setSelectedCategory("Tümü");
                setShowFilters(false);
              }}
              showFilter={showFilters}
              toggleFilter={() => setShowFilters((prev) => !prev)}
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
            onRenameGroup={handleRenameGroup}
            onDeleteGroup={handleDeleteGroup} // Yeni eklenen prop
          />

          {/* Ürün Grid */}
          <div className="flex-1 p-4 overflow-y-auto">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {/* Grup için Ürün Ekleme Kartı */}
              {activeGroupId !== 1 && (
                <Card
                  variant="addProduct"
                  onClick={() => setShowSelectProductsModal(true)}
                />
              )}
              {/* Ürün Kartları */}
              {filteredProducts.map((product) => (
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
                    activeGroupId !== 1 &&
                    !productGroups
                      .find((g) => g.id === activeGroupId)
                      ?.productIds?.includes(product.id)
                      ? () => handleAddProductToGroup(product.id)
                      : undefined
                  }
                  onRemoveFromGroup={
                    activeGroupId !== 1 &&
                    productGroups
                      .find((g) => g.id === activeGroupId)
                      ?.productIds?.includes(product.id)
                      ? () => handleRemoveProductFromGroup(product.id)
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
            {cartTabs.map((tab) => (
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
                  <span className="text-xs text-gray-500">
                    ({tab.cart.reduce((sum, item) => sum + item.quantity, 0)})
                  </span>
                </div>
                {cartTabs.length > 1 && (
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (tab.cart.length > 0) {
                        const confirmed = await confirm(
                          `${tab.title} sepetini silmek istediğinize emin misiniz?`
                        );
                        if (confirmed) {
                          removeTab(tab.id);
                        }
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
            ))}
            <button
              onClick={addNewTab}
              className="p-2 rounded-lg hover:bg-gray-50 text-primary-600"
              title="Yeni Sepet"
            >
              <Plus size={20} />
            </button>
          </div>

          {/* Aktif Sepet */}
          {activeTab && (
            <>
              <div className="p-4 border-b">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <ShoppingCart size={20} />
                    {activeTab.cart.reduce(
                      (sum, item) => sum + item.quantity,
                      0
                    )}{" "}
                    Ürün
                  </h2>
                  {activeTab.cart.length > 0 && (
                    <button
                      onClick={() => {
                        clearCart();
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

              {/* Toplam ve Ödeme */}
              <div className="border-t p-4">
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Ara Toplam:</span>
                    <span>
                      {formatCurrency(
                        calculateCartTotals(activeTab.cart).subtotal
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>KDV:</span>
                    <span>
                      {formatCurrency(
                        calculateCartTotals(activeTab.cart).vatAmount
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between font-semibold text-lg">
                    <span>Toplam:</span>
                    <span className="text-primary-600">
                      {formatCurrency(
                        calculateCartTotals(activeTab.cart).total
                      )}
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

        {/* Ödeme Modal */}
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          total={calculateCartTotals(activeTab?.cart || []).total}
          subtotal={calculateCartTotals(activeTab?.cart || []).subtotal}
          vatAmount={calculateCartTotals(activeTab?.cart || []).vatAmount}
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

        <SelectProductsModal
          isOpen={showSelectProductsModal}
          onClose={() => setShowSelectProductsModal(false)}
          onSelect={handleAddMultipleProducts}
          products={products}
          existingProductIds={
            productGroups.find((g) => g.id === activeGroupId)?.productIds || []
          }
        />

        {/* Klavye Kısayolları Yardımcısı */}
        <HotkeysHelper />
      </div>
    </PageLayout>
  );
};

export default POSPage;

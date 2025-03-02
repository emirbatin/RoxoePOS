// pages/ProductsPage.tsx

import React, { useState } from "react";
import {
  Plus,
  Tag,
  Edit,
  Trash2,
  AlertTriangle,
  Calculator,
  Package,
  Barcode,
} from "lucide-react";
import {
  calculatePriceWithVat,
  formatCurrency,
  formatVatRate,
} from "../utils/vatUtils";
import {
  emitStockChange,
  initProductDB,
  productService,
} from "../services/productDB";
import ProductModal from "../components/modals/ProductModal";
import BulkProductOperations from "../components/BulkProductOperations";
import BatchPriceUpdate from "../components/BatchPriceUpdate";
import CategoryManagement from "../components/CategoryManagement";
import StockManagement from "../components/StockManagement";
import BarcodeGenerator from "../components/BarcodeGenerator";
import Button from "../components/ui/Button";
import { Column } from "../types/table";
import { Table } from "../components/ui/Table";
import { Pagination } from "../components/ui/Pagination";
import { useAlert } from "../components/AlertProvider";
import PageLayout from "../components/layout/PageLayout";
import SearchFilterPanel from "../components/SearchFilterPanel";
import { Product, Category } from "../types/product";
import { useProducts } from "../hooks/useProducts"; // <-- useProducts import

const ProductsPage: React.FC = () => {
  const { showError, showSuccess, confirm } = useAlert();

  // useProducts hook'unu çağırarak ürünleri, kategorileri ve filtreleri yönetiyoruz
  const {
    products,
    categories,
    loading,
    searchTerm,
    setSearchTerm,
    selectedCategory,
    setSelectedCategory,
    filteredProducts,
    refreshProducts,
  } = useProducts({ enableCategories: true });

  // Üst kısımlarda kullanacağımız ek state'ler
  const [showFilters, setShowFilters] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>();
  const [showCategoryManagement, setShowCategoryManagement] = useState(false);
  const [selectedStockProduct, setSelectedStockProduct] =
    useState<Product | null>(null);
  const [selectedBarcodeProduct, setSelectedBarcodeProduct] =
    useState<Product | null>(null);

  // Toplu işlem seçimleri
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [showBatchUpdate, setShowBatchUpdate] = useState(false);

  // Sayfalama state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Tabloda göstereceğimiz kolonlar
  const columns: Column<Product>[] = [
    {
      key: "name",
      title: "Ürün",
      render: (product) => (
        <div className="font-medium text-gray-900">{product.name}</div>
      ),
    },
    {
      key: "category",
      title: "Kategori",
      render: (product) => (
        <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-600">
          <Tag size={14} />
          {product.category}
        </div>
      ),
    },
    {
      key: "barcode",
      title: "Barkod",
      className: "font-mono text-sm",
    },
    {
      key: "purchasePrice",
      title: "Alış Fiyatı",
      render: (product) => formatCurrency(product.purchasePrice),
    },
    {
      key: "salePrice",
      title: "Satış Fiyatı",
      render: (product) => formatCurrency(product.salePrice),
    },
    {
      key: "vatRate",
      title: "KDV",
      render: (product) => formatVatRate(product.vatRate),
    },
    {
      key: "priceWithVat",
      title: "KDV'li Fiyat",
      render: (product) => formatCurrency(product.priceWithVat),
      className: "font-medium",
    },
    {
      key: "stock",
      title: "Stok",
      render: (product) => (
        <div
          className={`flex items-center gap-1 ${
            product.stock < 5 ? "text-red-600" : "text-gray-600"
          }`}
        >
          {product.stock}
          {product.stock < 5 && <AlertTriangle size={14} />}
        </div>
      ),
    },
    {
      key: "actions",
      title: "İşlemler",
      render: (product) => (
        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedStockProduct(product);
            }}
            className="p-1 hover:bg-gray-100 rounded text-gray-600"
            title="Stok Yönetimi"
          >
            <Package size={16} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedBarcodeProduct(product);
            }}
            className="p-1 hover:bg-gray-100 rounded text-purple-600"
            title="Barkod Yazdır"
          >
            <Barcode size={16} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedProduct(product);
              setShowProductModal(true);
            }}
            className="p-1 hover:bg-gray-100 rounded text-blue-600"
            title="Düzenle"
          >
            <Edit size={16} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteProduct(product.id);
            }}
            className="p-1 hover:bg-gray-100 rounded text-red-600"
            title="Sil"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ];

  // Ürün ekleme
  const handleAddProduct = async (productData: Omit<Product, "id">) => {
    try {
      await productService.addProduct(productData);
      await refreshProducts();
      setShowProductModal(false);
    } catch (error) {
      console.error("Ürün eklenirken hata:", error);
    }
  };

  // Ürün güncelleme
  const handleEditProduct = async (productData: Omit<Product, "id">) => {
    if (!selectedProduct) return;
    try {
      await productService.updateProduct({
        ...productData,
        id: selectedProduct.id,
      });
      await refreshProducts();
      setShowProductModal(false);
      setSelectedProduct(undefined);
    } catch (error) {
      console.error("Ürün güncellenirken hata:", error);
    }
  };

  // Ürün silme
  const handleDeleteProduct = async (productId: number) => {
    const confirmed = await confirm(
      "Bu ürünü silmek istediğinize emin misiniz?"
    );
    if (confirmed) {
      try {
        await productService.deleteProduct(productId);
        await refreshProducts();
      } catch (error) {
        console.error("Ürün silinirken hata:", error);
      }
    }
  };

  // Tabloda checkbox ile seçme
  const handleSelectProduct = (productId: number, checked: boolean) => {
    setSelectedProductIds((prev) =>
      checked ? [...prev, productId] : prev.filter((id) => id !== productId)
    );
  };

  // Toplu sil
  const handleBatchDelete = async () => {
    if (selectedProductIds.length === 0) return;
    const confirmed = await confirm(
      `Seçili ${selectedProductIds.length} ürünü silmek istediğinize emin misiniz?`
    );
    if (confirmed) {
      try {
        for (const id of selectedProductIds) {
          await productService.deleteProduct(id);
        }
        await refreshProducts();
        setSelectedProductIds([]);
      } catch (error) {
        console.error("Toplu silme işlemi sırasında hata:", error);
      }
    }
  };

  // Toplu fiyat güncelle
  const handleBatchPriceUpdate = async (updatedProducts: Product[]) => {
    try {
      for (const product of updatedProducts) {
        await productService.updateProduct({
          ...product,
          priceWithVat: product.priceWithVat,
        });
      }
      await refreshProducts();
      setSelectedProductIds([]);
      setShowBatchUpdate(false);
    } catch (error) {
      console.error("Toplu fiyat güncelleme sırasında hata:", error);
    }
  };

  // Toplu import
  async function handleBulkImport(importedProducts: Product[]) {
    let addedCount = 0;
    let updatedCount = 0;
    try {
      const db = await initProductDB();
      const tx = db.transaction("products", "readwrite");
      const store = tx.objectStore("products");
      for (const product of importedProducts) {
        try {
          const index = store.index("barcode");
          const existing = await index.get(product.barcode);
          const { id, ...productData } = product;
          const processedProduct = {
            ...productData,
            purchasePrice: Number(productData.purchasePrice),
            salePrice: Number(productData.salePrice),
            priceWithVat: calculatePriceWithVat(
              Number(productData.salePrice),
              productData.vatRate
            ),
          };
          if (existing) {
            await store.put({
              ...processedProduct,
              id: existing.id,
            });
            updatedCount++;
          } else {
            await store.add(processedProduct);
            addedCount++;
          }
        } catch (err) {
          console.error(`Ürün işleme hatası (${product.name}):`, err);
        }
      }
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      await refreshProducts();
      showSuccess(
        `İçe aktarma tamamlandı:\n${addedCount} yeni ürün eklendi\n${updatedCount} ürün güncellendi`
      );
    } catch (err: any) {
      console.error("İçe aktarma hatası:", err);
      showError(
        `İçe aktarma sırasında hata:\n${addedCount} ürün eklendi\n${updatedCount} ürün güncellendi\nHata: ${
          err?.message || "Bilinmeyen hata"
        }`
      );
    }
  }

  // Stok işlemleri
  const handleStockUpdate = async (productId: number, newStock: number) => {
    try {
      const p = products.find((prod) => prod.id === productId);
      if (p) {
        const updatedProduct = { ...p, stock: newStock };
        await productService.updateProduct(updatedProduct);
        emitStockChange(updatedProduct); // Event yay
        await refreshProducts(); // UI güncelle
      }
    } catch (error) {
      console.error("Stok güncellenirken hata:", error);
    }
  };

  // Kategori yönetimi
  const handleCategoryUpdate = async (updatedCategories: Category[]) => {
    try {
      // Bu örnekte kategori ismi değişirse ve product.category bu yeni isimle eşleşmezse vs.
      // Gerekirse ek mantık ekleyin
      await refreshProducts();
    } catch (error) {
      console.error("Kategori güncelleme sırasında hata:", error);
    }
  };

  // Filtreleri resetlemek için
  const resetFilters = () => {
    setSearchTerm("");
    setSelectedCategory("Tümü");
    setShowFilters(false);
  };

  // Sayfalama hesaplamaları
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentProducts = filteredProducts.slice(
    indexOfFirstItem,
    indexOfLastItem
  );
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  // Tüm ürünleri (filtreli listeyi) seç veya temizle
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allFilteredIds = filteredProducts.map((p) => p.id);
      setSelectedProductIds(allFilteredIds);
    } else {
      setSelectedProductIds([]);
    }
  };

  return (
    <PageLayout title="Ürünler">
      {/* Arama & Filtre Paneli */}
      <SearchFilterPanel
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        onReset={resetFilters}
        showFilter={showFilters}
        toggleFilter={() => setShowFilters((prev) => !prev)}
      />

      {/* Kategori Butonları (Filtreler) */}
      {showFilters && (
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
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
            {/* Kategori Ekle Butonu */}
            <button
              onClick={() => setShowCategoryManagement(true)}
              className="px-3 py-1.5 rounded-lg bg-primary-50 text-primary-600 hover:bg-primary-100"
              title="Kategori Ekle"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Toplu Fiyat Güncelleme Alanı */}
      {showBatchUpdate && (
        <div className="mb-6">
          <BatchPriceUpdate
            products={products.filter((p) => selectedProductIds.includes(p.id))}
            onUpdate={handleBatchPriceUpdate}
          />
        </div>
      )}

      {/* Toplu Import/Export Paneli */}
      <div className="mb-6">
        <BulkProductOperations
          onImport={handleBulkImport}
          products={products}
          filteredProducts={filteredProducts}
        />
      </div>

      {/* Ürün Ekle / Toplu İşlemler Paneli */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 space-y-4 md:space-y-0">
        <Button
          onClick={() => {
            setSelectedProduct(undefined);
            setShowProductModal(true);
          }}
          variant="primary"
          icon={Plus}
          className="w-full md:w-auto"
        >
          Ürün Ekle
        </Button>

        {selectedProductIds.length > 0 && (
          <div className="flex flex-col md:flex-row gap-2 md:gap-4">
            <button
              onClick={() => setShowBatchUpdate(!showBatchUpdate)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md"
            >
              <Calculator size={20} />
              Toplu Fiyat Güncelle{" "}
              <span className="font-semibold">
                ({selectedProductIds.length})
              </span>
            </button>
            <button
              onClick={handleBatchDelete}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-md"
            >
              <Trash2 size={20} />
              Toplu Sil{" "}
              <span className="font-semibold">
                ({selectedProductIds.length})
              </span>
            </button>
          </div>
        )}
      </div>
      
      {/* Ürün Tablosu */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {filteredProducts.length > 0 && (
                <div className="text-sm text-gray-600">
                  {selectedProductIds.length > 0 ? (
                    <div className="flex items-center gap-2">
                      <span>
                        <span className="font-medium">
                          {selectedProductIds.length}
                        </span>{" "}
                        ürün seçildi
                      </span>
                      {selectedProductIds.length !==
                        filteredProducts.length && (
                        <button
                          onClick={() => handleSelectAll(true)}
                          className="text-primary-600 hover:text-primary-700"
                        >
                          Tümünü Seç ({filteredProducts.length})
                        </button>
                      )}
                    </div>
                  ) : (
                    `Toplam ${filteredProducts.length} ürün`
                  )}
                </div>
              )}
            </div>
            {(searchTerm || selectedCategory !== "Tümü") && (
              <div className="text-sm text-gray-500">
                Filtreleniyor:{" "}
                {searchTerm && (
                  <>
                    <span className="text-gray-700">"{searchTerm}"</span>
                    {selectedCategory !== "Tümü" && " + "}
                  </>
                )}
                {selectedCategory !== "Tümü" && selectedCategory}
              </div>
            )}
          </div>
        </div>

        <Table<Product, number>
          data={currentProducts}
          columns={columns}
          selectable
          selected={selectedProductIds}
          onSelectAll={handleSelectAll}
          allSelected={selectedProductIds.length === filteredProducts.length}
          onSelect={(id, checked) => handleSelectProduct(id, checked)}
          idField="id"
          loading={loading}
          emptyMessage="Ürün bulunamadı"
        />

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          className="p-4 border-t"
        />
      </div>

      {/* Modallar */}
      {/* Ürün Modalı (Ekle & Düzenle) */}
      <ProductModal
        isOpen={showProductModal}
        onClose={() => {
          setShowProductModal(false);
          setSelectedProduct(undefined);
        }}
        onSave={selectedProduct ? handleEditProduct : handleAddProduct}
        product={selectedProduct}
        categories={categories}
      />

      {/* Kategori Yönetimi Modalı */}
      {showCategoryManagement && (
        <CategoryManagement
          categories={categories}
          onUpdate={handleCategoryUpdate}
          onClose={() => setShowCategoryManagement(false)}
        />
      )}

      {/* Stok Yönetimi Modalı */}
      {selectedStockProduct && (
        <StockManagement
          product={selectedStockProduct}
          onUpdate={handleStockUpdate}
          onClose={() => setSelectedStockProduct(null)}
        />
      )}

      {/* Barkod Yazdırma Modalı */}
      {selectedBarcodeProduct && (
        <BarcodeGenerator
          product={selectedBarcodeProduct}
          onClose={() => setSelectedBarcodeProduct(null)}
        />
      )}
    </PageLayout>
  );
};

export default ProductsPage;

import React, { useState, useEffect } from "react";
import {
  Search,
  Plus,
  Filter,
  Tag,
  Edit,
  Trash2,
  AlertTriangle,
  Calculator,
  RefreshCw,
  Package,
  Barcode,
} from "lucide-react";
import { Category, Product } from "../types/product";
import {
  calculatePriceWithVat,
  formatCurrency,
  formatVatRate,
} from "../utils/vatUtils";
import { initProductDB, productService } from "../services/productDB";
import ProductModal from "../components/ProductModal";
import BulkProductOperations from "../components/BulkProductOperations";
import BatchPriceUpdate from "../components/BatchPriceUpdate";
import CategoryManagement from "../components/CategoryManagement";
import StockManagement from "../components/StockManagement";
import BarcodeGenerator from "../components/BarcodeGenerator";
import Button from "../components/Button";
import { Column } from "../types/table";
import { Table } from "../components/Table";
import { Pagination } from "../components/Pagination";

const ProductsPage: React.FC = () => {
  // State tanımlamaları
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Tümü");
  const [showFilters, setShowFilters] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>();
  const [showCategoryManagement, setShowCategoryManagement] = useState(false);
  const [selectedStockProduct, setSelectedStockProduct] =
    useState<Product | null>(null);
  const [selectedBarcodeProduct, setSelectedBarcodeProduct] =
    useState<Product | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [showBatchUpdate, setShowBatchUpdate] = useState(false);

  // State ekleyelim (en üstte diğer state'lerin yanına)
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

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

  // İlk yükleme
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const dbProducts = await productService.getAllProducts();
      const dbCategories = await productService.getCategories();
      setProducts(dbProducts);
      setCategories(dbCategories);
    } catch (error) {
      console.error("Veri yüklenirken hata:", error);
    }
  };

  // CRUD İşlemleri
  const handleAddProduct = async (productData: Omit<Product, "id">) => {
    try {
      await productService.addProduct(productData);
      await loadData();
      setShowProductModal(false);
    } catch (error) {
      console.error("Ürün eklenirken hata:", error);
    }
  };

  const handleEditProduct = async (productData: Omit<Product, "id">) => {
    if (!selectedProduct) return;
    try {
      await productService.updateProduct({
        ...productData,
        id: selectedProduct.id,
      });
      await loadData();
      setShowProductModal(false);
      setSelectedProduct(undefined);
    } catch (error) {
      console.error("Ürün güncellenirken hata:", error);
    }
  };

  const handleDeleteProduct = async (productId: number) => {
    const confirmed = window.confirm(
      "Bu ürünü silmek istediğinize emin misiniz?"
    );
    if (confirmed) {
      try {
        await productService.deleteProduct(productId);
        await loadData();
      } catch (error) {
        console.error("Ürün silinirken hata:", error);
      }
    }
  };

  // Toplu işlemler
  const handleSelectAll = (checked: boolean) => {
    setSelectedProductIds(checked ? filteredProducts.map((p) => p.id) : []);
  };

  const handleSelectProduct = (productId: number, checked: boolean) => {
    setSelectedProductIds((prev) =>
      checked ? [...prev, productId] : prev.filter((id) => id !== productId)
    );
  };

  const handleBatchDelete = async () => {
    if (selectedProductIds.length === 0) return;
    const confirmed = window.confirm(
      `Seçili ${selectedProductIds.length} ürünü silmek istediğinize emin misiniz?`
    );
    if (confirmed) {
      try {
        for (const id of selectedProductIds) {
          await productService.deleteProduct(id);
        }
        await loadData();
        setSelectedProductIds([]);
      } catch (error) {
        console.error("Toplu silme işlemi sırasında hata:", error);
      }
    }
  };

  const handleBatchPriceUpdate = async (updatedProducts: Product[]) => {
    try {
      for (const product of updatedProducts) {
        // Burada sadece salePrice'ı güncelleyeceğiz, priceWithVat hesaplamasına gerek yok
        await productService.updateProduct({
          ...product,
          // Yalnızca satış fiyatını güncelle
          priceWithVat: product.priceWithVat,
        });
      }
      await loadData();
      setSelectedProductIds([]);
      setShowBatchUpdate(false);
    } catch (error) {
      console.error("Toplu fiyat güncelleme sırasında hata:", error);
    }
  };

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

          // Fiyat alanlarının doğru şekilde ayarlandığından emin olun
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

      await loadData();
      alert(
        `İçe aktarma tamamlandı:\n${addedCount} yeni ürün eklendi\n${updatedCount} ürün güncellendi`
      );
    } catch (err: any) {
      console.error("İçe aktarma hatası:", err);
      alert(
        `İçe aktarma sırasında hata:\n${addedCount} ürün eklendi\n${updatedCount} ürün güncellendi\nHata: ${
          err?.message || "Bilinmeyen hata"
        }`
      );
    }
  }

  // Stok işlemleri
  const handleStockUpdate = async (productId: number, newStock: number) => {
    try {
      const product = products.find((p) => p.id === productId);
      if (product) {
        await productService.updateProduct({ ...product, stock: newStock });
        await loadData();
      }
    } catch (error) {
      console.error("Stok güncellenirken hata:", error);
    }
  };

  // Kategori işlemleri
  const handleCategoryUpdate = async (updatedCategories: Category[]) => {
    try {
      // Kategori güncellemesi için productService'e yeni metodlar eklenmeli
      const categoryNames = updatedCategories.map((c) => c.name);
      const productsToUpdate = products.filter(
        (p) => !categoryNames.includes(p.category)
      );

      for (const product of productsToUpdate) {
        await productService.updateProduct({
          ...product,
          category: "Genel",
        });
      }

      await loadData();
    } catch (error) {
      console.error("Kategori güncelleme sırasında hata:", error);
    }
  };

  // Filtreleme
  // Filtreleme (Move this section up)
  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.barcode.includes(searchQuery);
    const matchesCategory =
      selectedCategory === "Tümü" || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Sayfalama hesaplamalarını yapalım
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentProducts = filteredProducts.slice(
    indexOfFirstItem,
    indexOfLastItem
  );
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  return (
    <div className="p-6">
      {/* Üst Bar */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Ürünler</h1>
        <div className="flex gap-2">
          {selectedProductIds.length > 0 && (
            <>
              <button
                onClick={() => setShowBatchUpdate(!showBatchUpdate)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Calculator size={20} />
                Toplu Fiyat Güncelle ({selectedProductIds.length})
              </button>
              <button
                onClick={handleBatchDelete}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                <Trash2 size={20} />
                Toplu Sil ({selectedProductIds.length})
              </button>
            </>
          )}
          <Button
            onClick={() => {
              setSelectedProduct(undefined);
              setShowProductModal(true);
            }}
            variant="primary"
            icon={Plus} // İkonu buradan ekliyoruz
          >
            Ürün Ekle
          </Button>
        </div>
      </div>

      {/* Toplu Fiyat Güncelleme */}
      {showBatchUpdate && (
        <div className="mb-6">
          <BatchPriceUpdate
            products={products.filter((p) => selectedProductIds.includes(p.id))}
            onUpdate={handleBatchPriceUpdate}
          />
        </div>
      )}

      {/* Bulk Operations */}
      <div className="mb-6">
        <BulkProductOperations
          onImport={handleBulkImport}
          products={products}
        />
      </div>

      {/* Arama ve Filtreler */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex gap-4">
          {/* Arama */}
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Ürün ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <Search
              className="absolute left-3 top-2.5 text-gray-400"
              size={20}
            />
          </div>

          {/* Filtre Butonları */}
          <button
            onClick={() => setShowCategoryManagement(true)}
            className="p-2 border rounded-lg hover:bg-gray-50 text-primary-600"
            title="Kategori Yönetimi"
          >
            <Tag size={20} />
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 border rounded-lg hover:bg-gray-50 ${
              showFilters
                ? "bg-primary-50 border-primary-500 text-primary-600"
                : ""
            }`}
          >
            <Filter size={20} className="text-gray-600" />
          </button>
          <button
            onClick={() => {
              setSearchQuery("");
              setSelectedCategory("Tümü");
              setShowFilters(false);
            }}
            className="p-2 border rounded-lg hover:bg-gray-50"
            title="Filtreleri Sıfırla"
          >
            <RefreshCw size={20} className="text-gray-600" />
          </button>
        </div>

        {/* Filtreler */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex flex-wrap gap-2">
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

      {/* Ürün Listesi */}
      <div className="bg-white rounded-lg shadow-sm">
        <Table<Product, number>
          data={currentProducts} // filteredProducts yerine currentProducts kullanıyoruz
          columns={columns}
          selectable
          selected={selectedProductIds}
          onSelect={setSelectedProductIds}
          idField="id"
        />
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          className="p-4 border-t"
        />
      </div>

      {/* Ürün Modalı */}
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

      {showCategoryManagement && (
        <CategoryManagement
          categories={categories}
          onUpdate={handleCategoryUpdate}
          onClose={() => setShowCategoryManagement(false)}
        />
      )}

      {/* Stok Yönetim Modalı */}
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
    </div>
  );
};

export default ProductsPage;

import React, { useState } from "react";
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
import { Category, Product } from "../types/pos";
import { formatCurrency, formatVatRate } from "../utils/vatUtils";
import { sampleProducts, categories } from "../data/sampleProducts";
import ProductModal from "../components/ProductModal";
import BulkProductOperations from "../components/BulkProductOperations";
import BatchPriceUpdate from "../components/BatchPriceUpdate";
import CategoryManagement from "../components/CategoryManagement";
import StockManagement from "../components/StockManagement";
import BarcodeGenerator from "../components/BarcodeGenerator";

const ProductsPage: React.FC = () => {
  // Temel state'ler
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Tümü");
  const [showFilters, setShowFilters] = useState(false);
  const [products, setProducts] = useState<Product[]>(sampleProducts);
  const [showProductModal, setShowProductModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>();
  const [showCategoryManagement, setShowCategoryManagement] = useState(false);
  const [selectedStockProduct, setSelectedStockProduct] =
    useState<Product | null>(null);
  const [selectedBarcodeProduct, setSelectedBarcodeProduct] =
    useState<Product | null>(null);

  // Toplu işlem state'leri
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [showBatchUpdate, setShowBatchUpdate] = useState(false);

  // Toplu seçim işlemleri
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProductIds(filteredProducts.map((p) => p.id));
    } else {
      setSelectedProductIds([]);
    }
  };

  const handleStockUpdate = (productId: number, newStock: number) => {
    setProducts((prev) =>
      prev.map((product) =>
        product.id === productId ? { ...product, stock: newStock } : product
      )
    );
  };

  const handleSelectProduct = (productId: number, checked: boolean) => {
    if (checked) {
      setSelectedProductIds((prev) => [...prev, productId]);
    } else {
      setSelectedProductIds((prev) => prev.filter((id) => id !== productId));
    }
  };

  const handleCategoryUpdate = (updatedCategories: Category[]) => {
    // Kategorileri güncelle
    categories.splice(0, categories.length, ...updatedCategories);

    // Silinen kategorilere ait ürünleri "Genel" kategorisine taşı
    const categoryNames = updatedCategories.map((c) => c.name);
    setProducts((prevProducts) =>
      prevProducts.map((product) => ({
        ...product,
        category: categoryNames.includes(product.category)
          ? product.category
          : "Genel",
      }))
    );
  };

  // Toplu silme işlemi
  const handleBatchDelete = () => {
    if (selectedProductIds.length === 0) return;

    const confirmed = window.confirm(
      `Seçili ${selectedProductIds.length} ürünü silmek istediğinize emin misiniz?`
    );

    if (confirmed) {
      setProducts((prev) =>
        prev.filter((product) => !selectedProductIds.includes(product.id))
      );
      setSelectedProductIds([]);
    }
  };

  // Bulk import handler
  const handleBulkImport = (importedProducts: Product[]) => {
    setProducts((prevProducts) => {
      const productsMap = new Map(prevProducts.map((p) => [p.barcode, p]));

      // Yeni ürünlerin ID'lerini belirle
      const maxId = Math.max(...prevProducts.map((p) => p.id), 0);
      let nextId = maxId + 1;

      importedProducts.forEach((product) => {
        if (productsMap.has(product.barcode)) {
          // Mevcut ürünü güncelle
          const existingProduct = productsMap.get(product.barcode)!;
          productsMap.set(product.barcode, {
            ...product,
            id: existingProduct.id,
          });
        } else {
          // Yeni ürün ekle
          productsMap.set(product.barcode, {
            ...product,
            id: nextId++,
          });
        }
      });

      return Array.from(productsMap.values());
    });
  };

  // Toplu fiyat güncelleme
  const handleBatchPriceUpdate = (updatedProducts: Product[]) => {
    setProducts(updatedProducts);
    setSelectedProductIds([]);
    setShowBatchUpdate(false);
  };

  // Ürün ekleme işlemi
  const handleAddProduct = (productData: Omit<Product, "id">) => {
    const newProduct: Product = {
      ...productData,
      id: Math.max(...products.map((p) => p.id)) + 1,
    };
    setProducts((prev) => [...prev, newProduct]);
    setShowProductModal(false);
  };

  // Ürün düzenleme işlemi
  const handleEditProduct = (productData: Omit<Product, "id">) => {
    if (!selectedProduct) return;

    const updatedProduct: Product = {
      ...productData,
      id: selectedProduct.id,
    };

    setProducts((prev) =>
      prev.map((product) =>
        product.id === selectedProduct.id ? updatedProduct : product
      )
    );
    setShowProductModal(false);
    setSelectedProduct(undefined);
  };

  // Ürün silme işlemi
  const handleDeleteProduct = (productId: number) => {
    const confirmed = window.confirm(
      "Bu ürünü silmek istediğinize emin misiniz?"
    );
    if (confirmed) {
      setProducts((prev) => prev.filter((product) => product.id !== productId));
    }
  };

  // Ürün filtreleme
  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.barcode.includes(searchQuery);
    const matchesCategory =
      selectedCategory === "Tümü" || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

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
          <button
            onClick={() => {
              setSelectedProduct(undefined);
              setShowProductModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Plus size={20} />
            Yeni Ürün
          </button>
        </div>
      </div>

      {/* Toplu Fiyat Güncelleme */}
      {showBatchUpdate && (
        <div className="mb-6">
          <BatchPriceUpdate
            products={products}
            selectedProducts={selectedProductIds}
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
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-gray-900">
                  <input
                    type="checkbox"
                    checked={
                      selectedProductIds.length === filteredProducts.length
                    }
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-900">
                  Ürün
                </th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-900">
                  Kategori
                </th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-900">
                  Barkod
                </th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-900">
                  KDV'siz Fiyat
                </th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-900">
                  KDV
                </th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-900">
                  KDV'li Fiyat
                </th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-900">
                  Stok
                </th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-900">
                  İşlemler
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedProductIds.includes(product.id)}
                      onChange={(e) =>
                        handleSelectProduct(product.id, e.target.checked)
                      }
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">
                      {product.name}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                      <Tag size={14} />
                      {product.category}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-sm">
                    {product.barcode}
                  </td>
                  <td className="px-6 py-4">{formatCurrency(product.price)}</td>
                  <td className="px-6 py-4">
                    {formatVatRate(product.vatRate)}
                  </td>
                  <td className="px-6 py-4 font-medium">
                    {formatCurrency(product.priceWithVat)}
                  </td>
                  <td className="px-6 py-4">
                    <div
                      className={`flex items-center gap-1 
                      ${product.stock < 5 ? "text-red-600" : "text-gray-600"}`}
                    >
                      {product.stock}
                      {product.stock < 5 && <AlertTriangle size={14} />}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedStockProduct(product)}
                        className="p-1 hover:bg-gray-100 rounded text-gray-600"
                        title="Stok Yönetimi"
                      >
                        <Package size={16} />
                      </button>
                      <button
                        onClick={() => setSelectedBarcodeProduct(product)}
                        className="p-1 hover:bg-gray-100 rounded text-purple-600"
                        title="Barkod Yazdır"
                      >
                        <Barcode size={16} />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedProduct(product);
                          setShowProductModal(true);
                        }}
                        className="p-1 hover:bg-gray-100 rounded text-blue-600"
                        title="Düzenle"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        className="p-1 hover:bg-gray-100 rounded text-red-600"
                        title="Sil"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

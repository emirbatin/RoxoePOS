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
import { Category, Product } from "../types/pos";
import { formatCurrency, formatVatRate } from "../utils/vatUtils";
import { productService } from "../services/productDB";
import ProductModal from "../components/ProductModal";
import BulkProductOperations from "../components/BulkProductOperations";
import BatchPriceUpdate from "../components/BatchPriceUpdate";
import CategoryManagement from "../components/CategoryManagement";
import StockManagement from "../components/StockManagement";
import BarcodeGenerator from "../components/BarcodeGenerator";

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

  // İlk yükleme
  useEffect(() => {
    loadData();
  }, [products]);

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
        await productService.updateProduct(product);
      }
      await loadData();
      setSelectedProductIds([]);
      setShowBatchUpdate(false);
    } catch (error) {
      console.error("Toplu fiyat güncelleme sırasında hata:", error);
    }
  };

  const handleBulkImport = async (importedProducts: Product[]) => {
    try {
      for (const product of importedProducts) {
        const existingProduct = products.find(
          (p) => p.barcode === product.barcode
        );
        if (existingProduct) {
          await productService.updateProduct({
            ...product,
            id: existingProduct.id,
          });
        } else {
          await productService.addProduct(product);
        }
      }
      await loadData();
    } catch (error) {
      console.error("Toplu içe aktarma sırasında hata:", error);
    }
  };

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

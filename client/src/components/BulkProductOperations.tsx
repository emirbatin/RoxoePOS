import React, { useState } from "react";
import { Upload, Download, AlertTriangle, FileDown, RefreshCw } from "lucide-react";
import { Product } from "../types/product";
import { importExportService } from "../services/importExportServices";
import { productService } from "../services/productDB";
import ColumnMappingModal from "../components/modals/ColumnMappingModal";
import { useAlert } from "../components/AlertProvider";

interface BulkProductOperationsProps {
  onImport: (products: Product[]) => void;
  products: Product[];
  filteredProducts?: Product[];
}

const BulkProductOperations: React.FC<BulkProductOperationsProps> = ({
  onImport,
  products,
  filteredProducts, 
}) => {
  const { confirm, showError, showSuccess } = useAlert();

  const [error, setError] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [importStats, setImportStats] = useState<{
    total: number;
    new: number;
    update: number;
    newCategories: number;
  } | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showMappingModal, setShowMappingModal] = useState(false);

  // Dışa aktarılacak ürünleri belirle: filtrelenmiş varsa onları, yoksa tüm ürünleri kullan
  const productsToExport = filteredProducts && filteredProducts.length > 0 
    ? filteredProducts 
    : products;

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (
      !file.name.endsWith(".xlsx") &&
      !file.name.endsWith(".xls") &&
      !file.name.endsWith(".csv")
    ) {
      setError(
        "Desteklenmeyen dosya formatı. Lütfen .xlsx, .xls veya .csv dosyası yükleyin."
      );
      return;
    }

    setSelectedFile(file);
    setShowMappingModal(true);
    setError("");
    setImportStats(null);

    if (event.target) {
      event.target.value = "";
    }
  };

  // Enhanced product import to handle barcode duplicates better
  const handleProductImport = async (newProducts: Product[], updatedProducts: Product[]) => {
    try {
      // STEP 1: First get all existing products with their barcodes for reference
      console.log("Getting existing products with their barcodes...");
      const allExistingProducts = await productService.getAllProducts();
      const barcodeToProductMap = new Map<string, Product>();
      
      // Create a map of barcode to existing product for fast lookups
      allExistingProducts.forEach(product => {
        if (product.barcode) {
          barcodeToProductMap.set(product.barcode, product);
        }
      });
      
      // STEP 2: First update existing products (that we already identified)
      console.log(`Updating ${updatedProducts.length} existing products...`);
      for (const product of updatedProducts) {
        try {
          await productService.updateProduct(product);
        } catch (error) {
          console.error(`Failed to update product ${product.name} (ID: ${product.id}):`, error);
          // Continue with other products instead of stopping the whole process
        }
      }
      
      // STEP 3: For new products, check again if they exist by barcode
      console.log(`Processing ${newProducts.length} new products...`);
      let actuallyAdded = 0;
      let additionallyUpdated = 0;
      
      for (const product of newProducts) {
        try {
          // Check if we already have this product by barcode
          const existingProduct = barcodeToProductMap.get(product.barcode);
          
          if (existingProduct) {
            // Product exists by barcode but wasn't in updatedProducts - update it
            console.log(`Product with barcode ${product.barcode} already exists (ID: ${existingProduct.id}), updating instead of adding`);
            await productService.updateProduct({
              ...product,
              id: existingProduct.id
            });
            additionallyUpdated++;
          } else {
            // Truly a new product - add it without an ID
            // Create a new product object without the id property
            const { id, ...productWithoutId } = product;
            await productService.addProduct(productWithoutId);
            actuallyAdded++;
          }
        } catch (error) {
          if (error instanceof Error && error.message.includes("barkoda sahip ürün zaten mevcut")) {
            // This is a duplicate barcode error from productService
            console.log(`Duplicate barcode detected for ${product.name}, skipping...`);
          } else {
            console.error(`Error processing product ${product.name}:`, error);
          }
          // Continue with other products
        }
      }
      
      console.log(`Import completed: ${updatedProducts.length} updated, ${actuallyAdded} added, ${additionallyUpdated} additionally updated`);
    } catch (error) {
      console.error("Error in product import:", error);
      throw error;
    }
  };

  const handleMappedData = async (mappedProducts: Product[]) => {
    setIsProcessing(true);
    try {
      // Create barcode map of existing products for quick lookups
      const existingProductsMap = new Map<string, Product>();
      products.forEach(product => {
        if (product.barcode) {
          existingProductsMap.set(product.barcode, product);
        }
      });
      
      const stats = {
        total: mappedProducts.length,
        new: 0,
        update: 0,
        newCategories: 0
      };
  
      // Get existing categories
      const existingCategories = await productService.getCategories();
      const existingCategoryNames = new Set(existingCategories.map(c => c.name));
  
      // Collect new categories to add
      const newCategories = new Set<string>();
      mappedProducts.forEach(product => {
        if (product.category && !existingCategoryNames.has(product.category)) {
          newCategories.add(product.category);
        }
      });

      // Prepare product lists for display
      const newProducts: Product[] = [];
      const updatedProducts: Product[] = [];
      
      // Classify products as new or update
      mappedProducts.forEach((product) => {
        if (existingProductsMap.has(product.barcode)) {
          const existingProduct = existingProductsMap.get(product.barcode)!;
          updatedProducts.push({
            ...product,
            id: existingProduct.id // Keep the existing ID
          });
          stats.update++;
        } else {
          newProducts.push(product);
          stats.new++;
        }
      });
  
      stats.newCategories = newCategories.size;
      setImportStats(stats);
  
      // Create confirmation message with detailed info
      let confirmMessage = `${stats.total} ürün içe aktarılacak:\n`;
      confirmMessage += `• ${stats.new} yeni ürün eklenecek\n`;
      confirmMessage += `• ${stats.update} ürün güncellenecek\n`;
      
      // Add a sample of products being updated if any
      if (updatedProducts.length > 0) {
        confirmMessage += "\nGüncellenecek ürünlerden örnekler:\n";
        
        // Show up to 3 examples of products being updated with their price changes
        const exampleCount = Math.min(3, updatedProducts.length);
        for (let i = 0; i < exampleCount; i++) {
          const updated = updatedProducts[i];
          const existing = existingProductsMap.get(updated.barcode)!;
          
          // Format price change information
          let priceChangeInfo = "";
          if (updated.salePrice !== existing.salePrice) {
            priceChangeInfo = ` (Fiyat: ${existing.salePrice} TL → ${updated.salePrice} TL)`;
          }
          
          confirmMessage += `• ${updated.name}${priceChangeInfo}\n`;
        }
        
        if (updatedProducts.length > 3) {
          confirmMessage += `• ... ve ${updatedProducts.length - 3} ürün daha\n`;
        }
      }
      
      // Add category information
      if (newCategories.size > 0) {
        confirmMessage += `\n${newCategories.size} yeni kategori eklenecek:\n`;
        [...newCategories].slice(0, 5).forEach(cat => {
          confirmMessage += `• ${cat}\n`;
        });
        
        if (newCategories.size > 5) {
          confirmMessage += `• ... ve ${newCategories.size - 5} kategori daha\n`;
        }
      }
      
      confirmMessage += "\nDevam etmek istiyor musunuz?";
  
      const shouldImport = await confirm(confirmMessage);
  
      if (shouldImport) {
        // First add any new categories
        for (const categoryName of newCategories) {
          try {
            await productService.addCategory({
              name: categoryName,
              icon: "📦", // Default icon
            });
          } catch (error) {
            // If category already exists, just continue
            console.warn(`Category may already exist: ${categoryName}`, error);
          }
        }

        // Then handle products - using the enhanced method for better barcode matching
        await handleProductImport(newProducts, updatedProducts);
        
        // Refresh the product list
        const refreshedProducts = await productService.getAllProducts();
        onImport(refreshedProducts);
        
        // Show success message with counts
        showSuccess(
          `İçe aktarım başarılı:\n` +
          `${stats.new} yeni ürün eklendi\n` +
          `${stats.update} ürün güncellendi\n` +
          `${stats.newCategories} yeni kategori eklendi`
        );
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Bilinmeyen bir hata oluştu"
      );
    } finally {
      setIsProcessing(false);
      setSelectedFile(null);
      setShowMappingModal(false);
    }
  };

  const handleExport = async (type: "excel" | "csv") => {
    try {
      // Filtrelemiş ürün sayısını ve toplam ürün sayısını gösteren bir bilgilendirme metni
      const filteredInfo = filteredProducts && filteredProducts.length !== products.length
        ? `_filtrelenmis_${filteredProducts.length}_urun`
        : "";

      const fileName = `urunler${filteredInfo}_${new Date().toISOString().split("T")[0]}`;
      
      if (type === "excel") {
        await importExportService.exportToExcel(productsToExport, `${fileName}.xlsx`);
      } else {
        importExportService.exportToCSV(productsToExport, `${fileName}.csv`);
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Dışa aktarma sırasında bir hata oluştu"
      );
    }
  };

  const handleTemplateDownload = async (type: "excel" | "csv") => {
    try {
      await importExportService.generateTemplate(type);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Şablon indirme sırasında bir hata oluştu"
      );
    }
  };
  
  // Function to refresh existing product list
  const refreshProductData = async () => {
    try {
      setIsProcessing(true);
      const refreshedProducts = await productService.getAllProducts();
      onImport(refreshedProducts);
      showSuccess("Ürün listesi yenilendi");
    } catch (error) {
      showError("Ürün listesi yenilenirken hata oluştu");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg border space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-medium">Toplu İşlemler</h3>
        <div className="flex gap-2">
          <button
            onClick={() => handleTemplateDownload("excel")}
            className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
          >
            <FileDown size={16} />
            Excel Şablonu
          </button>
          <button
            onClick={() => handleTemplateDownload("csv")}
            className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
          >
            <FileDown size={16} />
            CSV Şablonu
          </button>
          <button
            onClick={refreshProductData}
            disabled={isProcessing}
            className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
          >
            <RefreshCw size={16} />
            Yenile
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Import */}
        <div>
          <label className="block">
            <div
              className={`flex items-center justify-center w-full h-24 border-2 border-dashed rounded-lg 
              ${isProcessing ? "bg-gray-50 cursor-wait" : "hover:bg-gray-50 cursor-pointer"}`}
            >
              <div className="text-center">
                <Upload className="mx-auto h-8 w-8 text-gray-400" />
                <span className="mt-2 block text-sm text-gray-600">
                  {isProcessing ? "İşleniyor..." : "Excel veya CSV yükle"}
                </span>
                <span className="mt-1 block text-xs text-gray-500">
                  .xlsx, .xls veya .csv
                </span>
              </div>
              <input
                type="file"
                className="hidden"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                disabled={isProcessing}
              />
            </div>
          </label>
        </div>

        {/* Export */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleExport("excel")}
            disabled={productsToExport.length === 0 || isProcessing}
            className="flex flex-col items-center justify-center h-24 border-2 rounded-lg hover:bg-gray-50 
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="h-8 w-8 text-gray-400" />
            <span className="mt-2 text-sm text-gray-600">
              Excel'e Aktar {filteredProducts && filteredProducts.length !== products.length ? 
                `(${filteredProducts.length} ürün)` : 
                ""
              }
            </span>
          </button>

          <button
            onClick={() => handleExport("csv")}
            disabled={productsToExport.length === 0 || isProcessing}
            className="flex flex-col items-center justify-center h-24 border-2 rounded-lg hover:bg-gray-50 
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="h-8 w-8 text-gray-400" />
            <span className="mt-2 text-sm text-gray-600">
              CSV'ye Aktar {filteredProducts && filteredProducts.length !== products.length ? 
                `(${filteredProducts.length} ürün)` : 
                ""
              }
            </span>
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
          <AlertTriangle size={20} />
          <span>{error}</span>
        </div>
      )}

      {importStats && !error && (
        <div className="bg-blue-50 p-3 rounded-lg">
          <div className="font-medium text-blue-700">İçe Aktarım Özeti</div>
          <div className="text-sm text-blue-600 mt-1">
            <div>Toplam: {importStats.total} ürün</div>
            <div>Yeni: {importStats.new} ürün</div>
            <div>Güncellenecek: {importStats.update} ürün</div>
            <div>Yeni Kategoriler: {importStats.newCategories} adet</div>
          </div>
        </div>
      )}

      {showMappingModal && selectedFile && (
        <ColumnMappingModal
          isOpen={showMappingModal}
          onClose={() => {
            setShowMappingModal(false);
            setSelectedFile(null);
          }}
          file={selectedFile}
          onImport={handleMappedData}
        />
      )}
    </div>
  );
};

export default BulkProductOperations;
import React, { useState } from "react";
import { Upload, Download, AlertTriangle, FileDown } from "lucide-react";
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
  const { confirm, showError } = useAlert();

  const [error, setError] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [importStats, setImportStats] = useState<{
    total: number;
    new: number;
    update: number;
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

  const handleMappedData = async (mappedProducts: Product[]) => {
    setIsProcessing(true);
    try {
      const existingBarcodes = new Set(products.map((p) => p.barcode));
      const stats = {
        total: mappedProducts.length,
        new: 0,
        update: 0,
      };
  
      // Mevcut kategorileri al
      const existingCategories = await productService.getCategories();
      const existingCategoryNames = new Set(existingCategories.map(c => c.name));
  
      // Yeni kategorileri topla
      const newCategories = new Set<string>();
      mappedProducts.forEach(product => {
        if (product.category && !existingCategoryNames.has(product.category)) {
          newCategories.add(product.category);
        }
      });
  
      // Yeni kategorileri ekle
      for (const categoryName of newCategories) {
        await productService.addCategory({
          name: categoryName,
          icon: "📦", // Varsayılan icon
        });
      }
  
      mappedProducts.forEach((product) => {
        if (existingBarcodes.has(product.barcode)) {
          stats.update++;
        } else {
          stats.new++;
        }
      });
  
      setImportStats(stats);
  
      const shouldImport = await confirm(
        `${stats.total} ürün içe aktarılacak:\n` +
        `${stats.new} yeni ürün\n` +
        `${stats.update} güncellenecek ürün\n` +
        `${newCategories.size} yeni kategori eklenecek\n\n` +
        `Devam etmek istiyor musunuz?`
      );
  
      if (shouldImport) {
        await productService.bulkInsertProducts(mappedProducts);
        const updatedProducts = await productService.getAllProducts();
        onImport(updatedProducts);
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

  return (
    <div className="bg-white p-4 rounded-lg border space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-medium">Toplu İşlemler</h3>
        <div className="flex gap-2">
          <button
            onClick={() => handleTemplateDownload("excel")}
            className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
          >
            <FileDown size={16} />
            Excel Şablonu
          </button>
          <button
            onClick={() => handleTemplateDownload("csv")}
            className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
          >
            <FileDown size={16} />
            CSV Şablonu
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
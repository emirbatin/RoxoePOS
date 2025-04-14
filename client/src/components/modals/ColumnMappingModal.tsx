import React, { useState, useEffect } from "react";
import { Save, X, AlertTriangle, Download } from "lucide-react";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import { Product, VatRate } from "../../types/product";
import { calculatePriceWithoutVat } from "../../utils/vatUtils";
import { parseTurkishNumber } from "../../utils/numberFormatUtils";

interface ColumnMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: File;
  onImport: (products: Product[]) => void;
}

type SystemColumnKey = keyof typeof SYSTEM_COLUMNS;

const REQUIRED_FIELDS = [
  "name",
  "barcode",
  "purchasePrice",
  "salePrice",
  "vatRate",
  "stock",
  "category",
] as const;

const SYSTEM_COLUMNS = {
  name: "Ürün Adı",
  barcode: "Barkod",
  purchasePrice: "Alış Fiyatı",
  salePrice: "Satış Fiyatı",
  vatRate: "KDV Oranı",
  stock: "Stok",
  category: "Kategori",
} as const;

// VAT rate normalization map - convert common values to valid VatRates
const VAT_RATE_MAP: Record<string, VatRate> = {
  "0": 0, "0.0": 0, "0%": 0, "%0": 0,
  "1": 1, "1.0": 1, "1%": 1, "%1": 1,
  "8": 8, "8.0": 8, "8%": 8, "%8": 8,
  "18": 18, "18.0": 18, "18%": 18, "%18": 18,
  "20": 20, "20.0": 20, "20%": 20, "%20": 20,
};

// Interface for row processing result
interface ProcessResult {
  product: Product | null;
  warning?: string;
}

// Interface for import summary
interface ImportSummary {
  total: number;
  success: number;
  skipped: number;
  errors: Array<{rowIndex: number, message: string}>;
  warnings: Array<{rowIndex: number, message: string}>;
}

const ColumnMappingModal: React.FC<ColumnMappingModalProps> = ({
  isOpen,
  onClose,
  file,
  onImport,
}) => {
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<SystemColumnKey, string>>(
    {} as Record<SystemColumnKey, string>
  );
  const [previewData, setPreviewData] = useState<any[][]>([]);
  const [errors, setErrors] = useState<Record<SystemColumnKey, string>>(
    {} as Record<SystemColumnKey, string>
  );
  const [processingErrors, setProcessingErrors] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [salePriceIncludesVat, setSalePriceIncludesVat] = useState(true);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [allowPartialImport, setAllowPartialImport] = useState(true);
  const [showAllErrors, setShowAllErrors] = useState(false);
  const [rawData, setRawData] = useState<Record<string, any>[]>([]);

  useEffect(() => {
    if (file) {
      readFileHeaders();
    }
  }, [file]);

  const suggestMapping = (headers: string[]) => {
    const suggestedMapping: Record<SystemColumnKey, string> = {} as Record<SystemColumnKey, string>;
    
    // Map of potential column names to system fields
    const fieldMappings: Record<string, SystemColumnKey> = {
      // Name patterns
      "urunad": "name", "ürünad": "name", "urun": "name", "ürün": "name", 
      "ad": "name", "isim": "name", "baslik": "name", "başlık": "name",
      "aciklama": "name", "açıklama": "name", "product": "name", 
      "productname": "name", "title": "name", "name": "name",
      
      // Barcode patterns
      "barkod": "barcode", "barkodkodu": "barcode", "barcode": "barcode", 
      "ean": "barcode", "kod": "barcode", "code": "barcode", "urunkodu": "barcode",
      "ürünkodu": "barcode", "productcode": "barcode",
      
      // Purchase price patterns
      "alis": "purchasePrice", "alış": "purchasePrice", "alisfiyat": "purchasePrice", 
      "alışfiyat": "purchasePrice", "maliyet": "purchasePrice", "cost": "purchasePrice",
      "maliyetfiyat": "purchasePrice", "purchaseprice": "purchasePrice", "costprice": "purchasePrice",
      
      // Sale price patterns
      "satis": "salePrice", "satış": "salePrice", "satisfiyat": "salePrice", 
      "satışfiyat": "salePrice", "fiyat": "salePrice", "price": "salePrice",
      "saleprice": "salePrice", "sellingprice": "salePrice",
      
      // VAT rate patterns
      "kdv": "vatRate", "kdvoran": "vatRate", "vergi": "vatRate", "tax": "vatRate",
      "kdvorani": "vatRate", "kdvoranı": "vatRate", "vatrate": "vatRate",
      
      // Stock patterns
      "stok": "stock", "stokmiktari": "stock", "miktar": "stock", "adet": "stock",
      "quantity": "stock", "stock": "stock", "stokadet": "stock", "stockquantity": "stock",
      
      // Category patterns
      "kategori": "category", "grup": "category", "urungrubu": "category", 
      "ürüngrubu": "category", "category": "category", "group": "category",
      "productgroup": "category", "productcategory": "category"
    };

    // Normalize and match headers
    headers.forEach((header) => {
      // Clean header for matching
      const normalizedHeader = header.toLowerCase()
        .replace(/\s+/g, '') // Remove spaces
        .replace(/[iıİI]/g, 'i') // Normalize Turkish characters
        .replace(/[şŞ]/g, 's')
        .replace(/[çÇ]/g, 'c')
        .replace(/[ğĞ]/g, 'g')
        .replace(/[üÜ]/g, 'u')
        .replace(/[öÖ]/g, 'o');
      
      // First try exact matches
      for (const [pattern, systemKey] of Object.entries(fieldMappings)) {
        if (normalizedHeader === pattern) {
          suggestedMapping[systemKey] = header;
          break;
        }
      }

      // If no exact match, try partial matches
      if (!Object.values(suggestedMapping).includes(header)) {
        for (const [pattern, systemKey] of Object.entries(fieldMappings)) {
          if (normalizedHeader.includes(pattern) || pattern.includes(normalizedHeader)) {
            suggestedMapping[systemKey] = header;
            break;
          }
        }
      }
    });

    // Additional system column matching (original code)
    if (Object.keys(suggestedMapping).length < REQUIRED_FIELDS.length) {
      headers.forEach((header) => {
        const normalizedHeader = header.toLowerCase()
          .replace(/\s+/g, '')
          .replace(/[iıİI]/g, 'i')
          .replace(/[şŞ]/g, 's')
          .replace(/[çÇ]/g, 'c')
          .replace(/[ğĞ]/g, 'g')
          .replace(/[üÜ]/g, 'u')
          .replace(/[öÖ]/g, 'o');

        Object.entries(SYSTEM_COLUMNS).forEach(([key, value]) => {
          if (suggestedMapping[key as SystemColumnKey]) return; // Skip if already mapped
          
          const normalizedValue = value.toLowerCase()
            .replace(/\s+/g, '')
            .replace(/[iıİI]/g, 'i')
            .replace(/[şŞ]/g, 's')
            .replace(/[çÇ]/g, 'c')
            .replace(/[ğĞ]/g, 'g')
            .replace(/[üÜ]/g, 'u')
            .replace(/[öÖ]/g, 'o');

          if (normalizedHeader === normalizedValue ||
              normalizedHeader.includes(normalizedValue) ||
              normalizedValue.includes(normalizedHeader)) {
            suggestedMapping[key as SystemColumnKey] = header;
          }
        });
      });
    }

    setMapping(suggestedMapping);
  };

  const readFileHeaders = async () => {
    setProcessingErrors([]);
    setImportSummary(null);
    try {
      if (file.name.endsWith(".csv")) {
        await readCSV();
      } else {
        await readExcel();
      }
    } catch (error) {
      setProcessingErrors([
        `Dosya okuma hatası: ${
          error instanceof Error ? error.message : "Bilinmeyen hata"
        }`,
      ]);
    }
  };

  const readCSV = () => {
    return new Promise<void>((resolve, reject) => {
      Papa.parse<Record<string, string>>(file, {
        header: true,
        preview: 4,
        encoding: "utf-8",
        skipEmptyLines: true,
        complete: (results) => {
          if (results.data.length > 0) {
            const headers = Object.keys(results.data[0]);
            setHeaders(headers);
            setPreviewData(
              results.data.slice(0, 3).map((row) => headers.map((h) => row[h]))
            );
            suggestMapping(headers);
          } else {
            reject(new Error("CSV dosyası boş veya geçersiz"));
          }
          resolve();
        },
        error: (error) => {
          reject(new Error(`CSV okuma hatası: ${error}`));
        },
      });
    });
  };

  const readExcel = async () => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);

      const worksheet = workbook.getWorksheet(1);
      if (!worksheet) throw new Error("Excel dosyası boş");

      const headers: string[] = [];
      const previewRows: any[][] = [];

      // Read headers
      const headerRow = worksheet.getRow(1);
      let columnCount = 0;
      
      headerRow.eachCell((cell, colNumber) => {
        if (cell.value !== undefined && cell.value !== null) {
          const headerText = cell.value.toString().trim();
          if (headerText) {
            headers.push(headerText);
            columnCount = Math.max(columnCount, colNumber);
          }
        }
      });

      // Read preview rows
      for (let rowNumber = 2; rowNumber <= 4; rowNumber++) {
        const row = worksheet.getRow(rowNumber);
        const rowData: any[] = [];
        
        // Ensure we read all columns even if some cells are empty
        for (let colIndex = 0; colIndex < headers.length; colIndex++) {
          const cell = row.getCell(colIndex + 1);
          rowData.push(cell.value !== null && cell.value !== undefined ? cell.value.toString().trim() : "");
        }
        
        if (rowData.some(cell => cell !== "")) { // Only add row if not completely empty
          previewRows.push(rowData);
        }
      }

      if (headers.length === 0) {
        throw new Error("Excel başlıkları bulunamadı");
      }

      setHeaders(headers);
      setPreviewData(previewRows);
      suggestMapping(headers);
    } catch (error) {
      console.error("Excel okuma hatası:", error);
      throw error;
    }
  };

  const cleanValue = (value: any): string => {
    if (value === null || value === undefined) return "";
    return value.toString().trim();
  };

  // Bu fonksiyon parseNumber yerine kullanılacak ve Türkçe sayı formatını (2.065,42 gibi) doğru şekilde işleyecek
  const parseNumberWithTurkishSupport = (value: any): number | null => {
    if (value === null || value === undefined || value === "") return null;
    
    // parseTurkishNumber fonksiyonunu kullan (utils/numberFormatUtils.ts'den import edilmiş)
    const parsedNumber = parseTurkishNumber(value);
    
    // Log edilen değerlerin kontrol edilmesi için
    // console.log(`Parsing ${value} (${typeof value}): Result = ${parsedNumber}`);
    
    return parsedNumber !== undefined ? parsedNumber : null;
  };

  const normalizeVatRate = (value: any): VatRate | null => {
    if (value === null || value === undefined || value === "") return null;
    
    // First, clean and normalize the value
    const cleaned = cleanValue(value)
      .replace(/\s/g, "")
      .replace(/%/g, "")
      .replace(/,/g, ".");
    
    // Try to get from VAT_RATE_MAP
    if (VAT_RATE_MAP[cleaned]) {
      return VAT_RATE_MAP[cleaned];
    }
    
    // Try to convert to a number using the Turkish number parser
    const numValue = parseNumberWithTurkishSupport(cleaned);
    if (numValue === null) return null;
    
    // Round to nearest valid VAT rate
    const validRates: VatRate[] = [0, 1, 8, 18, 20];
    const closest = validRates.reduce((prev, curr) => 
      Math.abs(curr - numValue) < Math.abs(prev - numValue) ? curr : prev
    );
    
    return closest as VatRate;
  };

  const processRow = (
    row: Record<string, any>,
    rowIndex: number
  ): ProcessResult => {
    const warnings: string[] = [];
    try {
      const product: Partial<Product> = {};
  
      // Check required fields
      for (const field of REQUIRED_FIELDS) {
        const fileField = mapping[field];
        if (!fileField) {
          throw new Error(`${SYSTEM_COLUMNS[field as keyof typeof SYSTEM_COLUMNS]} alanı eşleştirilmemiş`);
        }
        
        const rawValue = row[fileField];
        if (rawValue === undefined || rawValue === null || rawValue === "") {
          // For barcode and name, consider it a critical error
          if (field === "barcode" || field === "name") {
            throw new Error(`Satır ${rowIndex + 2}: ${SYSTEM_COLUMNS[field as keyof typeof SYSTEM_COLUMNS]} alanı boş`);
          } else {
            // For other fields, we'll try to use defaults and continue
            warnings.push(`${SYSTEM_COLUMNS[field as keyof typeof SYSTEM_COLUMNS]} alanı boş, varsayılan değer kullanılacak`);
          }
        }
      }
  
      // Process each field with improved error handling
      for (const [systemField, fileField] of Object.entries(mapping)) {
        if (!fileField) continue; // Skip unmapped fields
        
        const rawValue = row[fileField];
  
        try {
          switch (systemField as SystemColumnKey) {
            case "vatRate": {
              const vatRate = normalizeVatRate(rawValue);
              if (vatRate === null) {
                warnings.push(`Geçersiz KDV oranı: "${rawValue}", varsayılan değer 18 kullanılacak`);
                product.vatRate = 18; // Default to common VAT rate
              } else {
                product.vatRate = vatRate;
              }
              break;
            }
            case "purchasePrice": {
              // Türkçe sayı formatı için parseNumberWithTurkishSupport kullan
              const price = parseNumberWithTurkishSupport(rawValue);
              if (price === null) {
                warnings.push(`Geçersiz alış fiyatı: "${rawValue}", varsayılan değer 0 kullanılacak`);
                product.purchasePrice = 0; // Default to 0
              } else if (price < 0) {
                warnings.push(`Negatif alış fiyatı: ${price}, pozitif değer kullanılacak`);
                product.purchasePrice = Math.abs(price);
              } else {
                product.purchasePrice = price;
              }
              break;
            }
            case "salePrice": {
              // Türkçe sayı formatı için parseNumberWithTurkishSupport kullan
              const price = parseNumberWithTurkishSupport(rawValue);
              if (price === null) {
                // Try to use purchase price if available
                if (product.purchasePrice !== undefined) {
                  warnings.push(`Geçersiz satış fiyatı: "${rawValue}", alış fiyatı kullanılacak`);
                  product.salePrice = product.purchasePrice;
                } else {
                  warnings.push(`Geçersiz satış fiyatı: "${rawValue}", varsayılan değer 0 kullanılacak`);
                  product.salePrice = 0;
                }
              } else if (price < 0) {
                warnings.push(`Negatif satış fiyatı: ${price}, pozitif değer kullanılacak`);
                product.salePrice = Math.abs(price);
              } else {
                // Handle KDV included/excluded pricing
                if (salePriceIncludesVat) {
                  // If VAT included, store it as priceWithVat
                  product.priceWithVat = price;
                  
                  // Calculate the price without VAT if possible
                  if (product.vatRate !== undefined) {
                    product.salePrice = calculatePriceWithoutVat(price, product.vatRate);
                  } else {
                    // VAT rate not yet processed, use temporary value
                    product.salePrice = price;
                  }
                } else {
                  // If VAT excluded, store directly as salePrice
                  product.salePrice = price;
                  
                  // Calculate the price with VAT if possible
                  if (product.vatRate !== undefined) {
                    product.priceWithVat = Number(
                      (price * (1 + product.vatRate / 100)).toFixed(2)
                    );
                  } else {
                    // VAT rate not yet processed, use temporary value
                    product.priceWithVat = price;
                  }
                }
              }
              break;
            }
            case "stock": {
              // Türkçe sayı formatı için parseNumberWithTurkishSupport kullan
              const stock = parseNumberWithTurkishSupport(rawValue);
              if (stock === null) {
                warnings.push(`Geçersiz stok miktarı: "${rawValue}", varsayılan değer 0 kullanılacak`);
                product.stock = 0; // Default to 0
              } else if (stock < 0) {
                warnings.push(`Negatif stok miktarı: ${stock}, 0 kullanılacak`);
                product.stock = 0;
              } else {
                product.stock = Math.floor(stock); // Ensure it's an integer
              }
              break;
            }
            case "name": {
              const strValue = cleanValue(rawValue);
              if (!strValue) {
                throw new Error(`${SYSTEM_COLUMNS[systemField as keyof typeof SYSTEM_COLUMNS]} boş olamaz`);
              }
              product.name = strValue;
              break;
            }
            case "barcode": {
              const strValue = cleanValue(rawValue);
              if (!strValue) {
                throw new Error(`${SYSTEM_COLUMNS[systemField as keyof typeof SYSTEM_COLUMNS]} boş olamaz`);
              }
              // Remove any non-numeric characters from barcode
              const cleanedBarcode = strValue.replace(/\D/g, '');
              if (cleanedBarcode !== strValue) {
                warnings.push(`Barkod temizlendi: "${strValue}" -> "${cleanedBarcode}"`);
              }
              product.barcode = cleanedBarcode;
              break;
            }
            case "category": {
              const strValue = cleanValue(rawValue);
              if (!strValue) {
                warnings.push(`Kategori boş, varsayılan "Genel" kullanılacak`);
                product.category = "Genel"; // Default category
              } else {
                product.category = strValue;
              }
              break;
            }
          }
        } catch (error) {
          throw new Error(
            `Satır ${rowIndex + 2}, ${SYSTEM_COLUMNS[systemField as keyof typeof SYSTEM_COLUMNS] || systemField}: ${
              error instanceof Error ? error.message : "Bilinmeyen hata"
            }`
          );
        }
      }
  
      // Final validation and calculations after all fields are processed
      // Ensure VAT rate is set
      if (product.vatRate === undefined) {
        product.vatRate = 18; // Default VAT rate
        warnings.push("KDV oranı belirlenemedi, varsayılan %18 kullanıldı");
      }
      
      // Ensure price calculations are consistent
      if (salePriceIncludesVat && product.priceWithVat !== undefined) {
        // Recalculate sale price from price with VAT
        product.salePrice = calculatePriceWithoutVat(product.priceWithVat, product.vatRate);
      } 
      else if (!salePriceIncludesVat && product.salePrice !== undefined) {
        // Recalculate price with VAT from sale price
        product.priceWithVat = Number(
          (product.salePrice * (1 + product.vatRate / 100)).toFixed(2)
        );
      }
      
      // Check for missing required values and provide defaults
      if (product.purchasePrice === undefined) {
        product.purchasePrice = product.salePrice || 0;
        warnings.push("Alış fiyatı belirlenemedi, satış fiyatı kullanıldı");
      }
      
      if (product.salePrice === undefined) {
        product.salePrice = product.purchasePrice || 0;
        warnings.push("Satış fiyatı belirlenemedi, alış fiyatı kullanıldı");
      }
      
      if (product.priceWithVat === undefined) {
        product.priceWithVat = product.salePrice;
        warnings.push("KDV'li fiyat hesaplanamadı, satış fiyatı kullanıldı");
      }
      
      if (product.stock === undefined) {
        product.stock = 0;
        warnings.push("Stok miktarı belirlenemedi, 0 kullanıldı");
      }
      
      // Final NaN checks
      if (isNaN(product.salePrice) || isNaN(product.priceWithVat) || isNaN(product.purchasePrice)) {
        throw new Error(`Satır ${rowIndex + 2}: Fiyat hesaplamasında hata oluştu. Lütfen fiyat ve KDV değerlerini kontrol edin.`);
      }
      
      // Create complete product
      const completeProduct: Product = {
        id: 0,
        name: product.name!,
        barcode: product.barcode!,
        purchasePrice: product.purchasePrice,
        salePrice: product.salePrice,
        vatRate: product.vatRate,
        priceWithVat: product.priceWithVat,
        category: product.category!,
        stock: product.stock,
      };
      
      return {
        product: completeProduct,
        warning: warnings.length > 0 ? warnings.join("; ") : undefined
      };
    } catch (error) {
      return {
        product: null,
        warning: error instanceof Error ? error.message : "Bilinmeyen hata"
      };
    }
  };

  const validateMapping = () => {
    const newErrors: Record<SystemColumnKey, string> = {} as Record<
      SystemColumnKey,
      string
    >;
    let isValid = true;

    REQUIRED_FIELDS.forEach((field) => {
      if (!mapping[field]) {
        newErrors[
          field as SystemColumnKey
        ] = `${SYSTEM_COLUMNS[field as keyof typeof SYSTEM_COLUMNS]} alanı eşleştirilmeli`;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const readAllData = async (): Promise<Record<string, any>[]> => {
    if (file.name.endsWith(".csv")) {
      const result = await new Promise<Papa.ParseResult<Record<string, string>>>(
        (resolve, reject) => {
          Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: resolve,
            error: reject,
          });
        }
      );
      return result.data;
    } else {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);

      const worksheet = workbook.getWorksheet(1);
      if (!worksheet) throw new Error("Excel dosyası boş");

      const headers = worksheet.getRow(1).values as string[];
      headers.shift(); // Remove the first empty cell

      const data: Record<string, any>[] = [];
      
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header row
        
        const rowData: Record<string, any> = {};
        const values = row.values as any[];
        values.shift(); // Remove the first empty cell
        
        // Check if row is not empty
        if (values.some(val => val !== undefined && val !== null && val !== "")) {
          headers.forEach((header, index) => {
            if (header) { // Only process valid headers
              rowData[header] = values[index];
            }
          });
          data.push(rowData);
        }
      });

      return data;
    }
  };

  const handleImport = async () => {
    if (!validateMapping()) return;

    setIsProcessing(true);
    setProcessingErrors([]);
    setImportSummary(null);

    try {
      // Read all data from file
      const rawData = await readAllData();
      setRawData(rawData);
      
      // Process each row
      const products: Product[] = [];
      const summary: ImportSummary = {
        total: rawData.length,
        success: 0,
        skipped: 0,
        errors: [],
        warnings: []
      };
      
      rawData.forEach((row, index) => {
        const result = processRow(row, index);
        
        if (result.product) {
          products.push(result.product);
          summary.success++;
          
          if (result.warning) {
            summary.warnings.push({
              rowIndex: index + 2, // +2 because Excel rows start at 1 and we have a header row
              message: result.warning
            });
          }
        } else {
          summary.skipped++;
          if (result.warning) {
            summary.errors.push({
              rowIndex: index + 2,
              message: result.warning
            });
          }
        }
      });
      
      setImportSummary(summary);
      
      // Only proceed if we have products to import or if partial import is allowed
      if ((products.length > 0) && 
          (allowPartialImport || products.length === rawData.length)) {
        onImport(products);
        // Don't automatically close if there were errors
        if (summary.skipped === 0) {
          onClose();
        }
      } else if (products.length === 0) {
        setProcessingErrors([
          "Hiçbir ürün içe aktarılamadı. Lütfen veri formatını kontrol edin."
        ]);
      }
    } catch (error) {
      setProcessingErrors([
        `İçe aktarma hatası: ${
          error instanceof Error ? error.message : "Bilinmeyen hata"
        }`
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const generateErrorReport = () => {
    if (!importSummary) return;
    
    // Create CSV content
    const headers = ["Satır No", "Hata/Uyarı", "Veri"];
    const rows: string[][] = [];
    
    // Add errors
    importSummary.errors.forEach(error => {
      const rowData = rawData[error.rowIndex - 2]; // Convert back to 0-based index
      rows.push([
        error.rowIndex.toString(),
        "HATA: " + error.message,
        JSON.stringify(rowData)
      ]);
    });
    
    // Add warnings
    importSummary.warnings.forEach(warning => {
      const rowData = rawData[warning.rowIndex - 2]; // Convert back to 0-based index
      rows.push([
        warning.rowIndex.toString(),
        "UYARI: " + warning.message,
        JSON.stringify(rowData)
      ]);
    });
    
    // Generate CSV
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");
    
    // Create and download file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "iceri_aktarma_hata_raporu.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  // Display a maximum of 10 errors by default
  const displayErrors = showAllErrors 
    ? processingErrors 
    : processingErrors.slice(0, 10);
  
  const hasMoreErrors = processingErrors.length > 10 && !showAllErrors;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold">
              Excel Başlıklarını Eşleştir
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
              disabled={isProcessing}
            >
              <X size={20} />
            </button>
          </div>

          {/* Processing Errors */}
          {processingErrors.length > 0 && (
            <div className="mb-4 p-4 bg-red-50 rounded-lg">
              <div className="flex items-center gap-2 text-red-800 mb-2">
                <AlertTriangle size={20} />
                <span className="font-medium">Hatalar tespit edildi:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-red-700">
                {displayErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
              {hasMoreErrors && (
                <button 
                  onClick={() => setShowAllErrors(true)}
                  className="mt-2 text-blue-600 underline"
                >
                  {processingErrors.length - 10} daha fazla hata göster
                </button>
              )}
            </div>
          )}

          {/* Import Summary */}
          {importSummary && (
            <div className="mb-3 bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-blue-700">İçe Aktarma Özeti</h3>
                  <div className="text-sm space-y-1 mt-2">
                    <p>Toplam Satır: <span className="font-medium">{importSummary.total}</span></p>
                    <p>Başarılı: <span className="font-medium text-green-600">{importSummary.success}</span></p>
                    <p>Atlanılan: <span className="font-medium text-red-600">{importSummary.skipped}</span></p>
                    <p>Uyarılar: <span className="font-medium text-yellow-600">{importSummary.warnings.length}</span></p>
                  </div>
                </div>
                
                {(importSummary.errors.length > 0 || importSummary.warnings.length > 0) && (
                  <button
                    onClick={generateErrorReport}
                    className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Download size={16} />
                    Hata Raporu İndir
                  </button>
                )}
              </div>
              
              {importSummary.skipped > 0 && (
                <div className="mt-3 pt-3 border-t border-blue-200">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="allowPartial"
                      checked={allowPartialImport}
                      onChange={(e) => setAllowPartialImport(e.target.checked)}
                      className="mr-2"
                    />
                    <label htmlFor="allowPartial" className="text-sm text-blue-800">
                      Hatalı satırları atlayarak kısmi içe aktarmaya izin ver
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* KDV Dahil Switch */}
          <div className="mb-3 bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-blue-700">Satış Fiyatı Formatı</h3>
                <p className="text-sm text-blue-600 mt-1">
                  Excel/CSV dosyanızdaki satış fiyatı KDV dahil mi?
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={salePriceIncludesVat}
                  onChange={() => setSalePriceIncludesVat(!salePriceIncludesVat)}
                  className="sr-only peer"
                  disabled={isProcessing}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                <span className="ml-3 text-sm font-medium text-gray-700">
                  {salePriceIncludesVat ? "KDV Dahil" : "KDV Hariç"}
                </span>
              </label>
            </div>
          </div>

          {/* Column Mapping */}
          <div className="space-y-4">
            {REQUIRED_FIELDS.map((field) => (
              <div key={field} className="flex items-center gap-4">
                <div className="w-1/3">
                  <label className="text-sm font-medium text-gray-700">
                    {SYSTEM_COLUMNS[field]}
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                </div>
                <div className="w-2/3">
                  <select
                    value={mapping[field] || ""}
                    onChange={(e) =>
                      setMapping((prev) => ({
                        ...prev,
                        [field]: e.target.value,
                      }))
                    }
                    disabled={isProcessing}
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  >
                    <option value="">Seçiniz</option>
                    {headers.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                  {errors[field] && (
                    <p className="text-sm text-red-500 mt-1">{errors[field]}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Data Preview */}
          {previewData.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Önizleme (İlk 3 Satır)
              </h3>
              <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {headers.map((header) => (
                        <th
                          key={header}
                          className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {previewData.map((row, idx) => (
                      <tr key={idx}>
                        {row.map((cell, cellIdx) => (
                          <td
                            key={cellIdx}
                            className="px-3 py-2 text-sm text-gray-500 whitespace-nowrap"
                          >
                            {cell?.toString() || ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              İptal
            </button>
            <button
              onClick={handleImport}
              disabled={isProcessing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Save size={16} />
              {isProcessing ? "İşleniyor..." : "İçe Aktar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ColumnMappingModal;
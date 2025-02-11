import React, { useState, useEffect } from "react";
import { Save, X, AlertTriangle } from "lucide-react";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import { Product, VatRate } from "../types/product";

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
  

  useEffect(() => {
    if (file) {
      readFileHeaders();
    }
  }, [file]);

  const suggestMapping = (headers: string[]) => {
    const suggestedMapping: Record<SystemColumnKey, string> = {} as Record<SystemColumnKey, string>;
    
    // Başlıkları normalize et ve eşleştir
    headers.forEach((header) => {
      const normalizedHeader = header.toLowerCase()
        .replace(/\s+/g, '') // boşlukları kaldır
        .replace(/[iıİI]/g, 'i') // Türkçe karakterleri normalize et
        .replace(/[şŞ]/g, 's')
        .replace(/[çÇ]/g, 'c')
        .replace(/[ğĞ]/g, 'g')
        .replace(/[üÜ]/g, 'u')
        .replace(/[öÖ]/g, 'o');

      // Sistem kolonlarını kontrol et
      Object.entries(SYSTEM_COLUMNS).forEach(([key, value]) => {
        const normalizedValue = value.toLowerCase()
          .replace(/\s+/g, '')
          .replace(/[iıİI]/g, 'i')
          .replace(/[şŞ]/g, 's')
          .replace(/[çÇ]/g, 'c')
          .replace(/[ğĞ]/g, 'g')
          .replace(/[üÜ]/g, 'u')
          .replace(/[öÖ]/g, 'o');

        // Tam eşleşme veya benzer eşleşme kontrolü
        if (normalizedHeader === normalizedValue ||
            normalizedHeader.includes(normalizedValue) ||
            normalizedValue.includes(normalizedHeader)) {
          suggestedMapping[key as SystemColumnKey] = header;
        }
      });
    });

    setMapping(suggestedMapping);
  };


  const readFileHeaders = async () => {
    setProcessingErrors([]);
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
    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);

    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) throw new Error("Excel dosyası boş");

    const headers: string[] = [];
    const previewRows: any[][] = [];

    worksheet.eachRow((row, rowNumber) => {
      const rowData = row.values as any[];
      rowData.shift(); // İlk boş hücreyi atla

      if (rowNumber === 1) {
        headers.push(
          ...rowData.map((cell) => cell?.toString().trim()).filter(Boolean)
        );
      } else if (rowNumber <= 4) {
        previewRows.push(rowData.map((cell) => cell?.toString().trim()));
      }
    });

    if (headers.length === 0) {
      throw new Error("Excel başlıkları bulunamadı");
    }

    setHeaders(headers);
    setPreviewData(previewRows);
    suggestMapping(headers);
  };

  const cleanValue = (value: any): string => {
    if (value === null || value === undefined) return "";
    return value.toString().trim();
  };

  const parseNumber = (value: any, fieldName: string): number => {
    const cleaned = cleanValue(value);
    const number = Number(cleaned.replace(/,/g, "."));
    if (isNaN(number)) {
      throw new Error(`${fieldName} sayısal bir değer olmalıdır`);
    }
    return number;
  };

  const processRow = (
    row: Record<string, any>,
    rowIndex: number
  ): Product | null => {
    try {
      const product: Partial<Product> = {};

      // Tüm zorunlu alanları kontrol et
      for (const field of REQUIRED_FIELDS) {
        const fileField = mapping[field];
        if (!fileField || !row[fileField]) {
          throw new Error(`${SYSTEM_COLUMNS[field]} alanı boş olamaz`);
        }
      }

      // Değerleri dönüştür ve doğrula
      for (const [systemField, fileField] of Object.entries(mapping)) {
        const rawValue = row[fileField];

        try {
          switch (systemField) {
            case "vatRate": {
              const vatRate = parseNumber(
                rawValue,
                SYSTEM_COLUMNS[systemField]
              );
              if (![0, 1, 8, 18, 20].includes(vatRate)) {
                throw new Error(
                  `Geçersiz KDV oranı: ${vatRate}. Geçerli değerler: 0, 1, 8, 18, 20`
                );
              }
              product.vatRate = vatRate as VatRate;
              break;
            }
            case "purchasePrice":
            case "salePrice": {
              const price = parseNumber(rawValue, SYSTEM_COLUMNS[systemField]);
              if (price < 0) {
                throw new Error(
                  `${SYSTEM_COLUMNS[systemField]} negatif olamaz`
                );
              }
              product[systemField] = price;
              break;
            }
            case "stock": {
              const stock = parseNumber(rawValue, SYSTEM_COLUMNS[systemField]);
              if (stock < 0) {
                throw new Error("Stok miktarı negatif olamaz");
              }
              product.stock = stock;
              break;
            }
            case "name":
            case "barcode": {
              const strValue = cleanValue(rawValue);
              if (!strValue) {
                throw new Error(`${SYSTEM_COLUMNS[systemField]} boş olamaz`);
              }
              product[systemField] = strValue;
              break;
            }
            case "category": {
              const strValue = cleanValue(rawValue);
              if (!strValue) {
                throw new Error("Kategori boş olamaz");
              }
              product.category = strValue;
              break;
            }
          }
        } catch (error) {
          throw new Error(
            `Satır ${rowIndex + 2}: ${
              error instanceof Error ? error.message : "Bilinmeyen hata"
            }`
          );
        }
      }

      const completeProduct: Product = {
        id: 0,
        name: product.name!,
        barcode: product.barcode!,
        purchasePrice: product.purchasePrice!,
        salePrice: product.salePrice!,
        vatRate: product.vatRate!,
        priceWithVat: Number(
          (product.salePrice! * (1 + product.vatRate! / 100)).toFixed(2)
        ),
        category: product.category!,
        stock: product.stock!,
      };

      return completeProduct;
    } catch (error) {
      setProcessingErrors((prev) => [
        ...prev,
        error instanceof Error ? error.message : "Bilinmeyen hata",
      ]);
      return null;
    }
  };

  const handleImport = async () => {
    if (!validateMapping()) return;

    setIsProcessing(true);
    setProcessingErrors([]);

    try {
      let rawData: Record<string, any>[] = [];

      if (file.name.endsWith(".csv")) {
        const result = await new Promise<
          Papa.ParseResult<Record<string, string>>
        >((resolve, reject) => {
          Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: resolve,
            error: reject,
          });
        });
        rawData = result.data;
      } else {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(arrayBuffer);

        const worksheet = workbook.getWorksheet(1);
        if (!worksheet) throw new Error("Excel dosyası boş");

        const headers = worksheet.getRow(1).values as string[];
        headers.shift(); // İlk boş hücreyi atla

        rawData = [];
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return; // Başlık satırını atla

          const rowData: Record<string, any> = {};
          const values = row.values as any[];
          values.shift(); // İlk boş hücreyi atla

          headers.forEach((header, index) => {
            rowData[header] = values[index];
          });

          rawData.push(rowData);
        });
      }

      const products: Product[] = [];
      rawData.forEach((row, index) => {
        const product = processRow(row, index);
        if (product) products.push(product);
      });

      if (processingErrors.length === 0 && products.length > 0) {
        onImport(products);
        onClose();
      }
    } catch (error) {
      setProcessingErrors((prev) => [
        ...prev,
        `İşlem hatası: ${
          error instanceof Error ? error.message : "Bilinmeyen hata"
        }`,
      ]);
    } finally {
      setIsProcessing(false);
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
        ] = `${SYSTEM_COLUMNS[field]} alanı eşleştirilmeli`;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
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

          {processingErrors.length > 0 && (
            <div className="mb-4 p-4 bg-red-50 rounded-lg">
              <div className="flex items-center gap-2 text-red-800 mb-2">
                <AlertTriangle size={20} />
                <span className="font-medium">Hatalar tespit edildi:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-red-700">
                {processingErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

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

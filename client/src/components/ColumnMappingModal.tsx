import React, { useState, useEffect } from 'react';
import { Save, X } from 'lucide-react';
import ExcelJS from 'exceljs';
import Papa from 'papaparse';
import { Product, VatRate } from '../types/product';

interface ColumnMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: File;
  onImport: (products: Product[]) => void;
}

type SystemColumnKey = keyof typeof SYSTEM_COLUMNS;

const REQUIRED_FIELDS = ['name', 'barcode', 'purchasePrice', 'salePrice', 'vatRate', 'stock', 'category'] as const;

const SYSTEM_COLUMNS = {
  name: 'Ürün Adı',
  barcode: 'Barkod',
  purchasePrice: 'Alış Fiyatı',
  salePrice: 'Satış Fiyatı',
  vatRate: 'KDV Oranı',
  stock: 'Stok',
  category: 'Kategori'
} as const;

const ColumnMappingModal: React.FC<ColumnMappingModalProps> = ({ isOpen, onClose, file, onImport }) => {
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<SystemColumnKey, string>>({} as Record<SystemColumnKey, string>);
  const [previewData, setPreviewData] = useState<any[][]>([]);
  const [errors, setErrors] = useState<Record<SystemColumnKey, string>>({} as Record<SystemColumnKey, string>);

  useEffect(() => {
    if (file) {
      readFileHeaders();
    }
  }, [file]);

  const readFileHeaders = async () => {
    try {
      if (file.name.endsWith('.csv')) {
        await readCSV();
      } else {
        await readExcel();
      }
    } catch (error) {
      console.error('Dosya okuma hatası:', error);
    }
  };

  // CSV için
const readCSV = () => {
    return new Promise<void>((resolve, reject) => {
      Papa.parse<Record<string, string>>(file, {
        header: true,
        preview: 4,
        encoding: 'utf-8',
        complete: (results) => {
          if (results.data.length > 0) {
            const headers = Object.keys(results.data[0]);
            setHeaders(headers);
            setPreviewData(results.data.slice(0, 3).map(row => headers.map(h => row[h])));
            suggestMapping(headers);
          }
          resolve();
        },
        error: (error) => {
          reject(error);
        }
      });
    });
  };
  

  const readExcel = async () => {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);
    
    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) throw new Error('Excel dosyası boş');

    const headers: string[] = [];
    const previewRows: any[][] = [];
    
    worksheet.eachRow((row, rowNumber) => {
      const rowData = row.values as any[];
      rowData.shift();

      if (rowNumber === 1) {
        headers.push(...rowData);
      } else if (rowNumber <= 4) {
        previewRows.push(rowData);
      }
    });

    setHeaders(headers);
    setPreviewData(previewRows);
    suggestMapping(headers);
  };

  const suggestMapping = (headers: string[]) => {
    const suggestedMapping: Record<SystemColumnKey, string> = {} as Record<SystemColumnKey, string>;
    headers.forEach((header) => {
      const normalizedHeader = header.toLowerCase().replace(/\s+/g, '');
      (Object.entries(SYSTEM_COLUMNS) as [SystemColumnKey, string][]).forEach(([key, value]) => {
        if (normalizedHeader === value.toLowerCase().replace(/\s+/g, '')) {
          suggestedMapping[key] = header;
        }
      });
    });
    setMapping(suggestedMapping);
  };

  const validateMapping = () => {
    const newErrors: Record<SystemColumnKey, string> = {} as Record<SystemColumnKey, string>;
    REQUIRED_FIELDS.forEach(field => {
      if (!mapping[field]) {
        newErrors[field as SystemColumnKey] = `${SYSTEM_COLUMNS[field as SystemColumnKey]} alanı eşleştirilmeli`;
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleImport = async () => {
    if (!validateMapping()) return;

    try {
      let products: Product[] = [];

      if (file.name.endsWith('.csv')) {
        products = await processCSV();
      } else {
        products = await processExcel();
      }

      onImport(products);
      onClose();
    } catch (error) {
      console.error('Veri dönüştürme hatası:', error);
    }
  };

  const processCSV = (): Promise<Product[]> => {
    return new Promise((resolve, reject) => {
      Papa.parse<Record<string, string>>(file, {
        header: true,
        complete: (results) => {
          const products = results.data
            .map((row) => processRow(row))
            .filter((p): p is Product => p !== null);
          resolve(products);
        },
        error: reject
      });
    });
  };

  const processExcel = async (): Promise<Product[]> => {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);
    
    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) throw new Error('Excel dosyası boş');

    const products: Product[] = [];
    const headerRow = worksheet.getRow(1).values as string[];
    
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      
      const rowData: Record<string, any> = {};
      headerRow.forEach((header, index) => {
        if (index > 0) {
          rowData[header] = row.getCell(index).value;
        }
      });
      
      const product = processRow(rowData);
      if (product) products.push(product);
    });

    return products;
  };

  const processRow = (row: Record<string, any>): Product | null => {
    try {
      const product: Partial<Product> = {};

      for (const [systemField, fileField] of Object.entries(mapping)) {
        const value = row[fileField];

        if (value === null || value === undefined) {
          if (REQUIRED_FIELDS.includes(systemField as any)) {
            throw new Error(`${SYSTEM_COLUMNS[systemField as SystemColumnKey]} boş olamaz`);
          }
          continue;
        }

        switch(systemField) {
          case 'vatRate': {
            const vatRate = Number(value);
            if (![0, 1, 8, 18, 20].includes(vatRate)) {
              throw new Error(`Geçersiz KDV oranı: ${vatRate}. Geçerli değerler: 0, 1, 8, 18, 20`);
            }
            product.vatRate = vatRate as VatRate;
            break;
          }
          case 'purchasePrice':
          case 'salePrice': {
            const price = Number(value);
            if (isNaN(price) || price < 0) {
              throw new Error(`${SYSTEM_COLUMNS[systemField as SystemColumnKey]} geçersiz`);
            }
            product[systemField] = price;
            break;
          }
          case 'stock': {
            const stock = Number(value);
            if (isNaN(stock) || stock < 0) {
              throw new Error('Stok miktarı negatif olamaz');
            }
            product.stock = stock;
            break;
          }
          case 'name':
          case 'barcode': {
            const strValue = value.toString().trim();
            if (!strValue) {
              throw new Error(`${SYSTEM_COLUMNS[systemField as SystemColumnKey]} boş olamaz`);
            }
            product[systemField] = strValue;
            break;
          }
          default:
            product[systemField as keyof Product] = value.toString();
        }
      }

      // Zorunlu alanları kontrol et
      REQUIRED_FIELDS.forEach(field => {
        if (!product[field]) {
          throw new Error(`${SYSTEM_COLUMNS[field]} alanı zorunludur`);
        }
      });

      // KDV'li fiyat hesapla
      const completeProduct: Product = {
        id: 0,
        name: product.name!,
        barcode: product.barcode!,
        purchasePrice: product.purchasePrice!,
        salePrice: product.salePrice!,
        vatRate: product.vatRate!,
        priceWithVat: product.salePrice! * (1 + (product.vatRate! / 100)),
        category: product.category || 'Genel',
        stock: product.stock!
      };

      return completeProduct;
    } catch (error) {
      console.warn('Satır işleme hatası:', error);
      return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold">Excel Başlıklarını Eşleştir</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X size={20} />
            </button>
          </div>

          <div className="space-y-4">
            {REQUIRED_FIELDS.map((field) => (
              <div key={field} className="flex items-center gap-4">
                <div className="w-1/3">
                  <label className="text-sm font-medium text-gray-700">
                    {SYSTEM_COLUMNS[field]}
                    {errors[field] && <span className="text-red-500 ml-1">*</span>}
                  </label>
                </div>
                <div className="w-2/3">
                  <select
                    value={mapping[field] || ''}
                    onChange={(e) => setMapping(prev => ({
                      ...prev,
                      [field]: e.target.value
                    }))}
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Seçiniz</option>
                    {headers.map((header) => (
                      <option key={header} value={header}>{header}</option>
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
                        <th key={header} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {previewData.map((row, idx) => (
                      <tr key={idx}>
                        {row.map((cell, cellIdx) => (
                          <td key={cellIdx} className="px-3 py-2 text-sm text-gray-500">
                            {cell?.toString()}
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
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              İptal
            </button>
            <button
              onClick={handleImport}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Save size={16} />
              İçe Aktar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ColumnMappingModal;
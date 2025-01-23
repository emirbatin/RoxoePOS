import { Product } from "../types/pos";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import { productService } from "./productDB";

// Custom error class
class ProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProcessingError";
  }
}

class ImportExportService {
  // Excel'den içe aktarma
  async importFromExcel(file: File): Promise<Product[]> {
    try {
      const workbook = new ExcelJS.Workbook();
      const arrayBuffer = await file.arrayBuffer();
      await workbook.xlsx.load(arrayBuffer);
      const worksheet = workbook.getWorksheet(1);

      if (!worksheet) throw new ProcessingError("Excel dosyası boş");

      const products: Product[] = [];
      const headers = this.getHeaders(worksheet);

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;

        try {
          const product = this.processExcelRow(row, headers);
          products.push(product);
        } catch (error) {
          if (error instanceof ProcessingError) {
            throw new ProcessingError(`Satır ${rowNumber}: ${error.message}`);
          } else {
            throw new ProcessingError(
              `Satır ${rowNumber}: Beklenmeyen bir hata oluştu`
            );
          }
        }
      });

      // Elde edilen ürünleri veritabanına ekle
      await productService.bulkInsertProducts(products);

      return products;
    } catch (error) {
      if (error instanceof ProcessingError) {
        throw error;
      } else {
        throw new ProcessingError("Dosya işlenirken bir hata oluştu");
      }
    }
  }

  // Excel'e aktarma
  async exportToExcel(
    products: Product[],
    fileName: string = "urunler.xlsx"
  ): Promise<void> {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Ürünler");

      // Başlıkları ayarla
      worksheet.columns = [
        { header: "Barkod", key: "barcode", width: 15 },
        { header: "Ürün Adı", key: "name", width: 30 },
        { header: "Kategori", key: "category", width: 15 },
        { header: "Fiyat (KDV Hariç)", key: "price", width: 15 },
        { header: "KDV Oranı", key: "vatRate", width: 10 },
        { header: "Fiyat (KDV Dahil)", key: "priceWithVat", width: 15 },
        { header: "Stok", key: "stock", width: 10 },
      ];

      // Başlık stilini ayarla
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE9ECEF" },
      };

      // Verileri ekle
      products.forEach((product) => {
        worksheet.addRow({
          barcode: product.barcode,
          name: product.name,
          category: product.category,
          price: product.price,
          vatRate: product.vatRate,
          priceWithVat: product.priceWithVat,
          stock: product.stock,
        });
      });

      // Dosyayı oluştur ve indir
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      throw new ProcessingError("Dışa aktarma sırasında bir hata oluştu");
    }
  }

  // CSV'den içe aktarma
  importFromCSV(file: File): Promise<Product[]> {
    return new Promise((resolve, reject) => {
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            const products: Product[] = results.data.map((row, index) => {
              try {
                return this.processCSVRow(row, index + 2);
              } catch (error) {
                if (error instanceof ProcessingError) {
                  throw new ProcessingError(
                    `Satır ${index + 2}: ${error.message}`
                  );
                }
                throw new ProcessingError(
                  `Satır ${index + 2}: Beklenmeyen bir hata oluştu`
                );
              }
            });

            // Elde edilen ürünleri veritabanına ekle
            await productService.bulkInsertProducts(products);

            resolve(products);
          } catch (error) {
            reject(error);
          }
        },
        error: (error) => reject(new ProcessingError(error.message)),
      });
    });
  }

  // CSV'ye aktarma
  exportToCSV(products: Product[], fileName: string = "urunler.csv"): void {
    try {
      const data = products.map((product) => ({
        Barkod: product.barcode,
        "Ürün Adı": product.name,
        Kategori: product.category,
        "Fiyat (KDV Hariç)": product.price,
        "KDV Oranı": product.vatRate,
        "Fiyat (KDV Dahil)": product.priceWithVat,
        Stok: product.stock,
      }));

      const csv = Papa.unparse(data);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      throw new ProcessingError("CSV dışa aktarma sırasında bir hata oluştu");
    }
  }

  // Şablon oluşturma
  async generateTemplate(type: "excel" | "csv" = "excel"): Promise<void> {
    try {
      const template = [
        {
          Barkod: "8680000000001",
          "Ürün Adı": "Örnek Ürün",
          Kategori: "Genel",
          "Fiyat (KDV Hariç)": 100,
          "KDV Oranı": 18,
          "Fiyat (KDV Dahil)": 118,
          Stok: 10,
        },
      ];

      if (type === "excel") {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Şablon");

        worksheet.columns = [
          { header: "Barkod", key: "barcode", width: 15 },
          { header: "Ürün Adı", key: "name", width: 30 },
          { header: "Kategori", key: "category", width: 15 },
          { header: "Fiyat (KDV Hariç)", key: "price", width: 15 },
          { header: "KDV Oranı", key: "vatRate", width: 10 },
          { header: "Fiyat (KDV Dahil)", key: "priceWithVat", width: 15 },
          { header: "Stok", key: "stock", width: 10 },
        ];

        worksheet.getRow(1).font = { bold: true };
        worksheet.addRow(template[0]);

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "urun_sablonu.xlsx";
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        this.exportToCSV(template as unknown as Product[], "urun_sablonu.csv");
      }
    } catch (error) {
      throw new ProcessingError("Şablon oluşturulurken bir hata oluştu");
    }
  }

  // Yardımcı metodlar
  private getHeaders(worksheet: ExcelJS.Worksheet): Map<string, number> {
    const headers = new Map<string, number>();
    const headerRow = worksheet.getRow(1);

    headerRow.eachCell((cell, colNumber) => {
      const value = cell.value?.toString();
      if (value) {
        headers.set(value, colNumber);
      }
    });

    return headers;
  }

  private processExcelRow(
    row: ExcelJS.Row,
    headers: Map<string, number>
  ): Product {
    try {
      const getValue = (header: string): string => {
        const colNumber = headers.get(header);
        if (!colNumber)
          throw new ProcessingError(`'${header}' sütunu bulunamadı`);
        return row.getCell(colNumber).value?.toString() || "";
      };

      const name = getValue("Ürün Adı");
      const priceStr = getValue("Fiyat (KDV Hariç)");
      const vatRateStr = getValue("KDV Oranı");
      const barcode = getValue("Barkod");

      if (!name) throw new ProcessingError("Ürün adı boş olamaz");
      if (!priceStr) throw new ProcessingError("Fiyat boş olamaz");
      if (!vatRateStr) throw new ProcessingError("KDV oranı boş olamaz");
      if (!barcode) throw new ProcessingError("Barkod boş olamaz");

      const price = Number(priceStr);
      const vatRate = Number(vatRateStr);
      const stock = Number(getValue("Stok") || "0");

      if (isNaN(price) || price < 0)
        throw new ProcessingError("Geçersiz fiyat");
      if (![0, 1, 8, 18, 20].includes(vatRate))
        throw new ProcessingError("Geçersiz KDV oranı");
      if (isNaN(stock) || stock < 0)
        throw new ProcessingError("Geçersiz stok miktarı");

      return {
        id: 0,
        name,
        price,
        vatRate: vatRate as Product["vatRate"],
        priceWithVat: price * (1 + vatRate / 100),
        category: getValue("Kategori") || "Genel",
        stock,
        barcode,
      };
    } catch (error) {
      if (error instanceof ProcessingError) {
        throw error;
      }
      throw new ProcessingError("Beklenmeyen bir hata oluştu");
    }
  }

  private processCSVRow(
    row: Record<string, string>,
    rowNumber: number
  ): Product {
    try {
      if (!row["Ürün Adı"]) throw new ProcessingError("Ürün adı boş olamaz");
      if (!row["Fiyat (KDV Hariç)"])
        throw new ProcessingError("Fiyat boş olamaz");
      if (!row["KDV Oranı"]) throw new ProcessingError("KDV oranı boş olamaz");
      if (!row["Barkod"]) throw new ProcessingError("Barkod boş olamaz");

      const price = Number(row["Fiyat (KDV Hariç)"]);
      const vatRate = Number(row["KDV Oranı"]);
      const stock = Number(row["Stok"] || 0);

      if (isNaN(price) || price < 0)
        throw new ProcessingError("Geçersiz fiyat");
      if (![0, 1, 8, 18, 20].includes(vatRate))
        throw new ProcessingError("Geçersiz KDV oranı");
      if (isNaN(stock) || stock < 0)
        throw new ProcessingError("Geçersiz stok miktarı");

      return {
        id: 0,
        name: row["Ürün Adı"],
        price,
        vatRate: vatRate as Product["vatRate"],
        priceWithVat: price * (1 + vatRate / 100),
        category: row["Kategori"] || "Genel",
        stock,
        barcode: String(row["Barkod"]),
      };
    } catch (error) {
      if (error instanceof ProcessingError) {
        throw error;
      }
      throw new ProcessingError("Beklenmeyen bir hata oluştu");
    }
  }
}

export const importExportService = new ImportExportService();

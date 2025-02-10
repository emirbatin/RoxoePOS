import { Product } from "../types/product";
import ExcelJS from "exceljs";
import Papa from "papaparse";

class ProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProcessingError";
  }
}

class ImportExportService {
  async exportToExcel(products: Product[], fileName: string = "urunler.xlsx"): Promise<void> {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Ürünler");

      worksheet.columns = [
        { header: "Barkod", key: "barcode", width: 15 },
        { header: "Ürün Adı", key: "name", width: 30 },
        { header: "Kategori", key: "category", width: 15 },
        { header: "Alış Fiyatı", key: "purchasePrice", width: 15 },
        { header: "Satış Fiyatı", key: "salePrice", width: 15 },
        { header: "KDV Oranı", key: "vatRate", width: 10 },
        { header: "KDV'li Fiyat", key: "priceWithVat", width: 15 },
        { header: "Stok", key: "stock", width: 10 },
      ];

      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE9ECEF" },
      };

      products.forEach((product) => {
        worksheet.addRow(product);
      });

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

  exportToCSV(products: Product[], fileName: string = "urunler.csv"): void {
    try {
      const data = products.map((product) => ({
        Barkod: product.barcode,
        "Ürün Adı": product.name,
        Kategori: product.category,
        "Alış Fiyatı": product.purchasePrice,
        "Satış Fiyatı": product.salePrice,
        "KDV Oranı": product.vatRate,
        "KDV'li Fiyat": product.priceWithVat,
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

  async generateTemplate(type: "excel" | "csv" = "excel"): Promise<void> {
    try {
      const template = {
        barcode: "8680000000001",
        name: "Örnek Ürün",
        category: "Genel",
        purchasePrice: 85,
        salePrice: 100,
        vatRate: 18,
        priceWithVat: 118,
        stock: 10,
      };

      if (type === "excel") {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Şablon");

        worksheet.columns = [
          { header: "Barkod", key: "barcode", width: 15 },
          { header: "Ürün Adı", key: "name", width: 30 },
          { header: "Kategori", key: "category", width: 15 },
          { header: "Alış Fiyatı", key: "purchasePrice", width: 15 },
          { header: "Satış Fiyatı", key: "salePrice", width: 15 },
          { header: "KDV Oranı", key: "vatRate", width: 10 },
          { header: "KDV'li Fiyat", key: "priceWithVat", width: 15 },
          { header: "Stok", key: "stock", width: 10 },
        ];

        worksheet.getRow(1).font = { bold: true };
        worksheet.addRow(template);

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
        this.exportToCSV([template as Product], "urun_sablonu.csv");
      }
    } catch (error) {
      throw new ProcessingError("Şablon oluşturulurken bir hata oluştu");
    }
  }
}

export const importExportService = new ImportExportService();
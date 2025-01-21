import { Sale } from "../types/sales";

const SALES_STORAGE_KEY = "pos_sales";

class SalesService {
  private generateSaleId(): string {
    return `SALE-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateReceiptNo(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    // Local storage'dan bugünün satış sayısını al
    const dailyKey = `${year}${month}${day}_count`;
    const currentCount = localStorage.getItem(dailyKey);
    const newCount = currentCount ? parseInt(currentCount) + 1 : 1;

    // Satış sayısını güncelle
    localStorage.setItem(dailyKey, newCount.toString());

    // Fiş numarasını oluştur: FYYYYMMDDxxx (x: o günkü satış sırası)
    return `F${year}${month}${day}${String(newCount).padStart(3, "0")}`;
  }

  getAllSales(): Sale[] {
    const salesJson = localStorage.getItem(SALES_STORAGE_KEY);
    if (!salesJson) return [];

    try {
      const sales = JSON.parse(salesJson);
      // Date stringlerini Date objelerine çevir
      return sales.map((sale: any) => ({
        ...sale,
        date: new Date(sale.date),
        refundDate: sale.refundDate ? new Date(sale.refundDate) : undefined,
      }));
    } catch (error) {
      console.error("Satış verilerini okuma hatası:", error);
      return [];
    }
  }

  getSaleById(id: string): Sale | null {
    const sales = this.getAllSales();
    const sale = sales.find((s) => s.id === id);
    if (!sale) return null;

    // Date nesnelerini düzgün formata çevir
    return {
      ...sale,
      date: new Date(sale.date),
      refundDate: sale.refundDate ? new Date(sale.refundDate) : undefined,
    };
  }

  addSale(saleData: Omit<Sale, "id" | "receiptNo" | "status">): Sale {
    const sales = this.getAllSales();

    const newSale: Sale = {
      ...saleData,
      id: this.generateSaleId(),
      receiptNo: this.generateReceiptNo(),
      status: "completed",
    };

    sales.push(newSale);
    localStorage.setItem(SALES_STORAGE_KEY, JSON.stringify(sales));

    return newSale;
  }

  updateSale(saleId: string, updates: Partial<Sale>): Sale | null {
    const sales = this.getAllSales();
    const index = sales.findIndex((s) => s.id === saleId);

    if (index === -1) return null;

    const updatedSale = { ...sales[index], ...updates };
    sales[index] = updatedSale;

    localStorage.setItem(SALES_STORAGE_KEY, JSON.stringify(sales));
    return updatedSale;
  }

  getSaleByReceiptNo(receiptNo: string): Sale | null {
    const sales = this.getAllSales();
    return sales.find((sale) => sale.receiptNo === receiptNo) || null;
  }

  cancelSale(saleId: string, reason: string): Sale | null {
    return this.updateSale(saleId, {
      status: "cancelled",
      cancelReason: reason,
    });
  }

  refundSale(saleId: string, reason: string): Sale | null {
    return this.updateSale(saleId, {
      status: "refunded",
      refundReason: reason,
      refundDate: new Date(),
    });
  }

  getDailySales(date: Date = new Date()): Sale[] {
    const sales = this.getAllSales();
    return sales.filter((sale) => {
      const saleDate = new Date(sale.date);
      return (
        saleDate.getDate() === date.getDate() &&
        saleDate.getMonth() === date.getMonth() &&
        saleDate.getFullYear() === date.getFullYear()
      );
    });
  }
}

export const salesService = new SalesService();

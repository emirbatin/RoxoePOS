// salesDB.ts
import { Sale, DiscountInfo } from "../types/sales";
import { discountService } from "../services/discountService";
import DBVersionHelper from '../helpers/DBVersionHelper';

const DB_NAME = "salesDB";
const STORE_NAME = "sales";

// IndexedDB veritabanını başlatma - DBVersionHelper kullanarak
async function initSalesDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const dbVersion = DBVersionHelper.getVersion(DB_NAME);
    const request = indexedDB.open(DB_NAME, dbVersion);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      console.log(`Upgrading ${DB_NAME} from ${event.oldVersion} to ${event.newVersion}`);
      
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
        console.log(`Created ${STORE_NAME} store`);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

class SalesService {
  // Satış ekleme
  async addSale(saleData: Omit<Sale, "id">): Promise<Sale> {
    const db = await initSalesDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      // İndirimsiz durumu önce kontrol et
      let finalData: Omit<Sale, "id"> = { ...saleData };
      
      // İndirim varsa
      if (saleData.discount) {
        // Orijinal tutarı öncelikle originalTotal'den al, yoksa total'den
        const originalTotal = saleData.originalTotal || saleData.total;
        
        // Yeni kayıt için veriyi hazırla
        finalData = {
          ...saleData,
          // İndirimli tutarı total'e ata
          total: saleData.discount.discountedTotal,
          // Orijinal tutarı (indirimsiz) originalTotal olarak sakla
          originalTotal: originalTotal
        };
      }

      const newSale: Sale = {
        ...finalData,
        id: `SALE-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      };

      const request = store.add(newSale);

      request.onsuccess = () => {
        resolve(newSale);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // Tüm satışları alma
  async getAllSales(): Promise<Sale[]> {
    const db = await initSalesDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);

      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result as Sale[]);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // Filtrelenmiş satışları getirme (indirim filtresi dahil)
  async getSalesWithFilter(filter: {
    startDate?: Date;
    endDate?: Date;
    status?: string;
    paymentMethod?: string;
    hasDiscount?: boolean;
  }): Promise<Sale[]> {
    const sales = await this.getAllSales();
    
    return sales.filter(sale => {
      // Tarih filtresi
      if (filter.startDate && new Date(sale.date) < filter.startDate) return false;
      if (filter.endDate) {
        const endDateCopy = new Date(filter.endDate);
        endDateCopy.setHours(23, 59, 59, 999);
        if (new Date(sale.date) > endDateCopy) return false;
      }
      
      // Durum filtresi
      if (filter.status && sale.status !== filter.status) return false;
      
      // Ödeme yöntemi filtresi
      if (filter.paymentMethod && sale.paymentMethod !== filter.paymentMethod) return false;
      
      // İndirim filtresi
      if (filter.hasDiscount === true && !sale.discount) return false;
      if (filter.hasDiscount === false && sale.discount) return false;
      
      return true;
    });
  }

  // Satış ID ile bir satış alma
  async getSaleById(id: string): Promise<Sale | null> {
    const db = await initSalesDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);

      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // Satışı güncelleme
  async updateSale(saleId: string, updates: Partial<Sale>): Promise<Sale | null> {
    const db = await initSalesDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      const getRequest = store.get(saleId);

      getRequest.onsuccess = () => {
        const sale = getRequest.result;
        if (!sale) {
          resolve(null);
          return;
        }

        let finalUpdates = { ...updates };
        
        // Eğer güncelleme içinde indirim bilgisi varsa
        if (updates.discount) {
          // Orijinal tutarı, mevcut originalTotal veya total değerinden al
          const originalTotal = updates.originalTotal || sale.originalTotal || sale.total;
          
          finalUpdates = {
            ...updates,
            total: updates.discount.discountedTotal,
            originalTotal: originalTotal
          };
        }

        const updatedSale = { ...sale, ...finalUpdates };
        const updateRequest = store.put(updatedSale);

        updateRequest.onsuccess = () => {
          resolve(updatedSale);
        };

        updateRequest.onerror = () => {
          reject(updateRequest.error);
        };
      };

      getRequest.onerror = () => {
        reject(getRequest.error);
      };
    });
  }

  // Satışı iptal etme
  async cancelSale(saleId: string, reason: string): Promise<Sale | null> {
    return this.updateSale(saleId, {
      status: "cancelled",
      cancelReason: reason,
      cancelDate: new Date(),
    });
  }

  // Satışı iade etme
  async refundSale(saleId: string, reason: string): Promise<Sale | null> {
    return this.updateSale(saleId, {
      status: "refunded",
      refundReason: reason,
      refundDate: new Date(),
    });
  }

  // Günlük satışları alma
  async getDailySales(date: Date = new Date()): Promise<Sale[]> {
    const sales = await this.getAllSales();

    return sales.filter((sale) => {
      const saleDate = new Date(sale.date);
      return (
        saleDate.getDate() === date.getDate() &&
        saleDate.getMonth() === date.getMonth() &&
        saleDate.getFullYear() === date.getFullYear()
      );
    });
  }

  // İndirim uygulama (ayrı bir yardımcı fonksiyon)
  applyDiscount(saleData: Sale, type: 'percentage' | 'amount', value: number): Sale {
    // İndirimsiz fiyatı doğru şekilde al (orijinal fiyat veya mevcut fiyat)
    const originalTotal = saleData.originalTotal || saleData.total;
    
    // İndirimli fiyatı hesapla
    const discountedTotal = discountService.calculateDiscountedTotal(originalTotal, type, value);

    return {
      ...saleData,
      // İndirimli tutarı total'e ata (dış sistemler bunu kullanacak)
      total: discountedTotal,
      // Orijinal tutarı originalTotal olarak sakla (raporlama için)
      originalTotal: originalTotal,
      // İndirim bilgilerini ekle/güncelle
      discount: {
        type,
        value,
        discountedTotal
      }
    };
  }

  // Satış özeti oluşturma (indirim bilgileri dahil)
  async getSalesSummary(startDate: Date, endDate: Date): Promise<{
    totalSales: number;
    totalAmount: number;
    totalDiscount: number;
    originalAmount: number;
    discountedSalesCount: number;
    salesByPaymentMethod: Record<string, number>;
  }> {
    const sales = await this.getSalesWithFilter({
      startDate,
      endDate,
      status: 'completed'
    });
    
    let totalSales = 0;
    let totalAmount = 0;
    let totalDiscount = 0;
    let originalAmount = 0;
    let discountedSalesCount = 0;
    const salesByPaymentMethod: Record<string, number> = {};
    
    for (const sale of sales) {
      totalSales++;
      // Her zaman indirimli (veya indirimsiz) toplam tutarı ekle
      totalAmount += sale.total;
      
      // İndirim bilgileri
      if (sale.discount && sale.originalTotal) {
        discountedSalesCount++;
        const discountAmount = sale.originalTotal - sale.total;
        totalDiscount += discountAmount;
        originalAmount += sale.originalTotal;
      } else {
        // İndirimsiz satışlar için total değerini ekle
        originalAmount += sale.total;
      }
      
      // Ödeme yöntemine göre grupla - her zaman mevcut total değerini kullan
      const method = sale.paymentMethod;
      salesByPaymentMethod[method] = (salesByPaymentMethod[method] || 0) + sale.total;
    }
    
    return {
      totalSales,
      totalAmount,
      totalDiscount,
      originalAmount,
      discountedSalesCount,
      salesByPaymentMethod
    };
  }

  // Fiş numarası oluştur
  generateReceiptNo(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const random = Math.random().toString(36).substring(2, 9).toUpperCase();
    return `F${year}${month}${day}-${random}`; // Fiş no formatı
  }
}

export const salesDB = new SalesService();
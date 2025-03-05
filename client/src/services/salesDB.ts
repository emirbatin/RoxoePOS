// salesDB.ts
import { Sale } from "../types/sales";
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

      const newSale: Sale = {
        ...saleData,
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

        const updatedSale = { ...sale, ...updates };
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
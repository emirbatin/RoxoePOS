// cashRegisterDB.ts
import { openDB, IDBPDatabase } from "idb";
import {
  CashRegisterSession,
  CashRegisterStatus,
  CashTransaction,
  CashTransactionType,
} from "../types/cashRegister";
import { v4 as uuidv4 } from "uuid";
import initUnifiedPOSDB from './UnifiedDBInitializer';

const DB_NAME = "posDB";

// initCashRegisterDB fonksiyonunu birleştirilmiş başlatıcıyı kullanacak şekilde güncelle
const initCashRegisterDB = async () => {
  return initUnifiedPOSDB(); // Birleştirilmiş başlatıcıyı kullan
};

class CashRegisterService {
  async getActiveSession(): Promise<CashRegisterSession | null> {
    const db = await initCashRegisterDB();
    const tx = db.transaction("cashRegisterSessions", "readonly");
    const index = tx.store.index("status");
    const activeSession = await index.get(CashRegisterStatus.OPEN);
    return activeSession || null;
  }

  async openRegister(openingBalance: number): Promise<CashRegisterSession> {
    // Check if there's already an active session
    const activeSession = await this.getActiveSession();
    if (activeSession) {
      throw new Error(
        "Zaten açık bir kasa dönemi mevcut. Önce mevcut dönemi kapatın."
      );
    }

    // Create new session
    const newSession: CashRegisterSession = {
      id: uuidv4(),
      openingDate: new Date(),
      openingBalance: openingBalance,
      cashSalesTotal: 0,
      cardSalesTotal: 0,
      cashDepositTotal: 0,
      cashWithdrawalTotal: 0,
      status: CashRegisterStatus.OPEN,
    };

    // Save to database
    const db = await initCashRegisterDB();
    const tx = db.transaction("cashRegisterSessions", "readwrite");
    await tx.store.add(newSession);
    await tx.done;

    return newSession;
  }

  async addCashTransaction(
    sessionId: string,
    type: CashTransactionType,
    amount: number,
    description: string
  ): Promise<CashTransaction> {
    // Check active session
    const activeSession = await this.getActiveSession();
    if (!activeSession || activeSession.id !== sessionId) {
      throw new Error("Geçerli bir açık kasa dönemi bulunamadı.");
    }

    // Check balance for withdrawals
    if (type === CashTransactionType.WITHDRAWAL) {
      const theoreticalBalance = this.getRegisterBalance(activeSession);
      if (amount > theoreticalBalance) {
        throw new Error("Kasada yeterli nakit yok.");
      }
    }

    // Create new transaction
    const newTransaction: CashTransaction = {
      id: uuidv4(),
      sessionId,
      type,
      amount,
      description,
      date: new Date(),
    };

    // Save transaction to database
    const db = await initCashRegisterDB();
    const tx = db.transaction(
      ["cashTransactions", "cashRegisterSessions"],
      "readwrite"
    );

    // Add transaction
    await tx.objectStore("cashTransactions").add(newTransaction);

    // Update session
    const session = { ...activeSession };
    if (type === CashTransactionType.DEPOSIT) {
      session.cashDepositTotal += amount;
    } else {
      session.cashWithdrawalTotal += amount;
    }

    await tx.objectStore("cashRegisterSessions").put(session);
    await tx.done;

    return newTransaction;
  }

  async recordSale(cashAmount: number, cardAmount: number): Promise<void> {
    const activeSession = await this.getActiveSession();
    if (!activeSession) {
      throw new Error("Açık bir kasa dönemi bulunamadı.");
    }

    const db = await initCashRegisterDB();
    const tx = db.transaction("cashRegisterSessions", "readwrite");

    const session = { ...activeSession };
    session.cashSalesTotal += cashAmount;
    session.cardSalesTotal += cardAmount;

    await tx.store.put(session);
    await tx.done;
  }

  async saveCounting(
    sessionId: string,
    countingAmount: number
  ): Promise<CashRegisterSession> {
    const activeSession = await this.getActiveSession();
    if (!activeSession || activeSession.id !== sessionId) {
      throw new Error("Geçerli bir açık kasa dönemi bulunamadı.");
    }

    const theoreticalBalance = this.getRegisterBalance(activeSession);
    const countingDifference = countingAmount - theoreticalBalance;

    const db = await initCashRegisterDB();
    const tx = db.transaction("cashRegisterSessions", "readwrite");

    const session = { ...activeSession };
    session.countingAmount = countingAmount;
    session.countingDifference = countingDifference;

    await tx.store.put(session);
    await tx.done;

    return session;
  }

  async closeRegister(sessionId: string): Promise<CashRegisterSession> {
    const activeSession = await this.getActiveSession();
    if (!activeSession || activeSession.id !== sessionId) {
      throw new Error("Geçerli bir açık kasa dönemi bulunamadı.");
    }

    const db = await initCashRegisterDB();
    const tx = db.transaction("cashRegisterSessions", "readwrite");

    const session = { ...activeSession };
    session.status = CashRegisterStatus.CLOSED;
    session.closingDate = new Date();

    await tx.store.put(session);
    await tx.done;

    return session;
  }

  async getSessionDetails(sessionId: string): Promise<{ 
    session: CashRegisterSession | null; 
    transactions: CashTransaction[] 
  }> {
    try {
      const db = await initCashRegisterDB();
  
      // Get session info
      const session = await db.get("cashRegisterSessions", sessionId);
      if (!session) {
        console.warn(`Kasa dönemi bulunamadı, ID: ${sessionId}`);
        return { session: null, transactions: [] };
      }
  
      // Get all transactions for this session
      const tx = db.transaction("cashTransactions", "readonly");
      const index = tx.store.index("sessionId");
      let transactions: CashTransaction[] = []; // Tip tanımlaması eklendi
      
      try {
        transactions = await index.getAll(sessionId);
      } catch (err) {
        console.error("İşlem geçmişi alınırken hata:", err);
        transactions = []; // Hata durumunda boş dizi döndür
      }
  
      console.log(`${sessionId} ID'li oturum için ${transactions.length} işlem bulundu`);
      return { session, transactions };
    } catch (error) {
      console.error(`Session details retrieval error for ${sessionId}:`, error);
      return { session: null, transactions: [] }; // Hata durumunda boş dizi döndür
    }
  }

  async getAllSessions(): Promise<CashRegisterSession[]> {
    const db = await initCashRegisterDB();
    return db.getAll("cashRegisterSessions");
  }

  // Helper functions
  getRegisterBalance(session: CashRegisterSession): number {
    return (
      session.openingBalance +
      session.cashSalesTotal +
      session.cashDepositTotal -
      session.cashWithdrawalTotal
    );
  }

  async getVeresiyeTransactions(
    sessionId?: string
  ): Promise<CashTransaction[]> {
    const db = await initCashRegisterDB();

    // Tüm nakit işlemlerini çek
    let tx;
    let transactions;

    if (sessionId) {
      // Belirli bir dönem için
      tx = db.transaction("cashTransactions", "readonly");
      const index = tx.store.index("sessionId");
      transactions = await index.getAll(sessionId);
    } else {
      // Tüm dönemler için
      transactions = await db.getAll("cashTransactions");
    }

    // Açıklaması "Veresiye Tahsilatı" içeren işlemleri filtrele
    return transactions.filter(
      (t) =>
        t.description.toLowerCase().includes("veresiye tahsilatı") ||
        t.description.toLowerCase().includes("veresiye") ||
        t.type === CashTransactionType.CREDIT_COLLECTION // Eğer özel tip eklediyseniz
    );
  }

  // Veresiye tahsilatı özeti
  async getVeresiyeSummary(): Promise<{
    totalCollected: number;
    transactionCount: number;
    byCustomer: { customerId: string; customerName: string; amount: number }[];
  }> {
    const transactions = await this.getVeresiyeTransactions();

    // Müşteri bazlı gruplama için
    const customerMap = new Map();

    // Toplam hesaplama
    let totalCollected = 0;

    for (const tx of transactions) {
      totalCollected += tx.amount;

      // Müşteri ismini açıklamadan çıkar
      const match = tx.description.match(/Veresiye Tahsilatı - (.+)/);
      if (match && match[1]) {
        const customerName = match[1];
        // Müşteri ID'yi eğer kaydetmişsek kullanabiliriz
        const customerId = "unknown"; // Gerçek uygulamada müşteri id'si de kaydedilmeli

        if (customerMap.has(customerName)) {
          customerMap.get(customerName).amount += tx.amount;
        } else {
          customerMap.set(customerName, {
            customerId,
            customerName,
            amount: tx.amount,
          });
        }
      }
    }

    return {
      totalCollected,
      transactionCount: transactions.length,
      byCustomer: Array.from(customerMap.values()),
    };
  }
}

export const cashRegisterService = new CashRegisterService();

// CashRegisterStatus enum'unu dışa aktar
export { CashTransactionType, CashRegisterStatus };
export type { CashRegisterSession };
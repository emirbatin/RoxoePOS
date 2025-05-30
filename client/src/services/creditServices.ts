// creditService.ts
import { openDB } from "idb";
import { Customer, CreditTransaction, CustomerSummary } from "../types/credit";
import DBVersionHelper from '../helpers/DBVersionHelper';

const DB_NAME = "creditDB";

class CreditService {
  private dbPromise = openDB(DB_NAME, DBVersionHelper.getVersion(DB_NAME), {
    upgrade(db, oldVersion, newVersion) {
      console.log(`Upgrading ${DB_NAME} from ${oldVersion} to ${newVersion}`);
      
      if (!db.objectStoreNames.contains("customers")) {
        db.createObjectStore("customers", { keyPath: "id", autoIncrement: true });
        console.log("Created customers store");
      }
      if (!db.objectStoreNames.contains("transactions")) {
        db.createObjectStore("transactions", { keyPath: "id", autoIncrement: true });
        console.log("Created transactions store");
      }
    },
  });

  // Veritabanını yeniden başlatma metodu (gerektiğinde çağrılabilir)
  async initCreditDB() {
    this.dbPromise = openDB(DB_NAME, DBVersionHelper.getVersion(DB_NAME), {
      upgrade(db, oldVersion, newVersion) {
        console.log(`Upgrading ${DB_NAME} from ${oldVersion} to ${newVersion}`);
        
        if (!db.objectStoreNames.contains("customers")) {
          db.createObjectStore("customers", { keyPath: "id", autoIncrement: true });
          console.log("Created customers store");
        }
        if (!db.objectStoreNames.contains("transactions")) {
          db.createObjectStore("transactions", { keyPath: "id", autoIncrement: true });
          console.log("Created transactions store");
        }
      },
    });
    
    return this.dbPromise;
  }

  // Müşteri işlemleri
  async getAllCustomers(): Promise<Customer[]> {
    const db = await this.dbPromise;
    const customers = await db.getAll("customers");
    return customers.map((customer) => ({
      ...customer,
      createdAt: new Date(customer.createdAt), // Tarih formatını düzelt
    })) as Customer[];
  }

  async getCustomerById(id: number): Promise<Customer | null> {
    const db = await this.dbPromise;
    const customer = await db.get("customers", id);
    return customer
      ? { ...customer, createdAt: new Date(customer.createdAt) }
      : null;
  }

  async addCustomer(
    customerData: Omit<Customer, "id" | "currentDebt" | "createdAt">
  ): Promise<Customer> {
    const db = await this.dbPromise;

    const newCustomer: Omit<Customer, "id"> = {
      ...customerData,
      currentDebt: 0,
      createdAt: new Date(),
    };

    const id = await db.add("customers", newCustomer);
    return { ...newCustomer, id: id as number }; // id number olarak zorlanır
  }

  async updateCustomer(customerId: number, updates: Partial<Customer>): Promise<Customer | null> {
    const db = await this.dbPromise;
    const existingCustomer = await this.getCustomerById(customerId);

    if (!existingCustomer) return null;

    const updatedCustomer = { ...existingCustomer, ...updates };
    await db.put("customers", updatedCustomer);

    return updatedCustomer;
  }

  async deleteCustomer(customerId: number): Promise<boolean> {
    const db = await this.dbPromise;
    const customer = await this.getCustomerById(customerId);
    
    if (!customer) return false;
    
    // Müşterinin gerçek borç durumunu kontrol et
    if (customer.currentDebt > 0) {
      console.log(`Müşteri ${customerId}: Borç durumu ${customer.currentDebt}, silinemez.`);
      return false;
    }
    
    // Borcu 0 olsa da, tüm aktif işlemleri kontrol edelim
    const transactions = await this.getTransactionsByCustomerId(customerId);
    const activeTransactions = transactions.filter(t => 
      t.status === "active" || t.status === "overdue"
    );
    
    // Borç 0 ama aktif işlemler varsa
    if (customer.currentDebt === 0 && activeTransactions.length > 0) {
      console.log(`Müşteri ${customerId}: Borç 0 ama ${activeTransactions.length} aktif işlem var. Bunları temizliyoruz.`);
      
      // Tüm aktif işlemleri "paid" olarak işaretle
      for (const tx of activeTransactions) {
        await this.updateTransactionStatus(tx.id, "paid");
      }
    }
    
    // Müşteriyi sil
    await db.delete("customers", customerId);
    return true;
  }

  // Veresiye işlemleri
  async getAllTransactions(): Promise<CreditTransaction[]> {
    const db = await this.dbPromise;
    const transactions = await db.getAll("transactions");
    return transactions.map((transaction) => ({
      ...transaction,
      date: new Date(transaction.date),
      dueDate: transaction.dueDate ? new Date(transaction.dueDate) : undefined,
    })) as CreditTransaction[];
  }

  async getTransactionsByCustomerId(customerId: number): Promise<CreditTransaction[]> {
    const transactions = await this.getAllTransactions();
    return transactions
      .filter((t) => t.customerId === customerId)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  // Ödeme işlemi yaparken borçları otomatik olarak işleyen yeni metot
  async processPayment(customerId: number, paymentAmount: number): Promise<boolean> {
    try {
      // 1. Müşterinin aktif borç işlemlerini en eski eklenen olandan başlayarak al
      const activeDebts = await this.getTransactionsByCustomerId(customerId)
        .then(txs => 
          txs.filter(tx => 
            tx.type === 'debt' && 
            (tx.status === 'active' || tx.status === 'overdue')
          ).sort((a, b) => {
            // Önce eklenme tarihine göre sırala (en eski eklenmiş borç önce)
            return new Date(a.date).getTime() - new Date(b.date).getTime();
          })
        );
      
      console.log("Aktif borçlar:", activeDebts.map(d => 
        `ID: ${d.id}, Miktar: ${d.amount}, Tarih: ${d.date.toLocaleDateString()}, Vade: ${d.dueDate?.toLocaleDateString() || "Yok"}`
      ));
      
      // 2. Ödeme miktarını en eski eklenen borçlardan başlayarak düş
      let remainingPayment = paymentAmount;
      const paidDebts = [];
      
      for (const debt of activeDebts) {
        if (remainingPayment <= 0) break;
        
        // Bu borç ne kadar ödenebilir?
        const paymentForThisDebt = Math.min(debt.amount, remainingPayment);
        
        if (paymentForThisDebt >= debt.amount) {
          // Borç tamamen ödendi
          await this.updateTransactionStatus(debt.id, 'paid');
          paidDebts.push({ id: debt.id, amount: debt.amount, fullyPaid: true });
          remainingPayment -= debt.amount;
          console.log(`Borç ${debt.id} tamamen ödendi: ${debt.amount}. Kalan ödeme: ${remainingPayment}`);
        } else {
          // Borç kısmen ödendi - işlem tutarını güncelle
          const db = await this.dbPromise;
          const transaction = await db.get("transactions", debt.id);
          
          if (transaction) {
            // Kalan borç tutarını hesapla
            const updatedAmount = debt.amount - paymentForThisDebt;
            
            // İşlemi güncelle
            transaction.amount = updatedAmount;
            await db.put("transactions", transaction);
            
            paidDebts.push({ id: debt.id, amount: paymentForThisDebt, fullyPaid: false });
            console.log(`Borç ${debt.id} kısmen ödendi: ${paymentForThisDebt}/${debt.amount}. Kalan borç: ${updatedAmount}`);
            remainingPayment = 0;
          }
        }
      }
      
      console.log("Ödenen borçlar:", paidDebts);
      
      return true;
    } catch (error) {
      console.error("Ödeme işleme hatası:", error);
      return false;
    }
  }

  async addTransaction(
    transaction: Omit<CreditTransaction, "id" | "status">
  ): Promise<CreditTransaction> {
    const db = await this.dbPromise;

    const customer = await this.getCustomerById(transaction.customerId);
    if (!customer) throw new Error("Müşteri bulunamadı");

    // Borç ekleme işlemi için limit kontrolü
    if (transaction.type === "debt") {
      const newTotalDebt = customer.currentDebt + transaction.amount;
      if (newTotalDebt > customer.creditLimit) {
        throw new Error("Kredi limiti aşılıyor");
      }
    }

    const newTransaction: Omit<CreditTransaction, "id"> = {
      ...transaction,
      status: "active",
    };

    const id = await db.add("transactions", newTransaction);
    const debtChange =
      transaction.type === "debt" ? transaction.amount : -transaction.amount;

    // Müşteri borç durumunu güncelle
    await this.updateCustomer(customer.id, {
      currentDebt: customer.currentDebt + debtChange,
    });

    // Eğer ödeme işlemiyse, ilgili borçları otomatik olarak güncelle
    if (transaction.type === "payment") {
      await this.processPayment(transaction.customerId, transaction.amount);
    }

    return { ...newTransaction, id: id as number }; // id number olarak zorlanır
  }

  async updateTransactionStatus(
    transactionId: number,
    status: CreditTransaction["status"]
  ): Promise<CreditTransaction | null> {
    const db = await this.dbPromise;
    const transaction = await db.get("transactions", transactionId);

    if (!transaction) return null;

    const updatedTransaction = { ...transaction, status };
    await db.put("transactions", updatedTransaction);

    return updatedTransaction;
  }

  // Özet istatistikler
  // creditService.ts içindeki getCustomerSummary metodunu güncelle
  async getCustomerSummary(customerId: number): Promise<CustomerSummary> {
    const transactions = await this.getTransactionsByCustomerId(customerId);
    const activeTransactions = transactions.filter(
      (t) => t.status === "active" || t.status === "overdue"
    );

    // İndirimli işlemleri bul
    const discountedTransactions = transactions.filter(
      (t) => t.discountAmount && t.discountAmount > 0
    );
    
    // Toplam indirim tutarı
    const totalDiscount = discountedTransactions.reduce(
      (sum, t) => sum + (t.discountAmount || 0), 0
    );

    const summary: CustomerSummary = {
      totalDebt: activeTransactions.reduce(
        (sum, t) => sum + (t.type === "debt" ? t.amount : -t.amount),
        0
      ),
      totalOverdue: activeTransactions
        .filter((t) => t.status === "overdue")
        .reduce((sum, t) => sum + t.amount, 0),
      lastTransactionDate: transactions[0]?.date,
      activeTransactions: activeTransactions.length,
      overdueTransactions: activeTransactions.filter(
        (t) => t.status === "overdue"
      ).length,
      // Eksik alanları ekle
      discountedSalesCount: discountedTransactions.length,
      totalDiscount: totalDiscount
    };

    return summary;
  }
}

export const creditService = new CreditService();
import { openDB } from "idb";
import { Customer, CreditTransaction, CustomerSummary } from "../types/credit";

const DB_NAME = "creditDB";
const DB_VERSION = 1;

class CreditService {
  private dbPromise = openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("customers")) {
        db.createObjectStore("customers", { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains("transactions")) {
        db.createObjectStore("transactions", { keyPath: "id", autoIncrement: true });
      }
    },
  });

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
    const transactions = await this.getTransactionsByCustomerId(customerId);

    // Müşterinin aktif borcu varsa silmeye izin verme
    if (transactions.some((t) => t.status === "active" || t.status === "overdue")) {
      return false;
    }

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
  async getCustomerSummary(customerId: number): Promise<CustomerSummary> {
    const transactions = await this.getTransactionsByCustomerId(customerId);
    const activeTransactions = transactions.filter(
      (t) => t.status === "active" || t.status === "overdue"
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
    };

    return summary;
  }
}

export const creditService = new CreditService();
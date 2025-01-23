import { Customer, CreditTransaction, CustomerSummary } from "../types/credit";

const CUSTOMERS_STORAGE_KEY = "pos_customers";
const TRANSACTIONS_STORAGE_KEY = "pos_credit_transactions";

class CreditService {
  // Müşteri işlemleri
  getAllCustomers(): Customer[] {
    const customersJson = localStorage.getItem(CUSTOMERS_STORAGE_KEY);
    if (!customersJson || customersJson === "null") return [];

    try {
      const customers = JSON.parse(customersJson);
      return customers.map((customer: any) => ({
        ...customer,
        createdAt: new Date(customer.createdAt),
      }));
    } catch (error) {
      console.error("Müşteri verilerini okuma hatası:", error);
      return [];
    }
  }

  getCustomerById(id: number): Customer | null {
    const customers = this.getAllCustomers();
    const customer = customers.find((c) => c.id === id);
    return customer || null;
  }

  addCustomer(
    customerData: Omit<Customer, "id" | "currentDebt" | "createdAt">
  ): Customer {
    const customers = this.getAllCustomers();

    const newCustomer: Customer = {
      ...customerData,
      id:
        customers.length > 0 ? Math.max(...customers.map((c) => c.id)) + 1 : 1,
      currentDebt: 0,
      createdAt: new Date(),
    };

    customers.push(newCustomer);
    localStorage.setItem(CUSTOMERS_STORAGE_KEY, JSON.stringify(customers));

    return newCustomer;
  }

  updateCustomer(
    customerId: number,
    updates: Partial<Customer>
  ): Customer | null {
    const customers = this.getAllCustomers();
    const index = customers.findIndex((c) => c.id === customerId);

    if (index === -1) return null;

    const updatedCustomer = { ...customers[index], ...updates };
    customers[index] = updatedCustomer;

    localStorage.setItem(CUSTOMERS_STORAGE_KEY, JSON.stringify(customers));
    return updatedCustomer;
  }

  deleteCustomer(customerId: number): boolean {
    const customers = this.getAllCustomers();
    const transactions = this.getTransactionsByCustomerId(customerId);

    // Müşterinin aktif borcu varsa silmeye izin verme
    if (
      transactions.some((t) => t.status === "active" || t.status === "overdue")
    ) {
      return false;
    }

    const filteredCustomers = customers.filter((c) => c.id !== customerId);
    localStorage.setItem(
      CUSTOMERS_STORAGE_KEY,
      JSON.stringify(filteredCustomers)
    );
    return true;
  }

  // Veresiye işlemleri
  getAllTransactions(): CreditTransaction[] {
    const transactionsJson = localStorage.getItem(TRANSACTIONS_STORAGE_KEY);
    if (!transactionsJson) return [];

    try {
      const transactions = JSON.parse(transactionsJson);
      return transactions.map((transaction: any) => ({
        ...transaction,
        date: new Date(transaction.date),
        dueDate: transaction.dueDate
          ? new Date(transaction.dueDate)
          : undefined,
      }));
    } catch (error) {
      console.error("İşlem verilerini okuma hatası:", error);
      return [];
    }
  }

  getTransactionsByCustomerId(customerId: number): CreditTransaction[] {
    return this.getAllTransactions()
      .filter((t) => t.customerId === customerId)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  addTransaction(
    transaction: Omit<CreditTransaction, "id" | "status">
  ): CreditTransaction {
    const transactions = this.getAllTransactions();
    const customer = this.getCustomerById(transaction.customerId);

    if (!customer) throw new Error("Müşteri bulunamadı");

    // Borç ekleme işlemi için limit kontrolü
    if (transaction.type === "debt") {
      const newTotalDebt = customer.currentDebt + transaction.amount;
      if (newTotalDebt > customer.creditLimit) {
        throw new Error("Kredi limiti aşılıyor");
      }
    }

    const newTransaction: CreditTransaction = {
      ...transaction,
      id: Math.max(...transactions.map((t) => t.id), 0) + 1,
      status: "active",
    };

    // Müşteri borç durumunu güncelle
    const debtChange =
      transaction.type === "debt" ? transaction.amount : -transaction.amount;
    this.updateCustomer(customer.id, {
      currentDebt: customer.currentDebt + debtChange,
    });

    transactions.push(newTransaction);
    localStorage.setItem(
      TRANSACTIONS_STORAGE_KEY,
      JSON.stringify(transactions)
    );

    return newTransaction;
  }

  updateTransactionStatus(
    transactionId: number,
    status: CreditTransaction["status"]
  ): CreditTransaction | null {
    const transactions = this.getAllTransactions();
    const index = transactions.findIndex((t) => t.id === transactionId);

    if (index === -1) return null;

    transactions[index] = { ...transactions[index], status };
    localStorage.setItem(
      TRANSACTIONS_STORAGE_KEY,
      JSON.stringify(transactions)
    );

    return transactions[index];
  }

  // Özet istatistikler
  getCustomerSummary(customerId: number): CustomerSummary {
    const transactions = this.getTransactionsByCustomerId(customerId);
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

  // Vade takibi
  checkOverdueTransactions(): void {
    const transactions = this.getAllTransactions();
    const today = new Date();

    transactions.forEach((transaction) => {
      if (
        transaction.status === "active" &&
        transaction.dueDate &&
        transaction.dueDate < today
      ) {
        this.updateTransactionStatus(transaction.id, "overdue");
      }
    });
  }
}

export const creditService = new CreditService();

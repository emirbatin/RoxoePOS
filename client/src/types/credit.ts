export interface Customer {
    id: number;
    name: string;
    phone: string;
    address?: string;
    taxNumber?: string;
    creditLimit: number;
    currentDebt: number;
    createdAt: Date;
    note?: string;
  }
  
  export interface CreditTransaction {
    id: number;
    customerId: number;
    type: 'debt' | 'payment';  // borç veya ödeme
    amount: number;
    date: Date;
    dueDate?: Date;  // vade tarihi
    description: string;
    status: 'active' | 'paid' | 'overdue';
    relatedSaleId?: string;  // ilgili satış varsa
  }
  
  export interface CustomerSummary {
    totalDebt: number;
    totalOverdue: number;
    lastTransactionDate?: Date;
    activeTransactions: number;
    overdueTransactions: number;
  }
  
  export interface CreditFilter {
    startDate?: Date;
    endDate?: Date;
    status?: CreditTransaction['status'];
    type?: CreditTransaction['type'];
    minAmount?: number;
    maxAmount?: number;
  }